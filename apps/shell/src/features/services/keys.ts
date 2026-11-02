// Kept free of imports so other features can invalidate these caches without importing this
// feature's index (which would create an import cycle).
export const serviceKeys = {
  all: ['services'] as const,
  lists: () => [...serviceKeys.all, 'application'] as const,
  byApplication: (applicationId: string) => [...serviceKeys.lists(), applicationId] as const,
  detail: (serviceId: string) => [...serviceKeys.all, 'detail', serviceId] as const,
};
