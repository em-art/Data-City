/**
 * Validates the enterprise and space models (schema + references +
 * placements). Exits non-zero on problems — suitable for CI.
 * Run: npm run validate:model
 */
import { readFileSync } from 'node:fs';
import { indexModel, validateModel } from '../src/model/graph';
import { buildBeltGraph, buildRoadGraph } from '../src/space/routing';
import { SpaceModel } from '../src/space/schema';

const model = validateModel(JSON.parse(readFileSync('src/data/enterprise.json', 'utf8')));
if (!model.ok) {
  for (const i of model.issues) console.error(`✗ ${i.entityId}: ${i.message}`);
  process.exit(1);
}
const space = SpaceModel.parse(JSON.parse(readFileSync('src/data/space.json', 'utf8')));
const graph = buildRoadGraph(space);
const belt = buildBeltGraph(space);
const ix = indexModel(model.model);
let bad = 0;
for (const p of space.placements) {
  if (!ix.get(p.entityId)) (bad++, console.error(`✗ placement for unknown entity ${p.entityId}`));
  if (p.port && !graph.nodes.has(p.port)) (bad++, console.error(`✗ ${p.entityId}: unknown port ${p.port}`));
  if (p.beltNode && !belt.nodes.has(p.beltNode)) (bad++, console.error(`✗ ${p.entityId}: unknown belt node ${p.beltNode}`));
}
for (const s of ix.all('system')) {
  if (!space.placements.some((p) => p.entityId === s.id) && !space.belts.some((b) => b.entityId === s.id)) console.warn(`! system ${s.id} has no placement (not shown in the city)`);
}
if (bad) process.exit(1);
console.log(`✓ ${model.model.entities.length} entities, ${space.placements.length} placements, ${graph.nodes.size} road nodes`);
