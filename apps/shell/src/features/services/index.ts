// Reused by the application detail page, which lists the same services.
export { serviceKeys } from './keys';
export { serviceQuery, servicesByApplicationQuery } from './api/queries';
export { useDeleteService, useDeployAll, useDeployInstance } from './api/mutations';
export { createServiceRoutes } from './routes';
export { InstanceSummary } from './components/InstanceSummary';
export { StatusBadge } from './components/StatusBadge';
export {
  describeStatus,
  formatVirtualization,
  isTransitionalStatus,
  summarizeStatuses,
  usePollWhileTransitional,
} from './status';
export type { StatusDescription, StatusSummary, StatusTone } from './status';
