import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import {
  BufferGeometry,
  Float32BufferAttribute,
  SRGBColorSpace,
  BackSide,
  AdditiveBlending,
} from "three";
import { Globe2 } from "lucide-react";
import AttackArcs from "./AttackArcs";
import AttackMarkers from "./AttackMarkers";
import { globePoint } from "../lib/geo";

class GlobeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="globe-fallback">
        <Globe2 size={60} />
        <strong>3D view unavailable</strong>
        <span>
          Use a browser with WebGL enabled. All reported data remains available
          below.
        </span>
      </div>
    ) : (
      this.props.children
    );
  }
}

function Borders() {
  const [geo, setGeo] = useState(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/countries.geojson", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setGeo)
      .catch(() => {});
    return () => abort.abort();
  }, []);
  const geometry = useMemo(() => {
    if (!geo) return null;
    const points = [];
    for (const feature of geo.features) {
      const polygons =
        feature.geometry.type === "MultiPolygon"
          ? feature.geometry.coordinates
          : [feature.geometry.coordinates];
      for (const polygon of polygons)
        for (const ring of polygon) {
          for (let i = 1; i < ring.length; i++) {
            points.push(
              ...globePoint(ring[i - 1][1], ring[i - 1][0], 2.009).toArray(),
              ...globePoint(ring[i][1], ring[i][0], 2.009).toArray(),
            );
          }
        }
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(points, 3));
    return result;
  }, [geo]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return (
    geometry && (
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color="#7cc9d1"
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </lineSegments>
    )
  );
}

function Earth() {
  const texture = useTexture("/textures/earth-day.jpg");
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[2, 96, 64]} />
      <meshStandardMaterial
        map={texture}
        color="#c5dce6"
        emissiveMap={texture}
        emissive="#9bc4d6"
        emissiveIntensity={0.3}
        roughness={0.92}
        metalness={0.02}
      />
    </mesh>
  );
}

function Scene({
  observations,
  paused,
  speed,
  showArcs,
  showMarkers,
  reset,
  onSelect,
  selected,
}) {
  const world = useRef(),
    earth = useRef(),
    controls = useRef();
  const interacting = useRef(false);
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.5, 6.8);
    controls.current?.target.set(0, 0, 0);
    if (world.current) world.current.rotation.set(0.13, -0.25, -0.05);
    controls.current?.update();
  }, [reset, camera]);
  useFrame((_, delta) => {
    if (world.current && !paused && !interacting.current)
      world.current.rotation.y += Math.min(delta, 0.1) * 0.035 * speed;
  });
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[-4, 5, 6]} intensity={2.6} color="#e3f2fa" />
      <directionalLight
        position={[4, -2, -3]}
        intensity={0.65}
        color="#247a9b"
      />
      <Stars
        radius={70}
        depth={30}
        count={1400}
        factor={2.2}
        saturation={0}
        fade
        speed={0}
      />
      <group ref={world}>
        <mesh ref={earth}>
          <sphereGeometry args={[1.998, 48, 32]} />
          <meshBasicMaterial color="#0c2330" />
        </mesh>
        <Suspense fallback={null}>
          <Earth />
        </Suspense>
        <mesh scale={1.035}>
          <sphereGeometry args={[2, 64, 48]} />
          <shaderMaterial
            side={BackSide}
            blending={AdditiveBlending}
            transparent
            depthWrite={false}
            vertexShader={`varying vec3 n; varying vec3 p; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); p=mv.xyz; gl_Position=projectionMatrix*mv; }`}
            fragmentShader={`varying vec3 n; varying vec3 p; void main(){ float glow=pow(1.0-abs(dot(normalize(n),normalize(-p))),3.5); gl_FragColor=vec4(0.15,0.55,0.77,glow*0.4); }`}
          />
        </mesh>
        <Borders />
        {showArcs && (
          <AttackArcs
            observations={observations}
            paused={paused}
            speed={speed}
            selected={selected}
          />
        )}
        {showMarkers && (
          <AttackMarkers
            observations={observations}
            onSelect={onSelect}
            earth={earth}
          />
        )}
      </group>
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={3.4}
        maxDistance={10}
        enableDamping
        dampingFactor={0.06}
        onStart={() => {
          interacting.current = true;
        }}
        onEnd={() => {
          interacting.current = false;
        }}
      />
    </>
  );
}

export default function Globe(props) {
  return (
    <GlobeBoundary>
      <Canvas
        camera={{ position: [0, 0.5, 6.8], fov: 44 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
        fallback={
          <div className="globe-fallback">
            WebGL is unavailable. Explore the observation table below.
          </div>
        }
      >
        <Scene {...props} />
      </Canvas>
    </GlobeBoundary>
  );
}
