
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

def main():
    dataset_path = Path("../../data/boi_dataset.csv")
    if not dataset_path.exists():
        dataset_path = Path("data/boi_dataset.csv")
        
    df = pd.read_csv(dataset_path)
    target = 'F3924'
    time_col = 'F2230'
    
    # Split FIRST to prevent leakage
    df_train, _ = train_test_split(df, test_size=0.20, random_state=42, stratify=df[target])
    
    y_train = df_train[target]
    X_train = df_train.drop(columns=[target, time_col], errors='ignore')
    
    high_auc_features = []
    
    print("Scanning X_train for highly predictive features (AUC > 0.70 or < 0.30)...")
    for col in X_train.columns:
        try:
            vals = pd.to_numeric(X_train[col], errors='coerce')
            if vals.isna().all():
                vals, _ = pd.factorize(X_train[col])
            else:
                vals = vals.fillna(vals.median())
                
            if pd.Series(vals).nunique() > 1:
                auc = roc_auc_score(y_train, vals)
                if auc > 0.70 or auc < 0.30:
                    high_auc_features.append((col, auc))
        except Exception:
            continue

    # Sort by how strong the AUC is (absolute distance from 0.5)
    high_auc_features.sort(key=lambda x: abs(x[1] - 0.5), reverse=True)
    
    print("\n=======================================================")
    print(f"   HIGH AUC SUSPECTS FROM TRAINING DATA ({len(high_auc_features)} features)")
    print("=======================================================")
    for col, auc in high_auc_features:
        print(f"{col:<10} | AUC: {auc:.4f}")
        
    print("\n=======================================================")
    print("   CURRENT FINAL FEATURES (from mule_pipeline_v2.pkl)")
    print("=======================================================")
    try:
        artifact_path = Path("../../saved_models/mule_pipeline_v2.pkl")
        if not artifact_path.exists():
            artifact_path = Path("saved_models/mule_pipeline_v2.pkl")
        
        artifact = joblib.load(artifact_path)
        final_feats = artifact.get('final_features', [])
        print(f"Total: {len(final_feats)}")
        print(final_feats)
    except Exception as e:
        print(f"Could not load artifact: {e}")

if __name__ == "__main__":
    main()