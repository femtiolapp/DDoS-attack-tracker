"""Run with python -m app.inspect_live; prints only safe dataset diagnostics."""
import asyncio
import json
import sys
from app.config import Settings
from app.services.cloudflare import CloudflareClient, RadarError
from app.services.collector import utcnow
from app.services.processor import normalize
from app.models.database import Database


async def main():
    settings = Settings()
    client = CloudflareClient(settings)
    try:
        payloads = await client.fetch_all()
        all_observations = []
        now = utcnow()
        for dataset, payload in payloads.items():
            observations = normalize(payload, dataset, now)
            all_observations.extend(observations)
            print(json.dumps({'dataset': dataset, 'observations': len(observations),
                'meta': payload['meta'], 'sampleFields': list(payload['top_0'][0]) if payload.get('top_0') else list(payload.get('serie_0', {}))}))
        if '--store' in sys.argv:
            database = Database(settings.database_url)
            snapshots = {f'cloudflare_radar:{dataset}': {
                'ids': [obs.id for obs in all_observations if obs.dataset == dataset],
                'collectedAt': now.isoformat(), 'meta': payload['meta']}
                for dataset, payload in payloads.items()}
            print(json.dumps({'changedObservations': database.save(all_observations, snapshots)}))
            database.engine.dispose()
    except RadarError as exc:
        print(json.dumps({'error': str(exc)}))
        raise SystemExit(1)
    finally:
        await client.close()


if __name__ == '__main__':
    asyncio.run(main())
