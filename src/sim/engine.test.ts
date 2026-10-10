import { describe, expect, it } from 'vitest';
import { loadDemoModel, loadDemoSpace } from '@/data';
import { indexModel } from '@/model/graph';
import type { ProcessT } from '@/model/schema';
import { buildRoadGraph } from '@/space/routing';
import { automateManualSteps, compare, findIssues, metricsOf } from './analysis';
import { compileProcess, sampleRun, type SimContext } from './engine';

const ctx = (): SimContext => {
  const index = indexModel(loadDemoModel());
  const space = loadDemoSpace();
  return { index, space, graph: buildRoadGraph(space) };
};
const proc = (c: SimContext) => c.index.get('proc.subscriber-delivery') as ProcessT;

describe('simulation engine', () => {
  it('compiles the delivery process into contiguous phases', () => {
    const c = ctx();
    const run = compileProcess(proc(c), c, { runId: 'r1' });
    for (let i = 1; i < run.phases.length; i++) expect(run.phases[i]!.t0).toBeCloseTo(run.phases[i - 1]!.t1);
    const travels = run.phases.filter((p) => p.kind === 'travel').map((p) => `${p.actorId}>${p.toId}`);
    expect(travels).toEqual([
      'sys.eva>sys.data-platform',
      'sys.data-platform>sys.product-warehouse',
      'sys.product-warehouse>sys.istok',
      'sys.istok>sys.bi',
    ]);
    expect(run.contractId).toBe('ctr.subscriber-base-bi');
  });

  it('emits produced → contract checked → delivered, all marked demo', () => {
    const c = ctx();
    const run = compileProcess(proc(c), c, { runId: 'r1' });
    const types = run.events.map((e) => e.type);
    expect(types.indexOf('product.produced')).toBeLessThan(types.indexOf('contract.checked'));
    expect(types.indexOf('contract.checked')).toBeLessThan(types.indexOf('product.delivered'));
    expect(run.events.every((e) => e.source === 'demo')).toBe(true);
    expect(run.phases.some((p) => p.routeViolation)).toBe(false);
  });

  it('vehicle waits parked at the warehouse during the manual approval', () => {
    const c = ctx();
    const run = compileProcess(proc(c), c, { runId: 'r1' });
    const manual = run.phases.find((p) => p.kind === 'manual')!;
    const s = sampleRun(run, (manual.t0 + manual.t1) / 2, c);
    expect(s.vehicle?.moving).toBe(false);
    expect(s.vehicle?.at).toEqual(c.graph.nodes.get('r.wh'));
    expect(s.vehicle?.cargoId).toBe('dp.subscriber-base');
  });

  it('flags a route outside the contract', () => {
    const c = ctx();
    const p = proc(c);
    const detour: ProcessT = {
      ...p,
      steps: [...p.steps.slice(0, 5), { id: 'detour', name: 'Объезд', actorId: 'sys.gitlab', manual: false, duration: 1 }, ...p.steps.slice(5)],
    };
    const run = compileProcess(detour, c, { runId: 'r2' });
    expect(findIssues(detour, run).some((f) => f.id === 'route:sys.gitlab')).toBe(true);
  });
});

describe('analysis', () => {
  it('finds the manual approval and quantifies automating it', () => {
    const c = ctx();
    const p = proc(c);
    const run = compileProcess(p, c, { runId: 'r' });
    const m = metricsOf(run);
    expect(m.manualTime).toBe(6);
    expect(findIssues(p, run).map((f) => f.id)).toContain('manual:approve');
    const cmp = compare(p, automateManualSteps(), c);
    expect(cmp.saved).toBeCloseTo(5.5);
    expect(cmp.toBe.manualTime).toBe(0);
  });
});
