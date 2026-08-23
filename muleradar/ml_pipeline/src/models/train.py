import os
import re
import sys
import random
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import optuna
from optuna.samplers import TPESampler

from lightgbm import LGBMClassifier
from xgboost import XGBClassifier
from catboost import CatBoostClassifier
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.base import clone
from sklearn.metrics import (classification_report, roc_auc_score,
                             average_precision_score, precision_recall_curve,
                             confusion_matrix)
from sklearn.model_selection import StratifiedKFold, LeaveOneOut, cross_val_predict, train_test_split

warnings.filterwarnings('ignore')

_THIS_DIR = Path(__file__).resolve().parent
_DATA_REFINEMENT_DIR = _THIS_DIR.parent / "data_refinement"
if str(_DATA_REFINEMENT_DIR) not in sys.path:
    sys.path.insert(0, str(_DATA_REFINEMENT_DIR))

try:
    from data_dictionary import LEAKY_COLUMNS as DICT_LEAKY_COLUMNS
except ImportError:
    DICT_LEAKY_COLUMNS = [f'F{i}' for i in range(3895, 3924)]

RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

def detect_gpu_environment():
    xgb_device = 'cpu'
    cb_task = 'CPU'
    try:
        dummy_xgb = XGBClassifier(n_estimators=2, max_depth=2, tree_method='hist', device='cuda')
        dummy_xgb.fit(np.array([[0, 1], [1, 0]]), np.array([0, 1]))
        xgb_device = 'cuda'
        print("[+] XGBoost: CUDA GPU enabled.")
    except Exception:
        print("[-] XGBoost: GPU not available. Using CPU.")
    try:
        dummy_cb = CatBoostClassifier(iterations=2, depth=2, task_type='GPU', verbose=0)
        dummy_cb.fit(np.array([[0, 1], [1, 0]]), np.array([0, 1]))
        cb_task = 'GPU'
        print("[+] CatBoost: CUDA GPU enabled.")
    except Exception:
        print("[-] CatBoost: GPU not available. Using CPU.")
    return xgb_device, cb_task

XGB_DEVICE, CB_TASK_TYPE = detect_gpu_environment()

def resolve_dataset_path(filename="boi_dataset.csv"):
    search_paths = [
        _THIS_DIR / '..' / '..' / 'data' / filename,
        _THIS_DIR / '..' / '..' / '..' / 'data' / filename,
        _THIS_DIR / '..' / 'data' / filename,
        Path.cwd() / 'data' / filename,
        Path.cwd() / filename
    ]
    for path in search_paths:
        resolved = path.resolve()
        if resolved.exists():
            return str(resolved)
    raise FileNotFoundError(f"Could not locate '{filename}'.")

def has_organic_overlap(col_data, mule_mask, normal_mask, min_overlap_frac=0.05):
    vals = pd.to_numeric(col_data, errors='coerce')
    mule_vals = vals[mule_mask].dropna()
    normal_vals = vals[normal_mask].dropna()

    if len(mule_vals) < 5 or len(normal_vals) < 5:
        str_mule = set(col_data[mule_mask].dropna().astype(str).unique())
        str_normal = set(col_data[normal_mask].dropna().astype(str).unique())
        if len(str_mule) > 0 and len(str_normal) > 0:
            if len(str_mule.intersection(str_normal)) == 0:
                return False
        return True 

    lo, hi = max(mule_vals.min(), normal_vals.min()), min(mule_vals.max(), normal_vals.max())
    if lo > hi:
        return False  

    in_range_mule = ((mule_vals >= lo) & (mule_vals <= hi)).mean()
    return in_range_mule >= min_overlap_frac

