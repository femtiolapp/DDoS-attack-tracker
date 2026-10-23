from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator


class Window(BaseModel):
    startTime: AwareDatetime
    endTime: AwareDatetime

    @model_validator(mode='after')
    def ordered(self):
        if self.endTime <= self.startTime:
            raise ValueError('Invalid measurement window')
        return self


class Meta(BaseModel):
    model_config = ConfigDict(extra='allow')
    dateRange: list[Window] = Field(min_length=1, max_length=1)
    lastUpdated: AwareDatetime
    normalization: str
    units: list[dict[str, str]]
    aggInterval: str | None = None


class Pair(BaseModel):
    originCountryAlpha2: str | None = None
    targetCountryAlpha2: str | None = None
    originCountryName: str | None = None
    targetCountryName: str | None = None
    value: float = Field(ge=0, le=100, allow_inf_nan=False)


class PairResult(BaseModel):
    meta: Meta
    top_0: list[Pair]


class HTTPLocation(BaseModel):
    clientCountryAlpha2: str | None = None
    clientCountryName: str | None = None
    value: float = Field(ge=0, le=100, allow_inf_nan=False)


class HTTPLocationResult(BaseModel):
    meta: Meta
    top_0: list[HTTPLocation]


class Series(BaseModel):
    timestamps: list[AwareDatetime]
    values: list[float | None]

    @model_validator(mode='after')
    def validate_arrays(self):
        import math
        if len(self.timestamps) != len(self.values):
            raise ValueError('Time series arrays have different lengths')
        if any(v is not None and (not math.isfinite(v) or v < 0) for v in self.values):
            raise ValueError('Invalid time series value')
        if self.timestamps != sorted(set(self.timestamps)):
            raise ValueError('Timestamps must be strictly increasing')
        return self


class SeriesResult(BaseModel):
    meta: Meta
    serie_0: Series


class Observation(BaseModel):
    id: str
    sourceCountry: str | None = None
    targetCountry: str | None = None
    sourceLatitude: float | None = None
    sourceLongitude: float | None = None
    targetLatitude: float | None = None
    targetLongitude: float | None = None
    timestamp: AwareDatetime
    windowStart: AwareDatetime
    windowEnd: AwareDatetime
    collectedAt: AwareDatetime
    upstreamUpdatedAt: AwareDatetime
    value: float = Field(allow_inf_nan=False)
    metricType: str
    dataSource: Literal['cloudflare_radar', 'demo']
    dataset: Literal['pairs', 'timeseries', 'http_locations', 'http_timeseries']
    endpoint: str
    layer: str = 'L7'
    metadata: dict


class Health(BaseModel):
    status: str
    mode: str
    dataStatus: str
    lastSuccessfulUpdate: datetime | None
    error: str | None


class ObservationPage(BaseModel):
    status: Health
    total: int
    observations: list[Observation]


class Country(BaseModel):
    code: str
    name: str | None
    latitude: float | None
    longitude: float | None


class Summary(BaseModel):
    status: Health
    countriesRepresented: int
    pairObservationCount: int
    windowStart: datetime | None
    windowEnd: datetime | None
    metricType: str | None
    topSources: list[dict]
    topTargets: list[dict]
    note: str
