# Global DDoS Monitor

FastAPI backend for periodically collected, aggregated Cloudflare Radar Layer 7
DDoS statistics, with a React/Three.js geographic dashboard. The frontend refreshes
through REST every 60 seconds; WebSocket streaming remains a future stage.

## Frontend

The **Traffic type** selector switches between DDoS activity and **General HTTP
traffic**. HTTP mode includes normal traffic from humans and bots observed by
Cloudflare. It displays reported client-country shares, country markers, and a
global normalized HTTP trend. No destination geography or country-pair arcs are
available for this dataset. This does not represent all Internet traffic or raw
request counts. Country rankings are limited by `TOP_LIMIT` (50 by default).

The backend polls and stores HTTP datasets separately from DDoS observations:
`/radar/http/top/locations` and `/radar/http/timeseries`. No mitigation-product or
bot-class filter is applied to these HTTP requests. Both endpoints were validated
with authenticated live responses (50 countries and 24 hourly trend buckets).
The HTTP REST endpoints are `/api/traffic/latest` and `/api/traffic/history`, with
`dataset=http_locations|http_timeseries`, existing time filters, and
`source_country` for client country. HTTP rows have null target fields. All four
datasets validate before a transactional collection save; failed collections
retain previous observations. Restart the backend to load these changes.

