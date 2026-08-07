"""
Graph Engine - Graph Analytics
Implements network analytics logic (PageRank, Betweenness Centrality, and Louvain Community Detection)
for identifying mule accounts and mule rings.
"""

from typing import Any, Dict, List
import networkx as nx
import community as community_louvain


class NetworkIntelligence:
    """Analyzes the transaction graph to detect central nodes, bottleneck accounts, and community structures."""

    def __init__(self, graph: nx.DiGraph) -> None:
        """Initializes NetworkIntelligence with a directed graph.

        Args:
            graph: A NetworkX DiGraph representing transaction flows.
        """
        self.graph = graph

    def compute_pagerank(self) -> Dict[Any, float]:
        """Computes PageRank scores to calculate the importance of each account.

        Returns:
            Dict[Any, float]: A dictionary mapping account IDs to PageRank scores.
        """
        # nx.pagerank returns a dictionary: node -> pagerank score
        pagerank_scores = nx.pagerank(self.graph, weight="amount")
        return pagerank_scores

    def compute_betweenness(self) -> Dict[Any, float]:
        """Computes betweenness centrality to find bottleneck accounts acting as bridges.

        Returns:
            Dict[Any, float]: A dictionary mapping account IDs to betweenness centrality scores.
        """
        # nx.betweenness_centrality returns a dictionary: node -> centrality score
        betweenness_scores = nx.betweenness_centrality(self.graph, weight="amount")
        return betweenness_scores

    def detect_mule_rings(self) -> Dict[int, List[Any]]:
        """Identifies isolated rings (communities) of accounts using Louvain optimization.

        Returns:
            Dict[int, List[Any]]: A dictionary mapping community IDs to lists of account IDs.
        """
        # Convert directed graph to undirected graph (required by Louvain)
        undirected = self.graph.to_undirected()

        # Compute the best partition using community_louvain
        partition = community_louvain.best_partition(undirected)

        # Group the accounts by their community ID
        communities = {}
        for node, community_id in partition.items():
            if community_id not in communities:
                communities[community_id] = []
            communities[community_id].append(node)

        return communities


if __name__ == "__main__":
    # Quick self-test to verify the implementation
    print("Testing NetworkIntelligence with Louvain Community Detection...")
    G = nx.DiGraph()
    # Simple flow ACC1 -> ACC2 -> ACC3, ACC4 -> ACC5 -> ACC4 (ring)
    G.add_edge("ACC1", "ACC2", amount=100.0)
    G.add_edge("ACC2", "ACC3", amount=150.0)
    G.add_edge("ACC4", "ACC5", amount=120.0)
    G.add_edge("ACC5", "ACC4", amount=130.0)

    ni = NetworkIntelligence(G)
    pr = ni.compute_pagerank()
    bc = ni.compute_betweenness()
    rings = ni.detect_mule_rings()

    print("PageRank scores:", pr)
    print("Betweenness scores:", bc)
    print("Detected Mule Rings (Communities):", rings)
