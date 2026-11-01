// Kept free of imports so other features can invalidate these caches without importing this
// feature's index (which would create an import cycle).
export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
  organization: (organizationId: string) =>
    [...userKeys.all, 'organization', organizationId] as const,
};
