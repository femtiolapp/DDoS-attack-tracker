import asyncio
from datetime import timedelta
import httpx
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.models.database import Database
from app.services.cloudflare import CloudflareClient, RadarError
from app.services.collector import utcnow
from app.services.demo import demo_payloads
from app.services.processor import normalize, PAIR_ENDPOINT


def test_normalization_and_storage(tmp_path):
    now = utcnow()
    data = demo_payloads(now)['pairs']
    data['top_0'][0]['originCountryAlpha2'] = 'XX'
    obs = normalize(data, 'pairs', now)
    assert obs[0].sourceLatitude is None
    assert obs[0].targetLatitude is not None
    assert obs[0].value == 12.5 and obs[0].metricType == 'percentage'
    db = Database(f'sqlite:///{tmp_path}/test.db')
    assert db.save(obs) == 2
    assert db.save(normalize(data, 'pairs', now + timedelta(seconds=60))) == 0
    data['top_0'][0]['value'] = 13
    assert db.save(normalize(data, 'pairs', now)) == 1
    assert len(db.load('cloudflare_radar')) == 2
    assert db.load('demo') == []
    db.engine.dispose()


@pytest.mark.parametrize('mutation', ['normalization', 'nan', 'window', 'arrays'])
def test_reject_malformed_data(mutation):
    data = demo_payloads(utcnow())
    dataset = 'pairs'
    if mutation == 'normalization':
        data['pairs']['meta']['normalization'] = 'RAW_VALUES'
    elif mutation == 'nan':
        data['pairs']['top_0'][0]['value'] = 'NaN'
    elif mutation == 'window':
        data['pairs']['meta']['dateRange'][0]['endTime'] = '2000-01-01T00:00:00Z'
    else:
        dataset = 'timeseries'
        data[dataset]['serie_0']['values'].pop()
    with pytest.raises(ValueError):
        normalize(data[dataset], dataset, utcnow())


def test_relative_series_keep_distinct_normalization_windows():
    now = utcnow()
    a = normalize(demo_payloads(now)['timeseries'], 'timeseries', now)
    b = normalize(demo_payloads(now + timedelta(hours=1))['timeseries'], 'timeseries', now)
    assert a[1].windowStart == b[0].windowStart
    assert a[1].id != b[0].id


@pytest.mark.parametrize('status,body', [(401, {}), (500, {}), (200, {'success': False}), (200, [])])
def test_cloudflare_errors_are_sanitized(status, body):
    async def run():
        client = CloudflareClient(Settings(_env_file=None, cloudflare_api_token='secret'),
            httpx.MockTransport(lambda req: httpx.Response(status, json=body)))
        try:
            with pytest.raises(RadarError) as error:
                await client.fetch(PAIR_ENDPOINT)
            assert 'secret' not in str(error.value)
        finally:
            await client.close()
    asyncio.run(run())


def test_rate_limit_and_query_contract():
    def handler(req):
        assert req.headers['authorization'] == 'Bearer secret'
        assert req.url.params['mitigationProduct'] == 'DDOS'
        assert req.url.params['dateRange'] == '1d'
        return httpx.Response(429, headers={'retry-after': '180'})
    async def run():
        client = CloudflareClient(Settings(_env_file=None, cloudflare_api_token='secret'), httpx.MockTransport(handler))
        try:
            with pytest.raises(RadarError) as error:
                await client.fetch(PAIR_ENDPOINT)
            assert error.value.retry_after == 180
        finally:
            await client.close()
    asyncio.run(run())


def test_routes_and_cache(tmp_path):
    app = create_app(Settings(_env_file=None, demo_mode=True, polling_enabled=False,
                              database_url=f'sqlite:///{tmp_path}/api.db'))
    with TestClient(app) as client:
        assert client.get('/api/attacks/latest').json()['total'] == 0
        client.portal.call(app.state.collector.collect)
        page = client.get('/api/attacks/latest').json()
        assert page['total'] == 2
        assert page['status']['mode'] == 'demo'
        assert page['observations'][0]['dataSource'] == 'demo'
        assert client.get('/api/attacks/latest?source_country=DE').json()['total'] == 1
        assert client.get('/api/attacks/latest?target_country=SE').json()['total'] == 0
        assert client.get('/api/attacks/history?limit=1').json()['total'] == 2
        assert len(client.get('/api/attacks/countries').json()) == 4
        assert client.get('/api/statistics/summary').json()['pairObservationCount'] == 2
        assert client.get('/api/attacks/history?start=2026-01-01T00:00:00').status_code == 422
        assert client.get('/api/attacks/history?limit=0').status_code == 422
        assert client.get('/api/attacks/latest?dataset=timeseries').json()['total'] == 24
        assert client.get('/openapi.json').status_code == 200
        app.state.collector.error = 'Temporary upstream failure'
        assert client.get('/api/health').json()['dataStatus'] == 'cached'
        assert client.get('/api/attacks/latest').json()['total'] == 2


