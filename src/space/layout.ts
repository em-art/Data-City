/**
 * Automatic placement of new objects: finds a free plot inside the
 * entity's district, close to a road, and connects it to the road network
 * by splitting the nearest road edge with a new port node.
 */
import type { ArchetypeT, PlacementT, SpaceModelT, Vec2T } from './schema';

export const ROAD_HALF_WIDTH = 1.3;

export const DEFAULT_FOOTPRINT: Record<ArchetypeT, Vec2T> = {
  factory: [10, 7],
  warehouse: [8, 6],
  distribution: [10, 7],
  opsCenter: [8, 6],
  workshop: [7, 5],
  office: [6, 5],
  archive: [7, 5],
  tower: [5, 5],
  employeeNode: [1.6, 1.6],
  layerHall: [8, 7],
  queryHub: [9, 8],
  controlTower: [6, 6],
  silos: [10, 7],
  switchyard: [8, 6],
  ingestDock: [8, 6],
  lab: [7, 6],
  gatehouse: [3, 3],
  vault: [5, 5],
  watchtower: [4, 4],
};

interface Rect {
  min: Vec2T;
  max: Vec2T;
}

/** World-space bounds of a placement (quarter-turn rotations swap w/d). */
export function boundsOf(p: Pick<PlacementT, 'position' | 'footprint' | 'rotation'>): Rect {
  const [w, d] = p.rotation % 2 ? [p.footprint[1], p.footprint[0]] : p.footprint;
  return {
    min: [p.position[0] - w / 2, p.position[1] - d / 2],
    max: [p.position[0] + w / 2, p.position[1] + d / 2],
  };
}

const overlap = (a: Rect, b: Rect, m = 0) =>
  a.min[0] - m < b.max[0] && a.max[0] + m > b.min[0] && a.min[1] - m < b.max[1] && a.max[1] + m > b.min[1];

/** Distance from point to segment and the projected point. */
export function projectToSegment(p: Vec2T, a: Vec2T, b: Vec2T): { d: number; at: Vec2T; k: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L2 = dx * dx + dz * dz || 1;
  const k = Math.min(Math.max(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2, 0), 1);
  const at: Vec2T = [a[0] + dx * k, a[1] + dz * k];
  return { d: Math.hypot(p[0] - at[0], p[1] - at[1]), at, k };
}

function rectToSegmentDistance(r: Rect, a: Vec2T, b: Vec2T): number {
  // Conservative: sample the segment and measure distance to the rect.
  let best = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const dx = Math.max(r.min[0] - x, 0, x - r.max[0]);
    const dz = Math.max(r.min[1] - z, 0, z - r.max[1]);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

export interface AutoPlaceResult {
  placement: PlacementT;
  space: SpaceModelT;
}

/**
 * Returns a new space model with the placement added (and a port node
 * spliced into the road network). Throws if the district has no room.
 */
export function autoPlace(
  space: SpaceModelT,
  o: { entityId: string; domainId: string; archetype: ArchetypeT; withPort?: boolean },
): AutoPlaceResult {
  const district = space.districts.find((d) => d.domainId === o.domainId);
  if (!district) throw new Error(`no district for domain ${o.domainId}`);
  const footprint = DEFAULT_FOOTPRINT[o.archetype];
  const nodes = new Map(space.roads.nodes.map((n) => [n.id, n.at] as const));
  const segments = space.roads.edges.map(([a, b]) => ({ a, b, pa: nodes.get(a)!, pb: nodes.get(b)! }));
  const taken = space.placements.map((p) => boundsOf(p));

  let best: { pos: Vec2T; rotation: number; score: number; seg?: (typeof segments)[number] } | null = null;
  const { min, max } = district.rect;
  for (let x = min[0] + footprint[0] / 2 + 0.5; x <= max[0] - footprint[0] / 2 - 0.5; x += 0.5) {
    for (let z = min[1] + footprint[1] / 2 + 0.5; z <= max[1] - footprint[1] / 2 - 0.5; z += 0.5) {
      const rect = boundsOf({ position: [x, z], footprint, rotation: 0 });
      if (taken.some((t) => overlap(rect, t, 1))) continue;
      let nearest = Infinity;
      let seg: (typeof segments)[number] | undefined;
      for (const s of segments) {
        const d = rectToSegmentDistance(rect, s.pa, s.pb);
        if (d < nearest) {
          nearest = d;
          seg = s;
        }
      }
      if (nearest < ROAD_HALF_WIDTH + 0.6) continue; // would sit on the road
      const score = nearest + Math.hypot(x - (min[0] + max[0]) / 2, z - (min[1] + max[1]) / 2) * 0.02;
      if (!best || score < best.score) best = { pos: [x, z], rotation: 0, score, seg };
    }
  }
  if (!best || !best.seg) throw new Error('В районе нет свободного места');

  // Face the dock toward the nearest road.
  const proj = projectToSegment(best.pos, best.seg.pa, best.seg.pb);
  const dx = proj.at[0] - best.pos[0];
  const dz = proj.at[1] - best.pos[1];
  const rotation = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2;

  let next: SpaceModelT = { ...space, placements: [...space.placements] };
  let port: string | undefined;
  if (o.withPort !== false && o.archetype !== 'employeeNode') {
    port = `p.${o.entityId}`;
    const { a, b } = best.seg;
    next = {
      ...next,
      roads: {
        nodes: [...space.roads.nodes, { id: port, at: proj.at }],
        edges: [...space.roads.edges.filter(([x, y]) => !(x === a && y === b)), [a, port], [port, b]],
      },
    };
  }
  const placement: PlacementT = {
    entityId: o.entityId,
    archetype: o.archetype,
    position: best.pos,
    rotation,
    // The search used world-space bounds; boundsOf swaps w/d for odd turns.
    footprint: rotation % 2 ? [footprint[1], footprint[0]] : footprint,
    port,
  };
  next.placements.push(placement);
  return { placement, space: next };
}
