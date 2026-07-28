class MuleEnsembleModel:
    """
    Thin wrapper around the XGBoost + LightGBM soft-voting ensemble so the
    backend can load ONE pickled object and call .predict_proba() /
    .predict() without knowing there are two models underneath.

    IMPORTANT: this class lives in its own file specifically so it does
    NOT get pickled under the "__main__" module. When a class is defined
    inside a script that's run directly (`python train.py`), Python
    records its module as "__main__" at pickle time - so joblib.load()
    later, from a *different* entry point (like analyzer.py), fails with
    `AttributeError: Can't get attribute 'MuleEnsembleModel' on <module
    '__main__' ...>`, because that other script's own __main__ doesn't
    contain the class. Keeping the class in its own module
    (ensemble_model.py) and importing it into train.py gives it a stable,
    consistent module path ("ensemble_model.MuleEnsembleModel") that any
    script can resolve, as long as this file's directory is on sys.path.
    """

    def __init__(self, xgb_model, lgbm_model, xgb_weight: float = 0.55, threshold: float = 0.5):
        self.xgb_model = xgb_model
        self.lgbm_model = lgbm_model
        self.xgb_weight = xgb_weight
        self.lgbm_weight = 1.0 - xgb_weight
        self.threshold = threshold

    def predict_proba(self, X):
        xgb_proba = self.xgb_model.predict_proba(X)
        lgbm_proba = self.lgbm_model.predict_proba(X)
        return (self.xgb_weight * xgb_proba) + (self.lgbm_weight * lgbm_proba)

    def predict(self, X, threshold: float = None):
        proba = self.predict_proba(X)[:, 1]
        t = self.threshold if threshold is None else threshold
        return (proba >= t).astype(int)