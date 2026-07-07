import pandas as pd
from sklearn.preprocessing import StandardScaler
import joblib

class FeatureFactory:
    def __init__(self):
        self.scaler = StandardScaler()

    def engineer_features(self, df: pd.DataFrame, is_training: bool = True) -> pd.DataFrame:
        print("Engineering features...")
        df_features = df.copy()
        
        # Separate target if it exists
        target = None
        if 'F3924' in df_features.columns:
            target = df_features['F3924']
            df_features = df_features.drop(columns=['F3924'])

        # Example of Feature Engineering: Creating Interaction terms for highly important features
        # (Assuming F115 and F321 are highly correlated with fraud based on standard banking datasets)
        if 'F115' in df_features.columns and 'F321' in df_features.columns:
            df_features['F115_F321_interaction'] = df_features['F115'] * df_features['F321']

        # Scale the features (AI learns better when numbers are standardized)
        if is_training:
            scaled_data = self.scaler.fit_transform(df_features)
        else:
            scaled_data = self.scaler.transform(df_features)

        # Convert back to DataFrame
        df_final = pd.DataFrame(scaled_data, columns=df_features.columns)

        if target is not None:
            df_final['F3924'] = target.values

        return df_final