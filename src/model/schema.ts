/**
 * Enterprise model — the single source of truth.
 *
 * Nothing here knows about 3D. The city, Mermaid diagrams and docs are
 * projections of this model. Every entity has a stable, prefixed id
 * (`sys.data-platform`, `dp.subscriber-base`, ...) that never changes when
 * the visual representation does.
 */
import { z } from 'zod';

export const EntityId = z
  .string()
  .regex(/^[a-z]+(\.[a-z0-9-]+)+$/, 'id must look like "kind.slug" (e.g. sys.data-platform)');

const HistoryEntry = z.object({
  at: z.string(), // ISO date
  author: z.string(),
  change: z.string(),
});

const DocLink = z.object({ title: z.string(), url: z.string() });

/** Fields shared by every first-class entity. */
const Base = z.object({
  id: EntityId,
  name: z.string().min(1),
  description: z.string().default(''),
  owner: z.string().optional(), // EmployeeNode id or team name
  tags: z.array(z.string()).default([]),
  docs: z.array(DocLink).default([]),
  history: z.array(HistoryEntry).default([]),
});

export const Domain = Base.extend({
  kind: z.literal('domain'),
  /** Visual/semantic character of the district, e.g. "industrial", "finance". */
  character: z.enum(['data', 'finance', 'commercial', 'corporate', 'technical']),
});

export const InterfaceType = z.enum(['api', 'sql', 'stream', 'mcp', 'file', 'ui']);

export const System = Base.extend({
  kind: z.literal('system'),
  domainId: EntityId,
  /** Architectural role — drives the default building archetype. */
  role: z.enum([
    'source',
    'processing',
    'storage',
    'delivery',
    'consumer',
    'engineering',
    'operations',
    'metadata',
    'context',
  ]),
  technologies: z.array(z.string()).default([]),
  interfaces: z.array(InterfaceType).default([]),
  status: z.enum(['healthy', 'degraded', 'down', 'planned']).default('healthy'),
});

export const EmployeeNode = Base.extend({
  kind: z.literal('employee'),
  domainId: EntityId,
  role: z.string(),
  skills: z.array(z.string()).default([]),
  assistant: z
    .object({ name: z.string(), capabilities: z.array(z.string()).default([]) })
    .optional(),
  /** Short summary of the node's current working context (Нить). */
  context: z.array(z.string()).default([]),
});

export const DataProduct = Base.extend({
  kind: z.literal('dataProduct'),
  domainId: EntityId,
  producedBy: EntityId, // System id
  version: z.string(),
  sources: z.array(EntityId).default([]),
  quality: z
    .object({ checks: z.number().int(), passed: z.number().int() })
    .default({ checks: 0, passed: 0 }),
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']).default('internal'),
});

export const Contract = Base.extend({
  kind: z.literal('contract'),
  productId: EntityId,
  providerId: EntityId,
  consumerId: EntityId,
  interface: InterfaceType,
  sla: z.object({ freshness: z.string(), availability: z.string() }),
  schemaVersion: z.string(),
  allowedRoute: z.array(EntityId).default([]), // ordered System ids the delivery may pass
  status: z.enum(['active', 'draft', 'deprecated']).default('active'),
});

export const Connector = Base.extend({
  kind: z.literal('connector'),
  fromId: EntityId,
  toId: EntityId,
  interface: InterfaceType,
  technology: z.string().optional(),
});

export const ProcessStep = z.object({
  id: z.string(),
  name: z.string(),
  actorId: EntityId, // System or EmployeeNode performing the step
  /** Object travelling to the next step (usually a DataProduct). */
  carries: EntityId.optional(),
  manual: z.boolean().default(false),
  /** Typical duration, seconds of simulated time. */
  duration: z.number().positive().default(3),
});

export const Process = Base.extend({
  kind: z.literal('process'),
  domainId: EntityId,
  steps: z.array(ProcessStep).min(1),
});

export const RelationshipType = z.enum([
  'dependsOn',
  'produces',
  'consumes',
  'owns',
  'worksWith',
  'delivers',
  'describes',
]);

export const Relationship = z.object({
  id: EntityId,
  kind: z.literal('relationship'),
  type: RelationshipType,
  fromId: EntityId,
  toId: EntityId,
  label: z.string().optional(),
});

export const Entity = z.discriminatedUnion('kind', [
  Domain,
  System,
  EmployeeNode,
  DataProduct,
  Contract,
  Connector,
  Process,
  Relationship,
]);

/**
 * Event — something that happened (live) or is narrated (demo).
 * `source` makes the provenance explicit so the UI can never present a
 * scripted animation as a fact about the company.
 */
export const ModelEvent = z.object({
  id: z.string(),
  at: z.number(), // ms since epoch (live) or simulation ms (demo)
  source: z.enum(['demo', 'live']),
  type: z.enum([
    'step.started',
    'step.completed',
    'product.produced',
    'product.dispatched',
    'contract.checked',
    'product.delivered',
    'context.shared',
    'system.status',
  ]),
  subjectId: EntityId,
  processId: EntityId.optional(),
  stepId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const EnterpriseModel = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  name: z.string(),
  entities: z.array(Entity),
});

export type EntityIdT = z.infer<typeof EntityId>;
export type DomainT = z.infer<typeof Domain>;
export type SystemT = z.infer<typeof System>;
export type EmployeeNodeT = z.infer<typeof EmployeeNode>;
export type DataProductT = z.infer<typeof DataProduct>;
export type ContractT = z.infer<typeof Contract>;
export type ConnectorT = z.infer<typeof Connector>;
export type ProcessT = z.infer<typeof Process>;
export type ProcessStepT = z.infer<typeof ProcessStep>;
export type RelationshipT = z.infer<typeof Relationship>;
export type EntityT = z.infer<typeof Entity>;
export type EntityKind = EntityT['kind'];
export type ModelEventT = z.infer<typeof ModelEvent>;
export type EnterpriseModelT = z.infer<typeof EnterpriseModel>;
export type InterfaceTypeT = z.infer<typeof InterfaceType>;
