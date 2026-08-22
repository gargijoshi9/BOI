"""
Graph Engine - Graph Initializer
Initializes a NetworkX DiGraph schema from transaction DataFrames for mule account detection.

Also provides account-level network intelligence: since MuleRadar's
current dataset is one row per account (engineered features) rather than
a real transaction ledger, build_synthetic_account_neighborhood()
deterministically constructs a plausible small transaction graph AROUND
a single flagged account, derived from that account's own feature
values (inflow/cash-out volume, counterparty count, risk score) - using
the same reproducible-seeding philosophy as MuleRiskAnalyzer's simulator
fallback, but producing a real networkx.DiGraph.

IMPORTANT - what's real vs. synthesized here, stated plainly:
  - The GRAPH EDGES (who transacts with whom, how much) are synthesized
    from account-level features, NOT sourced from a real transaction
    ledger, because no such ledger is available in the current dataset.
  - The GRAPH ALGORITHMS (PageRank, Louvain community detection,
    betweenness centrality) are genuinely real - they run against
    whatever graph they're given, synthetic or not, and their outputs
    (hub scores, community assignments, relay identification) are
    computed exactly as they would be against real transaction data.
  - Once a real transaction-level table is available, only
    build_synthetic_account_neighborhood() needs replacing with a real
    query - compute_network_intelligence() and build_graph_from_dataframe()
    already work against genuine data unchanged.
"""

import hashlib
from typing import Any, Dict, List

import networkx as nx
import pandas as pd


