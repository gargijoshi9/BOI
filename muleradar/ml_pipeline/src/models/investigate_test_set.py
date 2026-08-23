import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split

def main():
    # 1. Load the artifact to get the exact data split methodology
    artifact_path = Path("../../saved_models/mule_pipeline_v2.pkl")
    if not artifact_path.exists():
        artifact_path = Path("saved_models/mule_pipeline_v2.pkl")
    
    print(f"Loading artifact from: {artifact_path}")
    artifact = joblib.load(artifact_path)
    optimal_threshold = artifact['optimal_threshold']
    
    # 2. Recreate the exact Train/Test split
    dataset_path = Path("../../data/boi_dataset.csv")
    if not dataset_path.exists():
        dataset_path = Path("data/boi_dataset.csv")
        
    df = pd.read_csv(dataset_path)
    target = artifact['target']
    
    _, df_test = train_test_split(
        df, test_size=0.20, random_state=42, stratify=df[target]
    )
    df_test = df_test.reset_index(drop=True)
    
    # 3. Generate predictions using the loaded pipeline
    print("Generating predictions on the test set...")
    X_test_full = df_test[artifact['final_features']].copy()
    
    # Coerce categories for the models
    for col in artifact['final_cat_cols']:
        if col in X_test_full.columns:
            X_test_full[col] = X_test_full[col].astype('category')
            
    test_preds_xgb = artifact['xgb_model'].predict_proba(X_test_full)[:, 1]
    test_preds_lgbm = artifact['lgbm_model'].predict_proba(X_test_full)[:, 1]
    test_preds_cat = artifact['cat_model'].predict_proba(X_test_full)[:, 1]
    
    imputer = artifact['imputer']
    iso_forest = artifact['iso_forest']
    test_if_score = iso_forest.decision_function(imputer.transform(X_test_full.select_dtypes(exclude=['category'])))
    
    X_meta_test = pd.DataFrame({
        'xgb': test_preds_xgb, 
        'lgbm': test_preds_lgbm, 
        'cat': test_preds_cat, 
        'if_score': test_if_score
    })
    
    if artifact['use_stacking']:
        final_probs = artifact['meta_model'].predict_proba(X_meta_test)[:, 1]
    else:
        final_probs = (test_preds_xgb + test_preds_lgbm + test_preds_cat) / 3.0
        
    df_test['pred_prob'] = final_probs
    df_test['pred_class'] = (final_probs >= optimal_threshold).astype(int)
    
    # 4. Isolate the cohorts
    true_positives = df_test[(df_test[target] == 1) & (df_test['pred_class'] == 1)]
    false_negatives = df_test[(df_test[target] == 1) & (df_test['pred_class'] == 0)]
    true_negatives = df_test[(df_test[target] == 0) & (df_test['pred_class'] == 0)]
    
    print("\n=======================================================")
    print("             TEST SET FORENSIC BREAKDOWN               ")
    print("=======================================================")
    print(f"True Positives (Caught Mules): {len(true_positives)}")
    print(f"False Negatives (Missed Mules): {len(false_negatives)}")
    print(f"True Negatives (Normals): {len(true_negatives)}")
    print("-" * 55)
    
    features_to_check = ['F2583', 'F3805', 'F1057', 'F1921', 'F3534', 'F1597', 'F3799', 'F2487']
    
    for f in features_to_check:
        if f not in df_test.columns:
            continue
            
        print(f"\nFeature: {f}")
        for group_name, group_df in [("True Positives (Caught)", true_positives), 
                                     ("False Negatives (Missed)", false_negatives), 
                                     ("True Negatives (Normal)", true_negatives)]:
            
            vals = pd.to_numeric(group_df[f], errors='coerce')
            pct_nan = vals.isna().mean() * 100
            pct_zero = (vals == 0).mean() * 100
            
            # Formatting output
            median_val = vals.median()
            median_str = f"{median_val:.2f}" if pd.notna(median_val) else "NaN"
            
            print(f"  {group_name:<25} | % NaN: {pct_nan:>5.1f}% | % Zero: {pct_zero:>5.1f}% | Median: {median_str}")

if __name__ == "__main__":
    main()