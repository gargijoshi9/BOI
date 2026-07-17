import sys
import os
import joblib
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, confusion_matrix,
    fbeta_score, average_precision_score, roc_auc_score
)

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from data_refinement.cleaner import BOIDataRefiner
from feature_factory.features import FeatureFactory

# FIX: MuleEnsembleModel now lives in its own module (ensemble_model.py,
# same folder as this file) instead of being defined inline here. When
# this script is run directly (`python train.py`), any class defined in
# it gets pickled under module "__main__" - which breaks joblib.load() in
# any OTHER script (like analyzer.py) that tries to unpickle it later.
# Importing it from a dedicated module gives it a stable, resolvable
# module path instead.
from ensemble_model import MuleEnsembleModel


# Common column names a date/timestamp field might show up under in the
# raw export. Add the real column name here once confirmed against the
# data dictionary - this list is a best-effort guess, not a guarantee.
_CANDIDATE_DATE_COLUMNS = [
    'transaction_date', 'txn_date', 'date', 'account_open_date',
    'created_at', 'timestamp', 'F_DATE', 'report_date'
]


def _dynamic_scale_pos_weight(y_train) -> float:
    negative = sum(y_train == 0)
    positive = sum(y_train == 1)
    return negative / positive


def _find_best_ensemble_weight(xgb_model, lgbm_model, X_val, y_val) -> float:
    """
    Sweeps the XGBoost/LightGBM blend weight and keeps whichever weight
    maximizes F2-score on the validation split (recall matters more than
    precision for mule detection - missing a mule is costlier than a
    false positive that gets reviewed and cleared).
    """
    best_weight, best_f2 = 0.5, -1.0
    xgb_val_proba = xgb_model.predict_proba(X_val)[:, 1]
    lgbm_val_proba = lgbm_model.predict_proba(X_val)[:, 1]

    for w in np.arange(0.1, 1.0, 0.05):
        blended = (w * xgb_val_proba) + ((1 - w) * lgbm_val_proba)
        preds = (blended >= 0.5).astype(int)
        f2 = fbeta_score(y_val, preds, beta=2, zero_division=0)
        if f2 > best_f2:
            best_f2, best_weight = f2, w

    print(f"Best ensemble weight found: XGB={best_weight:.2f} / LGBM={1 - best_weight:.2f} (F2={best_f2:.4f})")
    return round(float(best_weight), 2)


def _find_best_threshold(xgb_weight, xgb_model, lgbm_model, X_val, y_val) -> float:
    """
    Sweeps the decision threshold (given the already-chosen blend weight)
    and keeps whichever maximizes F2-score on the validation split.
    """
    xgb_val_proba = xgb_model.predict_proba(X_val)[:, 1]
    lgbm_val_proba = lgbm_model.predict_proba(X_val)[:, 1]
    blended = (xgb_weight * xgb_val_proba) + ((1 - xgb_weight) * lgbm_val_proba)

    best_threshold, best_f2 = 0.5, -1.0
    for t in np.arange(0.05, 0.95, 0.01):
        preds = (blended >= t).astype(int)
        f2 = fbeta_score(y_val, preds, beta=2, zero_division=0)
        if f2 > best_f2:
            best_f2, best_threshold = f2, t

    print(f"Best decision threshold found: {best_threshold:.2f} (F2={best_f2:.4f})")
    return round(float(best_threshold), 2)


def _split_data(df_final: pd.DataFrame):
    """
    Splits into train / val / test.

    FIX: the original code used a random stratified split. For a fraud/
    mule-detection model that's a real problem:
      - Mule rings and laundering typologies operate as connected batches
        in time, not independent random draws - a random split can leak
        accounts from the same ring/time-window into both train and test,
        inflating reported metrics.
      - It never tests whether the model generalizes to genuinely NEW
        mule behavior, which is exactly what production needs.

    Correct practice is an out-of-time split: train on older data, validate/
    test on the most recent period. This function tries to detect a date
    column automatically; if none is found it falls back to the random
    stratified split but prints a loud warning so this doesn't silently
    ship as "final" for the hackathon submission without a conscious
    decision. Once the real date/timestamp column is confirmed, put its
    name at the top of `_CANDIDATE_DATE_COLUMNS` (or hardcode it here) to
    switch to a proper out-of-time split with zero other code changes.
    """
    date_col = next((c for c in _CANDIDATE_DATE_COLUMNS if c in df_final.columns), None)

    if date_col is not None:
        print(f"Using out-of-time split on column '{date_col}'.")
        df_sorted = df_final.sort_values(date_col)
        n = len(df_sorted)
        train_end = int(n * 0.70)
        val_end = int(n * 0.85)

        train_df = df_sorted.iloc[:train_end]
        val_df = df_sorted.iloc[train_end:val_end]
        test_df = df_sorted.iloc[val_end:]

        drop_cols = ['F3924', date_col]
        X_train, y_train = train_df.drop(columns=drop_cols), train_df['F3924']
        X_val, y_val = val_df.drop(columns=drop_cols), val_df['F3924']
        X_test, y_test = test_df.drop(columns=drop_cols), test_df['F3924']
        return X_train, X_val, X_test, y_train, y_val, y_test

    print(
        "\n*** WARNING: no date/timestamp column found "
        f"(checked {_CANDIDATE_DATE_COLUMNS}). "
        "Falling back to a RANDOM stratified split. Reported metrics from "
        "a random split will likely OVERSTATE real-world performance for "
        "a fraud-ring detection task - confirm the real date column with "
        "the data dictionary before treating these numbers as final. ***\n"
    )
    X = df_final.drop(columns=['F3924'])
    y = df_final['F3924']
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )
    return X_train, X_val, X_test, y_train, y_val, y_test


