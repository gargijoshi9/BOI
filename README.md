# 📡 MuleRadar

> **AI/ML-powered suspicious money mule account detection and investigation platform**
>
> **Bank of India Hackathon 2026 · Team Orange · Pune Institute of Computer Technology**

MuleRadar is an explainable fraud-operations platform designed to identify suspicious mule accounts from banking data, assign an interpretable risk score, surface model evidence, and support human investigation.

The system combines a **React + Vite operations console**, a **FastAPI inference/API layer**, and a dedicated **ML pipeline** containing feature engineering, feature selection, ensemble classification, anomaly detection, SHAP-based explanations, and transaction-network intelligence.

---

## 🧭 What MuleRadar Does

```mermaid
flowchart LR
    A[Banking Dataset] --> B[Data Refinement]
    B --> C[Behavioral Feature Factory]
    C --> D[Feature Selection]
    D --> E[ML Ensemble]
    D --> F[Isolation Forest]
    E --> G[Risk Scoring]
    F --> G
    G --> H[SHAP Explanation]
    G --> I[Network Intelligence]
    G --> J[HITL Routing]
    H --> K[FastAPI]
    I --> K
    J --> K
    K --> L[Fraud Operations Console]
    L --> M[Investigator]
```

### Core workflow

**Account ID → Dataset → Feature preparation → ML ensemble → Risk probability → Risk score → Explanation → Investigation UI**

For example, the backend can evaluate an account such as `14` and return:

- Account metadata
- Model probability
- Risk score
- Risk level
- XGBoost / LightGBM / CatBoost component scores
- Isolation Forest anomaly signal
- Top SHAP contributors
- Network connections
- Human-review routing information

---

# ✨ Key Features

## 1. 🧬 Behavioral Feature Engineering

MuleRadar converts raw banking attributes into behavior-oriented signals intended to capture patterns associated with mule-account activity.

Examples include:

- **Pass-through behavior** — money entering an account and subsequently being moved out.
- **Cash-out behavior** — unusual or concentrated cash withdrawals.
- **Inward concentration** — concentration of incoming funds.
- **Counterparty/network behavior** — unusual interaction patterns.
- **Missingness signals** — preserving the fact that an activity/field is missing instead of blindly treating missingness as meaningless.

These features help transform thousands of raw banking variables into signals that are more useful for fraud detection.

---

## 2. 🎯 Multi-stage Feature Selection & Anti-Leakage Pipeline

### Why the Feature-Selection Pipeline Matters
The BOI dataset presents an extreme statistical challenge: **3,861 usable raw features vs. only 81 confirmed mule accounts** (an imbalanced ~0.89% fraud base rate). With a **47:1 feature-to-positive ratio**, unregularized machine learning models suffer from the curse of dimensionality—readily memorizing the 81 historical accounts with near-perfect training accuracy while failing entirely on unseen fraud patterns in deployment.

A structured multi-stage selection pipeline is critical to:
- **Prevent Overfitting & Memorization**: Filtering out thousands of noisy, uninformative columns so models learn genuine behavioral dynamics rather than idiosyncratic noise.
- **Eliminate Multicollinearity**: Purging redundant variations of transaction counts, time windows, and volume deviations that inflate tree variance and destabilize split importance.
- **Maintain Low Latency & High Explainability**: Pruning the feature space to an optimal subset allows sub-150ms real-time inference and generates clean, high-fidelity SHAP attributions for compliance audits and FIU-IND Suspicious Activity Report (SAR) generation.

```mermaid
flowchart TD
    A["Raw Banking Features (3,861)"] --> B["Drop Post-Investigation Leakage (F3895–F3923)"]
    B --> C["Stage 1: Safe Behavioral Variance & Organic Overlap (~2,000–2,500)"]
    C --> D["Stage 2: Multicollinearity Correlation Filter (|r| > 0.90) (~1,200–1,500)"]
    D --> E["Stage 3: Regularized LightGBM Gain Ranking (Top 80)"]
    E --> F["Stage 4: Deceptive Proxy Purging & Domain Fusion"]
    F --> G["Final Production Feature Set (67 / 50 Core Features)"]
```

