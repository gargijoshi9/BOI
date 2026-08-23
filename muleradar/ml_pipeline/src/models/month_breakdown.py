import pandas as pd
from pathlib import Path

def main():
    dataset_path = Path("../../data/boi_dataset.csv")
    if not dataset_path.exists():
        dataset_path = Path("data/boi_dataset.csv")
        
    df = pd.read_csv(dataset_path)
    time_col = 'F2230'
    target = 'F3924'
    
    # Parse to real dates for sorting
    df['_time_sort_key'] = pd.to_datetime(df[time_col], format='%b%y')
    
    # Group by the original string label, aggregate, and sort by the true datetime
    breakdown = df.groupby(time_col).agg(
        rows=(target, 'count'),
        mules=(target, 'sum'),
        _order=('_time_sort_key', 'min')
    ).sort_values('_order')
    
    print("\n==========================================")
    print("   TRUE CHRONOLOGICAL MONTH BREAKDOWN")
    print("==========================================")
    print(breakdown.drop(columns=['_order']))
    print("==========================================\n")

if __name__ == "__main__":
    main()