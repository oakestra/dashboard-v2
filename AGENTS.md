# Oakestra Dashboard v2

React shell that loads addon UIs at runtime through Module Federation.

## Layout

- `apps/shell`: the host. `src/core/*` is the platform (config, auth, API client, query client,
  theme, extension registry, addon runtime), `src/features/<name>` are built-in feature modules,
  `src/app` wires them together, `src/test` holds the test helpers.
- `packages/dashboard-sdk`: the public, semver'd contract addons build against. The root also
  exports `Slot`, so an addon can host extension points (the shell injects its renderer through
  `SlotRendererContext`; outside a shell it renders `empty`). Entries: the root,
  `./federation` (Node only, loaded from vite configs), `./vite` (Node only: `oakestraAddon()`,
  the Vite plugin addons build with; `vite` and `@module-federation/vite` are optional peers),
  `./vite/client` (hand-written `vite-client.d.ts` typing `virtual:oakestra-addon`; a plain string
  export, so it has no API report) and `./testing` (test only: `renderInHost`,
  `createTestHost`, `TestHostProvider`, `createMockApi`, `createNotifyRecorder`; not in
  `sharedDeps`, `@testing-library/react` is an optional peer; it must import the contexts from
  `./context` so dist keeps one `createContext`).
- `packages/ui`: shadcn components, composites (`DataTable`, `EmptyState`, `PageHeader`,
  `ConfirmDialog`) and Tailwind v4 theme, shared as a singleton.
- `packages/api`: typed system-manager client: committed spec snapshot (`specs/`), generated
  `paths` (`src/generated/`, never edit), Zod models and endpoint groups (`createOakestraApi`).
- `packages/mocks` (private): MSW handlers plus an in-memory backend seeded from sanitized real
  responses. Used by unit tests, `pnpm dev:mock` and `tools/mock-system-manager`.
- `addons/example`: reference addon and e2e fixture, with its own vitest setup showing the testing
  entry.
- `modules/<name>` (`@oakestra/module-<name>`, private): features as addon packages written
  against the SDK only, linked into the shell (`linkedAddons` in `src/app/modules.ts`). `help` is
  the reference. See "Module packages". `modules/fleet` is a board of cluster cards, each listing its services by
  application, behind an Unplaced card (`/fleet`, lenses, inspector, exceptions list); its state lives
  in search params. The board's columns use container queries, because the inspector narrows the page.
- `tools/mock-addons-manager`: one server mocking the addons-manager, the marketplace-manager and
  `GET /api/v1/ui-addons` (see "Mock addons manager"), with a `/__test` control API.
- `tools/mock-system-manager`: the `@oakestra/mocks` backend served over HTTP for the e2e stack.
- `tools/package-checks`: `pnpm api:check` / `pnpm api:update` (API Extractor reports, one per
  public entry, in `packages/*/api-report/`) and `pnpm pack:check` (packs the three public
  packages and builds a copy of `addons/example` and a freshly scaffolded addon outside the
  workspace against the tarballs).
- `tools/create-addon`: `pnpm create:addon <name> [--prefix] [--label] [--port] [--dir]` generates
  a new addon (`addons/<name>`, or a standalone one outside the repo with `--dir`). The template is
  real files in `template/{common,workspace,standalone}` with `__NAME__`-style placeholders,
  excluded from ESLint, Prettier and tsc. Changes to the example's build setup or the SDK Vite
  plugin must be mirrored there; `pnpm pack:check` builds an addon generated from it.
- `e2e`: Playwright suite against `compose.dev.yml`.
- `docs`: documentation for people, linked from `README.md`: the demo walkthrough (`demo.md`) and
  the addon developer guide (`addons/`). Keep `docs/addons/` in sync with changes to the SDK,
  extension points, addon loading or packaging, and `docs/demo.md` with the compose stack and the
  example addon. Screenshots live in `docs/images/`.

## Verify a change

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass. For anything touching addon
loading, nginx, Docker or the SDK, also run the e2e suite:

```sh
docker compose -f compose.dev.yml up --build -d
pnpm e2e
```

When the public types of `@oakestra/dashboard-sdk`, `@oakestra/ui` or `@oakestra/api` change, run
`pnpm api:update` and commit the reports: they make every public API change visible in review.

CI (`.github/workflows/ci.yml`) runs the same four commands, `pnpm api:check`, `pnpm pack:check`
and the Storybook build, then the e2e suite against the compose stack. Pushing a `v*.*.*` or `alpha-v*.*.*` tag publishes the shell image to `ghcr.io/oakestra/dashboard`
(`release-image.yml`; alpha tags do not move `latest`).

Changesets are set up (`.changeset/config.json` lists the private packages as ignored) but not used
yet: nothing has been released, so whatever is in the repo at the first publish is the baseline. Do
not add changesets until then. From the first publish on, add one (`pnpm changeset`) for any change
to `@oakestra/dashboard-sdk`, `@oakestra/ui` or `@oakestra/api`; `pnpm version-packages` applies
pending ones. The three packages build to `dist/` with tsdown (`pnpm build`, and `prepack`);
inside the repo `exports` stay on `src/`, and `publishConfig.exports` points them at `dist/` when
packing. No publish workflow exists yet.

Running the shell locally:

- `pnpm dev` talks to the system-manager in `apps/shell/public/config.json`
  (`http://localhost:10000/api`; a local root orchestrator, log in as `Admin`/`Admin`).
- `pnpm dev:mock` needs no backend: MSW answers the API in the browser. Fixture users are `Admin`,
  `alice` (Application_Provider), `bob` (Infrastructure_Provider), `carol` (Organization_Admin,
  Application_Provider) and `dave`; the password is the username. Log in as different users to
  check role-dependent UI.
- `pnpm gen:api` refreshes `packages/api/specs/` and the generated types from a running
  system-manager (default `http://localhost:10000/docs/openapi.json`, or pass a URL);
  `pnpm gen:api --offline` regenerates from the committed snapshot.

The dev override (load an addon from a local Vite server) is checked by hand: run
`pnpm --filter @oakestra/addon-example dev` and `pnpm dev`, then open
`http://localhost:5173/?addon-override=example=http://localhost:5174/mf-manifest.json`.
`pnpm dev` proxies `/ui-addons` and `/addons-api` to `ADDONS_MANAGER_URL` (default
`http://localhost:11101`, where the compose stack or `pnpm --filter @oakestra/mock-addons-manager
start` serves it) and `/marketplace-api` to `MARKETPLACE_URL` (default `http://localhost:11102`;
with the mock set it to the same `http://localhost:11101`). `pnpm dev:mock` also mocks both addon
backends in the browser (installs settle after 3s; `/ui-addons` stays empty).

## Contribution model

- Core features and addons contribute through the same registry
  (`apps/shell/src/core/extensions/registry.ts`). A new core feature is a `CoreModule` in
  `src/features/<name>/index.ts`, listed in `src/app/modules.ts` (see "Feature modules"). Nav,
  slots and role filtering never special-case core vs addon.
- Extension points are the `ExtensionPoints` interface in the SDK. Adding one: add the key there,
  to `EXTENSION_POINT_IDS`, and to `pointSchemas` in `core/addons/definition.ts`; render it with
  `<Slot point="..." />`. Points that are data, not components (`nav.items`, `command.actions`,
  `command.sources`; the rest is `RenderablePointId`) are read with `useContributions` instead and
  are not accepted by `<Slot>`. New points are an SDK minor bump; renames or incompatible context
  changes are a major bump.
