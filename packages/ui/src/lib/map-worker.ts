import type * as MapLibreGL from 'maplibre-gl';

// Kept on globalThis on purpose: the root `@oakestra/ui` export and the `@oakestra/ui/map` subpath
// are separate Module Federation shared modules, and each bundles its own copy of this file, so
// plain module state set through one would be invisible to the other.
const WORKER_URL_KEY = Symbol.for('oakestra.ui.mapWorkerUrl');

type WorkerUrlHolder = { [WORKER_URL_KEY]?: string };

/**
 * Tells the map components where MapLibre's worker script is served from.
 *
 * The host app imports the worker as an asset (`maplibre-gl/dist/maplibre-gl-worker.mjs?url`) and
 * calls this once at startup. The import cannot live in this package: in dev, Vite pre-bundles
 * shared packages, and its pre-bundler cannot load `?url` imports, which kills the dev server.
 */
export function setMapWorkerUrl(url: string): void {
  (globalThis as WorkerUrlHolder)[WORKER_URL_KEY] = url;
}

export function getMapWorkerUrl(): string | undefined {
  return (globalThis as WorkerUrlHolder)[WORKER_URL_KEY];
}

/**
 * Hands the configured worker URL to MapLibre unless it already has one. Throws when nothing was
 * configured, so a missing setup shows up as a map error instead of a silent blank map.
 */
export function applyMapWorkerUrl(lib: Pick<typeof MapLibreGL, 'getWorkerUrl' | 'setWorkerUrl'>) {
  if (lib.getWorkerUrl()) return;
  const url = getMapWorkerUrl();
  if (!url) {
    throw new Error(
      'No MapLibre worker URL configured. Call setMapWorkerUrl() from @oakestra/ui before rendering a map.',
    );
  }
  lib.setWorkerUrl(url);
}
