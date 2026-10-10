/**
 * Process analysis for the "Улучшения" view: where time goes, where work
 * waits on people, how many hand-offs there are — and what a proposed
 * change would save. Works on compiled runs, so the same code can later
 * analyse runs reconstructed from real events (Нить).
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

export function findIssues(process: ProcessT, run: Run): Finding[] {
  const out: Finding[] = [];
  const m = metricsOf(run);
  for (const s of process.steps) {
    if (s.manual) {
      out.push({
        id: `manual:${s.id}`,
        severity: s.duration / m.cycleTime > 0.2 ? 'critical' : 'warn',
        entityId: s.actorId,
        stepId: s.id,
        title: `Ручной шаг: ${s.name}`,
        detail: `${s.duration.toFixed(0)} с из ${m.cycleTime.toFixed(0)} с цикла (${Math.round((s.duration / m.cycleTime) * 100)}%). Поставка стоит, пока человек не согласует.`,
      });
    }
  }
  const visits = new Map<string, number>();
  let prev = '';
  for (const s of process.steps) {
    if (s.actorId !== prev) visits.set(s.actorId, (visits.get(s.actorId) ?? 0) + 1);
    prev = s.actorId;
  }
  for (const [id, n] of visits) {
    if (n > 1) {
      out.push({
        id: `revisit:${id}`,
        severity: 'warn',
        entityId: id,
        title: 'Повторное возвращение',
        detail: `Процесс возвращается к объекту ${n} раз(а) — возможное повторное согласование.`,
      });
    }
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
 * Replace manual approvals with an automated policy, executed where the
 * product already is (the previous step's actor) — so no extra trip.
 */
export function automateManualSteps(): Proposal {
  return {
    id: 'automate-manual',
    title: 'Автосогласование по политике качества',
    description:
      'Публикация согласуется автоматически, если все проверки качества пройдены и схема совместима с контрактом. Владелец получает уведомление и может откатить версию.',
    apply: (p) => ({
      ...p,
      name: `${p.name} (to-be)`,
      steps: p.steps.map((s, i) =>
        s.manual
          ? {
              ...s,
              name: 'Автосогласование по политике',
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
