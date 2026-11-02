// Kept free of imports so other features can invalidate these caches without importing this
// feature's index (which would create an import cycle).
export const clusterKeys = {
  all: ['infrastructure'] as const,
  list: () => [...clusterKeys.all, 'clusters'] as const,
};