- The shell's Settings page (`features/settings`) is for platform-wide settings and has no
  extension point. It has none yet and shows an empty state; per-account preferences (the theme) go
  in the account menu. Addons put their settings on their own page, linked as a nav sub-item; core
  sections are added to `GeneralSettingsPage` directly.
- Addon routes are rendered by `AddonRouteHost` at `/addons/:addonId/*` with `useRoutes`, never
  patched into the data router. Addon routes therefore have no loaders; addons fetch with
  TanStack Query and namespace keys with `addonQueryKey`, and build links with `useAddonPath()`
  (each argument is one encoded segment), never by concatenating `basePath`.
- `roles` on an addon route is enforced by a `RoleGate` (`core/addons/addon-routes.tsx`); a
  parent's roles guard its children. A denied route renders the app's `ForbiddenPage`, passed to
  `AddonRouteHost` as its `forbidden` prop because `core` cannot import `app`. `FORBIDDEN_MESSAGE`
  in `core/auth/guards.ts` is the 403 text shared with `requireRole`.
- Addon breadcrumbs: the `addons/:addonId/*` route has the id `ADDON_PAGE_ROUTE_ID`, and
  `Breadcrumbs` expands it with `useAddonCrumbs` (the definition's `label`, or the id while it is
  loading, failed or unlabeled, then the `crumb` of each matched addon route, from `matchRoutes` on
  the same cached route objects the host renders). Do not give that route a `handle.crumb` or
  publish crumbs from the host.
- Every loaded addon definition is validated with Zod before registration. Anything the shell
  would later crash on must be rejected there, turning the addon into a `failed` entry.

## Feature modules

`src/features/profile` is the reference; copy its shape.

```
features/<name>/
  index.ts          CoreModule (routes, contributions) + whatever other features may import
  api/queries.ts    <name>Keys factory + queryOptions factories
  api/mutations.ts  useXyz() mutation hooks
  components/       pieces used by the pages
  pages/            route components, one per route; tests next to them (*.test.tsx)
```

- **Register:** export `const <name>Module: CoreModule = { id, label, routes, contributions }` and
  add it to `src/app/modules.ts`. `routes` are children of `/` inside the app layout (behind
  `requireAuth`); use `lazy: () => import('./pages/X').then((m) => ({ Component: m.X }))`.
  `publicRoutes` are for pages without a session (only the `auth` module needs them).
- **Route nesting:** react-router needs exactly one route object per path, so a path prefix has a
  single owner (one module, or one linked package's mount). Never declare a second object for a
  path another module owns: which one matches then depends on module order. Pages that belong
  below another feature's path are part of that feature (services and SLA forms live in the
  applications package, nested below `:appId`). `app/routes.test.tsx` builds the router from the
  real `coreModules` and `linkedAddons` and checks every URL.
- **Route options:** `handle: { crumb: 'Label' } satisfies RouteHandle` (or a function of the
  match) feeds the breadcrumbs; `loader: requireRole('Admin', ...)` restricts a page (403 page
  inside the layout). Hide the nav item with `roles` on the contribution as well.
- **Nav:** `contributions: { 'nav.items': [{ id, label, path: '/x', icon, group, order, roles }] }`
  with `group` `main`, `management`, `addons` or `footer` (pinned to the bottom, Help and
  Settings). `children: [{ id, label, path, order, roles }]`
  nests sub-items (one level only, see `app/layouts/nav-model.ts`); the one link with the longest
  matching path is highlighted, so a parent and its sub-item are never active together.
- **Shared status helpers** (`describeStatus`, `serviceAttention`, `summarizeStatuses`,
  `isPlacementFailure`, `instanceProblem`, `clusterReportState`, tones) live in `@oakestra/api`
  (`status.ts`, `models/cluster.ts`), so packages and the SDK do not each keep a copy.
  `modules/applications/src/services/status.ts` re-exports them and adds only React.
- **Data:** components get the API with `useOakestraApi()` from the SDK, exactly like addons, and
  never build URLs. Responses are already parsed by `@oakestra/api` models; failures are
  `ApiError`s with a readable `message` (use `describeError()` from `core/api/errors`, a
  re-export of the one in `@oakestra/api`, which the SDK also exports for addons).
- **Query keys:** one factory per feature, rooted at the feature id, and `queryOptions` factories
  that pages, prefetches and tests share. Another feature's keys are imported through its
  `index.ts` only, with one exception: a dependency-free `features/<name>/keys.ts` holding the key
  factory (re-exported from `index.ts`), for features that invalidate each other's caches, so
  those imports do not form a cycle through the `index.ts` files (`addon-manager/keys.ts`).
  Clusters and the current user's
  account have one shared query each, `clustersQuery(api)` and `profileQuery(api, username)` from
  the SDK (keys `platformQueryKeys`, shared with addon packages); `profile` re-exports its
  query, and nobody fetches clusters or `/user/{name}` under another key.
  Users and organizations (packages `modules/users`, `modules/organizations`) list each other's
  data and cannot import each other, so their queries are SDK platform queries (`usersQuery`,
  `organizationsQuery`; the members of one organization sit under `platformQueryKeys.users()`),
  and mutations on either side invalidate `platformQueryKeys.users()` and
  `platformQueryKeys.organizations()`. Role names and descriptions (`ROLE_OPTIONS`, `roleLabel`)
  are SDK exports; each package builds its role picker from `CheckboxGroup` in `@oakestra/ui`.
  Applications and services (package `modules/applications`) are platform queries too, so other
  packages and addons can share their cache entries: `applicationsQuery(api, userId)` and
  `servicesByApplicationQuery(api, applicationId)`. Their whole key tree, the package's detail
  keys included, is `platformQueryKeys.applications()` / `.services()`, so invalidating one prefix
  refreshes lists and details together. A detail query that a list may already hold spreads
  `seedFromLists(queryClient, listPrefix, match)` (SDK root) into its options, so coming from a
  list does not wait for a round trip.

  ```ts
  export const installedKeys = {
    all: ['addon-manager'] as const,
    list: () => [...installedKeys.all, 'installed'] as const,
    detail: (id: string) => [...installedKeys.all, 'installed', id] as const,
  };
  export const installedAddonQuery = (manager: AddonsManagerEndpoints, id: string) =>
    queryOptions({
      queryKey: installedKeys.detail(id),
      queryFn: ({ signal }) => manager.get(id, { signal }),
    });
  ```

- **Confirm dialogs:** `ConfirmDialog` closes in `onSettled` (also on failure, the mutation toasts
  the error); forms close in `onSuccess` so the input survives a failure.
- **Mutations:** a hook per action in `api/mutations.ts`. Set `meta.errorMessage` (toast title;
  the global MutationCache toasts every failure) or `meta: { silent: true }` when the component
  shows the error itself (forms). In `onSuccess`, `await queryClient.invalidateQueries(...)` with
  the narrowest key that covers what changed, and `notify.success(...)`. After a delete, use
  `invalidateAfterDelete` (`modules/applications/src/queries.ts`): the deleted entity's queries
  are marked stale without a refetch (its page is still mounted and would 404 on the way out;
  `removeQueries` does not help, mounted observers refetch at once), the rest refreshes.
- **Errors in pages:** render loading and error states inline (`isPending`, `isError` with a
  retry). The QueryCache only toasts when a refetch fails while data is shown; `meta.silent`
  disables that too.
- **Forms:** React Hook Form + `zodResolver(schema)` with `Field`/`FieldLabel`/`FieldError` from
  `@oakestra/ui`. Reuse `@oakestra/api` schemas where they exist (`loginRequestSchema`,
  `slaV2Schema`). Submit with `onSubmit={(event) => void form.handleSubmit(onValid)(event)}`.
