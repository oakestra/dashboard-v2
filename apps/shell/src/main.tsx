// Module Federation needs an async boundary before any shared module (React, the SDK, ...) is
// evaluated, so the share scope can be initialised first. Keep this file free of other imports.
void import('./bootstrap');