### The Four-Stage Selection Funnel

| Stage | Pipeline Step | Criteria & Decision Rules | Feature Count | Impact & Rationale |
|:---:|:---|:---|:---:|:---|
| **Input** | **Raw Usable Space** | Drop post-investigation outcome columns (`F3895`–`F3923`) and non-features (`account_id`, target `F3924`, timestamp `F2230`). | **3,861** | Baseline high-dimensional feature pool. |
| **Stage 1** | **Safe Variance & Organic Overlap** | • Drop columns where missingness discrepancy between normal and mule accounts exceeds 50% (`\|pct_missing_norm - pct_missing_mule\| > 0.50`).<br>• Drop near-constant columns with zero intra-class variance (`nunique <= 1` for normal or mules).<br>• Enforce organic value range overlap (`has_organic_overlap` requiring $\ge 5\%$ range intersection between classes). | **~2,000 – 2,500** | Eliminates uninformative and artificially separable columns with zero loss of genuine predictive signal. |
| **Stage 2** | **Correlation Filtering** | • Compute pairwise Pearson correlation matrix across numeric candidate features.<br>• For feature pairs with absolute correlation $\|r\| > 0.90$, prune the redundant column and preserve the higher signal predictor. | **~1,200 – 1,500** | Removes redundant transaction and volume variants, reducing multicollinearity and noise by 30%–40%. |
| **Stage 3** | **LightGBM Gain Importance** | • Train a regularized LightGBM classifier (`n_estimators=100`, `num_leaves=31`, `min_child_samples=20`, `class_weight='balanced'`) strictly on the isolated feature-selection split.<br>• Filter features with importance gain $> 0.001$ and select the top-ranking candidates. | **Top 80** | Isolates the most potent non-linear, multi-variate predictive signals from tree split gains. |
| **Stage 4** | **Deceptive Proxy Purging & Domain Fusion** | • **Purge 13 deceptive post-event proxy features** (`F3348`, `F1057`, `F1921`, `F3484`, `F3805`, `F1597`, `F3487`, `F2956`, `F2583`, `F2350`, `F3534`, `F2487`, `F3799`) that leak post-freeze/investigation signals.<br>• Fuse surviving top tree features with the **18 bank-mandated domain features** and engineered behavioral signals (pass-through, dormant activation, cash-out). | **67 Final** *(or 50 core operational)* | Yields a mathematically robust, domain-validated, and leakage-free production feature set. |

### Post-Investigation Data Leakage Safeguards & Held-Out Isolation

In fraud detection systems, models often achieve artificially inflated offline scores by inadvertently exploiting signals created *after* fraud has been detected or investigated. MuleRadar enforces strict architectural safeguards:

1. **Strict 3-Way Stratified Data Splitting**:
   - **Step 1 (Hold-Out Test Isolation)**: A **20% hold-out test set** (`df_test_raw`) is carved out immediately before any imputation, filtering, or feature selection takes place. This held-out test partition is strictly quarantined until final benchmark evaluation.
   - **Step 2 (Train Pool Partitioning)**: The remaining 80% training data is subdivided into a dedicated **Feature Selection split** (`df_fs_raw`, 25%) and a **Cross-Validation Tuning split** (`df_cv_raw`, 75%).
   - **Zero Evaluation Leakage**: All variance thresholds, correlation matrices, and LightGBM feature rankings are learned **exclusively on `df_fs_raw`**. Neither the CV tuning folds nor the held-out test split are ever touched during feature selection, completely eliminating selection bias and target leakage.
