/**
 * Data Platform archetypes: Medallion layer halls and the platform services
 * (Trino, Dagster, Ceph, Nessie, dlt, JupyterHub, Traefik, Infisical,
 * observability). Same conventions as archetypes.tsx: local space,
 * footprint w × d, dock facing +Z.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { activity, clock } from '@/sim/clock';
import type { ArchetypeProps } from './archetypes';
import { Block, C, Cyl, Mat, Panel } from './look';

const isActive = (id: string) => activity.active.has(id);

export const LAYER_COLOR: Record<string, string> = {
  landing: '#8fa3c7',
  bronze: '#c98a4b',
  silver: '#a9b3c9',
  gold: '#e2b23a',
  sandbox: '#b07ee8',
};

function Plinth({ w, d }: { w: number; d: number }) {
  return <Block size={[w + 0.5, 0.14, d + 0.5]} c={C.wallShade} r={0.06} shadow={false} />;
}

/** Status light that pulses while the object is working. */
function Beacon({ at, entityId, color = C.green }: { at: [number, number, number]; entityId: string; color?: string }) {
  const m = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!m.current) return;
    const a = activity.active.get(entityId);
    m.current.color.set(a === 'manual' ? C.yellow : a ? color : '#c9cfe6');
    m.current.emissive.set(a === 'manual' ? C.yellow : a ? color : '#000000');
    m.current.emissiveIntensity = a ? 0.6 + 0.4 * Math.sin(clock.t * 6) : 0;
  });
  return (
    <mesh position={at}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshStandardMaterial ref={m} color="#c9cfe6" />
    </mesh>
  );
}

function Doors({ n, z, spacing, width = 1.1, h = 1.3 }: { n: number; z: number; spacing: number; width?: number; h?: number }) {
  const x0 = -((n - 1) * spacing) / 2;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[x0 + i * spacing, 0.14, z]}>
          <Panel size={[width, h, 0.06]} at={[0, h / 2, 0]} c={C.door} />
          {[0.3, 0.6].map((k) => (
            <Panel key={k} size={[width * 0.96, 0.03, 0.08]} at={[0, h * k, 0]} c={C.wall} />
          ))}
        </group>
      ))}
    </>
  );
}

/** Medallion layer hall. Accent = layer colour; silver/gold are metallic. */
export function LayerHall({ w, d, entityId, accent = C.accent }: ArchetypeProps) {
  const rollers = useRef<THREE.Group>(null);
  const metal = accent === LAYER_COLOR.gold || accent === LAYER_COLOR.silver ? 0.55 : 0.05;
  useFrame((_, dt) => {
    if (!rollers.current) return;
    const v = isActive(entityId) ? 1.6 : 0.2;
    rollers.current.children.forEach((c) => {
      c.position.x += dt * v;
      if (c.position.x > w * 0.42) c.position.x = -w * 0.42;
    });
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.9, 2.3, d * 0.62]} at={[0, 0.14, -d * 0.12]} c={C.wall} />
      {/* barrel roof in layer colour */}
      <mesh position={[0, 2.44, -d * 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[d * 0.31, d * 0.31, w * 0.9, 28, 1, false, 0, Math.PI]} />
        <Mat c={accent} metal={metal} rough={metal > 0.3 ? 0.35 : 0.7} />
      </mesh>
      {[-0.28, 0, 0.28].map((k) => (
        <Panel key={k} size={[w * 0.12, 0.05, d * 0.4]} at={[w * k, 2.44 + d * 0.3, -d * 0.12]} c={C.glass} />
      ))}
      {/* layer band and doors */}
      <Panel size={[w * 0.9, 0.22, 0.05]} at={[0, 2.0, d * 0.19 + 0.01]} c={accent} />
      <Doors n={3} z={d * 0.19 + 0.02} spacing={w * 0.28} />
      {/* outdoor conveyor along the apron with crates in layer colour */}
      <Block size={[w * 0.9, 0.14, 0.7]} at={[0, 0.5, d * 0.36]} c={C.roofDark} r={0.04} />
      {[-0.4, 0, 0.4].map((k) => (
        <Cyl key={k} r={0.05} h={0.36} at={[w * k, 0.14, d * 0.36]} c={C.door} seg={6} />
      ))}
      <group ref={rollers} position={[0, 0.64, d * 0.36]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-w * 0.42 + i * w * 0.22, 0.17, 0]} castShadow>
            <boxGeometry args={[0.5, 0.34, 0.5]} />
            <Mat c={accent} metal={metal} rough={0.5} />
          </mesh>
        ))}
      </group>
      {/* layer pylon */}
      <group position={[w * 0.44, 0.14, d * 0.2]}>
        <Block size={[0.5, 3.4, 0.5]} c={C.wall} r={0.06} />
        <mesh position={[0, 3.6, 0]}>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <Mat c={accent} metal={metal} rough={0.35} />
        </mesh>
      </group>
      <Beacon at={[-w * 0.42, 2.6, d * 0.18]} entityId={entityId} color={accent} />
    </group>
  );
}

