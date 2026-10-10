import { describe, expect, it } from 'vitest';
import { loadDemoModel, loadDemoSpace } from '@/data';
import { indexModel } from '@/model/graph';
import type { ProcessT } from '@/model/schema';
import { compare, findIssues, metricsOf, processChecks, proposalFor } from './analysis';
import { compileProcess, makeContext, sampleRun, type SimContext } from './engine';

const ctx = (): SimContext => {
  const index = indexModel(loadDemoModel());
  const space = loadDemoSpace();
  return makeContext(index, space);
};
const proc = (c: SimContext, id: string) => c.index.get(id) as ProcessT;

describe('Pattern A — federated delivery', () => {
  it('moves through the Medallion layers and on to the consumer', () => {
    const c = ctx();
    const run = compileProcess(proc(c, 'proc.pattern-a'), c, { runId: 'a' });
    for (let i = 1; i < run.phases.length; i++) expect(run.phases[i]!.t0).toBeCloseTo(run.phases[i - 1]!.t1);
    const travels = run.phases.filter((p) => p.kind === 'travel').map((p) => `${p.actorId}>${p.toId}`);
    expect(travels).toEqual([
      'sys.eva>layer.bronze',
      'layer.bronze>layer.silver',
      'layer.silver>layer.gold',
      'layer.gold>sys.cube',
      'sys.cube>sys.istok',
      'sys.istok>sys.bi',
    ]);
    // inside the platform cargo rides the Nessie belt; trucks take over at Cube.dev
    const modes = run.phases.filter((p) => p.kind === 'travel').map((p) => p.transport);
    expect(modes).toEqual(['pipe', 'belt', 'belt', 'belt', 'truck', 'truck']);
    expect(run.contractId).toBe('ctr.corpgov-transitions');
  });

  it('reads the source in place: no Landing, first leg is a pipe, not a truck', () => {
    const c = ctx();
    const run = compileProcess(proc(c, 'proc.pattern-a'), c, { runId: 'a' });
    expect(run.phases.some((p) => p.actorId === 'layer.landing' || p.toId === 'layer.landing')).toBe(false);
    const first = run.phases.find((p) => p.kind === 'travel')!;
    expect(first.transport).toBe('pipe');
    const s = sampleRun(run, (first.t0 + first.t1) / 2, c);
    expect(s.vehicle?.mode).toBe('pipe');
  });

  it('emits produced → contract checked → delivered and stays on the allowed route', () => {
    const c = ctx();
    const run = compileProcess(proc(c, 'proc.pattern-a'), c, { runId: 'a' });
    const types = run.events.map((e) => e.type);
    expect(types.lastIndexOf('product.produced')).toBeLessThan(types.indexOf('contract.checked'));
    expect(types.indexOf('contract.checked')).toBeLessThan(types.indexOf('product.delivered'));
    expect(run.events.every((e) => e.source === 'demo')).toBe(true);
    expect(run.phases.some((p) => p.routeViolation)).toBe(false);
  });

  it('flags a detour outside the contract', () => {
    const c = ctx();
    const p = proc(c, 'proc.pattern-a');
    const detour: ProcessT = {
      ...p,
      steps: [...p.steps.slice(0, 5), { id: 'detour', name: 'Объезд', actorId: 'sys.gitlab', manual: false, duration: 1, via: [], transport: 'truck' }, ...p.steps.slice(5)],
    };
    const run = compileProcess(detour, c, { runId: 'd' });
    expect(findIssues(detour, run).some((f) => f.id === 'route:sys.gitlab')).toBe(true);
  });
});

describe('Pattern B — dlt ingestion', () => {
  it('copies by truck through dlt into Landing before Bronze', () => {
    const c = ctx();
    const run = compileProcess(proc(c, 'proc.pattern-b'), c, { runId: 'b' });
    const travels = run.phases.filter((p) => p.kind === 'travel');
    expect(travels.map((p) => p.toId)).toEqual(['sys.dlt', 'layer.landing', 'layer.bronze', 'layer.silver']);
    expect(travels.map((p) => p.transport)).toEqual(['truck', 'truck', 'belt', 'belt']);
  });
});

describe('change process — three flows', () => {
  it('passes Git, Nessie and release flows', () => {
    const c = ctx();
    expect(processChecks(proc(c, 'proc.change')).every((x) => x.ok)).toBe(true);
  });

  it('reports a skipped flow as critical', () => {
    const c = ctx();
    const p = proc(c, 'proc.change');
    const noNessie: ProcessT = { ...p, steps: p.steps.filter((s) => s.flow !== 'nessie') };
    const run = compileProcess(noNessie, c, { runId: 'x' });
    expect(findIssues(noNessie, run).find((f) => f.id === 'flow:nessie')?.severity).toBe('critical');
  });

  it('proposes automating only steps with an automation idea', () => {
    const c = ctx();
    const p = proc(c, 'proc.change');
    const proposal = proposalFor(p)!;
    const toBe = proposal.apply(p);
    expect(toBe.steps.find((s) => s.id === 'review')?.manual).toBe(true); // human review stays
    expect(toBe.steps.find((s) => s.id === 'notify')?.manual).toBe(false);
    const cmp = compare(p, proposal, c);
    expect(cmp.saved).toBeCloseTo(3.5);
    expect(metricsOf(compileProcess(toBe, c, { runId: 't' })).manualTime).toBe(5);
    expect(proposalFor(proc(c, 'proc.pattern-a'))).toBeNull();
  });
});
