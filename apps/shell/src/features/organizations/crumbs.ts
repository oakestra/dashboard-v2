import type { LoaderFunctionArgs, UIMatch } from 'react-router';

import { requireAuth } from '../../core/auth/guards';
import { appRouterContext } from '../../core/router/app-context';
import { organizationsQuery } from './api/queries';

/**
 * Looks the organization up in the list (there is no detail endpoint) for its breadcrumb. Never
 * throws: the page renders its own not-found state, and a 403 for non-admins belongs to the parent
 * route's role check.
 */
export async function organizationCrumbLoader(
  args: LoaderFunctionArgs,
): Promise<{ name?: string }> {
  await requireAuth(args);
  const { api, queryClient } = args.context.get(appRouterContext);
  try {
    const organizations = await queryClient.ensureQueryData(organizationsQuery(api));
    return { name: organizations.find((org) => org._id === args.params.orgId)?.name };
  } catch {
    return {};
  }
}

export function organizationCrumb(match: UIMatch): string {
  return (match.loaderData as { name?: string } | undefined)?.name ?? 'Details';
}
