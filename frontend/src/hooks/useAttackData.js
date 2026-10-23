import { useCallback, useEffect, useRef, useState } from "react";

const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export default function useAttackData(trafficMode = "ddos") {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("latest");
  const [windowSelection, setWindowSelection] = useState("");
  const controller = useRef(null);
  const serial = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++serial.current;
    controller.current?.abort();
    const abort = (controller.current = new AbortController());
    const timer = setTimeout(() => abort.abort(), 20000);
    setRefreshing(true);
    async function get(path) {
      const response = await fetch(base + path, { signal: abort.signal });
      if (!response.ok)
        throw new Error(`Backend returned HTTP ${response.status}`);
      const page = await response.json();
      if (!page || !Array.isArray(page.observations) || !page.status)
        throw new Error("Unexpected backend response");
      return page;
    }
    try {
      const api = trafficMode === "http" ? "/api/traffic" : "/api/attacks";
      const geographyDataset =
        trafficMode === "http" ? "http_locations" : "pairs";
      const trendDataset =
        trafficMode === "http" ? "http_timeseries" : "timeseries";
      // Both latest snapshots are fetched atomically; never mix demo and real data.
      const [pairs, series] = await Promise.all([
        get(`${api}/latest?dataset=${geographyDataset}`),
        get(`${api}/latest?dataset=${trendDataset}`),
      ]);
      let historyPairs = [],
        historySeries = [],
        truncated = false;
      if (range !== "latest") {
        const start = new Date(
          Date.now() - Number(range) * 86400000,
        ).toISOString();
        const [hp, hs] = await Promise.all([
          get(
            `${api}/history?dataset=${geographyDataset}&limit=1000&start=${encodeURIComponent(start)}`,
          ),
          get(
            `${api}/history?dataset=${trendDataset}&limit=1000&start=${encodeURIComponent(start)}`,
          ),
        ]);
        historyPairs = hp.observations;
        historySeries = hs.observations;
        truncated = hp.total > 1000 || hs.total > 1000;
        if (
          hp.status.mode !== pairs.status.mode ||
          hs.status.mode !== pairs.status.mode
        )
          throw new Error("Backend data mode changed; refresh to reconnect");
      }
      if (series.status.mode !== pairs.status.mode)
        throw new Error("Backend data mode changed; refresh to reconnect");
      if (requestId === serial.current) {
        setData({
          pairs: pairs.observations,
          series: series.observations,
          historyPairs,
          historySeries,
          status: pairs.status,
          range,
          trafficMode,
          truncated,
          fetchedAt: new Date().toISOString(),
        });
        setError("");
      }
    } catch (err) {
      if (requestId === serial.current && !abort.signal.aborted)
        setError(err.message || "Cannot reach backend");
      else if (requestId === serial.current)
        setError("Backend request timed out");
    } finally {
      clearTimeout(timer);
      if (requestId === serial.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range, trafficMode]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => {
      clearInterval(interval);
      serial.current++;
      controller.current?.abort();
    };
  }, [refresh]);
  return {
    data,
    error,
    loading,
    refreshing,
    refresh,
    range,
    setRange,
    windowSelection,
    setWindowSelection,
  };
}
