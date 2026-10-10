import { describe, expect, it } from 'vitest';
import { loadDemoSpace } from '@/data';
import { autoPlace, boundsOf } from './layout';
import { buildRoadGraph, shortestPath } from './routing';

describe('auto placement', () => {
  it('places a new building without overlaps and connects it to the roads', () => {
    const space = loadDemoSpace();
    const { placement, space: next } = autoPlace(space, { entityId: 'sys.new', domainId: 'dom.corpgov', archetype: 'office' });
    const b = boundsOf(placement);
    for (const p of space.placements) {
      const o = boundsOf(p);
      const hit = b.min[0] < o.max[0] && b.max[0] > o.min[0] && b.min[1] < o.max[1] && b.max[1] > o.min[1];
      expect(hit, p.entityId).toBe(false);
    }
    const g = buildRoadGraph(next);
    expect(shortestPath(g, placement.port!, 'm.gold')).not.toBeNull();
  });
});
