import hashlib
import json
from datetime import timedelta
from app.models.schemas import Observation, PairResult, SeriesResult, HTTPLocationResult
from app.services.geolocation import coordinates

PAIR_ENDPOINT = '/radar/attacks/layer7/top/attacks'
SERIES_ENDPOINT = '/radar/attacks/layer7/timeseries'
HTTP_LOCATIONS_ENDPOINT = '/radar/http/top/locations'
HTTP_SERIES_ENDPOINT = '/radar/http/timeseries'
ENDPOINTS = {'pairs': PAIR_ENDPOINT, 'timeseries': SERIES_ENDPOINT,
             'http_locations': HTTP_LOCATIONS_ENDPOINT, 'http_timeseries': HTTP_SERIES_ENDPOINT}


def normalize(payload, dataset, collected_at, source='cloudflare_radar'):
    if dataset not in ENDPOINTS:
        raise ValueError('Unsupported dataset')
    model = {'pairs': PairResult, 'http_locations': HTTPLocationResult}.get(dataset, SeriesResult)
    result = model.model_validate(payload)
    meta = result.meta
    window = meta.dateRange[0]
    if dataset in ('pairs', 'http_locations') and meta.normalization != 'PERCENTAGE':
        raise ValueError('Unexpected pair normalization')
    output = []

    def add(value, start, end, origin=None, target=None):
        if start < window.startTime or end > window.endTime or end <= start:
            raise ValueError('Observation outside measurement window')
        slat, slon = coordinates(origin)
        tlat, tlon = coordinates(target)
        # Relative series are keyed by their full normalization window: values from
        # differently normalized windows must never overwrite one another.
        identity = [source, dataset, origin, target, start.isoformat(), end.isoformat(),
                    window.startTime.isoformat(), window.endTime.isoformat(), meta.normalization]
        output.append(Observation(id=hashlib.sha256(json.dumps(identity).encode()).hexdigest(),
            sourceCountry=origin, targetCountry=target, sourceLatitude=slat, sourceLongitude=slon,
            targetLatitude=tlat, targetLongitude=tlon, timestamp=end, windowStart=start, windowEnd=end,
            collectedAt=collected_at, upstreamUpdatedAt=meta.lastUpdated, value=value,
            metricType='percentage' if meta.normalization == 'PERCENTAGE' else meta.normalization.lower(),
            dataSource=source, dataset=dataset, endpoint=ENDPOINTS[dataset],
            metadata=meta.model_dump(mode='json')))

    if dataset == 'pairs':
        for row in result.top_0:
            add(row.value, window.startTime, window.endTime,
                row.originCountryAlpha2.upper() if row.originCountryAlpha2 else None,
                row.targetCountryAlpha2.upper() if row.targetCountryAlpha2 else None)
    elif dataset == 'http_locations':
        for row in result.top_0:
            add(row.value, window.startTime, window.endTime,
                row.clientCountryAlpha2.upper() if row.clientCountryAlpha2 else None)
    else:
        intervals = {'FIFTEEN_MINUTES': 900, 'ONE_HOUR': 3600, 'ONE_DAY': 86400,
                     '15m': 900, '1h': 3600, '1d': 86400}
        seconds = intervals.get(meta.aggInterval)
        if seconds is None:
            raise ValueError('Unsupported aggregation interval')
        for timestamp, value in zip(result.serie_0.timestamps, result.serie_0.values):
            if value is not None:
                add(value, timestamp, min(timestamp + timedelta(seconds=seconds), window.endTime))
    return output
