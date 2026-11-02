// The form pages are routed from the applications module (see `newServiceRoutes`), so this
// feature has no CoreModule of its own.
// The service detail page's SLA export takes the same fields as a duplicate.
export { serviceToSlaMicroservice } from './model/convert';
export { duplicateServiceRoutes, newServiceRoutes } from './routes';
