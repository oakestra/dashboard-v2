// Kept free of imports so other features can invalidate these caches without importing this
// feature's index (which would create an import cycle).
export const organizationKeys = {
  all: ['organizations'] as const,
  list: () => [...organizationKeys.all, 'list'] as const,
};
