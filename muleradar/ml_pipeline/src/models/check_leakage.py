import joblib
import pandas as pd
import numpy as np
from pathlib import Path

def main():
    # Resolve Path
    model_path = Path("../../saved_models/mule_pipeline_v2.pkl")
    if not model_path.exists():
        model_path = Path("saved_models/mule_pipeline_v2.pkl")
        
    print(f"Loading artifact from: {model_path.resolve()}")
    artifact = joblib.load(model_path)
    
    features = artifact['final_features']
    xgb_model = artifact['xgb_model']
    lgbm_model = artifact['lgbm_model']
    
    # Extract XGBoost Importances (Gain)
    xgb_imp = xgb_model.feature_importances_
    xgb_df = pd.DataFrame({'Feature': features, 'Importance': xgb_imp})
    xgb_df['Importance (%)'] = (xgb_df['Importance'] / xgb_df['Importance'].sum()) * 100
    xgb_df = xgb_df.sort_values(by='Importance (%)', ascending=False).head(10)
    
    # Extract LightGBM Importances (Split/Gain)
    lgbm_imp = lgbm_model.feature_importances_
    lgbm_df = pd.DataFrame({'Feature': features, 'Importance': lgbm_imp})
    lgbm_df['Importance (%)'] = (lgbm_df['Importance'] / lgbm_df['Importance'].sum()) * 100
    lgbm_df = lgbm_df.sort_values(by='Importance (%)', ascending=False).head(10)
    
    print("\n=======================================================")
    print("          TOP 10 LEAKAGE SUSPECTS (XGBOOST)            ")
    print("=======================================================")
    print(xgb_df.to_string(index=False, float_format="%.2f"))
    
    print("\n=======================================================")
    print("         TOP 10 LEAKAGE SUSPECTS (LIGHTGBM)            ")
    print("=======================================================")
    print(lgbm_df.to_string(index=False, float_format="%.2f"))
    print("=======================================================\n")

if __name__ == "__main__":
    main()