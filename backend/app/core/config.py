"""Application configuration loaded from environment variables."""

from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    app_name: str = "Rekonsiliasi Data Pelanggan"
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = True
    allowed_origins: list[str] | str = ["http://localhost:5173", "http://localhost:80"]

    # ---- Database ----
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "rekonsiliasi"
    postgres_user: str = "rekon_user"
    postgres_password: str = "changeme"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ---- Redis ----
    redis_url: str = "redis://redis:6379/0"

    # ---- RabbitMQ / Celery ----
    celery_broker_url: str = "amqp://guest:guest@rabbitmq:5672//"
    celery_result_backend: str = "redis://redis:6379/1"

    # ---- Keycloak / OIDC ----
    keycloak_url: str = "http://keycloak:8080"
    keycloak_realm: str = "rekonsiliasi"
    keycloak_client_id: str = "rekonsiliasi-frontend"
    keycloak_client_secret: str = "changeme"
    oidc_issuer_url: str = "http://keycloak:8080/realms/rekonsiliasi"
    oidc_jwks_url: str = "http://keycloak:8080/realms/rekonsiliasi/protocol/openid-connect/certs"

    # ---- Encryption ----
    encryption_key: str = "changeme"
    blind_index_key: str = "changeme"

    # ---- Business Rules ----
    max_upload_size_mb: int = 200
    idpel_length: int = 12
    default_match_tolerance_meters: float = 5.0
    max_candidates_per_kosong: int = 10
    audit_log_retention_months: int = 6

    # ---- File Storage ----
    upload_dir: Path = Path("/app/uploads")

    # ---- Logging ----
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "json"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                try:
                    import json

                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("upload_dir", mode="before")
    @classmethod
    def ensure_path(cls, v: str | Path) -> Path:
        return Path(v)


settings = Settings()
