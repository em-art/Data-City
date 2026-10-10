/**
 * Procedural building archetypes. Each is drawn in local space: footprint
 * w (x) × d (z), base at y=0, loading dock facing +Z.
 *
 * They are placeholders with intent: the asset catalog (src/assets) maps
 * archetypes to components, so a GLB model from Blender can replace any of
 * them without touching the model or the scene logic.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { activity, clock } from '@/sim/clock';
import { Block, C, Cyl, Mat, Panel } from './look';

export interface ArchetypeProps {
  w: number;
  d: number;
  entityId: string;
  accent?: string;
}

const isActive = (id: string) => activity.active.has(id);

function Plinth({ w, d }: { w: number; d: number }) {
  return <Block size={[w + 0.5, 0.14, d + 0.5]} c={C.wallShade} r={0.06} shadow={false} />;
}

function Doors({ n, width, z, y = 0.14, spacing = 1.5, h = 1.3, c = C.door }: { n: number; width: number; z: number; y?: number; spacing?: number; h?: number; c?: string }) {
  const x0 = -((n - 1) * spacing) / 2;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[x0 + i * spacing, y, z]}>
          <Panel size={[width, h, 0.06]} at={[0, h / 2, 0]} c={c} />
          {[0.25, 0.5, 0.75].map((k) => (
            <Panel key={k} size={[width * 0.96, 0.03, 0.08]} at={[0, h * k, 0]} c={C.wall} />
          ))}
        </group>
      ))}
    </>
  );
}

function SolarRow({ w, d, at, rows }: { w: number; d: number; at: [number, number, number]; rows: number }) {
  return (
    <group position={at}>
      {Array.from({ length: rows }, (_, i) => (
        <group key={i} position={[0, 0.12, -d / 2 + (d / rows) * (i + 0.5)]} rotation={[-0.38, 0, 0]}>
          <Panel size={[w, 0.06, (d / rows) * 0.8]} at={[0, 0, 0]} c={C.solar} />
          <Panel size={[w, 0.07, 0.03]} at={[0, 0.005, 0]} c={C.glass} />
        </group>
      ))}
    </group>
  );
}

function WindowBand({ w, y, z, h = 0.45, c = C.glass }: { w: number; y: number; z: number; h?: number; c?: string }) {
  return <Panel size={[w, h, 0.05]} at={[0, y, z]} c={c} emissive={C.glass} glow={0.15} />;
}

/** Blinking status beacon; color driven by activity. */
function Beacon({ at, entityId }: { at: [number, number, number]; entityId: string }) {
  const m = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!m.current) return;
    const a = activity.active.get(entityId);
    const pulse = 0.6 + 0.4 * Math.sin(clock.t * 6);
    m.current.color.set(a === 'manual' ? C.yellow : a ? C.green : '#c9cfe6');
    m.current.emissive.set(a === 'manual' ? C.yellow : a ? C.green : '#000000');
    m.current.emissiveIntensity = a ? pulse : 0;
  });
  return (
    <mesh position={at}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshStandardMaterial ref={m} color="#c9cfe6" />
    </mesh>
  );
}

