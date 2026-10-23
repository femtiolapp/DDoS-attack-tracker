import { Vector3, QuadraticBezierCurve3, CatmullRomCurve3 } from "three";

export function globePoint(latitude, longitude, radius = 2) {
  const lat = (latitude * Math.PI) / 180,
    lon = (longitude * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}
export function pairCurve(pair) {
  const start = globePoint(pair.sourceLatitude, pair.sourceLongitude, 2.025);
  const end = globePoint(pair.targetLatitude, pair.targetLongitude, 2.025);
  const distance = start.distanceTo(end);
  if (distance < 0.01) {
    const middle = start.clone().multiplyScalar(1.12);
    end.add(new Vector3(0.025, 0.025, 0));
    middle.add(new Vector3(0.28, 0.25, 0));
    return new QuadraticBezierCurve3(start, middle, end);
  }
  const a = start.clone().normalize(),
    b = end.clone().normalize();
  const angle = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
  const axis = a.clone().cross(b);
  if (axis.length() < 0.001) {
    axis
      .copy(a)
      .cross(Math.abs(a.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0));
  }
  axis.normalize();
  // Sample the great-circle direction, then lift radially. Even antipodal arcs
  // stay outside Earth instead of cutting through it like a quadratic can.
  return new CatmullRomCurve3(
    Array.from({ length: 33 }, (_, i) => {
      const t = i / 32;
      return a
        .clone()
        .applyAxisAngle(axis, angle * t)
        .multiplyScalar(
          2.025 + Math.sin(t * Math.PI) * (0.18 + distance * 0.2),
        );
    }),
  );
}
export function hasPairCoordinates(row) {
  return [
    "sourceLatitude",
    "sourceLongitude",
    "targetLatitude",
    "targetLongitude",
  ].every((key) => Number.isFinite(row[key]));
}
export function geographicMarkers(rows) {
  const markers = new Map();
  for (const row of rows) {
    for (const role of ["source", "target"]) {
      const country = row[`${role}Country`],
        lat = row[`${role}Latitude`],
        lon = row[`${role}Longitude`];
      if (!country || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const key = `${country}:${role}`;
      if (!markers.has(key))
        markers.set(key, { key, country, role, lat, lon, value: 0 });
      markers.get(key).value += row.value;
    }
  }
  return [...markers.values()];
}
