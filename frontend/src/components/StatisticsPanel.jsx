import { Globe2, Network, Crosshair, Radio } from "lucide-react";
import { countryName, share } from "../lib/data";

export default function StatisticsPanel({
  observations,
  sources,
  targets,
  loading,
  httpMode = false,
}) {
  const represented = new Set(
    observations
      .flatMap((row) => [row.sourceCountry, row.targetCountry])
      .filter(Boolean),
  ).size;
  const cards = [
    {
      label: httpMode ? "REPORTED CLIENT COUNTRIES" : "REPORTED COUNTRY PAIRS",
      value: loading ? "—" : String(observations.length).padStart(2, "0"),
      sub: "In the displayed observation window",
      icon: Network,
    },
    {
      label: "COUNTRIES REPRESENTED",
      value: loading ? "—" : String(represented).padStart(2, "0"),
      sub: httpMode
        ? "Across reported HTTP client locations"
        : "Across reported origins and targets",
      icon: Globe2,
    },
    {
      label: httpMode ? "TOP HTTP CLIENT COUNTRY" : "TOP REPORTED ORIGIN",
      value: sources[0] ? countryName(sources[0].country) : "—",
      sub: sources[0]
        ? `${share(sources[0].value)} · ${httpMode ? "reported HTTP share" : "share in displayed pairs"}`
        : "No origin data for this selection",
      icon: Radio,
      small: true,
    },
    {
      label: httpMode ? "TRAFFIC COVERAGE" : "TOP REPORTED TARGET",
      value: httpMode
        ? "HTTP / HTTPS"
        : targets[0]
          ? countryName(targets[0].country)
          : "—",
      sub: httpMode
        ? "Cloudflare-observed humans and bots"
        : targets[0]
          ? `${share(targets[0].value)} · billing country`
          : "No target data for this selection",
      icon: Crosshair,
      small: true,
    },
  ];
  return (
    <section className="stats-grid" aria-label="Observation statistics">
      {cards.map(({ label, value, sub, icon: Icon, small }) => (
        <article className="stat" key={label}>
          <div className="stat-label">
            <span>{label}</span>
            <Icon size={16} />
          </div>
          <div className={`stat-value ${small ? "country-value" : ""}`}>
            {value}
          </div>
          <div className="stat-sub">{sub}</div>
        </article>
      ))}
    </section>
  );
}
