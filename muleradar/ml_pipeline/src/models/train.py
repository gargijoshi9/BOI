# ml_pipeline/src/models/train_master.py
import pandas as pd
import numpy as np
import random
import os
import re
import sys
import warnings
import joblib
import optuna
from optuna.samplers import TPESampler
from pathlib import Path

from lightgbm import LGBMClassifier
from xgboost import XGBClassifier
from catboost import CatBoostClassifier
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (classification_report, roc_auc_score,
                             average_precision_score, precision_recall_curve,
                             confusion_matrix)
from sklearn.feature_selection import VarianceThreshold
from sklearn.model_selection import StratifiedKFold

warnings.filterwarnings('ignore')

# Make data_dictionary.py importable regardless of cwd (it lives in
# ../data_refinement relative to this file, i.e.
# ml_pipeline/src/data_refinement/data_dictionary.py).
_THIS_DIR = Path(__file__).resolve().parent
_DATA_REFINEMENT_DIR = _THIS_DIR.parent / "data_refinement"
if str(_DATA_REFINEMENT_DIR) not in sys.path:
    sys.path.insert(0, str(_DATA_REFINEMENT_DIR))
from data_dictionary import LEAKY_COLUMNS as DICT_LEAKY_COLUMNS

# =======================================================
# 0. GLOBAL DETERMINISTIC REPRODUCIBILITY SEED
# =======================================================
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