def train_model():
    data_path = '../../data/boi_dataset.csv'
    model_save_path = '../../saved_models/mule_ensemble_model.pkl'
    refiner_save_path = '../../saved_models/data_refiner.pkl'
    factory_save_path = '../../saved_models/feature_factory.pkl'

    print("Initializing Data Refinement and Feature Engineering...")
    refiner = BOIDataRefiner()
    df_clean = refiner.clean(data_path, is_training=True)

    factory = FeatureFactory()
    df_final = factory.engineer_features(df_clean, is_training=True)

    X_train, X_val, X_test, y_train, y_val, y_test = _split_data(df_final)

    dynamic_weight = _dynamic_scale_pos_weight(y_train)
    print(f"\nTraining on REAL data only.")
    print(f"Normal Accounts: {sum(y_train == 0)} | Mule Accounts: {sum(y_train == 1)}")
    print(f"Applying Penalty Weight: {dynamic_weight:.2f}x to force High Recall.\n")

    # ---- Model 1: XGBoost (wide-net, optimized for AUCPR) ----
    print("Training XGBoost model...")
    xgb_model = XGBClassifier(
        objective='binary:logistic',
        eval_metric='aucpr',
        scale_pos_weight=dynamic_weight,
        n_estimators=800,
        learning_rate=0.05,
        max_depth=5,
        min_child_weight=3,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_alpha=0.1,
        reg_lambda=1.0,
        early_stopping_rounds=50,
        random_state=42,
        n_jobs=-1,
        tree_method='hist',
        verbosity=0
    )
    xgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    print(f"XGBoost stopped at tree {xgb_model.best_iteration}")

    # ---- Model 2: LightGBM (complementary tree structure - leaf-wise growth
    # catches different split patterns than XGBoost's level-wise growth,
    # which is exactly why blending the two helps recall on the harder cases) ----
    print("Training LightGBM model...")
    lgbm_model = LGBMClassifier(
        objective='binary',
        metric='average_precision',
        scale_pos_weight=dynamic_weight,
        n_estimators=800,
        learning_rate=0.05,
        max_depth=6,
        num_leaves=31,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
        verbosity=-1
    )
    lgbm_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=None
    )

    # ---- Find optimal blend weight, then optimal threshold, on validation set ----
    best_xgb_weight = _find_best_ensemble_weight(xgb_model, lgbm_model, X_val, y_val)
    best_threshold = _find_best_threshold(best_xgb_weight, xgb_model, lgbm_model, X_val, y_val)
    ensemble = MuleEnsembleModel(
        xgb_model, lgbm_model, xgb_weight=best_xgb_weight, threshold=best_threshold
    )

    # ---- Final evaluation on untouched test set ----
    print("\n--- FINAL ENSEMBLE RESULTS (held-out test set) ---")
    test_proba = ensemble.predict_proba(X_test)[:, 1]
    test_preds = ensemble.predict(X_test)  # uses the tuned threshold, not a hardcoded 0.5

    print("Classification Report:")
    print(classification_report(y_test, test_preds))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, test_preds))
    print(f"F2-score:  {fbeta_score(y_test, test_preds, beta=2):.4f}")
    print(f"PR-AUC:    {average_precision_score(y_test, test_proba):.4f}")
    print(f"AUC-ROC:   {roc_auc_score(y_test, test_proba):.4f}")

    # ---- Persist the ensemble + the fitted preprocessing objects ----
    os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
    joblib.dump(ensemble, model_save_path)
    joblib.dump(refiner, refiner_save_path)
    joblib.dump(factory, factory_save_path)

    print(f"\nEnsemble model saved to {model_save_path}")
    print(f"Fitted data refiner saved to {refiner_save_path}")
    print(f"Fitted feature factory saved to {factory_save_path}")


if __name__ == "__main__":
    train_model()