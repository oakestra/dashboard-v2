import { clustersQuery, type CommandContext, type CommandResult } from '@oakestra/dashboard-sdk';
import { ServerIcon } from 'lucide-react';

import { clusterPresentation } from './lib';

// The palette asks on every pause in typing, see the same constant in the applications package.
const FRESH_ENOUGH_MS = 30_000;

const MAX_RESULTS = 12;

export async function searchClusters(query: string, ctx: CommandContext): Promise<CommandResult[]> {
  const { addon } = ctx;
  if (!addon) return [];
  const clusters = await ctx.queryClient.ensureQueryData({
    ...clustersQuery(ctx.api),
    revalidateIfStale: true,
    staleTime: FRESH_ENOUGH_MS,
    // A failed refresh in the background is no reason for a toast.
    meta: { silent: true },
  });
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return clusters
    .filter(({ cluster_name: name }) => tokens.every((token) => name.toLowerCase().includes(token)))
    .slice(0, MAX_RESULTS)
    .map((cluster) => {
      const { label } = clusterPresentation(cluster);
      return {
        id: cluster._id,
        label: cluster.cluster_name,
        icon: ServerIcon,
        // Never a warning tone: like on the pages, silent is told apart by wording, it is not a
        // failure anyone can name.
        description: `Cluster, ${label.toLowerCase()}`,
        path: addon.path('clusters', cluster._id),
      };
    });
}
