import httpx
from app.services.processor import PAIR_ENDPOINT, SERIES_ENDPOINT, HTTP_LOCATIONS_ENDPOINT, ENDPOINTS


class RadarError(Exception):
    def __init__(self, message, retry_after=60):
        super().__init__(message)
        self.retry_after = retry_after


class CloudflareClient:
    def __init__(self, settings, transport=None):
        self.settings = settings
        self.client = httpx.AsyncClient(base_url='https://api.cloudflare.com/client/v4',
            timeout=httpx.Timeout(20), transport=transport,
            headers={'Authorization': f'Bearer {settings.cloudflare_api_token.get_secret_value()}'})

    async def fetch(self, endpoint):
        params = {'dateRange': self.settings.date_range, 'format': 'JSON'}
        if endpoint.startswith('/radar/attacks/'):
            params['mitigationProduct'] = 'DDOS'
        if endpoint in (PAIR_ENDPOINT, HTTP_LOCATIONS_ENDPOINT):
            params.update(limit=self.settings.top_limit)
        else:
            params.update(aggInterval='1h', normalization='MIN0_MAX')
        try:
            response = await self.client.get(endpoint, params=params)
            if response.status_code == 429:
                try:
                    delay = max(60, float(response.headers.get('retry-after', '300')))
                except ValueError:
                    delay = 300
                raise RadarError('Cloudflare rate limit reached', delay)
            if response.status_code != 200:
                raise RadarError(f'Cloudflare HTTP {response.status_code}')
            body = response.json()
            if not isinstance(body, dict) or body.get('success') is not True or body.get('errors'):
                raise RadarError('Cloudflare returned an unsuccessful response')
            if not isinstance(body.get('result'), dict):
                raise RadarError('Cloudflare response has no result object')
            return body['result']
        except (httpx.HTTPError, ValueError) as exc:
            # Never expose upstream bodies, request headers, or token-bearing exceptions.
            raise RadarError('Cloudflare request failed or returned invalid JSON') from exc

    async def fetch_all(self):
        return {dataset: await self.fetch(endpoint) for dataset, endpoint in ENDPOINTS.items()}

    async def close(self):
        await self.client.aclose()
