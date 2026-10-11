# muleradar/ml_pipeline/src/explainability/feature_dictionary.py
"""
Loads Description.xlsx once at import time and caches Feature -> (Variable
Name, Description) so SHAP codes can be translated into human-readable text
anywhere in the backend (report generation, live SHAP widget, HITL queue).
"""
from pathlib import Path
from typing import Optional
import openpyxl

def _find_dict_path() -> Path:
    search_paths = [
        Path(__file__).resolve().parents[3] / "Description.xlsx",  # muleradar/Description.xlsx
        Path(__file__).resolve().parents[4] / "Description.xlsx",  # BOI/Description.xlsx
        Path.cwd() / "Description.xlsx",
        Path.cwd() / "muleradar" / "Description.xlsx",
        Path.cwd().parent / "Description.xlsx",
    ]
    for sp in search_paths:
        if sp.exists():
            return sp
    return search_paths[0]

_DICT_PATH = _find_dict_path()
_cache: Optional[dict] = None

def _load():
    global _cache
    if _cache is not None:
        return _cache
    _cache = {}
    if not _DICT_PATH.exists():
        return _cache
    wb = openpyxl.load_workbook(_DICT_PATH, data_only=True)
    ws = wb["Data_Dicitionary"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        feat, varname, desc = row[0], row[1], row[2]
        if feat:
            _cache[str(feat)] = {"variable_name": varname or "", "description": desc or ""}
    return _cache

def translate_feature(feature_code: str) -> dict:
    entry = _load().get(feature_code)
    if entry is None:
        return {"code": feature_code, "variable_name": feature_code, "description": "Not found in data dictionary"}
    return {"code": feature_code, **entry}
