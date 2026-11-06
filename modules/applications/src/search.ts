import type { Application, Service } from '@oakestra/api';
import {
  allApplicationsQuery,
  allServicesQuery,
  applicationsQuery,
  hasAnyRole,
  profileQuery,
  servicesByApplicationQuery,
  type CommandAddon,
  type CommandContext,
  type CommandResult,
} from '@oakestra/dashboard-sdk';
import type { EnsureQueryDataOptions, QueryKey } from '@tanstack/react-query';
import { BoxesIcon, BoxIcon } from 'lucide-react';

import { placementFailureStatus } from './services/placement';

// The palette asks on every pause in typing, and its answer should not wait for the network. Older
// entries still answer at once and get refreshed behind the scenes.
const FRESH_ENOUGH_MS = 30_000;

const MAX_RESULTS = 12;

interface ApplicationEntry {
  application: Application;
  services: readonly Service[];
}

function readCached<T, K extends QueryKey>(
  { queryClient }: CommandContext,
  options: EnsureQueryDataOptions<T, Error, T, K>,
): Promise<T> {
  return queryClient.ensureQueryData({
    ...options,
    revalidateIfStale: true,
    staleTime: FRESH_ENOUGH_MS,
    // A failed refresh in the background is no reason for a toast.
    meta: { silent: true },
  });
}

async function adminEntries(ctx: CommandContext): Promise<ApplicationEntry[]> {
  const [applications, services] = await Promise.all([
    readCached(ctx, allApplicationsQuery(ctx.api)),
    readCached(ctx, allServicesQuery(ctx.api)),
  ]);
  // Detail pages are owner-scoped even for an Admin, see `Application.userId`: anyone else's
  // application would be a result that opens on a 404.
  return applications
    .filter((application) => application.userId === ctx.user.username)
    .map((application) => ({
      application,
      services: services.filter((service) => service.applicationID === application._id),
    }));
}

async function ownEntries(ctx: CommandContext): Promise<ApplicationEntry[]> {
  const profile = await readCached(ctx, profileQuery(ctx.api, ctx.user.username));
  const applications = await readCached(ctx, applicationsQuery(ctx.api, profile._id));
  // There is no list of all one's services. An application whose services failed to load can still
  // be found by name.
  const lists = await Promise.allSettled(
    applications.map((application) =>
      readCached(ctx, servicesByApplicationQuery(ctx.api, application._id)),
    ),
  );
  return applications.map((application, index) => {
    const list = lists[index];
    return { application, services: list?.status === 'fulfilled' ? list.value : [] };
  });
}

function fits(tokens: readonly string[], ...fields: readonly (string | undefined)[]): boolean {
  const text = fields.join(' ').toLowerCase();
  return tokens.every((token) => text.includes(token));
}

function applicationResult(
  { application, services }: ApplicationEntry,
  addon: CommandAddon,
  matchedService: Service | undefined,
): CommandResult {
  return {
    id: application._id,
    label: application.application_name,
    icon: BoxesIcon,
    description: matchedService
      ? `Application containing ${matchedService.microservice_name}`
      : `Application in ${application.application_namespace}`,
    path: addon.path(application._id),
    ...(services.some((service) => placementFailureStatus(service)) && { tone: 'warning' }),
  };
}

function serviceResult(
  application: Application,
  service: Service,
  addon: CommandAddon,
): CommandResult {
  const unplaced = placementFailureStatus(service) !== undefined;
  return {
    id: service._id,
    label: `${application.application_name} / ${service.microservice_name}`,
    icon: BoxIcon,
    description: unplaced ? "Service, can't be placed" : 'Service',
    path: addon.path(application._id, 'services', service._id),
    ...(unplaced && { tone: 'warning' }),
  };
}

/** What the user can open, so nothing here leads to a page that refuses them. */
export async function searchApplications(
  query: string,
  ctx: CommandContext,
): Promise<CommandResult[]> {
  const { addon } = ctx;
  if (!addon) return [];
  const entries = await (hasAnyRole(ctx.user, ['Admin']) ? adminEntries(ctx) : ownEntries(ctx));
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  const services: CommandResult[] = [];
  const applications: CommandResult[] = [];
  for (const entry of entries) {
    const { application } = entry;
    const matched = entry.services.filter((service) =>
      fits(
        tokens,
        application.application_name,
        service.microservice_name,
        service.microservice_namespace,
        service.image,
      ),
    );
    services.push(...matched.map((service) => serviceResult(application, service, addon)));
    const byName = fits(tokens, application.application_name, application.application_namespace);
    if (byName || matched.length > 0) {
      applications.push(applicationResult(entry, addon, byName ? undefined : matched[0]));
    }
  }
  // Services first: they name exactly what was typed, the application only contains it.
  return [...services, ...applications].slice(0, MAX_RESULTS);
}
