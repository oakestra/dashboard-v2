import { useOakestraApi } from '@oakestra/dashboard-sdk';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';

import { clustersQuery } from '../queries';

export function ClustersPage() {
  const api = useOakestraApi();
  const clusters = useQuery(clustersQuery(api));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clusters</CardTitle>
        <CardDescription>Fetched with the logged-in user's token.</CardDescription>
      </CardHeader>
      <CardContent>
        {clusters.isPending ? (
          <p className="__PREFIX__:text-sm __PREFIX__:text-muted-foreground">Loading...</p>
        ) : clusters.isError ? (
          <p className="__PREFIX__:text-sm __PREFIX__:text-destructive" role="alert">
            {clusters.error.message}
          </p>
        ) : (
          <ul className="__PREFIX__:space-y-1 __PREFIX__:text-sm">
            {clusters.data.map((cluster) => (
              <li key={cluster._id}>{cluster.cluster_name}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
