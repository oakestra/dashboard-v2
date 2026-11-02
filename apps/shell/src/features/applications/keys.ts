// Kept free of imports so other features can invalidate these caches without importing this
// feature's index (which would create an import cycle).
export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (userId: string) => [...applicationKeys.lists(), userId] as const,
  detail: (applicationId: string) => [...applicationKeys.all, 'detail', applicationId] as const,
};
