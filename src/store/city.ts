/**
 * Application state (Zustand). Holds the two models, the current lens,
 * selection and the simulation feed. Simulation *time* lives in a mutable
 * clock (src/sim/clock.ts) so per-frame updates never re-render React.
 */
import { create } from 'zustand';
import { loadDemoModel, loadDemoSpace } from '@/data';
import { indexModel, validateModel, type ModelIndex } from '@/model/graph';
import type { EnterpriseModelT, EntityT, ModelEventT, ProcessT } from '@/model/schema';
import { automateManualSteps } from '@/sim/analysis';
import { clock } from '@/sim/clock';
import { compileProcess, compileTrip, type Run, type SimContext } from '@/sim/engine';
import { buildRoadGraph } from '@/space/routing';
import { SpaceModel, type SpaceModelT } from '@/space/schema';

export type ViewMode = 'city' | 'systems' | 'data' | 'people' | 'process' | 'metadata' | 'improve';
export type Variant = 'asIs' | 'toBe';

const STORAGE_KEY = 'data-city:workspace:v1';
export const DEFAULT_PROCESS = 'proc.subscriber-delivery';
const MAX_LOG = 120;

interface Workspace {
  model: EnterpriseModelT;
  space: SpaceModelT;
}

function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Workspace;
      const m = validateModel(data.model);
      const s = SpaceModel.safeParse(data.space);
      if (m.ok && s.success) return { model: m.model, space: s.data };
    }
  } catch {
    /* storage unavailable or corrupt — fall back to the bundled demo */
  }
  return { model: loadDemoModel(), space: loadDemoSpace() };
}

function saveWorkspace(w: Workspace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
  } catch {
    /* ignore */
  }
}

function derive(w: Workspace): { index: ModelIndex; ctx: SimContext } {
  const index = indexModel(w.model);
  return { index, ctx: { index, space: w.space, graph: buildRoadGraph(w.space) } };
}

function resolveProcess(index: ModelIndex, processId: string, variant: Variant): ProcessT | undefined {
  const p = index.get(processId);
  if (p?.kind !== 'process') return undefined;
  return variant === 'toBe' ? automateManualSteps().apply(p) : p;
}

export interface LogEntry extends ModelEventT {
  runId?: string;
}

export interface CityState extends Workspace {
  index: ModelIndex;
  ctx: SimContext;

  view: ViewMode;
  selectedId: string | null;
  hoveredId: string | null;
  focus: { at: [number, number]; seq: number } | null;

  source: 'demo' | 'live';
  liveStatus: 'off' | 'connecting' | 'open' | 'error';
  variant: Variant;
  processId: string;
  /** Active process for the current variant (memoized; as-is or to-be). */
  process: ProcessT | undefined;
  playing: boolean;
  rate: number;

  runs: Run[];
  runSeq: number;
  log: LogEntry[];
  stats: { dispatched: number; delivered: number; checks: number; violations: number };
  statusOverrides: Record<string, string>;

  dialog: null | 'add' | 'export';

  setView(v: ViewMode): void;
  select(id: string | null, opts?: { focus?: boolean }): void;
  hover(id: string | null): void;
  setPlaying(p: boolean): void;
  setRate(r: number): void;
  setVariant(v: Variant): void;
  setSource(s: 'demo' | 'live'): void;
  setLiveStatus(s: CityState['liveStatus']): void;
  setDialog(d: CityState['dialog']): void;

  startDemoRun(at: number): Run | undefined;
  ingestLive(e: ModelEventT): void;
  pushEvents(events: LogEntry[]): void;

  applyEdit(model: EnterpriseModelT, space: SpaceModelT): void;
  addEntity(entity: EntityT, space?: SpaceModelT): void;
  resetWorkspace(): void;
}

const runLabel = (n: number) => `#${(123190270 + n).toString()}`;

