import { z } from 'zod';

export const VIRTUALIZATIONS = ['container', 'unikernel', 'vm'] as const;
export type Virtualization = (typeof VIRTUALIZATIONS)[number];

/** Architectures the Oakestra unikernel runtime documents for `arch`. */
export const ARCHITECTURES = ['amd64', 'arm64'] as const;

/** Same pattern the backend's JSON schema enforces for application and service names. */
const NAME_PATTERN = /^[a-zA-Z0-9]{1,32}$/;
const NAME_MESSAGE = 'Use 1 to 32 letters or digits';

// Numbers live in the form as strings so empty inputs stay empty instead of turning into NaN or 0.
// The conversion to numbers happens in sla-convert.ts.
const required = (message = 'Required') => z.string().trim().min(1, message);
const wholeNumber = z.string().trim().regex(/^\d*$/, 'Enter a whole number');
const nonNegative = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine(
    (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
    'Enter a number of 0 or more',
  );
const rigidness = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine(
    (value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1,
    'Enter a value between 0 and 1',
  );
const seconds = z.string().trim().regex(/^\d+$/, 'Enter whole seconds');

const optionalIp = (version: 4 | 6) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (version === 4 ? z.ipv4() : z.ipv6()).safeParse(value).success,
      version === 4 ? 'Enter a valid IPv4 address' : 'Enter a valid IPv6 address',
    );

const port = z
  .string()
  .trim()
  .refine(
    (value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535,
    'Enter a port from 1 to 65535',
  );

export const portMappingSchema = z.object({
  host: port,
  container: port,
  protocol: z.enum(['tcp', 'udp']),
});

export const latencyConstraintSchema = z.object({
  kind: z.literal('latency'),
  area: required('Enter an area, for example munich-1'),
  threshold: nonNegative,
  rigidness,
  convergence_time: seconds,
});

export const geoConstraintSchema = z.object({
  kind: z.literal('geo'),
  latitude: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine(
      (v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 90,
      'Latitude is -90 to 90',
    ),
  longitude: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine(
      (v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 180,
      'Longitude is -180 to 180',
    ),
  threshold: nonNegative,
  rigidness,
  convergence_time: seconds,
});

export const clustersConstraintSchema = z.object({
  kind: z.literal('clusters'),
  allowed: z.array(z.string()).min(1, 'Select at least one cluster'),
});

export const directConstraintSchema = z.object({
  kind: z.literal('direct'),
  cluster: required('Select a cluster'),
  node: required('Enter a node'),
});

/** A constraint type this form has no editor for; kept verbatim so imports do not lose data. */
export const otherConstraintSchema = z.object({
  kind: z.literal('other'),
  raw: z.record(z.string(), z.unknown()),
});

export const constraintSchema = z.discriminatedUnion('kind', [
  latencyConstraintSchema,
  geoConstraintSchema,
  clustersConstraintSchema,
  directConstraintSchema,
  otherConstraintSchema,
]);

export type ConstraintValues = z.infer<typeof constraintSchema>;
export type ConstraintKind = ConstraintValues['kind'];

export const connectivityConstraintSchema = z.object({
  type: z.enum(['latency', 'bandwidth']),
  threshold: nonNegative,
  rigidness,
  convergence_time: seconds,
});

export const connectivitySchema = z.object({
  target: required('Select the service to connect to'),
  constraints: z.array(connectivityConstraintSchema),
});

const listItem = z.object({ value: z.string() });

/**
 * Form state of one microservice, and the single source of truth for validation, defaults,
 * import and export.
 */
export const serviceFormSchema = z
  .object({
    name: z.string().trim().regex(NAME_PATTERN, NAME_MESSAGE),
    namespace: z.string().trim().regex(NAME_PATTERN, NAME_MESSAGE),
    virtualization: z.enum(VIRTUALIZATIONS),
    /** Only sent for unikernels; the backend reads `arch` from unikernel services and nothing else. */
    arch: z.array(z.string()),
    description: z.string(),
    code: required('Enter an image or code URL'),
    state: z.string().trim(),

    memory: wholeNumber,
    vcpus: wholeNumber,
    vgpus: wholeNumber,
    vtpus: wholeNumber,
    bandwidth_in: wholeNumber,
    bandwidth_out: wholeNumber,
    storage: wholeNumber,
    ports: z.array(portMappingSchema),

    cmd: z.array(listItem),
    args: z.array(listItem),
    environment: z.array(z.object({ key: required('Enter a name'), value: z.string() })),

    one_shot: z.boolean(),
    privileged: z.boolean(),
    sla_violation_strategy: z.string().trim(),
    target_node: z.string().trim(),
    added_files: z.array(listItem),

    addresses: z.object({
      rr_ip: optionalIp(4),
      rr_ip_v6: optionalIp(6),
      closest_ip: optionalIp(4),
      closest_ip_v6: optionalIp(6),
      instances: z.array(
        z.object({
          from: required(),
          to: required(),
          start: required(),
        }),
      ),
    }),

    constraints: z.array(constraintSchema),
    connectivity: z.array(connectivitySchema),

    /**
     * SLA keys the form has no field for (volumes, future backend fields). Carried through import,
     * duplicate and export so none of them is silently dropped.
     */
    extra: z.record(z.string(), z.unknown()),
  })
  .superRefine((values, context) => {
    // system-manager indexes `arch` unconditionally for unikernels and answers 500 without it.
    if (values.virtualization === 'unikernel' && values.arch.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['arch'],
        message: 'Select at least one architecture',
      });
    }
  });

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export const DEFAULT_RIGIDNESS = '0.9';
export const DEFAULT_CONVERGENCE_TIME = '300';

export function defaultServiceValues(): ServiceFormValues {
  return {
    name: '',
    namespace: 'default',
    virtualization: 'container',
    arch: [],
    description: '',
    code: '',
    state: '',
    memory: '100',
    vcpus: '1',
    vgpus: '',
    vtpus: '',
    bandwidth_in: '',
    bandwidth_out: '',
    storage: '',
    ports: [],
    cmd: [],
    args: [],
    environment: [],
    one_shot: false,
    privileged: false,
    sla_violation_strategy: '',
    target_node: '',
    added_files: [],
    addresses: { rr_ip: '', rr_ip_v6: '', closest_ip: '', closest_ip_v6: '', instances: [] },
    constraints: [],
    connectivity: [],
    extra: {},
  };
}

export function defaultConstraint(kind: Exclude<ConstraintKind, 'other'>): ConstraintValues {
  switch (kind) {
    case 'latency':
      return {
        kind,
        area: '',
        threshold: '',
        rigidness: DEFAULT_RIGIDNESS,
        convergence_time: DEFAULT_CONVERGENCE_TIME,
      };
    case 'geo':
      return {
        kind,
        latitude: '',
        longitude: '',
        threshold: '',
        rigidness: DEFAULT_RIGIDNESS,
        convergence_time: DEFAULT_CONVERGENCE_TIME,
      };
    case 'clusters':
      return { kind, allowed: [] };
    case 'direct':
      return { kind, cluster: '', node: '' };
  }
}
