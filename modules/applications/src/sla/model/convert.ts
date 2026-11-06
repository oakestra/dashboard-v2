import { slaMicroserviceSchema, type Service, type SlaMicroservice } from '@oakestra/api';

import {
  defaultServiceValues,
  VIRTUALIZATIONS,
  type ConstraintValues,
  type ServiceFormValues,
} from './schema';

type Raw = Record<string, unknown>;

/** Keys the form edits itself; everything else in an imported service goes to `extra`. */
const KNOWN_KEYS = new Set([
  'microserviceID',
  'microservice_name',
  'microservice_namespace',
  'virtualization',
  'arch',
  'description',
  'code',
  'state',
  'memory',
  'vcpus',
  'vgpus',
  'vtpus',
  'bandwidth_in',
  'bandwidth_out',
  'storage',
  'port',
  'cmd',
  'args',
  'environment',
  'one_shot',
  'privileged',
  'sla_violation_strategy',
  'target_node',
  'added_files',
  'addresses',
  'constraints',
  'connectivity',
]);

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const asRecord = (value: unknown): Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : {};

// Geo locations are "(longitude,latitude)" in the SLA documentation and the Angular dashboard.
const LOCATION = /^\(?\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*\)?$/;
const PORT = /^(\d+)(?::(\d+))?(?:\/(tcp|udp))?$/i;

function parsePorts(value: unknown): { ports: ServiceFormValues['ports']; unparsed?: string } {
  const text = asString(value).trim();
  if (!text) return { ports: [] };
  const ports: ServiceFormValues['ports'] = [];
  for (const part of text.split(';')) {
    const match = PORT.exec(part.trim());
    if (!match) return { ports: [], unparsed: text };
    ports.push({
      host: match[1]!,
      container: match[2] ?? match[1]!,
      protocol: match[3]?.toLowerCase() === 'udp' ? 'udp' : 'tcp',
    });
  }
  return { ports };
}

function constraintFromSla(raw: Raw): ConstraintValues {
  const base = {
    threshold: asString(raw.threshold),
    rigidness: asString(raw.rigidness) || '0.9',
    convergence_time: asString(raw.convergence_time) || '300',
  };
  switch (raw.type) {
    case 'latency':
      return { kind: 'latency', area: asString(raw.area), ...base };
    case 'geo': {
      const match = LOCATION.exec(asString(raw.location).trim());
      if (!match) break;
      return { kind: 'geo', longitude: match[1]!, latitude: match[2]!, ...base };
    }
    case 'clusters':
      return { kind: 'clusters', allowed: asStrings(raw.allowed) };
    case 'direct':
      return { kind: 'direct', cluster: asString(raw.cluster), node: asString(raw.node) };
  }
  return { kind: 'other', raw };
}

