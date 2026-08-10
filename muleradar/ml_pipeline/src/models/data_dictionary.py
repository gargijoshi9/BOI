"""
Loads BOI's real data dictionary and exposes a programmatic lookup 
so the rest of the pipeline never has to guess what an F-code means.
"""
from dataclasses import dataclass
from typing import Optional
import pandas as pd

@dataclass(frozen=True)
class ColumnMeta:
    feature: str
    variable_name: str
    description: str
    bank_finalized: bool

class DataDictionary:
    def __init__(self, df: pd.DataFrame):
        df = df.copy()
        df.columns = ["Feature", "Variable_Name", "Description", "Bank_Finalized"]
        self._by_feature = {
            row.Feature: ColumnMeta(
                feature=row.Feature,
                variable_name=str(row.Variable_Name),
                description=str(row.Description),
                bank_finalized=pd.notna(row.Bank_Finalized),
            )
            for row in df.itertuples(index=False)
        }

    def get(self, feature: str) -> Optional[ColumnMeta]:
        return self._by_feature.get(feature)

    def describe(self, feature: str) -> str:
        m = self.get(feature)
        if m is None:
            return f"{feature}: <not found in dictionary>"
        return f"{m.variable_name}: {m.description}"

    def finalized_features(self) -> list:
        return [
            f for f, m in self._by_feature.items()
            if m.bank_finalized and f != "F3924"
        ]

    def search(self, keyword: str) -> pd.DataFrame:
        rows = [
            (m.feature, m.variable_name, m.description)
            for m in self._by_feature.values()
            if keyword.lower() in m.variable_name.lower()
            or keyword.lower() in m.description.lower()
        ]
        return pd.DataFrame(rows, columns=["Feature", "Variable_Name", "Description"])

def load_dictionary(path: str = "Description.xlsx") -> DataDictionary:
    df = pd.read_excel(path, sheet_name="Data_Dicitionary")
    return DataDictionary(df)

# --- CORRECTED COLUMN ROLES ---
TARGET_COL = "F3924"
DATE_COL = "F2230"
ACCOUNT_TYPE_COL = "F3886"

LEAKY_COLUMNS = sorted(set(["F3912"] + [f"F{i}" for i in range(3895, 3924)]))

COUNT_FEATURES = ["F670", "F1692", "F2082", "F2122", "F2582"]
RATIO_FEATURES = ["F115", "F527", "F531"]
DEVIATION_FEATURES = ["F2678", "F2956", "F2737", "F3043"]
ORDINAL_BUCKET_FEATURES = ["F3889"]
ONEHOT_FEATURES = ["F3891"]
LOG_TRANSFORM_FEATURES = ["F321", "F527", "F1692", "F2678", "F2956", "F3043"]
WINSORIZE_FEATURES = ["F2678", "F3836"]

# True monetary AMOUNT columns for the Frontend UI estimates
TRUE_INFLOW_AMT_COL = "F2084" 
TRUE_CASHOUT_AMT_COL = "F2127"