/** Trino — round query hub with a federation ring and outgoing pipes. */
export function QueryHub({ w, entityId }: ArchetypeProps) {
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.y += dt * (isActive(entityId) ? 1.8 : 0.25);
  });
  const R = w * 0.32;
  return (
    <group>
      <Cyl r={R + 0.6} h={0.14} at={[0, 0, 0]} c={C.wallShade} seg={40} />
      <Cyl r={R} h={2.4} at={[0, 0.14, 0]} c={C.wall} seg={40} />
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[R + 0.02, R + 0.02, 0.6, 40, 1, true]} />
        <meshStandardMaterial color={C.glass} emissive={C.glass} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 2.54, 0]} castShadow>
        <sphereGeometry args={[R * 0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat c={C.roof} />
      </mesh>
      <Cyl r={0.25} h={1.4} at={[0, 2.54 + R * 0.7, 0]} c={C.accentDeep} seg={12} />
      <group ref={ring} position={[0, 3.1 + R * 0.4, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R * 1.05, 0.08, 10, 64]} />
          <meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={0.5} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI) / 3) * R * 1.05, 0, Math.sin((i * Math.PI) / 3) * R * 1.05]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial color={C.orange} emissive={C.orange} emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
      {/* pipes: catalogs reaching out */}
      {[0.4, 1.9, 3.5, 5.0].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh position={[R + 0.9, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 1.8, 12]} />
            <Mat c={C.roofDark} />
          </mesh>
          <Cyl r={0.3} h={0.9} at={[R + 1.8, 0.14, 0]} c={C.wall} seg={16} />
        </group>
      ))}
      <Doors n={1} z={R - 0.05} spacing={1} width={1.4} h={1.4} />
      <Beacon at={[0, 4.3 + R * 0.4, 0]} entityId={entityId} />
    </group>
  );
}

/** Dagster — control tower with a schedule board of materialising assets. */
export function ControlTower({ w, d, entityId }: ArchetypeProps) {
  const radar = useRef<THREE.Group>(null);
  const board = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (radar.current) radar.current.rotation.y += dt * 1.2;
    board.current?.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const lit = isActive(entityId) ? Math.floor(clock.t * 3) % 6 >= i % 6 : i % 3 === 0;
      m.emissiveIntensity = lit ? 0.8 : 0.05;
    });
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.8, 1.6, d * 0.6]} at={[0, 0.14, -d * 0.1]} c={C.wall} />
      <group ref={board} position={[-w * 0.05, 0.6, d * 0.2 + 0.02]}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[((i % 6) - 2.5) * 0.55, Math.floor(i / 6) * 0.42, 0]}>
            <boxGeometry args={[0.42, 0.3, 0.04]} />
            <meshStandardMaterial color={i % 4 === 3 ? C.orange : C.green} emissive={i % 4 === 3 ? C.orange : C.green} emissiveIntensity={0.1} />
          </mesh>
        ))}
      </group>
      <Cyl r={0.7} h={4.6} at={[w * 0.18, 1.74, -d * 0.15]} c={C.wall} seg={24} />
      <group position={[w * 0.18, 6.3, -d * 0.15]}>
        <mesh>
          <cylinderGeometry args={[1.25, 0.95, 1.0, 8]} />
          <meshStandardMaterial color={C.glass} emissive={C.glass} emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[1.4, 1.4, 0.2, 8]} />
          <Mat c={C.accentDeep} />
        </mesh>
        <group ref={radar} position={[0, 0.9, 0]}>
          <Panel size={[1.4, 0.1, 0.25]} at={[0.4, 0.2, 0]} c={C.wall} />
          <Cyl r={0.06} h={0.3} at={[0, 0, 0]} c={C.roofDark} seg={6} />
        </group>
      </group>
      <Beacon at={[-w * 0.35, 1.95, d * 0.15]} entityId={entityId} />
    </group>
  );
}

