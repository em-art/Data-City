import { Html, RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import { useCity } from '@/store/city';
import { ROAD_HALF_WIDTH } from '@/space/layout';
import { C } from './look';

export function Ground() {
  const select = useCity((s) => s.select);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.02, 4]} receiveShadow onClick={() => select(null)}>
      <planeGeometry args={[220, 220]} />
      <meshStandardMaterial color={C.ground} roughness={1} />
    </mesh>
  );
}

export function Districts() {
  const districts = useCity((s) => s.space.districts);
  const index = useCity((s) => s.index);
  return (
    <>
      {districts.map((d) => {
        const w = d.rect.max[0] - d.rect.min[0];
        const h = d.rect.max[1] - d.rect.min[1];
        const cx = (d.rect.min[0] + d.rect.max[0]) / 2;
        const cz = (d.rect.min[1] + d.rect.max[1]) / 2;
        return (
          <group key={d.domainId}>
            <RoundedBox args={[w, 0.08, h]} radius={0.04} smoothness={2} position={[cx, 0.0, cz]} receiveShadow>
              <meshStandardMaterial color={d.color} roughness={1} />
            </RoundedBox>
            <Html position={[d.rect.min[0] + 0.6, 0.1, d.rect.max[1] - 0.6]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className="district-label">{index.nameOf(d.domainId)}</div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

export function Roads() {
  const roads = useCity((s) => s.space.roads);
  const segs = useMemo(() => {
    const nodes = new Map(roads.nodes.map((n) => [n.id, n.at] as const));
    return roads.edges.map(([a, b]) => {
      const pa = nodes.get(a)!;
      const pb = nodes.get(b)!;
      const dx = pb[0] - pa[0];
      const dz = pb[1] - pa[1];
      const len = Math.hypot(dx, dz);
      return { key: `${a}-${b}`, cx: (pa[0] + pb[0]) / 2, cz: (pa[1] + pb[1]) / 2, len, angle: Math.atan2(dx, dz) };
    });
  }, [roads]);
  const W = ROAD_HALF_WIDTH * 2;
  return (
    <>
      {segs.map((s) => (
        <group key={s.key} position={[s.cx, 0.05, s.cz]} rotation={[0, s.angle, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[W, 0.06, s.len + W]} />
            <meshStandardMaterial color={C.road} roughness={0.95} />
          </mesh>
          {/* curbs */}
          {[-1, 1].map((k) => (
            <mesh key={k} position={[(k * W) / 2, 0.04, 0]}>
              <boxGeometry args={[0.12, 0.08, s.len + W]} />
              <meshStandardMaterial color={C.wall} />
            </mesh>
          ))}
          {/* dashed centre line */}
          {Array.from({ length: Math.max(Math.floor(s.len / 1.6) - 1, 0) }, (_, i) => (
            <mesh key={i} position={[0, 0.035, -s.len / 2 + 1.6 * (i + 1)]}>
              <boxGeometry args={[0.1, 0.01, 0.7]} />
              <meshBasicMaterial color={C.roadLine} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
