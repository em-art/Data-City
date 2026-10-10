/**
 * Naming and layering standards of the Data Platform, as executable rules.
 *
 *  - Landing/Bronze are named by SOURCE, Silver/Gold by BUSINESS DOMAIN;
 *  - layer prefixes: stg_ · {domain}_dim__/_fct__/_br__ · {domain}_pdim__/_pfct__/_exp__;
 *  - source and domain codes come from the registry (the model), not from examples;
 *  - no Cyrillic in technical names;
 *  - Landing exists only for Pattern B sources;
 *  - Bronze is 1:1 to its source (no joins of several sources).
 */
import type { ModelIndex } from './graph';
import type { DataProductT, LayerKindT } from './schema';

export interface NamingIssue {
  productId: string;
  rule: string;
  message: string;
}

const LAYER_PATTERNS: Partial<Record<LayerKindT, { re: RegExp; hint: string; by: 'source' | 'domain' }>> = {
  bronze: { re: /^stg_([a-z0-9]+)__([a-z0-9_]+)$/, hint: 'stg_{source}__{entity}', by: 'source' },
  silver: { re: /^([a-z0-9]+)_(dim|fct|br)__([a-z0-9_]+)$/, hint: '{domain}_dim__ / _fct__ / _br__{entity}', by: 'domain' },
  gold: { re: /^([a-z0-9]+)_(pdim|pfct|exp)__([a-z0-9_]+)$/, hint: '{domain}_pdim__ / _pfct__ / _exp__{entity}', by: 'domain' },
};

export function namingHint(layer: LayerKindT): string {
  if (layer === 'sandbox') return '{login}_{name}';
  if (layer === 'landing') return 'имя источника as-is (dlt)';
  return LAYER_PATTERNS[layer]!.hint;
}

export function checkProductNaming(p: DataProductT, ix: ModelIndex): NamingIssue[] {
  const out: NamingIssue[] = [];
  const add = (rule: string, message: string) => out.push({ productId: p.id, rule, message });
  const layerE = p.layerId ? ix.get(p.layerId) : undefined;
  if (!p.technicalName || layerE?.kind !== 'layer') return out;
  const name = p.technicalName;
  const layer = layerE.layer;

  if (/[а-яё]/i.test(name)) add('no-cyrillic', 'Кириллица в техническом имени запрещена');

  const rule = LAYER_PATTERNS[layer];
  if (rule) {
    const m = rule.re.exec(name);
    if (!m) {
      add('layer-prefix', `Имя не соответствует слою ${layer}: ожидается ${rule.hint}`);
    } else if (rule.by === 'source') {
      const code = m[1]!;
      const known = ix.all('system').filter((s) => s.sourceCode).map((s) => s.sourceCode);
      if (!known.includes(code)) add('registry-source', `Источник «${code}» не найден в реестре источников`);
    } else {
      const code = m[1]!;
      const known = ix.all('domain').filter((d) => d.code).map((d) => d.code);
      if (!known.includes(code)) add('registry-domain', `Домен «${code}» не найден в реестре доменов`);
    }
  }

  const sourceSystems = p.sources.map((id) => ix.get(id)).filter((e) => e?.kind === 'system');
  if (layer === 'landing') {
    for (const s of sourceSystems) {
      if (s?.kind === 'system' && s.loadPattern === 'A') {
        add('landing-pattern-b', `Landing только для Pattern B: «${s.name}» подключён федеративно — stg_ читает каталог напрямую`);
      }
    }
  }
  if (layer === 'bronze') {
    const origins = new Set(p.sources);
    if (origins.size > 1) add('bronze-one-to-one', 'Bronze — 1:1 к источнику: джойны нескольких источников переносятся в Silver');
  }
  return out;
}

export function checkModelNaming(ix: ModelIndex): { checked: number; issues: NamingIssue[] } {
  const products = ix.all('dataProduct').filter((p) => p.technicalName && p.layerId);
  return { checked: products.length, issues: products.flatMap((p) => checkProductNaming(p, ix)) };
}