/** Data Platform — processing factory with conveyor and solar roof. */
export function Factory({ w, d, entityId }: ArchetypeProps) {
  const crates = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!crates.current) return;
    const speed = isActive(entityId) ? 1.4 : 0.25;
    crates.current.children.forEach((c) => {
      c.position.z += dt * speed;
      if (c.position.z > d * 0.48) c.position.z = -d * 0.05;
    });
  });
  const hallW = w * 0.62;
  const hallX = -w * 0.17;
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[hallW, 2.5, d * 0.86]} at={[hallX, 0.14, -d * 0.04]} c={C.wall} />
      <Block size={[hallW + 0.1, 0.18, d * 0.88]} at={[hallX, 2.64, -d * 0.04]} c={C.roof} r={0.05} />
      <SolarRow w={hallW * 0.86} d={d * 0.74} at={[hallX, 2.82, -d * 0.04]} rows={4} />
      <WindowBand w={hallW * 0.9} y={2.05} z={d * 0.39 + 0.01} h={0.35} />
      <Doors n={3} width={1.1} z={d * 0.39 + 0.02} spacing={1.7} />
      <group position={[hallX, 0, 0]}>
        <Block size={[hallW * 0.9, 0.12, 1.1]} at={[0, 1.75, d * 0.39 + 0.5]} c={C.roofDark} r={0.04} />
      </group>
      {/* processing tower */}
      <Block size={[w * 0.3, 3.9, d * 0.52]} at={[w * 0.3, 0.14, -d * 0.18]} c={C.wall} />
      <WindowBand w={w * 0.26} y={3.3} z={-d * 0.18 + d * 0.26 + 0.01} h={0.5} c={C.accent} />
      <WindowBand w={w * 0.26} y={2.4} z={-d * 0.18 + d * 0.26 + 0.01} h={0.3} />
      <Cyl r={0.32} h={1.6} at={[w * 0.24, 4.04, -d * 0.3]} c={C.roof} />
      <Cyl r={0.32} h={2.1} at={[w * 0.36, 4.04, -d * 0.3]} c={C.roof} />
      <Cyl r={0.36} h={0.12} at={[w * 0.36, 6.14, -d * 0.3]} c={C.accent} />
      {/* conveyor out of the tower */}
      <Block size={[0.9, 0.16, d * 0.55]} at={[w * 0.3, 0.75, d * 0.2]} c={C.roofDark} r={0.04} />
      {[0.05, 0.25, 0.45].map((k) => (
        <Cyl key={k} r={0.06} h={0.62} at={[w * 0.3, 0.14, d * k]} c={C.door} seg={8} />
      ))}
      <group ref={crates} position={[w * 0.3, 0.92, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} size={[0.5, 0.36, 0.5]} at={[0, 0, -d * 0.05 + i * (d * 0.13)]} c={i % 2 ? C.accent : C.orange} r={0.05} />
        ))}
      </group>
      <Beacon at={[hallX + hallW / 2 - 0.4, 3.2, d * 0.35]} entityId={entityId} />
    </group>
  );
}

/** Product warehouse — immutable versions as stacked containers. */
export function Warehouse({ w, d, entityId, accent }: ArchetypeProps) {
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.94, 2.2, d * 0.8]} at={[0, 0.14, -d * 0.08]} c={C.wall} />
      {/* barrel roof */}
      <mesh position={[0, 2.34, -d * 0.08]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[d * 0.4, d * 0.4, w * 0.94, 24, 1, false, 0, Math.PI]} />
        <Mat c={accent ?? C.roof} />
      </mesh>
      {[-0.3, 0, 0.3].map((k) => (
        <Panel key={k} size={[w * 0.15, 0.05, d * 0.5]} at={[w * k, 2.34 + d * 0.38, -d * 0.08]} c={C.glass} />
      ))}
      {accent && <Panel size={[w * 0.94, 0.2, 0.05]} at={[0, 1.95, d * 0.32 + 0.01]} c={accent} />}
      <Doors n={4} width={1.2} z={d * 0.32 + 0.02} spacing={w * 0.22} h={1.4} />
      <Block size={[w * 0.96, 0.1, 0.9]} at={[0, 1.7, d * 0.32 + 0.45]} c={C.roofDark} r={0.04} />
      {/* pallets on the apron */}
      {[-1, 0, 1].map((i) => (
        <group key={i} position={[i * w * 0.28, 0.14, d * 0.46]}>
          <Block size={[0.7, 0.1, 0.5]} c={C.trunk} r={0.02} />
          <Block size={[0.55, 0.4, 0.42]} at={[0, 0.1, 0]} c={i === 0 ? C.accent : C.wallShade} r={0.05} />
        </group>
      ))}
      <Beacon at={[w * 0.4, 2.6, d * 0.32]} entityId={entityId} />
    </group>
  );
}

