# ml_pipeline/src/models/inference.py
import os
import re
import joblib
import pandas as pd
import numpy as np

class MulePipelineV2:
    def __init__(self, model_path: str):
        """
        Lazy loading: Artifact is only loaded when the analyzer explicitly 
        instantiates the class, preserving the simulator fallback if the file is missing.
        """
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Missing pipeline artifact at: {model_path}")
        
        artifact = joblib.load(model_path)
        
        self.features = artifact['final_features']
        self.cat_cols = artifact['final_cat_cols']
        self.imputer = artifact['imputer']
        self.xgb_model = artifact['xgb_model']
        self.lgbm_model = artifact['lgbm_model']
        self.cat_model = artifact['cat_model']
        self.iso_forest = artifact['iso_forest']
        self.meta_model = artifact['meta_model']
        self.use_stacking = artifact['use_stacking']
        self.threshold = artifact['optimal_threshold']

    def _preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        X = df.copy()
        
        # 1. Sanitize columns exactly as done in train.py
        X.columns = [re.sub(r'[\[\]{} ,:]', '_', col) for col in X.columns]
        
        # 2. Add any missing expected features
        missing_cols = [c for c in self.features if c not in X.columns]
        for c in missing_cols:
            X[c] = np.nan
            
        # 3. Subset and order to match training exactly
        X = X[self.features]
        
        # 4. Cast categorical columns
        for col in self.cat_cols:
            if col in X.columns:
                X[col] = X[col].astype('category')
                
        return X

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        X = self._preprocess(df)
        
        test_preds_xgb = self.xgb_model.predict_proba(X)[:, 1]
        test_preds_lgbm = self.lgbm_model.predict_proba(X)[:, 1]
        test_preds_cat = self.cat_model.predict_proba(X)[:, 1]
        
        numeric_cols = X.select_dtypes(exclude=['category'])
        X_num_imputed = self.imputer.transform(numeric_cols)
        test_if_score = self.iso_forest.decision_function(X_num_imputed)
        
        if self.use_stacking:
            X_meta = pd.DataFrame({
                'xgb': test_preds_xgb, 
                'lgbm': test_preds_lgbm, 
                'cat': test_preds_cat, 
                'if_score': test_if_score
            })
            final_probs = self.meta_model.predict_proba(X_meta)[:, 1]
        else:
            final_probs = (test_preds_xgb + test_preds_lgbm + test_preds_cat) / 3.0
            
        return final_probs

    def predict_hitl_action(self, df: pd.DataFrame, t_low: float = 0.30, t_high: float = 0.90, anomaly_threshold: float = -0.1) -> list:
        """
        Implements a Human-In-The-Loop (HITL) routing logic.
        Returns a list of actions ('AUTO_CLEAR', 'HUMAN_REVIEW', 'AUTO_BLOCK') for each row.
        """
        # 1. Get standard probabilities
        final_probs = self.predict_proba(df)
        
        # 2. Get anomaly scores from isolation forest
        X = self._preprocess(df)
        numeric_cols = X.select_dtypes(exclude=['category'])
        X_num_imputed = self.imputer.transform(numeric_cols)
        if_scores = self.iso_forest.decision_function(X_num_imputed)
        
        actions = []
        for prob, score in zip(final_probs, if_scores):
            # If the transaction is highly anomalous (lower score = more anomalous), force manual review
            if score < anomaly_threshold:
                actions.append('HUMAN_REVIEW')
            elif prob >= t_high:
                actions.append('AUTO_BLOCK')
            elif prob <= t_low:
                actions.append('AUTO_CLEAR')
            else:
                actions.append('HUMAN_REVIEW')
                
        return actions

    def explain(self, raw_row, explainer):
        """
        Signature updated to match analyzer.py call: self.pipeline.explain(raw_row, self._shap_explainer)
        """
        # TODO: Insert your specific SHAP extraction logic here to return List[ShapContribution]
        # Returning an empty list temporarily to prevent Pydantic validation crashes
        return []