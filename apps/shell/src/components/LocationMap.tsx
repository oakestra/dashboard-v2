import { Skeleton } from '@oakestra/ui';
import { lazy, Suspense } from 'react';

import type { LocationMapImplProps } from './LocationMapImpl';

export { toMapLocation, type MapLocation, type MapLocationTone } from './location-map-types';

// MapLibre is about 1 MB; only pages that show a map should pay for it.
export const LazyLocationMap = lazy(() => import('./LocationMapImpl'));

/** Suspense-wrapped lazy map. Pass `toMapLocation(name, parseClusterLocation(...))` results. */
export function LocationMap(props: LocationMapImplProps) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-72 w-full'} />}>
      <LazyLocationMap {...props} />
    </Suspense>
  );
}
