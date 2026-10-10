/**
 * Process analysis for the "Улучшения" view: where time goes, where work
 * waits on people, whether a change passes all its flows — and what a
 * proposed change would save. Works on compiled runs, so the same code can
 * later analyse runs reconstructed from real events (Нить).
 */
import type { ProcessT } from '@/model/schema';
import { compileProcess, type Run, type SimContext } from './engine';

export interface Finding {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  entityId: string;
  stepId?: string;
  title: string;
  detail: string;
}

export interface Check {
  id: string;
  ok: boolean;
  title: string;
  detail: string;
}

export interface ProcessMetrics {
  cycleTime: number;
  workTime: number;
  travelTime: number;
  manualTime: number;
  handoffs: number;
  manualShare: number;
}

export function metricsOf(run: Run): ProcessMetrics {
  const sum = (k: Run['phases'][number]['kind']) =>
    run.phases.filter((p) => p.kind === k).reduce((a, p) => a + (p.t1 - p.t0), 0);
  const cycleTime = run.endAt - run.startAt;
  const manualTime = sum('manual');
  let handoffs = 0;
  const actors = run.phases.filter((p) => p.kind !== 'travel').map((p) => p.actorId);
  for (let i = 1; i < actors.length; i++) if (actors[i] !== actors[i - 1]) handoffs++;
  return {
    cycleTime,
    workTime: sum('work'),
    travelTime: sum('travel'),
    manualTime,
    handoffs,
    manualShare: cycleTime ? manualTime / cycleTime : 0,
  };
}

const FLOW_LABEL: Record<string, string> = { git: 'Git Flow', nessie: 'Nessie Flow', release: 'Релизный цикл' };

/** Structural checks that should hold for the process (shown as ✓ / ✗). */
export function processChecks(process: ProcessT): Check[] {
  const out: Check[] = [];
  if (process.category === 'change') {
    const flows = new Set(process.steps.map((s) => s.flow));
    for (const f of ['git', 'nessie', 'release']) {
      out.push({
        id: `flow:${f}`,
        ok: flows.has(f as never),
        title: FLOW_LABEL[f]!,
        detail: flows.has(f as never)
          ? 'Флоу пройден'
          : 'Пропущен — типичная причина расхождения «в Git готово, а в проде нет»',
      });
    }
  }
  return out;
}

export function findIssues(process: ProcessT, run: Run): Finding[] {
  const out: Finding[] = [];
  const m = metricsOf(run);
  for (const s of process.steps) {
    if (s.manual) {
      const share = m.cycleTime ? s.duration / m.cycleTime : 0;
      out.push({
        id: `manual:${s.id}`,
        severity: s.automation ? (share > 0.2 ? 'critical' : 'warn') : 'info',
        entityId: s.actorId,
        stepId: s.id,
        title: `Ручной шаг: ${s.name}`,
        detail: `${s.duration.toFixed(0)} с из ${m.cycleTime.toFixed(0)} с цикла (${Math.round(share * 100)}%). ${
          s.automation ? 'Есть вариант автоматизации.' : 'Осознанное решение человека — не кандидат на автоматизацию.'
        }`,
      });
    }
  }
  for (const c of processChecks(process)) {
    if (!c.ok) out.push({ id: c.id, severity: 'critical', entityId: process.steps[0]!.actorId, title: `Пропущен ${c.title}`, detail: c.detail });
  }
  for (const p of run.phases) {
    if (p.routeViolation) {
      out.push({
        id: `route:${p.toId}`,
        severity: 'critical',
        entityId: p.toId!,
        title: 'Маршрут вне контракта',
        detail: 'Продукт доставляется через объект, не разрешённый контрактом.',
      });
    }
  }
  return out;
}

/** A proposal transforms the as-is process into a to-be process. */
export interface Proposal {
  id: string;
  title: string;
  description: string;
  apply(p: ProcessT): ProcessT;
}

/**
 * Automate the manual steps that carry a concrete `automation` idea. The
 * automated step runs where the cargo already is (previous actor), so no
 * extra trip is introduced. Returns null when there is nothing to propose.
 */
export function proposalFor(process: ProcessT): Proposal | null {
  const candidates = process.steps.filter((s) => s.manual && s.automation);
  if (!candidates.length) return null;
  return {
    id: 'automate-manual',
    title: candidates.length === 1 ? `Автоматизировать: ${candidates[0]!.name}` : `Автоматизировать ${candidates.length} ручных шага`,
    description: candidates.map((s) => s.automation).join(' '),
    apply: (p) => ({
      ...p,
      name: `${p.name} (как будет)`,
      steps: p.steps.map((s, i) =>
        s.manual && s.automation
          ? {
              ...s,
              name: `Авто: ${s.name}`,
              actorId: p.steps[i - 1]?.actorId ?? s.actorId,
              manual: false,
              duration: 0.5,
            }
          : s,
      ),
    }),
  };
}

export interface Comparison {
  asIs: ProcessMetrics;
  toBe: ProcessMetrics;
  saved: number;
  savedShare: number;
}

export function compare(process: ProcessT, proposal: Proposal, ctx: SimContext): Comparison {
  const a = metricsOf(compileProcess(process, ctx, { runId: 'cmp-a' }));
  const b = metricsOf(compileProcess(proposal.apply(process), ctx, { runId: 'cmp-b' }));
  const saved = a.cycleTime - b.cycleTime;
  return { asIs: a, toBe: b, saved, savedShare: a.cycleTime ? saved / a.cycleTime : 0 };
}