- **Slots:** render extension points with `<Slot point="..." context={...} />` from
  `core/extensions/Slot` (optional `render` wrapper and `empty` state; the shell-only `filter`
  renders a subset, which is how the overview splits `home.widgets` by `size`). Each contribution
  is isolated in its own error boundary.
- **Tests:** `renderApp()` from `src/test/render` renders the real router, layout and guards
  against the MSW backend:

  ```tsx
  const { user } = renderApp({ modules: [xModule], route: '/x', user: { username: 'alice' } });
  ```

  `user: null` renders logged out, `roles: [...]` overrides the token's roles. Assert on backend
  state through `mockStore.data`; override an endpoint with `mockServer.use()` plus `http` and
  `HttpResponse` from `@oakestra/mocks` (see `ProfilePage.test.tsx`). Store and handlers reset
  after every test. `renderWithProviders(<Component />)` does the same without a module.

- **Mocks:** a new backend endpoint gets an endpoint function in `packages/api`, a handler in
  `packages/mocks/src/handlers.ts` that mirrors the real permission checks and error shapes, and a
  case in `packages/mocks/src/handlers.test.ts`.

## Shared components

Generic building blocks go in `@oakestra/ui`: feature packages may import only the SDK,
`@oakestra/ui` and `@oakestra/api` types, so shell-local helpers are not the default. `apps/shell/src/components` and `src/lib` are only for things that need shell internals;
features may import both (never the other way round); anything that knows about a single feature
stays in that feature.

`@oakestra/ui` (import from the package root, except the subpath exports below):

**Rule:** heavy optional components (anything that pulls in a large third-party library) go in a
subpath export, not the root index. Every page loads the root module, because it is an eager
Module Federation singleton. A subpath needs a `src/<name>.ts` entry, an `exports` entry in
`packages/ui/package.json`, a `sharedDeps` entry in `packages/dashboard-sdk/src/federation.ts` and
a `!@oakestra/ui/<name>` exception in the addon import restrictions of `packages/eslint-config`,
plus the entry in `packages/ui/tsdown.config.ts` and `publishConfig.exports`; `pnpm api:update`
then creates its report.
Each is then a separate chunk, shared with addons. Module Federation fetches the shared subpath
chunks at startup (`command-*.js` loads on `/login`), so the chunk itself is not lazy; what stays
lazy are their heavy dependencies, such as MapLibre, which only load when a map renders. Subpath chunks bundle their own
copy of small stateless pieces (`cn`, `Button`, `Table`), which is harmless.

- `@oakestra/ui/chart`: `ChartContainer`, `ChartTooltip(Content)`, `ChartLegend(Content)` on
  Recharts 3, plus the Recharts parts (`LineChart`, `AreaChart`, `BarChart`, `XAxis`, ...)
  re-exported so features never import `recharts` themselves.
- `@oakestra/ui/data-table`: `DataList` and `DataTable`, `createDataTableColumnHelper`, types (see
  below).
- `@oakestra/ui/command`: the cmdk-based `Command*` components.
- `@oakestra/ui/map`: mapcn (`Map`, `MapMarker`, `MarkerTooltip`, `MapGeoJSON`, `MapControls`,
  `useMap`, ...) on MapLibre GL with light/dark basemaps that follow the `.dark` class. Three
  local changes to upstream `components/map.tsx`, keep them when updating it: the worker URL comes
  from `setMapWorkerUrl()` instead of unpkg, the theme comes from the `.dark` class only (no OS
  fallback), and the styles come from `getMapStyles()` (`lib/map-styles.ts`) instead of a constant in
  the component. The public CARTO styles (Positron, Dark Matter) are the default, chosen for how
  they look even though every viewer's IP goes to a US host (VersaTiles was tried and dropped);
  `MAP_STYLE_URL`/`MAP_STYLE_DARK_URL` replace them through `mapStylesFromConfig`, and one set style
  serves both themes so a self-hosted deployment never falls back to the public server. The basemap
  is the only third-party request the dashboard makes: keep it that way, and keep style, tiles,
  sprites and glyphs of a default on one host. The shell's `bootstrap.tsx` imports `maplibre-gl/dist/maplibre-gl-worker.mjs?url`
  and registers it; never move that `?url` import into `packages/ui`, because Vite's dev
  pre-bundler (which handles the federated shared packages) cannot load `?url` and `pnpm dev`
  dies. The URL is kept on `globalThis` because the root export and the map subpath are separate
  shared modules with their own module state.

- `Kbd` (a key cap, for shortcut hints), `Slider` (shadcn on Radix; `thumbLabel`, one string or
  one per thumb, names the thumb, and `thumbValueText` formats what a screen reader announces,
  because Radix gives the thumb neither), `PointerGauge` (thin track with the normal band shaded
  and a pointer; `value: null` means not measured, above `normalMax` it turns `warning`) and
  `SourceTag` (dashed provenance tag with an addon name and version, a plain span so it can sit
  in tab triggers). `StatusBadge` and `StatusDot` take `stale` for a last-known state without a
  recent report: a dashed glyph and the hatch of `staleSurfaceClassName`, which table cells may
  reuse. Tone is kept, because the state still means something.
- shadcn primitives: accordion, alert-dialog, checkbox, collapsible, pagination,
  popover, progress, scroll-area, select, switch, tabs, textarea, toggle, toggle-group, tooltip,
  sheet, separator, skeleton, plus the older ones (button, card, dialog, field, ...).
- `DataList` (subpath `@oakestra/ui/data-table`): the collection every page uses, on the same row
  models as `DataTable`. `renderItem` returns an `Item` (`layout="list"`, one joined panel) or a
  `Card` (`layout="grid"`). `searchValue` and `sortOptions` feed the row model, so keep them at module
  scope; `globalFilter`, `sort` and `pagination` are uncontrolled unless value and handler are
  passed. An item that opens a page gets its main link `stretchedLinkClassName` (root export); the
  item needs `relative` (the `li` has it), other controls in it `relative z-10`.
- `Item` (`ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemHeader`,
  `ItemFooter`, `ItemGroup`, `ItemSeparator`): the shadcn item, a row of a list. Written by hand from
  the shadcn source, because the CLI cannot resolve this package's aliases.
- `DataTable` (subpath `@oakestra/ui/data-table`, kept for addons): TanStack Table v9 with sorting, global text filter, pagination, `onRowClick`,
  `emptyState`, `isLoading` skeleton rows and a `toolbar` slot. Build columns with
  `createDataTableColumnHelper<Row>()`. `globalFilter`, `sorting` and `pagination` are
  uncontrolled unless the value and its `on...Change` handler are passed, which is how to mirror
  them into URL search params. Numeric columns sort descending on the first click (TanStack
  default). Column `meta: { numeric: true }` right-aligns with tabular figures (`align`,
  `className`, `headerClassName` also exist).
- `EmptyState` (icon, title, description, action), `PageHeader` (title, description, actions),
  `ConfirmDialog` (`destructive`, `pending`; the caller closes it when the mutation settles).
- `StatusBadge` (`tone`, `dot`, `icon`, `pulse`) and `StatusDot`: status labels with a glyph per
  tone (disc, triangle, ring, square, dash), so status never rests on color alone; only `warning`
  and `destructive` get a fill. Tones are meanings, not backend states: `success` healthy,
  `warning` degraded, `info` in progress, `destructive` failed, `neutral` inactive or unknown.
  Features map their states onto tones in one place each; never pick colors per page.
- `StatCard` (`label`, `value`, `icon`, `hint`, `tone`, `loading`, `href`/`onClick`, or `asChild`
  with a router `Link`): metric tile that fills its grid cell. `StatGroup` joins tiles into one strip
  (two per row, one shared row from `lg`, so a missing tile leaves no hole).
