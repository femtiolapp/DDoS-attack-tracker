from functools import lru_cache
import json
from pathlib import Path


@lru_cache(maxsize=1)
def countries():
    # Maintained upstream dataset, vendored for offline and reproducible startup.
    result = {}
    path = Path(__file__).parents[1] / 'data' / 'countries.json'
    for item in json.loads(path.read_text(encoding='utf-8')):
        code = item.get('cca2')
        coords = item.get('latlng', [])
        if code and len(coords) == 2:
            result[code.upper()] = {'code': code.upper(), 'name': item['name']['common'],
                'latitude': coords[0], 'longitude': coords[1]}
    return result


def coordinates(code):
    item = countries().get(code or '', {})
    return item.get('latitude'), item.get('longitude')
