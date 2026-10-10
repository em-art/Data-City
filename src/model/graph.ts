/**
 * Read-side helpers over the enterprise model: indexing, referential
 * integrity checks and neighbourhood queries used by the inspector,
 * view modes and exporters.
 */
import {
  EnterpriseModel,
  type EnterpriseModelT,
  type EntityKind,
  type EntityT,
} from './schema';

export type EntityOf<K extends EntityKind> = Extract<EntityT, { kind: K }>;

export interface ModelIndex {
  model: EnterpriseModelT;
  byId: Map<string, EntityT>;
  get(id: string): EntityT | undefined;
  all<K extends EntityKind>(kind: K): EntityOf<K>[];
  /** Ids referenced by an entity (owner excluded — it may be a team name). */
  refsOf(e: EntityT): string[];
  /** Every entity that references `id` or is referenced by it. */
  neighbours(id: string): EntityT[];
  /** Human-readable name (falls back to the id). */
  nameOf(id: string | undefined): string;
}

export const displayName = (e: EntityT): string => ('name' in e ? e.name : (e.label ?? e.id));

export function refsOf(e: EntityT): string[] {
  switch (e.kind) {
    case 'domain':
      return [];
    case 'system':
    case 'employee':
      return [e.domainId];
    case 'dataProduct':
      return [e.domainId, e.producedBy, ...e.sources, ...(e.layerId ? [e.layerId] : [])];
    case 'layer':
      return [e.domainId, ...(e.storedIn ? [e.storedIn] : []), ...e.processedBy];
    case 'contract':
      return [e.productId, e.providerId, e.consumerId, ...e.allowedRoute];
    case 'connector':
    case 'relationship':
      return [e.fromId, e.toId];
    case 'process':
      return [e.domainId, ...e.steps.flatMap((s) => [s.actorId, ...s.via, ...(s.carries ? [s.carries] : [])])];
  }
}

export function indexModel(model: EnterpriseModelT): ModelIndex {
  const byId = new Map(model.entities.map((e) => [e.id, e]));
  const reverse = new Map<string, Set<string>>();
  for (const e of model.entities) {
    for (const r of refsOf(e)) {
      if (!reverse.has(r)) reverse.set(r, new Set());
      reverse.get(r)!.add(e.id);
    }
  }
  return {
    model,
    byId,
    get: (id) => byId.get(id),
    all: <K extends EntityKind>(kind: K) =>
      model.entities.filter((e): e is EntityOf<K> => e.kind === kind),
    refsOf,
    nameOf: (id) => {
      const e = id ? byId.get(id) : undefined;
      return e ? displayName(e) : (id ?? '—');
    },
    neighbours(id) {
      const e = byId.get(id);
      if (!e) return [];
      const ids = new Set([...refsOf(e), ...(reverse.get(id) ?? [])]);
      ids.delete(id);
      return [...ids].map((i) => byId.get(i)).filter((x): x is EntityT => !!x);
    },
  };
}

export interface ValidationIssue {
  entityId: string;
  message: string;
}

/** Schema validation + referential integrity. Returns a parsed model or issues. */
export function validateModel(
  raw: unknown,
): { ok: true; model: EnterpriseModelT; issues: [] } | { ok: false; issues: ValidationIssue[] } {
  const parsed = EnterpriseModel.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ entityId: i.path.join('.'), message: i.message })),
    };
  }
  const model = parsed.data;
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const e of model.entities) {
    if (seen.has(e.id)) issues.push({ entityId: e.id, message: 'duplicate id' });
    seen.add(e.id);
  }
  for (const e of model.entities) {
    for (const r of refsOf(e)) {
      if (!seen.has(r)) issues.push({ entityId: e.id, message: `unknown reference ${r}` });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, model, issues: [] };
}
