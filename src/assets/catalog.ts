/**
 * Asset catalog: archetype → renderer + editor metadata.
 *
 * Today every archetype is procedural. To use a Blender model, export it
 * as GLB into public/assets/<archetype>.glb and set `glb` here; the
 * Building component loads it via useGLTF and keeps the same transform,
 * ports and interaction — the enterprise model never changes.
 */
import type { ComponentType } from 'react';
import {
  Archive,
  Distribution,
  EmployeeNodeModel,
  Factory,
  OpsCenter,
  Office,
  Tower,
  Warehouse,
  Workshop,
  type ArchetypeProps,
} from '@/scene/archetypes';
import {
  ControlTower,
  Gatehouse,
  IngestDock,
  Lab,
  LayerHall,
  QueryHub,
  Silos,
  Switchyard,
  Vault,
  Watchtower,
} from '@/scene/archetypesDp';
import type { SystemT } from '@/model/schema';
import type { ArchetypeT } from '@/space/schema';

export interface AssetEntry {
  label: string;
  component: ComponentType<ArchetypeProps>;
  /** Optional GLB override, relative to /public. */
  glb?: string;
  /** Height used to position labels and overlays. */
  labelHeight: number;
}

export const CATALOG: Record<ArchetypeT, AssetEntry> = {
  factory: { label: 'Фабрика обработки', component: Factory, labelHeight: 6.6 },
  warehouse: { label: 'Склад', component: Warehouse, labelHeight: 5 },
  distribution: { label: 'Распределительный центр', component: Distribution, labelHeight: 4.2 },
  opsCenter: { label: 'Операционный центр', component: OpsCenter, labelHeight: 4.4 },
  workshop: { label: 'Инженерная мастерская', component: Workshop, labelHeight: 4 },
  office: { label: 'Офис потребителя', component: Office, labelHeight: 6.4 },
  archive: { label: 'Архив / каталог', component: Archive, labelHeight: 4 },
  tower: { label: 'Башня контекста', component: Tower, labelHeight: 8.2 },
  employeeNode: { label: 'Нода сотрудника', component: EmployeeNodeModel, labelHeight: 1.9 },
  layerHall: { label: 'Цех слоя (Medallion)', component: LayerHall, labelHeight: 5.2 },
  queryHub: { label: 'Движок запросов', component: QueryHub, labelHeight: 6.4 },
  controlTower: { label: 'Диспетчерская вышка', component: ControlTower, labelHeight: 7.8 },
  silos: { label: 'Силосы хранения', component: Silos, labelHeight: 5 },
  switchyard: { label: 'Стрелочный пост версий', component: Switchyard, labelHeight: 3.2 },
  ingestDock: { label: 'Приёмный док', component: IngestDock, labelHeight: 3.6 },
  lab: { label: 'Лаборатория', component: Lab, labelHeight: 3.8 },
  gatehouse: { label: 'Въездные ворота', component: Gatehouse, labelHeight: 4 },
  vault: { label: 'Хранилище секретов', component: Vault, labelHeight: 3.4 },
  watchtower: { label: 'Смотровая вышка', component: Watchtower, labelHeight: 6.6 },
};

/** Default building for a system role — used by the editor. */
export const ARCHETYPE_BY_ROLE: Record<SystemT['role'], ArchetypeT> = {
  source: 'opsCenter',
  processing: 'factory',
  storage: 'warehouse',
  delivery: 'distribution',
  consumer: 'office',
  engineering: 'workshop',
  operations: 'opsCenter',
  metadata: 'archive',
  context: 'tower',
  orchestration: 'controlTower',
  versioning: 'switchyard',
  ingestion: 'ingestDock',
  gateway: 'gatehouse',
  secrets: 'vault',
  observability: 'watchtower',
  workspace: 'lab',
};
