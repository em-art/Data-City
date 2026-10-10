/**
 * Spatial model — how the enterprise model is laid out as a city.
 *
 * Kept separate from the enterprise model: moving a building, swapping an
 * asset or re-skinning a district never touches architectural facts.
 * Placements reference entities by id only.
 */
import { z } from 'zod';
import { EntityId } from '@/model/schema';

export const Vec2 = z.tuple([z.number(), z.number()]); // [x, z] on the ground plane

/** Building archetypes available in the asset catalog. */
export const Archetype = z.enum([
  'factory', // processing — Data Platform
  'warehouse', // storage
  'distribution', // delivery hub — ИСТОК
  'opsCenter', // source / operations — EVA
  'workshop', // engineering — GitLab
  'office', // consumer
  'archive', // metadata catalog
  'tower', // context infrastructure — Нить
  'employeeNode', // person + assistant
  'layerHall', // Medallion layer
  'queryHub', // Trino
  'controlTower', // Dagster
  'silos', // Ceph RGW
  'switchyard', // Nessie
  'ingestDock', // dlt
  'lab', // JupyterHub
  'gatehouse', // Traefik
  'vault', // Infisical
  'watchtower', // observability
]);

export const Placement = z.object({
  entityId: EntityId,
  archetype: Archetype,
  position: Vec2,
  /** Rotation around Y in quarter turns (0..3). Dock faces +Z at 0. */
  rotation: z.number().int().min(0).max(3).default(0),
  footprint: Vec2.default([6, 6]),
  height: z.number().positive().optional(),
  /** Road node where vehicles load/unload for this object. */
  port: z.string().optional(),
  accent: z.string().optional(),
});

export const RoadNode = z.object({ id: z.string(), at: Vec2 });
export const RoadEdge = z.tuple([z.string(), z.string()]);

export const DistrictArea = z.object({
  domainId: EntityId,
  rect: z.object({ min: Vec2, max: Vec2 }),
  color: z.string(),
});

export const SpaceModel = z.object({
  version: z.string(),
  districts: z.array(DistrictArea),
  roads: z.object({ nodes: z.array(RoadNode), edges: z.array(RoadEdge) }),
  placements: z.array(Placement),
  /** Purely decorative props — trees, containers, solar fields. */
  props: z
    .array(z.object({ type: z.enum(['tree', 'containers', 'solar', 'tank', 'drone']), at: Vec2, rotation: z.number().default(0) }))
    .default([]),
});

export type Vec2T = z.infer<typeof Vec2>;
export type ArchetypeT = z.infer<typeof Archetype>;
export type PlacementT = z.infer<typeof Placement>;
export type SpaceModelT = z.infer<typeof SpaceModel>;
export type RoadNodeT = z.infer<typeof RoadNode>;