2. **Explicit Removal of Post-Investigation Outcome Columns**:
   - Fields `F3895` through `F3923` reflect actions taken after an account has been flagged or investigated (e.g., freeze dates, administrative audit remarks, dispute status). These are permanently excluded before training.
3. **Purging Deceptive Post-Event Proxy Features**:
   - 13 specific features exhibited deceptive correlations driven by administrative logging side-effects rather than pre-crime account activity. The pipeline explicitly purges these to prevent shortcut learning.
4. **Account Identifier Isolation**:
   - `account_id` is maintained strictly for investigator UI identity, audit logs, and graph relationship mapping, but is excluded from model feature matrices so trees cannot memorize account IDs.

---

# 🤖 Detection Engine

MuleRadar uses a hybrid supervised + unsupervised architecture.

```mermaid
flowchart TD
    X[Account Features]

    X --> A[XGBoost]
    X --> B[LightGBM]
    X --> C[CatBoost]
    X --> D[Isolation Forest]

    A --> E[Model Component Scores]
    B --> E
    C --> E
    D --> E

    E --> F{Stacking Enabled?}
    F -->|Yes| G[Meta Learner]
    F -->|No| H[Equal-weight Blend]

    G --> I[Final Model Probability]
    H --> I

    I --> J[Risk Score 0–1000]
    J --> K[Risk Level]
    J --> L[HITL Routing]
```

### Supervised models

- **XGBoost**
- **LightGBM**
- **CatBoost**

### Unsupervised signal

- **Isolation Forest**

### Ensemble

The system can combine the base-model probabilities and anomaly signal through a **stacked meta-learner**.

The resulting probability is converted into an investigator-friendly **0–1000 risk score**.

---

# 🚦 Risk Scoring

MuleRadar maps the model probability into four operational risk levels:

| Risk Score | Risk Level | Operational Meaning |
|---:|---|---|
| **0–449** | 🟢 Low | Low-risk / auto-clear range |
| **450–749** | 🟡 Medium | Human review recommended |
| **750–899** | 🟠 High | High-risk account |
| **900–1000** | 🔴 Critical | Highest-risk accounts / auto-block band |

The exact score is produced by the calibrated scoring logic in the backend rather than being a simple display-only probability.

```mermaid
flowchart LR
    P[Model Probability] --> S[Piecewise Risk Scaling]
    S --> L{Risk Level}

    L -->|0–449| A[LOW]
    L -->|450–749| B[MEDIUM]
    L -->|750–899| C[HIGH]
    L -->|900–1000| D[CRITICAL]
```

---

# 🔎 Explainable AI

A prediction should not simply say:

> **"This account is risky."**

MuleRadar also attempts to answer:

> **"Why does the model consider this account risky?"**

The backend uses **SHAP** to identify the most influential model features for an individual account.

```mermaid
flowchart LR
    A[Account] --> B[Trained XGBoost Model]
    B --> C[SHAP TreeExplainer]
    C --> D[Feature Contributions]
    D --> E[Feature Dictionary]
    E --> F[Investigator Explanation]
```

The API can return the strongest feature contributions together with their feature codes, display names, and descriptions when available.

Examples of investigator-facing behavioral explanations can include concepts such as:

- High transaction activity
- Unusual cash-out behavior
- Strong pass-through behavior
- Concentrated incoming funds
- Narrow counterparty activity

> **Note:** The exact explanation shown depends on the features present in the account and the feature dictionary mappings available in the current model/data version.

---

# 👩‍💻 Human-in-the-Loop Investigation

MuleRadar is designed to support investigators rather than blindly automate every decision.

```mermaid
flowchart TD
    A[Risk Score] --> B{Routing}

    B -->|Low| C[Auto Clear]
    B -->|Medium| D[Human Review]
    B -->|High| D
    B -->|Critical| E[Auto Block]

    D --> F[Review Queue]
    F --> G[Confirm Mule]
    F --> H[Clear]
    F --> I[Escalate]

    G --> J[Audit Trail]
    H --> J
    I --> J
```