/** Ceph RGW — a silo per bucket, banded with the layer colour. */
export function Silos({ w, d, entityId }: ArchetypeProps) {
  const layers = ['landing', 'bronze', 'silver', 'gold', 'sandbox'];
  const step = (w * 0.85) / layers.length;
  return (
    <group>
      <Plinth w={w} d={d} />
      {layers.map((l, i) => {
        const x = -w * 0.425 + step * (i + 0.5);
        const h = 3.4 + (i % 2) * 0.5;
        return (
          <group key={l} position={[x, 0.14, -d * 0.12]}>
            <Cyl r={step * 0.42} h={h} at={[0, 0, 0]} c={C.wall} seg={28} />
            <mesh position={[0, h * 0.62, 0]}>
              <cylinderGeometry args={[step * 0.425, step * 0.425, 0.45, 28]} />
              <Mat c={LAYER_COLOR[l]!} metal={l === 'gold' || l === 'silver' ? 0.5 : 0.05} rough={0.4} />
            </mesh>
            <mesh position={[0, h, 0]} castShadow>
              <sphereGeometry args={[step * 0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <Mat c={C.roof} />
            </mesh>
          </group>
        );
      })}
      <Panel size={[w * 0.85, 0.08, 0.5]} at={[0, 3.3, -d * 0.12]} c={C.roofDark} />
      <Block size={[w * 0.4, 1.3, d * 0.28]} at={[-w * 0.15, 0.14, d * 0.28]} c={C.wall} />
      <Panel size={[w * 0.36, 0.35, 0.05]} at={[-w * 0.15, 0.95, d * 0.42 + 0.01]} c={C.glass} />
      <Beacon at={[w * 0.3, 0.6, d * 0.3]} entityId={entityId} />
    </group>
  );
}

/** Nessie — switchyard: main track, a dev branch and wagons merging back. */
export function Switchyard({ w, d, entityId }: ArchetypeProps) {
  const wagon = useRef<THREE.Group>(null);
  const L = w * 0.85;
  const branch: [number, number][] = [
    [-L / 2, d * 0.32],
    [-L / 4, d * 0.05],
    [L / 4, d * 0.05],
    [L / 2, d * 0.32],
  ];
  useFrame(() => {
    if (!wagon.current) return;
    const speed = isActive(entityId) ? 0.5 : 0.12;
    const u = (clock.t * speed) % 1;
    // traverse the branch polyline
    const segs = branch.length - 1;
    const k = u * segs;
    const i = Math.min(Math.floor(k), segs - 1);
    const f = k - i;
    const a = branch[i]!;
    const b = branch[i + 1]!;
    wagon.current.position.set(a[0] + (b[0] - a[0]) * f, 0.3, a[1] + (b[1] - a[1]) * f);
    wagon.current.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.PI / 2;
  });
  const rail = (a: [number, number], b: [number, number], c: string, key: string) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    return (
      <mesh key={key} position={[(a[0] + b[0]) / 2, 0.2, (a[1] + b[1]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]}>
        <boxGeometry args={[0.35, 0.08, Math.hypot(dx, dz) + 0.2]} />
        <meshStandardMaterial color={c} />
      </mesh>
    );
  };
  return (
    <group>
      <Plinth w={w} d={d} />
      {/* main */}
      {rail([-L / 2, d * 0.32], [L / 2, d * 0.32], C.accentDeep, 'main')}
      {/* dev branch */}
      {branch.slice(1).map((p, i) => rail(branch[i]!, p, '#b07ee8', `b${i}`))}
      <group ref={wagon}>
        <Block size={[0.9, 0.5, 0.5]} c={C.orange} r={0.06} />
      </group>
      <Block size={[w * 0.55, 2.0, d * 0.4]} at={[0, 0.14, -d * 0.22]} c={C.wall} />
      <Panel size={[w * 0.5, 0.4, 0.05]} at={[0, 1.5, -d * 0.02 + 0.01]} c={C.glass} />
      <Block size={[w * 0.6, 0.14, d * 0.44]} at={[0, 2.14, -d * 0.22]} c={C.roof} r={0.04} />
      {/* signal mast */}
      <group position={[-w * 0.38, 0.14, -d * 0.1]}>
        <Cyl r={0.06} h={2.2} at={[0, 0, 0]} c={C.door} seg={6} />
        <Block size={[0.35, 0.7, 0.2]} at={[0, 2.2, 0]} c={C.roofDark} r={0.05} />
      </group>
      <Beacon at={[-w * 0.38, 2.6, -d * 0.1]} entityId={entityId} color="#b07ee8" />
    </group>
  );
}

/** dlt — open ingestion dock with a conveyor carrying raw crates in. */
export function IngestDock({ w, d, entityId }: ArchetypeProps) {
  const belt = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const v = isActive(entityId) ? 1.5 : 0.15;
    belt.current?.children.forEach((c) => {
      c.position.z -= dt * v;
      if (c.position.z < -d * 0.35) c.position.z = d * 0.45;
    });
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      {/* canopy on posts */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} r={0.1} h={2.4} at={[sx * w * 0.42, 0.14, sz * d * 0.38]} c={C.door} seg={8} />),
      )}
      <Block size={[w * 0.95, 0.16, d * 0.85]} at={[0, 2.5, 0]} c={C.roof} r={0.05} />
      <Panel size={[w * 0.95, 0.2, 0.05]} at={[0, 2.45, d * 0.425]} c={LAYER_COLOR.landing!} />
      <Block size={[w * 0.4, 1.8, d * 0.5]} at={[-w * 0.22, 0.14, -d * 0.15]} c={C.wall} />
      {/* conveyor */}
      <Block size={[0.8, 0.12, d * 0.85]} at={[w * 0.22, 0.6, 0.05]} c={C.roofDark} r={0.04} />
      <group ref={belt} position={[w * 0.22, 0.86, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} size={[0.5, 0.36, 0.5]} at={[0, -0.14, -d * 0.35 + i * d * 0.2]} c={LAYER_COLOR.landing!} r={0.05} />
        ))}
      </group>
      <Beacon at={[-w * 0.4, 2.1, d * 0.1]} entityId={entityId} />
    </group>
  );
}

