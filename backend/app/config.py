from pathlib import Path
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Path(__file__).parents[1] / '.env', extra='ignore')
    cloudflare_api_token: SecretStr = SecretStr('')
    demo_mode: bool = False
    database_url: str = 'sqlite:///./radar.db'
    poll_interval_seconds: int = Field(60, ge=60)
    polling_enabled: bool = True
    date_range: str = Field('1d', pattern=r'^([1-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9]|36[0-4])d$')
    top_limit: int = Field(50, ge=1, le=100)
