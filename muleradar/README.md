# MuleRadar

MuleRadar is an enterprise-grade, Explainable AI (XAI) powered suspicious money mule account detection platform designed for Bank of India (BOI) Hackathon 2026. 

It combines Behavioral DNA profiling, GNN-based money ring detection, sequence models, and deep explainability to flag, score, and forecast financial crime.

## Project Structure

```
muleradar/
├── frontend/             # React App with TailwindCSS & D3 dashboard
│   ├── public/           # Static html assets
│   ├── src/              # Component architectures, utils, services
│   ├── package.json      # Dependencies (react, tailwindcss, d3)
│   └── tailwind.config.js# Tailwind theme config
│
├── backend/              # FastAPI Application
│   ├── app/              # Backend core, api handlers, schemas, services
│   ├── Dockerfile        # Container setup
│   └── requirements.txt  # FastAPI, Uvicorn, Pydantic
│
├── ml_pipeline/          # ML modeling workspace
│   ├── data/             # Empty data storage folder
│   ├── notebooks/        # Prototyping Jupyter Notebooks
│   ├── src/              # Structured modules (feature factory, refinement, models, etc.)
│   └── saved_models/     # Empty directory for serialization binaries
│
├── docs/                 # Documentation folder
│   ├── api_contracts.json# API specification contracts
│   └── hackathon_report.md# Hackathon architecture report skeleton
```

## Running the Application

### Backend
1. Navigate to `/backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Run the development server: `uvicorn app.main:app --reload --port 8000`

### Frontend
1. Navigate to `/frontend`
2. Install dependencies: `npm install`
3. Run the development server: `npm start`

### ML Pipeline
The dataset (`boi_dataset.csv`) and trained model artifacts (`saved_models/*.pkl`)
are **not** included in this repository - they're excluded via `.gitignore`
due to sensitive bank data. You must set these up locally before the
backend can serve real predictions (it falls back to a labeled simulator
otherwise).

1. Place `boi_dataset.csv` in `ml_pipeline/data/`
2. Navigate to `/ml_pipeline` and install dependencies:
   `pip install -r requirements.txt`
3. Train the model (generates the .pkl files the backend/analyzer needs):
   `cd src/models && python train.py && cd ../..`
4. Verify real inference is active:
   `python -c "from analyzer import MuleRiskAnalyzer; a = MuleRiskAnalyzer(); print(a.engine_status)"`
   Should print `Live Ensemble Model Active`. If it prints
### Docker Compose (Full-Stack Deployment)
1. Copy `.env.example` to `.env`:
   `cp .env.example .env`
2. Start all services (Backend + Frontend):
   `docker compose up --build`
3. Access the services:
   - Backend API & Health check: `http://localhost:8000/health`
   - Frontend Console: `http://localhost:3000`