/** ИСТОК — distribution hub with a contract checkpoint gate. */
export function Distribution({ w, d, entityId }: ArchetypeProps) {
  const arm = useRef<THREE.Group>(null);
  const radar = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (arm.current) {
      const target = isActive(entityId) ? -1.2 : 0;
      arm.current.rotation.z += (target - arm.current.rotation.z) * Math.min(dt * 4, 1);
    }
    if (radar.current) radar.current.rotation.y += dt * 0.8;
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.92, 2.4, d * 0.62]} at={[0, 0.14, -d * 0.16]} c={C.wall} />
      <Block size={[w * 0.94, 0.16, d * 0.64]} at={[0, 2.54, -d * 0.16]} c={C.roof} r={0.05} />
      <Block size={[w * 0.4, 0.9, d * 0.3]} at={[-w * 0.18, 2.7, -d * 0.22]} c={C.wallShade} />
      <WindowBand w={w * 0.36} y={3.2} z={-d * 0.22 + d * 0.15 + 0.01} h={0.4} c={C.accent} />
      <group ref={radar} position={[w * 0.3, 2.7, -d * 0.25]}>
        <Cyl r={0.12} h={0.7} at={[0, 0, 0]} c={C.roofDark} seg={8} />
        <Block size={[1.2, 0.08, 0.3]} at={[0.3, 0.7, 0]} c={C.accent} r={0.03} />
      </group>
      <Doors n={5} width={1.0} z={d * 0.15 + 0.02} spacing={w * 0.17} h={1.4} />
      <Block size={[w * 0.96, 0.1, 1.3]} at={[0, 1.75, d * 0.15 + 0.65]} c={C.roofDark} r={0.04} />
      {/* yard markings */}
      {[-2, -1, 0, 1, 2].map((i) => (
        <Panel key={i} size={[0.06, 0.01, d * 0.22]} at={[i * w * 0.17 + w * 0.085, 0.15, d * 0.3]} c={C.roadLine} />
      ))}
      {/* contract checkpoint */}
      <group position={[w * 0.4, 0.14, d * 0.42]}>
        <Block size={[0.8, 1.1, 0.8]} c={C.wall} />
        <Panel size={[0.6, 0.3, 0.05]} at={[0, 0.75, 0.41]} c={C.glass} />
        <Block size={[0.9, 0.08, 0.9]} at={[0, 1.1, 0]} c={C.accent} r={0.03} />
        <group ref={arm} position={[-0.45, 0.7, 0.2]}>
          <Panel size={[2.4, 0.09, 0.09]} at={[-1.2, 0, 0]} c={C.red} />
        </group>
      </group>
      <Beacon at={[-w * 0.42, 2.95, d * 0.12]} entityId={entityId} />
    </group>
  );
}

