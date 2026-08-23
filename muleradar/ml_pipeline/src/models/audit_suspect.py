import pandas as pd
import numpy as np
import sys
from pathlib import Path
from sklearn.model_selection import train_test_split

# Attempt to load the data dictionary for semantic cross-referencing
_THIS_DIR = Path(__file__).resolve().parent
_DATA_REFINEMENT_DIR = _THIS_DIR.parent / "data_refinement"
if str(_DATA_REFINEMENT_DIR) not in sys.path:
    sys.path.insert(0, str(_DATA_REFINEMENT_DIR))

try:
    from data_dictionary import FEATURE_MAPPING
except ImportError:
    FEATURE_MAPPING = {}

def main():
    dataset_path = Path("../../data/boi_dataset.csv")
    if not dataset_path.exists():
        dataset_path = Path("data/boi_dataset.csv")
        
    print(f"Loading dataset from: {dataset_path.resolve()}")
    df = pd.read_csv(dataset_path)
    target = 'F3924'
    time_col = 'F2230'
    
    # Split FIRST to prevent test-set contamination in the audit
    df_train, _ = train_test_split(df, test_size=0.20, random_state=42, stratify=df[target])
    
    y_train = df_train[target]
    normal_mask = (y_train == 0)
    mule_mask = (y_train == 1)

    # The 10 features that survived the overlap filter but were previously flagged as batch proxies
    survivors = ['F3484', 'F2487', 'F3799', 'F1921', 'F2583', 'F3534', 'F3805', 'F1057', 'F1597', 'F3487']
    
    print("\n=========================================================================================")
    print("                      QUANTILE & SEMANTIC FORENSIC AUDIT")
    print("=========================================================================================")
    
    for feat in sorted(survivors):
        if feat not in df_train.columns:
            continue
            
        vals = pd.to_numeric(df_train[feat], errors='coerce')
        mule_vals = vals[mule_mask].dropna()
        normal_vals = vals[normal_mask].dropna()
        
        if len(mule_vals) == 0 or len(normal_vals) == 0:
            print(f"\n[!] {feat}: Cannot compute quantiles (categorical or entirely missing)")
            continue

        norm_p10 = normal_vals.quantile(0.1)
        norm_p50 = normal_vals.median()
        norm_p90 = normal_vals.quantile(0.9)
        
        mule_p10 = mule_vals.quantile(0.1)
        mule_p50 = mule_vals.median()
        mule_p90 = mule_vals.quantile(0.9)
        
        extreme_frac = ((mule_vals > norm_p90) | (mule_vals < norm_p10)).mean()
        
        description = FEATURE_MAPPING.get(feat, "UNKNOWN - Check Description.xlsx manually")
        
        print(f"\nFeature: {feat} | Semantic Meaning: {description}")
        print("-" * 89)
        print(f"  Normal (n={len(normal_vals):<4}): p10={norm_p10:<8.3f} p50={norm_p50:<8.3f} p90={norm_p90:<8.3f}")
        print(f"  Mule   (n={len(mule_vals):<4}): p10={mule_p10:<8.3f} p50={mule_p50:<8.3f} p90={mule_p90:<8.3f}")
        
        if extreme_frac > 0.80:
            print(f"  [RED FLAG] Extreme Fraction: {extreme_frac:.2%} of mules sit completely outside normal 10-90 range.")
        else:
            print(f"  [OK]       Extreme Fraction: {extreme_frac:.2%} (Shows organic overlap inside core variance).")
            
    print("\n=========================================================================================\n")

if __name__ == "__main__":
    main()