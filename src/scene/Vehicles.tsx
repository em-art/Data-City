import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { clock, traffic } from '@/sim/clock';
import { sampleRun, type Run } from '@/sim/engine';
import { pathLength, samplePath } from '@/space/routing';
import type { Vec2T } from '@/space/schema';
import { useCity } from '@/store/city';
import { LAYER_COLOR } from './archetypesDp';
import { BELT_Y } from './Conveyor';
import { C } from './look';

const LANE = 0.6;

function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function TruckBody({ cargo, cab = C.wall, wheels = '#5b6383' }: { cargo: string; cab?: string; wheels?: string }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0.85]} castShadow>
        <boxGeometry args={[0.95, 0.75, 0.7]} />
        <meshStandardMaterial color={cab} />
      </mesh>
      <mesh position={[0, 0.7, 1.205]}>
        <boxGeometry args={[0.8, 0.3, 0.02]} />
        <meshStandardMaterial color={C.glassDark} />
      </mesh>
      <mesh name="container" position={[0, 0.68, -0.25]} castShadow>
        <boxGeometry args={[1.0, 1.0, 1.7]} />
        <meshStandardMaterial color={cargo} />
      </mesh>
      <mesh position={[0, 0.2, 0.1]}>
        <boxGeometry args={[0.9, 0.12, 2.3]} />
        <meshStandardMaterial color={C.roofDark} />
      </mesh>
      {[-0.55, 0.85].map((z) =>
        [-0.48, 0.48].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.16, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.12, 12]} />
            <meshStandardMaterial color={wheels} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** A truck that follows a compiled run (demo or live). */
function RunTruck({ run }: { run: Run }) {
  const g = useRef<THREE.Group>(null);
  const heading = useRef(0);
  const ctx = useCity((s) => s.ctx);
  const index = useCity((s) => s.index);
  const id = `run:${run.id}`;
  const selected = useCity((s) => s.selectedId === id);
  const view = useCity((s) => s.view);
  const select = useCity((s) => s.select);
  const violation = run.phases.some((p) => p.routeViolation);
  useEffect(() => () => void traffic.vehicles.delete(run.id), [run.id]);
  const cargoIds = run.phases.map((p) => p.cargoId).filter(Boolean);

  useFrame((_, dt) => {
    if (!g.current) return;
    const s = sampleRun(run, clock.t, ctx);
    if (!s.vehicle) {
      g.current.visible = false;
      traffic.vehicles.delete(run.id);
      return;
    }
    g.current.visible = true;
    const h = s.vehicle.heading;
    heading.current = lerpAngle(heading.current, h, Math.min(dt * 10, 1));
    const ox = -Math.cos(heading.current) * LANE;
    const oz = Math.sin(heading.current) * LANE;
    const mode = s.vehicle.mode;
    const onRoad = mode === 'truck';
    g.current.position.set(s.vehicle.at[0] + (onRoad ? ox : 0), mode === 'belt' ? BELT_Y : 0.08, s.vehicle.at[1] + (onRoad ? oz : 0));
    g.current.rotation.y = heading.current;
    if (onRoad) traffic.vehicles.set(run.id, [s.vehicle.at[0], s.vehicle.at[1]]);
    else traffic.vehicles.delete(run.id);
    const truck = g.current.getObjectByName('truck');
    const orb = g.current.getObjectByName('pipe');
    const crate = g.current.getObjectByName('crate') as THREE.Mesh | undefined;
    if (truck) truck.visible = onRoad;
    if (orb) {
      orb.visible = mode === 'pipe';
      orb.position.y = 0.9 + 0.15 * Math.sin(clock.t * 8);
    }
    if (crate) crate.visible = mode === 'belt';
    for (const box of [g.current.getObjectByName('container') as THREE.Mesh | undefined, crate]) {
      if (!box) continue;
      const m = box.material as THREE.MeshStandardMaterial;
      const cargo = s.vehicle.cargoId ? index.get(s.vehicle.cargoId) : undefined;
      const layer = cargo?.kind === 'dataProduct' && cargo.layerId ? index.get(cargo.layerId) : undefined;
      const layerColor = layer?.kind === 'layer' ? LAYER_COLOR[layer.layer] : undefined;
      m.color.set(violation ? C.red : run.source === 'live' && cargo ? '#4fb3a9' : (layerColor ?? (cargo ? C.accent : C.wallShade)));
    }
  });

  const showTag = selected || view === 'data' || view === 'process';
  return (
    <group
      ref={g}
      visible={false}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select(id);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <group name="truck">
        <TruckBody cargo={cargoIds.length ? C.accent : C.wallShade} />
      </group>
      {/* Pattern A: data is read in place — a pulse travels, nothing is copied */}
      <group name="pipe" visible={false}>
        <mesh>
          <sphereGeometry args={[0.45, 20, 20]} />
          <meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={1.2} transparent opacity={0.85} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.75, 0.05, 8, 32]} />
          <meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={0.8} />
        </mesh>
      </group>
      {/* on the Nessie belt the cargo rides as a crate */}
      <mesh name="crate" visible={false} position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.8, 0.62, 0.8]} />
        <meshStandardMaterial color={C.accent} metalness={0.35} roughness={0.4} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.75, 40]} />
          <meshBasicMaterial color={C.accent} transparent opacity={0.6} />
        </mesh>
      )}
      {showTag && (
        <Html position={[0, 2.1, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`tag ${run.source === 'live' ? 'tag--live' : ''} ${violation ? 'tag--bad' : ''}`}>{run.id}</div>
        </Html>
      )}
    </group>
  );
}

