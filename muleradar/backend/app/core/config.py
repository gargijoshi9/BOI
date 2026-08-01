"""
Centralized application configuration using pydantic-settings.

Replaces scattered os.getenv() calls across main.py and the ad hoc
dotenv load in copilot.py with a single typed, validated settings
object. Import get_settings() wherever a config value is needed -
it's cached (lru_cache) so the .env file is only parsed once per
process, not on every call.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# core/ -> app/ -> backend/ -> muleradar/ (the root that holds .env)
_MULERADAR_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_ENV_FILE_PATH = _MULERADAR_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE_PATH),
        env_file_encoding="utf-8",
        extra="ignore",  # tolerate unrelated env vars (e.g. shell noise) without crashing
        populate_by_name=True,
    )

    # ------------------------------------------------------------------
    # Security
    # ------------------------------------------------------------------
    API_KEY: str = ""
    """
    Shared secret for the X-API-Key header on protected endpoints.
    Empty string means the API key gate runs as a no-op (see
    main.py's verify_api_key dependency) - intended for local dev
    only. Set a real value before any demo/deployment reachable
    outside localhost.
    """

    ALLOWED_ORIGINS_RAW: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="ALLOWED_ORIGINS",
    )
    """Comma-separated origin list, read from the ALLOWED_ORIGINS env
    var (same name used in yesterday's testing). Use the
    `allowed_origins` property below to get the parsed List[str] form
    instead of reading this field directly."""

    @property
    def allowed_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS_RAW.split(",") if o.strip()]

    # ------------------------------------------------------------------
    # GenAI Copilot
    # ------------------------------------------------------------------
    OPENAI_API_KEY: str = ""
    """Empty/placeholder values are treated as "no key" by AIInvestigator's
    existing fallback check - that logic stays in copilot.py, this field
    just centralizes where the raw value comes from."""

    # ------------------------------------------------------------------
    # ML Pipeline
    # ------------------------------------------------------------------
    DATASET_PATH: str = "../ml_pipeline/data/boi_dataset.csv"
    SAVED_MODELS_DIR: str = "../ml_pipeline/saved_models"

    # ------------------------------------------------------------------
    # Performance / caching (Day 3)
    # ------------------------------------------------------------------
    CACHE_TTL_SECONDS: int = 300
    """How long an evaluate_account() result is cached in-memory before
    being recomputed. Keeps repeated lookups during a demo fast without
    serving stale data indefinitely."""

    CACHE_MAX_ENTRIES: int = 500
    """Simple cap on the in-memory cache size, to avoid unbounded growth
    during a long-running demo session with many distinct accounts."""

    # ------------------------------------------------------------------
    # Server
    # ------------------------------------------------------------------
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    @field_validator("API_KEY", "OPENAI_API_KEY", mode="before")
    @classmethod
    def _strip_whitespace(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached Settings instance. FastAPI's dependency-injection
    pattern favors a function like this over a bare module-level
    singleton, since it makes overriding settings in tests trivial
    (app.dependency_overrides[get_settings] = lambda: Settings(...)).
    """
    return Settings()