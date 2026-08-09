import pandas as pd
import numpy as np
from tqdm import tqdm
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))
from ml_pipeline.src.graph_engine.graph_initializer import TransactionGraphInitializer

def generate_network_features(dataset_path, output_path):
    print(f"Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)
    
    print("Generating Target-Agnostic Network Features...")
    
    # Clean column names just in case
    import re
    df.columns = [re.sub(r'[\[\]{} ,:]', '_', col) for col in df.columns]
    
    # 1. Compute an Unsupervised Behavioral Risk Proxy (0-1000 scale)
    # Using raw financial velocity ratios instead of target F3924
    f64_val = df['F64'].fillna(0) if 'F64' in df.columns else pd.Series(0, index=df.index)
    f2578_val = df['F2578'].fillna(0) if 'F2578' in df.columns else pd.Series(0, index=df.index)
    f4_val = df['F4'].fillna(0) if 'F4' in df.columns else pd.Series(0, index=df.index)
    
    # Normalize features to 0-1 scale to build a composite risk metric
    f64_norm = (f64_val - f64_val.min()) / (f64_val.max() - f64_val.min() + 1e-9)
    f2578_norm = (f2578_val - f2578_val.min()) / (f2578_val.max() - f2578_val.min() + 1e-9)
    f4_norm = (f4_val - f4_val.min()) / (f4_val.max() - f4_val.min() + 1e-9)
    
    # Combined behavioral score scaled to 0-1000
    behavioral_risk = ((f64_norm * 0.4) + (f2578_norm * 0.4) + (f4_norm * 0.2)) * 1000

    hub_scores = []
    is_relay = []
    network_densities = []
    
    initializer = TransactionGraphInitializer()
    
    for idx, row in tqdm(df.iterrows(), total=len(df)):
        acc_id = f"ACC_{idx}"
        
        # Use the behavioral risk score instead of ground truth target
        risk_proxy = int(behavioral_risk.iloc[idx])
        
        inflow_proxy = abs(float(row.get('F4', 1.0))) * 10000 
        cashout_proxy = abs(float(row.get('F64', 1.0))) * 10000 
        
        graph = initializer.build_synthetic_account_neighborhood(
            account_id=acc_id,
            risk_score=risk_proxy,
            inflow=inflow_proxy,
            cash_out=cashout_proxy,
            counterparty_hint=5
        )
        
        intel = initializer.compute_network_intelligence(graph, acc_id)
        
        nodes_count = len(intel['nodes'])
        edges_count = len(intel['edges'])
        density = edges_count / nodes_count if nodes_count > 0 else 0
        network_densities.append(density)
        
        node_types = [n['type'] for n in intel['nodes']]
        is_relay.append(1 if 'relay' in node_types else 0)
        hub_scores.append(1 if 'mule' in node_types else 0)

    df['NET_HUB_SCORE'] = hub_scores
    df['NET_IS_RELAY'] = is_relay
    df['NET_DENSITY'] = network_densities
    
    print(f"\nSaving enriched dataset to {output_path}...")
    df.to_csv(output_path, index=False)
    print("Done!")

if __name__ == "__main__":
    input_csv = 'C:/Desktop/BOI/muleradar/ml_pipeline/data/boi_dataset.csv'
    output_csv = 'C:/Desktop/BOI/muleradar/ml_pipeline/data/boi_dataset_enriched.csv'
    generate_network_features(input_csv, output_csv)