import { describe, expect, it } from "vitest";
import { chartSeries, filterPairs, rankings, windowsFrom } from "./data";
import {
  geographicMarkers,
  globePoint,
  hasPairCoordinates,
  pairCurve,
} from "./geo";

const metadata = {
  dateRange: [
    { startTime: "2026-10-22T00:00:00Z", endTime: "2026-10-23T00:00:00Z" },
  ],
};
const pair = {
  sourceCountry: "DE",
  targetCountry: "US",
  sourceLatitude: 51,
  sourceLongitude: 10,
  targetLatitude: 40,
  targetLongitude: -98,
  value: 12.5,
  metadata,
};

describe("aggregate presentation", () => {
  it("filters percentages without converting to counts or renormalizing", () => {
    expect(filterPairs([pair], { source: "DE", minimum: 10 })[0].value).toBe(
      12.5,
    );
    expect(filterPairs([pair], { target: "GB" })).toEqual([]);
    expect(filterPairs([pair], { minimum: 13 })).toEqual([]);
  });
  it("ranks only returned pair shares", () => {
    expect(
      rankings([pair, { ...pair, value: 2.5 }], "sourceCountry")[0].value,
    ).toBe(15);
  });
  it("keeps overlapping normalization windows separate", () => {
    const other = {
      ...pair,
      metadata: {
        dateRange: [
          {
            startTime: "2026-10-22T01:00:00Z",
            endTime: "2026-10-23T01:00:00Z",
          },
        ],
      },
    };
    expect(windowsFrom([pair, other])).toHaveLength(2);
  });
  it("preserves missing trend buckets and excludes other windows", () => {
    const rows = [0, 2].map((hour) => ({
      ...pair,
      windowStart: `2026-10-22T0${hour}:00:00Z`,
      windowEnd: `2026-10-22T0${hour + 1}:00:00Z`,
    }));
    const key = windowsFrom(rows)[0].key;
    expect(chartSeries(rows, key).map((row) => row.value)).toEqual([
      12.5,
      null,
      12.5,
    ]);
    expect(chartSeries(rows, "another window")).toEqual([]);
  });
  it("retains data with unavailable coordinates without making a marker or arc", () => {
    const unknown = { ...pair, sourceLatitude: null };
    expect(hasPairCoordinates(unknown)).toBe(false);
    expect(geographicMarkers([unknown])).toHaveLength(1);
    expect(
      geographicMarkers([pair, pair]).find((m) => m.role === "source").value,
    ).toBe(25);
  });
  it("places geographic points consistently and builds finite arcs", () => {
    expect(globePoint(0, 0).toArray()).toEqual([0, 0, 2]);
    for (const row of [
      pair,
      {
        ...pair,
        sourceLatitude: 0,
        sourceLongitude: 0,
        targetLatitude: 0,
        targetLongitude: 180,
      },
      { ...pair, targetLatitude: 51, targetLongitude: 10 },
    ]) {
      expect(
        pairCurve(row)
          .getPoints(50)
          .every((p) => p.toArray().every(Number.isFinite)),
      ).toBe(true);
      expect(
        pairCurve(row)
          .getPoints(50)
          .every((p) => p.length() > 2),
      ).toBe(true);
    }
  });
});
