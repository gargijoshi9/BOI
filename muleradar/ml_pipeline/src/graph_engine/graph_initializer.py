"""
Graph Engine - Graph Initializer
Initializes a NetworkX DiGraph schema from transaction DataFrames for mule account detection.
"""

from typing import Any, Dict
import networkx as nx
import pandas as pd


class TransactionGraphInitializer:
    """Initializes and builds a NetworkX directed graph from transaction records."""

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


if __name__ == "__main__":
    # Create small mock DataFrame to verify the graph initializer
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
# Hello
