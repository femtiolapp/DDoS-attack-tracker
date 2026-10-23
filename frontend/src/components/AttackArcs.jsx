import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { TubeGeometry } from "three";
import { hasPairCoordinates, pairCurve } from "../lib/geo";

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const fragmentShader = `uniform float uTime; uniform float uStrength; varying vec2 vUv;
void main() {
  vec3 color = mix(vec3(0.15,0.88,0.76), vec3(1.0,0.56,0.25), vUv.x);
  float wave = 0.62 + 0.38 * sin(vUv.x * 12.0 - uTime * 1.6);
  gl_FragColor = vec4(color, (0.22 + uStrength * 0.55) * wave);
}`;

function Arc({ observation, maximum, paused, speed, selected }) {
  const material = useRef();
  const geometry = useMemo(
    () =>
      new TubeGeometry(
        pairCurve(observation),
        56,
        selected
          ? 0.012
          : 0.005 + 0.005 * Math.sqrt(observation.value / maximum),
        4,
        false,
      ),
    [observation, maximum, selected],
  );
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uStrength: { value: Math.max(0.15, observation.value / maximum) },
    }),
    [observation.value, maximum],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (!paused && material.current)
      material.current.uniforms.uTime.value += Math.min(delta, 0.1) * speed;
  });
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default function AttackArcs({ observations, paused, speed, selected }) {
  const pairs = useMemo(
    () => observations.filter(hasPairCoordinates).slice(0, 100),
    [observations],
  );
  const maximum = Math.max(1, ...pairs.map((row) => row.value));
  return (
    <group>
      {pairs.map((row) => (
        <Arc
          key={row.id}
          observation={row}
          maximum={maximum}
          paused={paused}
          speed={speed}
          selected={selected?.id === row.id}
        />
      ))}
    </group>
  );
}
