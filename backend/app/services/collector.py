import asyncio
from datetime import datetime, timezone
from pydantic import ValidationError
from app.services.cloudflare import CloudflareClient, RadarError
from app.services.demo import demo_payloads
from app.services.processor import normalize


def utcnow():
    return datetime.now(timezone.utc)


class Collector:
    def __init__(self, settings, database):
        self.settings, self.database = settings, database
        self.source = 'demo' if settings.demo_mode else 'cloudflare_radar'
        self.client = CloudflareClient(settings)
        self.last_success = None
        self.error = None
        self.task = None

    async def collect(self):
        if not self.settings.demo_mode and not self.settings.cloudflare_api_token.get_secret_value():
            self.error = 'CLOUDFLARE_API_TOKEN is missing; configure it or explicitly enable DEMO_MODE'
            return self.settings.poll_interval_seconds
        try:
            now = utcnow()
            payloads = demo_payloads(now) if self.settings.demo_mode else await self.client.fetch_all()
            observations = [obs for dataset, payload in payloads.items()
                            for obs in normalize(payload, dataset, now, self.source)]
            # Validate the complete collection before committing either dataset.
            snapshots = {f'{self.source}:{dataset}': {
                'ids': [obs.id for obs in observations if obs.dataset == dataset],
                'collectedAt': now.isoformat(), 'meta': payload['meta']}
                for dataset, payload in payloads.items()}
            await asyncio.to_thread(self.database.save, observations, snapshots)
            self.last_success, self.error = now, None
        except RadarError as exc:
            self.error = str(exc)
            return max(self.settings.poll_interval_seconds, exc.retry_after)
        except (ValidationError, ValueError):
            self.error = 'Cloudflare response validation failed; previous data retained'
        except Exception:
            self.error = 'Collection or storage failed; previous data retained'
        return self.settings.poll_interval_seconds

    async def run(self):
        while True:
            delay = await self.collect()
            await asyncio.sleep(delay)

    def health(self, dataset='pairs'):
        from app.models.schemas import Health
        cached = self.database.latest(self.source, dataset)
        snapshot = self.database.snapshot(self.source, dataset)
        last_success = self.last_success or (datetime.fromisoformat(snapshot['collectedAt']) if snapshot else None)
        fresh = self.last_success and (utcnow() - self.last_success).total_seconds() < self.settings.poll_interval_seconds * 2
        return Health(status='degraded' if self.error else 'ok', mode=self.source,
            dataStatus=('recently_fetched' if fresh and not self.error else 'cached') if cached else 'empty',
            lastSuccessfulUpdate=last_success, error=self.error)
