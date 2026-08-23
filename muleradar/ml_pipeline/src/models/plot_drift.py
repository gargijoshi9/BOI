import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

def main():
    # 1. Resolve Path (Handles running from src/models or project root)
    dataset_path = Path("../../data/boi_dataset.csv")
    if not dataset_path.exists():
        dataset_path = Path("data/boi_dataset.csv")
        
    print(f"Loading dataset from: {dataset_path.resolve()}")
    df = pd.read_csv(dataset_path)
    
    time_col = 'F2230'
    target = 'F3924'

    # Ensure strictly chronological ordering
    df = df.sort_values(by=time_col).reset_index(drop=True)
    mules_df = df[df[target] == 1]

    # Calculate where the 80/20 Train/Test split happens
    split_idx = int(len(df) * 0.80)
    split_time = df.iloc[split_idx][time_col]

    print("\nGenerating visualization...")
    plt.style.use('seaborn-v0_8-darkgrid')
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10), sharex=True)

    # Plot 1: Histogram of Mule Density
    sns.histplot(mules_df[time_col], bins=50, kde=True, ax=ax1, color='crimson')
    ax1.set_title("Temporal Distribution of Confirmed Mules (Campaign Density)", fontsize=14, pad=10)
    ax1.set_ylabel("Number of Mules")
    
    # Plot 2: Cumulative Mules over Time
    ax2.plot(df[time_col], df[target].cumsum(), color='crimson', label="Cumulative Mules Caught", linewidth=2.5)
    ax2.set_title("Cumulative Mule Trajectory", fontsize=14, pad=10)
    ax2.set_xlabel(f"Time (Feature {time_col})", fontsize=12)
    ax2.set_ylabel("Total Mules")

    # Add the train/test split boundary to both plots
    for ax in [ax1, ax2]:
        ax.axvline(x=split_time, color='black', linestyle='--', linewidth=2, label='80/20 Train/Test Split Boundary')
        ax.legend()

    plt.tight_layout()
    plt.savefig("mule_temporal_distribution.png", dpi=300)
    print("Saved plot to 'mule_temporal_distribution.png'")
    
    # --- CONSOLE STATS ---
    print("\n=======================================================")
    print("           MULE CONCENTRATION BY TIME DECILE           ")
    print("=======================================================")
    
    # Using rank to avoid ValueError if many accounts share the exact same timestamp
    deciles = pd.qcut(df[time_col].rank(method='first'), 10, labels=[f"D{i} (10%)" for i in range(1, 11)])
    decile_stats = df.groupby(deciles, observed=False)[target].agg(['count', 'sum']).rename(columns={'count': 'Total Accounts', 'sum': 'Mules'})
    decile_stats['Fraud_Rate (%)'] = (decile_stats['Mules'] / decile_stats['Total Accounts'] * 100).round(2)
    
    print(decile_stats)
    print("=======================================================")
    
    plt.show()

if __name__ == "__main__":
    main()