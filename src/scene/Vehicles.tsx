import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { clock } from '@/sim/clock';
import { sampleRun, type Run } from '@/sim/engine';
import { pathLength, samplePath } from '@/space/routing';
import type { Vec2T } from '@/space/schema';
import { useCity } from '@/store/city';
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
  const cargoIds = run.phases.map((p) => p.cargoId).filter(Boolean);

  useFrame((_, dt) => {
    if (!g.current) return;
    const s = sampleRun(run, clock.t, ctx);
    if (!s.vehicle) {
      g.current.visible = false;
      return;
    }
    g.current.visible = true;
    const h = s.vehicle.heading;
    heading.current = lerpAngle(heading.current, h, Math.min(dt * 10, 1));
    const ox = -Math.cos(heading.current) * LANE;
    const oz = Math.sin(heading.current) * LANE;
    g.current.position.set(s.vehicle.at[0] + ox, 0.08, s.vehicle.at[1] + oz);
    g.current.rotation.y = heading.current;
    const box = g.current.getObjectByName('container') as THREE.Mesh | undefined;
    if (box) {
      const m = box.material as THREE.MeshStandardMaterial;
      const hasCargo = !!s.vehicle.cargoId && index.get(s.vehicle.cargoId)?.kind === 'dataProduct';
      m.color.set(violation ? C.red : hasCargo ? (run.source === 'live' ? '#4fb3a9' : C.accent) : C.wallShade);
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
      <TruckBody cargo={cargoIds.length ? C.accent : C.wallShade} />
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
  ['b.w', 'b.e', 'v.bi', 'v.istok', 'r.x3', 'r.x2', 'r.dp', 'r.x1', 'b.w'],
  ['t.x1', 't.meta', 't.x2', 't.nit', 't.x3', 'r.x3', 'r.wh', 'r.x2', 'r.dp', 'r.x1', 't.x1'],
  ['r.w', 'r.eva', 'r.x1', 't.x1', 't.git', 't.w', 't.git', 't.x1', 'r.x1', 'r.eva', 'r.w'],
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
