const names = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code) {
  if (!code) return "Unknown location";
  try {
    return names.of(code) || code;
  } catch {
    return code;
  }
}
export const share = (value) => `${Number(value).toFixed(2)}%`;
export function formatTime(value, options = {}) {
  if (!value) return "Awaiting data";
  return (
    new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      ...options,
    }) + " UTC"
  );
}
export function windowKey(observation) {
  const range = observation.metadata?.dateRange?.[0];
  return range
    ? `${range.startTime}|${range.endTime}`
    : `${observation.windowStart}|${observation.windowEnd}`;
}
export function windowsFrom(observations) {
  const windows = new Map();
  for (const observation of observations) {
    const key = windowKey(observation);
    const range = observation.metadata?.dateRange?.[0];
    windows.set(key, {
      key,
      start: range?.startTime || observation.windowStart,
      end: range?.endTime || observation.windowEnd,
    });
  }
  return [...windows.values()].sort(
    (a, b) => Date.parse(b.end) - Date.parse(a.end),
  );
}
export function filterPairs(
  rows,
  { source = "", target = "", minimum = 0 } = {},
) {
  return rows.filter(
    (row) =>
      (!source || row.sourceCountry === source) &&
      (!target || row.targetCountry === target) &&
      row.value >= minimum,
  );
}
export function rankings(rows, field) {
  const values = new Map();
  for (const row of rows) {
    const code = row[field];
    if (code) values.set(code, (values.get(code) || 0) + row.value);
  }
  return [...values]
    .map(([country, value]) => ({ country, name: countryName(country), value }))
    .sort((a, b) => b.value - a.value);
}
export function chartSeries(rows, key) {
  // Never combine independently normalized query windows or fill missing buckets.
  const selected = rows.filter((row) => windowKey(row) === key);
  if (!selected.length) return [];
  const duration =
    Date.parse(selected[0].windowEnd) - Date.parse(selected[0].windowStart);
  const byTime = new Map(
    selected.map((row) => [Date.parse(row.windowStart), row]),
  );
  const start = Math.min(...byTime.keys()),
    end = Math.max(...byTime.keys());
  const result = [];
  for (let time = start; time <= end; time += duration) {
    result.push({ time, value: byTime.get(time)?.value ?? null });
    if (result.length > 1000) break;
  }
  return result;
}
