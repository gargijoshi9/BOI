"""
Graph Engine - Graph Analytics
Implements network analytics logic (PageRank & Betweenness Centrality) for identifying mule accounts.
"""

from typing import Any, Dict
import networkx as nx


class NetworkIntelligence:
    """Analyzes the transaction graph to detect central nodes and bottleneck accounts."""

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


if __name__ == "__main__":
    # Quick self-test to verify the implementation
    print("Testing NetworkIntelligence...")
    G = nx.DiGraph()
    # Simple flow ACC1 -> ACC2 -> ACC3
    G.add_edge("ACC1", "ACC2", amount=100.0)
    G.add_edge("ACC2", "ACC3", amount=150.0)

    ni = NetworkIntelligence(G)
    pr = ni.compute_pagerank()
    bc = ni.compute_betweenness()

    print("PageRank scores:", pr)
    print("Betweenness scores:", bc)
