const CHUNK_FAILURE_MESSAGES = [
  // Native dynamic import() in Chromium, Firefox and Safari.
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  // Vite's preload helper, which also fetches the CSS of a chunk.
  /unable to preload css/i,
  // Webpack-built remotes.
  /loading (css )?chunk .+ failed/i,
  // Module Federation: remoteEntry exports, manifest and script resources could not be fetched.
  /RUNTIME-00[138]\b/,
];

/**
 * Whether code failed to download, as opposed to code that ran and threw. The difference matters
 * for recovery: React.lazy caches a rejected import and rethrows it forever, so rendering again
 * cannot help and only a full page reload fetches the code anew.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ChunkLoadError') return true;
  if (CHUNK_FAILURE_MESSAGES.some((pattern) => pattern.test(error.message))) return true;
  return isChunkLoadError(error.cause);
}
