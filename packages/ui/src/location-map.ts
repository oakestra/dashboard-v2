// Subpath entry, separate from `./map` on purpose: it only holds the Suspense wrapper and a lazy
// import of the implementation, so a page that merely imports `LocationMap` does not fetch
// MapLibre (about 1 MB) until a map actually renders. The implementation reaches the mapcn
// components through `@oakestra/ui/map`, which keeps that shared module the only MapLibre copy.
export {
  LazyLocationMap,
  LocationMap,
  toMapLocation,
  type GeoLocation,
  type LocationMapProps,
  type MapLocation,
  type MapLocationTone,
  type MarkerLinkProps,
} from './components/location-map';