/** Maps a (validated) SLA microservice onto form values. Unknown keys are kept in `extra`. */
export function fromSlaMicroservice(ms: SlaMicroservice | Raw): ServiceFormValues {
  const raw = ms as Raw;
  const defaults = defaultServiceValues();
  const addresses = asRecord(raw.addresses);
  const { ports, unparsed } = parsePorts(raw.port);
  const extra: Raw = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_KEYS.has(key)) extra[key] = value;
  }
  if (unparsed) extra.port = unparsed;

  // Stored services report the runtime ("docker"), not the SLA value they were created with.
  const runtime = raw.virtualization === 'docker' || raw.virtualization === 'runc';
  const virtualization = VIRTUALIZATIONS.find(
    (candidate) => candidate === (runtime ? 'container' : raw.virtualization),
  );
  return {
    ...defaults,
    name: asString(raw.microservice_name),
    namespace: asString(raw.microservice_namespace) || defaults.namespace,
    // An unknown virtualization (the backend accepts any string) falls back to the default
    // rather than blocking the import.
    virtualization: virtualization ?? defaults.virtualization,
    arch: asStrings(raw.arch),
    description: asString(raw.description),
    code: asString(raw.code),
    state: asString(raw.state),
    memory: asString(raw.memory),
    vcpus: asString(raw.vcpus),
    vgpus: asString(raw.vgpus),
    vtpus: asString(raw.vtpus),
    bandwidth_in: asString(raw.bandwidth_in),
    bandwidth_out: asString(raw.bandwidth_out),
    storage: asString(raw.storage),
    ports,
    cmd: asStrings(raw.cmd).map((value) => ({ value })),
    args: asStrings(raw.args).map((value) => ({ value })),
    environment: asStrings(raw.environment).map((entry) => {
      const index = entry.indexOf('=');
      return index < 0
        ? { key: entry, value: '' }
        : { key: entry.slice(0, index), value: entry.slice(index + 1) };
    }),
    one_shot: raw.one_shot === true,
    privileged: raw.privileged === true,
    sla_violation_strategy: asString(raw.sla_violation_strategy),
    target_node: asString(raw.target_node),
    added_files: asStrings(raw.added_files).map((value) => ({ value })),
    addresses: {
      rr_ip: asString(addresses.rr_ip),
      rr_ip_v6: asString(addresses.rr_ip_v6),
      closest_ip: asString(addresses.closest_ip),
      closest_ip_v6: asString(addresses.closest_ip_v6),
      instances: (Array.isArray(addresses.instances) ? addresses.instances : []).map((item) => {
        const instance = asRecord(item);
        return {
          from: asString(instance.from),
          to: asString(instance.to),
          start: asString(instance.start),
        };
      }),
    },
    constraints: (Array.isArray(raw.constraints) ? raw.constraints : []).map((item) =>
      constraintFromSla(asRecord(item)),
    ),
    connectivity: (Array.isArray(raw.connectivity) ? raw.connectivity : []).map((item) => {
      const link = asRecord(item);
      return {
        target: asString(link.target_microservice_id),
        constraints: (Array.isArray(link.con_constraints) ? link.con_constraints : []).map(
          (entry) => {
            const constraint = asRecord(entry);
            return {
              type: constraint.type === 'bandwidth' ? ('bandwidth' as const) : ('latency' as const),
              threshold: asString(constraint.threshold),
              rigidness: asString(constraint.rigidness),
              convergence_time: asString(constraint.convergence_time),
            };
          },
        ),
      };
    }),
    extra,
  };
}

const ROUND_ROBIN_KEYS = ['rr_ip', 'rr_ip_v6', 'RR_ip', 'RR_ip_v6'];

/** Drops the allocated round-robin addresses, keeping closest IPs and instance addresses. */
function withoutRoundRobinIps(addresses: Service['addresses']): Raw | undefined {
  if (!addresses) return undefined;
  return Object.fromEntries(
    Object.entries(addresses as Raw).filter(([key]) => !ROUND_ROBIN_KEYS.includes(key)),
  );
}

// `microserviceID` names the stored service; the backend rejects it on create.
const SLA_FIELDS = Object.keys(slaMicroserviceSchema.shape).filter(
  (key) => key !== 'microserviceID',
);

/**
 * The SLA microservice a stored service was created from. The service document also carries
 * runtime state (instances, status, ids, job names) that the backend would reject or ignore, so
 * only the fields of the SLA schema are taken over.
 */
export function serviceToSlaMicroservice(service: Service): SlaMicroservice {
  const microservice: Raw = {};
  for (const key of SLA_FIELDS) {
    const value = (service as Raw)[key];
    if (value !== undefined && value !== null) microservice[key] = value;
  }
  // The round-robin address belongs to the original: net-manager refuses a second service with
  // the same one, so a copy or an import elsewhere has to ask for a fresh address (or none). The
  // backend stores it as RR_ip as well as rr_ip, which is why neither spelling may survive.
  if (microservice.addresses) microservice.addresses = withoutRoundRobinIps(service.addresses);
  return microservice as SlaMicroservice;
}

