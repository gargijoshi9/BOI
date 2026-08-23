import pandas as pd
from pathlib import Path

def main():
    # Resolve Path
    dataset_path = Path("../../data/boi_dataset.csv")
    if not dataset_path.exists():
        dataset_path = Path("data/boi_dataset.csv")
        
    df = pd.read_csv(dataset_path)
    time_col = 'F2230'
    
    print("\n=======================================================")
    print("                 TIME COLUMN DIAGNOSTIC                ")
    print("=======================================================")
    
    print(f"1. Raw Dtype: {df[time_col].dtype}")
    
    raw_uniques = df[time_col].dropna().unique()
    print(f"\n2. First 15 Raw Unique Values (Order of Appearance):")
    print(raw_uniques[:15])
    
    print(f"\n3. First 15 Values when sorted via standard Python sorted():")
    print(sorted(raw_uniques)[:15])
    
    print("=======================================================\n")

if __name__ == "__main__":
    main()