- `SectionCard` (`title`, `description`, `action`, `headingLevel`, `flush`, `footer`): a titled
  page section, action top right. With plain `Card`, put actions in `CardAction` inside
  `CardHeader` (a grid; `flex-row` on it does nothing).

Also in `@oakestra/ui` root (generic helpers that feature packages must be able to import):

- `CopyButton`, `JsonViewer` (pretty-printed, collapsible, copy, optional `downloadAs`).
- `QueryErrorAlert` (`title`, `error`, `onRetry`, optional extra text as children): the inline
  error state of a failed query, with a "Try again" button. Use it instead of building the alert.
  It reads `error.message` itself (same text as `describeError`), because `@oakestra/ui` cannot
  import `@oakestra/api`.
- `format.ts` helpers (`formatBytes`, `formatMegabytes`, `formatPercent`, `formatRelativeTime`,
  `plural`, `formatDate(Time)`, `parseLegacyDate`/`formatLegacyDate`) and `downloadJson(filename,
data)` / `downloadText`.

`@oakestra/ui/chart` also has `TimeSeriesChart`: line or area chart of `{ timestamp: Date, value:
number }[]` with `unit` (`percent`, `bytes`, `number` or a formatter) and an accessible `title`.

`@oakestra/ui/location-map` has `LocationMap`: lazy map of `{ lat, lng, radiusKm?, label, tone?, href? }[]`.
Build entries with `toMapLocation(name, parseClusterLocation(cluster.cluster_location))`
(`parseClusterLocation` stays in `@oakestra/api`; `toMapLocation` takes the structural
`GeoLocation`). `LazyLocationMap` is the bare `React.lazy` component for callers with their own
Suspense. Marker `href`s render as plain anchors unless the host passes `renderLink` (the shell
passes a router `Link`, since `@oakestra/ui` has no router). Without WebGL2 it shows a notice
instead of the map. It is its own subpath, not part of `./map`, so a page that only imports it
does not load MapLibre until a map renders; its implementation imports `@oakestra/ui/map` by
package name (never `./map`), so the shared map module stays the only MapLibre copy.

`@oakestra/dashboard-sdk` root also exports `seedFromLists` and `useSearchParam(key, fallback)` (one
search param as state, replacing the history entry).

`apps/shell/src/lib` keeps `zod-issues.ts` (`formatIssue`, Zod issues worded for people who write
JSON by hand) for the addon manager's register dialog; the applications package has its own copy
for SLA imports (`modules/applications/src/lib/zod-issues.ts`). `apps/shell/src/components` holds
`OakestraLogo`.

TanStack Table is on v9 (`useTable`, `tableFeatures`, row models registered once at module scope
in `data-table.tsx`); the v8 `useReactTable` API does not exist there.

## API, auth and errors

- The access token lives in memory, the refresh token in localStorage
  (`oakestra.auth.refresh-token`). `core/api/authorized-fetch.ts` attaches the bearer token,
  refreshes 30s before expiry (one refresh shared by concurrent requests), and on a 401 refreshes
  and retries once. A rejected refresh token ends the session; `app/SessionWatcher` then sends the
  user to `/login`, toasts "session expired" and clears the query cache. Logout in one tab logs
  out all tabs.
- Route loaders get `auth`, `api` and `queryClient` through `context.get(appRouterContext)`
  (`core/router/app-context.ts`), since they run outside React.
- Addon management (marketplace + installed addons) is shell-internal and NOT part of the SDK's
  `OakestraApi`: the addons-manager and marketplace-manager have their own base URLs (config
  `addonsManagerUrl` `/addons-api`, `marketplaceUrl` `/marketplace-api`, both proxied by nginx).
  `@oakestra/api` has `createAddonsManagerApi(client)` and `createMarketplaceApi(client)` on top of
  `createAddonsClient({ baseUrl, fetch })`, which parses the body text as JSON whatever the
  Content-Type is. Components call `useAddonsAdminApi()` (`core/addons/addons-admin`) for
  `{ manager, marketplace }`; loaders use `context.get(appRouterContext).addonsAdmin`. Both use the
  authorized fetch. When an addon becomes or stops being `active`, `/ui-addons` must be refetched
  at once instead of at the next poll: inside the addon manager `useUiAddonsSync` (mounted in its
  layout) does that from the installed list, so mutations there do not call it themselves;
  elsewhere call `useRefreshUiAddons()` (or `refreshUiAddons(queryClient)`). `manager.remove(id)` returns `{ kind: 'disabling', addon }` or
  `{ kind: 'removed' }` (see Backend quirks); poll while `isTransitionalAddonStatus(status)`.
  Environment values of services may be secrets: show keys only, never values.
- `@oakestra/api` models are loose (`z.looseObject`), so new backend fields pass through. The
  exception is `userSchema`, which strips unknown keys to keep password hashes out of the app.

## Deployment presets

A runtime `preset.json` (`config.presetUrl`) picks the built-in modules, adds addons that ship with
the deployment and adjusts the sidebar; no preset means every module. User
docs: `docs/addons/presets.md`; examples: `apps/shell/presets/` (validated by
`src/app/example-presets.test.ts`).

- The schema is `presetSchema` in `core/config/preset.ts` (strict objects). `preset.schema.json`
  is generated from it and compared by `preset.test.ts`; regenerate with
  `pnpm --filter @oakestra/shell test -u`. Cross-checks that need the modules (unknown ids,
  addon named like a module, `home` without overview, mount overlap) live in `app/preset.ts`
  (`applyPreset`) because `core` cannot import features.
- Module ids (the `id` of each `CoreModule` and the name of each linked addon) are a public
  contract, like nav ids and the SDK: renaming one is a breaking change. They share a
  namespace with addon names. `auth` is always on. `modules` selects core modules and linked
  addons alike; a preset addon named like a core module is rejected, one named like a linked
  addon replaces it (inheriting its mount unless it sets one). `applyPreset` returns the selected
  `modules` and `linked` and the preset with inherited mounts, and checks every mount (linked and
  preset) against module routes and each other.
- Guard every link from one module's UI to another module's page with `useModuleEnabled(id)`
  (`core/modules.ts`; packages use the SDK's `useFeatureEnabled(id)`, which the shell answers
  from the same function), so a disabled module leaves no dead link. Importing its code (queries, keys)
  is unaffected, everything stays bundled. `hidden` nav items are only hidden, the routes stay.
- Nav overrides are keyed `kind:sourceId:itemId` (`core:settings:settings`,
  `addon:applications:applications`, `addon:example:main`), top-level items only; unknown keys warn instead of failing since addons
  load late. A `label` on an addon's root item (path `''`) also becomes its first crumb
  (`navOverrideLabel` in `core/addons/addon-crumbs.ts`).
- A preset addon with `mount` is routed at `${mount}/*` with route id `addon-mount:<name>`
  (route ids must be unique), and `isAddonPageMatch` recognizes both it and
  `ADDON_PAGE_ROUTE_ID` so `Breadcrumbs` and `useAddonCrumbs` stay the single expander. Its
  `basePath`, and so `useAddonPath()` and nav links, is the mount. `/addons/<name>` redirects
  there. Preset addons win over `/ui-addons` entries of the same name (dev override wins over
  both) and load even when discovery is off or unavailable.

## Module packages

Features move out of the shell into `modules/<name>` one by one. Each is an addon written against the SDK only and linked into the shell, so it can later be built
as a remote or replaced by a company's own addon under the same URL. `modules/help` is the
reference; copy its shape.

