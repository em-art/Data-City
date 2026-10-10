import { Html, useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { CATALOG } from '@/assets/catalog';
import { clock } from '@/sim/clock';
import type { PlacementT } from '@/space/schema';
import { useCity } from '@/store/city';
import { C, LensContext, lensFor } from './look';
import { LabelExtra } from './Overlays';

function Glb({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={clone} />;
}

function SelectionPad({ w, d, selected, hovered }: { w: number; d: number; selected: boolean; hovered: boolean }) {
  const m = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (m.current) m.current.opacity = selected ? 0.35 + 0.2 * Math.sin(clock.t * 4) : hovered ? 0.25 : 0;
  });
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w + 1.6, d + 1.6]} />
      <meshBasicMaterial ref={m} color={C.accent} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function Building({ placement }: { placement: PlacementT }) {
  const { entityId, archetype, position, rotation, footprint } = placement;
  const entry = CATALOG[archetype];
  const view = useCity((s) => s.view);
  const index = useCity((s) => s.index);
  const process = useCity((s) => s.process);
  const selected = useCity((s) => s.selectedId === entityId);
  const hovered = useCity((s) => s.hoveredId === entityId);
  const status = useCity((s) => s.statusOverrides[entityId]);
  const select = useCity((s) => s.select);
  const hover = useCity((s) => s.hover);
  const entity = index.get(entityId);
  const lens = useMemo(() => lensFor(view, entityId, index, process), [view, entityId, index, process]);

  const Comp = entry.component;
  const isPerson = archetype === 'employeeNode';
  const scale = isPerson && lens === 'focus' ? 1.5 : 1;
  const sysStatus = status ?? (entity?.kind === 'system' ? entity.status : undefined);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(entityId);
  };

  return (
    <group position={[position[0], 0, position[1]]}>
      <SelectionPad w={rotation % 2 ? footprint[1] : footprint[0]} d={rotation % 2 ? footprint[0] : footprint[1]} selected={selected} hovered={hovered} />
      <group
        rotation={[0, (rotation * Math.PI) / 2, 0]}
        scale={scale}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          hover(entityId);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          hover(null);
          document.body.style.cursor = '';
        }}
      >
        <LensContext.Provider value={lens}>
          {entry.glb ? (
            <Suspense fallback={<Comp w={footprint[0]} d={footprint[1]} entityId={entityId} />}>
              <Glb url={entry.glb} />
            </Suspense>
          ) : (
            <Comp w={footprint[0]} d={footprint[1]} entityId={entityId} accent={placement.accent} />
          )}
        </LensContext.Provider>
      </group>
      <Html position={[0, entry.labelHeight * scale, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`label-wrap ${lens === 'dim' ? 'label--dim' : ''}`}>
          <LabelExtra entityId={entityId} />
          <div className={`label ${isPerson ? 'label--person' : ''} ${selected ? 'label--sel' : ''}`}>
            {sysStatus && sysStatus !== 'healthy' && <span className={`dot dot--${sysStatus}`} />}
            {index.nameOf(entityId)}
          </div>
        </div>
      </Html>
    </group>
  );
}
