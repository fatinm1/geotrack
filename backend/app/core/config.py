"""
Application configuration from environment variables.
"""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://geotrack:geotrack@localhost:5432/geotrack"
    redis_url: str = "redis://localhost:6379/0"

    # When running behind a process supervisor (e.g. Railway start.sh), migrations
    # are executed outside the app process to avoid double-runs.
    run_migrations_in_app: bool = True

    opensky_username: Optional[str] = None
    opensky_password: Optional[str] = None
    opensky_poll_seconds: int = 5

    mdchart_feed_url: Optional[str] = None

    detections_enabled: bool = False
    detection_interval_seconds: int = 20
    use_mock_detector: bool = True
    use_mock_opensky: bool = True


settings = Settings()
