import { describe, expect, it } from 'vitest';
import { loadDemoModel, loadDemoSpace } from '@/data';
import { indexModel, validateModel } from './graph';
import { toMermaidFlowchart, toMermaidSequence } from './mermaid';

describe('enterprise model', () => {
  it('demo model is valid and referentially consistent', () => {
    const m = loadDemoModel();
    expect(m.entities.length).toBeGreaterThan(20);
  });

  it('reports unknown references', () => {
    const r = validateModel({
      version: '1',
      name: 't',
      entities: [{ id: 'sys.a', kind: 'system', name: 'A', domainId: 'dom.missing', role: 'source' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.message).toContain('dom.missing');
  });

  it('every placement points to an existing entity and every system is placed', () => {
    const ix = indexModel(loadDemoModel());
    const space = loadDemoSpace();
    for (const p of space.placements) expect(ix.get(p.entityId), p.entityId).toBeDefined();
    for (const s of ix.all('system')) {
      expect(space.placements.some((p) => p.entityId === s.id), s.id).toBe(true);
    }
  });

  it('neighbours include both directions', () => {
    const ix = indexModel(loadDemoModel());
    const ids = ix.neighbours('sys.istok').map((e) => e.id);
    expect(ids).toContain('con.warehouse-istok');
    expect(ids).toContain('ctr.subscriber-base-bi');
  });

  it('exports Mermaid from the same model', () => {
    const m = loadDemoModel();
    expect(toMermaidFlowchart(m)).toContain('sys_istok -- "sql" --> sys_bi');
    expect(toMermaidSequence(m, 'proc.subscriber-delivery')).toContain('participant sys_eva as EVA');
  });
});
