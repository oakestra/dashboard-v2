import { parseClusterLocation, type Cluster } from '@oakestra/api';
import { useAddonPath } from '@oakestra/dashboard-sdk';
import { plural } from '@oakestra/ui';
import { LocationMap, toMapLocation, type MarkerLinkProps } from '@oakestra/ui/location-map';
import { useMemo } from 'react';
import { Link } from 'react-router';

// Client-side navigation: a plain anchor would reload the app. Module scope, so the markers keep
// a stable prop across renders.
function renderLink({ href, label, className }: MarkerLinkProps) {
  return <Link to={href} aria-label={label} className={className} />;
}

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
  const addonPath = useAddonPath();
  // Memoized because the map refits its bounds whenever `locations` changes identity.
  const locations = useMemo(
    () =>
      clusters.flatMap((cluster) => {
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
            ...(linkToDetail ? { href: addonPath('clusters', cluster._id) } : {}),
          },
        ];
      }),
    [clusters, linkToDetail, addonPath],
  );
  const skipped = clusters.length - locations.length;

  return (
    <div>
      {locations.length > 0 ? (
        <LocationMap
          locations={locations}
          className={className}
          ariaLabel={ariaLabel}
          renderLink={renderLink}
        />
      ) : (
        <p className="text-muted-foreground px-4 pb-3.5 text-sm">
          No cluster reports a usable location.
        </p>
      )}
      {skipped > 0 && locations.length > 0 ? (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs" data-testid="map-skipped">
          {plural(skipped, 'cluster')} not shown: no valid location.
        </p>
      ) : null}
    </div>
  );
}
