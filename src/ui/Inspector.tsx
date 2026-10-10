import { ExternalLink, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ModelIndex } from '@/model/graph';
import type { EntityT } from '@/model/schema';
import { clock } from '@/sim/clock';
import { sampleRun, type Run } from '@/sim/engine';
import { useCity } from '@/store/city';
import { EVENT_LABEL, KIND_LABEL, ROLE_LABEL, useTick } from './util';

function Ref({ id }: { id: string }) {
  const index = useCity((s) => s.index);
  const select = useCity((s) => s.select);
  const e = index.get(id);
  if (!e) return <span className="ref ref--plain">{id}</span>;
  return (
    <button className="ref" onClick={() => select(id, { focus: true })}>
      {index.nameOf(id)}
    </button>
  );
}

/** Owner can be an entity id or free text (team name). */
function Owner({ owner }: { owner?: string }) {
  const index = useCity((s) => s.index);
  if (!owner) return <>—</>;
  return index.get(owner) ? <Ref id={owner} /> : <>{owner}</>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="insp__section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="insp__row">
      <span>{k}</span>
      <div>{children}</div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <>—</>;
  return (
    <div className="chips">
      {items.map((i) => (
        <span key={i} className="pill">
          {i}
        </span>
      ))}
    </div>
  );
}

function Dependencies({ id, index }: { id: string; index: ModelIndex }) {
  const conns = index.all('connector').filter((c) => c.fromId === id || c.toId === id);
  const contracts = index.all('contract').filter((c) => c.providerId === id || c.consumerId === id || c.productId === id || c.allowedRoute.includes(id));
  const rels = index.all('relationship').filter((r) => r.fromId === id || r.toId === id);
  if (!conns.length && !contracts.length && !rels.length) return <div className="muted">Связей нет</div>;
  return (
    <div className="deps">
      {conns.map((c) => (
        <div key={c.id} className="dep">
          <span className="pill pill--if">{c.interface.toUpperCase()}</span>
          {c.fromId === id ? '→' : '←'} <Ref id={c.fromId === id ? c.toId : c.fromId} />
          <small>{c.name}</small>
        </div>
      ))}
      {contracts.map((c) => (
        <div key={c.id} className="dep">
          <span className="pill pill--ctr">Контракт</span>
          <Ref id={c.id} />
        </div>
      ))}
      {rels.map((r) => (
        <div key={r.id} className="dep">
          <span className="pill">{r.label ?? r.type}</span>
          {r.fromId === id ? '→' : '←'} <Ref id={r.fromId === id ? r.toId : r.fromId} />
        </div>
      ))}
    </div>
  );
}

function RecentEvents({ id }: { id: string }) {
  const log = useCity((s) => s.log);
  const items = log.filter((e) => e.subjectId === id || e.payload.fromId === id || e.payload.toId === id).slice(0, 5);
  if (!items.length) return <div className="muted">Событий пока нет</div>;
  return (
    <div className="events">
      {items.map((e) => (
        <div key={e.id} className="event">
          <span className={`src src--${e.source}`}>{e.source === 'demo' ? 'демо' : 'факт'}</span>
          {EVENT_LABEL[e.type] ?? e.type}
          {e.stepId && <small> · {e.stepId}</small>}
        </div>
      ))}
    </div>
  );
}

