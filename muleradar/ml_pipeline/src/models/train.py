import sys
import os
import joblib
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import (
    classification_report, confusion_matrix,
    fbeta_score, average_precision_score, roc_auc_score
)

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from data_refinement.cleaner import BOIDataRefiner
from feature_factory.features import FeatureFactory
from ensemble_model import MuleEnsembleModel


# DAY-1 FIX: F2230 ("MNTH" - Month of the data) and F3888
# ("ACCT_OPN_DATE") are the REAL time columns confirmed against the
# official BOI data dictionary. See _load_split_key() below for why this
# is read directly from the raw CSV instead of depending on the cleaned
# feature matrix (BOIDataRefiner drops F2230 as a leaky MODEL FEATURE,
# but it's exactly the right column to split ON).
_CANDIDATE_DATE_COLUMNS = [
    'F2230', 'F3888',
    # Fallback guesses, kept in case the real column ever gets renamed:
    'transaction_date', 'txn_date', 'date', 'account_open_date',
    'created_at', 'timestamp', 'F_DATE', 'report_date'
]

# Shared XGBoost/LightGBM hyperparameters, factored out so the
# cross-validation fold models (see _cv_tune below) and the final model
# use identical settings apart from scale_pos_weight (which is
# recomputed per-fold/final-fit since it depends on each split's own
# class balance).
_XGB_PARAMS = dict(
    objective='binary:logistic',
    eval_metric='aucpr',
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
    verbosity=0,
)

_LGBM_PARAMS = dict(
    objective='binary',
    metric='average_precision',
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
    verbosity=-1,
)


def _dynamic_scale_pos_weight(y_train) -> float:
    negative = sum(y_train == 0)
    positive = sum(y_train == 1)
    return negative / positive


def _find_suffix_start(y: np.ndarray, min_pos: int, min_neg: int) -> "int | None":
    """
    Scans backward from the END of a chronologically-sorted label array
    and returns the SMALLEST possible suffix start index `i` such that
    y[i:] contains at least `min_pos` positives AND at least `min_neg`
    negatives.

    Returns None if the full array doesn't contain enough of either
    class to satisfy the minimums at all.
    """
    n = len(y)
    total_pos = int(y.sum())
    total_neg = n - total_pos
    if total_pos < min_pos or total_neg < min_neg:
        return None

    pos_from_end = 0
    neg_from_end = 0
    for i in range(n - 1, -1, -1):
        if y[i] == 1:
            pos_from_end += 1
        else:
            neg_from_end += 1
        if pos_from_end >= min_pos and neg_from_end >= min_neg:
            return i
    return None  # unreachable given the guard above, but explicit


def _find_test_start(
    y_sorted: pd.Series,
    min_test_pos: int = 10,
    min_test_neg: int = 150,
) -> "int | None":
    """
    DAY-2 FIX (round 3): finds a single chronological cutoff separating
    `train_full` (everything before) from `test` (everything from this
    index onward), guaranteeing test has at least `min_test_pos`
    positives AND `min_test_neg` negatives - still zero shuffling,
    strictly chronological.

    Earlier versions of this file also tried to carve out a THIRD,
    fixed "middle" validation slice between train and test. Running
    that against the real BOI dataset revealed the mule accounts are
    NOT smoothly distributed over time at all - they cluster in (at
    least) two separate spikes, one very early in the timeline and one
    very late (the late spike is what `test` below naturally captures),
    with a long fraud-sparse stretch in between. Any fixed contiguous
    "middle" block sized to guarantee even 5 positives was forced to
    eat almost the entire early cluster to find them, collapsing
    `train` down to ~28 rows in one real run.

    The fix is architectural, not a smarter cutoff: this function now
    only produces a 2-way split (train_full / test). Tuning that used
    to rely on a dedicated validation slice (XGBoost early stopping,
    ensemble-weight search, decision-threshold search) now happens via
    stratified K-fold cross-validation INSIDE train_full - see
    _cv_tune() below - which naturally adapts to positives being
    clustered anywhere within the training window, since StratifiedKFold
    guarantees every fold gets a proportional share regardless of where
    in time those positives fall.
    """
    y_arr = y_sorted.to_numpy()
    n = len(y_arr)
    test_start = _find_suffix_start(y_arr, min_test_pos, min_test_neg)
    if test_start is None or test_start < 1 or test_start >= n:
        return None
    return test_start


def _load_split_key(file_path: str, n_rows_expected: int) -> "pd.Series | None":
    """
    Reads a real date/time column DIRECTLY from the raw CSV, independent
    of BOIDataRefiner, so it survives even though BOIDataRefiner drops
    F2230 from the model feature set (see module docstring). Aligned by
    row POSITION (reset index) - safe because neither
    BOIDataRefiner.clean() nor FeatureFactory.engineer_features() drop
    or reorder rows.
    """
    header = pd.read_csv(file_path, nrows=0)
    found_col = next((c for c in _CANDIDATE_DATE_COLUMNS if c in header.columns), None)
    if found_col is None:
        return None

    date_series = pd.read_csv(file_path, usecols=[found_col])[found_col].reset_index(drop=True)

    if len(date_series) != n_rows_expected:
        print(
            f"\n*** WARNING: split-key column '{found_col}' has "
            f"{len(date_series)} rows but the cleaned feature matrix has "
            f"{n_rows_expected} rows. Row alignment cannot be trusted - "
            f"falling back to random split. This should not happen unless "
            f"BOIDataRefiner or FeatureFactory started dropping rows. ***\n"
        )
        return None

    print(f"Loaded split key '{found_col}' directly from raw CSV ({date_series.notna().sum()} non-null of {len(date_series)}).")
    return date_series.rename('_split_key')


