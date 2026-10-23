from datetime import timedelta


def demo_payloads(now):
    end = now.replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=1)
    meta = {'dateRange': [{'startTime': start.isoformat(), 'endTime': end.isoformat()}],
            'lastUpdated': end.isoformat(), 'normalization': 'PERCENTAGE',
            'units': [{'name': '*', 'value': 'requests'}], 'simulated': True}
    payloads = {'pairs': {'meta': meta, 'top_0': [
        {'originCountryAlpha2': 'DE', 'targetCountryAlpha2': 'US', 'value': '12.5'},
        {'originCountryAlpha2': 'BR', 'targetCountryAlpha2': 'GB', 'value': '8.2'}]},
        'timeseries': {'meta': {**meta, 'normalization': 'MIN0_MAX', 'aggInterval': 'ONE_HOUR'},
            'serie_0': {'timestamps': [(start + timedelta(hours=i)).isoformat() for i in range(24)],
                        'values': [str(20 + (i * 7) % 80) for i in range(24)]}}}
    payloads['http_locations'] = {'meta': meta, 'top_0': [
        {'clientCountryAlpha2': 'US', 'clientCountryName': 'United States', 'value': '22.3'},
        {'clientCountryAlpha2': 'DE', 'clientCountryName': 'Germany', 'value': '8.6'}]}
    payloads['http_timeseries'] = payloads['timeseries']
    return payloads
