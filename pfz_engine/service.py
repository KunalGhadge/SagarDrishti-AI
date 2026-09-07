"""
FastAPI Microservice for SagarDrishti AI Scientific PFZ Engine v2.

Endpoints:
- POST /analyze : Execute full scientific PFZ feature co-occurrence pipeline
- GET /health   : Service and Copernicus dataset health check
- GET /version  : Scientific engine metadata and literature citations
"""

import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

try:
    from .models import AnalyzeRequest, AnalyzeResponse
    from .engine import ScientificPfzEngine
    from . import __version__, __engine_id__
except (ImportError, ValueError):
    from models import AnalyzeRequest, AnalyzeResponse
    from engine import ScientificPfzEngine
    try:
        from __init__ import __version__, __engine_id__
    except (ImportError, ValueError):
        try:
            from pfz_engine import __version__, __engine_id__
        except (ImportError, ValueError):
            __version__ = "2.0.0"
            __engine_id__ = "pfz-v2"

app = FastAPI(
    title="SagarDrishti AI Scientific PFZ Engine",
    version=__version__,
    description="Research-backed Ocean Feature Co-occurrence Potential Fishing Zone Engine (Sarangi 2024 & Jishad 2021)"
)

# CORS middleware for Next.js frontend communication
# Configured via FRONTEND_URL or CORS_ORIGINS env vars, with safe local defaults
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

frontend_env = os.environ.get("FRONTEND_URL") or os.environ.get("CORS_ORIGINS", "")
if frontend_env.strip() == "*":
    # Wildcard origin with credentials disabled per CORS spec
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    allowed_origins = list(default_origins)
    if frontend_env:
        for origin in frontend_env.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned and cleaned not in allowed_origins:
                allowed_origins.append(cleaned)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

engine = ScientificPfzEngine()


@app.get("/health")
def health_check():
    """
    Health check verifying service status and local data cache readiness.
    Strictly avoids exposing passwords, tokens, or credentials.
    """
    cache_exists = os.path.exists(engine.data_cache_dir)
    nc_files_count = len(os.listdir(engine.data_cache_dir)) if cache_exists else 0

    return {
        "status": "healthy",
        "engine_version": __engine_id__,
        "dataset_cache_ready": cache_exists and nc_files_count > 0,
        "cached_data_files": nc_files_count,
        "service_timestamp_utc": os.environ.get("SERVICE_START_TIME", "")
    }


@app.get("/version")
def get_version():
    """
    Returns engine version, release tag, and peer-reviewed literature citations.
    """
    return {
        "engine": __engine_id__,
        "version": __version__,
        "framework": "Ocean Feature Co-occurrence Matrix (C + F + E)",
        "citations": [
            {
                "paper": "Sarangi et al. (2024)",
                "journal": "Environmental Monitoring and Assessment, 196:98",
                "doi": "10.1007/s10661-023-12259-6",
                "contribution": "Bay of Bengal validation, C+F+E framework, CHL > 0.1 mg/m³ threshold"
            },
            {
                "paper": "Jishad et al. (2019/2021)",
                "journal": "Journal of Operational Oceanography, 14(1), 59–70",
                "doi": "10.1080/1755876X.2019.1658566",
                "contribution": "Cloud-resilient tracking, relative wind vectors, Ekman persistence"
            },
            {
                "reference": "INCOIS / MOSDAC Potential Fishing Zone Advisory",
                "contribution": "Operational 40° Ekman-front alignment threshold & mesoscale eddy criteria"
            }
        ],
        "zero_hallucination_rule": "No random forest ML; no synthetic percentage scores; missing SLA data is marked UNKNOWN, never False."
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_pfz(request: AnalyzeRequest):
    """
    Analyzes maritime sector around requested coordinates or port.
    Returns structured scientific candidates and feature evidence.
    """
    # Validate geographic coordinates
    if not (-90.0 <= request.latitude <= 90.0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid latitude {request.latitude}. Must be between -90 and 90."
        )

    if not (-180.0 <= request.longitude <= 180.0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid longitude {request.longitude}. Must be between -180 and 180."
        )

    if request.radius_km <= 0.0 or request.radius_km > 500.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid radius_km {request.radius_km}. Must be between 1 and 500 km."
        )

    try:
        response = engine.analyze(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scientific PFZ calculation error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("service:app", host=host, port=port, reload=False)