/** Decorative traffic — explicitly not data. Clicking explains that. */
function AmbientCar({ loop, offset, color }: { loop: Vec2T[]; offset: number; color: string }) {
  const g = useRef<THREE.Group>(null);
  const select = useCity((s) => s.select);
  const L = useMemo(() => pathLength(loop), [loop]);
  useFrame(({ clock: c }) => {
    if (!g.current || L === 0) return;
    const u = ((c.elapsedTime * 2.2) / L + offset) % 1;
    const s = samplePath(loop, u);
    g.current.position.set(s.at[0] - Math.cos(s.heading) * LANE, 0.08, s.at[1] + Math.sin(s.heading) * LANE);
    traffic.vehicles.set(`ambient-${offset}`, [s.at[0], s.at[1]]);
    g.current.rotation.y = lerpAngle(g.current.rotation.y, s.heading, 0.2);
  });
  return (
    <group
      ref={g}
      scale={0.7}
      onClick={(e) => {
        e.stopPropagation();
        select('ambient');
      }}
    >
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.9, 0.7, 1.7]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.6, 0.86]}>
        <boxGeometry args={[0.75, 0.3, 0.02]} />
        <meshStandardMaterial color={C.glassDark} />
      </mesh>
    </group>
  );
}

const LOOPS: string[][] = [
  ['s.wj', 's.ej', 'e.bi', 'e.istok', 'm.ej', 'm.cube', 'm.bronze', 'm.lab', 'm.landing', 'm.dlt', 'm.wj', 's.wj'],
  ['n.wj', 'n.trino', 'n.mid', 'n.ceph', 'n.obs', 'n.ej', 'm.ej', 'm.cube', 'm.bronze', 'm.lab', 'm.landing', 'm.dlt', 'm.wj', 'n.wj'],
  ['m.w', 'm.eva', 'm.api', 'm.wj', 'n.wj', 'n.git', 'n.w', 'm.w'],
];

export function Vehicles() {
  const runs = useCity((s) => s.runs);
  const nodes = useCity((s) => s.ctx.graph.nodes);
  const loops = useMemo(
    () => LOOPS.map((ids) => ids.map((id) => nodes.get(id)).filter((p): p is Vec2T => !!p)).filter((l) => l.length > 1),
    [nodes],
  );
  return (
    <>
      {runs.map((r) => (
        <RunTruck key={r.id} run={r} />
      ))}
      {loops.map((l, i) => (
        <AmbientCar key={i} loop={l} offset={i * 0.37} color={['#ffffff', '#dfe5f7', '#f2e6da'][i]!} />
      ))}
    </>
  );
}
