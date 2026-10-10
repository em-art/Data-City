/**
 * Road network routing (Dijkstra over a small undirected graph) and
 * polyline sampling used by both the simulation and the renderer.
 */
import type { SpaceModelT, Vec2T } from './schema';

export interface RoadGraph {
  nodes: Map<string, Vec2T>;
  adj: Map<string, { to: string; w: number }[]>;
}

const dist = (a: Vec2T, b: Vec2T) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function buildRoadGraph(space: SpaceModelT): RoadGraph {
  const nodes = new Map(space.roads.nodes.map((n) => [n.id, n.at] as const));
  const adj = new Map<string, { to: string; w: number }[]>();
  for (const id of nodes.keys()) adj.set(id, []);
  for (const [a, b] of space.roads.edges) {
    const pa = nodes.get(a);
    const pb = nodes.get(b);
    if (!pa || !pb) throw new Error(`road edge references unknown node ${a}-${b}`);
    const w = dist(pa, pb);
    adj.get(a)!.push({ to: b, w });
    adj.get(b)!.push({ to: a, w });
  }
  return { nodes, adj };
}

/** Shortest path between two road nodes as a list of points. */
export function shortestPath(g: RoadGraph, from: string, to: string): Vec2T[] | null {
  if (!g.nodes.has(from) || !g.nodes.has(to)) return null;
  const d = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([from]);
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const n of open) {
      const v = d.get(n)!;
      if (v < best) {
        best = v;
        cur = n;
      }
    }
    open.delete(cur);
    if (cur === to) break;
    for (const { to: nb, w } of g.adj.get(cur) ?? []) {
      const nd = best + w;
      if (nd < (d.get(nb) ?? Infinity)) {
        d.set(nb, nd);
        prev.set(nb, cur);
        open.add(nb);
      }
    }
  }
  if (!d.has(to)) return null;
  const ids = [to];
  while (ids[0] !== from) ids.unshift(prev.get(ids[0]!)!);
  return ids.map((id) => g.nodes.get(id)!);
}

export function pathLength(path: Vec2T[]): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += dist(path[i - 1]!, path[i]!);
  return L;
}

/** Point and heading (radians around Y) at fraction `u` ∈ [0,1] of the path. */
export function samplePath(path: Vec2T[], u: number): { at: Vec2T; heading: number } {
  if (path.length === 0) return { at: [0, 0], heading: 0 };
  if (path.length === 1) return { at: path[0]!, heading: 0 };
  const total = pathLength(path);
  let target = Math.min(Math.max(u, 0), 1) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = dist(a, b);
    if (target <= seg || i === path.length - 1) {
      const k = seg === 0 ? 0 : Math.min(target / seg, 1);
      return {
        at: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k],
        heading: Math.atan2(b[0] - a[0], b[1] - a[1]),
      };
    }
    target -= seg;
  }
  return { at: path[path.length - 1]!, heading: 0 };
}
