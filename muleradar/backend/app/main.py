from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="MuleRadar API",
    description="Backend API services for suspicious mule account detection",
    version="1.0.0"
)

# CORS middleware config to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production environments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "MuleRadar Backend API",
        "message": "Welcome to MuleRadar API engine."
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected (mocked)",
        "models_loaded": ["xgb_mule_detector", "gnn_ring_analyser"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
