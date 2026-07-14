import pandas as pd
from sklearn.preprocessing import LabelEncoder
import joblib
import os

class BOIDataRefiner:
    def __init__(self):
        # The exact 18 features requested by Bank of India
        self.important_features = [
            'F115', 'F321', 'F527', 'F531', 'F670', 'F1692', 'F2082', 'F2122', 
            'F2582', 'F2678', 'F2737', 'F2956', 'F3043', 'F3836', 'F3887', 
            'F3889', 'F3891', 'F3894'
        ]
        self.target_col = 'F3924'
        self.label_encoders = {}

    def clean(self, file_path: str) -> pd.DataFrame:
        print(f"Loading data from {file_path}...")
        # Only read the columns we actually need to save memory
        cols_to_use = self.important_features + [self.target_col]
        
        # We use a try-except block just in case some columns are missing in a sample
        try:
            df = pd.read_csv(file_path, usecols=lambda c: c in cols_to_use)
        except ValueError:
            print("Warning: Not all BOI columns found. Loading available columns...")
            df = pd.read_csv(file_path)
            available_cols = [c for c in cols_to_use if c in df.columns]
            df = df[available_cols]

        print("Handling missing values and encoding text...")
        for col in df.columns:
            if df[col].dtype == 'object':
                # Fill missing text and convert to numbers
                df[col] = df[col].fillna('Missing')
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
                self.label_encoders[col] = le
            else:
                # Fill missing numbers with the median
                df[col] = df[col].fillna(df[col].median())

        return df