import sys
import os
import joblib
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

# Add the src folder to Python's path to import our custom modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from data_refinement.cleaner import BOIDataRefiner
from feature_factory.features import FeatureFactory

def train_model():
    # 1. File Paths
    data_path = '../../data/boi_dataset.csv' 
    model_save_path = '../../saved_models/xgboost_mule_model.pkl'
    
    # 2. Process Data through the Pipeline
    print("Initializing Data Refinement and Feature Engineering...")
    refiner = BOIDataRefiner()
    df_clean = refiner.clean(data_path)
    
    factory = FeatureFactory()
    df_final = factory.engineer_features(df_clean, is_training=True)
    
    # 3. Split Data
    print("Splitting data for training (80/20)...")
    X = df_final.drop(columns=['F3924'])
    y = df_final['F3924']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # 4. Calculate Cost-Sensitive Weight dynamically
    negative_class_count = sum(y_train == 0)
    positive_class_count = sum(y_train == 1)
    dynamic_weight = negative_class_count / positive_class_count
    
    print(f"\nTraining on REAL data only.")
    print(f"Normal Accounts: {negative_class_count} | Mule Accounts: {positive_class_count}")
    print(f"Applying Penalty Weight: {dynamic_weight:.2f}x to force High Recall.\n")
    
    # 5. Train using Custom Tuned Parameters (Optimizing for AUCPR)
    print("Training XGBoost 'Wide Net' Model with Early Stopping...")
    model = XGBClassifier(
        objective='binary:logistic', 
        eval_metric='aucpr',           # Area Under Precision-Recall Curve
        scale_pos_weight=dynamic_weight,
        n_estimators=800,              # Max trees
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
    
    # Pass eval_set so early_stopping_rounds knows what to monitor
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )
    
    # 6. Evaluate the Model
    print(f"\nTraining optimized and stopped at tree {model.best_iteration}")
    print("\n--- FINAL HYBRID-LAYER 1 RESULTS (WIDE NET) ---")
    predictions = model.predict(X_test)
    
    print("Classification Report:")
    print(classification_report(y_test, predictions))
    
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, predictions))
    
    # 7. Save Model for Gargi's Backend API
    os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
    joblib.dump(model, model_save_path)
    print(f"\nPhase 1 Core ML Model successfully saved to {model_save_path}")

if __name__ == "__main__":
    train_model()