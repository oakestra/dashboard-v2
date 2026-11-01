---
'@oakestra/ui': minor
'@oakestra/dashboard-sdk': minor
---

`@oakestra/ui`: new `@oakestra/ui/map` subpath with the mapcn map components (`Map`, `MapMarker`, `MarkerTooltip`, `MapGeoJSON`, `MapControls`, `useMap`, ...) on MapLibre GL. The basemap follows the `.dark` class, and the MapLibre worker is served from the host bundle instead of unpkg.

`@oakestra/dashboard-sdk`: `sharedDeps` shares `@oakestra/ui/map`, so addons can import it and reuse the shell's copy.