def test_missing_token_does_not_generate_data(tmp_path):
    app = create_app(Settings(_env_file=None, polling_enabled=False,
        database_url=f'sqlite:///{tmp_path}/empty.db'))
    with TestClient(app) as client:
        client.portal.call(app.state.collector.collect)
        assert client.get('/api/health').json()['status'] == 'degraded'
        assert client.get('/api/attacks/latest').json()['total'] == 0


def test_empty_successful_snapshot_replaces_latest(tmp_path):
    app = create_app(Settings(_env_file=None, demo_mode=True, polling_enabled=False,
                              database_url=f'sqlite:///{tmp_path}/snapshots.db'))
    with TestClient(app) as client:
        client.portal.call(app.state.collector.collect)
        assert client.get('/api/attacks/latest').json()['total'] == 2
        app.state.database.save([], {'demo:pairs': {'ids': [], 'collectedAt': utcnow().isoformat()}})
        assert client.get('/api/attacks/latest').json()['total'] == 0
        assert client.get('/api/attacks/history').json()['total'] == 2


def test_failed_collection_retains_cache_and_avoids_partial_writes(tmp_path):
    app = create_app(Settings(_env_file=None, demo_mode=True, polling_enabled=False,
                              database_url=f'sqlite:///{tmp_path}/failure.db'))
    with TestClient(app) as client:
        collector = app.state.collector
        client.portal.call(collector.collect)
        original = client.get('/api/attacks/latest').json()['observations']
        collector.settings.demo_mode = False
        collector.settings.cloudflare_api_token = Settings(_env_file=None, cloudflare_api_token='test').cloudflare_api_token

        async def failing():
            raise RadarError('Cloudflare rate limit reached', 180)

        collector.client.fetch_all = failing
        assert client.portal.call(collector.collect) == 180
        assert client.get('/api/health').json()['dataStatus'] == 'cached'
        assert client.get('/api/attacks/latest').json()['observations'] == original

        async def malformed():
            payloads = demo_payloads(utcnow())
            payloads['pairs']['top_0'][0]['value'] = 99
            payloads['timeseries']['serie_0']['values'].pop()
            return payloads

        collector.client.fetch_all = malformed
        client.portal.call(collector.collect)
        assert client.get('/api/attacks/latest').json()['observations'] == original


def test_http_timeout_is_sanitized():
    def handler(req):
        raise httpx.ReadTimeout('sensitive upstream details', request=req)

    async def run():
        client = CloudflareClient(Settings(_env_file=None), httpx.MockTransport(handler))
        try:
            with pytest.raises(RadarError, match='request failed'):
                await client.fetch(PAIR_ENDPOINT)
        finally:
            await client.close()

    asyncio.run(run())


def test_general_http_country_normalization_and_isolation(tmp_path):
    payload = demo_payloads(utcnow())['http_locations']
    rows = normalize(payload, 'http_locations', utcnow())
    assert rows[0].sourceCountry == 'US'
    assert rows[0].targetCountry is None and rows[0].targetLatitude is None
    assert rows[0].value == 22.3 and rows[0].metricType == 'percentage'
    assert rows[0].endpoint == '/radar/http/top/locations'
    app = create_app(Settings(_env_file=None, demo_mode=True, polling_enabled=False,
        database_url=f'sqlite:///{tmp_path}/http.db'))
    with TestClient(app) as client:
        client.portal.call(app.state.collector.collect)
        http = client.get('/api/traffic/latest').json()
        assert http['total'] == 2
        assert all(row['dataset'] == 'http_locations' and row['targetCountry'] is None for row in http['observations'])
        assert client.get('/api/traffic/latest?dataset=http_timeseries').json()['total'] == 24
        assert client.get('/api/traffic/history?source_country=DE').json()['total'] == 1
        assert client.get('/api/attacks/latest').json()['observations'][0]['dataset'] == 'pairs'


def test_general_http_query_excludes_attack_filters():
    from app.services.processor import HTTP_LOCATIONS_ENDPOINT, HTTP_SERIES_ENDPOINT
    def handler(request):
        assert 'mitigationProduct' not in request.url.params
        assert 'botClass' not in request.url.params
        if request.url.path.endswith('/locations'):
            assert 'aggInterval' not in request.url.params
            assert request.url.params['limit'] == '50'
        else:
            assert request.url.params['normalization'] == 'MIN0_MAX'
        return httpx.Response(200, json={'success': True, 'result': {}})
    async def run():
        client = CloudflareClient(Settings(_env_file=None), httpx.MockTransport(handler))
        try:
            await client.fetch(HTTP_LOCATIONS_ENDPOINT)
            await client.fetch(HTTP_SERIES_ENDPOINT)
        finally:
            await client.close()
    asyncio.run(run())