/** JupyterHub — lab with a glass dome. */
export function Lab({ w, d, entityId }: ArchetypeProps) {
  const orbit = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (orbit.current) orbit.current.rotation.y += dt * 0.9;
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.85, 1.5, d * 0.7]} at={[0, 0.14, 0]} c={C.wall} />
      <Panel size={[w * 0.8, 0.4, 0.05]} at={[0, 1.0, d * 0.35 + 0.01]} c={C.glass} />
      <mesh position={[0, 1.64, 0]}>
        <sphereGeometry args={[Math.min(w, d) * 0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={C.glass} transparent opacity={0.55} roughness={0.1} />
      </mesh>
      <group ref={orbit} position={[0, 2.1, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos(i * 2.1) * 0.6, Math.sin(i) * 0.2, Math.sin(i * 2.1) * 0.6]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color={C.orange} emissive={C.orange} emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
      <Panel size={[w * 0.85, 0.16, 0.05]} at={[0, 1.4, d * 0.35 + 0.02]} c={C.orange} />
      <Beacon at={[w * 0.36, 1.9, d * 0.3]} entityId={entityId} />
    </group>
  );
}

/** Traefik — gatehouse with an arch: the way in for people and UIs. */
export function Gatehouse({ w, d, entityId }: ArchetypeProps) {
  return (
    <group>
      <Plinth w={w} d={d} />
      {[-1, 1].map((s) => (
        <Block key={s} size={[0.4, 2.6, 0.4]} at={[s * w * 0.4, 0.14, 0]} c={C.wall} r={0.06} />
      ))}
      <Block size={[w * 0.95, 0.45, 0.5]} at={[0, 2.74, 0]} c={C.accent} r={0.08} />
      <Block size={[w * 0.35, 1.2, d * 0.3]} at={[0, 0.14, -d * 0.25]} c={C.wall} />
      <Panel size={[w * 0.3, 0.3, 0.05]} at={[0, 0.9, -d * 0.1 + 0.01]} c={C.glass} />
      <Beacon at={[0, 3.4, 0]} entityId={entityId} />
    </group>
  );
}

/** Infisical — vault with a slowly turning round door. */
export function Vault({ w, d, entityId }: ArchetypeProps) {
  const door = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (door.current) door.current.rotation.z += dt * 0.4;
  });
  return (
    <group>
      <Plinth w={w} d={d} />
      <Block size={[w * 0.8, 2.2, d * 0.75]} at={[0, 0.14, 0]} c={C.roofDark} r={0.2} />
      <Block size={[w * 0.84, 0.2, d * 0.8]} at={[0, 2.34, 0]} c={C.wallShade} r={0.06} />
      <group ref={door} position={[0, 1.2, d * 0.375 + 0.04]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.75, 0.75, 0.1, 32]} />
          <Mat c="#d9dde9" metal={0.6} rough={0.3} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0, 0.07]} rotation={[0, 0, (i * Math.PI) / 3]}>
            <boxGeometry args={[1.1, 0.08, 0.05]} />
            <Mat c={C.accentDeep} />
          </mesh>
        ))}
      </group>
      <Beacon at={[w * 0.32, 2.6, d * 0.3]} entityId={entityId} />
    </group>
  );
}

