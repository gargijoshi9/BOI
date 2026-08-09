import pandas as pd
import shap
import matplotlib.pyplot as plt
import re
from lightgbm import LGBMClassifier
import os
import warnings

warnings.filterwarnings('ignore')

dataset_path = 'C:/Desktop/BOI/muleradar/ml_pipeline/data/boi_dataset_enriched.csv'
print(f"Loading data from: {dataset_path}")
df = pd.read_csv(dataset_path)

target = 'F3924'

if 'Unnamed: 0' in df.columns:
    df = df.drop(columns=['Unnamed: 0'])
df.columns = [re.sub(r'[\[\]{} ,:]', '_', col) for col in df.columns]

# Features
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

categorical_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
for col in categorical_cols:
    X[col] = X[col].astype('category')

# 1. Train the Optimized LightGBM Model
print("Training Final LightGBM Model for SHAP Explainer...")
lgbm_params = {
    'n_estimators': 247, 
    'learning_rate': 0.1202967380531281, 
    'max_depth': 9, 
    'num_leaves': 64, 
    'min_child_samples': 100,
    'class_weight': 'balanced',
    'random_state': 42,
    'n_jobs': -1,
    'verbose': -1
}
model = LGBMClassifier(**lgbm_params)
model.fit(X, y)

# 2. Calculate SHAP Values
print("Calculating exact SHAP Values (This takes a moment)...")
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X)

# LightGBM binary classification returns a list of two arrays [class 0, class 1]
# We want to explain Class 1 (Fraud)
if isinstance(shap_values, list):
    shap_values_fraud = shap_values[1]
else:
    shap_values_fraud = shap_values

output_dir = 'C:/Desktop/BOI/muleradar/ml_pipeline/src/explainability/'

# 3. Generate the SHAP Bar Plot (Global Feature Importance)
print("Generating SHAP Bar Plot...")
plt.figure(figsize=(12, 8))
shap.summary_plot(shap_values_fraud, X, plot_type="bar", show=False, max_display=15)
plt.title("Top 15 Features Driving Fraud Predictions (Global Importance)", fontsize=14, pad=20)
plt.tight_layout()
bar_path = os.path.join(output_dir, 'shap_bar_importance.png')
plt.savefig(bar_path, dpi=300, bbox_inches='tight')
plt.close()

# 4. Generate the SHAP Summary Plot (Directional Impact)
print("Generating SHAP Summary Plot (Beeswarm)...")
plt.figure(figsize=(12, 8))
shap.summary_plot(shap_values_fraud, X, show=False, max_display=15)
plt.title("Directional Impact of Top Features on Fraud Risk", fontsize=14, pad=20)
plt.tight_layout()
summary_path = os.path.join(output_dir, 'shap_summary_impact.png')
plt.savefig(summary_path, dpi=300, bbox_inches='tight')
plt.close()

print(f"\nSuccess! Visualizations saved to:\n1. {bar_path}\n2. {summary_path}")