```
modules/<name>/
  package.json      @oakestra/module-<name>, private, exports "." -> ./src/index.ts
  src/index.ts      default export defineAddon({ id: '<name>', label, routes, contributions })
  src/pages/        route components (React.lazy in index.ts), tests next to them
  vitest.config.ts  + vitest.setup.ts (jsdom, jest-dom, cleanup), tsconfig.json
```

- **Wire it up:** add the package to `apps/shell/package.json`, then
  `{ definition, mount: '/<name>' }` to `linkedAddons` in `src/app/modules.ts`, and remove the
  `CoreModule`. The id stays the old module id (presets name it). `registerLinkedAddons`
  (`core/addons/linked-addons.ts`) validates it with `parseAddonDefinition` and registers it as
  `loaded` (`origin: 'linked'`) before the first render, so its nav items exist like core ones;
  an invalid definition becomes a `failed` entry. The loader never loads, replaces or removes a
  linked entry; `/ui-addons` entries and dev overrides with its name are ignored with a warning.
  Linked addons are hidden from the addon manager.
- **One mount per package.** Routes and nav `path`s are relative to it (`''` is the mount); links
  inside the package use `useAddonPath()`. A feature that owned several top-level paths gets one
  mount and redirects for the old URLs. The mount is routed at `${mount}/*` like a preset mount,
  `/addons/<name>` redirects there. Nav keys change from `core:<id>:<item>` to
  `addon:<id>:<item>` (update `docs/addons/presets.md` and `apps/shell/presets/`); nav test ids
  (`nav-<sourceId>-<itemId>`) stay the same when the item id does.
- **No loaders.** `requireRole` becomes `roles` on the route (a parent guards its children; hide the
  nav item with `roles` too). Data comes from `useQuery` in the page, keyed with
  `addonQueryKey('<name>', ...)`; a detail page reached from a list passes
  `initialData`/`initialDataUpdatedAt` from `seedFromLists(...)` (SDK) instead of a loader. A
  missing entity (404, or `null` from a `select`) renders inline (an `EmptyState` with a link
  back), not a route error.
- **Crumbs:** the addon `label` is the first crumb and links to the mount, so the index route
  usually has none. A crumb that needs data is a named component
  (`function ClusterCrumb({ params }: AddonCrumbProps)`, `crumb: ClusterCrumb`) running its own
  `useQuery` with the page's options, so both share one cache entry. It renders in the header
  with the addon context and its own error boundary; failing or suspended, it shows the last path
  segment.
- **Cross-package data:** use the SDK platform queries (`clustersQuery`, `profileQuery`, `usersQuery`,
  `organizationsQuery`, `applicationsQuery`, `servicesByApplicationQuery`, `platformQueryKeys`)
  instead of the shell's feature queries. Add a new one
  to `packages/dashboard-sdk/src/platform-queries.ts` only when two packages (or a package and the
  shell) really need the same cache entry; the shell then re-exports it.
- **Cross-package links:** plain absolute paths (`/infrastructure/clusters/...`) guarded with
  `useFeatureEnabled('<id>')`. Never import another package; a constant both need (such as
  `INFRASTRUCTURE_ROLES`) is repeated with a comment naming the original.
- **Slots:** `Slot` from the SDK, like remote addons. Chrome that must only exist when something
  is contributed (a tab list whose only tab would be the page's own) goes in `wrap`, the page
  without it in `empty`; see `ApplicationDetailPage` in `modules/applications`.
- **Overview widgets:** `features/overview` is only the greeting, an empty state and the layout;
  every tile and section is a `home.widgets` contribution of the package that owns the data
  (`modules/applications/src/overview`, `ClustersTile` in `modules/infrastructure`), so a package a
  preset leaves out takes its tiles along. `size` places a widget (SDK `WidgetSize`, parsed in
  `core/addons/definition.ts`, an unknown value falls back to `card`): `stat` tiles in the summary
  row and `wide` sections draw their own frame (`StatCard`, `SectionCard`), `card` widgets get the
  shell's card with `title`. Orders go in steps of 100 per size (stats: applications 100, services
  200, instances 300, clusters 400; wide: needs attention 100, recent applications 200) so
  deployments can slot their own in between; the table in `docs/addons/reference.md` lists them.
  A widget that has nothing to say returns `null`, the shell hides its empty wrapper.
- **Host links:** external links from the runtime config reach packages through `useHostLinks()`
  (SDK, `HostContextValue.links`, filled by `hostLinksFromConfig` in `core/host/host-context.ts`);
  add a field there instead of reading the shell's config. Today: `grafanaUrl` (the infrastructure
  page's "Open Grafana").
- **Styling:** plain Tailwind classes, no prefix (the shell scans `modules/*/src`). No CSS imports.
- **Tests:** unit tests in the package with `renderInHost` from `@oakestra/dashboard-sdk/testing`
  (`api` mocks, `user`, `features`, `links`, `addon: { addonId, basePath: mount }`,
  `route`/`path`). Page
  tests against the real router, layout, guards and MSW backend go to `apps/shell/src/linked/`
  and render with `renderApp({ linked: linkedAddons, route, user })` (`modules` is optional
  there); `mockStore` and `mockServer.use()` work as in feature tests. `app/routes.test.tsx`
  includes `linkedAddons`, so add the package's URLs to its cases.

## Module Federation rules

- `sharedDeps` in `packages/dashboard-sdk/src/federation.ts` is the single source of the shared
  config for shell and addons. Addons build with `oakestraAddon()` from
  `@oakestra/dashboard-sdk/vite`, which applies `withoutFallback(sharedDeps)` (`import: false`)
  and fixes the federation options (`./addon` expose, `remoteEntry.js`, manifest,
  `publicPath: 'auto'`). Addon source gets its name as `ADDON_ID` from `virtual:oakestra-addon`, so
  the definition id cannot drift from the federation name; the example's `vitest.config.ts` merges
  `vite.config.ts` so it resolves in tests (Module Federation switches itself off under Vitest).
- Anything holding React context or global state must be in `sharedDeps`. Import `@oakestra/ui`
  only from its root entry or the heavy-component subpaths listed below: other deep imports would
  bypass the share and duplicate component contexts.
- Import `RouterProvider` from `react-router`, not `react-router/dom`: the `/dom` entry bundles its
  own copy of the router contexts, which addons (sharing only `react-router`) would not see.
- `federation.ts`, `vite.ts` and `css-prefix.ts` are loaded by Node from `vite.config.ts`, so they
  import nothing browser-only and use explicit `.ts` extensions on relative imports.
- The `@oakestra/ui` ranges in `sharedDeps` are `^` plus the ui version resolved from the
  consuming project (`resolveUiVersion`), falling back to `UI_VERSION_FALLBACK` with a warning.
  `federation.test.ts` keeps the fallback equal to `packages/ui/package.json`: bump both together.
- The shell entry is `main.tsx` -> `import('./bootstrap')`. That async boundary is required; keep
  `main.tsx` free of other imports.
- Dev-only code (the addon override) sits behind `import.meta.env.DEV` so it is compiled out.
  `apps/shell/scripts/assert-prod-bundle.mjs` fails the build if it leaks into `dist/`.
- `window.__OAK_DEBUG__` exists only in images built with `VITE_OAK_DEBUG=true` (the compose dev
  stack). The e2e singleton test depends on it.

## Styling