function Docs({ e }: { e: EntityT }) {
  if (e.kind === 'relationship') return null;
  return (
    <>
      <Section title="Документация">
        {e.docs.length ? (
          e.docs.map((d) => (
            <a key={d.url} className="doclink" href={d.url}>
              <ExternalLink size={12} /> {d.title}
            </a>
          ))
        ) : (
          <div className="muted">Нет ссылок</div>
        )}
      </Section>
      {e.history.length > 0 && (
        <Section title="История изменений">
          {e.history.map((h, i) => (
            <div key={i} className="hist">
              <small>{h.at}</small>
              {h.change}
              <small>
                {' '}
                · <Owner owner={h.author} />
              </small>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

function EntityBody({ e, index }: { e: EntityT; index: ModelIndex }) {
  const statusOverride = useCity((s) => s.statusOverrides[e.id]);
  switch (e.kind) {
    case 'system':
      return (
        <>
          <Section title="Назначение и владелец">
            <Row k="Роль">{ROLE_LABEL[e.role]}</Row>
            <Row k="Владелец">
              <Owner owner={e.owner} />
            </Row>
            <Row k="Домен">
              <Ref id={e.domainId} />
            </Row>
          </Section>
          <Section title="Технологии и интерфейсы">
            <Row k="Стек">
              <Chips items={e.technologies} />
            </Row>
            <Row k="Интерфейсы">
              <Chips items={e.interfaces.map((i) => i.toUpperCase())} />
            </Row>
          </Section>
          <Section title="Контракты и зависимости">
            <Dependencies id={e.id} index={index} />
          </Section>
          <Section title="События и состояние">
            <Row k="Состояние">
              <span className={`status status--${statusOverride ?? e.status}`}>{statusOverride ?? e.status}</span>
              {statusOverride && <small className="muted"> (факт)</small>}
            </Row>
            <RecentEvents id={e.id} />
          </Section>
        </>
      );
    case 'employee':
      return (
        <>
          <Section title="Роль и навыки">
            <Row k="Роль">{e.role}</Row>
            <Row k="Домен">
              <Ref id={e.domainId} />
            </Row>
            <Row k="Навыки">
              <Chips items={e.skills} />
            </Row>
          </Section>
          {e.assistant && (
            <Section title="Цифровой помощник">
              <Row k="Имя">{e.assistant.name}</Row>
              <Row k="Умеет">
                <Chips items={e.assistant.capabilities} />
              </Row>
            </Section>
          )}
          <Section title="Контекст ноды · Нить">
            {e.context.map((c) => (
              <div key={c} className="ctx">
                ◆ {c}
              </div>
            ))}
          </Section>
          <Section title="Связи">
            <Dependencies id={e.id} index={index} />
          </Section>
        </>
      );
    case 'dataProduct': {
      const q = e.quality;
      return (
        <>
          <Section title="Продукт">
            <Row k="Версия">v{e.version}</Row>
            <Row k="Владелец">
              <Owner owner={e.owner} />
            </Row>
            <Row k="Производит">
              <Ref id={e.producedBy} />
            </Row>
            <Row k="Источники">
              {e.sources.map((s) => (
                <Ref key={s} id={s} />
              ))}
            </Row>
            <Row k="Классификация">{e.classification}</Row>
            <Row k="Качество">
              <div className="bar">
                <div style={{ width: `${q.checks ? (q.passed / q.checks) * 100 : 0}%` }} />
              </div>
              {q.passed}/{q.checks}
            </Row>
          </Section>
          <Section title="Контракты и потребители">
            <Dependencies id={e.id} index={index} />
          </Section>
          <Section title="События">
            <RecentEvents id={e.id} />
          </Section>
        </>
      );
    }
    case 'contract':
      return (
        <>
          <Section title="Условия">
            <Row k="Продукт">
              <Ref id={e.productId} />
            </Row>
            <Row k="Поставщик">
              <Ref id={e.providerId} />
            </Row>
            <Row k="Потребитель">
              <Ref id={e.consumerId} />
            </Row>
            <Row k="Интерфейс">{e.interface.toUpperCase()}</Row>
            <Row k="Свежесть">{e.sla.freshness}</Row>
            <Row k="Доступность">{e.sla.availability}</Row>
            <Row k="Схема">{e.schemaVersion}</Row>
            <Row k="Статус">{e.status}</Row>
          </Section>
          <Section title="Разрешённый маршрут">
            <ol className="route">
              {e.allowedRoute.map((r) => (
                <li key={r}>
                  <Ref id={r} />
                </li>
              ))}
            </ol>
          </Section>
        </>
      );
    case 'domain':
      return (
        <Section title="Состав района">
          {index
            .all('system')
            .filter((s) => s.domainId === e.id)
            .map((s) => (
              <div key={s.id} className="dep">
                <span className="pill">{ROLE_LABEL[s.role]}</span>
                <Ref id={s.id} />
              </div>
            ))}
          {index
            .all('employee')
            .filter((s) => s.domainId === e.id)
            .map((s) => (
              <div key={s.id} className="dep">
                <span className="pill">нода</span>
                <Ref id={s.id} />
              </div>
            ))}
        </Section>
      );
    case 'process':
      return (
        <Section title="Шаги">
          <ol className="route">
            {e.steps.map((s) => (
              <li key={s.id} className={s.manual ? 'manual' : ''}>
                {s.name} — <Ref id={s.actorId} />
              </li>
            ))}
          </ol>
        </Section>
      );
    case 'connector':
      return (
        <Section title="Соединение">
          <Row k="Откуда">
            <Ref id={e.fromId} />
          </Row>
          <Row k="Куда">
            <Ref id={e.toId} />
          </Row>
          <Row k="Интерфейс">{e.interface.toUpperCase()}</Row>
          <Row k="Технология">{e.technology ?? '—'}</Row>
        </Section>
      );
    default:
      return null;
  }
}

function RunBody({ run }: { run: Run }) {
  useTick(4);
  const index = useCity((s) => s.index);
  const ctx = useCity((s) => s.ctx);
  const s = sampleRun(run, clock.t, ctx);
  const cargoId = run.phases.map((p) => p.cargoId).find(Boolean);
  const product = cargoId ? index.get(cargoId) : undefined;
  const contract = run.contractId ? index.get(run.contractId) : undefined;
  const visited = new Set(run.phases.filter((p) => p.t1 <= clock.t).flatMap((p) => [p.actorId, p.toId ?? '']));
  const active = useCity((st) => st.process);
  const proc = active?.id === run.processId ? active : index.get(run.processId);
  const step = proc?.kind === 'process' ? proc.steps.find((x) => x.id === s.phase?.stepId) : undefined;
  return (
    <>
      <div className={`provenance provenance--${run.source}`}>
        {run.source === 'demo'
          ? 'Демонстрационный сценарий. Анимация иллюстрирует процесс и не отражает фактическую работу.'
          : 'Фактическое событие из подключённого источника.'}
      </div>
      <Section title="Груз">
        {product?.kind === 'dataProduct' ? (
          <>
            <Row k="Продукт">
              <Ref id={product.id} />
            </Row>
            <Row k="Версия">v{product.version}</Row>
            <Row k="Владелец">
              <Owner owner={product.owner} />
            </Row>
            <Row k="Источник">
              {product.sources.map((x) => (
                <Ref key={x} id={x} />
              ))}
            </Row>
          </>
        ) : (
          <div className="muted">Сырые изменения (CDC) — ещё не продукт</div>
        )}
      </Section>
      <Section title="Сейчас">
        <Row k="Фаза">
          {!s.phase ? 'Завершено' : s.phase.kind === 'travel' ? <>В пути → <Ref id={s.phase.toId ?? ''} /></> : s.phase.kind === 'manual' ? 'Ожидает человека' : 'Обработка'}
        </Row>
        {step && <Row k="Шаг">{step.name}</Row>}
        <Row k="Прогресс">
          <div className="bar">
            <div style={{ width: `${Math.round(s.progress * 100)}%` }} />
          </div>
        </Row>
      </Section>
      {contract?.kind === 'contract' && (
        <Section title="Контракт и разрешённый маршрут">
          <Row k="Контракт">
            <Ref id={contract.id} />
          </Row>
          <ol className="route">
            {contract.allowedRoute.map((r) => (
              <li key={r} className={visited.has(r) ? 'done' : ''}>
                <Ref id={r} />
              </li>
            ))}
          </ol>
          {run.phases.some((p) => p.routeViolation) && <div className="issue issue--critical">Маршрут выходит за рамки контракта</div>}
        </Section>
      )}
    </>
  );
}

export function Inspector() {
  const selectedId = useCity((s) => s.selectedId);
  const index = useCity((s) => s.index);
  const runs = useCity((s) => s.runs);
  const select = useCity((s) => s.select);
  if (!selectedId) return null;

  let kind = '';
  let title = '';
  let body: ReactNode = null;
  let sub: ReactNode = null;

  if (selectedId === 'ambient') {
    kind = 'Фоновый транспорт';
    title = 'Декоративная машина';
    body = <div className="provenance provenance--demo">Фоновое движение оживляет сцену и не связано с данными или событиями предприятия.</div>;
  } else if (selectedId.startsWith('run:')) {
    const run = runs.find((r) => `run:${r.id}` === selectedId);
    kind = 'Доставка';
    title = run ? `Грузовик ${run.id}` : 'Доставка завершена';
    body = run ? <RunBody run={run} /> : <div className="muted">Рейс завершён и удалён из сцены.</div>;
  } else {
    const e = index.get(selectedId);
    if (!e) return null;
    kind = KIND_LABEL[e.kind];
    title = index.nameOf(e.id);
    sub = 'domainId' in e ? <Ref id={e.domainId} /> : null;
    body = (
      <>
        {'description' in e && e.description && <p className="insp__desc">{e.description}</p>}
        <EntityBody e={e} index={index} />
        <Docs e={e} />
        <div className="insp__id">id: {e.id}</div>
      </>
    );
  }

  return (
    <aside className="inspector glass">
      <div className="insp__head">
        <div>
          <div className="insp__kind">{kind}</div>
          <h3>{title}</h3>
          {sub && <div className="insp__sub">{sub}</div>}
        </div>
        <button className="icon-btn" onClick={() => select(null)} title="Закрыть">
          <X size={16} />
        </button>
      </div>
      <div className="insp__body">{body}</div>
    </aside>
  );
}