The backend exposes a review queue and audit-trail functionality so that investigator decisions can be recorded.

---

# 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph UI["Frontend — Fraud Operations Console"]
        A[Dashboard]
        B[Accounts]
        C[Risk Analysis]
        D[Network Graph]
        E[HITL Review Queue]
        F[CSV Validation]
        G[Model Monitoring]
        H[Compliance Audit]
    end

    subgraph API["Backend — FastAPI"]
        I[API Routes]
        J[MuleRiskAnalyzer]
        K[Audit Trail]
        L[Validation]
    end

    subgraph ML["ML Pipeline"]
        M[Data Refinement]
        N[Feature Factory]
        O[Feature Selection]
        P[XGBoost]
        Q[LightGBM]
        R[CatBoost]
        S[Isolation Forest]
        T[SHAP]
        U[Graph Engine]
    end

    subgraph DATA["Artifacts & Data"]
        V[(boi_dataset.csv)]
        W[(mule_pipeline_v2.pkl)]
    end

    A --> I
    B --> I
    C --> I
    D --> I
    E --> I
    F --> I
    G --> I
    H --> I

    I --> J
    I --> K
    I --> L

    J --> W
    J --> V
    J --> T
    J --> U

    V --> M
    M --> N
    N --> O
    O --> P
    O --> Q
    O --> R
    O --> S

    P --> W
    Q --> W
    R --> W
    S --> W
```

---

# 📂 Project Structure

```text
BOI/
│
├── README.md
├── Bank of India (BOI) Hackathon 2026.md
│
└── muleradar/
    │
    ├── Description.xlsx
    ├── frontend/
    │   ├── public/
    │   ├── src/
    │   ├── package.json
    │   └── ...
    │
    ├── backend/
    │   ├── app/
    │   │   ├── api/
    │   │   ├── schemas/
    │   │   └── services/
    │   ├── requirements.txt
    │   └── ...
    │
    ├── ml_pipeline/
    │   ├── data/
    │   │   └── boi_dataset.csv
    │   ├── notebooks/
    │   ├── saved_models/
    │   │   └── mule_pipeline_v2.pkl
    │   └── src/
    │       ├── data_refinement/
    │       ├── explainability/
    │       ├── feature_factory/
    │       ├── graph_engine/
    │       └── models/
    │
    └── docs/
        └── ...
```

---

# 🧰 Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Visualization** | D3.js |
| **API** | FastAPI, Uvicorn |
| **ML** | XGBoost, LightGBM, CatBoost, Scikit-learn |
| **Anomaly Detection** | Isolation Forest |
| **Explainability** | SHAP |
| **Data Processing** | Pandas, NumPy |
| **Model Persistence** | Joblib / `.pkl` artifact |
| **Graph Intelligence** | Python graph-engine layer |
| **Frontend API Client** | Axios |

---

# 🚀 Local Setup

## Prerequisites

Recommended environment:

- Python **3.11**
- Node.js / npm
- Git

---

## 1. Clone the repository

```bash
git clone https://github.com/gargijoshi9/BOI.git
cd BOI/muleradar
```

---

# 🐍 2. Backend Setup

From `muleradar/`:

**macOS / Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..
python3 -m uvicorn backend.app.main:app --reload
```

**Windows (PowerShell):**
```powershell
cd backend
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cd ..
python -m uvicorn backend.app.main:app --reload
```

- Backend API: `http://127.0.0.1:8000`
- Swagger documentation: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

---

# ⚛️ 3. Frontend Setup

Open a **second terminal**. From `muleradar/frontend`:

```bash
cd muleradar/frontend
npm install
npm run dev
```

The frontend development console runs at: `http://localhost:5173`.
The frontend communicates directly with the FastAPI backend running on port `8000`.

---

# 🧠 4. ML Pipeline Setup & Training

