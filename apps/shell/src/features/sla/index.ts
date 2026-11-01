// The form pages are routed from the applications module (see `newServiceRoutes`), so this
// feature has no CoreModule of its own.
// Shared with the service detail page's JSON export, which must drop the same addresses.
export { withoutRoundRobinIps } from './model/convert';
export { duplicateServiceRoutes, newServiceRoutes } from './routes';
