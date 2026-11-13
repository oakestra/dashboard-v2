// Kept free of imports so other features could invalidate these caches without going through
// this feature's index.
export const addonManagerKeys = {
  all: ['addon-manager'] as const,
  installed: () => [...addonManagerKeys.all, 'installed'] as const,
  marketplace: () => [...addonManagerKeys.all, 'marketplace'] as const,
  sources: () => [...addonManagerKeys.all, 'sources'] as const,
};
