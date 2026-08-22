"""
Behavioral Similarity Graph — Real Graph + ML Integration
=========================================================
Builds a graph where nodes = accounts and edges = behavioral similarity,
then extracts per-account graph features for XGBoost input.

This IS the implementation of Sir 1 (Vishal Madan)'s suggestion:
  "Enriched graph edges with frequency, velocity, channel_diversity,
   time_spread, round_amount_ratio, risk_gradient as edge attributes.
   Integrate graph features as XGBoost input columns."

ADAPTED for the data we ACTUALLY have:
  - We have ONE ROW PER ACCOUNT with ~3,900 aggregated features
  - We do NOT have a transaction ledger (source_acct → dest_acct per txn)
  - Instead of transaction edges, we build BEHAVIORAL SIMILARITY edges:
    accounts that look alike in transaction volume/velocity/channel mix
    are connected, because mule accounts in the same fraud ring exhibit
    near-identical behavioral signatures.
"""

import time
import numpy as np
import pandas as pd
import networkx as nx
from typing import Dict, List, Optional, Tuple
from sklearn.neighbors import NearestNeighbors


class BehavioralSimilarityGraph:
    """
    Builds a behavioral similarity network from account-level data
    and extracts graph features for ML model input.
    """

    SIMILARITY_FEATURES = ['F3800', 'F3801', 'F1692', 'F2082', 'F2122', 'F2582', 'F2678']

    HARD_LINK_COLUMNS = {
        'F3886': 'account_type',
        'F3891': 'occupation',
        'F3887': 'branch_indicator',
    }

    CHANNEL_FEATURES = {
        'atm_cash': 'F1692',
        'net_banking': 'F2082',
        'upi': 'F2582',
        'electronic': 'F2678',
    }

    def __init__(self, n_neighbors: int = 10, similarity_threshold: float = 0.80,
                 hard_link_weight: float = 0.5, max_nodes_for_betweenness: int = 5000):
        self.n_neighbors = n_neighbors
        self.similarity_threshold = similarity_threshold
        self.hard_link_weight = hard_link_weight
        self.max_nodes_for_betweenness = max_nodes_for_betweenness
        self.graph: Optional[nx.DiGraph] = None
        self._graph_features_df: Optional[pd.DataFrame] = None

    def build_graph(self, df: pd.DataFrame, risk_scores: Optional[Dict[str, int]] = None,
                    target_col: str = 'F3924') -> nx.DiGraph:
        t0 = time.time()
        graph = nx.DiGraph()

        if 'account_id' in df.columns:
            account_ids = df['account_id'].astype(str).tolist()
        else:
            account_ids = [str(i) for i in range(len(df))]

        if risk_scores is None:
            risk_scores = {}
            for i, aid in enumerate(account_ids):
                if target_col in df.columns:
                    risk_scores[aid] = 900 if df[target_col].iloc[i] == 1 else 100
                else:
                    risk_scores[aid] = 0

        for i, aid in enumerate(account_ids):
            row = df.iloc[i]
            graph.add_node(aid, risk_score=risk_scores.get(aid, 0),
                           total_credit=_sf(row.get('F3800', 0)),
                           total_debit=_sf(row.get('F3801', 0)),
                           account_type=str(row.get('F3886', 'unknown')),
                           occupation=str(row.get('F3891', 'unknown')))

        n_sim = self._add_similarity_edges(graph, df, account_ids, risk_scores)
        n_hard = self._add_hard_links(graph, df, account_ids)

        elapsed = time.time() - t0
        print(f"  BehavioralSimilarityGraph: {graph.number_of_nodes()} nodes, "
              f"{graph.number_of_edges()} edges ({n_sim} sim + {n_hard} hard) in {elapsed:.1f}s")
        self.graph = graph
        return graph

    def _add_similarity_edges(self, graph, df, account_ids, risk_scores):
        sim_features = [f for f in self.SIMILARITY_FEATURES if f in df.columns]
        if not sim_features:
            return 0
        fm = df[sim_features].fillna(0).values.astype(np.float64)
        fm = np.nan_to_num(fm, nan=0.0, posinf=0.0, neginf=0.0)
        norms = np.linalg.norm(fm, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        normalized = fm / norms
        n = len(df)
        k = min(self.n_neighbors * 3, n - 1)
        print(f"  Computing {k}-NN on {n} accounts with {len(sim_features)} features...")
        nn = NearestNeighbors(n_neighbors=k + 1, metric='cosine', algorithm='brute')
        nn.fit(normalized)
        distances, indices = nn.kneighbors(normalized)
        edge_count = 0
        for i in range(n):
            for j_idx in range(1, k + 1):
                j = indices[i, j_idx]
                csim = 1.0 - distances[i, j_idx]
                if csim < self.similarity_threshold:
                    continue
                src, tgt = account_ids[i], account_ids[j]
                if graph.has_edge(src, tgt) or graph.has_edge(tgt, src):
                    continue
                di = _sf(df.iloc[i].get('F3801', 0))
                dj = _sf(df.iloc[j].get('F3801', 0))
                if di >= dj:
                    fid, tid, fr, tr = src, tgt, df.iloc[i], df.iloc[j]
                else:
                    fid, tid, fr, tr = tgt, src, df.iloc[j], df.iloc[i]
                ea = self._edge_attrs(fr, tr, csim, risk_scores.get(fid, 0), risk_scores.get(tid, 0), 'similarity')
                graph.add_edge(fid, tid, **ea)
                edge_count += 1
        print(f"  K-NN edges: {edge_count}")
        return edge_count

    def _add_hard_links(self, graph, df, account_ids):
        edge_count = 0
        for col, label in self.HARD_LINK_COLUMNS.items():
            if col not in df.columns:
                continue
            groups = df.groupby(col)
            for gv, gi in groups.groups.items():
                members = gi.tolist()
                if len(members) < 2 or len(members) > 200:
                    continue
                for i in range(len(members)):
                    for j in range(i + 1, min(len(members), i + 6)):
                        s, t = account_ids[members[i]], account_ids[members[j]]
                        if graph.has_edge(s, t) or graph.has_edge(t, s):
                            continue
                        di = _sf(df.iloc[members[i]].get('F3801', 0))
                        dj = _sf(df.iloc[members[j]].get('F3801', 0))
                        if di >= dj:
                            fid, tid, fr, tr = s, t, df.iloc[members[i]], df.iloc[members[j]]
                        else:
                            fid, tid, fr, tr = t, s, df.iloc[members[j]], df.iloc[members[i]]
                        ea = self._edge_attrs(fr, tr, self.hard_link_weight,
                                              graph.nodes[fid].get('risk_score', 0),
                                              graph.nodes[tid].get('risk_score', 0), f'shared_{label}')
                        ea['similarity'] = self.hard_link_weight
                        graph.add_edge(fid, tid, **ea)
                        edge_count += 1
        print(f"  Hard-link edges: {edge_count}")
        return edge_count

    def _edge_attrs(self, fr, tr, sim, fr_risk, to_risk, edge_type='similarity'):
        fd = _sf(fr.get('F3801', 0)); tc = _sf(tr.get('F3800', 0))
        amt = min(fd, tc) if fd > 0 and tc > 0 else max(fd, tc)
        ft = _sf(fr.get('F1692', 0)) + _sf(fr.get('F2082', 0))
        tt = _sf(tr.get('F1692', 0)) + _sf(tr.get('F2082', 0))
        freq = max(1, int((ft + tt) / 2))
        vel = freq / 31.0
        avg_amt = amt / freq if freq > 0 else 0.0
        rr = 0.0
        if avg_amt > 0:
            for base in [1000, 5000, 10000, 25000, 50000, 100000, 500000]:
                if abs(avg_amt - base) / base < 0.02:
                    rr = 1.0; break
        fc = sum(1 for _, c in self.CHANNEL_FEATURES.items() if c in fr.index and pd.notna(fr[c]) and _sf(fr[c]) > 0)
        tcc = sum(1 for _, c in self.CHANNEL_FEATURES.items() if c in tr.index and pd.notna(tr[c]) and _sf(tr[c]) > 0)
        cd = min(fc + tcc, 4)
        ts = (31 * 24) / freq if freq > 0 and amt > 0 else 744.0
        rg = abs(fr_risk - to_risk)
        return {'amount': round(amt, 2), 'frequency': freq, 'velocity': round(vel, 4),
                'avg_amount': round(avg_amt, 2), 'round_amount_ratio': round(rr, 2),
                'channel_diversity': cd, 'time_spread_hours': round(ts, 2),
                'similarity': round(sim, 4), 'risk_gradient': rg, 'edge_type': edge_type}

    def extract_graph_features(self, account_ids: List[str]) -> pd.DataFrame:
        if self.graph is None:
            raise RuntimeError("Call build_graph() first")
        t0 = time.time()
        graph = self.graph
        records = []
        print("  Computing PageRank...")
        try:
            pr = nx.pagerank(graph, weight='amount', max_iter=100)
        except:
            pr = {n: 1.0 / max(graph.number_of_nodes(), 1) for n in graph.nodes()}
        print("  Computing Louvain communities...")
        try:
            comms = nx.community.louvain_communities(graph.to_undirected(), weight='amount', seed=42)
        except:
            comms = [set(graph.nodes())]
        cof = {}
        for idx, c in enumerate(comms):
            for n in c:
                cof[n] = idx
        cr = {}
        cmc = {}
        for idx, c in enumerate(comms):
            risks = [graph.nodes[n].get('risk_score', 0) for n in c if n in graph]
            cr[idx] = float(np.mean(risks)) if risks else 0.0
            cmc[idx] = sum(1 for r in risks if r > 600)
        print("  Computing betweenness centrality...")
        nn = graph.number_of_nodes()
        if nn <= self.max_nodes_for_betweenness:
            try:
                bet = nx.betweenness_centrality(graph, weight='amount')
            except:
                bet = {n: 0.0 for n in graph.nodes()}
        else:
            ks = min(500, nn)
            try:
                bet = nx.betweenness_centrality(graph, weight='amount', k=ks)
            except:
                bet = {n: 0.0 for n in graph.nodes()}
        print("  Computing k-core and clustering...")
        try:
            cn = nx.core_number(graph.to_undirected())
        except:
            cn = {n: 0 for n in graph.nodes()}
        try:
            cl = nx.clustering(graph.to_undirected())
        except:
            cl = {n: 0.0 for n in graph.nodes()}

        GF = ['pagerank_score', 'betweenness_score', 'community_risk', 'community_mule_count',
              'degree_in', 'degree_out', 'clustering_coefficient', 'k_core_number',
              'max_edge_velocity', 'max_edge_frequency', 'avg_edge_channel_diversity',
              'max_edge_risk_gradient', 'avg_edge_similarity', 'burst_edge_count',
              'mule_neighbors_count', 'mule_neighbors_ratio']

        for aid in account_ids:
            if not graph.has_node(aid):
                records.append({'account_id': aid, **{f: (0.0 if f != 'community_id' and f != 'k_core_number' and f != 'community_mule_count' and f != 'degree_in' and f != 'degree_out' and f != 'burst_edge_count' and f != 'mule_neighbors_count' else 0) for f in GF}})
                continue
            ie = list(graph.in_edges(aid, data=True))
            oe = list(graph.out_edges(aid, data=True))
            ae = ie + oe
            vs = [d.get('velocity', 0) for _, _, d in ae]
            fs = [d.get('frequency', 0) for _, _, d in ae]
            cds = [d.get('channel_diversity', 0) for _, _, d in ae]
            rgs = [d.get('risk_gradient', 0) for _, _, d in ae]
            ss = [d.get('similarity', 0) for _, _, d in ae]
            bc = sum(1 for _, _, d in ae if d.get('velocity', 0) > 1.0 and d.get('channel_diversity', 0) >= 2)
            nids = set()
            for s, t, _ in ae:
                nids.add(s); nids.add(t)
            nids.discard(aid)
            mn = sum(1 for nid in nids if graph.has_node(nid) and graph.nodes[nid].get('risk_score', 0) > 600)
            tn = len(nids)
            mnr = mn / tn if tn > 0 else 0.0
            cid = cof.get(aid, -1)
            records.append({
                'account_id': aid, 'pagerank_score': pr.get(aid, 0.0),
                'betweenness_score': bet.get(aid, 0.0), 'community_risk': cr.get(cid, 0.0),
                'community_mule_count': cmc.get(cid, 0), 'degree_in': len(ie), 'degree_out': len(oe),
                'clustering_coefficient': cl.get(aid, 0.0), 'k_core_number': cn.get(aid, 0),
                'max_edge_velocity': max(vs) if vs else 0.0, 'max_edge_frequency': max(fs) if fs else 0,
                'avg_edge_channel_diversity': float(np.mean(cds)) if cds else 0.0,
                'max_edge_risk_gradient': max(rgs) if rgs else 0,
                'avg_edge_similarity': float(np.mean(ss)) if ss else 0.0,
                'burst_edge_count': bc, 'mule_neighbors_count': mn, 'mule_neighbors_ratio': round(mnr, 4),
            })
        self._graph_features_df = pd.DataFrame(records)
        print(f"  Graph features extracted for {len(records)} accounts in {time.time()-t0:.1f}s")
        return self._graph_features_df

    def get_neighborhood(self, account_id: str, max_hops: int = 2, max_nodes: int = 30) -> dict:
        if self.graph is None or not self.graph.has_node(account_id):
            return {"nodes": [{"id": account_id, "type": "normal"}], "edges": []}
        visited = {account_id}; frontier = {account_id}
        for hop in range(max_hops):
            nf = set()
            for node in frontier:
                for neighbor in list(self.graph.successors(node)) + list(self.graph.predecessors(node)):
                    if neighbor not in visited:
                        nf.add(neighbor)
            visited.update(nf); frontier = nf
            if len(visited) >= max_nodes:
                break
        vl = list(visited)
        if len(vl) > max_nodes:
            vl = [account_id] + [n for n in vl if n != account_id][:max_nodes - 1]
        sg = self.graph.subgraph(vl)
        np_ = []
        for nid in sg.nodes():
            a = sg.nodes[nid]; risk = a.get('risk_score', 0)
            nt = "mule" if nid == account_id and risk > 600 else ("mule" if risk > 600 else "normal")
            np_.append({"id": str(nid), "type": nt})
        ep = []
        for s, t, a in sg.edges(data=True):
            ep.append({"source": str(s), "target": str(t), "amount": round(float(a.get('amount', 0)), 2)})
        return {"nodes": np_, "edges": ep}


def _sf(val) -> float:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0
