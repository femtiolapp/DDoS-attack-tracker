import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MoveUpRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { countryName, share } from "../lib/data";

export default function ObservationTable({
  observations,
  selected,
  onSelect,
  httpMode = false,
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [observations]);
  const pages = Math.max(1, Math.ceil(observations.length / 6)),
    current = Math.min(page, pages - 1);
  const sorted = [...observations].sort((a, b) => b.value - a.value);
  return (
    <section className="panel observations-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PUBLISHED OBSERVATIONS</span>
          <h2>
            {httpMode ? "HTTP client countries" : "Country relationships"}{" "}
            <span className="count-badge">{observations.length}</span>
          </h2>
        </div>
        <span className="table-caption">
          {httpMode ? "General HTTP / HTTPS" : "Layer 7 / DDoS"}
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{httpMode ? "CLIENT COUNTRY" : "ORIGIN COUNTRY"}</th>
              {!httpMode && <th>BILLING TARGET</th>}
              <th>REPORTED SHARE</th>
              <th>METRIC</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(current * 6, current * 6 + 6).map((row) => (
              <tr
                key={row.id}
                className={selected?.id === row.id ? "selected-row" : ""}
              >
                <td>
                  <span className="country-code">
                    {row.sourceCountry || "??"}
                  </span>
                  {countryName(row.sourceCountry)}
                </td>
                {!httpMode && (
                  <td>
                    <ArrowRight size={12} className="inline-arrow" />
                    <span className="country-code target-code">
                      {row.targetCountry || "??"}
                    </span>
                    {countryName(row.targetCountry)}
                  </td>
                )}
                <td className="share-cell">
                  {share(row.value)}
                  <span className="mini-bar">
                    <i
                      style={{
                        width: `${Math.min(100, (row.value / Math.max(1, sorted[0]?.value)) * 100)}%`,
                      }}
                    />
                  </span>
                </td>
                <td>
                  <span className="metric-badge">{row.metricType}</span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={
                      httpMode
                        ? `HTTP details for ${countryName(row.sourceCountry)}`
                        : `Details for ${countryName(row.sourceCountry)} to ${countryName(row.targetCountry)}`
                    }
                    onClick={() => onSelect(row)}
                  >
                    <MoveUpRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!observations.length && (
        <div className="table-empty">
          No reported observations match this selection. Try clearing the
          country or activity filters.
        </div>
      )}
      <div className="table-footer">
        <span>Aggregated statistics · representative country geography</span>
        <div>
          <button
            className="icon-button"
            disabled={!current}
            onClick={() => setPage(current - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            className="icon-button"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
