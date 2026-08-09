import pandas as pd
import numpy as np
from lightgbm import LGBMClassifier
from xgboost import XGBClassifier
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.metrics import classification_report, roc_auc_score, precision_recall_curve, confusion_matrix
import warnings
import re
import optuna

warnings.filterwarnings('ignore')

dataset_path = 'C:/Desktop/BOI/muleradar/ml_pipeline/data/boi_dataset_enriched.csv'
print(f"Loading data from: {dataset_path}")
df = pd.read_csv(dataset_path)
target = 'F3924'

if 'Unnamed: 0' in df.columns:
    df = df.drop(columns=['Unnamed: 0'])
df.columns = [re.sub(r'[\[\]{} ,:]', '_', col) for col in df.columns]

boi_finalized = ['F115', 'F321', 'F527', 'F531', 'F670', 'F1692', 'F2082', 'F2122', 
                 'F2582', 'F2678', 'F2737', 'F2956', 'F3043', 'F3836', 'F3887', 
                 'F3889', 'F3891', 'F3894']
discovered_safe = ['F372', 'F7', 'F17', 'F3', 'F4', 'F3530', 'F2577', 'F2576', 
                   'F2586', 'F15', 'F64', 'F21', 'F19', 'F2578']
network_features = ['NET_HUB_SCORE', 'NET_IS_RELAY', 'NET_DENSITY']

features_to_use = list(set(boi_finalized + discovered_safe + network_features))
features_to_use = [f for f in features_to_use if f in df.columns]

X = df[features_to_use]
y = df[target]

# Log transform highly skewed continuous financial variables
skewed_features = ['F4', 'F64', 'F2578', 'F2586', 'F2737', 'F3836']
for col in skewed_features:
    if col in X.columns:
        # Using log1p to handle zeros safely. Taking absolute value first in case of negative deviations.
        X[col] = np.log1p(np.abs(X[col]))

categorical_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
for col in categorical_cols:
    X[col] = X[col].astype('category')
    
fraud_ratio = (len(y) - y.sum()) / y.sum()

# Upgraded to Repeated Stratified K-Fold for stability
rskf = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=42)

# --- Best LightGBM Parameters (From previous Optuna run) ---
lgbm_params = {
    'n_estimators': 247, 
    'learning_rate': 0.120296, 
    'max_depth': 9, 
    'num_leaves': 64, 
    'min_child_samples': 100,
    'class_weight': 'balanced',
    'random_state': 42,
    'n_jobs': -1,
    'verbose': -1
}

# --- XGBoost Optuna Tuning ---
def xgb_objective(trial):
    params = {
        'n_estimators': trial.suggest_int('n_estimators', 100, 300),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
        'max_depth': trial.suggest_int('max_depth', 3, 8),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'scale_pos_weight': fraud_ratio,
        'enable_categorical': True, 
        'tree_method': 'hist',
        'random_state': 42,
        'n_jobs': -1
    }
    
    aucs = []
    # Use standard K-Fold for quick tuning, Repeated for final training
    from sklearn.model_selection import StratifiedKFold
    skf_tune = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    
    for train_idx, val_idx in skf_tune.split(X, y):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
        
        model = XGBClassifier(**params)
        model.fit(X_train, y_train, verbose=False)
        probs = model.predict_proba(X_val)[:, 1]
        aucs.append(roc_auc_score(y_val, probs))
        
    return np.mean(aucs)

print("\n--- Running Optuna Hyperparameter Optimization (XGBoost) ---")
study = optuna.create_study(direction='maximize')
study.optimize(xgb_objective, n_trials=15) # Keep to 15 trials for speed
print("\nBest XGBoost Parameters found:", study.best_params)

# ---------------------------------------------
# Train Final Ensemble with Repeated K-Fold
# ---------------------------------------------
xgb_best_params = study.best_params
xgb_best_params.update({
    'scale_pos_weight': fraud_ratio,
    'enable_categorical': True, 
    'tree_method': 'hist',
    'random_state': 42,
    'n_jobs': -1
})

lgbm_model = LGBMClassifier(**lgbm_params)
xgb_model = XGBClassifier(**xgb_best_params)

# We will collect Out-of-Fold predictions across all repeats
oof_probs_lgbm = np.zeros(len(y))
oof_probs_xgb = np.zeros(len(y))
fold_counts = np.zeros(len(y))

print("\n--- Training Stabilized Ensemble (15 Folds Total) ---")
for fold, (train_idx, val_idx) in enumerate(rskf.split(X, y)):
    X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
    
    lgbm_model.fit(X_train, y_train)
    oof_probs_lgbm[val_idx] += lgbm_model.predict_proba(X_val)[:, 1]
    
    xgb_model.fit(X_train, y_train, verbose=False)
    oof_probs_xgb[val_idx] += xgb_model.predict_proba(X_val)[:, 1]
    
    fold_counts[val_idx] += 1

# Average the probabilities across the repeats
oof_probs_lgbm /= fold_counts
oof_probs_xgb /= fold_counts
ensemble_probs = (oof_probs_lgbm + oof_probs_xgb) / 2.0

precisions, recalls, thresholds = precision_recall_curve(y, ensemble_probs)
f2_scores = (5 * precisions * recalls) / (4 * precisions + recalls + 1e-9)
optimal_idx = np.argmax(f2_scores)
optimal_threshold = thresholds[optimal_idx]
optimal_f2 = f2_scores[optimal_idx]

print(f"\nFinal Stable Ensemble ROC-AUC: {roc_auc_score(y, ensemble_probs):.4f}")
print(f"Optimal Prediction Threshold (Max F2): {optimal_threshold:.4f}")

final_preds = (ensemble_probs >= optimal_threshold).astype(int)
tn, fp, fn, tp = confusion_matrix(y, final_preds).ravel()

print("\n--- Final Stabilized Ensemble Classification Report ---")
print(classification_report(y, final_preds))

print("\n--- Additional Hackathon Metrics ---")
print(f"Maximized F2-Score: {optimal_f2:.4f}")
print(f"Confusion Matrix -> TP: {tp} | FP: {fp} | FN: {fn} | TN: {tn}")

# Save final models for the backend team
import joblib
import os
os.makedirs('C:/Desktop/BOI/muleradar/ml_pipeline/saved_models/', exist_ok=True)
joblib.dump(lgbm_model, 'C:/Desktop/BOI/muleradar/ml_pipeline/saved_models/lgbm_final.joblib')
joblib.dump(xgb_model, 'C:/Desktop/BOI/muleradar/ml_pipeline/saved_models/xgb_final.joblib')
print("\nFinal models saved successfully for backend integration!")