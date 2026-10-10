import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { useCity } from '@/store/city';
import { Block, C, Cyl, Panel } from './look';

function Tree() {
  return (
    <group>
      <Cyl r={0.1} h={0.5} at={[0, 0, 0]} c={C.trunk} seg={8} />
      <mesh position={[0, 0.95, 0]} castShadow>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshStandardMaterial color={C.leaf} roughness={0.9} />
      </mesh>
      <mesh position={[0.25, 1.35, 0.1]} castShadow>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshStandardMaterial color={C.leaf} roughness={0.9} />
      </mesh>
    </group>
  );
}

const CONTAINER_COLORS = [C.accent, C.glassDark, C.orange, C.wallShade, C.accentDeep];

function Containers() {
  return (
    <group>
      {[0, 1, 2].map((i) =>
        [0, 1].map((lvl) =>
          lvl === 1 && i === 2 ? null : (
            <Block key={`${i}${lvl}`} size={[0.9, 0.7, 2]} at={[i * 1.0 - 1, lvl * 0.72, 0]} c={CONTAINER_COLORS[(i + lvl * 2) % 5]!} r={0.04} />
          ),
        ),
      )}
    </group>
  );
}

function Solar() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, 0.4, i * 1.2 - 1.2]} rotation={[-0.45, 0, 0]}>
          <Panel size={[3.6, 0.06, 0.9]} at={[0, 0, 0]} c={C.solar} />
        </group>
      ))}
      {[-1.5, 1.5].map((x) => (
        <Cyl key={x} r={0.05} h={0.4} at={[x, 0, 0]} c={C.door} seg={6} />
      ))}
    </group>
  );
}

function Tank() {
  return (
    <group>
      <Cyl r={0.8} h={1.6} at={[0, 0, 0]} c={C.wall} />
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={C.roof} />
      </mesh>
      <Panel size={[1.62, 0.14, 1.62]} at={[0, 0.9, 0]} c={C.accent} />
    </group>
  );
}

function Drone({ at }: { at: [number, number] }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.position.set(at[0] + Math.sin(t * 0.4) * 3, 4 + Math.sin(t * 1.3) * 0.3, at[1] + Math.cos(t * 0.4) * 3);
    g.current.rotation.y = -t * 0.4;
  });
  return (
    <group ref={g}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.15, 0.5]} />
        <meshStandardMaterial color={C.wall} />
      </mesh>
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} position={[x * 0.4, 0.08, z * 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 16]} />
            <meshBasicMaterial color={C.accent} transparent opacity={0.4} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Props() {
  const props = useCity((s) => s.space.props);
  return (
    <>
      {props.map((p, i) => {
        if (p.type === 'drone') return <Drone key={i} at={p.at} />;
        const Comp = { tree: Tree, containers: Containers, solar: Solar, tank: Tank }[p.type];
        return (
          <group key={i} position={[p.at[0], 0.04, p.at[1]]} rotation={[0, p.rotation, 0]}>
            <Comp />
          </group>
        );
      })}
    </>
  );
}
