import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocationMap, toMapLocation } from './location-map';

// jsdom has no WebGL, so MapLibre cannot run here. The stand-ins render markers and circles as
// plain elements and record the camera calls, which is what LocationMap decides on.
const camera = vi.hoisted(() => ({
  jumpTo: vi.fn(),
  fitBounds: vi.fn(),
  failRender: false,
}));

vi.mock('@oakestra/ui/map', () => ({
  Map: ({ children }: { children: ReactNode }) => {
    if (camera.failRender) throw new Error('WebGL2 is not supported');
    return <div data-testid="map">{children}</div>;
  },
  MapControls: () => null,
  MapGeoJSON: ({ data }: { data: unknown }) => (
    <div data-testid="circle" data-geojson={JSON.stringify(data)} />
  ),
  MapMarker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MarkerContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  MarkerTooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useMap: () => ({ map: camera }),
}));

afterEach(() => {
  camera.failRender = false;
  camera.jumpTo.mockClear();
  camera.fitBounds.mockClear();
});

describe('LocationMap', () => {
  it('draws a marker per location, circles for radii, and fits them into view', async () => {
    render(
      <LocationMap
        ariaLabel="Cluster locations"
        locations={[
          { lat: 52.52, lng: 13.405, radiusKm: 100, label: 'Berlin' },
          { lat: 48.14, lng: 11.58, label: 'Munich' },
        ]}
      />,
    );

    const region = await screen.findByRole('region', { name: 'Cluster locations' });
    expect(region).toContainElement(screen.getByRole('img', { name: 'Berlin' }));
    expect(screen.getByRole('img', { name: 'Munich' })).toBeInTheDocument();
    expect(screen.getAllByTestId('circle')).toHaveLength(1);

    expect(camera.fitBounds).toHaveBeenCalledOnce();
    const [bounds] = camera.fitBounds.mock.calls[0] ?? [];
    const [[west, south], [east, north]] = bounds as [[number, number], [number, number]];
    // The 100 km circle around Berlin reaches further north and east than either point.
    expect(north).toBeGreaterThan(52.52 + 0.8);
    expect(east).toBeGreaterThan(13.405 + 1.3);
    expect(south).toBeLessThanOrEqual(48.14);
    expect(west).toBeLessThanOrEqual(11.58);
  });

  it('centers on a single point and shows the world without locations', async () => {
    const { rerender } = render(
      <LocationMap locations={[{ lat: 1, lng: 2, label: 'A' }]} ariaLabel="Map" />,
    );
    await screen.findByRole('img', { name: 'A' });
    expect(camera.jumpTo).toHaveBeenLastCalledWith({ center: [2, 1], zoom: 6 });

    rerender(<LocationMap locations={[]} ariaLabel="Map" />);
    expect(camera.jumpTo).toHaveBeenLastCalledWith({ center: [0, 20], zoom: 1 });
  });

  it('links markers that have an href and colors them by tone', async () => {
    render(
      <LocationMap
        ariaLabel="Map"
        locations={[
          { lat: 1, lng: 2, label: 'A', href: '/infrastructure/clusters/a' },
          { lat: 3, lng: 4, label: 'B (inactive)', tone: 'warning', radiusKm: 10 },
        ]}
      />,
    );

    expect(await screen.findByRole('link', { name: 'A' })).toHaveAttribute(
      'href',
      '/infrastructure/clusters/a',
    );
    expect(screen.getByRole('img', { name: 'B (inactive)' })).toHaveClass('bg-warning');
  });

  it('lets the host render marker links', async () => {
    render(
      <LocationMap
        ariaLabel="Map"
        locations={[{ lat: 1, lng: 2, label: 'A', href: '/x' }]}
        renderLink={({ href, label }) => <button data-href={href}>{label} (router)</button>}
      />,
    );

    expect(await screen.findByRole('button', { name: 'A (router)' })).toHaveAttribute(
      'data-href',
      '/x',
    );
  });

  it('keeps the page alive when the browser cannot render the map', async () => {
    camera.failRender = true;
    // React reports errors caught by a boundary on the console.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<LocationMap locations={[]} ariaLabel="Empty map" />);

    expect(await screen.findByRole('region', { name: 'Empty map' })).toHaveTextContent(
      'WebGL is unavailable',
    );
  });
});

describe('toMapLocation', () => {
  it('maps parsed cluster locations and drops missing ones', () => {
    expect(toMapLocation('A', { latitude: 1, longitude: 2, radius: 5 })).toEqual({
      lat: 1,
      lng: 2,
      radiusKm: 5,
      label: 'A',
    });
    expect(toMapLocation('B', { latitude: 1, longitude: 2 })).toEqual({
      lat: 1,
      lng: 2,
      label: 'B',
    });
    expect(toMapLocation('C', null)).toBeNull();
  });
});
