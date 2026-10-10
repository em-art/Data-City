/**
 * Prints Mermaid diagrams generated from the enterprise model.
 * Run: npm run export:mermaid > docs/model.md
 */
import { readFileSync } from 'node:fs';
import { validateModel } from '../src/model/graph';
import { toMermaidFlowchart, toMermaidSequence } from '../src/model/mermaid';

const r = validateModel(JSON.parse(readFileSync('src/data/enterprise.json', 'utf8')));
if (!r.ok) throw new Error('invalid model');
console.log('## Связи систем\n\n```mermaid\n' + toMermaidFlowchart(r.model) + '\n```\n');
for (const p of r.model.entities.filter((e) => e.kind === 'process')) {
  console.log(`## Процесс: ${p.name}\n\n\`\`\`mermaid\n${toMermaidSequence(r.model, p.id)}\n\`\`\`\n`);
}
