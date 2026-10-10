/**
 * Visual language of the city: palette, lens (how each view mode treats an
 * entity) and small material/shape helpers shared by all archetypes.
 */
import { RoundedBox } from '@react-three/drei';
import { createContext, useContext, useMemo } from 'react';
import type { ModelIndex } from '@/model/graph';
import type { ProcessT } from '@/model/schema';
import type { ViewMode } from '@/store/city';

export const C = {
  bg: '#e4e7f1',
  ground: '#eef0f6',
  road: '#cdd2e2',
  roadLine: '#ffffff',
  wall: '#f8f9fd',
  wallShade: '#e0e4f2',
  roof: '#d3daf0',
  roofDark: '#c4cbe4',
  accent: '#7d8cf0',
  accentDeep: '#5b67d8',
  glass: '#a9c4f5',
  glassDark: '#7f9fdc',
  door: '#9aa6c8',
  orange: '#ff8a3d',
  green: '#6fd36a',
  red: '#ff5d6c',
  yellow: '#ffc94d',
  trunk: '#b9a68f',
  leaf: '#bfe3b4',
  solar: '#5a6fc4',
  person: '#ffffff',
};

export const INTERFACE_COLOR: Record<string, string> = {
  api: '#7d8cf0',
  sql: '#4fb3a9',
  stream: '#ff8a3d',
  mcp: '#b36ef0',
  file: '#9aa6c8',
  ui: '#c0c6da',
};

export type LensState = 'normal' | 'dim' | 'focus';

export const LensContext = createContext<LensState>('normal');
export const useLens = () => useContext(LensContext);

const DATA_ROLES = new Set(['source', 'processing', 'storage', 'delivery', 'consumer']);

/** How a view mode presents a given entity. One scene, seven lenses. */
export function lensFor(view: ViewMode, entityId: string, ix: ModelIndex, process?: ProcessT): LensState {
  const e = ix.get(entityId);
  if (!e) return 'normal';
  const actors = new Set(process?.steps.map((s) => s.actorId) ?? []);
  switch (view) {
    case 'city':
    case 'metadata':
      return 'normal';
    case 'systems':
      return e.kind === 'system' ? 'normal' : 'dim';
    case 'data':
      return e.kind === 'system' && DATA_ROLES.has(e.role) ? 'normal' : 'dim';
    case 'people':
      return e.kind === 'employee' ? 'focus' : 'dim';
    case 'process':
    case 'improve':
      return actors.has(entityId) ? (e.kind === 'employee' ? 'focus' : 'normal') : 'dim';
  }
}

export function useLensFor(view: ViewMode, entityId: string, ix: ModelIndex, process?: ProcessT) {
  return useMemo(() => lensFor(view, entityId, ix, process), [view, entityId, ix, process]);
}

/** Standard matte material that fades out under the 'dim' lens. */
export function Mat({ c, emissive, glow = 0, rough = 0.8 }: { c: string; emissive?: string; glow?: number; rough?: number }) {
  const lens = useLens();
  const dim = lens === 'dim';
  return (
    <meshStandardMaterial
      color={c}
      roughness={rough}
      metalness={0.02}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={glow}
      transparent={dim}
      opacity={dim ? 0.16 : 1}
      depthWrite={!dim}
    />
  );
}

type V3 = [number, number, number];

/** Rounded box positioned by its base center (y = bottom). */
export function Block({
  size,
  at = [0, 0, 0],
  c,
  r = 0.12,
  shadow = true,
  emissive,
  glow,
}: {
  size: V3;
  at?: V3;
  c: string;
  r?: number;
  shadow?: boolean;
  emissive?: string;
  glow?: number;
}) {
  const radius = Math.min(r, size[0] / 2.01, size[1] / 2.01, size[2] / 2.01);
  return (
    <RoundedBox
      args={size}
      radius={radius}
      smoothness={3}
      position={[at[0], at[1] + size[1] / 2, at[2]]}
      castShadow={shadow}
      receiveShadow
    >
      <Mat c={c} emissive={emissive} glow={glow} />
    </RoundedBox>
  );
}

/** Thin flat panel (doors, windows, solar cells) — cheap plain box. */
export function Panel({ size, at, c, emissive, glow }: { size: V3; at: V3; c: string; emissive?: string; glow?: number }) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <Mat c={c} emissive={emissive} glow={glow} rough={0.4} />
    </mesh>
  );
}

export function Cyl({
  r,
  h,
  at,
  c,
  seg = 24,
  rTop,
}: {
  r: number;
  h: number;
  at: V3;
  c: string;
  seg?: number;
  rTop?: number;
}) {
  return (
    <mesh position={[at[0], at[1] + h / 2, at[2]]} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, seg]} />
      <Mat c={c} />
    </mesh>
  );
}
