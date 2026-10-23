from datetime import datetime
from typing import Annotated, Literal
from fastapi import APIRouter, Request, Query, HTTPException
from app.models.schemas import Health, ObservationPage, Country, Summary
from app.services.geolocation import countries

router = APIRouter(prefix='/api')
CountryFilter = Annotated[str | None, Query(pattern='^[A-Z]{2}$')]
Dataset = Literal['pairs', 'timeseries', 'http_locations', 'http_timeseries']


def filtered(request, dataset, start, end, source_country, target_country):
    if any(t is not None and t.tzinfo is None for t in (start, end)):
        raise HTTPException(422, 'Time filters must include a timezone')
    if start and end and start >= end:
        raise HTTPException(422, 'start must precede end')
    rows = request.app.state.database.load(request.app.state.collector.source, dataset)
    return [o for o in rows if (not start or o.windowEnd > start)
            and (not end or o.windowStart < end)
            and (not source_country or o.sourceCountry == source_country)
            and (not target_country or o.targetCountry == target_country)]


@router.get('/health', response_model=Health)
def health(request: Request, dataset: Dataset = 'pairs'):
    return request.app.state.collector.health(dataset)


@router.get('/attacks/history', response_model=ObservationPage)
@router.get('/traffic/history', response_model=ObservationPage)
def history(request: Request, dataset: Dataset | None = None,
            start: datetime | None = None, end: datetime | None = None,
            source_country: CountryFilter = None, target_country: CountryFilter = None,
            limit: int = Query(200, ge=1, le=1000), offset: int = Query(0, ge=0)):
    dataset = dataset or ('http_locations' if '/traffic/' in request.url.path else 'pairs')
    rows = filtered(request, dataset, start, end, source_country, target_country)
    rows.sort(key=lambda o: (o.timestamp, o.id), reverse=True)
    return ObservationPage(status=health(request, dataset), total=len(rows), observations=rows[offset:offset + limit])


@router.get('/attacks/latest', response_model=ObservationPage)
@router.get('/traffic/latest', response_model=ObservationPage)
def get_latest(request: Request, dataset: Dataset | None = None,
               source_country: CountryFilter = None, target_country: CountryFilter = None):
    dataset = dataset or ('http_locations' if '/traffic/' in request.url.path else 'pairs')
    rows = request.app.state.database.latest(request.app.state.collector.source, dataset)
    rows = [o for o in rows if (not source_country or o.sourceCountry == source_country)
            and (not target_country or o.targetCountry == target_country)]
    return ObservationPage(status=health(request, dataset), total=len(rows), observations=rows)


@router.get('/attacks/countries', response_model=list[Country])
def get_countries(request: Request):
    rows = request.app.state.database.latest(request.app.state.collector.source, 'pairs')
    codes = sorted({code for o in rows for code in (o.sourceCountry, o.targetCountry) if code})
    return [Country(**countries().get(code, {'code': code, 'name': None, 'latitude': None, 'longitude': None})) for code in codes]


@router.get('/statistics/summary', response_model=Summary)
def summary(request: Request, source_country: CountryFilter = None, target_country: CountryFilter = None):
    rows = get_latest(request, 'pairs', source_country, target_country).observations

    def rank(field):
        values = {}
        for obs in rows:
            code = getattr(obs, field)
            if code:
                values[code] = values.get(code, 0) + obs.value
        return [{'country': k, 'reportedPairShare': v} for k, v in sorted(values.items(), key=lambda kv: kv[1], reverse=True)]

    return Summary(status=health(request), countriesRepresented=len({c for o in rows for c in (o.sourceCountry, o.targetCountry) if c}),
        pairObservationCount=len(rows), windowStart=rows[0].windowStart if rows else None,
        windowEnd=rows[0].windowEnd if rows else None, metricType=rows[0].metricType if rows else None,
        topSources=rank('sourceCountry'), topTargets=rank('targetCountry'),
        note='Shares cover returned top pairs only, not complete country totals. No absolute request counts are available. Overlapping windows must not be summed.')
