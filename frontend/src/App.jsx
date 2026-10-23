import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ChevronDown,
  CircleHelp,
  Clock3,
  Crosshair,
  ExternalLink,
  Globe2,
  Layers,
  Maximize2,
  Network,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings2,
  Shield,
  SlidersHorizontal,
  X,
} from "lucide-react";
import StatisticsPanel from "./components/StatisticsPanel";
import { ActivityChart, CountryRanking } from "./components/ActivityCharts";
import ObservationTable from "./components/ObservationTable";
import useAttackData from "./hooks/useAttackData";
import {
  chartSeries,
  countryName,
  filterPairs,
  formatTime,
  rankings,
  share,
  windowKey,
  windowsFrom,
} from "./lib/data";

const Globe = lazy(() => import("./components/Globe"));

function Modal({ title, onClose, children }) {
  const dialog = useRef();
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [trafficMode, setTrafficMode] = useState("ddos");
  const httpMode = trafficMode === "http";
  const {
    data,
    error,
    loading,
    refreshing,
    refresh,
    range,
    setRange,
    windowSelection,
    setWindowSelection,
  } = useAttackData(trafficMode);
  const [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [minimum, setMinimum] = useState(0);
  const [paused, setPaused] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [speed, setSpeed] = useState(1),
    [showArcs, setShowArcs] = useState(true),
    [showMarkers, setShowMarkers] = useState(true);
  const [reset, setReset] = useState(0),
    [tab, setTab] = useState("source"),
    [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(""),
    [expanded, setExpanded] = useState(false);
  const pool =
    data?.range === range && data?.trafficMode === trafficMode
      ? range === "latest"
        ? data.pairs
        : data.historyPairs
      : [];
  const windows = useMemo(() => windowsFrom(pool || []), [pool]);
  const activeKey =
    range === "latest"
      ? windows[0]?.key
      : windows.some((w) => w.key === windowSelection)
        ? windowSelection
        : windows[0]?.key;
  const snapshot = useMemo(
    () => (pool || []).filter((row) => windowKey(row) === activeKey),
    [pool, activeKey],
  );
  const observations = useMemo(
    () => filterPairs(snapshot, { source, target, minimum }),
    [snapshot, source, target, minimum],
  );
  const sources = useMemo(
    () => rankings(observations, "sourceCountry"),
    [observations],
  );
  const targets = useMemo(
    () => rankings(observations, "targetCountry"),
    [observations],
  );
  const codes = [
    ...new Set(
      snapshot
        .flatMap((row) => [row.sourceCountry, row.targetCountry])
        .filter(Boolean),
    ),
  ].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const trendPool =
    data?.range === range && data?.trafficMode === trafficMode
      ? range === "latest"
        ? data.series
        : data.historySeries
      : [];
  const trends = useMemo(
    () => chartSeries(trendPool || [], activeKey),
    [trendPool, activeKey],
  );
  const trendMetric = trendPool?.find(
    (row) => windowKey(row) === activeKey,
  )?.metricType;
  const upstream = snapshot[0]?.upstreamUpdatedAt;
  const activeWindow = windows.find((w) => w.key === activeKey);
  const filtersActive = !!source || !!target || minimum > 0;
  const demo = data?.status.mode === "demo";
  useEffect(() => {
    setSource("");
    setTarget("");
    setMinimum(0);
    setTab("source");
    setWindowSelection("");
    setSelected(null);
    setModal("");
  }, [trafficMode]);
  const connection = error
    ? "Connection interrupted"
    : !data
      ? "Connecting to backend"
      : data.status.dataStatus === "empty"
        ? "Awaiting observations"
        : data.status.dataStatus === "cached"
          ? "Cached observations"
          : "Radar connected";

  useEffect(() => {
    setSelected(null);
  }, [activeKey, source, target, minimum]);
  useEffect(() => {
    if (!expanded) return;
    function key(event) {
      if (event.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [expanded]);
  const selectCountry = (marker) => {
    if (marker.role === "source") setSource(marker.country);
    else setTarget(marker.country);
  };
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            description: httpMode
              ? "Cloudflare-observed general HTTP client-country shares, including normal traffic; no destination data"
              : "Aggregated Layer 7 DDoS country-pair shares; not individual attacks or request counts",
            window: activeWindow,
            trafficMode,
            observations,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `radar-${demo ? "demo" : "observations"}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Dashboard navigation">
        <a
          className="brand-mark"
          href="#overview"
          aria-label="Global DDoS Monitor overview"
        >
          <Shield size={23} />
        </a>
        <div className="rail-divider" />
        <a
          href="#overview"
          className="rail-link active"
          title="Overview"
          aria-label="Overview"
        >
          <Globe2 size={21} />
        </a>
        <a
          href="#intelligence"
          className="rail-link"
          title="Activity charts"
          aria-label="Activity charts"
        >
          <Activity size={20} />
        </a>
        <a
          href="#observations"
          className="rail-link"
          title="Observations"
          aria-label="Observations"
        >
          <Network size={20} />
        </a>
        <div className="rail-spacer" />
        <button
          className="rail-link"
          onClick={() => setModal("about")}
          title="About the data"
          aria-label="About the data"
        >
          <CircleHelp size={20} />
        </button>
        <button
          className="rail-link"
          onClick={() => setModal("settings")}
          title="Display settings"
          aria-label="Display settings"
        >
          <Settings2 size={20} />
        </button>
        <div className="rail-avatar">CF</div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a href="#overview" className="wordmark">
            <Shield size={20} />
            <span>
              Global DDoS <strong>Monitor</strong>
            </span>
            <span className="version">RADAR / L7</span>
          </a>
          <div className="topbar-right">
            <span
              className={`connection ${error ? "warning" : ""}`}
              role="status"
            >
              <i />
              {connection}
            </span>
            <button
              className="icon-button"
              onClick={() => setModal("settings")}
              aria-label="Open settings"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <main id="overview">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-dot" />
                GLOBAL THREAT INTELLIGENCE
              </div>
              <h1>
                A global perspective.
                <br className="mobile-break" /> A clearer signal.
              </h1>
              <p>
                {httpMode
                  ? "Explore general HTTP traffic observed by Cloudflare."
                  : "Explore published DDoS activity across the Cloudflare network."}
              </p>
            </div>
            <div className="heading-actions">
              <span className="update-time">
                <Clock3 size={13} />
                Fetched {formatTime(data?.status.lastSuccessfulUpdate)}
              </span>
              <button
                className="secondary-button"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
                {refreshing ? "Refreshing" : "Refresh data"}
              </button>
            </div>
          </div>
          {demo && (
            <div className="notice demo-notice">
              <Radio size={16} />
              <strong>DEMO MODE</strong> Simulated observations for interface
              development. No live attack statistics are shown.
            </div>
          )}
          {(error || data?.status.error) && (
            <div className="notice error-notice" role="alert">
              <CircleHelp size={17} />
              <span>
                {error || data.status.error}.{" "}
                {data
                  ? "Retaining the last loaded data."
                  : "Start the FastAPI backend on port 8000, then retry."}
              </span>
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {httpMode && (
            <div className="notice">
              <Globe2 size={16} />
              <span>
                General HTTP traffic includes normal traffic from humans and
                bots observed by Cloudflare. Markers show client-country shares;
                destination pairs are unavailable in this dataset.
              </span>
            </div>
          )}
          <StatisticsPanel
            httpMode={httpMode}
            observations={observations}
            sources={sources}
            targets={targets}
            upstream={upstream}
            loading={loading}
          />

          <div className="filterbar">
            <label className="select-wrap">
              <span className="sr-only">Traffic type</span>
              <select
                aria-label="Traffic type"
                value={trafficMode}
                onChange={(event) => setTrafficMode(event.target.value)}
              >
                <option value="ddos">DDoS activity</option>
                <option value="http">General HTTP traffic</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <div className="filter-label">
              <SlidersHorizontal size={15} />
              <span>FILTERS</span>
            </div>
            <label className="select-wrap">
              <Clock3 size={14} />
              <span className="sr-only">History range</span>
              <select
                aria-label="History range"
                value={range}
                onChange={(event) => {
                  setRange(event.target.value);
                  setWindowSelection("");
                }}
              >
                <option value="latest">Latest snapshot</option>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
              <ChevronDown size={12} />
            </label>
            {[
              [httpMode ? "Client" : "Origin", source, setSource],
              ["Billing target", target, setTarget],
            ]
              .filter(([label]) => !httpMode || label !== "Billing target")
              .map(([label, value, setter]) => (
                <label className="select-wrap" key={label}>
                  <span className="sr-only">{label} country</span>
                  <select
                    aria-label={`${label} country`}
                    value={value}
                    onChange={(event) => setter(event.target.value)}
                  >
                    <option value="">
                      All {label.toLowerCase()} countries
                    </option>
                    {codes.map((code) => (
                      <option key={code} value={code}>
                        {countryName(code)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </label>
              ))}
            <span className="filter-chip">
              <Layers size={13} />
              {httpMode ? "HTTP / HTTPS" : "Layer 7 · DDoS"}
            </span>
            <label className="threshold">
              Min. share{" "}
              <input
                aria-label={
                  httpMode
                    ? "Minimum reported country share"
                    : "Minimum reported pair share"
                }
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={minimum}
                onChange={(event) =>
                  setMinimum(
                    Math.min(100, Math.max(0, Number(event.target.value))),
                  )
                }
              />
              %
            </label>
            {filtersActive && (
              <button
                className="clear-button"
                onClick={() => {
                  setSource("");
                  setTarget("");
                  setMinimum(0);
                }}
              >
                Clear <X size={12} />
              </button>
            )}
          </div>
          {range !== "latest" && (
            <div className="history-bar">
              <label>
                Published window{" "}
                <select
                  aria-label="Published window"
                  value={activeKey || ""}
                  onChange={(event) => setWindowSelection(event.target.value)}
                >
                  {windows.length ? (
                    windows.map((w) => (
                      <option key={w.key} value={w.key}>
                        {formatTime(w.start)} — {formatTime(w.end)}
                      </option>
                    ))
                  ) : (
                    <option value="">No stored windows in this range</option>
                  )}
                </select>
              </label>
              <span>
                {data?.truncated
                  ? "Showing the newest 1,000 stored rows per dataset. Narrow the range for more detail."
                  : "One snapshot at a time. Overlapping windows are never added together."}
              </span>
            </div>
          )}

          <section
            className={`panel globe-panel ${expanded ? "globe-expanded" : ""}`}
            aria-label="Interactive global activity map"
          >
            <div className="globe-heading">
              <div>
                <div className="eyebrow">
                  <span className="tiny-dot" />
                  GEOGRAPHIC ACTIVITY
                </div>
                <h2>The world, in view.</h2>
                <p>
                  {httpMode
                    ? "General HTTP activity by client country"
                    : "Reported origin-to-target relationships"}
                </p>
              </div>
              <div className="globe-heading-right">
                <span className="tag">
                  <span className="tiny-dot" />
                  {demo ? "SIMULATED DATA" : "PUBLISHED DATA"}
                </span>
                <button
                  className="icon-button"
                  onClick={() => setExpanded(!expanded)}
                  aria-label={expanded ? "Exit expanded globe" : "Expand globe"}
                >
                  {expanded ? <X size={17} /> : <Maximize2 size={17} />}
                </button>
              </div>
            </div>
            <div className="globe-scene">
              <Suspense
                fallback={
                  <div className="globe-fallback">Loading geographic view…</div>
                }
              >
                <Globe
                  observations={observations}
                  paused={paused}
                  speed={speed}
                  showArcs={!httpMode && showArcs}
                  showMarkers={showMarkers}
                  reset={reset}
                  onSelect={selectCountry}
                  selected={selected}
                />
              </Suspense>
            </div>
            <div className="map-coordinate">
              AGGREGATED GEOGRAPHIC OBSERVATIONS
              <br />
              <span>COUNTRY-LEVEL RESOLUTION</span>
            </div>
            <div className="map-legend">
              <span>
                <i className="origin-dot" />
                {httpMode ? "HTTP client country" : "Origin"}
              </span>
              {!httpMode && (
                <span>
                  <i className="target-dot" />
                  Billing target
                </span>
              )}
              <small>
                {httpMode
                  ? "Marker size reflects country share"
                  : "Arc glow reflects reported share"}
              </small>
            </div>
            {(!observations.length || loading) && (
              <div className="globe-empty">
                <span>
                  {loading
                    ? "Connecting to Cloudflare Radar…"
                    : filtersActive
                      ? "No observations match these filters"
                      : "No geographic observations available"}
                </span>
                {!loading && (
                  <small>
                    {filtersActive
                      ? "Clear the filters to explore other countries."
                      : "The globe is ready. Data will appear after a successful collection."}
                  </small>
                )}
              </div>
            )}
            <div className="globe-bottom">
              <span className="interaction-hint">
                Drag to rotate <i />
                Scroll to zoom <i />
                Select a marker to filter
              </span>
              <div className="globe-controls">
                <button
                  className="control-button"
                  onClick={() => setPaused(!paused)}
                  aria-label={
                    paused ? "Resume globe animation" : "Pause globe animation"
                  }
                  title={paused ? "Resume animation" : "Pause animation"}
                >
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                </button>
                <button
                  className="control-button"
                  onClick={() => setReset(reset + 1)}
                  aria-label="Reset globe camera"
                  title="Reset camera"
                >
                  <RotateCcw size={14} />
                </button>
                <span className="control-divider" />
                <button
                  className={`control-button ${showArcs ? "enabled" : ""}`}
                  onClick={() => setShowArcs(!showArcs)}
                  disabled={httpMode}
                  aria-pressed={!httpMode && showArcs}
                  aria-label="Toggle country-pair arcs"
                  title="Toggle country-pair arcs"
                >
                  <Network size={14} />
                  <span>{httpMode ? "No pair data" : "Arcs"}</span>
                </button>
                <button
                  className={`control-button ${showMarkers ? "enabled" : ""}`}
                  onClick={() => setShowMarkers(!showMarkers)}
                  aria-pressed={showMarkers}
                  aria-label="Toggle country markers"
                  title="Toggle country markers"
                >
                  <Crosshair size={14} />
                  <span>Markers</span>
                </button>
                <label className="speed-select">
                  <span className="sr-only">Animation speed</span>
                  <select
                    aria-label="Animation speed"
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                  >
                    <option value="0.5">0.5×</option>
                    <option value="1">1×</option>
                    <option value="2">2×</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
          <div className="data-strip">
            <span>
              <Clock3 size={13} />
              <strong>OBSERVATION WINDOW</strong>
              {activeWindow
                ? `${formatTime(activeWindow.start)} — ${formatTime(activeWindow.end)}`
                : "Awaiting a published window"}
            </span>
            <span>Dataset updated {formatTime(upstream)}</span>
          </div>
          <div className="charts-grid" id="intelligence">
            <ActivityChart
              httpMode={httpMode}
              data={trends}
              metricType={trendMetric}
              global={filtersActive}
            />
            <CountryRanking
              httpMode={httpMode}
              sources={sources}
              targets={targets}
              tab={tab}
              setTab={setTab}
              onSelect={selectCountry}
            />
          </div>
          <div className="observations-header" id="observations">
            <div>
              <h2>Explore the underlying data</h2>
              <p>
                {httpMode
                  ? "Published HTTP client-country shares, with context."
                  : "Published country-pair shares, with context."}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={exportData}
              disabled={!observations.length}
            >
              <ArrowDownToLine size={14} />
              Export JSON
            </button>
          </div>
          <ObservationTable
            httpMode={httpMode}
            observations={observations}
            selected={selected}
            onSelect={(row) => {
              setSelected(row);
              setModal("details");
            }}
          />
          <footer>
            <span>
              <Shield size={14} />
              Powered by Cloudflare Radar
            </span>
            <p>
              Periodically updated aggregates. Arcs are visual representations,
              not individual attacks or packets.
            </p>
            <button onClick={() => setModal("about")}>
              About this data <ExternalLink size={12} />
            </button>
          </footer>
        </main>
      </div>
      {modal === "settings" && (
        <Modal title="Display settings" onClose={() => setModal("")}>
          <p>
            Customize the geographic visualization. Data refreshes from the
            backend every 60 seconds.
          </p>
          <label className="settings-row">
            Animate globe and arc glow
            <input
              type="checkbox"
              checked={!paused}
              onChange={(event) => setPaused(!event.target.checked)}
            />
          </label>
          <label className="settings-row">
            Show country-pair arcs
            <input
              type="checkbox"
              checked={!httpMode && showArcs}
              disabled={httpMode}
              onChange={(event) => setShowArcs(event.target.checked)}
            />
          </label>
          <label className="settings-row">
            Show geographic markers
            <input
              type="checkbox"
              checked={showMarkers}
              onChange={(event) => setShowMarkers(event.target.checked)}
            />
          </label>
          <label className="settings-row">
            Animation speed
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
            </select>
          </label>
          <div className="modal-note">
            Reduced-motion preferences pause animation initially. Globe rotation
            and zoom remain available.
          </div>
        </Modal>
      )}
      {modal === "about" && (
        <Modal title="Understand the signal" onClose={() => setModal("")}>
          <p>
            This dashboard visualizes aggregated general HTTP traffic and Layer
            7 DDoS statistics published by Cloudflare Radar. It polls the
            backend once per minute.
          </p>
          <h3>Geography is representative</h3>
          <p>
            Origins use reported country geography. Targets use the protected
            zone’s billing country. Markers are country representative points;
            arcs show published relationships. General HTTP mode reports client
            countries only and has no destination arcs. Both modes describe
            Cloudflare-observed traffic, not all Internet traffic.
          </p>
          <h3>Shares are relative</h3>
          <p>
            Country-pair percentages represent shares in the upstream dataset.
            Rankings cover only the displayed pairs. Activity trends retain
            their original normalization window and are not request counts.
          </p>
          <h3>Collection and publication differ</h3>
          <p>
            “Fetched” shows the last successful backend collection. “Dataset
            updated” shows Cloudflare’s publication timestamp. Cached data
            remains available during interruptions.
          </p>
          <a
            className="docs-link"
            href="https://developers.cloudflare.com/radar/investigate/application-layer-attacks/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare Radar documentation <ExternalLink size={13} />
          </a>
        </Modal>
      )}
      {modal === "details" && selected && (
        <Modal
          title={
            httpMode ? "HTTP country observation" : "Country-pair observation"
          }
          onClose={() => setModal("")}
        >
          <div className="detail-route">
            <span>{countryName(selected.sourceCountry)}</span>
            {!httpMode && (
              <>
                <Network size={20} />
                <span>{countryName(selected.targetCountry)}</span>
              </>
            )}
          </div>
          <strong className="detail-value">{share(selected.value)}</strong>
          <p>
            {httpMode ? "Reported HTTP country share" : "Reported pair share"} ·{" "}
            {selected.metricType}
          </p>
          <dl className="detail-list">
            <dt>Measurement window</dt>
            <dd>
              {formatTime(selected.windowStart)} —{" "}
              {formatTime(selected.windowEnd)}
            </dd>
            <dt>Collected</dt>
            <dd>{formatTime(selected.collectedAt)}</dd>
            <dt>Dataset updated</dt>
            <dd>{formatTime(selected.upstreamUpdatedAt)}</dd>
            <dt>Data source</dt>
            <dd>
              {selected.dataSource === "demo"
                ? "SIMULATED DEMO DATA"
                : "Cloudflare Radar"}
            </dd>
            <dt>{httpMode ? "Geography" : "Target geography"}</dt>
            <dd>
              {httpMode
                ? "Client country; no destination data"
                : "Protected zone billing country"}
            </dd>
            <dt>Source dataset</dt>
            <dd className="endpoint">{selected.endpoint}</dd>
          </dl>
        </Modal>
      )}
    </div>
  );
}