export const useCity = create<CityState>((set, get) => {
  const ws = loadWorkspace();
  const derived = derive(ws);
  return {
    ...ws,
    ...derived,
    process: resolveProcess(derived.index, DEFAULT_PROCESS, 'asIs'),
    view: 'city',
    selectedId: null,
    hoveredId: null,
    focus: null,
    source: 'demo',
    liveStatus: 'off',
    variant: 'asIs',
    processId: DEFAULT_PROCESS,
    playing: true,
    rate: 1,
    runs: [],
    runSeq: 0,
    log: [],
    stats: { dispatched: 0, delivered: 0, checks: 0, violations: 0 },
    statusOverrides: {},
    dialog: null,

    setView: (view) => set({ view }),
    select: (selectedId, opts) => {
      let focus = get().focus;
      if (selectedId && opts?.focus) {
        const p = get().space.placements.find((x) => x.entityId === selectedId);
        if (p) focus = { at: p.position, seq: (focus?.seq ?? 0) + 1 };
      }
      set({ selectedId, focus });
    },
    hover: (hoveredId) => set({ hoveredId }),
    setPlaying: (playing) => set({ playing }),
    setRate: (rate) => set({ rate }),
    setVariant: (variant) => set((s) => ({ variant, runs: [], process: resolveProcess(s.index, s.processId, variant) })),
    setSource: (source) => set({ source, runs: [], liveStatus: source === 'live' ? 'connecting' : 'off' }),
    setLiveStatus: (liveStatus) => set({ liveStatus }),
    setDialog: (dialog) => set({ dialog }),

    startDemoRun(at) {
      const p = get().process;
      if (!p) return undefined;
      const n = get().runSeq + 1;
      const run = compileProcess(p, get().ctx, { runId: runLabel(n), startAt: at, source: 'demo' });
      set((s) => ({ runs: [...s.runs.filter((r) => r.endAt > at - 30)].slice(-4).concat(run), runSeq: n }));
      return run;
    },

    ingestLive(e) {
      const s = get();
      const entry: LogEntry = { ...e, at: Math.round(clock.t * 1000) };
      if (e.type === 'product.dispatched') {
        const fromId = String(e.payload.fromId ?? '');
        const toId = String(e.payload.toId ?? '');
        const cargo = s.index.get(e.subjectId)?.kind === 'dataProduct' ? e.subjectId : undefined;
        const n = s.runSeq + 1;
        const run = compileTrip(s.ctx, { runId: runLabel(n), fromId, toId, cargoId: cargo, startAt: clock.t, source: 'live' });
        if (run) {
          entry.runId = run.id;
          set((st) => ({ runs: st.runs.filter((r) => r.endAt > clock.t - 5).slice(-12).concat(run), runSeq: n }));
        }
      }
      if (e.type === 'system.status' && typeof e.payload.status === 'string') {
        set((st) => ({ statusOverrides: { ...st.statusOverrides, [e.subjectId]: e.payload.status as string } }));
      }
      get().pushEvents([entry]);
    },

    pushEvents(events) {
      if (!events.length) return;
      set((s) => {
        const stats = { ...s.stats };
        for (const e of events) {
          if (e.type === 'product.dispatched') {
            stats.dispatched++;
            if (e.payload.routeViolation) stats.violations++;
          }
          if (e.type === 'product.delivered') stats.delivered++;
          if (e.type === 'contract.checked') stats.checks++;
        }
        return { log: [...events.reverse(), ...s.log].slice(0, MAX_LOG), stats };
      });
    },

    applyEdit(model, space) {
      const w = { model, space };
      saveWorkspace(w);
      const d = derive(w);
      set((s) => ({ ...w, ...d, runs: [], process: resolveProcess(d.index, s.processId, s.variant) }));
    },

    addEntity(entity, space) {
      const s = get();
      const model = { ...s.model, entities: [...s.model.entities, entity] };
      const r = validateModel(model);
      if (!r.ok) throw new Error(r.issues.map((i) => `${i.entityId}: ${i.message}`).join('\n'));
      get().applyEdit(r.model, space ?? s.space);
    },

    resetWorkspace() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const w = { model: loadDemoModel(), space: loadDemoSpace() };
      const d = derive(w);
      set((s) => ({ ...w, ...d, process: resolveProcess(d.index, s.processId, s.variant), runs: [], log: [], selectedId: null, stats: { dispatched: 0, delivered: 0, checks: 0, violations: 0 } }));
    },
  };
});
