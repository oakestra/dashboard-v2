# Oakestra Dashboard v2

React shell that loads addon UIs at runtime through Module Federation.

## Layout

- `apps/shell`: the host. `src/core/*` is the platform (config, auth, API client, query client,
  theme, extension registry, addon runtime), `src/features/<name>` are built-in feature modules,
  `src/app` wires them together, `src/test` holds the test helpers.
- `packages/dashboard-sdk`: the public, semver'd contract addons build against. Entries: the root,
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
- `e2e`: Playwright suite against `docker-compose.dev.yml`.
- `docs`: documentation for people, linked from `README.md`: the demo walkthrough (`demo.md`) and
  the addon developer guide (`addons/`). Keep `docs/addons/` in sync with changes to the SDK,
  extension points, addon loading or packaging, and `docs/demo.md` with the compose stack and the
  example addon. Screenshots live in `docs/images/`.

## Verify a change

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass. For anything touching addon
loading, nginx, Docker or the SDK, also run the e2e suite:

```sh
docker compose -f docker-compose.dev.yml up --build -d
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
  `<Slot point="..." />`. New points are an SDK minor bump; renames or incompatible context
  changes are a major bump.
- The shell's Settings page (`features/settings`) is for the dashboard's own settings and has no
  extension point. Addons put their settings on their own page, linked as a nav sub-item; core
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
  single owner. `applications/:appId` belongs to the applications module; the services and SLA
  features export plain `RouteObject` arrays (`createServiceRoutes`, `newServiceRoutes`,
  `duplicateServiceRoutes`) that it nests, and have no `CoreModule` of their own. Never declare a
  second `applications/:appId` object: which one matches then depends on module order.
  `app/routes.test.tsx` builds the router from the real `coreModules` and checks every URL.
- **Route options:** `handle: { crumb: 'Label' } satisfies RouteHandle` (or a function of the
  match) feeds the breadcrumbs; `loader: requireRole('Admin', ...)` restricts a page (403 page
  inside the layout). Hide the nav item with `roles` on the contribution as well.
- **Nav:** `contributions: { 'nav.items': [{ id, label, path: '/x', icon, group, order, roles }] }`
  with `group` `main`, `management`, `addons` or `footer` (pinned to the bottom, Help and
  Settings). `children: [{ id, label, path, order, roles }]`
  nests sub-items (one level only, see `app/layouts/nav-model.ts`); the one link with the longest
  matching path is highlighted, so a parent and its sub-item are never active together.
- **Data:** components get the API with `useOakestraApi()` from the SDK, exactly like addons, and
  never build URLs. Responses are already parsed by `@oakestra/api` models; failures are
  `ApiError`s with a readable `message` (use `describeError()` from `core/api/errors`, a
  re-export of the one in `@oakestra/api`, which the SDK also exports for addons).
- **Query keys:** one factory per feature, rooted at the feature id, and `queryOptions` factories
  that pages, prefetches and tests share. Another feature's keys are imported through its
  `index.ts` only, with one exception: a dependency-free `features/<name>/keys.ts` holding the key
  factory (re-exported from `index.ts`), for features that invalidate each other's caches. It
  keeps those imports from forming a cycle through the `index.ts` files (applications nests
  services routes while services invalidates application keys). Clusters have one shared query,
  `clustersQuery` from `infrastructure`; overview, services and SLA use it instead of their own.
  Users and organizations list each other's data, so mutations on either invalidate both
  `userKeys.all` and `organizationKeys.all`. Loaders that `ensureQueryData` a detail spread
  `seedFromLists(queryClient, keys.lists(), match)` (`core/query/seed-from-lists.ts`) into the
  options, so coming from a list does not wait for a round trip (applications and services).

  ```ts
  export const appKeys = {
    all: ['applications'] as const,
    list: (userId: string) => [...appKeys.all, 'list', userId] as const,
    detail: (id: string) => [...appKeys.all, 'detail', id] as const,
  };
  export const appQuery = (api: OakestraApi, id: string) =>
    queryOptions({
      queryKey: appKeys.detail(id),
      queryFn: ({ signal }) => api.applications.get(id, { signal }),
    });
  ```

- **Confirm dialogs:** `ConfirmDialog` closes in `onSettled` (also on failure, the mutation toasts
  the error); forms close in `onSuccess` so the input survives a failure.
- **Mutations:** a hook per action in `api/mutations.ts`. Set `meta.errorMessage` (toast title;
  the global MutationCache toasts every failure) or `meta: { silent: true }` when the component
  shows the error itself (forms). In `onSuccess`, `await queryClient.invalidateQueries(...)` with
  the narrowest key that covers what changed, and `notify.success(...)`.
- **Errors in pages:** render loading and error states inline (`isPending`, `isError` with a
  retry). The QueryCache only toasts when a refetch fails while data is shown; `meta.silent`
  disables that too.
- **Forms:** React Hook Form + `zodResolver(schema)` with `Field`/`FieldLabel`/`FieldError` from
  `@oakestra/ui`. Reuse `@oakestra/api` schemas where they exist (`loginRequestSchema`,
  `slaV2Schema`). Submit with `onSubmit={(event) => void form.handleSubmit(onValid)(event)}`.
- **Slots:** render extension points with `<Slot point="..." context={...} />` from
  `core/extensions/Slot` (optional `render` wrapper and `empty` state). Each contribution is
  isolated in its own error boundary.
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

Cross-feature presentational components live in `apps/shell/src/components`, helpers in
`apps/shell/src/lib`. Features may import both (never the other way round); anything that knows
about a single feature stays in that feature. Generic building blocks without shell knowledge go
in `@oakestra/ui` instead.

`@oakestra/ui` (import from the package root, except the subpath exports below):

**Rule:** heavy optional components (anything that pulls in a large third-party library) go in a
subpath export, not the root index. Every page loads the root module, because it is an eager
Module Federation singleton. A subpath needs a `src/<name>.ts` entry, an `exports` entry in
`packages/ui/package.json`, a `sharedDeps` entry in `packages/dashboard-sdk/src/federation.ts` and
a `!@oakestra/ui/<name>` exception in the addon import restrictions of `packages/eslint-config`,
plus the entry in `packages/ui/tsdown.config.ts` and `publishConfig.exports`; `pnpm api:update`
then creates its report.
Each is then a separate lazily fetched chunk, shared with addons. Subpath chunks bundle their own
copy of small stateless pieces (`cn`, `Button`, `Table`), which is harmless.

- `@oakestra/ui/chart`: `ChartContainer`, `ChartTooltip(Content)`, `ChartLegend(Content)` on
  Recharts 3, plus the Recharts parts (`LineChart`, `AreaChart`, `BarChart`, `XAxis`, ...)
  re-exported so features never import `recharts` themselves.
- `@oakestra/ui/data-table`: `DataTable`, `createDataTableColumnHelper`, types (see below).
- `@oakestra/ui/command`: the cmdk-based `Command*` components.
- `@oakestra/ui/map`: mapcn (`Map`, `MapMarker`, `MarkerTooltip`, `MapGeoJSON`, `MapControls`,
  `useMap`, ...) on MapLibre GL with CARTO light/dark basemaps that follow the `.dark` class. Two
  local changes to upstream `components/map.tsx`, keep them when updating it: the worker URL comes
  from `setMapWorkerUrl()` instead of unpkg, and the theme comes from the `.dark` class only (no
  OS fallback). The shell's `bootstrap.tsx` imports `maplibre-gl/dist/maplibre-gl-worker.mjs?url`
  and registers it; never move that `?url` import into `packages/ui`, because Vite's dev
  pre-bundler (which handles the federated shared packages) cannot load `?url` and `pnpm dev`
  dies. The URL is kept on `globalThis` because the root export and the map subpath are separate
  shared modules with their own module state.

- shadcn primitives: accordion, alert-dialog, checkbox, collapsible, pagination,
  popover, progress, scroll-area, select, switch, tabs, textarea, toggle, toggle-group, tooltip,
  sheet, separator, skeleton, plus the older ones (button, card, dialog, field, ...).
- `DataTable` (subpath `@oakestra/ui/data-table`): TanStack Table v9 with sorting, global text filter, pagination, `onRowClick`,
  `emptyState`, `isLoading` skeleton rows and a `toolbar` slot. Build columns with
  `createDataTableColumnHelper<Row>()`. `globalFilter`, `sorting` and `pagination` are
  uncontrolled unless the value and its `on...Change` handler are passed, which is how to mirror
  them into URL search params. Numeric columns sort descending on the first click (TanStack
  default). Column `meta: { numeric: true }` right-aligns with tabular figures (`align`,
  `className`, `headerClassName` also exist).
- `EmptyState` (icon, title, description, action), `PageHeader` (title, description, actions),
  `ConfirmDialog` (`destructive`, `pending`; the caller closes it when the mutation settles).
- `StatusBadge` (`tone`, `dot`, `icon`, `pulse`) and `StatusDot`: soft status labels. Tones are
  meanings, not backend states: `success` healthy, `warning` degraded, `info` in progress,
  `destructive` failed, `neutral` inactive or unknown. Features map their states onto tones in one
  place each; never pick colors per page.
- `StatCard` (`label`, `value`, `icon`, `hint`, `tone`, `loading`, `href`/`onClick`, or `asChild`
  with a router `Link`): metric tile that fills its grid cell.
- `SectionCard` (`title`, `description`, `action`, `headingLevel`, `flush`, `footer`): a titled
  page section, action top right. With plain `Card`, put actions in `CardAction` inside
  `CardHeader` (a grid; `flex-row` on it does nothing).

`apps/shell/src/components`:

- `LocationMap`: lazy map (mapcn on MapLibre, `@oakestra/ui/map`) of `{ lat, lng, radiusKm?, label }[]`. Build entries with
  `toMapLocation(name, parseClusterLocation(cluster.cluster_location))`. `LazyLocationMap` is the
  bare `React.lazy` component for callers with their own Suspense. Without WebGL2 it shows a
  notice instead of the map.
- `TimeSeriesChart`: line or area chart of `{ timestamp: Date, value: number }[]` with `unit`
  (`percent`, `bytes`, `number` or a formatter) and an accessible `title`.
- `CopyButton`, `JsonViewer` (pretty-printed, collapsible, copy, optional `downloadAs`).
- `QueryErrorAlert` (`title`, `error`, `onRetry`, optional extra text as children): the inline
  error state of a failed query, with a "Try again" button. Use it instead of building the alert.

`apps/shell/src/lib`: `format.ts` (`formatBytes`, `formatMegabytes`, `formatPercent`,
`formatRelativeTime`, `plural`, `parseLegacyDate`/`formatLegacyDate`), `download.ts`
(`downloadJson(filename, data)`, `downloadText`), `use-search-param.ts` (`useSearchParam(key,
fallback)`, one search param as state, replacing the history entry) and `zod-issues.ts`
(`formatIssue`, Zod issues worded for people who write JSON by hand).

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

The shell imports `@oakestra/ui/styles.css` once (preflight, token values, component utilities).
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
  by the Angular dashboard) maps to `http://<API_ADDRESS>/api`. `GRAFANA_URL` and
  `ADDONS_MANAGER_URL` (`/addons-api`) and `MARKETPLACE_URL` (`/marketplace-api`) are config
  fields; `GRAFANA_URL` is optional and becomes an external nav link.
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
- Instance metrics are numeric strings, instance history uses ISO timestamps, cluster history
  epoch seconds; `memory_percent` of instances holds bytes. The models normalize all of it.
- `/clusters/active` repeats `virtualization` entries per node (deduplicated by the model).
  `/clusters/` and `/clusters/active` need no token.
- Password reset emails link to `http://<host>/resetPassword/<token>`; the shell redirects that
  path to `/reset-password/:token`.

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

`features/addon-manager` (Admin only, nav "Addons") has two real routes under `/addon-manager`:
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
a 404 on remove counts as removed. Environment values are never rendered, only their names.
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