class TransactionGraphInitializer:
    """Initializes and builds a NetworkX directed graph from transaction records,
    and provides network intelligence (PageRank, community detection, betweenness
    centrality) against either real or synthesized account graphs."""

    def __init__(self) -> None:
        """Initializes a new TransactionGraphInitializer with an empty directed graph."""
        self.graph = nx.DiGraph()

    def build_graph_from_dataframe(
        self,
        df: pd.DataFrame,
        source_col: str = "source_account",
        target_col: str = "destination_account",
    ) -> nx.DiGraph:
        """Builds a directed graph from a transaction DataFrame.

        Nodes representing the source and destination accounts are added with default
        attributes 'account_type' ('unknown') and 'risk_score' (0.0) if they do not exist.
        Directed edges are added with transaction attributes: amount, timestamp, and tx_id.

        Args:
            df: Pandas DataFrame containing transaction records.
            source_col: Column name for the source accounts. Defaults to 'source_account'.
            target_col: Column name for the destination accounts. Defaults to 'destination_account'.

        Returns:
            nx.DiGraph: The populated directed graph.
        """
        for _, row in df.iterrows():
            source = row[source_col]
            target = row[target_col]

            # Add source node if it doesn't exist
            if not self.graph.has_node(source):
                self.graph.add_node(source, account_type="unknown", risk_score=0.0)

            # Add target node if it doesn't exist
            if not self.graph.has_node(target):
                self.graph.add_node(target, account_type="unknown", risk_score=0.0)

            # Add directed edge from source to target with transaction details
            self.graph.add_edge(
                source,
                target,
                amount=float(row.get("amount", 0.0)),
                timestamp=str(row.get("timestamp", "")),
                tx_id=str(row.get("tx_id", "")),
            )

        return self.graph

    def get_graph_summary(self) -> Dict[str, Any]:
        """Returns a summary of the constructed graph.

        Returns:
            dict: Summary containing total nodes, total edges, and if the graph is directed.
        """
        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "is_directed": self.graph.is_directed(),
        }

    # ------------------------------------------------------------------
    # Account-level network intelligence (synthetic neighborhood +
    # real graph algorithms)
    # ------------------------------------------------------------------

    @staticmethod
    def _deterministic_seed(account_id: str, salt: str = "") -> int:
        """
        Derives a stable, reproducible integer seed from an account_id
        (and optional salt for generating multiple independent random
        streams from the same account_id). Uses sha256 rather than
        Python's built-in hash() because hash() is salted per-process in
        modern Python (PYTHONHASHSEED) and would produce a DIFFERENT
        graph every time the server restarts - defeating the whole
        point of deterministic, demo-stable output.
        """
        digest = hashlib.sha256(f"{account_id}:{salt}".encode("utf-8")).hexdigest()
        return int(digest[:12], 16)

    def build_synthetic_account_neighborhood(
        self,
        account_id: str,
        risk_score: int,
        inflow: float = 0.0,
        cash_out: float = 0.0,
        counterparty_hint: int = 0,
    ) -> nx.DiGraph:
        """
        Builds a small directed transaction graph centered on account_id.

        The number of neighbors, edge amounts, and graph shape are all
        deterministically derived from account_id and its own feature
        values - NOT random per-call, and NOT sourced from a real
        transaction ledger (see module docstring). A higher risk_score
        produces a denser, more ring-like neighborhood (more relay
        hops before cash-out); a low risk_score produces a sparser,
        more typical-looking neighborhood.

        Args:
            account_id: The account being evaluated - becomes the
                central node of the graph.
            risk_score: 0-1000 risk score from the ensemble model.
                Higher scores bias toward a denser, ring-shaped graph.
            inflow: The account's inflow feature value (used to scale
                inbound edge amounts).
            cash_out: The account's cash-out feature value (used to
                scale outbound edge amounts).
            counterparty_hint: A rough count of distinct counterparties
                (e.g. from a narrow-network feature), used to bound how
                many neighbor nodes get generated.

        Returns:
            nx.DiGraph: A small directed graph with account_id as the
            central node, plus synthesized upstream ("source"/victim)
            neighbors, downstream neighbors, and - for higher-risk
            accounts - at least one relay hop before a cash-out node.
        """
        graph = nx.DiGraph()
        graph.add_node(account_id, account_type="mule" if risk_score > 600 else "normal")

        # Bound the neighborhood size: 2-5 nodes normally, up to 6 for
        # higher-risk accounts (more suspicious accounts get a richer,
        # more ring-like neighborhood to investigate).
        base_seed = self._deterministic_seed(account_id, "neighbor_count")
        min_neighbors = 2
        max_neighbors = 6 if risk_score > 600 else 4
        # Also respect counterparty_hint loosely as an upper bound, if
        # it's a small, plausible number (avoids generating a huge
        # neighborhood for an account whose real data suggests a very
        # narrow network).
        if 0 < counterparty_hint < max_neighbors:
            max_neighbors = max(min_neighbors, counterparty_hint)
        neighbor_count = min_neighbors + (base_seed % (max_neighbors - min_neighbors + 1))

        # Split neighbors into "upstream" (send funds INTO account_id -
        # visualized as victims/sources) and "downstream" (account_id
        # sends funds OUT to them). Ensure at least one of each so the
        # graph always has both an inbound and outbound side.
        upstream_count = max(1, neighbor_count // 2)
        downstream_count = max(1, neighbor_count - upstream_count)

        # Scale synthetic edge amounts off the account's own real
        # inflow/cash-out feature values, so a high-volume account
        # produces larger edge amounts than a low-volume one, rather
        # than a fixed arbitrary constant.
        inflow_base = max(abs(inflow), 1000.0)
        cash_out_base = max(abs(cash_out), 1000.0)

        # --- Upstream (victim-like) nodes feeding funds INTO account_id ---
        for i in range(upstream_count):
            node_seed = self._deterministic_seed(account_id, f"upstream_{i}")
            node_id = f"SRC-{node_seed % 90000 + 10000}"
            edge_amount = round(inflow_base * (0.15 + (node_seed % 40) / 100.0), 2)
            graph.add_node(node_id, account_type="normal")
            graph.add_edge(node_id, account_id, amount=edge_amount)

        # --- Downstream nodes receiving funds FROM account_id ---
        # For higher-risk accounts, route the LAST downstream hop through
        # an intermediate relay node before reaching a terminal cash-out
        # node - this is what gives betweenness centrality something
        # meaningful to detect (a relay account sitting on the path
        # between the mule and the cash-out point).
        use_relay = risk_score > 600
        for i in range(downstream_count):
            node_seed = self._deterministic_seed(account_id, f"downstream_{i}")
            edge_amount = round(cash_out_base * (0.15 + (node_seed % 40) / 100.0), 2)

            is_last_hop = i == downstream_count - 1
            if is_last_hop and use_relay:
                relay_id = f"RLY-{node_seed % 90000 + 10000}"
                cash_out_id = f"BOI-{(node_seed * 7) % 90000 + 10000}"
                relay_amount = round(edge_amount * 0.92, 2)  # small skim, realistic for a relay hop
                graph.add_node(relay_id, account_type="normal")
                graph.add_node(cash_out_id, account_type="cash_out")
                graph.add_edge(account_id, relay_id, amount=edge_amount)
                graph.add_edge(relay_id, cash_out_id, amount=relay_amount)
            else:
                node_id = f"DST-{node_seed % 90000 + 10000}"
                node_type = "cash_out" if is_last_hop else "normal"
                graph.add_node(node_id, account_type=node_type)
                graph.add_edge(account_id, node_id, amount=edge_amount)

        return graph

    def compute_network_intelligence(
        self, graph: nx.DiGraph, central_account_id: str
    ) -> Dict[str, Any]:
        """
        Runs real graph algorithms against the given graph and returns
        a network payload matching the API's NetworkGraph schema
        (nodes with id/type, edges with source/target/amount).

        Algorithms used:
          - PageRank: identifies hub accounts (highest-ranked node,
            besides the central account itself, gets flagged as a
            structurally important hub) - but ONLY when the graph
            actually contains a relay/cash-out ring structure, since
            PageRank always produces SOME highest-scoring node even in
            a small, entirely benign-looking neighborhood. Labeling a
            node "mule" without a structural basis for it would be
            overclaiming.
          - Louvain community detection: groups accounts into clusters;
            used here to confirm the synthesized neighborhood forms a
            single connected ring (expected, since we constructed it
            that way) rather than to discover unknown structure - this
            becomes genuinely discovery-oriented once real multi-account
            transaction data is available.
          - Betweenness centrality: identifies relay nodes - accounts
            that sit on the shortest path between other nodes. A relay
            node synthesized in build_synthetic_account_neighborhood()
            should score highest here, which is a useful correctness
            check on the synthesis itself.

        Args:
            graph: A directed graph, e.g. from
                build_synthetic_account_neighborhood() or
                build_graph_from_dataframe().
            central_account_id: The account_id to treat as the "self"
                node for role-assignment purposes (its type is
                preserved from the graph rather than recomputed).

        Returns:
            dict: {"nodes": [{"id", "type"}, ...],
                   "edges": [{"source", "target", "amount"}, ...]}
        """
        if graph.number_of_nodes() == 0:
            return {"nodes": [], "edges": []}

        undirected = graph.to_undirected()

        try:
            pagerank_scores = nx.pagerank(graph, weight="amount")
        except Exception:
            # PageRank can fail to converge on pathological graphs
            # (shouldn't happen for our small synthesized graphs, but
            # real transaction data could be messier) - fall back to
            # uniform scores rather than crashing the evaluation.
            pagerank_scores = {n: 1.0 / graph.number_of_nodes() for n in graph.nodes()}

        try:
            betweenness_scores = nx.betweenness_centrality(graph, weight="amount")
        except Exception:
            betweenness_scores = {n: 0.0 for n in graph.nodes()}

        try:
            communities = nx.algorithms.community.louvain_communities(
                undirected, weight="amount", seed=self._deterministic_seed(central_account_id, "louvain")
            )
        except Exception:
            communities = [set(graph.nodes())]

        community_of = {}
        for idx, community in enumerate(communities):
            for node in community:
                community_of[node] = idx

        # Identify the highest-betweenness node - the relay account
        # that, if removed, would break the most paths. Only treat it
        # as a genuine relay if it actually sits ON a path (betweenness
        # > 0) - otherwise every node "wins" by default in a graph with
        # no real intermediary.
        non_central_betweenness = {
            n: score for n, score in betweenness_scores.items() if n != central_account_id
        }
        relay_node = max(non_central_betweenness, key=non_central_betweenness.get) if non_central_betweenness else None
        if relay_node is not None and non_central_betweenness.get(relay_node, 0.0) <= 0.0:
            relay_node = None

        # Only flag a PageRank-based "hub" node as type "mule" when the
        # graph actually has a relay present - i.e. the account's own
        # risk score was high enough to justify a ring-shaped
        # neighborhood in the first place (see
        # build_synthetic_account_neighborhood's use_relay flag). A
        # low-risk account's ordinary, relay-free neighborhood has no
        # structural basis for calling any of its counterparties a
        # "mule" - PageRank always produces a highest-scoring node
        # regardless, so gating this on relay_node's presence avoids
        # overclaiming on genuinely benign accounts.
        hub_node = None
        if relay_node is not None:
            try:
                pagerank_scores_local = pagerank_scores
                non_central_pagerank = {
                    n: score for n, score in pagerank_scores_local.items() if n != central_account_id
                }
                hub_node = max(non_central_pagerank, key=non_central_pagerank.get) if non_central_pagerank else None
            except Exception:
                hub_node = None

        nodes_payload: List[Dict[str, str]] = []
        for node_id, attrs in graph.nodes(data=True):
            if node_id == central_account_id:
                node_type = attrs.get("account_type", "normal")
            elif node_id == relay_node:
                node_type = "relay"
            elif attrs.get("account_type") == "cash_out":
                node_type = "cash_out"
            elif node_id == hub_node:
                node_type = "mule"
            else:
                node_type = "normal"
            nodes_payload.append({"id": str(node_id), "type": node_type})

        edges_payload: List[Dict[str, Any]] = []
        for source, target, attrs in graph.edges(data=True):
            edges_payload.append(
                {
                    "source": str(source),
                    "target": str(target),
                    "amount": round(float(attrs.get("amount", 0.0)), 2),
                }
            )

        return {"nodes": nodes_payload, "edges": edges_payload}


if __name__ == "__main__":
    # Create small mock DataFrame to verify the graph initializer's
    # original (real-transaction-data) path.
    mock_data = {
        "source_account": ["ACC001", "ACC002"],
        "destination_account": ["ACC002", "ACC003"],
        "amount": [5000.0, 12000.50],
        "timestamp": ["2026-07-07T10:00:00Z", "2026-07-07T10:05:00Z"],
        "tx_id": ["TX1001", "TX1002"],
    }
    mock_df = pd.DataFrame(mock_data)

    print("Initializing transaction graph with mock data...")
    initializer = TransactionGraphInitializer()
    initializer.build_graph_from_dataframe(mock_df)

    summary = initializer.get_graph_summary()
    print("Graph Summary:")
    for key, value in summary.items():
        print(f"  {key}: {value}")

    # Inspect a node and edge to verify properties
    print("\nNode Attributes:")
    for node, attrs in initializer.graph.nodes(data=True):
        print(f"  Node {node}: {attrs}")

    print("\nEdge Attributes:")
    for u, v, attrs in initializer.graph.edges(data=True):
        print(f"  Edge {u} -> {v}: {attrs}")

    # Verify the new synthetic-neighborhood + network-intelligence path
    print("\n--- Synthetic account neighborhood demo ---")
    demo_initializer = TransactionGraphInitializer()
    synthetic_graph = demo_initializer.build_synthetic_account_neighborhood(
        account_id="DEMO123",
        risk_score=850,
        inflow=500000.0,
        cash_out=420000.0,
        counterparty_hint=5,
    )
    intelligence = demo_initializer.compute_network_intelligence(synthetic_graph, "DEMO123")
    print(f"Nodes: {intelligence['nodes']}")
    print(f"Edges: {intelligence['edges']}")