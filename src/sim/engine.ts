/**
 * Simulation engine — pure, deterministic, renderer-agnostic.
 *
 * A process (from the enterprise model) is compiled into a *run*: a
 * timeline of phases (work at an object, travel along the road network,
 * manual wait) plus the events it emits. Rendering samples the run at
 * time t; nothing here depends on React or Three.js, so runs can be unit
 * tested, compared (as-is vs to-be) and replayed from real events.
 */
import type { ModelIndex } from '@/model/graph';
import type { ContractT, ModelEventT, ProcessT } from '@/model/schema';
import { buildBeltGraph, buildRoadGraph, pathLength, samplePath, shortestPath, type RoadGraph } from '@/space/routing';
import type { SpaceModelT, Vec2T } from '@/space/schema';

export type PhaseKind = 'work' | 'travel' | 'manual';
export type Transport = 'truck' | 'pipe' | 'belt';

export interface Phase {
  kind: PhaseKind;
  t0: number; // seconds of simulation time
  t1: number;
  stepId?: string;
  actorId: string;
  /** For travel: destination object id and the road polyline. */
  toId?: string;
  path?: Vec2T[];
  cargoId?: string;
  /** For travel: the delivery leaves the contract's allowed route. */
  routeViolation?: boolean;
  /** For travel: truck on roads, federated read in place (pipe), or Nessie belt. */
  transport?: Transport;
  /** Systems taking part in a work step without the cargo moving there. */
  via?: string[];
  flow?: string;
}

export interface Run {
  id: string;
  processId: string;
  source: 'demo' | 'live';
  startAt: number;
  endAt: number;
  phases: Phase[];
  events: ModelEventT[];
  contractId?: string;
}

export interface SimContext {
  index: ModelIndex;
  space: SpaceModelT;
  graph: RoadGraph;
  belt: RoadGraph;
}

export function makeContext(index: ModelIndex, space: SpaceModelT): SimContext {
  return { index, space, graph: buildRoadGraph(space), belt: buildBeltGraph(space) };
}

export interface CompileOptions {
  runId: string;
  startAt?: number;
  /** World units per simulated second. */
  speed?: number;
  source?: 'demo' | 'live';
}

export function portOf(ctx: SimContext, entityId: string): string | undefined {
  return ctx.space.placements.find((p) => p.entityId === entityId)?.port;
}

export function beltNodeOf(ctx: SimContext, entityId: string): string | undefined {
  return ctx.space.placements.find((p) => p.entityId === entityId)?.beltNode;
}

/** Where cargo waits at an object: on its belt node, else at its road port. */
export function restPoint(ctx: SimContext, entityId: string, prefer: Transport = 'truck'): { at: Vec2T; mode: Transport } | undefined {
  const b = beltNodeOf(ctx, entityId);
  const p = portOf(ctx, entityId);
  if (b && (prefer === 'belt' || !p)) return { at: ctx.belt.nodes.get(b)!, mode: 'belt' };
  if (p) return { at: ctx.graph.nodes.get(p)!, mode: 'truck' };
  if (b) return { at: ctx.belt.nodes.get(b)!, mode: 'belt' };
  return undefined;
}

/** Plan a leg between two objects: along the belt when both sit on it, else by road. */
function planLeg(ctx: SimContext, fromId: string, toId: string, want: 'truck' | 'pipe'): { path: Vec2T[]; transport: Transport } | null {
  const fb = beltNodeOf(ctx, fromId);
  const tb = beltNodeOf(ctx, toId);
  if (want !== 'pipe' && fb && tb) {
    const path = shortestPath(ctx.belt, fb, tb);
    if (path) return { path, transport: 'belt' };
  }
  const fp = portOf(ctx, fromId);
  const tp = portOf(ctx, toId);
  if (fp && tp) {
    const path = shortestPath(ctx.graph, fp, tp);
    if (path) return { path, transport: want };
  }
  return null;
}

export function contractFor(ctx: SimContext, productId: string | undefined): ContractT | undefined {
  if (!productId) return undefined;
  return ctx.index.all('contract').find((c) => c.productId === productId && c.status === 'active');
}