def _split_data(df_final: pd.DataFrame, split_key: "pd.Series | None"):
    """
    Splits into train_full / test ONLY (no fixed middle validation
    slice - see _find_test_start's docstring for why). Uses an
    out-of-time cutoff whenever a real split key is available, falling
    back to a random stratified split only when no time column could be
    found, or when the class-balance minimums can't be satisfied for
    `test` anywhere in the timeline.
    """
    if split_key is not None:
        df_with_key = df_final.reset_index(drop=True).copy()
        df_with_key['_split_key'] = split_key.values
        # kind='mergesort' -> stable sort, so rows sharing the same
        # time-bucket value (e.g. same month) keep their original CSV
        # row order rather than being reshuffled.
        df_sorted = df_with_key.sort_values('_split_key', kind='mergesort').reset_index(drop=True)

        y_sorted = df_sorted['F3924']
        test_start = _find_test_start(y_sorted)

        if test_start is not None:
            print(
                "Using out-of-time split on column '_split_key' "
                "(train_full = everything before the cutoff, test = "
                "the guaranteed-both-classes tail after it)."
            )
            train_full_df = df_sorted.iloc[:test_start]
            test_df = df_sorted.iloc[test_start:]

            drop_cols = ['F3924', '_split_key']
            X_train_full = train_full_df.drop(columns=drop_cols)
            y_train_full = train_full_df['F3924']
            X_test = test_df.drop(columns=drop_cols)
            y_test = test_df['F3924']

            print(
                f"Split sizes (rows / mule positives / normal negatives): "
                f"train_full={len(X_train_full)}/{int(y_train_full.sum())}/{len(X_train_full) - int(y_train_full.sum())}  "
                f"test={len(X_test)}/{int(y_test.sum())}/{len(X_test) - int(y_test.sum())}"
            )
            if int(y_train_full.sum()) == 0:
                print(
                    "*** WARNING: train_full has ZERO positives - the "
                    "model cannot learn anything. Falling back to random "
                    "split instead. ***"
                )
            else:
                return X_train_full, X_test, y_train_full, y_test

        print(
            "\n*** WARNING: could not find a class-balanced out-of-time "
            "test cutoff. Falling back to random stratified split - loses "
            "the out-of-time evaluation property, but still usable. ***\n"
        )

    X = df_final.drop(columns=['F3924'])
    y = df_final['F3924']
    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(
        f"Split sizes (random stratified): "
        f"train_full={len(X_train_full)}/{int(y_train_full.sum())}  "
        f"test={len(X_test)}/{int(y_test.sum())}"
    )
    return X_train_full, X_test, y_train_full, y_test


def _cv_tune(X_train_full: pd.DataFrame, y_train_full: pd.Series, n_splits: int = 5):
    """
    Stratified K-fold cross-validation INSIDE train_full, replacing the
    old single fixed validation slice. Each fold's held-out portion is
    used both for XGBoost's early stopping AND to build an out-of-fold
    (OOF) probability array that covers the ENTIRE train_full set - the
    ensemble weight and decision threshold are then tuned against those
    pooled OOF predictions, which uses every single training-window
    positive at least once (unlike a dedicated val slice, which might
    contain very few - or, as seen on this dataset, occasionally none).

    Returns (best_xgb_weight, best_threshold, oof_f2) - the two tuned
    values are what actually gets used for the FINAL model, trained
    separately on the full train_full set (see train_model()).
    """
    n_splits = min(n_splits, int(y_train_full.sum()))  # can't have more folds than positives
    n_splits = max(n_splits, 2)
    print(f"\nRunning {n_splits}-fold stratified CV inside train_full for tuning...")

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    oof_xgb = np.zeros(len(y_train_full))
    oof_lgbm = np.zeros(len(y_train_full))
    y_arr = y_train_full.to_numpy()

    for fold_idx, (tr_idx, va_idx) in enumerate(skf.split(X_train_full, y_train_full)):
        X_tr, X_va = X_train_full.iloc[tr_idx], X_train_full.iloc[va_idx]
        y_tr, y_va = y_train_full.iloc[tr_idx], y_train_full.iloc[va_idx]
        fold_weight = _dynamic_scale_pos_weight(y_tr)

        xgb_fold = XGBClassifier(scale_pos_weight=fold_weight, **_XGB_PARAMS)
        xgb_fold.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)

        lgbm_fold = LGBMClassifier(scale_pos_weight=fold_weight, **_LGBM_PARAMS)
        lgbm_fold.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], callbacks=None)

        oof_xgb[va_idx] = xgb_fold.predict_proba(X_va)[:, 1]
        oof_lgbm[va_idx] = lgbm_fold.predict_proba(X_va)[:, 1]

        print(
            f"  Fold {fold_idx + 1}/{n_splits}: "
            f"train_pos={int(y_tr.sum())} val_pos={int(y_va.sum())} "
            f"xgb_best_iter={xgb_fold.best_iteration}"
        )

    best_weight, best_f2 = 0.5, -1.0
    for w in np.arange(0.1, 1.0, 0.05):
        blended = (w * oof_xgb) + ((1 - w) * oof_lgbm)
        preds = (blended >= 0.5).astype(int)
        f2 = fbeta_score(y_arr, preds, beta=2, zero_division=0)
        if f2 > best_f2:
            best_f2, best_weight = f2, w
    print(f"[CV] Best ensemble weight: XGB={best_weight:.2f}/LGBM={1 - best_weight:.2f} (OOF F2={best_f2:.4f})")

    blended_best = (best_weight * oof_xgb) + ((1 - best_weight) * oof_lgbm)
    best_threshold, best_f2_thresh = 0.5, -1.0
    for t in np.arange(0.05, 0.95, 0.01):
        preds = (blended_best >= t).astype(int)
        f2 = fbeta_score(y_arr, preds, beta=2, zero_division=0)
        if f2 > best_f2_thresh:
            best_f2_thresh, best_threshold = f2, t
    print(f"[CV] Best decision threshold: {best_threshold:.2f} (OOF F2={best_f2_thresh:.4f})")

    return round(float(best_weight), 2), round(float(best_threshold), 2), best_f2_thresh


