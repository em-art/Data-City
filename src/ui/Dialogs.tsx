import { Copy, Download, Upload, X } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ARCHETYPE_BY_ROLE, CATALOG } from '@/assets/catalog';
import { validateModel } from '@/model/graph';
import { toMermaidFlowchart, toMermaidSequence } from '@/model/mermaid';
import type { EntityT, InterfaceTypeT, SystemT } from '@/model/schema';
import { autoPlace } from '@/space/layout';
import { SpaceModel, type ArchetypeT } from '@/space/schema';
import { useCity } from '@/store/city';
import { ROLE_LABEL, slug } from './util';

const IFACES: InterfaceTypeT[] = ['api', 'sql', 'stream', 'mcp', 'file', 'ui'];
const ROLES = Object.keys(ROLE_LABEL) as SystemT['role'][];

function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__box glass">
        <header>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

function uniqueId(prefix: string, name: string, taken: Map<string, unknown>) {
  const base = `${prefix}.${slug(name)}`;
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}

type Tab = 'system' | 'employee' | 'connector' | 'product';

export function AddDialog() {
  const [tab, setTab] = useState<Tab>('system');
  const [error, setError] = useState<string | null>(null);
  const index = useCity((s) => s.index);
  const space = useCity((s) => s.space);
  const { addEntity, setDialog, select, setView } = useCity.getState();
  const domains = index.all('domain');
  const systems = index.all('system');
  const employees = index.all('employee');

  const [f, setF] = useState({
    name: '',
    domainId: domains[0]?.id ?? '',
    role: 'consumer' as SystemT['role'],
    archetype: '' as ArchetypeT | '',
    tech: '',
    interfaces: ['sql'] as InterfaceTypeT[],
    owner: '',
    empRole: '',
    skills: '',
    assistant: '',
    fromId: systems[0]?.id ?? '',
    toId: systems[1]?.id ?? '',
    iface: 'sql' as InterfaceTypeT,
    version: '1.0.0',
    producedBy: systems.find((s) => s.role === 'processing')?.id ?? '',
    consumerId: '',
    freshness: 'T+1',
  });
  const up = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    try {
      if (!f.name.trim()) throw new Error('Укажите название');
      const name = f.name.trim();
      if (tab === 'system') {
        const id = uniqueId('sys', name, index.byId);
        const archetype = f.archetype || ARCHETYPE_BY_ROLE[f.role];
        const placed = autoPlace(space, { entityId: id, domainId: f.domainId, archetype });
        const e: EntityT = {
          id,
          kind: 'system',
          name,
          description: '',
          domainId: f.domainId,
          role: f.role,
          technologies: list(f.tech),
          interfaces: f.interfaces,
          status: 'healthy',
          owner: f.owner || undefined,
          tags: [],
          docs: [],
          history: [{ at: new Date().toISOString().slice(0, 10), author: 'Data City editor', change: 'Создана в редакторе' }],
        };
        addEntity(e, placed.space);
        select(id, { focus: true });
      } else if (tab === 'employee') {
        const id = uniqueId('emp', name, index.byId);
        const placed = autoPlace(space, { entityId: id, domainId: f.domainId, archetype: 'employeeNode', withPort: false });
        addEntity(
          {
            id,
            kind: 'employee',
            name,
            description: '',
            domainId: f.domainId,
            role: f.empRole || 'Сотрудник',
            skills: list(f.skills),
            assistant: f.assistant ? { name: f.assistant, capabilities: [] } : undefined,
            context: [],
            tags: [],
            docs: [],
            history: [],
          },
          placed.space,
        );
        setView('people');
        select(id, { focus: true });
      } else if (tab === 'connector') {
        if (f.fromId === f.toId) throw new Error('Выберите разные системы');
        const id = uniqueId('con', `${f.fromId.split('.')[1]}-${f.toId.split('.')[1]}`, index.byId);
        addEntity({ id, kind: 'connector', name, description: '', fromId: f.fromId, toId: f.toId, interface: f.iface, technology: f.tech || undefined, tags: [], docs: [], history: [] });
        setView('systems');
        select(id);
      } else {
        const id = uniqueId('dp', name, index.byId);
        const producer = index.get(f.producedBy);
        if (producer?.kind !== 'system') throw new Error('Выберите систему-производителя');
        const s = useCity.getState();
        s.addEntity({
          id,
          kind: 'dataProduct',
          name,
          description: '',
          domainId: producer.domainId,
          producedBy: producer.id,
          version: f.version,
          sources: [],
          quality: { checks: 0, passed: 0 },
          classification: 'internal',
          owner: f.owner || undefined,
          tags: [],
          docs: [],
          history: [],
        });
        if (f.consumerId) {
          const delivery = systems.find((x) => x.role === 'delivery');
          const route = [producer.id, ...(delivery ? [delivery.id] : []), f.consumerId];
          useCity.getState().addEntity({
            id: uniqueId('ctr', name, useCity.getState().index.byId),
            kind: 'contract',
            name: `Контракт: ${name}`,
            description: '',
            productId: id,
            providerId: delivery?.id ?? producer.id,
            consumerId: f.consumerId,
            interface: f.iface,
            sla: { freshness: f.freshness, availability: '99%' },
            schemaVersion: f.version.split('.')[0] + '.x',
            allowedRoute: route,
            status: 'draft',
            tags: [],
            docs: [],
            history: [],
          });
        }
        setView('data');
        select(id);
      }
      setDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const systemOptions = systems.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ));

  return (
    <Modal title="Добавить в город" onClose={() => setDialog(null)}>
      <div className="seg seg--tabs">
        {(
          [
            ['system', 'Система'],
            ['employee', 'Сотрудник'],
            ['connector', 'Связь'],
            ['product', 'Продукт данных'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="form">
        <Field label="Название">
          <input autoFocus value={f.name} onChange={(e) => up({ name: e.target.value })} placeholder={tab === 'system' ? 'Например: CRM' : ''} />
        </Field>
        {(tab === 'system' || tab === 'employee') && (
          <Field label="Район (домен)">
            <select value={f.domainId} onChange={(e) => up({ domainId: e.target.value })}>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {tab === 'system' && (
          <>
            <div className="form__row">
              <Field label="Роль">
                <select value={f.role} onChange={(e) => up({ role: e.target.value as SystemT['role'], archetype: '' })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Тип здания">
                <select value={f.archetype || ARCHETYPE_BY_ROLE[f.role]} onChange={(e) => up({ archetype: e.target.value as ArchetypeT })}>
                  {(Object.keys(CATALOG) as ArchetypeT[])
                    .filter((a) => a !== 'employeeNode')
                    .map((a) => (
                      <option key={a} value={a}>
                        {CATALOG[a].label}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <Field label="Технологии (через запятую)">
              <input value={f.tech} onChange={(e) => up({ tech: e.target.value })} placeholder="PostgreSQL, Kafka" />
            </Field>
            <Field label="Интерфейсы">
              <div className="checks">
                {IFACES.map((i) => (
                  <label key={i}>
                    <input
                      type="checkbox"
                      checked={f.interfaces.includes(i)}
                      onChange={(e) => up({ interfaces: e.target.checked ? [...f.interfaces, i] : f.interfaces.filter((x) => x !== i) })}
                    />
                    {i.toUpperCase()}
                  </label>
                ))}
              </div>
            </Field>
          </>
        )}
        {tab === 'employee' && (
          <>
            <Field label="Роль">
              <input value={f.empRole} onChange={(e) => up({ empRole: e.target.value })} placeholder="Data Analyst" />
            </Field>
            <Field label="Навыки (через запятую)">
              <input value={f.skills} onChange={(e) => up({ skills: e.target.value })} />
            </Field>
            <Field label="Цифровой помощник">
              <input value={f.assistant} onChange={(e) => up({ assistant: e.target.value })} placeholder="Помощник аналитика" />
            </Field>
          </>
        )}
        {tab === 'connector' && (
          <>
            <div className="form__row">
              <Field label="Откуда">
                <select value={f.fromId} onChange={(e) => up({ fromId: e.target.value })}>
                  {systemOptions}
                </select>
              </Field>
              <Field label="Куда">
                <select value={f.toId} onChange={(e) => up({ toId: e.target.value })}>
                  {systemOptions}
                </select>
              </Field>
            </div>
            <div className="form__row">
              <Field label="Интерфейс">
                <select value={f.iface} onChange={(e) => up({ iface: e.target.value as InterfaceTypeT })}>
                  {IFACES.map((i) => (
                    <option key={i} value={i}>
                      {i.toUpperCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Технология">
                <input value={f.tech} onChange={(e) => up({ tech: e.target.value })} placeholder="Kafka" />
              </Field>
            </div>
          </>
        )}
        {tab === 'product' && (
          <>
            <div className="form__row">
              <Field label="Производитель">
                <select value={f.producedBy} onChange={(e) => up({ producedBy: e.target.value })}>
                  {systemOptions}
                </select>
              </Field>
              <Field label="Версия">
                <input value={f.version} onChange={(e) => up({ version: e.target.value })} />
              </Field>
            </div>
            <div className="form__row">
              <Field label="Потребитель (контракт)">
                <select value={f.consumerId} onChange={(e) => up({ consumerId: e.target.value })}>
                  <option value="">— без контракта —</option>
                  {systemOptions}
                </select>
              </Field>
              <Field label="Свежесть (SLA)">
                <input value={f.freshness} onChange={(e) => up({ freshness: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        {(tab === 'system' || tab === 'product') && (
          <Field label="Владелец">
            <select value={f.owner} onChange={(e) => up({ owner: e.target.value })}>
              <option value="">—</option>
              {employees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <div className="issue issue--critical">{error}</div>}
        <div className="form__foot">
          <small className="muted">Изменения сохраняются в модель предприятия; размещение в городе подбирается автоматически.</small>
          <button className="btn btn--primary" type="submit">
            Добавить
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ExportTab = 'model' | 'space' | 'flow' | 'seq';

export function ExportDialog() {
  const [tab, setTab] = useState<ExportTab>('flow');
  const [msg, setMsg] = useState<string | null>(null);
  const model = useCity((s) => s.model);
  const space = useCity((s) => s.space);
  const processId = useCity((s) => s.processId);
  const { setDialog, applyEdit, resetWorkspace } = useCity.getState();

  const text = useMemo(() => {
    switch (tab) {
      case 'model':
        return JSON.stringify(model, null, 2);
      case 'space':
        return JSON.stringify(space, null, 2);
      case 'flow':
        return toMermaidFlowchart(model);
      case 'seq':
        return toMermaidSequence(model, processId);
    }
  }, [tab, model, space, processId]);

  const download = () => {
    const ext = tab === 'model' || tab === 'space' ? 'json' : 'mmd';
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `data-city-${tab}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.entities) {
        const r = validateModel(data);
        if (!r.ok) throw new Error(r.issues.slice(0, 5).map((i) => `${i.entityId}: ${i.message}`).join('\n'));
        applyEdit(r.model, space);
      } else {
        applyEdit(model, SpaceModel.parse(data));
      }
      setMsg('Импортировано');
    } catch (e) {
      setMsg(`Ошибка импорта: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Modal title="Модель предприятия" onClose={() => setDialog(null)}>
      <p className="muted">Город — проекция модели. Те же данные доступны как JSON и как Mermaid-диаграммы для документации.</p>
      <div className="seg seg--tabs">
        {(
          [
            ['flow', 'Mermaid · связи'],
            ['seq', 'Mermaid · процесс'],
            ['model', 'JSON · модель'],
            ['space', 'JSON · пространство'],
          ] as [ExportTab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <pre className="code">{text}</pre>
      <div className="form__foot">
        <div className="btns">
          <button className="btn" onClick={() => navigator.clipboard?.writeText(text).then(() => setMsg('Скопировано'))}>
            <Copy size={14} /> Копировать
          </button>
          <button className="btn" onClick={download}>
            <Download size={14} /> Скачать
          </button>
          <label className="btn">
            <Upload size={14} /> Импорт JSON
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
        </div>
        <button
          className="btn"
          onClick={() => {
            resetWorkspace();
            setMsg('Восстановлена демо-модель');
          }}
        >
          Сбросить к демо
        </button>
      </div>
      {msg && <div className="muted">{msg}</div>}
    </Modal>
  );
}
