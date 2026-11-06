/** A MapLibre style URL per theme. */
export interface MapStyleUrls {
  light: string;
  dark: string;
}

// Kept on globalThis for the same reason as the worker URL (see map-worker.ts): the root export
// and the map subpath are separate shared modules, each with its own copy of this file.
const STYLES_KEY = Symbol.for('oakestra.ui.mapStyles');

type StylesHolder = { [STYLES_KEY]?: MapStyleUrls };

/**
 * The public CARTO styles (Positron and Dark Matter), used when a deployment configures none. Every
 * map view sends the viewer's IP address to CARTO, a US host, and the fonts of the map labels come
 * from there too. The default has to stay a host that keeps style, tiles, sprites and glyphs
 * together in one place: a style that loads glyphs from another host sends the IP address there as
 * well.
 */
export const DEFAULT_MAP_STYLES: MapStyleUrls = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

/**
 * Replaces the basemap of every map, for deployments that serve their own tiles. Takes both themes
 * at once on purpose: a deployment with one self-hosted style must not fall back to the public
 * default in dark mode.
 */
export function setMapStyles(styles: MapStyleUrls): void {
  (globalThis as StylesHolder)[STYLES_KEY] = styles;
}

export function getMapStyles(): MapStyleUrls {
  return (globalThis as StylesHolder)[STYLES_KEY] ?? DEFAULT_MAP_STYLES;
}
