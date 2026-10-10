/**
 * Conveyor belts (Nessie). The belt is an entity in its own right:
 * clicking it opens Nessie in the inspector. Crates flow continuously and
 * take the colour of the last Medallion station they passed.
 */
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { activity } from '@/sim/clock';
import { pathLength, samplePath } from '@/space/routing';
import type { SpaceModelT, Vec2T } from '@/space/schema';
import { useCity } from '@/store/city';
import { LAYER_COLOR } from './archetypesDp';
import { C, LensContext, lensFor, Mat } from './look';

export const BELT_Y = 0.75;
const BELT_W = 1.5;

type Belt = SpaceModelT['belts'][number];

function Segment({ a, b, selected }: { a: Vec2T; b: Vec2T; selected: boolean }) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const legs = Math.max(1, Math.floor(len / 2.2));
  return (
    <group position={[(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]}>
      <mesh position={[0, BELT_Y - 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[BELT_W, 0.18, len + BELT_W * 0.6]} />
        <Mat c={C.roofDark} />
      </mesh>
      <mesh position={[0, BELT_Y - 0.02, 0]}>
        <boxGeometry args={[BELT_W * 0.82, 0.03, len + BELT_W * 0.5]} />
        <Mat c={selected ? '#9b6cf0' : '#4c5470'} rough={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * BELT_W) / 2, BELT_Y + 0.04, 0]}>
          <boxGeometry args={[0.07, 0.12, len + BELT_W * 0.6]} />
          <Mat c="#b07ee8" emissive="#b07ee8" glow={0.25} />
        </mesh>
      ))}
      {Array.from({ length: legs }, (_, i) => (
        <mesh key={i} position={[0, (BELT_Y - 0.2) / 2, -len / 2 + (len / legs) * (i + 0.5)]}>
          <boxGeometry args={[BELT_W * 0.7, BELT_Y - 0.2, 0.12]} />
          <Mat c={C.door} />
        </mesh>
      ))}
    </group>
  );
}

/** Station colours along a loop: crates are recoloured as they pass a station. */
function useLoopColors(belt: Belt, loop: string[]) {
  const placements = useCity((s) => s.space.placements);
  const index = useCity((s) => s.index);
  return useMemo(() => {
    const nodes = new Map(belt.nodes.map((n) => [n.id, n.at] as const));
    const pts = loop.map((id) => nodes.get(id)).filter((p): p is Vec2T => !!p);
    const marks: { d: number; color: string }[] = [];
    let acc = 0;
    loop.forEach((id, i) => {
      if (i > 0) acc += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
      const pl = placements.find((p) => p.beltNode === id);
      const e = pl ? index.get(pl.entityId) : undefined;
      if (e?.kind === 'layer') marks.push({ d: acc, color: LAYER_COLOR[e.layer]! });
    });
    return { pts, total: pathLength(pts), marks };
  }, [belt, loop, placements, index]);
}

function Flow({ belt, loop, count, speed }: { belt: Belt; loop: string[]; count: number; speed: number }) {
  const { pts, total, marks } = useLoopColors(belt, loop);
  const group = useRef<THREE.Group>(null);
  const offset = useRef(0);
  useFrame((_, dt) => {
    if (!group.current || total === 0) return;
    const busy = activity.active.has(belt.entityId);
    offset.current = (offset.current + dt * speed * (busy ? 2.4 : 1)) % total;
    group.current.children.forEach((c, i) => {
      const d = (offset.current + (total / count) * i) % total;
      const s = samplePath(pts, d / total);
      c.position.set(s.at[0], BELT_Y + 0.25, s.at[1]);
      c.rotation.y = s.heading;
      const color = [...marks].reverse().find((m) => m.d <= d)?.color ?? LAYER_COLOR.landing!;
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(color);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} castShadow>
          <boxGeometry args={[0.6, 0.45, 0.6]} />
          <meshStandardMaterial color={LAYER_COLOR.landing} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function BeltView({ belt }: { belt: Belt }) {
  const view = useCity((s) => s.view);
  const index = useCity((s) => s.index);
  const process = useCity((s) => s.process);
  const selected = useCity((s) => s.selectedId === belt.entityId);
  const select = useCity((s) => s.select);
  const lens = useMemo(() => lensFor(view, belt.entityId, index, process), [view, belt.entityId, index, process]);
  const nodes = useMemo(() => new Map(belt.nodes.map((n) => [n.id, n.at] as const)), [belt]);
  const main = belt.loops[0] ?? [];
  const labelAt = nodes.get(main[Math.floor(main.length / 2)] ?? '') ?? belt.nodes[0]?.at ?? [0, 0];
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select(belt.entityId);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <LensContext.Provider value={lens}>
        {belt.edges.map(([a, b]) => (
          <Segment key={`${a}-${b}`} a={nodes.get(a)!} b={nodes.get(b)!} selected={selected} />
        ))}
      </LensContext.Provider>
      {lens !== 'dim' &&
        belt.loops.map((loop, i) => <Flow key={i} belt={belt} loop={loop} count={i === 0 ? 14 : 4} speed={i === 0 ? 1.6 : 1.1} />)}
      <Html position={[labelAt[0], BELT_Y + 0.5, labelAt[1] + 1.6]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`label label--belt ${lens === 'dim' ? 'label--dim' : ''} ${selected ? 'label--sel' : ''}`}>
          {index.nameOf(belt.entityId)} · лента версий
        </div>
      </Html>
    </group>
  );
}

export function Conveyors() {
  const belts = useCity((s) => s.space.belts);
  return (
    <>
      {belts.map((b) => (
        <BeltView key={b.id} belt={b} />
      ))}
    </>
  );
}
