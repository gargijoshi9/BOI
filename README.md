# MuleRadar 📡
> **AI/ML-Based Classification of Suspicious Mule Accounts**  
> Developed for **Bank of India (BOI) Hackathon 2026** by Team **Orange** (Pune Institute of Computer Technology).

---

## 📌 Problem Statement
Modern financial crime networks utilize sophisticated **mule accounts** to obscure illicit fund flows, making traditional rule-based transaction monitoring systems ineffective. MuleRadar is an enterprise-grade, Explainable AI (XAI)-powered suspicious money mule detection platform. It ingests cross-channel banking data, real-time regulatory feeds, and government cyber fraud alerts to proactively flag, score, and forecast financial crimes.

---

## 🚀 Key Platform Features

### 1. Behavioral DNA Engineering & Data Refinement
* **Preserving Missingness Signals:** Instead of discarding features with missing values or filling them with average statistics, MuleRadar builds shadow indicator columns (e.g., `F3043_was_missing = 1`) to preserve the absence of activity as a fraud predictor.
* **Context-Aware Imputation:** Uses domain-focused logic like zero-fill for count features (indicating no activity) and group-wise median for ratio features grouped by account type.
* **Distribution Normalization:** Uses log transforms and winsorization to control right-skewed data and extreme outliers.

### 2. Fraud Feature Factory
Custom domain-specific features are engineered to capture the operational lifecycle of a mule:
* **Pass-Through Ratio:** Identifies accounts where digital funds are received and immediately drained as cash.
* **Sudden Activation:** Tracks dormant accounts that suddenly show a high volume of cash withdrawals.
* **Inward Concentration:** Measures the ratio of incoming transactions, highlighting centralized fund routing.
* **Narrow Network Flag:** Flags accounts operating with very few counterparties compared to normal customer interactions.
* **Cash-Network Interaction:** Multiplies high cash activity with narrow networks to isolate specific mule structures.

### 3. Feature Selection Pipeline
To prevent overfitting on high-dimensional data, a multi-stage pipeline shrinks thousands of potential features into the **Final 50** strongest predictors:
1. **Variance Thresholding:** Drops near-constant features.
2. **Correlation Filtering:** Removes collinear features ($r > 0.90$).
3. **XGBoost Gain Importance:** Selects features with the highest prediction accuracy contribution.
4. **SHAP Stability Filtering:** Evaluates SHAP stability over multiple random data splits.

### 4. Hybrid Detection Engine
* **Supervised Ensemble:** Combines **XGBoost**, **LightGBM**, and **CatBoost** to classify known mule behaviors. Employs SMOTE-NC and cost-sensitive loss (`scale_pos_weight`) to handle severe class imbalance (0.89% base rate).
* **Unsupervised Anomaly Detection:** Utilizes **Isolation Forest** and PCA-based anomaly detection to capture new, emerging fraud patterns and novel laundering tactics that have no historical labels.

### 5. Advanced Intelligence Layers
* **Graph Neural Network (GNN):** Identifies coordinated money mule rings, circular fund loops, layering chains, and multi-hop laundering pathways by analyzing accounts and transactions as graph networks.
* **Transaction Sequence Intelligence:** Leverages deep sequence models (LSTM) to evaluate the ordering and temporal transitions of transaction events (e.g., *receive → transfer → cash-out*).
* **Fraud Kill Chain Analysis:** Pinpoints the active fraud stage: *Recruitment → Preparation → Fund Reception → Layering → Cash-Out*.
* **Explainable AI (XAI) & Copilot:** Explains classifications using SHAP values, auto-generating investigation summaries and draft suspicious activity reports (SAR) for compliance investigators.

---

## 📂 Repository Structure

```
BOI-1/
├── README.md                           # Main workspace README (This file)
├── Bank of India (BOI) Hackathon 2026.md # Project documentation & architecture report
│
└── muleradar/                          # Project Root Source Folder
    ├── frontend/                       # React Frontend Application (TailwindCSS & D3 charts)
    │   ├── public/                     # Static assets
    │   ├── src/                        # React components, services, and routing
    │   └── package.json                # Frontend package configurations
    │
    ├── backend/                        # FastAPI Application (REST APIs & services)
    │   ├── app/                        # Main application, routes, and logic
    │   ├── requirements.txt            # Python dependencies
    │   └── Dockerfile                  # Container configurations
    │
    ├── ml_pipeline/                    # ML Modeling and Feature Engineering
    │   ├── data/                       # Dataset placeholder
    │   ├── notebooks/                  # Jupyter notebooks for prototyping
    │   └── src/                        # Feature engineering, selection, and model training
    │
    └── docs/                           # Documentation and Specs
        ├── api_contracts.json          # Swagger/API contracts
        └── hackathon_report.md         # Final report draft and documentation
```

---

## ⚙️ Running the Application

### Backend Setup (FastAPI)
1. Navigate to the backend directory:
   ```bash
   cd muleradar/backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
4. Access the API documentation at `http://localhost:8000/docs`.

### Frontend Setup (React)
1. Navigate to the frontend directory:
   ```bash
   cd muleradar/frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```
4. Access the dashboard at `http://localhost:3000`.

---

## 👥 Team Orange (PICT)
* **Vaibhav Kadam**
* **Rucha Katte**
* **Gargi Joshi**
* **Koyal Kembhavi**