def main():
    dataset_path = resolve_dataset_path('boi_dataset.csv')
    print(f"Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    df = df.dropna(subset=['F3924']).copy()
    target = 'F3924'
    time_col = 'F2230'

    # Ensure account_id is preserved so we can tag the training split later
    if 'Unnamed: 0' in df.columns and 'account_id' not in df.columns:
        df = df.rename(columns={'Unnamed: 0': 'account_id'})
    
    df.columns = [re.sub(r'[\[\]{} ,:]', '_', col) for col in df.columns]

    LEAKY_COLUMNS = sorted(set(DICT_LEAKY_COLUMNS))
    dropped_leaky = [c for c in LEAKY_COLUMNS if c in df.columns]
    if dropped_leaky:
        print(f"Dropping {len(dropped_leaky)} post-investigation outcome columns.")
        df = df.drop(columns=dropped_leaky, errors='ignore')

    df_train_full, df_test_raw = train_test_split(
        df, test_size=0.20, random_state=RANDOM_SEED, stratify=df[target]
    )
    df_train_full = df_train_full.reset_index(drop=True)
    df_test_raw = df_test_raw.reset_index(drop=True)

    df_cv_raw, df_fs_raw = train_test_split(
        df_train_full, test_size=0.25, random_state=RANDOM_SEED, stratify=df_train_full[target]
    )
    df_cv_raw = df_cv_raw.reset_index(drop=True)
    df_fs_raw = df_fs_raw.reset_index(drop=True)

    y_cv = df_cv_raw[target]
    # Explicitly drop account_id so it doesn't leak into the ML features
    X_cv_raw = df_cv_raw.drop(columns=[target, time_col, '_time_sort_key', 'account_id'], errors='ignore')

    y_fs = df_fs_raw[target]
    X_fs_raw = df_fs_raw.drop(columns=[target, time_col, '_time_sort_key', 'account_id'], errors='ignore')

    print(f"\nTotal Train Pool -> Mules: {df_train_full[target].sum()} ({df_train_full[target].mean()*100:.2f}%)")
    print(f"  |- CV Tuning Split -> Mules: {y_cv.sum()}")
    print(f"  |_ Feature Selection Split -> Mules: {y_fs.sum()}")

    # =====================================================================
    # ORGANIC OVERLAP FILTER
    # =====================================================================
    print("\nScanning features for safe, organic behavioral variance...")
    normal_mask = (y_fs == 0)
    mule_mask = (y_fs == 1)

    safe_features = []
    for col in X_fs_raw.columns:
        col_data = X_fs_raw[col]

        pct_missing_normal = col_data[normal_mask].isna().mean()
        pct_missing_mule = col_data[mule_mask].isna().mean()
        if abs(pct_missing_normal - pct_missing_mule) > 0.50:
            continue 

        nunique_normal = col_data[normal_mask].nunique(dropna=False)
        nunique_mule = col_data[mule_mask].nunique(dropna=False)
        if nunique_normal <= 1 or nunique_mule <= 1:
            continue

        if not has_organic_overlap(col_data, mule_mask, normal_mask):
            continue
        safe_features.append(col)

    print(f"[*] Kept {len(safe_features)} structurally safe candidate features.")
    X_cv_safe = X_cv_raw[safe_features].copy()
    X_fs_safe = X_fs_raw[safe_features].copy()

    # =====================================================================
    # CORRELATION FILTER
    # =====================================================================
    numeric_cols = X_cv_safe.select_dtypes(include=[np.number]).columns
    X_corr_input = X_cv_safe[numeric_cols].sort_index(axis=1)
    corr_matrix = X_corr_input.corr().abs()
    upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
    to_drop_corr = [col for col in upper.columns if any(upper[col] > 0.90)]

    X_cv_safe = X_cv_safe.drop(columns=to_drop_corr, errors='ignore')
    X_fs_safe = X_fs_safe.drop(columns=to_drop_corr, errors='ignore')

    categorical_cols = X_cv_safe.select_dtypes(include=['object', 'category']).columns.tolist()
    for col in categorical_cols:
        X_cv_safe[col] = X_cv_safe[col].astype('category')
        X_fs_safe[col] = X_fs_safe[col].astype('category')

    # =====================================================================
    # REGULARIZED FEATURE SELECTION
    # =====================================================================
    print("\nRanking top features via Regularized LightGBM (Strict Hold-Out)...")
    lgbm_fs = LGBMClassifier(
        n_estimators=100, num_leaves=31, min_child_samples=20, 
        class_weight='balanced', random_state=RANDOM_SEED, n_jobs=-1, verbose=-1
    )
    lgbm_fs.fit(X_fs_safe, y_fs)
    importances = pd.Series(lgbm_fs.feature_importances_, index=X_fs_safe.columns)

    valid_features = importances[importances > 0.001].nlargest(80).index.tolist()
    final_features = sorted(list(set(valid_features)))

    previously_purged = {'F3348', 'F1057', 'F1921', 'F3484', 'F3805', 'F1597',
                         'F3487', 'F2956', 'F2583', 'F2350', 'F3534', 'F2487', 'F3799'}
    
    pre_purge_count = len(final_features)
    final_features = [f for f in final_features if f not in previously_purged]
    purged_count = pre_purge_count - len(final_features)

    print(f"[*] Ruthlessly purged {purged_count} deceptive post-event proxy features.")
    print(f"Final model feature count: {len(final_features)}")

    X_cv = X_cv_raw[final_features].copy()
    X_fs = X_fs_raw[final_features].copy()
    X_train_full = df_train_full[final_features].copy()
    y_train_full = df_train_full[target]
    X_test = df_test_raw[final_features].copy()
    y_test = df_test_raw[target]

    for col in categorical_cols:
        if col in final_features:
            X_cv[col] = X_cv[col].astype('category')
            X_fs[col] = X_fs[col].astype('category')
            X_train_full[col] = X_train_full[col].astype('category')
            X_test[col] = X_test[col].astype('category')

    final_cat_cols = X_cv.select_dtypes(include=['category']).columns.tolist()
    cat_indices = [X_cv.columns.get_loc(c) for c in final_cat_cols]
    fraud_ratio = (len(y_cv) - y_cv.sum()) / (y_cv.sum() + 1e-9)

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    N_TRIALS = 25

    # =====================================================================
    # CV HYPERPARAMETER TUNING
    # =====================================================================
    def xgb_obj(trial):
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 100, 400),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'max_depth': trial.suggest_int('max_depth', 3, 8),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
            'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
            'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
            'scale_pos_weight': fraud_ratio, 'enable_categorical': True, 'tree_method': 'hist',
            'device': XGB_DEVICE, 'random_state': RANDOM_SEED
        }
        cv_scores = []
        for tr_idx, val_idx in skf.split(X_cv, y_cv):
            model = XGBClassifier(**params).fit(X_cv.iloc[tr_idx], y_cv.iloc[tr_idx], verbose=False)
            cv_scores.append(average_precision_score(y_cv.iloc[val_idx], model.predict_proba(X_cv.iloc[val_idx])[:, 1]))
        return np.mean(cv_scores)

    study_xgb = optuna.create_study(direction='maximize', sampler=TPESampler(seed=RANDOM_SEED))
    study_xgb.optimize(xgb_obj, n_trials=N_TRIALS)
    xgb_params = study_xgb.best_params
    xgb_params.update({'scale_pos_weight': fraud_ratio, 'enable_categorical': True, 'tree_method': 'hist', 'device': XGB_DEVICE, 'random_state': RANDOM_SEED})

    def lgbm_obj(trial):
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 100, 400),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'num_leaves': trial.suggest_int('num_leaves', 20, 120),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
            'min_child_samples': trial.suggest_int('min_child_samples', 5, 80),
            'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
            'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
            'class_weight': 'balanced', 'verbose': -1, 'random_state': RANDOM_SEED, 'n_jobs': -1
        }
        cv_scores = []
        for tr_idx, val_idx in skf.split(X_cv, y_cv):
            model = LGBMClassifier(**params).fit(X_cv.iloc[tr_idx], y_cv.iloc[tr_idx])
            cv_scores.append(average_precision_score(y_cv.iloc[val_idx], model.predict_proba(X_cv.iloc[val_idx])[:, 1]))
        return np.mean(cv_scores)

    study_lgbm = optuna.create_study(direction='maximize', sampler=TPESampler(seed=RANDOM_SEED))
    study_lgbm.optimize(lgbm_obj, n_trials=N_TRIALS)
    lgbm_params = study_lgbm.best_params
    lgbm_params.update({'class_weight': 'balanced', 'random_state': RANDOM_SEED, 'verbose': -1, 'n_jobs': -1})

    def cat_obj(trial):
        params = {
            'iterations': trial.suggest_int('iterations', 100, 350),
            'depth': trial.suggest_int('depth', 4, 8),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'l2_leaf_reg': trial.suggest_float('l2_leaf_reg', 1e-6, 10.0, log=True),
            'auto_class_weights': 'Balanced', 'verbose': 0, 'random_seed': RANDOM_SEED, 'task_type': CB_TASK_TYPE
        }
        cv_scores = []
        for tr_idx, val_idx in skf.split(X_cv, y_cv):
            model = CatBoostClassifier(**params).fit(X_cv.iloc[tr_idx], y_cv.iloc[tr_idx], cat_features=cat_indices)
            cv_scores.append(average_precision_score(y_cv.iloc[val_idx], model.predict_proba(X_cv.iloc[val_idx])[:, 1]))
        return np.mean(cv_scores)

    study_cat = optuna.create_study(direction='maximize', sampler=TPESampler(seed=RANDOM_SEED))
    study_cat.optimize(cat_obj, n_trials=N_TRIALS)
    cat_params = study_cat.best_params
    cat_params.update({'auto_class_weights': 'Balanced', 'verbose': 0, 'random_seed': RANDOM_SEED, 'task_type': CB_TASK_TYPE})

    oof_xgb = np.zeros(len(X_cv))
    oof_lgbm = np.zeros(len(X_cv))
    oof_cat = np.zeros(len(X_cv))
    oof_if = np.zeros(len(X_cv))
    oof_mask = np.zeros(len(X_cv), dtype=bool)

    print("\nGenerating Stratified Out-Of-Fold (OOF) predictions on CV split...")
    for tr_idx, val_idx in skf.split(X_cv, y_cv):
        X_f_tr, y_f_tr = X_cv.iloc[tr_idx], y_cv.iloc[tr_idx]
        X_f_val = X_cv.iloc[val_idx]

        fold_numeric_tr = X_f_tr.select_dtypes(exclude=['category'])
        fold_numeric_val = X_f_val.select_dtypes(exclude=['category'])

        fold_imputer = SimpleImputer(strategy='median')
        fold_imputer.fit(fold_numeric_tr)

        iso_fold = IsolationForest(n_estimators=100, contamination=0.01, random_state=RANDOM_SEED, n_jobs=-1)
        iso_fold.fit(fold_imputer.transform(fold_numeric_tr))
        oof_if[val_idx] = iso_fold.decision_function(fold_imputer.transform(fold_numeric_val))

        xgb_m = XGBClassifier(**xgb_params).fit(X_f_tr, y_f_tr, verbose=False)
        lgbm_m = LGBMClassifier(**lgbm_params).fit(X_f_tr, y_f_tr)
        cat_m = CatBoostClassifier(**cat_params).fit(X_f_tr, y_f_tr, cat_features=cat_indices)

        oof_xgb[val_idx] = xgb_m.predict_proba(X_f_val)[:, 1]
        oof_lgbm[val_idx] = lgbm_m.predict_proba(X_f_val)[:, 1]
        oof_cat[val_idx] = cat_m.predict_proba(X_f_val)[:, 1]

        oof_mask[val_idx] = True

    valid_indices = np.where(oof_mask)[0]
    X_meta_cv = pd.DataFrame({
        'xgb': oof_xgb[valid_indices],
        'lgbm': oof_lgbm[valid_indices],
        'cat': oof_cat[valid_indices],
        'if_score': oof_if[valid_indices]
    })
    y_meta_cv = y_cv.iloc[valid_indices].reset_index(drop=True)

    oof_blend_probs = (X_meta_cv['xgb'] + X_meta_cv['lgbm'] + X_meta_cv['cat']) / 3.0
    blend_pr_auc = average_precision_score(y_meta_cv, oof_blend_probs)

    meta_model = LogisticRegression(class_weight='balanced', random_state=RANDOM_SEED)
    stack_probs_loo = cross_val_predict(meta_model, X_meta_cv, y_meta_cv, cv=LeaveOneOut(), method='predict_proba')[:, 1]
    stack_pr_auc = average_precision_score(y_meta_cv, stack_probs_loo)

    use_stacking = stack_pr_auc >= blend_pr_auc

    # =====================================================================
    # INDEPENDENT THRESHOLD & HITL CALIBRATION
    # =====================================================================
    print("\nCalibrating methodology and operating threshold on independent FS split...")
    xgb_calib = XGBClassifier(**xgb_params).fit(X_cv, y_cv, verbose=False)
    lgbm_calib = LGBMClassifier(**lgbm_params).fit(X_cv, y_cv)
    cat_calib = CatBoostClassifier(**cat_params).fit(X_cv, y_cv, cat_features=cat_indices)

    calib_imputer = SimpleImputer(strategy='median')
    calib_imputer.fit(X_cv.select_dtypes(exclude=['category']))
    iso_calib = IsolationForest(n_estimators=100, contamination=0.01, random_state=RANDOM_SEED, n_jobs=-1)
    iso_calib.fit(calib_imputer.transform(X_cv.select_dtypes(exclude=['category'])))

    fs_xgb = xgb_calib.predict_proba(X_fs)[:, 1]
    fs_lgbm = lgbm_calib.predict_proba(X_fs)[:, 1]
    fs_cat = cat_calib.predict_proba(X_fs)[:, 1]
    fs_if = iso_calib.decision_function(calib_imputer.transform(X_fs.select_dtypes(exclude=['category'])))

    X_meta_fs = pd.DataFrame({'xgb': fs_xgb, 'lgbm': fs_lgbm, 'cat': fs_cat, 'if_score': fs_if})
    meta_model_final = clone(meta_model).fit(X_meta_cv, y_meta_cv)

    if use_stacking:
        calib_probs = meta_model_final.predict_proba(X_meta_fs)[:, 1]
    else:
        calib_probs = (fs_xgb + fs_lgbm + fs_cat) / 3.0

    precisions, recalls, thresholds = precision_recall_curve(y_fs, calib_probs)
    f2_scores = (5 * precisions * recalls) / (4 * precisions + recalls + 1e-9)
    optimal_idx = np.argmax(f2_scores)
    optimal_threshold = thresholds[optimal_idx] if optimal_idx < len(thresholds) else 0.5
    
    # ---------------------------------------------------------
    # NEW: CONSERVATIVE TIER CALIBRATION ([-1] for highest threshold)
    # ---------------------------------------------------------
    perfect_precision_indices = np.where(precisions[:-1] >= 0.999)[0]
    if len(perfect_precision_indices) > 0:
        # thresholds[-1] guarantees the strictest cutoff for AUTO_BLOCK
        t_high = float(thresholds[perfect_precision_indices[-1]])
        t_high = max(t_high, optimal_threshold * 1.15) 
    else:
        # Fallback if 100% precision isn't mathematically possible on this split
        t_high = float(min(optimal_threshold * 1.15, 0.999))
        
    # Lower t_low creates better UI separation for Medium
    t_low = float(max(optimal_threshold * 0.50, 0.10))
    
    print(f"Calibrated Optimal F2-Threshold: {optimal_threshold:.4f}")
    print(f"Calibrated HITL Routing Bands: AUTO_CLEAR < {t_low:.4f} | HUMAN_REVIEW | AUTO_BLOCK > {t_high:.4f}")

    # =====================================================================
    # FINAL RETRAINING ON FULL TRAIN SET
    # =====================================================================
    print("\nTraining Final Base Models on Full 80% Train Dataset...")
    imputer = SimpleImputer(strategy='median')
    imputer.fit(X_train_full.select_dtypes(exclude=['category']))

    xgb_model = XGBClassifier(**xgb_params).fit(X_train_full, y_train_full, verbose=False)
    lgbm_model = LGBMClassifier(**lgbm_params).fit(X_train_full, y_train_full)
    cat_model = CatBoostClassifier(**cat_params).fit(X_train_full, y_train_full, cat_features=cat_indices)

    iso_forest = IsolationForest(n_estimators=100, contamination=0.01, random_state=RANDOM_SEED, n_jobs=-1)
    iso_forest.fit(imputer.transform(X_train_full.select_dtypes(exclude=['category'])))

    test_preds_xgb = xgb_model.predict_proba(X_test)[:, 1]
    test_preds_lgbm = lgbm_model.predict_proba(X_test)[:, 1]
    test_preds_cat = cat_model.predict_proba(X_test)[:, 1]
    test_if_score = iso_forest.decision_function(imputer.transform(X_test.select_dtypes(exclude=['category'])))

    X_meta_test = pd.DataFrame({'xgb': test_preds_xgb, 'lgbm': test_preds_lgbm, 'cat': test_preds_cat, 'if_score': test_if_score})

    if use_stacking:
        final_test_probs = meta_model_final.predict_proba(X_meta_test)[:, 1]
    else:
        final_test_probs = (test_preds_xgb + test_preds_lgbm + test_preds_cat) / 3.0

    final_preds = (final_test_probs >= optimal_threshold).astype(int)

    print("\n=======================================================")
    print("            FINAL PIPELINE EVALUATION                  ")
    print("=======================================================")

    if y_test.sum() == 0:
        print("\n[WARNING] Test set contains 0 positive mules.")
    else:
        pr_auc = average_precision_score(y_test, final_test_probs)
        roc_auc = roc_auc_score(y_test, final_test_probs)
        print(f"Test PR-AUC:                         {pr_auc:.4f}")
        print(f"Test ROC-AUC:                        {roc_auc:.4f}")
        print(f"Optimal Operating Threshold (F2):    {optimal_threshold:.4f}")
        print("-------------------------------------------------------")
        print(classification_report(y_test, final_preds, target_names=['Normal', 'Mule']))

    save_dir = str((_THIS_DIR / '..' / '..' / 'saved_models').resolve())
    os.makedirs(save_dir, exist_ok=True)

    # SECURE THE TRAINING IDs FOR THE UI
    train_account_ids = df_train_full['account_id'].astype(str).tolist() if 'account_id' in df_train_full.columns else []

    artifact = {
        'final_features': final_features,
        'final_cat_cols': final_cat_cols,
        'cat_indices': cat_indices,
        'imputer': imputer,
        'xgb_params': xgb_params,
        'lgbm_params': lgbm_params,
        'cat_params': cat_params,
        'xgb_model': xgb_model,
        'lgbm_model': lgbm_model,
        'cat_model': cat_model,
        'iso_forest': iso_forest,
        'meta_model': meta_model_final,
        'use_stacking': use_stacking,
        'optimal_threshold': optimal_threshold,
        't_low': t_low,
        't_high': t_high,
        'time_col': time_col,
        'target': target,
        'leaky_columns': LEAKY_COLUMNS,
        'train_account_ids': train_account_ids, # <-- THIS PREVENTS IN-SAMPLE DEMO EMBARRASSMENT
        'calibration_temperature': 2.5,                                                # NEW
        'fixed_tiers': {'critical_score': 900, 'high_score': 750, 'medium_score': 450} # NEW
    }
    
    artifact_path = os.path.join(save_dir, 'mule_pipeline_v2.pkl')
    joblib.dump(artifact, artifact_path)
    print(f"\n[+] Serialized complete inference pipeline to: {artifact_path}")
    print(f"[*] Secured {len(train_account_ids)} training IDs to protect evaluation validity.")

if __name__ == "__main__":
    main()