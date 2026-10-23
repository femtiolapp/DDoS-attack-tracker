import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Activity, ArrowUpRight, Info } from "lucide-react";
import { countryName, share } from "../lib/data";

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>
        {new Date(label).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
      </strong>
      <span>{Number(payload[0].value).toFixed(2)} relative activity</span>
    </div>
  );
}

export function ActivityChart({ data, metricType, global, httpMode = false }) {
  return (
    <section className="panel trend-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TRAFFIC INTELLIGENCE</span>
          <h2>
            <Activity size={17} />
            {httpMode ? "General HTTP activity" : "Layer 7 activity"}
          </h2>
        </div>
        <span className="tag">{metricType?.toUpperCase() || "NO DATA"}</span>
      </div>
      <p className="panel-description">
        Global relative activity · one normalization window
        {global ? " · country filters apply to geography only" : ""}
      </p>
      <div className="trend-chart">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 15, right: 6, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#53ddbb" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#53ddbb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#1d2833"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(time) =>
                  new Date(time).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })
                }
                stroke="#526371"
                tickLine={false}
                axisLine={false}
                minTickGap={35}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                stroke="#526371"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Area
                type="linear"
                dataKey="value"
                stroke="#53ddbb"
                strokeWidth={2}
                fill="url(#activityFill)"
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-chart">
            <Activity size={24} />
            <span>No trend data in this window</span>
          </div>
        )}
      </div>
      <div className="chart-note">
        <Info size={12} />
        Relative index, not a request count. Missing buckets remain gaps. Times
        in UTC.
      </div>
    </section>
  );
}

export function CountryRanking({
  sources,
  targets,
  tab,
  setTab,
  onSelect,
  httpMode = false,
}) {
  const rows = (tab === "source" ? sources : targets).slice(0, 5);
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="panel ranking-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">GEOGRAPHIC DISTRIBUTION</span>
          <h2>Leading countries</h2>
        </div>
        <ArrowUpRight size={17} className="muted" />
      </div>
      <div className="segmented" aria-label="Country ranking">
        <button
          aria-pressed={tab === "source"}
          className={tab === "source" ? "active" : ""}
          onClick={() => setTab("source")}
        >
          {httpMode ? "HTTP client countries" : "Origins"}
        </button>
        {!httpMode && (
          <button
            aria-pressed={tab === "target"}
            className={tab === "target" ? "active" : ""}
            onClick={() => setTab("target")}
          >
            Billing targets
          </button>
        )}
      </div>
      <div className="rank-list">
        {rows.length ? (
          rows.map((row, index) => (
            <button
              key={row.country}
              className="rank-row"
              onClick={() => onSelect({ country: row.country, role: tab })}
            >
              <span className="rank-number">0{index + 1}</span>
              <div className="rank-body">
                <div>
                  <span>{countryName(row.country)}</span>
                  <strong>{share(row.value)}</strong>
                </div>
                <div className="rank-track">
                  <span
                    style={{
                      width: `${(row.value / maximum) * 100}%`,
                      background: tab === "source" ? "#59dcb7" : "#e6a363",
                    }}
                  />
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="empty-chart">No countries in this selection</div>
        )}
      </div>
      <p className="chart-note">
        {httpMode
          ? "Reported country shares of Cloudflare-observed HTTP requests."
          : "Shares cover displayed pairs, not complete country totals."}
      </p>
    </section>
  );
}