/** EVA — operations center with a satellite dish and server lights. */
export function OpsCenter({ w, d, entityId }: ArchetypeProps) {
  const lights = useRef<THREE.Group>(null);
  useFrame(() => {
    lights.current?.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.3 + 0.7 * Math.max(0, Math.sin(clock.t * (isActive(entityId) ? 9 : 2) + i * 1.7));
    });
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.85, 1.9, d * 0.75]} at={[0, 0.14, -d * 0.05]} c={C.wall} />
      <WindowBand w={w * 0.8} y={1.2} z={d * 0.325 + 0.01} h={0.5} />
      <Block size={[w * 0.55, 1.6, d * 0.5]} at={[-w * 0.1, 2.04, -d * 0.12]} c={C.wall} />
      <WindowBand w={w * 0.5} y={3.0} z={-d * 0.12 + d * 0.25 + 0.01} h={0.6} c={C.accent} />
      <group position={[w * 0.3, 2.04, -d * 0.2]}>
        <Cyl r={0.15} h={0.6} at={[0, 0, 0]} c={C.roofDark} seg={8} />
        <mesh position={[0, 0.85, 0]} rotation={[-0.7, 0.4, 0]} castShadow>
          <sphereGeometry args={[0.75, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
          <Mat c={C.wall} />
        </mesh>
      </group>
      <group ref={lights} position={[w * 0.43, 0.6, 0]}>
        {[-0.3, -0.1, 0.1, 0.3].map((k, i) => (
          <mesh key={k} position={[0.01, (i % 2) * 0.3, d * k]}>
            <boxGeometry args={[0.05, 0.12, 0.3]} />
            <meshStandardMaterial color={C.green} emissive={C.green} emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
      <Doors n={2} width={1.1} z={d * 0.325 + 0.02} spacing={w * 0.5} h={0.9} />
      <Beacon at={[-w * 0.3, 3.85, -d * 0.12]} entityId={entityId} />
    </group>
  );
}

/** GitLab — engineering workshop with a gantry crane. */
export function Workshop({ w, d, entityId }: ArchetypeProps) {
  const hook = useRef<THREE.Group>(null);
  useFrame(() => {
    if (hook.current) hook.current.position.x = Math.sin(clock.t * 0.5) * w * 0.25;
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.7, 2.0, d * 0.8]} at={[-w * 0.12, 0.14, 0]} c={C.wall} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-w * 0.12, 2.14 + 0.45, s * d * 0.2]} rotation={[s * 0.55, 0, 0]} castShadow>
          <boxGeometry args={[w * 0.72, 0.1, d * 0.47]} />
          <Mat c={C.roof} />
        </mesh>
      ))}
      <Panel size={[w * 0.7, 0.18, 0.05]} at={[-w * 0.12, 1.75, d * 0.4 + 0.02]} c={C.orange} />
      <Doors n={2} width={1.3} z={d * 0.4 + 0.02} spacing={w * 0.3} h={1.3} />
      {/* gantry */}
      <group position={[w * 0.05, 0.14, 0]}>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} r={0.08} h={3.2} at={[sx * w * 0.38, 0, sz * d * 0.42]} c={C.orange} seg={8} />),
        )}
        {[-1, 1].map((sz) => (
          <Panel key={sz} size={[w * 0.8, 0.16, 0.16]} at={[0, 3.25, sz * d * 0.42]} c={C.orange} />
        ))}
        <group ref={hook} position={[0, 3.1, 0]}>
          <Panel size={[0.3, 0.2, d * 0.86]} at={[0, 0.1, 0]} c={C.roofDark} />
          <Panel size={[0.04, 1.0, 0.04]} at={[0, -0.45, 0]} c={C.door} />
          <Block size={[0.5, 0.35, 0.5]} at={[0, -1.3, 0]} c={C.accent} r={0.05} />
        </group>
      </group>
      <Beacon at={[-w * 0.4, 2.4, d * 0.38]} entityId={entityId} />
    </group>
  );
}

/** Consumer office — glass tower with a rooftop chart. */
export function Office({ w, d, entityId }: ArchetypeProps) {
  const bars = useRef<THREE.Group>(null);
  useFrame(() => {
    bars.current?.children.forEach((b, i) => {
      b.scale.y = 0.6 + 0.4 * Math.abs(Math.sin(clock.t * 0.6 + i));
    });
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.9, 1.1, d * 0.6]} at={[0, 0.14, d * 0.12]} c={C.wall} />
      <WindowBand w={w * 0.8} y={0.7} z={d * 0.42 + 0.01} h={0.5} />
      <Block size={[w * 0.5, 4.8, d * 0.55]} at={[-w * 0.1, 0.14, -d * 0.12]} c={C.wall} />
      {[1.6, 2.4, 3.2, 4.0].map((y) => (
        <WindowBand key={y} w={w * 0.46} y={y} z={-d * 0.12 + d * 0.275 + 0.01} h={0.36} />
      ))}
      <group ref={bars} position={[-w * 0.1, 4.94, -d * 0.12]}>
        {[-0.5, -0.15, 0.2, 0.55].map((x, i) => (
          <mesh key={x} position={[x, 0, 0]} scale={[1, 1, 1]}>
            <boxGeometry args={[0.24, 1.0, 0.24]} />
            <Mat c={[C.accent, C.green, C.orange, C.accentDeep][i]!} />
          </mesh>
        ))}
      </group>
      <Beacon at={[w * 0.3, 1.45, d * 0.3]} entityId={entityId} />
    </group>
  );
}

