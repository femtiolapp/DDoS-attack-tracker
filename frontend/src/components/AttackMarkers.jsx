import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { Color, Object3D } from "three";
import { geographicMarkers, globePoint } from "../lib/geo";
import { countryName, share } from "../lib/data";

export default function AttackMarkers({ observations, onSelect, earth }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(null);
  const markers = useMemo(
    () => geographicMarkers(observations),
    [observations],
  );
  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = new Object3D(),
      max = Math.max(1, ...markers.map((m) => m.value));
    markers.forEach((marker, index) => {
      object.position.copy(
        globePoint(
          marker.lat,
          marker.lon,
          marker.role === "source" ? 2.032 : 2.06,
        ),
      );
      object.scale.setScalar(0.018 + 0.035 * Math.sqrt(marker.value / max));
      object.updateMatrix();
      ref.current.setMatrixAt(index, object.matrix);
      ref.current.setColorAt(
        index,
        new Color(marker.role === "source" ? "#47e0bc" : "#f5ac61"),
      );
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
    setHovered(null);
  }, [markers]);
  const marker = hovered !== null ? markers[hovered] : null;
  return (
    <group>
      {markers.length > 0 && (
        <instancedMesh
          key={markers.length}
          ref={ref}
          args={[null, null, markers.length]}
          onPointerMove={(event) => {
            event.stopPropagation();
            setHovered(event.instanceId);
          }}
          onPointerOut={() => setHovered(null)}
          onClick={(event) => {
            event.stopPropagation();
            const m = markers[event.instanceId];
            if (m) onSelect(m);
          }}
        >
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      )}
      {marker && (
        <Html
          position={globePoint(marker.lat, marker.lon, 2.16).toArray()}
          center
          occlude={[earth]}
          style={{ pointerEvents: "none" }}
        >
          <div className="globe-tooltip">
            <strong>{countryName(marker.country)}</strong>
            <span>
              {observations[0]?.dataset === "http_locations"
                ? "HTTP client"
                : marker.role === "source"
                  ? "Origin"
                  : "Billing target"}{" "}
              · {share(marker.value)}
            </span>
            <small>
              {observations[0]?.dataset === "http_locations"
                ? "Reported HTTP country share"
                : "Share in displayed pairs"}{" "}
              · click to filter
            </small>
          </div>
        </Html>
      )}
    </group>
  );
}
