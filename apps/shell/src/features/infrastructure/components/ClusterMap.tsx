import { parseClusterLocation, type Cluster } from '@oakestra/api';

import { LocationMap, toMapLocation } from '../../../components/LocationMap';

/** Map of the clusters with a usable location; says how many had to be left out. */
export function ClusterMap({
  clusters,
  className,
  ariaLabel = 'Cluster locations',
  linkToDetail = false,
}: {
  clusters: readonly Cluster[];
  className?: string;
  ariaLabel?: string;
  /** Markers open the cluster's page; off on that page itself. */
  linkToDetail?: boolean;
}) {
  const locations = clusters.flatMap((cluster) => {
    const location = toMapLocation(
      cluster.active ? cluster.cluster_name : `${cluster.cluster_name} (inactive)`,
      parseClusterLocation(cluster.cluster_location),
    );
    if (!location) return [];
    return [
      {
        ...location,
        // Same meaning as the amber Inactive badge in the table next to the map.
        tone: cluster.active ? ('default' as const) : ('warning' as const),
        ...(linkToDetail ? { href: `/infrastructure/clusters/${cluster._id}` } : {}),
      },
    ];
  });
  const skipped = clusters.length - locations.length;

  return (
    <div className="space-y-2">
      {locations.length > 0 ? (
        <LocationMap locations={locations} className={className} ariaLabel={ariaLabel} />
      ) : (
        <p className="text-muted-foreground text-sm">No cluster reports a usable location.</p>
      )}
      {skipped > 0 && locations.length > 0 ? (
        <p className="text-muted-foreground text-xs" data-testid="map-skipped">
          {skipped === 1 ? '1 cluster' : `${skipped} clusters`} not shown: no valid location.
        </p>
      ) : null}
    </div>
  );
}
