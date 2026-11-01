import type { LoaderFunctionArgs, UIMatch } from 'react-router';

import { requireAuth } from '../../core/auth/guards';
import { appRouterContext } from '../../core/router/app-context';
import { clustersQuery } from './api/queries';

/**
 * Looks the cluster up for its breadcrumb. Never throws: the page itself renders "not found" for
 * an unknown id, and a failing list must not hide the parent route's 403 for other roles.
 */
export async function clusterCrumbLoader(args: LoaderFunctionArgs): Promise<{ name?: string }> {
  await requireAuth(args);
  const { api, queryClient } = args.context.get(appRouterContext);
  try {
    const clusters = await queryClient.ensureQueryData(clustersQuery(api));
    return {
      name: clusters.find((cluster) => cluster._id === args.params.clusterId)?.cluster_name,
    };
  } catch {
    return {};
  }
}

export function clusterCrumb(match: UIMatch): string {
  return (match.loaderData as { name?: string } | undefined)?.name ?? 'Cluster';
}
