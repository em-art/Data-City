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
};