To train the machine learning ensemble from scratch:

1. Place `boi_dataset.csv` in `muleradar/ml_pipeline/data/` (or project root).
2. Install ML pipeline dependencies:
   ```bash
   cd muleradar/ml_pipeline
   pip install -r requirements.txt
   ```
3. Execute the training pipeline:
   ```bash
   python src/models/train.py
   ```
4. Verify live inference:
   ```bash
   python -c "from analyzer import MuleRiskAnalyzer; a = MuleRiskAnalyzer(); print(a.engine_status)"
   ```
   *(Prints `Live Ensemble Model Active` when dataset and trained models are detected).*

---

# 🐳 5. Docker Compose (Full-Stack Deployment)

Run both the FastAPI backend and React frontend together in Docker:

1. Configure environment:
   ```bash
   cd muleradar
   cp .env.example .env
   ```
2. Build and start containers:
   ```bash
   docker compose up --build
   ```
3. Access services:
   - Backend API & Health Check: `http://localhost:8000/health`
   - Frontend Console: `http://localhost:3000`

---

# 🔄 System Architecture During Development

```mermaid
flowchart LR
    A[Browser<br/>localhost:5173] -->|REST API| B[FastAPI<br/>127.0.0.1:8000]
    B --> C[MuleRiskAnalyzer]
    C --> D[mule_pipeline_v2.pkl]
    C --> E[boi_dataset.csv]
```

---

# 📡 API Endpoints

The current backend exposes account evaluation, account listing, validation, review-queue, and audit-trail functionality.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Backend + ML engine health |
| `GET` | `/api/v1/accounts` | Retrieve account evaluations |
| `GET` | `/api/v1/evaluate/{account_id}` | Evaluate one account |
| `POST` | `/api/v1/evaluate/{account_id}` | Evaluate one account |
| `POST` | `/api/v1/validate` | Validate/infer on an uploaded CSV |
| `GET` | `/api/v1/review-queue` | Retrieve HITL review queue |
| `POST` | `/api/v1/review-queue/{account_id}/resolve` | Record investigator decision |
| `GET` | `/api/v1/review-queue/audit-trail` | Retrieve audit history |

---

# 🧪 Example Account Evaluation

Request:

```http
GET /api/v1/evaluate/14
```

Conceptual response:

```json
{
  "account_id": "14",
  "account_type": "Savings",
  "occupation": "agriculture",
  "age": 35,
  "model_probability": 0.3558,
  "risk_score": 274,
  "risk_level": "Low",
  "shap_explanation": [
    {
      "feature": "F1596",
      "contribution": -1.109
    }
  ],
  "human_review": {
    "requires_review": false,
    "confidence_band": "AUTO_CLEAR"
  }
}
```

The exact values depend on the current dataset and trained model artifact.

---

# 🧠 Model Training Pipeline

Training is implemented in:

```text
ml_pipeline/src/models/train.py
```

The training workflow includes:

```mermaid
flowchart TD
    A[BOI Dataset] --> B[Dataset Loading]
    B --> C[Account ID Preservation]
    C --> D[Leakage / Post-event Column Removal]
    D --> E[Train / Test Split]

    E --> F[Safe Feature Screening]
    F --> G[Correlation Filtering]
    G --> H[LightGBM Feature Ranking]
    H --> I[Feature Purging]

    I --> J[XGBoost]
    I --> K[LightGBM]
    I --> L[CatBoost]
    I --> M[Isolation Forest]

    J --> N[OOF Predictions]
    K --> N
    L --> N
    M --> N

    N --> O[Meta Learner]
    O --> P[Threshold Calibration]
    P --> Q[Final Model Training]
    Q --> R[mule_pipeline_v2.pkl]
```

The training script also contains:

- Stratified splitting
- Class-imbalance handling
- Hyperparameter tuning with Optuna
- Out-of-fold predictions
- Meta-model selection
- F2-based threshold calibration
- Hold-out evaluation
- Model artifact serialization