/** Observability — lattice tower with a live screen and a sweeping light. */
export function Watchtower({ w, d, entityId }: ArchetypeProps) {
  const bars = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    bars.current?.children.forEach((b, i) => {
      b.scale.y = 0.4 + 0.6 * Math.abs(Math.sin(clock.t * 0.9 + i * 0.8));
    });
    if (lamp.current) lamp.current.rotation.y += dt * 1.5;
  });
  const s = Math.min(w, d) * 0.3;
  return (
    <group>
      <Plinth w={w} d={d} />
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => <Cyl key={`${x}${z}`} r={0.08} h={5} at={[x * s, 0.14, z * s]} c={C.door} seg={6} />),
      )}
      {[1.6, 3.2].map((y) => (
        <Panel key={y} size={[s * 2.2, 0.08, s * 2.2]} at={[0, y, 0]} c={C.roofDark} />
      ))}
      <Block size={[s * 2.6, 0.2, s * 2.6]} at={[0, 5.1, 0]} c={C.wall} r={0.05} />
      <group position={[0, 4.0, s + 0.12]}>
        <Panel size={[s * 2.4, 1.3, 0.06]} at={[0, 0, 0]} c="#1f2336" />
        <group ref={bars} position={[-s * 0.9, -0.5, 0.05]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[i * s * 0.45, 0.45, 0]}>
              <boxGeometry args={[s * 0.3, 0.9, 0.02]} />
              <meshStandardMaterial color={C.green} emissive={C.green} emissiveIntensity={0.7} />
            </mesh>
          ))}
        </group>
      </group>
      <group ref={lamp} position={[0, 5.5, 0]}>
        <mesh position={[0.3, 0, 0]}>
          <boxGeometry args={[0.5, 0.25, 0.25]} />
          <meshStandardMaterial color={C.yellow} emissive={C.yellow} emissiveIntensity={0.8} />
        </mesh>
      </group>
      <Beacon at={[s, 5.5, s]} entityId={entityId} />
    </group>
  );
}
