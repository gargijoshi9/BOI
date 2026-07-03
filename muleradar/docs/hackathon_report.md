# MuleRadar: Hybrid Intelligence for Mule Account Detection & Risk Assessment
**Bank of India (BOI) Hackathon 2026**

---

## 1. Executive Summary
*Provide a concise overview of the MuleRadar system, key technical differentiators, and outcomes.*
- **System Name:** MuleRadar
- **Objective:** Proactive detection, explainable risk assessment, and network-wide tracking of money mule accounts.
- **Key Capabilities:** Behavioral DNA profiling, shadow column imputation, Graph Neural Networks (GNNs) for circle tracing, SHAP explainability, and automated SAR filing pipelines.

---

## 2. Problem Statement & Context
*Define the core challenges of detecting mule accounts.*
- **Base Rate Fallacy:** Imbalanced datasets (e.g., < 1% actual fraud rate).
- **Concept Drift:** Syndicates continuously adapting routing strategies (e.g., smurfing, layering).
- **Explainability vs. Enforcement:** Ensuring freeze actions are mathematically sound and compliant.
- **Siloed Systems:** Disconnection between transaction anomaly filters and regulatory FIU-IND reporting.

---

## 3. Solution Architecture
*Detail how data flows through the MuleRadar ecosystem.*
```
[Raw Bank Data & Feeds] ──> [Data Refinement & Shadowing] ──> [Feature Factory]
                                                                  │
┌───────────────────────────────┬─────────────────────────────────┘
▼                               ▼                                 ▼
[Supervised Ensemble]     [Anomaly Detectors]             [Graph Neural Network]
(XGBoost, CatBoost)       (Isolation Forest)              (Ring Connection Paths)
└───────────────────────────────┼─────────────────────────────────┘
                                ▼
                      [Sequence LSTM Engine]
                                │
                                ▼
                    [Real-Time Risk Scorer] ──> [AI Copilot / SHAP XAI]
```

---

## 4. Methodology & Implementation

### 4.1. Behavioral DNA Engineering
- Statistical distribution characteristics of transactions (mean, skewness, kurtosis).
- Transaction sequence mapping.

### 4.2. Intelligent Data Refinement Engine
- **Shadow Columns:** Mapping missingness flags to identify absence of standard transactional indicators.
- **Smart Imputation:** Group-wise median scaling, target-encoded categories (occupation, account type), and winsorization.

### 4.3. Domain-Driven Feature Factory
- **Pass-through Ratio:** Monitoring instant transfer loops.
- **Concentration Metrics:** Network inflow fan-ins.

### 4.4. Hybrid Detection Engine
- Ensemble classification models (XGBoost, CatBoost, LightGBM).
- Unsupervised outlier scoring (Isolation Forest, robust PCA).

### 4.5. Graph Ring Network (GNN)
- Visualizing entities as nodes and transactions as edges.
- Identifying multi-hop money laundering loops and layering rings.

---

## 5. Explainability (XAI) & Compliance Console
- **SHAP Feature Attribution:** Explaining model scores per account.
- **Automated SAR Generation:** Converting model attribution metrics to human-readable summaries for regulator filing (FIU-IND).

---

## 6. Business Value & Performance Metrics
*Key performance indicator expectations.*
- **Precision Rate:** target > 95%.
- **Detection Lag:** Real-time processing under 150ms per transaction.
- **Regulatory Savings:** Minimizing manual compliance audit times by > 60%.

---

## 7. Next Steps & Future Scope
- Integration with live RTGS/NEFT/UPI interfaces.
- Enhancing node schemas for cross-channel entity resolution.