export function compileProcess(process: ProcessT, ctx: SimContext, opts: CompileOptions): Run {
  const speed = opts.speed ?? 6;
  const source = opts.source ?? 'demo';
  const startAt = opts.startAt ?? 0;
  const phases: Phase[] = [];
  const events: ModelEventT[] = [];
  let t = startAt;
  let here: string | undefined; // object id where the vehicle currently is
  let cargo: string | undefined;
  let contract: ContractT | undefined;
  let seq = 0;

  const emit = (at: number, type: ModelEventT['type'], subjectId: string, extra: Partial<ModelEventT> = {}) =>
    events.push({
      id: `${opts.runId}#${seq++}`,
      at: Math.round(at * 1000),
      source,
      type,
      subjectId,
      processId: process.id,
      payload: {},
      ...extra,
    });

  for (const step of process.steps) {
    const actor = ctx.index.get(step.actorId);
    const isPlace = actor?.kind !== 'employee' && !!(portOf(ctx, step.actorId) || beltNodeOf(ctx, step.actorId));
    const leg = isPlace && here && here !== step.actorId ? planLeg(ctx, here, step.actorId, step.transport) : null;

    if (leg && here) {
      const path = leg.path;
      // belts are slower and steadier than trucks
      const dur = Math.max(pathLength(path) / (leg.transport === 'belt' ? speed * 0.55 : speed), 0.5);
      const routeViolation = !!contract && !contract.allowedRoute.includes(step.actorId);
      phases.push({ kind: 'travel', t0: t, t1: t + dur, actorId: here, toId: step.actorId, path, cargoId: cargo, routeViolation, transport: leg.transport });
      emit(t, 'product.dispatched', cargo ?? here, { payload: { fromId: here, toId: step.actorId, routeViolation } });
      t += dur;
    }
    if (isPlace) here = step.actorId;

    emit(t, 'step.started', step.actorId, { stepId: step.id });
    phases.push({
      kind: step.manual ? 'manual' : 'work',
      t0: t,
      t1: t + step.duration,
      stepId: step.id,
      actorId: step.actorId,
      cargoId: cargo,
      via: step.via,
      flow: step.flow,
    });
    t += step.duration;
    emit(t, 'step.completed', step.actorId, { stepId: step.id });

    if (step.carries) {
      if (step.carries !== cargo && ctx.index.get(step.carries)?.kind === 'dataProduct') {
        emit(t, 'product.produced', step.carries, { stepId: step.id });
        contract = contractFor(ctx, step.carries) ?? contract;
      }
      cargo = step.carries;
    }
    if (actor?.kind === 'system' && actor.role === 'delivery' && contract) {
      emit(t, 'contract.checked', contract.id, { stepId: step.id, payload: { ok: true, productId: cargo } });
    }
    if (contract && step.actorId === contract.consumerId) {
      emit(t, 'product.delivered', cargo ?? step.actorId, { stepId: step.id, payload: { consumerId: step.actorId } });
    }
  }

  return { id: opts.runId, processId: process.id, source, startAt, endAt: t, phases, events, contractId: contract?.id };
}

/** A single point-to-point delivery (used for live `product.dispatched` events). */
export function compileTrip(
  ctx: SimContext,
  o: { runId: string; fromId: string; toId: string; cargoId?: string; startAt: number; speed?: number; source: 'demo' | 'live' },
): Run | null {
  const a = portOf(ctx, o.fromId);
  const b = portOf(ctx, o.toId);
  if (!a || !b) return null;
  const path = shortestPath(ctx.graph, a, b);
  if (!path) return null;
  const dur = Math.max(pathLength(path) / (o.speed ?? 6), 0.5);
  return {
    id: o.runId,
    processId: '',
    source: o.source,
    startAt: o.startAt,
    endAt: o.startAt + dur,
    phases: [{ kind: 'travel', t0: o.startAt, t1: o.startAt + dur, actorId: o.fromId, toId: o.toId, path, cargoId: o.cargoId }],
    events: [],
  };
}

export interface RunSample {
  phase: Phase | undefined;
  /**
   * Cargo pose; null when the run has not started or has finished.
   * `mode` says how it is shown: truck on a road, pulse (federated read) or crate on the belt.
   */
  vehicle: { at: Vec2T; heading: number; moving: boolean; cargoId?: string; mode: Transport } | null;
  progress: number; // 0..1 over the whole run
}

export function sampleRun(run: Run, t: number, ctx: SimContext): RunSample {
  const progress = run.endAt === run.startAt ? 1 : (t - run.startAt) / (run.endAt - run.startAt);
  if (t < run.startAt || t > run.endAt) return { phase: undefined, vehicle: null, progress: Math.min(Math.max(progress, 0), 1) };
  const i = run.phases.findIndex((p) => t >= p.t0 && t <= p.t1);
  const phase = run.phases[i];
  if (!phase) return { phase: undefined, vehicle: null, progress };

  if (phase.kind === 'travel' && phase.path) {
    const u = (t - phase.t0) / Math.max(phase.t1 - phase.t0, 1e-6);
    const s = samplePath(phase.path, u);
    return { phase, vehicle: { ...s, moving: true, cargoId: phase.cargoId, mode: phase.transport ?? 'truck' }, progress };
  }
  // Waiting at the last place-like object (also during manual steps).
  const prevTravel = run.phases
    .slice(0, i)
    .reverse()
    .find((p) => p.kind === 'travel');
  for (let k = i; k >= 0; k--) {
    const p = run.phases[k]!;
    const id = p.kind === 'travel' ? p.toId : p.actorId;
    const rest = id ? restPoint(ctx, id, prevTravel?.transport === 'truck' || !prevTravel ? 'truck' : 'belt') : undefined;
    if (!rest) continue;
    const heading = prevTravel?.path ? samplePath(prevTravel.path, 1).heading : 0;
    return { phase, vehicle: { at: rest.at, heading, moving: false, cargoId: phase.cargoId, mode: rest.mode }, progress };
  }
  return { phase, vehicle: null, progress };
}
