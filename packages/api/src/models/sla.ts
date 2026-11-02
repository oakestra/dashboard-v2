import { z } from 'zod';

const SLA_NAME_PATTERN = /^[a-zA-Z0-9]{1,32}$/;
const slaName = z.string().regex(SLA_NAME_PATTERN, 'Use 1 to 32 letters or digits');

export const slaConstraintSchema = z.looseObject({
  type: z.string().min(1),
  area: z.string().optional(),
  cluster: z.string().optional(),
  node: z.string().optional(),
  location: z.string().optional(),
  threshold: z.number().optional(),
  rigidness: z.number().optional(),
  convergence_time: z.number().int().optional(),
  needs: z.array(z.string()).optional(),
  allowed: z.array(z.string()).optional(),
});

export const slaConnectivitySchema = z.looseObject({
  target_microservice_id: z.string(),
  con_constraints: z.array(
    z.looseObject({
      type: z.string(),
      threshold: z.number(),
      rigidness: z.number(),
      convergence_time: z.number().int(),
    }),
  ),
});

const resource = z.number().int().min(0).optional();

/** One service in an SLA. Mirrors the backend's v2 JSON schema (`sla/schema.py`). */
export const slaMicroserviceSchema = z.looseObject({
  /** Must be empty or absent when creating; the backend assigns it. */
  microserviceID: z.string().optional(),
  microservice_name: slaName,
  microservice_namespace: slaName,
  virtualization: z.string().min(1),
  /** Required by the backend for `unikernel`, e.g. `["amd64"]`. */
  arch: z.array(z.string()).optional(),
  code: z.string().min(1),
  memory: resource,
  vcpus: resource,
  vgpus: resource,
  vtpus: resource,
  bandwidth_in: resource,
  bandwidth_out: resource,
  storage: resource,
  state: z.string().optional(),
  port: z.string().optional(),
  one_shot: z.boolean().optional(),
  privileged: z.boolean().optional(),
  cmd: z.array(z.string()).optional(),
  environment: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  added_files: z.array(z.string()).optional(),
  sla_violation_strategy: z.string().optional(),
  target_node: z.string().optional(),
  addresses: z
    .looseObject({
      rr_ip: z.string().optional(),
      rr_ip_v6: z.string().optional(),
      closest_ip: z.string().optional(),
      closest_ip_v6: z.string().optional(),
      instances: z
        .array(z.looseObject({ from: z.string(), to: z.string(), start: z.string() }))
        .optional(),
    })
    .optional(),
  constraints: z.array(slaConstraintSchema).optional(),
  connectivity: z.array(slaConnectivitySchema).optional(),
  volumes: z
    .array(
      z.looseObject({
        volume_id: z.string(),
        csi_driver: z.string(),
        mount_path: z.string().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

export type SlaMicroservice = z.infer<typeof slaMicroserviceSchema>;

export const slaApplicationSchema = z.looseObject({
  applicationID: z.string().optional(),
  application_name: slaName,
  application_namespace: slaName,
  application_desc: z.string().optional(),
  microservices: z.array(slaMicroserviceSchema),
});

export type SlaApplication = z.infer<typeof slaApplicationSchema>;

/**
 * Body of `POST /application/`, `POST /service/` and `PUT /service/{id}`.
 *
 * `customerID` is the organization id from the access token's `organization` claim (the root
 * organization's id for users that logged in without an organization).
 */
export const slaV2Schema = z.looseObject({
  sla_version: z.literal('v2.0'),
  customerID: z.string().min(1),
  applications: z.array(slaApplicationSchema).min(1),
  args: z.array(z.string()).optional(),
});

export type SlaV2 = z.infer<typeof slaV2Schema>;

/**
 * Export format of the Angular dashboard: a bare `{ microservices: [...] }` without the application
 * wrapper. Only read for imports; the backend rejects `sla_version: "v1.0"` as deprecated.
 */
export const slaV1Schema = z.looseObject({
  microservices: z.array(slaMicroserviceSchema).min(1),
});

export type SlaV1 = z.infer<typeof slaV1Schema>;

export type ParsedSla = { version: 'v2'; sla: SlaV2 } | { version: 'v1'; sla: SlaV1 };

/** Detects and validates an imported SLA document. Throws a ZodError if neither format matches. */
export function parseSlaDocument(document: unknown): ParsedSla {
  if (typeof document === 'object' && document !== null && 'applications' in document) {
    return { version: 'v2', sla: slaV2Schema.parse(document) };
  }
  return { version: 'v1', sla: slaV1Schema.parse(document) };
}
