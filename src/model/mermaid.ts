/**
 * Mermaid projection of the enterprise model — the same data the 3D city
 * renders, as a diagram for docs and reviews.
 */
import { indexModel } from './graph';
import type { EnterpriseModelT } from './schema';

const safe = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_');
const label = (s: string) => s.replace(/"/g, "'");

export function toMermaidFlowchart(model: EnterpriseModelT): string {
  const ix = indexModel(model);
  const lines = ['flowchart LR'];

  for (const d of ix.all('domain')) {
    lines.push(`  subgraph ${safe(d.id)}["${label(d.name)}"]`);
    for (const s of ix.all('system').filter((s) => s.domainId === d.id)) {
      lines.push(`    ${safe(s.id)}["${label(s.name)}"]`);
    }
    for (const p of ix.all('employee').filter((p) => p.domainId === d.id)) {
      lines.push(`    ${safe(p.id)}(("${label(p.name)}"))`);
    }
    for (const p of ix.all('dataProduct').filter((p) => p.domainId === d.id)) {
      lines.push(`    ${safe(p.id)}[/"${label(p.name)} v${p.version}"/]`);
    }
    lines.push('  end');
  }

  for (const c of ix.all('connector')) {
    lines.push(`  ${safe(c.fromId)} -- "${c.interface}" --> ${safe(c.toId)}`);
  }
  for (const r of ix.all('relationship')) {
    lines.push(`  ${safe(r.fromId)} -. "${r.label ?? r.type}" .-> ${safe(r.toId)}`);
  }
  for (const c of ix.all('contract')) {
    lines.push(`  ${safe(c.productId)} == "${label(c.name)}" ==> ${safe(c.consumerId)}`);
  }
  return lines.join('\n');
}

export function toMermaidSequence(model: EnterpriseModelT, processId: string): string {
  const ix = indexModel(model);
  const p = ix.get(processId);
  if (!p || p.kind !== 'process') throw new Error(`process ${processId} not found`);
  const lines = ['sequenceDiagram', `  title ${label(p.name)}`];
  const actors = [...new Set(p.steps.map((s) => s.actorId))];
  for (const a of actors) lines.push(`  participant ${safe(a)} as ${label(ix.nameOf(a))}`);
  p.steps.forEach((s, i) => {
    const next = p.steps[i + 1];
    const from = safe(s.actorId);
    if (next && next.actorId !== s.actorId) {
      const cargo = s.carries ? ` (${label(ix.nameOf(s.carries))})` : '';
      lines.push(`  ${from}->>${safe(next.actorId)}: ${label(s.name)}${cargo}`);
    } else {
      lines.push(`  Note over ${from}: ${label(s.name)}${s.manual ? ' ✋' : ''}`);
    }
  });
  return lines.join('\n');
}
