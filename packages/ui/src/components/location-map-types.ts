/**
 * Structurally the `ClusterLocation` of @oakestra/api (this package cannot import it), so the
 * result of `parseClusterLocation()` can be passed in directly.
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  /** Kilometres. */
  radius?: number | null | undefined;
}

export interface MapLocation {
  lat: number;
  lng: number;
  /** Drawn as a circle around the point. */
  radiusKm?: number;
  label: string;
  /** Marker and circle color. `warning` flags a location that needs a look (inactive cluster). */
  tone?: MapLocationTone;
  /** Makes the marker a link, e.g. to the detail page of what sits there. */
  href?: string;
}

export type MapLocationTone = 'default' | 'warning' | 'muted';

/**
 * Converts a parsed `cluster_location` (`parseClusterLocation` from @oakestra/api) into a map location. Returns null when the cluster has no
 * usable location, so callers can `flatMap` over clusters.
 */
export function toMapLocation(
  label: string,
  location: GeoLocation | null | undefined,
): MapLocation | null {
  if (!location) return null;
  return {
    lat: location.latitude,
    lng: location.longitude,
    ...(location.radius ? { radiusKm: location.radius } : {}),
    label,
  };
}