/** Metadata catalog — archive with a rotating holographic city map. */
export function Archive({ w, d, entityId }: ArchetypeProps) {
  const holo = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (holo.current) holo.current.rotation.y += dt * 0.35;
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.85, 1.6, d * 0.75]} at={[0, 0.14, 0]} c={C.wall} />
      {[-0.3, -0.1, 0.1, 0.3].map((k) => (
        <Panel key={k} size={[w * 0.12, 0.9, 0.05]} at={[w * k, 0.9, d * 0.375 + 0.01]} c={C.glass} />
      ))}
      <Cyl r={1.2} h={0.5} at={[0, 1.74, 0]} c={C.roof} />
      <group ref={holo} position={[0, 2.9, 0]}>
        <mesh>
          <cylinderGeometry args={[1.6, 1.6, 0.04, 48]} />
          <meshStandardMaterial color={C.accent} transparent opacity={0.25} emissive={C.accent} emissiveIntensity={0.5} />
        </mesh>
        {[-0.8, 0, 0.8].map((x) =>
          [-0.6, 0.4].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.18, z]}>
              <boxGeometry args={[0.35, 0.3 + Math.abs(x + z) * 0.3, 0.35]} />
              <meshStandardMaterial color={C.accent} transparent opacity={0.45} emissive={C.accent} emissiveIntensity={0.6} />
            </mesh>
          )),
        )}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.6, 0.03, 8, 64]} />
          <meshStandardMaterial color={C.accentDeep} emissive={C.accentDeep} emissiveIntensity={0.6} />
        </mesh>
      </group>
      <Beacon at={[w * 0.36, 1.95, d * 0.3]} entityId={entityId} />
    </group>
  );
}

/** Нить — context tower with rotating rings. */
export function Tower({ w, entityId }: ArchetypeProps) {
  const rings = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    rings.current?.children.forEach((r, i) => {
      r.rotation.y += dt * (0.4 + i * 0.3) * (i % 2 ? -1 : 1);
    });
  });
  const r = w * 0.18;
  return (
    <group>
      <Cyl r={w * 0.4} h={0.3} at={[0, 0, 0]} c={C.wallShade} seg={32} />
      <Cyl r={r * 1.3} h={1.2} at={[0, 0.3, 0]} c={C.wall} seg={32} />
      <Cyl r={r} rTop={r * 0.7} h={5.5} at={[0, 1.5, 0]} c={C.wall} seg={32} />
      <mesh position={[0, 7.2, 0]}>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshStandardMaterial color="#b36ef0" emissive="#b36ef0" emissiveIntensity={0.9} />
      </mesh>
      <group ref={rings}>
        {[2.6, 4.0, 5.4].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2 + (i - 1) * 0.25, 0, 0]}>
            <torusGeometry args={[r * 2.2 - i * 0.2, 0.05, 8, 48]} />
            <meshStandardMaterial color="#b36ef0" emissive="#b36ef0" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
      <Beacon at={[r * 1.3, 1.3, r * 0.9]} entityId={entityId} />
    </group>
  );
}

/** Employee node — person on a pad with an orbiting assistant. */
export function EmployeeNodeModel({ entityId }: ArchetypeProps) {
  const orb = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (orb.current) orb.current.rotation.y = clock.t * 1.5;
    if (ring.current) {
      const a = activity.active.get(entityId);
      const s = a ? 1 + 0.15 * Math.sin(clock.t * 6) : 1;
      ring.current.scale.set(s, s, s);
      const m = ring.current.material as THREE.MeshStandardMaterial;
      m.color.set(a === 'manual' ? C.yellow : '#b36ef0');
      m.emissive.set(a === 'manual' ? C.yellow : '#b36ef0');
    }
  });
  return (
    <group>
      <Cyl r={0.8} h={0.1} at={[0, 0, 0]} c={C.wall} seg={32} />
      <mesh ref={ring} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.66, 0.78, 40]} />
        <meshStandardMaterial color="#b36ef0" emissive="#b36ef0" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.42, 6, 16]} />
        <Mat c={C.accent} />
      </mesh>
      <mesh position={[0, 1.08, 0]} castShadow>
        <sphereGeometry args={[0.17, 16, 16]} />
        <Mat c="#f6dccb" />
      </mesh>
      <group ref={orb} position={[0, 1.2, 0]}>
        <mesh position={[0.55, 0.1, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#b36ef0" emissive="#b36ef0" emissiveIntensity={1} />
        </mesh>
      </group>
    </group>
  );
}