def main():
    dataset_path = str((_THIS_DIR / '..' / '..' / 'data' / 'boi_dataset.csv').resolve())
    print(f"Loading full dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    target = 'F3924'

    if 'Unnamed: 0' in df.columns:
        df = df.drop(columns=['Unnamed: 0'])
    df.columns = [re.sub(r'[\[\]{} ,:]', '_', col) for col in df.columns]

    # 1. OUT-OF-TIME SPLIT (Chronological)
    time_col = 'F2230'
    if time_col in df.columns:
        df = df.sort_values(by=time_col).reset_index(drop=True)
    else:
        raise ValueError(f"Time column {time_col} missing. Chronological split required.")

    # Drop confirmed-leaky post-investigation resolution flags and
    # metadata blocks (F3895-F3923) - imported from data_dictionary.py
    # so this constant has exactly one source of truth, shared with
    # analyzer.py's damage-estimation logic and any future retraining.
    LEAKY_COLUMNS = sorted(set(DICT_LEAKY_COLUMNS))
    dropped_leaky = [c for c in LEAKY_COLUMNS if c in df.columns]
    if dropped_leaky:
        print(f"Dropping {len(dropped_leaky)} known-leaky columns before feature selection: {dropped_leaky}")
        df = df.drop(columns=dropped_leaky)

    boi_finalized = ['F115', 'F321', 'F527', 'F531', 'F670', 'F1692', 'F2082', 'F2122',
                     'F2582', 'F2678', 'F2737', 'F2956', 'F3043', 'F3836', 'F3887',
                     'F3889', 'F3891', 'F3894']
    boi_finalized = [f for f in boi_finalized if f in df.columns]

    print("\nEngineering Financial Interaction Features...")
    df['CASH_TO_UPI_RATIO'] = df['F4'] / (np.abs(df['F64']) + 1e-9)
    df['ELEC_TO_CASH_RATIO'] = df['F2578'] / (np.abs(df['F4']) + 1e-9)
    df['VELOCITY_PROXY'] = np.abs(df['F4']) + np.abs(df['F64']) + np.abs(df['F2578'])
    df['VELOCITY_PROXY'] = np.log1p(df['VELOCITY_PROXY'])

    boi_finalized = sorted(set(boi_finalized + ['CASH_TO_UPI_RATIO', 'ELEC_TO_CASH_RATIO', 'VELOCITY_PROXY']))

    # --- SPLIT FIRST, SELECT FEATURES SECOND (Prevents Feature-Selection Leakage) ---
    n_samples = len(df)
    train_end = int(n_samples * 0.80)
    df_train_raw = df.iloc[:train_end].copy()
    df_test_raw = df.iloc[train_end:].copy()

    X_train_raw = df_train_raw.drop(columns=[target, time_col])
    y_train = df_train_raw[target]
    X_test_raw = df_test_raw.drop(columns=[target, time_col])
    y_test = df_test_raw[target]

    print(f"\nTraining Set Class Distribution -> Total: {len(y_train)}, Positives (Mules): {y_train.sum()} ({y_train.mean()*100:.2f}%)")

    print("\n=======================================================")
    print("   STAGE 1: 4-STEP FEATURE SELECTION FUNNEL (TRAIN ONLY) ")
    print("=======================================================")
    print(f"Initial feature count: {X_train_raw.shape[1]}")

    # Step 1: Variance Threshold - fit on train only
    numeric_cols = X_train_raw.select_dtypes(include=[np.number]).columns
    var_thresh = VarianceThreshold(threshold=0.01)
    var_thresh.fit(X_train_raw[numeric_cols].fillna(0))
    kept_numeric = numeric_cols[var_thresh.get_support()].tolist()
    kept_numeric = sorted(set(kept_numeric + [f for f in boi_finalized if f in numeric_cols]))

    categorical_cols = X_train_raw.select_dtypes(include=['object', 'category']).columns.tolist()
    X_train_step = X_train_raw[kept_numeric + categorical_cols]
    print(f"Features after Variance Filter: {X_train_step.shape[1]}")

    # Step 2: Correlation Filter - computed on train only (deterministically sorted)
    print("Running Correlation Filter...")
    X_corr_input = X_train_step[kept_numeric].sort_index(axis=1)
    corr_matrix = X_corr_input.corr().abs()
    upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
    to_drop = [column for column in upper.columns if any(upper[column] > 0.90)]
    to_drop = [col for col in to_drop if col not in boi_finalized]
    X_train_step = X_train_step.drop(columns=to_drop)
    print(f"Features after Correlation Filter: {X_train_step.shape[1]}")

    # Step 3: LightGBM Gain Importance - fit on train only
    for col in categorical_cols:
        if col in X_train_step.columns:
            X_train_step[col] = X_train_step[col].astype('category')

    print("Evaluating Feature Gain via LightGBM Baseline (train only)...")
    lgbm_fs = LGBMClassifier(n_estimators=100, random_state=RANDOM_SEED, n_jobs=1, verbose=-1)
    lgbm_fs.fit(X_train_step, y_train)

    importances = pd.Series(lgbm_fs.feature_importances_, index=X_train_step.columns)
    print("\nTop 15 features by gain importance (train-only fit):")
    print(importances.sort_values(ascending=False).head(15))

    top_candidates = importances.nlargest(80).index.tolist()

    # Step 4: Force-Include Finalized Features
    final_features = sorted(set(top_candidates + boi_finalized))
    print(f"\nFinal selected feature count: {len(final_features)}")

    X_train = X_train_step[final_features].copy()
    X_test = X_test_raw[final_features].copy()

    for col in categorical_cols:
        if col in X_test.columns:
            X_test[col] = X_test[col].astype('category')

    skewed_features = ['F4', 'F64', 'F2578', 'F2586', 'F2737', 'F3836']
    for col in skewed_features:
        if col in X_train.columns:
            X_train[col] = np.sign(X_train[col]) * np.log1p(np.abs(X_train[col]))
        if col in X_test.columns:
            X_test[col] = np.sign(X_test[col]) * np.log1p(np.abs(X_test[col]))

    fraud_ratio = (len(y_train) - y_train.sum()) / (y_train.sum() + 1e-9)
    final_cat_cols = X_train.select_dtypes(include=['category']).columns.tolist()

    print("\n=======================================================")
    print("        STAGE 2: OPTUNA HYPERPARAMETER TUNING          ")
    print("=======================================================")
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    skf = StratifiedKFold(n_splits=4, shuffle=True, random_state=RANDOM_SEED)

    def xgb_obj(trial):
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 100, 300),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'max_depth': trial.suggest_int('max_depth', 3, 7),
            'scale_pos_weight': fraud_ratio, 'enable_categorical': True, 'tree_method': 'hist',
            'random_state': RANDOM_SEED, 'n_jobs': 1
        }
        cv_scores = []
        for tr_idx, val_idx in skf.split(X_train, y_train):
            model = XGBClassifier(**params).fit(X_train.iloc[tr_idx], y_train.iloc[tr_idx], verbose=False)
            cv_scores.append(average_precision_score(y_train.iloc[val_idx], model.predict_proba(X_train.iloc[val_idx])[:, 1]))
        return np.mean(cv_scores)

    print("Tuning XGBoost...")
    study_xgb = optuna.create_study(direction='maximize', sampler=TPESampler(seed=RANDOM_SEED))
    study_xgb.optimize(xgb_obj, n_trials=8)
    xgb_params = study_xgb.best_params
    xgb_params.update({'scale_pos_weight': fraud_ratio, 'enable_categorical': True, 'tree_method': 'hist', 'random_state': RANDOM_SEED, 'n_jobs': 1})

    def lgbm_obj(trial):
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 100, 300),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'num_leaves': trial.suggest_int('num_leaves', 20, 100),
            'class_weight': 'balanced', 'verbose': -1, 'random_state': RANDOM_SEED, 'n_jobs': 1
        }
        cv_scores = []
        for tr_idx, val_idx in skf.split(X_train, y_train):
            model = LGBMClassifier(**params).fit(X_train.iloc[tr_idx], y_train.iloc[tr_idx])
            cv_scores.append(average_precision_score(y_train.iloc[val_idx], model.predict_proba(X_train.iloc[val_idx])[:, 1]))
        return np.mean(cv_scores)

    print("Tuning LightGBM...")
    study_lgbm = optuna.create_study(direction='maximize', sampler=TPESampler(seed=RANDOM_SEED))
    study_lgbm.optimize(lgbm_obj, n_trials=8)
    lgbm_params = study_lgbm.best_params
    lgbm_params.update({'class_weight': 'balanced', 'random_state': RANDOM_SEED, 'verbose': -1, 'n_jobs': 1})

    print("\n=======================================================")
    print("      STAGE 3: STACKED META-LEARNER & OOF CALIBRATION  ")
    print("=======================================================")

    oof_xgb = np.zeros(len(X_train))
    oof_lgbm = np.zeros(len(X_train))
    oof_cat = np.zeros(len(X_train))
    oof_if = np.zeros(len(X_train))
    cat_indices = [X_train.columns.get_loc(c) for c in final_cat_cols]

    print("Generating robust OOF predictions across training folds...")
    for tr_idx, val_idx in skf.split(X_train, y_train):
        X_f_tr, y_f_tr = X_train.iloc[tr_idx], y_train.iloc[tr_idx]
        X_f_val = X_train.iloc[val_idx]

        iso_fold = IsolationForest(n_estimators=100, contamination=0.05, random_state=RANDOM_SEED)
        iso_fold.fit(X_f_tr.select_dtypes(exclude=['category']).fillna(0))
        oof_if[val_idx] = iso_fold.decision_function(X_f_val.select_dtypes(exclude=['category']).fillna(0))

        xgb_m = XGBClassifier(**xgb_params).fit(X_f_tr, y_f_tr, verbose=False)
        lgbm_m = LGBMClassifier(**lgbm_params).fit(X_f_tr, y_f_tr)
        cat_m = CatBoostClassifier(iterations=200, depth=6, auto_class_weights='Balanced', verbose=0, random_seed=RANDOM_SEED, thread_count=1)
        cat_m.fit(X_f_tr, y_f_tr, cat_features=cat_indices)

        oof_xgb[val_idx] = xgb_m.predict_proba(X_f_val)[:, 1]
        oof_lgbm[val_idx] = lgbm_m.predict_proba(X_f_val)[:, 1]
        oof_cat[val_idx] = cat_m.predict_proba(X_f_val)[:, 1]

    X_meta_train = pd.DataFrame({'xgb': oof_xgb, 'lgbm': oof_lgbm, 'cat': oof_cat, 'if_score': oof_if})
    meta_model = LogisticRegression(class_weight='balanced', random_state=RANDOM_SEED)
    meta_model.fit(X_meta_train, y_train)

    # NOTE: still a mild in-sample optimism source (meta_model is scored
    # on the data it was fit on) - acceptable given how few positives
    # you have to further split; revisit with a validation slice once
    # you have more labeled data.
    train_meta_probs = meta_model.predict_proba(X_meta_train)[:, 1]
    precisions, recalls, thresholds = precision_recall_curve(y_train, train_meta_probs)
    f2_scores = (5 * precisions * recalls) / (4 * precisions + recalls + 1e-9)
    optimal_idx = np.argmax(f2_scores)
    optimal_threshold = thresholds[optimal_idx] if optimal_idx < len(thresholds) else 0.5
    print(f"Calibrated Optimal Threshold (from full Train OOF): {optimal_threshold:.4f}")

    print("\nTraining Final Base Models on Full Train Set...")
    xgb_model = XGBClassifier(**xgb_params).fit(X_train, y_train, verbose=False)
    lgbm_model = LGBMClassifier(**lgbm_params).fit(X_train, y_train)
    cat_model = CatBoostClassifier(iterations=200, depth=6, auto_class_weights='Balanced', verbose=0, random_seed=RANDOM_SEED, thread_count=1).fit(X_train, y_train, cat_features=cat_indices)

    iso_forest = IsolationForest(n_estimators=100, contamination=0.05, random_state=RANDOM_SEED)
    iso_forest.fit(X_train.select_dtypes(exclude=['category']).fillna(0))

    test_preds_xgb = xgb_model.predict_proba(X_test)[:, 1]
    test_preds_lgbm = lgbm_model.predict_proba(X_test)[:, 1]
    test_preds_cat = cat_model.predict_proba(X_test)[:, 1]
    test_if_score = iso_forest.decision_function(X_test.select_dtypes(exclude=['category']).fillna(0))

    X_meta_test = pd.DataFrame({'xgb': test_preds_xgb, 'lgbm': test_preds_lgbm, 'cat': test_preds_cat, 'if_score': test_if_score})
    final_test_probs = meta_model.predict_proba(X_meta_test)[:, 1]

    final_preds = (final_test_probs >= optimal_threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, final_preds).ravel()

    print("\n=======================================================")
    print("            FINAL AUDITED PIPELINE EVALUATION          ")
    print("=======================================================")
    print(f"Test PR-AUC:                {average_precision_score(y_test, final_test_probs):.4f}")
    print(f"Test ROC-AUC:               {roc_auc_score(y_test, final_test_probs):.4f}")
    print(f"Optimal Threshold (F2):     {optimal_threshold:.4f} (Train OOF Calibration)")
    print("-------------------------------------------------------")
    print(classification_report(y_test, final_preds))
    print(f"Confusion Matrix -> TP: {tp} | FP: {fp} | FN: {fn} | TN: {tn}")

    # =======================================================
    # PERSIST ARTIFACTS FOR FAST INFERENCE
    # =======================================================
    save_dir = str((_THIS_DIR / '..' / '..' / 'saved_models').resolve())
    os.makedirs(save_dir, exist_ok=True)

    artifact = {
        'final_features': final_features,
        'final_cat_cols': final_cat_cols,
        'cat_indices': cat_indices,
        'skewed_features': skewed_features,
        'xgb_params': xgb_params,
        'lgbm_params': lgbm_params,
        'xgb_model': xgb_model,
        'lgbm_model': lgbm_model,
        'cat_model': cat_model,
        'iso_forest': iso_forest,
        'meta_model': meta_model,
        'optimal_threshold': optimal_threshold,
        'time_col': time_col,
        'target': target,
        'leaky_columns': LEAKY_COLUMNS,
    }
    joblib.dump(artifact, os.path.join(save_dir, 'mule_pipeline_v2.pkl'))
    print(f"\nSaved full inference pipeline to {save_dir}/mule_pipeline_v2.pkl")


if __name__ == "__main__":
    main()