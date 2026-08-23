from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as api_router
from app.services.analyzer import mule_analyzer

app = FastAPI(
    title="MuleRadar Anti-Money Laundering API",
    description="Real-time AML detection system utilizing stacked Gradient Boosted Trees and Isolation Forests.",
    version="2.0.0"
)

# CORS setup for the React frontend (usually runs on 5173 or 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the endpoints
app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("MuleRadar Backend Starting")
    print(f"ML Engine Status: {mule_analyzer.engine_status}")
    print("=" * 60)

@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "ml_engine": mule_analyzer.engine_status
    }