/** Prefills the form from an existing service, under a new name. */
export function fromService(service: Service, nameSuffix = 'copy'): ServiceFormValues {
  const values = fromSlaMicroservice({
    ...serviceToSlaMicroservice(service),
    code: service.code ?? service.image,
  });
  // Names only allow letters and digits, so a "-copy" suffix would fail validation.
  values.name = `${values.name.slice(0, 32 - nameSuffix.length)}${nameSuffix}`;
  return values;
}

/** A limit from a link: a whole number of at least 1, anything else is treated as absent. */
export function parseLimitParam(value: string | null): string | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 ? String(limit) : undefined;
}

function constraintToSla(constraint: ConstraintValues): Raw {
  switch (constraint.kind) {
    case 'latency':
      return {
        type: 'latency',
        area: constraint.area,
        threshold: Number(constraint.threshold),
        rigidness: Number(constraint.rigidness),
        convergence_time: Number(constraint.convergence_time),
      };
    case 'geo':
      return {
        type: 'geo',
        location: `(${constraint.longitude},${constraint.latitude})`,
        threshold: Number(constraint.threshold),
        rigidness: Number(constraint.rigidness),
        convergence_time: Number(constraint.convergence_time),
      };
    case 'clusters':
      return { type: 'clusters', allowed: constraint.allowed };
    case 'direct':
      return { type: 'direct', cluster: constraint.cluster, node: constraint.node };
    case 'other':
      return constraint.raw;
  }
}

/**
 * Builds the microservice object of an SLA v2 body. Empty fields are left out entirely: the
 * backend validates present keys (an empty `port` or `0` for an optional resource is not "unset").
 * `microserviceID` is never sent, the backend requires it to be empty on create.
 */
export function toSlaMicroservice(values: ServiceFormValues): SlaMicroservice {
  const out: Raw = { ...values.extra };
  const set = (key: string, value: unknown) => {
    if (value === '' || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    out[key] = value;
  };
  const num = (value: string) => (value.trim() === '' ? undefined : Number(value));
  const list = (items: { value: string }[]) =>
    items.map((item) => item.value.trim()).filter((value) => value !== '');

  set('microservice_name', values.name);
  set('microservice_namespace', values.namespace);
  set('virtualization', values.virtualization);
  // Containers and VMs never read it, so a stale value from an import must not leak through.
  if (values.virtualization === 'unikernel') set('arch', values.arch);
  set('description', values.description.trim());
  set('code', values.code);
  set('state', values.state);
  set('memory', num(values.memory));
  set('vcpus', num(values.vcpus));
  set('vgpus', num(values.vgpus));
  set('vtpus', num(values.vtpus));
  set('bandwidth_in', num(values.bandwidth_in));
  set('bandwidth_out', num(values.bandwidth_out));
  set('storage', num(values.storage));
  set('port', values.ports.map((p) => `${p.host}:${p.container}/${p.protocol}`).join(';'));
  set('cmd', list(values.cmd));
  set('args', list(values.args));
  set(
    'environment',
    values.environment.map((entry) => `${entry.key.trim()}=${entry.value}`),
  );
  if (values.one_shot) out.one_shot = true;
  if (values.privileged) out.privileged = true;
  set('sla_violation_strategy', values.sla_violation_strategy);
  set('target_node', values.target_node);
  set('added_files', list(values.added_files));

  const { instances, ...ips } = values.addresses;
  const addresses: Raw = {};
  for (const [key, value] of Object.entries(ips)) if (value.trim()) addresses[key] = value.trim();
  if (instances.length > 0) addresses.instances = instances;
  if (Object.keys(addresses).length > 0) out.addresses = addresses;

  set('constraints', values.constraints.map(constraintToSla));
  set(
    'connectivity',
    values.connectivity.map((link) => ({
      target_microservice_id: link.target,
      con_constraints: link.constraints.map((c) => ({
        type: c.type,
        threshold: Number(c.threshold),
        rigidness: Number(c.rigidness),
        convergence_time: Number(c.convergence_time),
      })),
    })),
  );

  return out as SlaMicroservice;
}