---

# 🔐 Data Leakage Prevention

Fraud detection datasets can contain fields that are only known **after** an investigation or account action.

Using those fields during training can create artificially strong performance while failing in real-world deployment.

MuleRadar therefore explicitly:

- Removes post-investigation outcome columns.
- Removes suspicious timestamp/proxy information.
- Preserves `account_id` for dataset/UI identity but excludes it from model features.
- Uses a strict train/test separation.
- Performs feature selection using separate data partitions.

This makes the model pipeline more representative of a real deployment scenario.

---

# 📊 Model Evaluation

The training pipeline evaluates the final model using fraud-detection-oriented metrics including:

- **PR-AUC**
- **ROC-AUC**
- **Precision**
- **Recall**
- **F2-score / operating threshold**
- **Confusion matrix**
- Classification report

For highly imbalanced fraud datasets, PR-AUC and recall/precision trade-offs are especially important because accuracy alone can be misleading.

---

# 🛡️ Investigator Workflow

```mermaid
sequenceDiagram
    actor Investigator
    participant UI as MuleRadar UI
    participant API as FastAPI
    participant ML as ML Engine
    participant DATA as Dataset/Model

    Investigator->>UI: Select Account
    UI->>API: GET /evaluate/{account_id}
    API->>ML: Evaluate account
    ML->>DATA: Load account + model artifact
    DATA-->>ML: Features + trained models
    ML->>ML: Ensemble inference
    ML->>ML: Risk scoring
    ML->>ML: SHAP explanation
    ML->>ML: Network intelligence
    ML-->>API: Risk + evidence
    API-->>UI: Investigation report
    UI-->>Investigator: Score + level + explanation
```

---

# 🧩 Example Investigation Report

An investigator should be able to move from:

```text
ACCOUNT
   ↓
Risk Score
   ↓
Risk Level
   ↓
Why?
   ├── Behavioral evidence
   ├── SHAP contributors
   ├── Model component scores
   └── Network connections
   ↓
Human Review Decision
   ↓
Audit Trail
```

This turns the ML model from a black-box classifier into an **investigation-support system**.

---

# ⚠️ Important Notes

### Model artifact

The backend expects the trained model artifact at:

```text
muleradar/ml_pipeline/saved_models/mule_pipeline_v2.pkl
```

If the artifact is missing, the backend reports that the trained model artifact is unavailable and cannot perform the same real-model account evaluation.

### Dataset

The backend expects:

```text
muleradar/ml_pipeline/data/boi_dataset.csv
```

The dataset must contain the account identity information expected by the current pipeline. The training and backend code can normalize an `Unnamed: 0` column into `account_id` when necessary.

### Secrets

Do **not** commit API keys, credentials, `.env` secrets, or other sensitive configuration to GitHub.

---

# 🧪 Development Checklist

Before a demo:

```text
[ ] Python 3.11 environment active
[ ] Backend dependencies installed
[ ] Frontend dependencies installed
[ ] boi_dataset.csv available
[ ] mule_pipeline_v2.pkl available
[ ] Backend starts successfully
[ ] /health returns online
[ ] /docs opens successfully
[ ] /api/v1/accounts returns accounts
[ ] Known account evaluation works
[ ] Frontend can reach backend
[ ] SHAP explanations are displayed
[ ] Review queue works
[ ] Audit trail works
```

---

# 🏆 Hackathon

**Bank of India Hackathon 2026**

MuleRadar is developed as an AI/ML-driven solution for suspicious money mule account detection, risk assessment, explainability, and investigator-assisted fraud operations.

---

## 📜 License

Add the project's chosen license here before public release.

---

<div align="center">

### 📡 MuleRadar

**Detect suspicious behavior. Explain the risk. Assist the investigator.**

Built with ❤️ by **Team Orange · PICT**

</div>