Official endpoint references:
[HTTP geography](https://developers.cloudflare.com/api/typescript/resources/radar/subresources/http/subresources/locations/methods/get/),
[HTTP trends](https://developers.cloudflare.com/api/resources/radar/subresources/http/methods/timeseries/).

Start the backend using the instructions below. In a second terminal, install
Node.js **22.12+**, then on Windows or Linux:

```text
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the backend on port 8000, keeping
the Cloudflare token server-side. The frontend shows actual backend responses;
there is no automatic simulated-data fallback. To use the backend's isolated demo
dataset, set `DEMO_MODE=true` in backend/.env and restart the backend.

This workspace also has an ignored portable Node 22 runtime in `.tools`, so its
installed frontend can be started without replacing the system's Node 18:

```powershell
.\frontend\dev.ps1
```

If PowerShell's script policy prevents launching it, use:
`powershell -ExecutionPolicy Bypass -File .\frontend\dev.ps1`.
For npm commands with the portable runtime, first prepend its directory to the
current shell's PATH (this does not change the system installation):

```powershell
$env:Path = 'C:\Skola\DDosTracker\.tools\node-v22.23.4-win-x64;' + $env:Path
cd frontend
npm test
npm run build
```

Frontend features include a textured Earth, Natural Earth country outlines,
instanced markers, curved animated arcs, mouse rotation/zoom, pause/reset/toggles,
country and minimum-share filters, historical window selection, relative trend
charts, country rankings, observation details, pagination and JSON export.
Marker selection and country rankings filter the displayed geography. The trend
chart remains global and explicitly labels country-filter limitations.

History uses observations already stored by the backend. Each chart/globe shows
one published measurement window; overlapping snapshots are never summed. History
requests are bounded to the newest 1,000 rows per dataset and display a truncation
notice. Missing coordinates stay in the table and are omitted from geographic
geometry. Reduced-motion preferences pause animations initially; keyboard users
can explore equivalent data through filters, rankings and observation details.

The globe is loaded separately from the dashboard. Its Three.js bundle remains
large (the production build reports a chunk-size advisory). Markers are instanced,
borders are batched and arc rendering is capped at 100 displayed relationships.

For production, serve `frontend/dist` after `npm run build` and reverse-proxy `/api`
to FastAPI. Vite's proxy is development-only. `VITE_API_BASE_URL` can override the
API origin at build time; a separate origin also requires appropriate server CORS
configuration. Never put a Cloudflare token in a `VITE_` variable.

Browser tests require both local servers and Chromium:

```text
npx playwright install chromium
npm run test:e2e
```

Six unit tests cover aggregation/window identity, gaps, filtering and geometry.
Four Chromium tests cover real cached API data and WebGL rendering, demo labels,
filters, detail dialogs, export, controls, mobile empty states, historical windows,
and retaining the displayed data after an API interruption. Simulated browser
fixtures are confined to frontend/tests. Desktop and phone screenshots are
generated under the ignored frontend/test-results directory.

## Windows (PowerShell)

Install Python 3.12+, then:

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env: set CLOUDFLARE_API_TOKEN or explicitly set DEMO_MODE=true
.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Linux

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
# Edit .env before starting
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for API documentation. Use one worker to avoid
duplicate collectors. Configuration comes from backend/.env or environment
variables. Start from backend: the database path is relative to the working
directory. Collection starts in the background, so initial responses may be empty.
Demo is opt-in, deterministic, labeled in responses, and isolated from real rows.
Missing credentials never automatically enable demo mode.

Tests, from backend:

```powershell
.venv\Scripts\python -m pytest -q
```

Linux: `.venv/bin/python -m pytest -q`.

## API

- `/api/health`: mode, collection status, sanitized error and last success.
- `/api/attacks/latest`: latest complete window, `dataset=pairs|timeseries`,
  optional `source_country=DE` and `target_country=US`.
- `/api/attacks/history`: same dataset/country filters; timezone-aware `start`
  and `end` select overlapping intervals; `limit` (1–1000) and `offset` paginate.
- `/api/attacks/countries`: countries in the latest pair snapshot.
- `/api/statistics/summary`: latest pair snapshot with optional country filters;
  rankings sum returned pair shares only and are not complete country totals.

Every observation retains measurement window, collection time, upstream update,
endpoint, original normalization and units. Unknown geography has null coordinates.
Coordinates use a vendored snapshot of the maintained mledoze/countries dataset
(ODbL license and provenance are in backend/app/data). They are representative
country points, never precise attack locations.
No percentages or relative values are converted to request counts. History
contains overlapping windows: never sum them. MIN0_MAX trends are comparable
within their original normalization window only.

## Upstream review — 2026-10-23

- [Authentication](https://developers.cloudflare.com/radar/get-started/first-request/):
  token with Account → Radar → Read, stored only in backend configuration.
- [Pairs](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/top/methods/attacks/):
  `/radar/attacks/layer7/top/attacks` returns `top_0`, country codes/names and
  percentage `value`. Targets represent zone billing geography.
- [Series](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/methods/timeseries/):
  `/radar/attacks/layer7/timeseries` returns `serie_0.timestamps` and `values`.
- [Other available methods](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/):
  top origin/target locations, dimension summaries and grouped series. Stage 1
  collects pairs and trends; separate country-wide rankings remain an extension.
- [Geography limitations](https://developers.cloudflare.com/radar/investigate/application-layer-attacks/):
  data describes published Cloudflare aggregates, not all Internet attacks or IPs.
- [Aggregation](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/):
  bucket frequency differs from polling frequency. No publication latency promise
  is assumed; upstream `lastUpdated` is retained separately from collection time.
- [Rate limits](https://developers.cloudflare.com/fundamentals/api/reference/limits/):
  global user/account-token limit 1,200 requests/5 minutes; IP limit 200/second.
  Other consumers share quotas. HTTP 429 respects Retry-After (300s fallback).

Requests use `dateRange=1d`, `format=JSON`, `mitigationProduct=DDOS`, pair `limit=50`,
series `aggInterval=1h&normalization=MIN0_MAX`. Day ranges up to 364d are documented;
longer ranges may need coarser buckets, so keep the MVP at 1d. Explicit upstream
times are aligned to 15-minute boundaries. Returned metadata defines the actual
window. Polling every 60 seconds does not imply new data every minute.

## Storage and scope

SQLAlchemy ORM records index source/dataset/time and countries/time. JSON preserves
full metric metadata. Stable keys include geography, bucket and parent window:
identical polls are idempotent, changed values update existing rows. Revisions
replace previous values; a full revision audit trail is not implemented. Entire
collections validate before transactional storage. PostgreSQL needs a driver and
schema migrations. History currently loads dataset rows in memory; SQL pagination
and retention policies are future scaling work. `app/ml` has a future interface;
no model is trained.

Live authenticated response inspection requires a token. Tests use simulated
contract fixtures and HTTPX transports; they do not verify live account access.
After configuring a token, check health and latest observations for successful
`cloudflare_radar` collection before Stage 2. Local tests can also run on Python
3.11, but deployment targets Python 3.12+.

Authenticated smoke validation on 2026-10-23 succeeded for both endpoints:
50 pairs (PERCENTAGE) and 22 available hourly trend points (MIN0_MAX). The returned
window was 2026-10-22 12:00Z through 2026-10-23 12:00Z; upstream lastUpdated was
2026-10-23 10:30Z. Missing/unpublished buckets are not fabricated. Repeat safely
with `.venv\Scripts\python -m app.inspect_live --store` (Linux: use .venv/bin/python).
The inspector prints metadata and field names, never credentials. Live data was
persisted to SQLite, then all five REST endpoints returned HTTP 200; latest served
50 stored pairs. Tests include malformed data, unavailable geography, revisions,
window identity, demo isolation, filters, rate limits, timeouts, transactional
validation and cached fallback. Windows sandbox temporary-directory restrictions
required running pytest outside the sandbox. One upstream TestClient HTTPX
deprecation warning remains; it does not affect the application endpoints.
