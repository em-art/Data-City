import { describe, expect, it } from 'vitest';
import { loadDemoModel } from '@/data';
import { indexModel } from './graph';
import { checkModelNaming, checkProductNaming } from './naming';
import type { DataProductT } from './schema';

const ix = indexModel(loadDemoModel());
const draft = (o: Partial<DataProductT>): DataProductT => ({
  id: 'dp.draft',
  kind: 'dataProduct',
  name: 'draft',
  description: '',
  domainId: 'dom.data',
  producedBy: 'layer.bronze',
  version: '1.0.0',
  sources: [],
  quality: { checks: 0, passed: 0 },
  classification: 'internal',
  tags: [],
  docs: [],
  history: [],
  ...o,
});
const rules = (o: Partial<DataProductT>) => checkProductNaming(draft(o), ix).map((i) => i.rule);

describe('naming standard', () => {
  it('the demo model complies', () => {
    const r = checkModelNaming(ix);
    expect(r.checked).toBe(6);
    expect(r.issues).toEqual([]);
  });

  it('checks layer prefixes', () => {
    expect(rules({ technicalName: 'corpgov_dim__person', layerId: 'layer.bronze' })).toContain('layer-prefix');
    expect(rules({ technicalName: 'stg_eva__person', layerId: 'layer.gold' })).toContain('layer-prefix');
    expect(rules({ technicalName: 'corpgov_exp__person', layerId: 'layer.gold' })).toEqual([]);
  });

  it('takes source and domain codes from the registry', () => {
    expect(rules({ technicalName: 'stg_crm__person', layerId: 'layer.bronze' })).toContain('registry-source');
    expect(rules({ technicalName: 'finance_fct__payment', layerId: 'layer.silver' })).toContain('registry-domain');
  });

  it('forbids Cyrillic in technical names', () => {
    expect(rules({ technicalName: 'stg_eva__переходы', layerId: 'layer.bronze' })).toContain('no-cyrillic');
  });

  it('keeps Landing for Pattern B only and Bronze 1:1', () => {
    expect(rules({ technicalName: 'eva_raw', layerId: 'layer.landing', sources: ['sys.eva'] })).toContain('landing-pattern-b');
    expect(rules({ technicalName: 'extapi_raw', layerId: 'layer.landing', sources: ['sys.extapi'] })).toEqual([]);
    expect(rules({ technicalName: 'stg_eva__transitions', layerId: 'layer.bronze', sources: ['sys.eva', 'sys.extapi'] })).toContain('bronze-one-to-one');
  });
});
