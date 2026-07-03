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
