import { ArrowRight, CircleCheck, Hand, RefreshCcw } from 'lucide-react';
import { useMemo } from 'react';
import type { ModelIndex } from '@/model/graph';
import { checkModelNaming } from '@/model/naming';
import { compare, findIssues, metricsOf, processChecks, proposalFor } from '@/sim/analysis';
import { activity, clock } from '@/sim/clock';
import { compileProcess, sampleRun } from '@/sim/engine';
import { LAYER_COLOR } from '@/scene/archetypesDp';
import { useCity } from '@/store/city';
import { EVENT_LABEL, ROLE_LABEL, fmtSec, useTick } from './util';

const nameOf = (index: ModelIndex, id?: string) => index.nameOf(id);

export function DeliveriesPanel() {
  useTick(4);
  const runs = useCity((s) => s.runs);
  const ctx = useCity((s) => s.ctx);
  const index = useCity((s) => s.index);
  const select = useCity((s) => s.select);
  const selectedId = useCity((s) => s.selectedId);
  const rows = [...runs].reverse().slice(0, 5);
  return (
    <section className="panel glass">
      <header>
        <h3>Поставки</h3>
        <small>{rows.length} в сцене</small>
      </header>
      <div className="table">
        {rows.length === 0 && <div className="muted">Ожидание первого рейса…</div>}
        {rows.map((r, i) => {
          const s = sampleRun(r, clock.t, ctx);
          const ph = s.phase;
          const leg = ph?.kind === 'travel' ? ph : [...r.phases].reverse().find((p) => p.kind === 'travel' && p.t0 <= clock.t);
          const status = !ph ? (clock.t > r.endAt ? 'Доставлено' : 'В очереди') : ph.kind === 'travel' ? 'В пути' : ph.kind === 'manual' ? 'Ждёт человека' : 'Обработка';
          const tone = !ph ? 'ok' : ph.kind === 'manual' ? 'warn' : ph.kind === 'travel' ? 'move' : 'work';
          return (
            <button key={r.id} className={`trow ${selectedId === `run:${r.id}` ? 'trow--sel' : ''}`} onClick={() => select(`run:${r.id}`)}>
              <span className="trow__n">{i + 1}</span>
              <span className="trow__id">{r.id}</span>
              <span className="trow__route">
                {leg ? (
                  <>
                    {nameOf(index, leg.actorId)} <ArrowRight size={11} /> {nameOf(index, leg.toId)}
                  </>
                ) : (
                  nameOf(index, ph?.actorId)
                )}
              </span>
              <span className={`badge badge--${tone}`}>{status}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ProcessPanel() {
  useTick(4);
  const process = useCity((s) => s.process);
  const processId = useCity((s) => s.processId);
  const index = useCity((s) => s.index);
  const runs = useCity((s) => s.runs);
  const ctx = useCity((s) => s.ctx);
  const variant = useCity((s) => s.variant);
  const { setVariant, setProcess, select } = useCity.getState();
  const base = index.get(processId);
  const canImprove = base?.kind === 'process' && !!proposalFor(base);
  const metrics = useMemo(() => (process ? metricsOf(compileProcess(process, ctx, { runId: 'm' })) : null), [process, ctx]);
  if (!process || !metrics) return null;
  const latest = [...runs].reverse().find((r) => r.processId === process.id && clock.t <= r.endAt);
  const cur = latest ? sampleRun(latest, clock.t, ctx).phase : undefined;
  const done = new Set(latest?.phases.filter((p) => p.stepId && p.t1 <= clock.t).map((p) => p.stepId));
  return (
    <section className="panel glass">
      <header>
        <select className="proc-select" value={processId} onChange={(e) => setProcess(e.target.value)} title="Процесс для симуляции">
          {index.all('process').map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {canImprove ? (
          <div className="seg">
            <button className={variant === 'asIs' ? 'on' : ''} onClick={() => setVariant('asIs')}>
              Как есть
            </button>
            <button className={variant === 'toBe' ? 'on' : ''} onClick={() => setVariant('toBe')}>
              Как будет
            </button>
          </div>
        ) : (
          <button className="linklike muted" onClick={() => select(process.id)}>
            подробнее
          </button>
        )}
      </header>
      <ol className="stepper">
        {process.steps.map((s, i) => {
          const isCur = cur?.stepId === s.id;
          const isDone = done.has(s.id) && !isCur;
          return (
            <li key={s.id} className={`${isCur ? 'cur' : ''} ${isDone ? 'done' : ''} ${s.manual ? 'manual' : ''}`}>
              <span className="stepper__dot">{isDone ? <CircleCheck size={12} /> : s.manual ? <Hand size={11} /> : i + 1}</span>
              <span className="stepper__name" title={s.name}>
                {s.flow && s.flow !== 'data' && <span className={`flow flow--${s.flow}`}>{FLOW_SHORT[s.flow]}</span>}
                {s.name}
              </span>
              <small>{nameOf(ctx.index, s.actorId)}</small>
            </li>
          );
        })}
      </ol>
      <footer className="metrics">
        <div>
          <small>Цикл</small>
          <b>{fmtSec(metrics.cycleTime)}</b>
        </div>
        <div>
          <small>Ручное</small>
          <b>{Math.round(metrics.manualShare * 100)}%</b>
        </div>
        <div>
          <small>Передачи</small>
          <b>{metrics.handoffs}</b>
        </div>
      </footer>
    </section>
  );
}

const FLOW_SHORT: Record<string, string> = { git: 'Git', nessie: 'Nessie', release: 'Релиз' };

export function EventLogPanel() {
  const log = useCity((s) => s.log);
  const index = useCity((s) => s.index);
  const select = useCity((s) => s.select);
  return (
    <section className="panel glass">
      <header>
        <h3>Журнал событий</h3>
        <small>модель Event</small>
      </header>
      <div className="log">
        {log.slice(0, 40).map((e) => (
          <button key={e.id} className="logrow" onClick={() => select(e.runId ? `run:${e.runId}` : e.subjectId)}>
            <span className={`src src--${e.source}`}>{e.source === 'demo' ? 'демо' : 'факт'}</span>
            <span className="logrow__t">{(e.at / 1000).toFixed(1)}с</span>
            <span className="logrow__type">{EVENT_LABEL[e.type] ?? e.type}</span>
            <span className="logrow__subj">{nameOf(index, e.subjectId)}</span>
          </button>
        ))}
        {!log.length && <div className="muted">Событий пока нет</div>}
      </div>
    </section>
  );
}

export function ImprovePanel() {
  const index = useCity((s) => s.index);
  const ctx = useCity((s) => s.ctx);
  const processId = useCity((s) => s.processId);
  const variant = useCity((s) => s.variant);
  const { setVariant, select } = useCity.getState();
  const base = index.get(processId);
  const data = useMemo(() => {
    if (base?.kind !== 'process') return null;
    const proposal = proposalFor(base);
    return {
      proposal,
      cmp: proposal ? compare(base, proposal, ctx) : null,
      issues: findIssues(base, compileProcess(base, ctx, { runId: 'i' })),
      checks: processChecks(base),
      naming: checkModelNaming(index),
    };
  }, [base, ctx, index]);
  if (!data) return null;
  const { cmp, proposal, issues, checks, naming } = data;
  const max = cmp ? Math.max(cmp.asIs.cycleTime, cmp.toBe.cycleTime) : 1;
  return (
    <section className="panel glass panel--wide">
      <header>
        <h3>Улучшения</h3>
        <div className="cycle">
          {['Наблюдаем', 'Понимаем', 'Улучшаем', 'Измеряем'].map((s, i) => (
            <span key={s} className={i <= (variant === 'toBe' ? 2 : 1) ? 'on' : ''}>
              {s}
            </span>
          ))}
          <RefreshCcw size={12} />
        </div>
      </header>
      <div className="improve">
        <div className="improve__issues">
          {checks.map((c) => (
            <div key={c.id} className={`check ${c.ok ? 'check--ok' : 'check--bad'}`}>
              {c.ok ? '✓' : '✗'} {c.title}
              <small>{c.detail}</small>
            </div>
          ))}
          <div className={`check ${naming.issues.length ? 'check--bad' : 'check--ok'}`}>
            {naming.issues.length ? '✗' : '✓'} Стандарт именования: {naming.checked - new Set(naming.issues.map((i) => i.productId)).size}/{naming.checked}
            <small>{naming.issues.length ? naming.issues.map((i) => `${index.nameOf(i.productId)}: ${i.message}`).join('; ') : 'Слой, префикс, реестры источников и доменов, Landing только для Pattern B, Bronze 1:1'}</small>
          </div>
          {issues.map((f) => (
            <button key={f.id} className={`issue issue--${f.severity}`} onClick={() => select(f.entityId, { focus: true })}>
              <b>{f.title}</b>
              <small>{f.detail}</small>
            </button>
          ))}
        </div>
        <div className="improve__proposal">
          {proposal && cmp ? (
            <>
              <b>{proposal.title}</b>
              <small>{proposal.description}</small>
              <div className="cmp">
                <div>
                  <span>Как есть</span>
                  <div className="bar bar--asis">
                    <div style={{ width: `${(cmp.asIs.cycleTime / max) * 100}%` }} />
                  </div>
                  <b>{fmtSec(cmp.asIs.cycleTime)}</b>
                </div>
                <div>
                  <span>Как будет</span>
                  <div className="bar bar--tobe">
                    <div style={{ width: `${(cmp.toBe.cycleTime / max) * 100}%` }} />
                  </div>
                  <b>{fmtSec(cmp.toBe.cycleTime)}</b>
                </div>
              </div>
              <div className="improve__foot">
                <span>
                  −{Math.round(cmp.savedShare * 100)}% цикла · ручная доля {Math.round(cmp.asIs.manualShare * 100)}% → {Math.round(cmp.toBe.manualShare * 100)}%
                </span>
                <button className="btn" onClick={() => setVariant(variant === 'toBe' ? 'asIs' : 'toBe')}>
                  {variant === 'toBe' ? 'Вернуть «как есть»' : 'Проиграть «как будет»'}
                </button>
              </div>
            </>
          ) : (
            <>
              <b>Предложений нет</b>
              <small>В процессе нет ручных шагов с вариантом автоматизации. Выберите другой процесс или опишите идею в поле automation шага.</small>
            </>
          )}
          <small className="muted">Длительности условные. Решение принимает человек; эффект подтверждается на фактических событиях.</small>
        </div>
      </div>
    </section>
  );
}

/** Right column when nothing is selected — district health at a glance. */
export function OverviewPanel() {
  useTick(3);
  const index = useCity((s) => s.index);
  const overrides = useCity((s) => s.statusOverrides);
  const select = useCity((s) => s.select);
  const systems = index.all('system');
  return (
    <aside className="inspector inspector--overview glass">
      <div className="insp__head">
        <div>
          <div className="insp__kind">Обзор</div>
          <h3>Data Platform District</h3>
        </div>
      </div>
      <div className="insp__body">
        <p className="insp__desc">Нажмите на здание, ноду или грузовик, чтобы открыть инспектор. Колесо — масштаб, правая кнопка — поворот.</p>
        <section className="insp__section">
          <h4>Слои Medallion</h4>
          {index.all('layer').map((l) => {
            const a = activity.active.get(l.id);
            return (
              <button key={l.id} className="sysrow" onClick={() => select(l.id, { focus: true })}>
                <span className="layer-chip" style={{ background: LAYER_COLOR[l.layer] }} />
                <span className="sysrow__name">{l.name}</span>
                <small>{l.catalog}</small>
                <span className={`badge ${a ? 'badge--work' : 'badge--idle'}`}>{a ? 'работает' : 'ожидание'}</span>
              </button>
            );
          })}
        </section>
        <section className="insp__section">
          <h4>Системы района</h4>
          {systems.map((s) => {
            const a = activity.active.get(s.id);
            const st = overrides[s.id] ?? s.status;
            return (
              <button key={s.id} className="sysrow" onClick={() => select(s.id, { focus: true })}>
                <span className={`dot dot--${st}`} />
                <span className="sysrow__name">{s.name}</span>
                <small>{ROLE_LABEL[s.role]}</small>
                <span className={`badge ${a ? (a === 'manual' ? 'badge--warn' : 'badge--work') : 'badge--idle'}`}>{a ? (a === 'manual' ? 'ждёт' : 'работает') : 'ожидание'}</span>
              </button>
            );
          })}
        </section>
      </div>
    </aside>
  );
}
