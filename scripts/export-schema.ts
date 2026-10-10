/**
 * Generates JSON Schema files from the Zod schemas, so the model files can
 * be validated and auto-completed in any editor (see "$schema" in
 * src/data/*.json). Run: npm run export:schema
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { EnterpriseModel, ModelEvent } from '../src/model/schema';
import { SpaceModel } from '../src/space/schema';

mkdirSync('schemas', { recursive: true });
const out = (name: string, schema: z.ZodType) => {
  writeFileSync(`schemas/${name}.schema.json`, JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2) + '\n');
  console.log(`schemas/${name}.schema.json`);
};
out('enterprise', EnterpriseModel);
out('space', SpaceModel);
out('event', ModelEvent);
