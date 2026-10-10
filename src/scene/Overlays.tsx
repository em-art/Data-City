/**
 * View-mode overlays: the same scene, different lenses. Each overlay is a
 * pure projection of the enterprise model (+ compiled process) onto
 * positions from the spatial model.
 *
 * Two kinds of output:
 *  - 3D overlays (arcs, routes) rendered in the scene;
 *  - `LabelExtra` — per-object details rendered inside the object's own
 *    label, so annotations never collide with names.
 */
import { Html, Line, QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { CATALOG } from '@/assets/catalog';
import type { ProcessT } from '@/model/schema';
import { findIssues, type Finding } from '@/sim/analysis';
import { compileProcess, portOf, type Run, type SimContext } from '@/sim/engine';
import { shortestPath } from '@/space/routing';
import type { SpaceModelT } from '@/space/schema';
import { useCity } from '@/store/city';
import { C, INTERFACE_COLOR } from './look';

type V3 = [number, number, number];

function anchor(space: SpaceModelT, id: string, k = 0.7): V3 | null {
  const p = space.placements.find((x) => x.entityId === id);
  if (!p) return null;
  return [p.position[0], CATALOG[p.archetype].labelHeight * k, p.position[1]];
}

/** Compiled process + findings, cached per (process, ctx) pair. */
const analysisCache = new WeakMap<ProcessT, { ctx: SimContext; run: Run; issues: Finding[] }>();
function analyse(process: ProcessT, ctx: SimContext) {
  const hit = analysisCache.get(process);
  if (hit && hit.ctx === ctx) return hit;
  const run = compileProcess(process, ctx, { runId: 'overlay' });
  const v = { ctx, run, issues: findIssues(process, run) };
  analysisCache.set(process, v);
  return v;
}

function Arc({ from, to, color, flow = false, width = 2.5, lift = 4, label }: { from: V3; to: V3; color: string; flow?: boolean; width?: number; lift?: number; label?: string }) {
  // drei's Line2 instance; typed loosely to reach the dash material.
  const ref = useRef<{ material: { dashOffset: number } } | null>(null);
  useFrame((_, dt) => {
    if (flow && ref.current) ref.current.material.dashOffset -= dt * 2;
  });
  const mid: V3 = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + lift, (from[2] + to[2]) / 2];
  return (
    <>
      <QuadraticBezierLine
        ref={ref as never}
        start={from}
        end={to}
        mid={mid}
        color={color}
        lineWidth={width}
        dashed={flow}
        dashSize={0.6}
        gapSize={0.4}
        transparent
        opacity={0.9}
      />
      {label && (
        <Html position={[mid[0], mid[1] * 0.75 + from[1] * 0.25, mid[2]]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div className="chip" style={{ borderColor: color }}>
            {label}
          </div>
        </Html>
      )}
    </>
  );
}

const DATA_ROLES = new Set(['source', 'processing', 'storage', 'delivery', 'consumer']);

function ConnectorArcs({ dataOnly }: { dataOnly: boolean }) {
  const index = useCity((s) => s.index);
  const space = useCity((s) => s.space);
  return (
    <>
      {index.all('connector').map((c) => {
        const a = index.get(c.fromId);
        const b = index.get(c.toId);
        if (dataOnly && !(a?.kind === 'system' && b?.kind === 'system' && DATA_ROLES.has(a.role) && DATA_ROLES.has(b.role))) return null;
        const from = anchor(space, c.fromId);
        const to = anchor(space, c.toId);
        if (!from || !to) return null;
        return (
          <Arc
            key={c.id}
            from={from}
            to={to}
            color={INTERFACE_COLOR[c.interface] ?? C.accent}
            flow={dataOnly}
            label={dataOnly ? undefined : `${c.interface.toUpperCase()}${c.technology ? ' · ' + c.technology : ''}`}
          />
        );
      })}
    </>
  );
}

function PeopleLinks() {
  const index = useCity((s) => s.index);
  const space = useCity((s) => s.space);
  const nit = index.all('system').find((s) => s.role === 'context');
  const nitAt = nit ? anchor(space, nit.id, 0.9) : null;
  return (
    <>
      {index.all('relationship').map((r) => {
        const a = index.get(r.fromId);
        const b = index.get(r.toId);
        if (a?.kind !== 'employee' && b?.kind !== 'employee') return null;
        const from = anchor(space, r.fromId, 0.6);
        const to = anchor(space, r.toId, 0.6);
        if (!from || !to) return null;
        const p2p = a?.kind === 'employee' && b?.kind === 'employee';
        return <Arc key={r.id} from={from} to={to} color="#b36ef0" flow={p2p} width={p2p ? 3 : 1.6} lift={p2p ? 3 : 2} label={r.label} />;
      })}
      {nitAt &&
        index.all('employee').map((e) => {
          const at = anchor(space, e.id, 0.6);
          return at ? <Arc key={`nit-${e.id}`} from={nitAt} to={at} color="#d6b8f7" width={1} lift={1.5} /> : null;
        })}
    </>
  );
}

function ProcessRoute() {
  const process = useCity((s) => s.process);
  const ctx = useCity((s) => s.ctx);
  if (!process) return null;
  const { run } = analyse(process, ctx);
  return (
    <>
      {run.phases
        .filter((p) => p.kind === 'travel' && p.path && p.path.length > 1)
        .map((p, i) => (
          <Line key={i} points={p.path!.map(([x, z]) => [x, 0.2, z] as V3)} color={C.accentDeep} lineWidth={5} transparent opacity={0.75} />
        ))}
    </>
  );
}

function MetadataOverlay() {
  const index = useCity((s) => s.index);
  const space = useCity((s) => s.space);
  const ctx = useCity((s) => s.ctx);
  const meta = index.all('system').find((s) => s.role === 'metadata');
  const metaAt = meta ? anchor(space, meta.id, 0.8) : null;
  return (
    <>
      {metaAt &&
        index
          .all('relationship')
          .filter((r) => r.type === 'describes')
          .map((r) => {
            const target = index.get(r.toId);
            const to = target?.kind === 'dataProduct' ? anchor(space, target.producedBy) : anchor(space, r.toId);
            return to ? <Arc key={r.id} from={metaAt} to={to} color="#4fb3a9" width={2} flow /> : null;
          })}
      {index.all('contract').map((c) =>
        c.allowedRoute.slice(1).map((id, i) => {
          const a = portOf(ctx, c.allowedRoute[i]!);
          const b = portOf(ctx, id);
          const path = a && b ? shortestPath(ctx.graph, a, b) : null;
          return path ? <Line key={`${c.id}-${i}`} points={path.map(([x, z]) => [x, 0.22, z] as V3)} color="#4fb3a9" lineWidth={6} transparent opacity={0.6} /> : null;
        }),
      )}
    </>
  );
}

export function Overlays() {
  const view = useCity((s) => s.view);
  switch (view) {
    case 'systems':
      return <ConnectorArcs dataOnly={false} />;
    case 'data':
      return <ConnectorArcs dataOnly />;
    case 'people':
      return <PeopleLinks />;
    case 'process':
    case 'improve':
      return <ProcessRoute />;
    case 'metadata':
      return <MetadataOverlay />;
    default:
      return null;
  }
}

/** Mode-specific details shown inside an object's label. */
export function LabelExtra({ entityId }: { entityId: string }) {
  const view = useCity((s) => s.view);
  const index = useCity((s) => s.index);
  const process = useCity((s) => s.process);
  const ctx = useCity((s) => s.ctx);
  const e = index.get(entityId);
  if (!e) return null;

  if (view === 'data') {
    const products = index.all('dataProduct').filter((p) => p.producedBy === entityId);
    if (!products.length) return null;
    return (
      <div className="lx">
        {products.map((p) => (
          <div key={p.id} className="lx__product">
            ▣ {p.name} <b>v{p.version}</b> · {p.quality.passed}/{p.quality.checks} ✓
          </div>
        ))}
      </div>
    );
  }

  if (view === 'metadata') {
    if (e.kind !== 'system') return null;
    const n = index.all('contract').filter((c) => c.providerId === e.id || c.consumerId === e.id).length;
    return (
      <div className="lx lx--meta">
        <div>👤 {e.owner ? index.nameOf(e.owner) : '—'}</div>
        <div>
          ⇄ {e.interfaces.join(' · ').toUpperCase() || '—'}
          {n ? ` · контрактов: ${n}` : ''}
        </div>
      </div>
    );
  }

  if (view === 'people' && e.kind === 'employee' && e.assistant) {
    return <div className="lx lx--person">✦ {e.assistant.name}</div>;
  }

  if ((view === 'process' || view === 'improve') && process) {
    if (view === 'improve') {
      const issues = analyse(process, ctx).issues.filter((f) => f.entityId === entityId);
      if (!issues.length) return null;
      return (
        <div className="lx">
          {issues.map((f) => (
            <div key={f.id} className={`issue issue--${f.severity}`}>
              ⚠ {f.title}
            </div>
          ))}
        </div>
      );
    }
    const steps = process.steps.map((s, i) => ({ ...s, n: i + 1 })).filter((s) => s.actorId === entityId);
    if (!steps.length) return null;
    return (
      <div className="lx steps">
        {steps.map((s) => (
          <div key={s.id} className={`step ${s.manual ? 'step--manual' : ''}`}>
            <span>{s.n}</span>
            {s.name}
          </div>
        ))}
      </div>
    );
  }
  return null;
}