The look is modern shadcn: an inset layout (the page is a white panel on the sidebar's tint), Geist,
a dark ink-teal primary. A screen in its normal state stays neutral, so that abnormal states are easy
to spot: use neutrals for content, `primary` only for interactive elements, and `warning` and
`destructive` only for abnormal states (`StatCard`'s `tone` colors the value for those two only). No
tinted icon boxes, gradients or uppercase eyebrow labels. Cards and panels get a hairline and at most
`shadow-xs`. Related `StatCard`s go in a `StatGroup`. Radius follows hierarchy: tags `rounded-sm`,
controls `rounded-md`, panels `rounded-lg`, overlays `rounded-xl`. `font-mono` is for real identifiers
and machine values only.

Collections are lists and cards, not tables: `DataList` with `Item`s or `Card`s (see "Shared
components"). `DataTable` stays public for addons, the dashboard's own pages do not use it.

The page scrolls inside the panel, where neither the browser nor react-router manage it:
`usePageScroll` (`app/layouts`) opens a new path at the top and restores the offset on back. It
ignores search params, which hold page state.

The account menu (`UserMenu`, with the theme picker) sits in the sidebar footer. The theme is a
preference of the account, so it has no place on the Settings page. The sidebar scrolls apart from
the page, and the page scrolls inside `SidebarInset` from the `md` breakpoint.

Fonts (Geist, Geist Mono) are self-hosted through `@fontsource-variable` packages imported in
`styles.css`, because an edge deployment may have no route to a font CDN. `theme.css` maps
`--font-sans`/`--font-mono` to the shell's `--font-ui`/`--font-code`, which addons pick up with the
theme import.

The shell imports `@oakestra/ui/styles.css` once, through `apps/shell/src/styles.css` (preflight,
token values, component utilities), which also adds `modules/*/src` as a Tailwind source: Tailwind
only detects classes below the Vite root, and linked module packages have no stylesheet or prefix
of their own. Keep that `@source` a file glob (`**/*.{ts,tsx}`); a glob ending in a directory
matches nothing, silently.
Addons import only `tailwindcss/theme.css`, `tailwindcss/utilities.css` and `@oakestra/ui/theme.css`
(see `addons/example/src/addon.css`). `theme.css` holds only the `@theme inline` mapping, never
values, so the shell stays the one owner of the variables.

Addon utilities carry a per-addon Tailwind prefix (`prefix(ex)` on the theme import, classes like
`ex:flex ex:md:hidden`, lowercase letters only). The addon stylesheet loads after the shell's in
the same layer, so an unprefixed `.hidden` in it (Tailwind also scans comments) would beat the
shell's responsive classes and hide the sidebar. A lower cascade layer for addons was rejected: the
shell's base utilities would then beat the addon's own variants on addon elements. Every class in
addon code and in doc samples gets the prefix, including `className` passed to `@oakestra/ui`
components. `oakestraAddon({ prefix })` fails `vite build` when an emitted CSS asset has a class
selector without the prefix (bare `.dark` exempt) and warns in dev; `prefix` must equal the one in
`addon.css`. An e2e test in `addon-runtime.spec.ts` applies the same rule to the deployed example.

To add a shadcn component: run `pnpm dlx shadcn@4 add <name>` in `packages/ui`, rewrite its
`@oakestra/ui/...` and `cn` imports to relative paths, drop any `next-themes` usage, and export it
from `packages/ui/src/index.ts`, and give it a story. `packages/ui` has its own vitest setup
(`pnpm --filter @oakestra/ui test`) for composites like `DataTable`.

Storybook (`pnpm storybook`, port 6006; `pnpm --filter @oakestra/ui build-storybook` writes
`packages/ui/storybook-static/`) shows every `@oakestra/ui` component with a light/dark switch,
autodocs and the a11y panel. Stories live in `packages/ui/stories/<group>/*.stories.tsx`, outside
`src/` on purpose: `styles.css` scans `src/components`, so story-only layout classes there would ship
in the shell's CSS (`.storybook/preview.css` adds `stories/` as a Tailwind source for Storybook only).
Stories import the public entries (`../../src`, `../../src/chart`, ...), never component files.
Rules: a docs page renders all stories of a file at once, so use `useId()` instead of fixed ids, and
tag stories that render an open modal with `tags: ['!autodocs']`. Keep docs previews inline:
`docs.story.inline: false` iframes do not get the theme global (the sidebar story contains its
position-fixed layout with a `transform` frame instead). CI builds it after `pnpm build`.

## Import boundaries

Enforced by `packages/eslint-config` (`eslint-plugin-boundaries` plus `no-restricted-imports`) and
covered by `packages/eslint-config/boundaries.test.js`:

- `addons/*` import only their own files, `@oakestra/dashboard-sdk`, `@oakestra/ui` and types from
  `@oakestra/api`. Addons ship as separate containers; anything else would not exist at runtime.
  `@oakestra/dashboard-sdk/testing` is allowed in addon `*.test.ts(x)` only, never in addon
  runtime code or shell production code; `@oakestra/dashboard-sdk/vite` only in addon
  `vite.config.ts` and `vitest.config.ts`.
- `modules/*` follow the addon rules (own files, SDK, `@oakestra/ui` root and subpaths, types of
  `@oakestra/api`, the SDK testing entry in tests), minus `@oakestra/ui/*.css`,
  `/federation` and `virtual:oakestra-addon`. They never import each other or the shell. Only the
  shell's `src/app` (and the tests in `src/linked`) import them.
- `features/*` use `core`, the shared `src/components` and `src/lib`, the packages and their own files; another feature only via its
  `index.ts`. `core` never imports features.
- `packages/ui` never imports the SDK, and the SDK never imports the shell or `ui` sources. The
  SDK may use `@oakestra/api` (for the `OakestraApi` type); `@oakestra/api` imports nothing
  internal.
- `@oakestra/mocks` and `src/test` are allowed in shell tests, `src/test` and `src/mock-api.ts`
  only. Production code importing them fails lint, and `scripts/assert-prod-bundle.mjs` fails the
  build if mock code reaches `dist/`.

## Docker and nginx

- Every upstream in `apps/shell/docker/nginx.conf.template` goes through a variable plus
  `resolver`, so nginx starts when the addons manager or addon containers are missing. A literal
  `proxy_pass http://host` reintroduces the startup failure.
- `index.html`, `config.json`, `mf-manifest.json` and the addon's `remoteEntry.js` are `no-cache`;
  only content-hashed `/assets/` are immutable.
- The entrypoint renders `config.json` from env. `API_URL` wins; `API_ADDRESS` (host:port, as used
  by the Angular dashboard) maps to `http://<API_ADDRESS>/api`. `GRAFANA_URL`, `MAP_STYLE_URL`, `MAP_STYLE_DARK_URL` and
  `ADDONS_MANAGER_URL` (`/addons-api`) and `MARKETPLACE_URL` (`/marketplace-api`) are config
  fields; `GRAFANA_URL` is optional and becomes an external nav link. `PRESET_URL` (empty: no
  preset; `/preset.json` for a mounted file) becomes `presetUrl`. nginx serves `/preset.json`
  (`no-cache`) and `/bundled-addons/<name>/` from the html
  root (only `assets/` is immutable, everything else `no-cache` plus `frame-ancestors 'none'`), where derived images copy a preset and addon `dist/` folders.
- `/addons-api/*` and `/marketplace-api/*` are rewritten by nginx to `/api/v1/addons/*` and
  `/api/v1/marketplace/addons/*` of the upstreams below (`no-store`, 502 while they are missing).
- Those two and `/ui-addons` serve backend bodies on the dashboard origin, and the addons-manager
  sends unescaped user strings (addon names, monitor logs) as `text/html`. They therefore carry
  `Content-Security-Policy: default-src 'none'; sandbox`, `Content-Disposition: attachment` and
  `X-Content-Type-Options: nosniff`, so opening `/addons-api/<id>` in a tab cannot run script next
  to the refresh token in localStorage (fetch ignores all three). `add_header` in a location
  replaces the server-level ones, so every location repeats the full set; `nginx-headers.test.ts`
  and `e2e/tests/proxy-headers.spec.ts` check it. The Vite dev proxies add the same headers
  (`apps/shell/dev-proxy.ts`). `index.html` only gets `frame-ancestors`, `base-uri`, `object-src`
  and `form-action`: a `default-src` policy would have to include the API, Grafana and tile origins
  from the runtime `config.json` and the `/addon-assets` remotes, which nginx cannot know.

  | env                      | default                     | meaning                                  |
  | ------------------------ | --------------------------- | ---------------------------------------- |
  | `ADDONS_MANAGER_ADDRESS` | `root_addons_manager:11101` | upstream of `/ui-addons`, `/addons-api/` |
  | `MARKETPLACE_ADDRESS`    | `marketplace_manager:11102` | upstream of `/marketplace-api/`          |

- In the compose stack the dashboard's `API_URL` points at `tools/mock-system-manager` on host port
  10010 (the browser calls the API directly). The e2e fixtures log in by seeding a refresh token
  (`loggedInAs` option, default `Admin`) and reset both mocks around every test.

## Versions

- TypeScript stays on 6.0.x: typescript-eslint 8 supports `<6.1`.
- ESLint stays on 9: eslint-plugin-jsx-a11y supports only up to 9.
- React Router is v8 (data mode). v8 removed `react-router-dom`; everything comes from
  `react-router`.
- pnpm 12 refuses install scripts that are not listed in `allowBuilds` (pnpm-workspace.yaml) and
  holds back very fresh releases (`minimumReleaseAgeExclude`).
- MSW is v3: unhandled requests are configured with `onUnhandledFrame` (not
  `onUnhandledRequest`), and `msw/vite` serves the worker script in `dev:mock` mode.
- `packages/api`, `packages/mocks` and `tools/*` run under plain Node (type stripping): relative
  imports need explicit `.ts` extensions and only erasable TypeScript syntax is allowed.
- tsdown 0.23 (rolldown, like Vite 8) builds the public packages unbundled, one file per source
  file. API Extractor 7.60 bundles TS 6.0.3. The package tsconfigs set `stableTypeOrdering`,
  otherwise TS 6 prints inferred unions in varying order and the API reports flap.
- `@types/geojson` is a dependency (not a devDependency) of `@oakestra/ui` because `map.d.ts`
  references it.

## Backend quirks (system-manager)

Checked against a real system-manager; the mocks reproduce them.

- Most responses have no schema in the OpenAPI spec, so `paths` types say little about responses;
  the Zod models are the source of truth. Request bodies are typed by the models too (the spec
  documents `organization` for login, the backend reads `organization_name`).
- Error bodies vary: `{message}`, `{msg}` (JWT errors, 401 or 422), `{code, status}` (the message
  is lost) or plain strings. `ApiError.message` normalizes them.
- `GET /applications/{userId}` takes the user's `_id` (not the name) and answers a mismatch with
  401, not 403. `GET /user/{name}` and `GET /permission/{name}` only work for the caller (403).
  `PUT /user/{name}` is Admin only, even for one's own email. `/users/` returns password hashes
  and also password reset token documents (dropped by the model).
- `POST /service/` answers 200 even when services failed: `deployed_services` and
  `failed_services` are `{service_name, status, message?}` objects (no ids), and `job_id` is the
  last inserted service, which may be one that was rolled back. A service whose round-robin IP
  is already allocated (net-manager) fails with a message; a copy must therefore not carry the
  original's `rr_ip`/`RR_ip`. Unikernel services need `arch` (e.g. `["amd64"]`), otherwise the
  backend raises a KeyError (500); containers never read it.
- A new instance request sets the service to `REQUESTED` at once but adds the instance to
  `instance_list` only after scheduling, so "no instances" does not mean "nothing requested".
- `PUT /service/{id}` returns 501 "Not implemented"; editing a service is not possible yet.
- addons-manager (11101, `/api/v1/addons`) and marketplace-manager (11102,
  `/api/v1/marketplace/addons`) do not authenticate requests (CORS only), so the Admin-only addon
  pages are a convenience, not a security boundary, until both verify the Oakestra JWT. The shell
  sends the bearer token anyway. The addons-manager returns `json.dumps(...)` strings (Content-Type
  `text/html`), the marketplace real JSON. `POST /addons` is 400 if the definition is installed
  (installing unapproved ones works), 500 for an unknown marketplace id. `DELETE /addons/<id>`
  only moves a not yet `disabled` addon to `disabling` (200 with the addon); a `disabled` one is
  deleted (204); one stuck in `installing` can be sent to `disabling` too. A path id that is
  not an ObjectId is an unhandled exception in both backends (500 HTML). The marketplace list
  shows approved definitions only; its schema rejects unknown fields with a flask-smorest 422
  (`{code, status, errors: {json: {ui: ["Unknown field."]}}}`, nested as `services.0.image`) and
  does not return `ui`. The `ui` block (`{service, sdk}`) and `GET /ui-addons` are planned, the
  models treat `ui` as optional. The monitor only sees a container crash on a later 30s loop
  (one restart first): an install goes `installing` -> `active` (`docker run` is detached), and
  `failed` / `partially_active` with logs follows 30-90s later. A failure while installing is
  `failed` with `status_details: {}` and no logs.
- The token's `organization` claim is an organization id, the root organization's id when the
  user logged in without one (never the string "root"). Use it as the SLA `customerID`.
- Cluster figures are sums over the workers, not capacities: `memory_in_mb` is the memory still
  AVAILABLE (summed `mem.Available`, not the installed total), `memory_percent` the mean usage
  (so "X% of Y" is wrong), and `vcpus` the total core count. The root scheduler's cluster filter
  checks only virtualization, `vcpus`, memory, a direct constraint and CSI drivers; the
  placement explanation (`modules/applications/src/services/placement.ts`) replays exactly that
  and lists everything else as not evaluated. Passing means "not ruled out", never "will run".
- A cluster's `active` is computed by the backend on every read. `clusterReportState(cluster)`
  (`@oakestra/api`) tells `reporting` from `silent` (stopped reporting, keeps last-known values,
  shown stale and never counted in capacity) and `never-reported` (no `last_modified_timestamp`,
  no values). `modules/infrastructure/src/lib.ts` is the one place that maps it to presentation;
  silent is abnormal but not an error, so it is neutral and hatched, not red. A failed placement
  can sit only on an instance (`NO_WORKER_CAPACITY`), see `placementFailureStatus`.
- Instance metrics are numeric strings, instance history uses ISO timestamps, cluster history
  epoch seconds; `memory_percent` of instances holds bytes. The models normalize all of it.
- `/clusters/active` repeats `virtualization` entries per node (deduplicated by the model).
  `/clusters/` and `/clusters/active` need no token.
- Password reset emails link to `http://<host>/resetPassword/<token>`; the shell redirects that
  path to `/reset-password/:token`.

## Command palette

"Find or run anything" (Ctrl or Cmd K, and a button in the header) is `app/layouts/CommandPalette.tsx`
plus `app/layouts/command-palette/`. Its contract (`command.actions`, `command.sources`,
`CommandContext`) is in the SDK (`extension-points.ts`) and `docs/addons/reference.md`.

- The shortcut and button are on every page, the dialog body is `React.lazy` because it pulls in
  cmdk. It sits in its own error boundary. The shortcut does nothing while another modal is open.
- cmdk's `vimBindings` stays `false`: it is on by default and turns Ctrl+K into "move up", the
  key that closes the palette. `shouldFilter` is also `false`: matching is `match.ts`, so the
  order of groups and rows is ours. Source groups come last, so arriving results never move the
  selected row.
- Sources run through `useQueries` (`use-source-search.ts`: 150 ms debounce, `signal` from
  TanStack Query, short `gcTime`). `results.ts` caps a source at 20 results, gives `search` 5 s
  (`SEARCH_TIMEOUT_MS`, settled even when the source ignores `signal`), and validates every result
  with Zod: one bad result is dropped with a console warning, a non-array fails the source.
  A failing source shows a status line and never affects the others. Action definitions are
  validated at load in `core/addons/definition.ts` (path XOR run, relative, no `..`).
- `ctx.navigate` accepts absolute app paths only (`isAppPath`, so no other origin). An addon's
  `ctx.addon.path` is `buildAddonPath` with its base path. Built-in sources read the same query
  cache as the pages (`modules/applications/src/search.ts`: Admins read `allApplicationsQuery` and
  `allServicesQuery` but keep only their own applications, because detail pages are owner-scoped
  and anyone else's would open on a 404; others use `applicationsQuery`;
  `modules/infrastructure/src/search.ts`) through
  `ensureQueryData` with `revalidateIfStale` and `meta.silent`, so typing is answered from the
  cache and a failed refresh does not toast.
- "New application" opens `/applications?new=1`, which the applications page turns into its
  create dialog (`useSearchParam('new')`), so it works from any page.
- Remote addon entries carry a `SourceTag` (`SlotSource.remote`, `displayName`, `version`, filled
  by the registry; the SDK testing host takes them as `contributionSource`). Packages built into
  the dashboard are of kind `addon` but not remote, so `kind` alone cannot tell them apart.
- `useContributions` is used by the palette to read both points, the same way as for `nav.items`.

## Failures the shell shows

- `ContributionBoundary` renders a failed contribution inline, without a frame (it sits in cards,
  tab panels and bare pages): message, **Reload** (resets the boundary) and a collapsed error
  text. A chunk load error (`chunk-load-error.ts`) offers **Reload page** instead, because the
  boundary cannot download the code again.
- `app/layouts/AddonIssuesNotice.tsx` tells Admins (with the addon manager enabled) about remote
  addons that are `failed` for 30 s (`ADDON_ISSUE_GRACE_MS`, the container of a new install fails
  its first loads) or `incompatible` at once. Dismissals live in `sessionStorage` keyed by name,
  version and state. Linked packages never show up.

## Demo data

`packages/mocks/src/scenarios.ts` has `withPlacementDemo`, a `customize` function for
`createMockStore` that adds clusters (one silent, one never reported), instances and unplaced
services for the Fleet view and the placement panel. It is not in `backend.json` because unit
tests count the seed. `pnpm dev:mock` (`apps/shell/src/mock-api.ts`) always uses it, the HTTP
mock only with `PLACEMENT_DEMO=true` (`tools/mock-system-manager`). Ids are fixed and
timestamps relative to when the store is built.

## Mock addons manager

`tools/mock-addons-manager` serves the shared `@oakestra/mocks` addon backend (also behind the MSW
handlers `createAddonsHandlers`, `mockAddons` in unit tests) on one port: `/api/v1/addons`,
`/api/v1/marketplace/addons` and `/api/v1/ui-addons` (active installed addons whose definition has
a `ui` block). Installs go `installing` -> `active` after `INSTALL_DELAY_MS` (default 1500, compose
500), removals `disabling` -> `disabled`. `flaky-addon` and `broken-addon` go `active` first and
turn `partially_active` / `failed` (with `status_details` and `logs`) `MONITOR_DELAY_MS` later
(default 4000), like the real monitor; `install-error-addon` goes `failed` at once with `{}` and
no logs. Marketplace behavior follows the real one: unknown fields (including `ui`) are a 422,
responses never contain `ui`, non-ObjectId ids are a 500, and PATCH is a plain `$set` (it keeps
`status_details` and `logs`). The `uiBlockSupport` backend option (`UI_BLOCK_SUPPORT=true` for
the HTTP mock, set by the compose file and the shell's unit-test setup) stands in for the planned
backend: it accepts and returns `ui`, keeps the `ui` block of the `example` seed and thereby
`/ui-addons`. Without it the seed has no `ui` anywhere. Seed: `example` (ui block, installed, active),
`analytics` (partially_active), `legacy-exporter` (failed) installed; `flops`, `flaky-addon`,
`broken-addon`, `install-error-addon` installable; `community-tool` (under_review) and `rejected-addon`
(verification_failed) reachable by id only, like the real list that shows approved ones.

The `/__test` API predates the two backends and maps onto them: `PUT /__test/addons/<name>`
`{enabled?, version?, sdk?}` installs and activates (`enabled: true`) or sets `disabled`
(`enabled: false`) at once, `sdk` edits `ui.sdk` of the definition, `version` is only reported by
`/ui-addons`; unknown names get a definition with a ui block. Also `GET /__test/addons|state`,
`DELETE /__test/addons/<name>`, `PUT /__test/config {installDelayMs, disableDelayMs, reviewDelayMs, monitorDelayMs}`
and `POST /__test/reset` (keeps the delays).

## Addon manager

`features/addon-manager` (Admin only, one nav item "Addons", its page tabs are the only switch between the two) has two real routes under `/addon-manager`:
`installed` (DataTable, detail sheet, disable then remove, "Dashboard UI" column from the addon
registry showing `addonLabel(entry)`, the definition's `label` once loaded, plus a section for registry UIs without an installed record such as dev overrides) and
`marketplace` (card grid, install, register, delete a definition). `/addon-manager` and the old
`/settings/addons` redirect to `installed`; the prefix is not `/addons` because `/addons/:addonId/*`
belongs to addon pages. The installed query polls every 2.5s while an addon is installing or
disabling and every 10s otherwise (while the tab is visible), because the monitor reports crashes
of already `active` addons later. After 2 minutes in `installing` or `disabling` on the page
(`STUCK_AFTER_MS`; records have no timestamps) fast polling stops and an install offers "Disable
anyway", with a warning that a monitor mid-install may overwrite the status. A failed background
poll keeps the table and shows a banner (the query is `silent`, no toast per poll). The layout
calls `refreshUiAddons` when an addon becomes or stops being `active`. Disable reads the addon
first and does not send DELETE for one that is already `disabled` (the backend would delete it);
a 404 on remove counts as removed. A definition registered from the page starts `under_review` and is
not listed yet, so `useReviewOutcomes` (in the layout) polls it by id (`marketplace.get`) until it
is `approved` or `verification_failed`, then refetches the marketplace and toasts the result; it
polls every `REVIEW_POLL_MS`, and less often after `REVIEW_SLOW_AFTER_MS`, because a real review
pulls every image. Environment values are never rendered, only their names.
Marketplace 422s are flattened by `messageFromErrorBody` into `ui: Unknown field.`; the register
dialog never shows JSON.parse's message, which quotes the pasted text, only line and column.

E2E: compose sets `ADDONS_POLL_INTERVAL_MS=1000`, which would mask a missing `refreshUiAddons`,
so addon-manager tests serve a `config.json` with a one hour interval (`withoutUiAddonsPolling`)
and wait for the `/ui-addons` request. Their timeouts are the configured backend delay plus one
shell poll plus slack.

## Conventions

- Plain hyphens only: no em or en dashes anywhere, including comments and docs.
- Comments explain why (decisions, invariants, traps), written for the next developer.
- Leave git staging and commits to the user.
