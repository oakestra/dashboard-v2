import { lazy, Suspense } from 'react';

import type { LocationMapImplProps } from './location-map-impl';
import { Skeleton } from './skeleton';

export {
  toMapLocation,
  type GeoLocation,
  type MapLocation,
  type MapLocationTone,
} from './location-map-types';
export type {
  LocationMapImplProps as LocationMapProps,
  MarkerLinkProps,
} from './location-map-impl';

// MapLibre is about 1 MB; only pages that show a map should pay for it.
export const LazyLocationMap = lazy(() => import('./location-map-impl'));

/** Suspense-wrapped lazy map. Pass `toMapLocation(name, parseClusterLocation(...))` results. */
export function LocationMap(props: LocationMapImplProps) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-72 w-full'} />}>
      <LazyLocationMap {...props} />
    </Suspense>
  );
}
