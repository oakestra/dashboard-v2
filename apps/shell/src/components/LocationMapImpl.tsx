import {
  Map,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
  type MapGeoJSONData,
} from '@oakestra/ui/map';
import { cn } from '@oakestra/ui';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';

import { ErrorBoundary } from '../core/extensions/ErrorBoundary';
import type { MapLocation, MapLocationTone } from './location-map-types';

// MapLibre takes [lng, lat], unlike the lat/lng order used everywhere else in the shell.
const WORLD_CENTER: [number, number] = [0, 20];
const WORLD_ZOOM = 1;
const SINGLE_POINT_ZOOM = 6;
const KM_PER_DEGREE = 111.32;
const CIRCLE_STEPS = 64;
// MapLibre paint properties do not understand CSS variables, so the circle colors are literals at
// a lightness that reads on both the light and dark basemap: the Oakestra slate-teal (chart-1),
// an amber close to the warning token and a neutral grey.
const CIRCLE_COLORS: Record<MapLocationTone, string> = {
  default: '#46839d',
  warning: '#c98a1b',
  muted: '#8a94a0',
};
const MARKER_CLASSES: Record<MapLocationTone, string> = {
  default: 'bg-primary ring-primary/25',
  warning: 'bg-warning ring-warning/25',
  muted: 'bg-muted-foreground ring-muted-foreground/25',
};

// Equirectangular offsets: off by a few percent for large radii far from the equator, which is
// fine for a "roughly here" circle and avoids pulling in a geodesy library.
function circleDeltas(lat: number, radiusKm: number) {
  const latDelta = radiusKm / KM_PER_DEGREE;
  // Meridians converge towards the poles; clamp to keep the division finite.
  const lngDelta = radiusKm / (KM_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { latDelta, lngDelta };
}

function circlePolygon(lat: number, lng: number, radiusKm: number): MapGeoJSONData {
  const { latDelta, lngDelta } = circleDeltas(lat, radiusKm);
  const ring: [number, number][] = [];
  for (let step = 0; step <= CIRCLE_STEPS; step++) {
    const angle = (step / CIRCLE_STEPS) * 2 * Math.PI;
    ring.push([lng + lngDelta * Math.cos(angle), lat + latDelta * Math.sin(angle)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

/** [[west, south], [east, north]] covering every point and circle. */
function boundsOf(locations: readonly MapLocation[]): [[number, number], [number, number]] {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { lat, lng, radiusKm } of locations) {
    const { latDelta, lngDelta } = radiusKm
      ? circleDeltas(lat, radiusKm)
      : { latDelta: 0, lngDelta: 0 };
    west = Math.min(west, lng - lngDelta);
    east = Math.max(east, lng + lngDelta);
    south = Math.min(south, lat - latDelta);
    north = Math.max(north, lat + latDelta);
  }
  return [
    [west, Math.max(south, -85)],
    [east, Math.min(north, 85)],
  ];
}

function FitBounds({ locations }: { locations: readonly MapLocation[] }) {
  // Depends on the map instance only: `isLoaded` flips during a theme switch, and refitting then
  // would throw away whatever the user panned to.
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;
    const [first] = locations;
    if (!first) {
      map.jumpTo({ center: WORLD_CENTER, zoom: WORLD_ZOOM });
    } else if (locations.length === 1 && !first.radiusKm) {
      map.jumpTo({ center: [first.lng, first.lat], zoom: SINGLE_POINT_ZOOM });
    } else {
      map.fitBounds(boundsOf(locations), { padding: 32, maxZoom: 10, duration: 0 });
    }
  }, [map, locations]);

  return null;
}

function LocationCircle({
  lat,
  lng,
  radiusKm,
  tone,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  tone: MapLocationTone;
}) {
  const data = useMemo(() => circlePolygon(lat, lng, radiusKm), [lat, lng, radiusKm]);
  const color = CIRCLE_COLORS[tone];
  return (
    <MapGeoJSON
      data={data}
      fillPaint={{ 'fill-color': color, 'fill-opacity': 0.15 }}
      linePaint={{ 'line-color': color, 'line-width': 1.5 }}
    />
  );
}

function LocationMarker({ lat, lng, label, tone = 'default', href }: MapLocation) {
  const dot = cn(
    'block size-4 rounded-full border-2 border-white shadow-md ring-4 dark:border-background',
    MARKER_CLASSES[tone],
  );
  return (
    <MapMarker longitude={lng} latitude={lat}>
      <MarkerContent>
        {href ? (
          <Link
            to={href}
            aria-label={label}
            className={cn(dot, 'focus-visible:ring-ring outline-none focus-visible:ring-[3px]')}
          />
        ) : (
          <span role="img" aria-label={label} className={dot} />
        )}
      </MarkerContent>
      <MarkerTooltip>{label}</MarkerTooltip>
    </MapMarker>
  );
}

export interface LocationMapImplProps {
  locations: readonly MapLocation[];
  className?: string;
  ariaLabel?: string;
}

export default function LocationMapImpl({
  locations,
  className,
  ariaLabel = 'Map of locations',
}: LocationMapImplProps) {
  const locationKey = (location: MapLocation) =>
    `${location.label}:${location.lat}:${location.lng}`;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      // MapLibre controls carry their own z-indexes; a new stacking context keeps them below the
      // app's dialogs and popovers.
      className={`isolate ${className ?? 'h-72 w-full overflow-hidden rounded-lg border'}`}
    >
      {/* MapLibre needs WebGL2. Without it the Map throws while rendering; keep that local to
          the map instead of failing the whole page. */}
      <ErrorBoundary
        fallback={() => (
          <div className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-md p-4 text-center text-sm">
            The map cannot be shown in this browser (WebGL is unavailable).
          </div>
        )}
      >
        <Map center={WORLD_CENTER} zoom={WORLD_ZOOM} scrollZoom={false} className="size-full">
          {locations.map((location) =>
            location.radiusKm ? (
              <LocationCircle
                key={`circle:${locationKey(location)}`}
                lat={location.lat}
                lng={location.lng}
                radiusKm={location.radiusKm}
                tone={location.tone ?? 'default'}
              />
            ) : null,
          )}
          {locations.map((location) => (
            <LocationMarker key={locationKey(location)} {...location} />
          ))}
          <MapControls />
          <FitBounds locations={locations} />
        </Map>
      </ErrorBoundary>
    </div>
  );
}
