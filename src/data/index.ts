/** Bundled demo city: validated enterprise model + its spatial layout. */
import { validateModel } from '@/model/graph';
import type { EnterpriseModelT } from '@/model/schema';
import { SpaceModel, type SpaceModelT } from '@/space/schema';
import enterpriseJson from './enterprise.json';
import spaceJson from './space.json';

export function loadDemoModel(): EnterpriseModelT {
  const r = validateModel(enterpriseJson);
  if (!r.ok) throw new Error('Invalid enterprise model:\n' + r.issues.map((i) => `${i.entityId}: ${i.message}`).join('\n'));
  return r.model;
}

export function loadDemoSpace(): SpaceModelT {
  return SpaceModel.parse(spaceJson);
}
