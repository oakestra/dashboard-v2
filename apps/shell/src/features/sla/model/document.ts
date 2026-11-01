import {
  parseSlaDocument,
  slaV2Schema,
  type Application,
  type SlaMicroservice,
  type SlaV2,
} from '@oakestra/api';
import type { ZodError } from 'zod';

export interface SlaContext {
  /** The token's `organization` claim. */
  customerId: string;
  application: Pick<Application, '_id' | 'application_name' | 'application_namespace'> & {
    application_desc?: string;
  };
}

/** Wraps microservices into the SLA v2 body `POST /service/` expects. */
export function buildSla(context: SlaContext, microservices: SlaMicroservice[]): SlaV2 {
  const { application } = context;
  const sla = {
    sla_version: 'v2.0' as const,
    customerID: context.customerId,
    applications: [
      {
        applicationID: application._id,
        application_name: application.application_name,
        application_namespace: application.application_namespace,
        ...(application.application_desc ? { application_desc: application.application_desc } : {}),
        // The backend rejects a non-empty microserviceID on create.
        microservices: microservices.map(({ microserviceID: _ignored, ...rest }) => rest),
      },
    ],
  };
  return slaV2Schema.parse(sla);
}

export type ImportResult =
  { ok: true; microservices: SlaMicroservice[]; warnings: string[] } | { ok: false; error: string };

function describeZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'The file is not a valid SLA.';
  const path = issue.path.join('.');
  const more = error.issues.length > 1 ? ` (and ${error.issues.length - 1} more problems)` : '';
  return `${path ? `${path}: ` : ''}${issue.message}${more}`;
}

/**
 * Reads an SLA file (v2, or the Angular dashboard's `{ microservices }` export). Files exported
 * from another organization or application are still accepted, because `buildSla` replaces the
 * customer and application ids anyway; the mismatch is reported as a warning so the user knows
 * where the services will end up.
 */
export function importSla(text: string, context: SlaContext): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }

  let parsed;
  try {
    parsed = parseSlaDocument(json);
  } catch (error) {
    // Duck-typed: the error comes from the @oakestra/api copy of zod.
    if (error instanceof Error && 'issues' in error) {
      return { ok: false, error: `Not a valid SLA file. ${describeZodError(error as ZodError)}` };
    }
    throw error;
  }

  const warnings: string[] = [];
  let microservices: SlaMicroservice[];

  if (parsed.version === 'v1') {
    microservices = parsed.sla.microservices;
    warnings.push('Legacy SLA format: customer and application ids were not checked.');
  } else {
    const { sla } = parsed;
    if (sla.customerID !== context.customerId) {
      warnings.push(
        `The file was made for customer "${sla.customerID}". The service will be created under your current organization.`,
      );
    }
    const [application, ...others] = sla.applications;
    if (!application) return { ok: false, error: 'The file contains no application.' };
    if (application.applicationID && application.applicationID !== context.application._id) {
      warnings.push(
        `The file was made for application "${application.applicationID}". The service will be created in ${context.application.application_name}.`,
      );
    }
    if (others.length > 0) {
      warnings.push(
        `The file contains ${sla.applications.length} applications. Only the services of the first one are used.`,
      );
    }
    microservices = application.microservices;
  }

  if (microservices.length === 0) {
    return { ok: false, error: 'The file does not contain any service.' };
  }
  return { ok: true, microservices, warnings };
}
