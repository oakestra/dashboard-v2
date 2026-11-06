import {
  clustersQuery,
  matchesTokens,
  readCached,
  searchTokens,
  type CommandContext,
  type CommandResult,
} from '@oakestra/dashboard-sdk';
import { ServerIcon } from 'lucide-react';

import { clusterPresentation } from './lib';

const MAX_RESULTS = 12;

export async function searchClusters(query: string, ctx: CommandContext): Promise<CommandResult[]> {
  const { addon } = ctx;
  if (!addon) return [];
  const clusters = await readCached(ctx, clustersQuery(ctx.api));
  const tokens = searchTokens(query);
  return clusters
    .filter((cluster) => matchesTokens(tokens, cluster.cluster_name))
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
