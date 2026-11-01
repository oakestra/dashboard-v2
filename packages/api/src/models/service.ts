import { z } from 'zod';

import { historySchema, list, optionalNumber, optionalString, timestamp } from './common.ts';

export const instanceSchema = z.looseObject({
  instance_number: z.coerce.number().int(),
  status: optionalString,
  status_detail: optionalString,
  cluster_id: optionalString,
  /** `"lat,lng,radius"`, see parseClusterLocation(). */
  cluster_location: optionalString,
  worker_id: optionalString,
  publicip: optionalString,
  host_ip: optionalString,
  host_port: optionalNumber,
  cpu_percent: optionalNumber,
  /**
   * Despite the name, current backends report memory usage in bytes here, not a percentage.
   * Prefer memory_history for charts.
   */
  memory_percent: optionalNumber,
  disk: optionalNumber,
  /** CPU usage in percent over time. */
  cpu_history: historySchema,
  /** Memory usage in bytes over time. */
  memory_history: historySchema,
  logs: optionalString,
  last_modified_timestamp: timestamp.optional().catch(undefined),
});

export type Instance = z.infer<typeof instanceSchema>;

const addressesSchema = z.looseObject({
  rr_ip: optionalString,
  rr_ip_v6: optionalString,
  RR_ip: optionalString,
  closest_ip: optionalString,
  closest_ip_v6: optionalString,
  instances: list(
    z.looseObject({ from: optionalString, to: optionalString, start: optionalString }),
  ),
});

/** Ports are sent as strings like `"8081:80/tcp"`, occasionally as plain numbers. */
const portSchema = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => (value === null || value === undefined ? undefined : String(value)));

export const serviceSchema = z.looseObject({
  _id: z.string(),
  microserviceID: optionalString,
  microservice_name: z.string(),
  microservice_namespace: z.string(),
  applicationID: optionalString,
  app_name: optionalString,
  app_ns: optionalString,
  job_name: optionalString,
  virtualization: optionalString,
  code: optionalString,
  image: optionalString,
  state: optionalString,
  port: portSchema,
  memory: optionalNumber,
  vcpus: optionalNumber,
  vgpus: optionalNumber,
  vtpus: optionalNumber,
  storage: optionalNumber,
  bandwidth_in: optionalNumber,
  bandwidth_out: optionalNumber,
  cmd: list(z.string()),
  args: list(z.string()),
  environment: list(z.string()),
  added_files: list(z.string()),
  /** Only set once the scheduler has looked at the service, e.g. `RUNNING`. */
  status: optionalString,
  status_detail: optionalString,
  addresses: addressesSchema.optional().catch(undefined),
  RR_ip: optionalString,
  RR_ip_v6: optionalString,
  constraints: list(z.looseObject({ type: z.string() })),
  connectivity: list(z.looseObject({ target_microservice_id: z.string() })),
  instance_list: list(instanceSchema),
  next_instance_progressive_number: optionalNumber,
});

export type Service = z.infer<typeof serviceSchema>;

/** Response of `POST /service/`. */
export const serviceCreateResultSchema = z.looseObject({
  job_id: optionalString,
  /** One entry per created service; the ids are not part of the response, see `job_id`. */
  deployed_services: list(
    z.looseObject({ service_name: optionalString, status: z.number().optional() }),
  ),
  /** `message` is only present when the failure happened while informing net-manager. */
  failed_services: list(
    z.looseObject({
      service_name: optionalString,
      message: optionalString,
      status: z.number().optional(),
    }),
  ),
});

export type ServiceCreateResult = z.infer<typeof serviceCreateResultSchema>;