def train_model():
    data_path = '../../data/boi_dataset.csv'
    model_save_path = '../../saved_models/mule_ensemble_model.pkl'
    refiner_save_path = '../../saved_models/data_refiner.pkl'
    factory_save_path = '../../saved_models/feature_factory.pkl'

    print("Initializing Data Refinement and Feature Engineering...")
    refiner = BOIDataRefiner()
    df_clean = refiner.clean(data_path, is_training=True)

    factory = FeatureFactory(use_amount_totals=refiner.use_amount_totals)
    df_final = factory.engineer_features(df_clean, is_training=True)

    split_key = _load_split_key(data_path, n_rows_expected=len(df_final))
    X_train_full, X_test, y_train_full, y_test = _split_data(df_final, split_key)

    # ---- Tune ensemble weight + decision threshold via CV inside train_full ----
    best_xgb_weight, best_threshold, oof_f2 = _cv_tune(X_train_full, y_train_full)

    # ---- Fit FINAL models on the FULL train_full set. A small stratified
    # (non-chronological) holdout is carved out purely so XGBoost has an
    # eval_set for early stopping - this is NOT used for weight/threshold
    # tuning (already done via CV above), only to decide tree count. ----
    dynamic_weight = _dynamic_scale_pos_weight(y_train_full)
    print(f"\nTraining FINAL models on train_full.")
    print(f"Normal Accounts: {sum(y_train_full == 0)} | Mule Accounts: {sum(y_train_full == 1)}")
    print(f"Applying Penalty Weight: {dynamic_weight:.2f}x to force High Recall.\n")

    X_fit, X_es, y_fit, y_es = train_test_split(
        X_train_full, y_train_full, test_size=0.15, random_state=42, stratify=y_train_full
    )

    print("Training final XGBoost model...")
    xgb_model = XGBClassifier(scale_pos_weight=dynamic_weight, **_XGB_PARAMS)
    xgb_model.fit(X_fit, y_fit, eval_set=[(X_es, y_es)], verbose=False)
    print(f"XGBoost stopped at tree {xgb_model.best_iteration}")

    print("Training final LightGBM model...")
    lgbm_model = LGBMClassifier(scale_pos_weight=dynamic_weight, **_LGBM_PARAMS)
    lgbm_model.fit(X_fit, y_fit, eval_set=[(X_es, y_es)], callbacks=None)

    ensemble = MuleEnsembleModel(
        xgb_model, lgbm_model, xgb_weight=best_xgb_weight, threshold=best_threshold
    )

    # ---- Final evaluation on the untouched, genuinely-future test set ----
    print("\n--- FINAL ENSEMBLE RESULTS (held-out, out-of-time test set) ---")
    test_proba = ensemble.predict_proba(X_test)[:, 1]
    test_preds = ensemble.predict(X_test)

    print("Classification Report:")
    print(classification_report(y_test, test_preds, labels=[0, 1], zero_division=0))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, test_preds, labels=[0, 1]))
    print(f"F2-score:  {fbeta_score(y_test, test_preds, beta=2, zero_division=0):.4f}")
    print(f"PR-AUC:    {average_precision_score(y_test, test_proba):.4f}")
    if len(set(y_test)) > 1:
        print(f"AUC-ROC:   {roc_auc_score(y_test, test_proba):.4f}")
    else:
        print("AUC-ROC:   undefined (test set has only one class present)")

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