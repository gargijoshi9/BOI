import unittest
import pandas as pd
import networkx as nx
from graph_initializer import TransactionGraphInitializer


class TestTransactionGraphInitializer(unittest.TestCase):
    def setUp(self):
        self.initializer = TransactionGraphInitializer()

    def test_build_graph_from_dataframe_basic(self):
        # Test basic graph construction from dataframe
        data = {
            "source_account": ["ACC001", "ACC002"],
            "destination_account": ["ACC002", "ACC003"],
            "amount": [5000.0, 12000.50],
            "timestamp": ["2026-07-07T10:00:00Z", "2026-07-07T10:05:00Z"],
            "tx_id": ["TX1001", "TX1002"],
        }
        df = pd.DataFrame(data)
        graph = self.initializer.build_graph_from_dataframe(df)

        self.assertEqual(graph.number_of_nodes(), 3)
        self.assertEqual(graph.number_of_edges(), 2)
        self.assertTrue(graph.has_node("ACC001"))
        self.assertTrue(graph.has_node("ACC002"))
        self.assertTrue(graph.has_node("ACC003"))
        self.assertEqual(graph.nodes["ACC001"]["account_type"], "unknown")
        self.assertEqual(graph.nodes["ACC001"]["risk_score"], 0.0)

        edge_data = graph.get_edge_data("ACC001", "ACC002")
        self.assertEqual(edge_data["amount"], 5000.0)
        self.assertEqual(edge_data["timestamp"], "2026-07-07T10:00:00Z")
        self.assertEqual(edge_data["tx_id"], "TX1001")

    def test_build_graph_from_dataframe_missing_optional_cols(self):
        # Test graph construction when optional columns are missing
        data = {
            "source_account": ["ACC001"],
            "destination_account": ["ACC002"],
        }
        df = pd.DataFrame(data)
        graph = self.initializer.build_graph_from_dataframe(df)

        self.assertEqual(graph.number_of_nodes(), 2)
        self.assertEqual(graph.number_of_edges(), 1)
        edge_data = graph.get_edge_data("ACC001", "ACC002")
        self.assertEqual(edge_data["amount"], 0.0)
        self.assertEqual(edge_data["timestamp"], "")
        self.assertEqual(edge_data["tx_id"], "")

    def test_build_synthetic_account_neighborhood_low_risk(self):
        # Test synthetic neighborhood construction for low risk
        account_id = "ACC_LOW"
        risk_score = 300
        inflow = 10000.0
        cash_out = 8000.0
        counterparty_hint = 3

        graph = self.initializer.build_synthetic_account_neighborhood(
            account_id=account_id,
            risk_score=risk_score,
            inflow=inflow,
            cash_out=cash_out,
            counterparty_hint=counterparty_hint,
        )

        # For risk score <= 600, central node type should be 'normal'
        self.assertEqual(graph.nodes[account_id]["account_type"], "normal")
        # Ensure there is no relay node generated (since risk_score <= 600)
        for node, attrs in graph.nodes(data=True):
            self.assertNotEqual(attrs.get("account_type"), "relay")

    def test_build_synthetic_account_neighborhood_high_risk(self):
        # Test synthetic neighborhood construction for high risk
        account_id = "ACC_HIGH"
        risk_score = 800
        inflow = 10000.0
        cash_out = 8000.0
        counterparty_hint = 5

        graph = self.initializer.build_synthetic_account_neighborhood(
            account_id=account_id,
            risk_score=risk_score,
            inflow=inflow,
            cash_out=cash_out,
            counterparty_hint=counterparty_hint,
        )

        # For risk score > 600, central node type should be 'mule'
        self.assertEqual(graph.nodes[account_id]["account_type"], "mule")
        # High risk score should generate a relay node
        # The relay node is named with RLY- prefix in build_synthetic_account_neighborhood
        has_relay = any(str(node).startswith("RLY-") for node in graph.nodes())
        self.assertTrue(has_relay)

    def test_compute_network_intelligence(self):
        # Test the graph algorithms and role assignments
        account_id = "ACC_INTEL"
        risk_score = 850
        inflow = 50000.0
        cash_out = 45000.0
        counterparty_hint = 4

        graph = self.initializer.build_synthetic_account_neighborhood(
            account_id=account_id,
            risk_score=risk_score,
            inflow=inflow,
            cash_out=cash_out,
            counterparty_hint=counterparty_hint,
        )

        intelligence = self.initializer.compute_network_intelligence(graph, account_id)
        self.assertIn("nodes", intelligence)
        self.assertIn("edges", intelligence)

        nodes = intelligence["nodes"]
        edges = intelligence["edges"]

        self.assertTrue(len(nodes) > 0)
        self.assertTrue(len(edges) > 0)

        # Verify central node is mule
        central_node_payload = next(n for n in nodes if n["id"] == account_id)
        self.assertEqual(central_node_payload["type"], "mule")

        # Verify role assignment contains relay
        node_types = {n["type"] for n in nodes}
        self.assertIn("relay", node_types)
        self.assertIn("cash_out", node_types)


if __name__ == "__main__":
    unittest.main()
