# SDK reference

This page describes `@oakestra/dashboard-sdk` (version `0.1.0`) as an addon author uses it. The
source is in `packages/dashboard-sdk/src`. For a guided introduction, start with the
[tutorial](README.md#tutorial-build-your-first-addon-ui).

Class names in the examples carry the example addon's Tailwind prefix (`ex:text-sm`). Use your
addon's own prefix, see [styling](packaging.md#styling).

Contents:

- [The addon definition](#the-addon-definition)
- [Extension points](#extension-points), including the [command palette](#command-palette-commandactions-commandsources)
- [Hooks and helpers](#hooks-and-helpers)
- [The API client](#the-api-client)
- [Users and roles](#users-and-roles)
- [Data fetching rules](#data-fetching-rules)
- [`@oakestra/ui`](#oakestraui)
- [What an addon may import](#what-an-addon-may-import)
- [Other exports](#other-exports)

## The addon definition

### `defineAddon(definition)`

```ts
function defineAddon<const D extends AddonDefinition>(definition: D): D;
```

Declares the addon. It returns its argument unchanged; it exists for type checking and editor
completion. The object must be the **default export** of the module your build exposes as
`./addon` (in the example: `src/index.tsx`).

### `AddonDefinition`

| Field           | Type                    | Description                                                                                                                             |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `string`                | Required. Must equal the addon name in `/ui-addons`, which is also the Module Federation `name`.                                        |
| `label`         | `string`                | Optional. Human-readable name of the addon's UI, shown as the first breadcrumb of its pages and in the addon manager. Defaults to `id`. |
| `routes`        | `readonly AddonRoute[]` | Optional. Pages below `/addons/<id>/`.                                                                                                  |
| `contributions` | `Contributions`         | Optional. Items per extension point, see [Extension points](#extension-points).                                                         |

### `AddonRoute`

| Field       | Type                                       | Description                                                                                                                                                         |
| ----------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`      | `string`                                   | Relative to the addon base path. Must not start with `/`. Omit it for an index route.                                                                               |
| `index`     | `boolean`                                  | `true` for the index route (the page at `/addons/<id>`).                                                                                                            |
| `Component` | `ComponentType`                            | The page component. Without one, the route renders its children.                                                                                                    |
| `children`  | `readonly AddonRoute[]`                    | Nested routes. The parent component renders them with `<Outlet />` from `react-router`.                                                                             |
| `roles`     | `readonly Role[]`                          | Optional. Only users with at least one of these roles may open the route and its children; others get the shell's "Access denied" page. Empty or missing: everyone. |
| `crumb`     | `string \| ComponentType<AddonCrumbProps>` | Optional. Breadcrumb of the route, linking to its matched path: a label, or a component that renders one (see below). Routes without one add no breadcrumb.         |
| `fullWidth` | `boolean`                                  | Optional. `true` lets the page fill the width next to the sidebar instead of the shell's centered column. Inherited by children; a child can set `false` again.     |

How addon routes behave:

- The shell renders them with React Router's `useRoutes()` below `/addons/<id>/*`. They are not
  part of the shell's data router, so **there are no loaders, actions or `lazy` fields**. Fetch
  data with TanStack Query inside the component.
- Paths use React Router syntax: `clusters/:clusterId`, `*`, and so on. Read parameters with
  `useParams()` from `react-router`.
- A URL below your base path that matches none of your routes shows a "Page not found" message
  from the shell.
- `React.lazy()` components work as `Component`: the shell wraps addon pages in a `Suspense`
  boundary (it shows a skeleton while loading).
- The breadcrumb trail is `Home`, then the addon's `label` (its `id` while the addon is loading,
  failed or has no label), then the `crumb` of every matched route that has one, outermost first.
  On `/addons/flops/jobs/7` with the routes below, that is `Home > FLOps > Jobs > Job`.
- A `crumb` component shows a label that depends on the URL, such as the name of the cluster a
  page is about. It gets `{ params }` (the matched route params) and renders in the header, not
  inside your page, so it fetches on its own, typically with the same query the page uses (one
  cache entry, no extra request). The SDK hooks work in it. While it suspends or after it throws,
  the crumb shows the last path segment.

  ```tsx
  function ClusterCrumb({ params }: AddonCrumbProps) {
    const { data } = useQuery({
      ...clustersQuery(useOakestraApi()),
      select: (clusters) => clusters.find((c) => c._id === params.clusterId)?.cluster_name,
    });
    return data ?? params.clusterId;
  }
  // { path: 'clusters/:clusterId', crumb: ClusterCrumb, Component: ClusterPage }
  ```

- `roles` on a route is checked by the shell against the current user. It also guards every child
  route, and a child can restrict further. A denied page shows the same "Access denied" page as
  core pages; the sidebar and breadcrumbs stay. For a denied child, it appears in the parent's
  `<Outlet />`. See [Users and roles](#users-and-roles).
- Pages share the shell's centered column (at most `80rem`, Tailwind's `max-w-7xl`) by default.
  Set `fullWidth: true` on a route whose page is mostly a canvas, an editor or a split view to
  give it the whole width next to the sidebar. The deepest matched route that sets `fullWidth`
  decides, so it applies to children unless they set it too. Shells older than this field ignore
  it, so the page still works there, just in the centered column.

Nested routes and a lazy page:

```tsx
import { defineAddon } from '@oakestra/dashboard-sdk';
import { PageHeader } from '@oakestra/ui';
import { lazy } from 'react';
import { Outlet, useParams } from 'react-router';

function JobsLayout() {
  return (
    <div className="ex:space-y-4">
      <PageHeader title="Jobs" />
      <Outlet />
    </div>
  );
}

function JobList() {
  return <p>All jobs</p>;
}

function JobDetail() {
  const { jobId } = useParams();
  return <p>Job {jobId}</p>;
}

// Loaded on first visit. The shell wraps addon pages in a Suspense boundary.
const ReportsPage = lazy(() => import('./ReportsPage'));

export default defineAddon({
  id: 'flops',
  label: 'FLOps',
  routes: [
    { index: true, Component: JobList },
    {
      path: 'jobs',
      crumb: 'Jobs',
      Component: JobsLayout,
      children: [
        { index: true, Component: JobList },
        { path: ':jobId', crumb: 'Job', Component: JobDetail },
      ],
    },
    // Administrators only, including a URL typed by hand.
    { path: 'reports', crumb: 'Reports', roles: ['Admin'], Component: ReportsPage },
  ],
});
```

### Validation

The shell validates every loaded definition with Zod before it registers anything. If validation
fails, the addon gets the state `failed` and nothing of it is shown. It is rejected when:

- the module has no default export object,
- `id` is missing, empty or differs from the name in `/ui-addons`, or `label` is set but empty,
- a route `path` starts with `/`, or `Component` is not a React component (a function or a
  `memo`/`lazy`/`forwardRef` object; a JSX element is not caught here and fails when it renders),
- a route's `roles` is not a list of strings, its `crumb` is neither a non-empty string nor a
  React component, or its
  `fullWidth` is not a boolean,
- a contribution misses a required field (`id`, `label`/`title`, `component`, `path`), or a field
  has the wrong type (for example `order` that is not a finite number),
- two contributions **to the same extension point** have the same `id`,
- a nav item `path` is absolute (`/x`) or a URL (`https:...`),
- a command action sets both or neither of `path` and `run`, or its `path` is absolute or leaves the
  base path with `..`.

Contributions to an **unknown extension point** do not fail the addon. They are dropped with a
console warning (`[addons] <id>: ignoring unknown extension points`). This happens when an addon
uses a point that a newer SDK added but the running shell does not know.

## Extension points

`contributions` maps an extension point id to a list of items:

```ts
type Contributions = {
  readonly [P in ExtensionPointId]?: readonly ExtensionPoints[P][];
};
```

| Point id                  | Item type                 | Context props                  | Rendered at                                                                                                               |
| ------------------------- | ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `nav.items`               | `NavItem`                 | none (not a component)         | Sidebar                                                                                                                   |
| `home.widgets`            | `Widget`                  | `{}`                           | Overview page `/`: summary row, sections or widget grid, by [`size`](#widget-sizes-on-the-overview)                       |
| `application.detail.tabs` | `Tab<ApplicationContext>` | `{ applicationId }`            | `/applications/:appId`, tab list after "Services"                                                                         |
| `service.detail.tabs`     | `Tab<ServiceContext>`     | `{ applicationId, serviceId }` | `/applications/:appId/services/:serviceId`, tab list after "JSON"                                                         |
| `cluster.widgets`         | `Widget<ClusterContext>`  | `{ clusterId }`                | `/infrastructure/clusters/:clusterId`, bottom of the page (only `Admin` and `Infrastructure_Provider` can open this page) |
| `command.actions`         | `CommandAction`           | none (not a component)         | The "Find or run anything" palette (Ctrl or Cmd K), see [below](#command-palette-commandactions-commandsources)           |
| `command.sources`         | `CommandSource`           | none (not a component)         | The same palette, as a group of live search results                                                                       |

The ids are also exported at runtime as `EXTENSION_POINT_IDS`.

### Fields shared by all items (`ContributionBase`)

| Field   | Type              | Description                                                                                      |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `id`    | `string`          | Required. Unique within your addon **for this point**. The same id may be used at another point. |
| `order` | `number`          | Optional. Lower comes first. Items without `order` come after all items with one.                |
| `roles` | `readonly Role[]` | Optional. Only users with at least one of these roles see the item. Empty or missing: everyone.  |

Ordering: items are sorted by `order`. Items with the same `order` (or without one) keep the order
in which their source was registered: built-in modules first, then addons in the order they
finished loading. Built-in tabs such as "Services" or "Overview" are fixed parts of their page
and always come first.

### `NavItem` (`nav.items`)

| Field      | Type                                             | Description                                                                                              |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `label`    | `string`                                         | Required. Link text.                                                                                     |
| `path`     | `string`                                         | Required. **Relative** to the addon base path. `''` is the index route, `'jobs'` is `/addons/<id>/jobs`. |
| `icon`     | `ComponentType<IconProps>`                       | Optional. Receives `className`. Lucide icons (`lucide-react`) fit.                                       |
| `group`    | `'main' \| 'management' \| 'addons' \| 'footer'` | Optional. Addon items default to `'addons'`.                                                             |
| `children` | `readonly NavSubItem[]`                          | Optional. Links shown nested under this item. See [Sub-items](#sub-items).                               |

The sidebar groups have these headings: `main` is "Platform", `management` is "Management",
`addons` is "Addons". `footer` has no heading: it is pinned to the bottom of the sidebar and
stays visible while the groups above scroll. It is meant for items people need from anywhere but
not for their daily work, such as help or settings. Most addons should not use it. Built-in
orders, for placing your item:

| Group        | Built-in items (order)                                           |
| ------------ | ---------------------------------------------------------------- |
| `main`       | Overview (0), Applications (10)                                  |
| `management` | Users (10), Infrastructure (20), Organizations (20), Addons (20) |
| `addons`     | none                                                             |
| `footer`     | Help (900), Settings (1000)                                      |

A nav item has no `visible` function and receives no context. If the icon throws while
rendering, the shell hides only the icon.

#### Sub-items

An addon with several pages can nest links under its nav item instead of adding several
top-level items. Flat items from different addons all end up in the same "Addons" group, where
two addons' "Settings" items cannot be told apart.

`NavSubItem` has the `ContributionBase` fields (`id`, `order`, `roles`) plus:

| Field   | Type     | Description                                                       |
| ------- | -------- | ----------------------------------------------------------------- |
| `label` | `string` | Required. Link text.                                              |
| `path`  | `string` | Required. **Relative** to the addon base path, like `path` above. |

```tsx
'nav.items': [
  {
    id: 'main',
    label: 'Monitoring',
    path: '',
    icon: ServerIcon,
    children: [
      { id: 'overview', label: 'Overview', path: '' },
      { id: 'alerts', label: 'Alerts', path: 'alerts' },
      { id: 'rules', label: 'Rules', path: 'rules', roles: ['Admin'] },
    ],
  },
],
```

How the sidebar treats them:

- There is one level of nesting. A sub-item has no `icon`, `group` or `children`; a `children`
  key on a sub-item is ignored.
- `id` must be unique among the sub-items of one item. `roles` and `order` work as on top-level
  items. If `roles` hide every sub-item, the parent is shown as a plain link.
- The parent stays a link to its own `path`. A chevron next to it expands and collapses the
  sub-items. The entry expands on its own when the user opens one of its pages.
- Only one link is highlighted: the one whose path is the longest match for the current URL.
  On a tie a sub-item wins over its parent, so an "Overview" sub-item with the parent's path is
  highlighted on the index page. Pages without a sub-item of their own (such as
  `details/:id`) highlight the closest one above them.
- In the collapsed (icon-only) sidebar the sub-items are hidden and the parent is highlighted on
  their pages.

#### Addon settings

The shell's **Settings** page (`/settings`, pinned to the bottom of the sidebar) holds platform-wide
settings of the dashboard itself only. There is no extension point for it. If your addon has settings,
give it its own page and link it as a sub-item:

```tsx
routes: [
  { index: true, Component: OverviewPage },
  { path: 'settings', crumb: 'Settings', roles: ['Admin'], Component: SettingsPage },
],
contributions: {
  'nav.items': [
    {
      id: 'main',
      label: 'Monitoring',
      path: '',
      icon: ServerIcon,
      children: [
        { id: 'overview', label: 'Overview', path: '' },
        { id: 'settings', label: 'Settings', path: 'settings', roles: ['Admin'] },
      ],
    },
  ],
},
```

`roles` on the sub-item only hides the link; `roles` on the route is what keeps everyone else off
the page, including a URL typed by hand (see [Users and roles](#users-and-roles)). The example
addon's settings page is set up this way.

Earlier development builds had a `settings.panels` point for cards on the shell's Settings page.
It no longer exists. An addon that still declares it loads; the shell logs `ignoring unknown
extension points` and shows no panel.

### `Widget<C>` (`home.widgets`, `cluster.widgets`)

| Field       | Type                                                 | Description                                                                                   |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `title`     | `string`                                             | Required. The card title, and the name in error messages.                                     |
| `component` | `ComponentType<C>`                                   | Required. Rendered inside the card (or on its own, see `size`).                               |
| `size`      | `'stat' \| 'card' \| 'wide'`                         | Optional, `home.widgets` only. Where the overview puts the widget, default `card`. See below. |
| `visible`   | `(context: C, user: CurrentUser \| null) => boolean` | Optional. See [`visible`](#visible).                                                          |

#### Widget sizes on the overview

The overview page lays `home.widgets` out in three places, top to bottom, each sorted by `order`
on its own:

| `size`           | Where                                                 | Frame                                                                                                                                 |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `stat`           | Summary row at the top, one joined strip              | None: render one plain `StatCard` from `@oakestra/ui`. The shell puts all `stat` widgets in a `StatGroup`; do not add your own frame. |
| `wide`           | Full-width sections below the summary row             | None: render your own section, usually a `SectionCard` (title, description, actions).                                                 |
| `card` (default) | Grid at the bottom (2 columns from `md`, 3 from `xl`) | A card with `title` as its heading.                                                                                                   |

A `stat` or `wide` widget that renders nothing (`return null`) takes no space. `cluster.widgets`
ignores `size` and renders every widget as a card. A shell older than the field, or one that gets
a value it does not know, renders a `card` (an unknown value is logged, not rejected), so draw a
`stat` tile that still reads inside a card.

The built-in tiles and sections come from the linked feature packages the same way, so a
deployment that leaves a package out loses its tiles. Their ids (`<addon>:<widget>`, as in the
`data-widget-id` attribute of each widget's wrapper) and orders leave room for your own:

| Widget                             | `size` | `order` | Visible to                                                             |
| ---------------------------------- | ------ | ------- | ---------------------------------------------------------------------- |
| `applications:applications`        | `stat` | 100     | everyone                                                               |
| `applications:services`            | `stat` | 200     | everyone                                                               |
| `applications:instances`           | `stat` | 300     | everyone                                                               |
| `infrastructure:clusters`          | `stat` | 400     | everyone (links to the page for `Admin` and `Infrastructure_Provider`) |
| `applications:needs-attention`     | `wide` | 100     | everyone with services (hidden for someone without any)                |
| `applications:recent-applications` | `wide` | 200     | everyone (first steps for someone without applications)                |

A quota tile between instances and clusters is `{ id: 'quota', title: 'Quota', size: 'stat',
order: 350, component: QuotaTile }`. Presets cannot hide or move single widgets; leave the
package out, or replace it with your own addon under its name (see [presets](presets.md)).

### `Tab<C>` (`application.detail.tabs`, `service.detail.tabs`)

| Field       | Type                                                 | Description                         |
| ----------- | ---------------------------------------------------- | ----------------------------------- |
| `label`     | `string`                                             | Required. Text of the tab trigger.  |
| `component` | `ComponentType<C>`                                   | Required. Content of the tab panel. |
| `visible`   | `(context: C, user: CurrentUser \| null) => boolean` | Optional.                           |

### Context types

| Type                 | Fields                                       |
| -------------------- | -------------------------------------------- |
| `ApplicationContext` | `applicationId: string`                      |
| `ServiceContext`     | `applicationId: string`, `serviceId: string` |
| `ClusterContext`     | `clusterId: string`                          |
| `EmptyContext`       | no fields (`home.widgets`)                   |

The shell spreads the context into your component's props: `<YourComponent {...context} />`.
TypeScript checks that the component accepts the context of its point. `SlotContext<P>` gives
the context type of a point, for example `SlotContext<'cluster.widgets'>`.

### Hosting a slot with `<Slot>`

An addon page can host an extension point itself, so the shell and other addons can contribute
to it:

```tsx
import { Slot } from '@oakestra/dashboard-sdk';

<Slot
  point="application.detail.tabs"
  context={{ applicationId }}
  empty={<p>No extensions installed.</p>}
  render={(item, content, source) => <Card title={item.label}>{content}</Card>}
/>;
```

- `point` is any extension point that renders components: not `nav.items`, `command.actions` or
  `command.sources`, which are data the shell reads itself (`RenderablePointId` is the type of
  the rest). `context` is required unless the point's
  context is empty, and is spread into each contributed component.
- `render` wraps each contribution; `content` is already inside an error boundary. `source` is
  `SlotSource`: `{ kind: 'core' | 'addon'; id: string; label: string }` plus, for addons loaded at
  runtime, `remote: true`, `displayName` (the addon's `label`, or its id) and `version`. Built-in
  packages are of kind `addon` too but are not `remote` and have no version, so use `remote` to
  decide whether to show where a contribution comes from (the shell does so with a `SourceTag`
  on tabs).
- `empty` renders when nothing is contributed or nothing is visible to the user. It also renders
  outside a host, e.g. in a plain unit test.
- `wrap(children)` wraps all rendered contributions together and only runs when there is at
  least one, for chrome that must not appear for an empty slot. The applications package uses it
  for its tab list: without contributed tabs, `empty` shows the page without tabs.
- `roles`, `visible` and `order` apply exactly as for the shell's own slots.

### Command palette (`command.actions`, `command.sources`)

The header's "Find or run anything" bar (Ctrl or Cmd K from anywhere) lists pages, actions and
search results. Two points feed it. Neither is a component: the shell reads them, so `<Slot>`
does not render them.

An **action** is something that can always be done, matched against what the user types by the
shell (`label`, `description` and `keywords`). It has `label`, optional `description`, `icon`
and `keywords`, and exactly one of `path` and `run`:

```ts
'command.actions': [
  // Opens /addons/jobs/history?tab=failed
  { id: 'failed-jobs', label: 'Show failed jobs', keywords: ['errors'], path: 'history?tab=failed' },
  // Runs after the palette has closed; a throw or rejection shows up as an error toast
  {
    id: 'sync',
    label: 'Sync now',
    roles: ['Admin'],
    run: async (ctx) => {
      await ctx.api.fetch('/jobs/sync', { method: 'POST' });
      ctx.notify.success('Sync started');
      ctx.navigate(ctx.addon?.path('history') ?? '/');
    },
  },
],
```

A **source** searches something only you know about, such as your own data. `search` receives
the trimmed query, the context and an `AbortSignal`, and returns results, which the shell shows
in a group of their own named after the source `label`:

```ts
'command.sources': [
  {
    id: 'jobs',
    label: 'Jobs',
    minQueryLength: 2,
    search: async (query, ctx, signal) => {
      const { addon, api } = ctx;
      if (!addon) return [];
      const jobs = await readCached(ctx, jobsQuery(api));
      return jobs
        .filter((job) => job.name.toLowerCase().includes(query.toLowerCase()))
        .map((job) => ({
          id: job.id,
          label: job.name,
          description: job.schedule,
          path: addon.path('details', job.id),
          // Only for what needs attention; leave it out for everything that is fine.
          tone: job.failed ? ('destructive' as const) : undefined,
        }));
    },
  },
],
```

Rules:

- **`path` or `run`, never both.** An action or result with both, or neither, is invalid. A
  action like that makes the addon `failed` at load time (see
  [validation](#validation)); a bad result is dropped when it arrives.
- **Action paths are relative to the addon's base path** like nav item paths: `''` is the index
  route, a query string is allowed (`?tab=logs`), and an absolute path or one that climbs out
  with `..` is rejected when the addon loads, so an action cannot point at another addon's page.
- **Result paths are absolute**, because they are checked when they arrive: build them with
  `ctx.addon.path(...)` (each argument is one encoded segment). A result that is malformed or
  leads to another origin is dropped with a console warning (`[commands] <source>: ignoring
invalid result`), the others stay.
- **`ctx.navigate(path)` takes absolute paths only.** There is no current route to resolve a
  relative one against, so it throws.
- **`ctx` is not a hook environment.** `run` and `search` are plain functions called from the
  palette, outside your React tree, so there are no hooks. What they would return is on `ctx`:
  `api`, `notify`, `user`, `queryClient`, `navigate`, `addon` and `isFeatureEnabled(id)` (use it
  instead of `useFeatureEnabled`).
- **Read through the cache.** A search runs after each pause in typing, so fetch with
  `readCached(ctx, options)` and the SDK's [platform queries](#data-fetching-rules) or your own
  `addonQueryKey` keys instead of calling the API per keystroke. It answers from the cache, refreshes
  in the background and never toasts. `searchTokens` and `matchesTokens` match a query word by word.
- **Limits.** `search` is not called for queries shorter than `minQueryLength` (default 2, never
  below 1) and has five seconds; `signal` aborts when the query changes or the time is up, so
  pass it to `fetch`. At most 20 results per source are shown, in the order returned, and ids
  must be unique among them.
- **A failing source is isolated.** If `search` rejects, times out or does not return an array,
  the palette says "<label> could not be searched" and every other group keeps working.
- **`roles` and `order`** apply as everywhere. Actions of runtime-loaded addons appear under "From
  addons", those of packages built into the dashboard under "Actions", and "Go to" lists the
  sidebar's pages. Source groups come last, in registration order, so arriving results never move the
  selected row. What a runtime-loaded addon contributes carries its name and version as a source tag.
- **A preset that leaves your package out removes its commands and searches** along with its
  pages.

Test `run` and `search` without rendering using `createCommandContext`, see [Testing](#testing).

### `visible`

`visible(context, user)` runs every time the slot renders, after the `roles` check. Return
`false` to hide the item. If it throws, the shell hides the item and logs the error. It is not
a React component, so do not call hooks in it.

### Error isolation

Every rendered contribution and every addon page has its own error boundary. If your component
throws, only its place shows a calm inline state: "<title> from <addon> failed to render.", a
note that the rest of the page keeps working, a **Reload** button that renders the component again
and a collapsed "Error details" with the error message. If the failure is that the addon's code
could not be downloaded, the button reloads the whole page instead. See
[troubleshooting](troubleshooting.md#a-contribution-crashes).

Example with several points:

```tsx
import {
  defineAddon,
  hasAnyRole,
  type ClusterContext,
  type ServiceContext,
} from '@oakestra/dashboard-sdk';
import { ServerIcon } from 'lucide-react';

function ClusterLoad({ clusterId }: ClusterContext) {
  return <p className="ex:text-sm">Load of cluster {clusterId}</p>;
}

function ServiceLogs({ applicationId, serviceId }: ServiceContext) {
  return (
    <p className="ex:text-sm">
      Logs of service {serviceId} in application {applicationId}
    </p>
  );
}

export default defineAddon({
  id: 'monitoring',
  contributions: {
    'nav.items': [
      {
        id: 'main',
        label: 'Monitoring',
        path: '',
        icon: ServerIcon,
        group: 'management',
        order: 30,
        roles: ['Admin', 'Infrastructure_Provider'],
      },
    ],
    'cluster.widgets': [{ id: 'load', title: 'Load', component: ClusterLoad }],
    'service.detail.tabs': [
      {
        id: 'logs',
        label: 'Logs',
        component: ServiceLogs,
        // Runs on every render of the slot with the slot context and the current user.
        visible: (_context, user) => hasAnyRole(user, ['Admin', 'Application_Provider']),
      },
    ],
  },
});
```

## Hooks and helpers

All hooks read React context that the shell provides. They only work inside the shell.

| Hook / helper                       | Returns                        | Where it works                      | Description                                                                                                           |
| ----------------------------------- | ------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `useOakestraApi()`                  | `OakestraApi`                  | anywhere in the shell               | API client with the user's token. See [The API client](#the-api-client).                                              |
| `useCurrentUser()`                  | `CurrentUser \| null`          | anywhere in the shell               | The logged-in user, `null` when logged out.                                                                           |
| `usePermissions()`                  | `Permissions`                  | anywhere in the shell               | `{ roles, hasRole(role), hasAnyRole(roles) }` for the current user.                                                   |
| `useNotify()`                       | `Notify`                       | anywhere in the shell               | Toasts: `success`, `info`, `warning`, `error`.                                                                        |
| `useAddonContext()`                 | `AddonContextValue`            | addon pages and addon contributions | `{ addonId, version, basePath }` of the addon the component belongs to.                                               |
| `useAddonBasePath()`                | `string`                       | addon pages and addon contributions | `basePath` from `useAddonContext()`, for example `/addons/insights`.                                                  |
| `useAddonPath()`                    | `(...segments) => string`      | addon pages and addon contributions | Builds links below the base path, see below.                                                                          |
| `buildAddonPath(basePath, ...segs)` | `string`                       | anywhere (plain function)           | What `useAddonPath()` calls, for code without hooks. In a command, `ctx.addon.path(...)` is this with your base path. |
| `useFeatureEnabled(id)`             | `boolean`                      | anywhere in the shell               | Whether the deployment enables the feature `id` (a built-in module id or addon name), see below.                      |
| `useHostLinks()`                    | `HostLinks`                    | anywhere in the shell               | Links to services next to the dashboard the deployment configures: `{ grafanaUrl? }`. See below.                      |
| `useHostContext()`                  | `HostContextValue`             | anywhere in the shell               | Everything at once: `{ sdkVersion, user, api, notify, ... }`. `sdkVersion` is the shell's SDK version.                |
| `addonQueryKey(addonId, ...parts)`  | `['addon', addonId, ...parts]` | anywhere (plain function)           | Query key prefix, see [Data fetching rules](#data-fetching-rules).                                                    |
| `hasAnyRole(user, roles)`           | `boolean`                      | anywhere (plain function)           | `true` if `roles` is empty or missing, or the user has one of them. `false` for `null` user and a non-empty list.     |
| `describeError(error)`              | `string`                       | anywhere (plain function)           | A sentence for a toast or an inline error, see [The API client](#the-api-client).                                     |

Errors:

- `useHostContext()` (and every hook built on it) throws `useHostContext() was called outside
the Oakestra dashboard shell...` when it finds no shell. Inside the shell this means your build
  did not share the SDK. See [troubleshooting](troubleshooting.md#usehostcontext-was-called-outside-the-oakestra-dashboard-shell).
- `useAddonContext()` throws `useAddonContext() can only be used inside UI contributed by an
addon.` outside addon pages and contributions. Nav item icons are rendered outside this
  context, so do not call it in an icon.

`useFeatureEnabled(id)` answers from the deployment's [preset](presets.md): `true` for a built-in
module or linked module the preset enables (all of them without a preset) and for its own addons,
`false` otherwise. Guard every link into another feature with it, so a deployment without that
feature shows no dead link: `useFeatureEnabled('applications') && <Link to="/applications">`.
Addons installed through the addons manager are not covered.

`useHostLinks()` returns the external links of the deployment's runtime config, today
`grafanaUrl` (the shell's `GRAFANA_URL`). Every field is optional, so render the link only when it
is set:

```tsx
const { grafanaUrl } = useHostLinks();
grafanaUrl ? (
  <a href={grafanaUrl} target="_blank" rel="noreferrer">
    Open Grafana
  </a>
) : null;
```

`useAddonPath()` returns `addonPath(...segments: (string | number)[]): string`. Every argument is
one path segment and is URI-encoded, so ids with `/`, `?` or spaces stay one segment and
`useParams()` returns them unchanged. Empty segments are skipped, and `addonPath()` is the base
path itself:

```tsx
const addonPath = useAddonPath();
addonPath(); // '/addons/insights'
addonPath('clusters', cluster._id); // '/addons/insights/clusters/<id>'
addonPath('jobs', 'a/b'); // '/addons/insights/jobs/a%2Fb'
```

Pass segments separately (`addonPath('a', 'b')`): `addonPath('a/b')` is a single segment
`a%2Fb`.

`Notify` methods take `(message: string, options?: { description?: string; id?: string })`. A
toast with the same `id` replaces the previous one instead of adding a new one.

`usePermissions()` returns an object with methods. Call them on the object
(`permissions.hasRole('Admin')`). Destructuring them (`const { hasRole } = usePermissions()`)
works at runtime, but the repository's lint rule `@typescript-eslint/unbound-method` reports it.

Example:

```tsx
import {
  SDK_VERSION,
  useAddonContext,
  useCurrentUser,
  useHostContext,
  usePermissions,
} from '@oakestra/dashboard-sdk';

export function AboutPage() {
  const { addonId, version, basePath } = useAddonContext();
  const { sdkVersion } = useHostContext();
  const user = useCurrentUser();
  const permissions = usePermissions();

  return (
    <dl className="ex:grid ex:grid-cols-2 ex:gap-1 ex:text-sm">
      <dt>Addon</dt>
      <dd>
        {addonId} {version} at {basePath}
      </dd>
      <dt>SDK</dt>
      <dd>
        built with {SDK_VERSION}, shell provides {sdkVersion}
      </dd>
      <dt>User</dt>
      <dd>
        {user?.username} ({permissions.roles.join(', ')}), admin:{' '}
        {String(permissions.hasRole('Admin'))}
      </dd>
      <dt>Organization</dt>
      <dd>{user?.organizationName ?? user?.organization ?? 'none'}</dd>
    </dl>
  );
}
```

`SDK_VERSION` is a constant compiled into your bundle. Because the SDK is shared, the value you
read at runtime is the shell's copy. `useHostContext().sdkVersion` is the documented way to read
the shell's version.

## The API client

`useOakestraApi()` returns an `OakestraApi`:

```ts
interface OakestraApi extends OakestraEndpoints {
  readonly baseUrl: string; // system-manager API base URL, no trailing slash
  fetch(path: string, init?: RequestInit): Promise<Response>;
}
```

The endpoint groups come from `@oakestra/api` (`packages/api/src/endpoints`). Every method:

- sends the logged-in user's access token and refreshes it when needed,
- validates the response with Zod models and returns typed data,
- throws an `ApiError` on any failure. `error.message` is a readable sentence; `error.status` is
  the HTTP status (`0` when no response arrived).

Read methods accept `{ signal }` as their last argument. Pass the `signal` from TanStack Query.

| Group               | Methods                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.applications`  | `list()` (all users, Admin only), `listForUser(userId)` (the user's `_id`, not the name), `get(id)`, `create(sla)`, `update(id, update)`, `delete(id)`                                    |
| `api.services`      | `list()` (Admin only), `listForApplication(applicationId)`, `get(id)`, `create(sla)`, `update(id, sla)` (the backend answers 501 today), `delete(id)`                                     |
| `api.instances`     | `deploy(serviceId)`, `undeploy(serviceId, instanceNumber)`                                                                                                                                |
| `api.clusters`      | `list()`, `listActive()` (clusters that reported in recently)                                                                                                                             |
| `api.users`         | `list()`, `listByOrganization(organizationId)`, `get(username)`, `create(user)`, `update(username, update)`, `delete(username)`, `changePassword(username, change)`, `getRoles(username)` |
| `api.organizations` | `list()`, `create(organization)`, `update(id, organization)`, `delete(id)`                                                                                                                |
| `api.auth`          | `login`, `refresh`, `requestPasswordReset`, `resetPassword`. The shell handles login; addons should not need these.                                                                       |

The backend checks permissions. A call the user may not make fails with `ApiError` (status 401 or
403), so handle errors in the UI.

`describeError(error: unknown): string` from the SDK turns whatever a query or mutation threw into
a sentence to show: the readable message of an `ApiError`, the `message` of any other `Error`, or
`Something went wrong.`. The shell's own pages use the same function.

```tsx
const clusters = useQuery({ ... });
if (clusters.isError) return <p role="alert">{describeError(clusters.error)}</p>;
```

Types: the example addon does not depend on `@oakestra/api`. You can derive the data types from
the client:

```ts
type Cluster = Awaited<ReturnType<OakestraApi['clusters']['list']>>[number];
```

To import the named types instead (`import type { Cluster, Service, ApiError } from
'@oakestra/api'`), add `"@oakestra/api": "workspace:*"` to your addon's `package.json` and run
`pnpm install`. Import types only; lint rejects value imports (see
[What an addon may import](#what-an-addon-may-import)).

### `api.fetch(path, init)`

For endpoints the groups do not cover. `path` is resolved against `baseUrl` (a leading `/` is
optional). It adds the token and does the same refresh and retry as the typed methods, but it
returns the raw `Response`: it does not throw on HTTP errors and does not validate the body.

```ts
import type { OakestraApi } from '@oakestra/dashboard-sdk';

// For endpoints the typed groups do not cover.
export async function fetchUserRoles(api: OakestraApi, username: string): Promise<unknown> {
  const response = await api.fetch(`/permission/${encodeURIComponent(username)}`);
  if (!response.ok) throw new Error(`GET /permission failed with HTTP ${response.status}`);
  return response.json();
}
```

The API client only talks to the Oakestra system-manager. The shell has no proxy for an addon's
own backend service; `/addon-assets/<name>/` reaches only your UI container.

## Users and roles

```ts
interface CurrentUser {
  readonly username: string; // the token's `sub` claim
  readonly roles: readonly Role[];
  readonly organization: string | null; // organization id (the token's `organization` claim)
  readonly organizationName?: string; // name entered at login; 'root' when none was given
}
```

`organization` is an id. Users who log in without an organization get the id of the built-in
`root` organization. `CurrentUser` has no user `_id`; call `api.users.get(username)` if you need
it (for example for `api.applications.listForUser`).

Roles (`KnownRole`): `Admin`, `Organization_Admin`, `Application_Provider`,
`Infrastructure_Provider`. The `Role` type also accepts any other string, for roles the backend
may add later.

| Mechanism                          | Scope                                        |
| ---------------------------------- | -------------------------------------------- |
| `roles` on a contribution          | Hides nav items and sub-items, widgets, tabs |
| `roles` on a route                 | Shows "Access denied" instead of the page    |
| `visible(context, user)`           | Hides widgets and tabs (not nav items)       |
| `usePermissions()`, `hasAnyRole()` | Your own checks in components                |

Hiding a nav item does not protect its page: the URL still works. Put the same `roles` on the
route, and the shell shows its "Access denied" page (the one core pages use) to everyone else.
A route's `roles` also cover its children:

```tsx
routes: [
  { index: true, Component: OverviewPage },
  // Both `admin/users` and `admin/audit` are for administrators only.
  {
    path: 'admin',
    roles: ['Admin'],
    children: [
      { path: 'users', Component: UsersPage },
      { path: 'audit', Component: AuditPage },
    ],
  },
],
```

For finer checks inside a page (a button only admins see), use `usePermissions()`.

These checks only shape the UI. The backend enforces permissions.

## Data fetching rules

The shell and all addons share **one** TanStack Query `QueryClient`, so:

- **Namespace your keys** with `addonQueryKey(ADDON_ID, ...)`. A plain key like `['clusters']`
  could collide with the shell or another addon and show the wrong data.
- **Defaults** come from the shell: queries are fresh for 10 seconds (`staleTime: 10_000`), and a
  failed query is retried once, except for HTTP 4xx errors. Mutations are not retried.
- **Mutation errors toast automatically.** Every failed mutation shows an error toast. Set
  `meta: { errorMessage: '...' }` for the toast title, or `meta: { silent: true }` if your
  component shows the error itself (for example a form).
- **Query errors toast only on refetch.** If a query has no data yet, nothing toasts: render the
  error inline (`isError`, with a retry button). If a background refetch fails while data is on
  screen, the shell toasts. `meta: { silent: true }` (or `meta.errorMessage` for the title)
  works for queries too.
- Session errors (the login expired) never toast; the shell sends the user to the login page.

The `meta` fields are typed in the shell only. In an addon, `meta` is a plain
`Record<string, unknown>`, so spell the field names correctly.

A mutation with a toast on success:

```tsx
import {
  addonQueryKey,
  useNotify,
  useOakestraApi,
  type ServiceContext,
} from '@oakestra/dashboard-sdk';
import { Button } from '@oakestra/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function ScaleUpTab({ serviceId }: ServiceContext) {
  const api = useOakestraApi();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const deploy = useMutation({
    mutationFn: () => api.instances.deploy(serviceId),
    // Title of the error toast the shell shows when this fails.
    meta: { errorMessage: 'Could not request an instance' },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: addonQueryKey('scaler', 'service', serviceId),
      });
      notify.success('Instance requested', { description: 'The scheduler places it shortly.' });
    },
  });

  return (
    <Button disabled={deploy.isPending} onClick={() => deploy.mutate()}>
      Add an instance
    </Button>
  );
}
```

Invalidate your own keys. The shell's query keys are not part of the SDK contract, with one
exception: the **platform queries** the SDK exports, which the shell uses itself. Use them instead
of fetching the same data under your own key, so the page shares the shell's cache entry and poll:

| Export                                           | Data                                                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clustersQuery(api)`                             | `GET /clusters/`, every cluster, polled every `CLUSTER_REFETCH_MS` (30s). Add `select` for one.                                                                                                             |
| `profileQuery(api, username)`                    | `GET /user/{name}` of the current user (`useCurrentUser().username`), the only source of `_id`.                                                                                                             |
| `applicationsQuery(api, userId)`                 | The applications of one user (`userId` is the `_id` from `profileQuery`).                                                                                                                                   |
| `servicesByApplicationQuery(api, applicationId)` | The services of one application.                                                                                                                                                                            |
| `allApplicationsQuery(api)`                      | `GET /applications/`, every application. Admin only; pages of other users' applications stay out of reach.                                                                                                  |
| `allServicesQuery(api)`                          | `GET /services/`, every service. Admin only.                                                                                                                                                                |
| `platformQueryKeys`                              | Their keys (`all`, `clusters()`, `user(username)`, `applications()`, `services()`, ...), for `invalidateQueries`. A change to an application or its services invalidates `applications()` and `services()`. |

```tsx
const clusters = useQuery(clustersQuery(useOakestraApi()));
```

## `@oakestra/ui`

`@oakestra/ui` is the dashboard's component library: shadcn/ui components on Radix, styled with
Tailwind CSS v4. It is a shared singleton, so your addon uses the shell's copy and its components
look and behave the same. The full list is in `packages/ui/src/index.ts`. Storybook shows all of
them: `pnpm storybook` (port 6006).

**Root entry** (`@oakestra/ui`), always loaded:

| Kind               | Components                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composites         | `PageHeader`, `SectionCard`, `StatCard`, `StatGroup`, `StatusBadge`, `StatusDot`, `EmptyState`, `ConfirmDialog`                                                                                                                                            |
| Layout and content | `Card` (+ `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`), `Tabs`, `Accordion`, `Collapsible`, `Separator`, `ScrollArea`, `Table`, `Skeleton`, `Badge`, `Avatar`, `Alert`, `Progress`, `Pagination`, `Breadcrumb` |
| Forms              | `Button`, `Input`, `Textarea`, `Label`, `Field` (+ `FieldLabel`, `FieldError`, ...), `Checkbox`, `RadioGroup`, `Select`, `Switch`, `Toggle`, `ToggleGroup`                                                                                                 |
| Overlays           | `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `Tooltip`, `DropdownMenu`                                                                                                                                                                                     |
| Helpers            | `cn` (class name merge), `useIsMobile`, `toast` (prefer `useNotify()`)                                                                                                                                                                                     |

`StatusBadge` and `StatCard` take a `tone`: `success` (healthy), `warning` (degraded), `info` (in
progress), `destructive` (failed), `neutral` (inactive or unknown). Pick the tone by meaning, not
by color.

Keep healthy states neutral and use color for abnormal ones. `StatusBadge` shows each tone with its
own shape (disc, triangle, square, ring, dash), and only `warning` and `destructive` get a fill.
`StatCard` colors its value only for those two, so pass `tone` for an abnormal number (a non-zero
failure count) and leave it off otherwise. Do not wrap icons in tinted boxes, and write labels in
sentence case ("Failed services", not "FAILED SERVICES"). Use `StatGroup` only on your own pages
with several related `StatCard`s; a `stat` widget renders a single `StatCard`.

**Subpath entries**, each a separate shared chunk that is only downloaded by pages that import it:

| Import                      | Contents                                                                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@oakestra/ui/chart`        | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`, `type ChartConfig`, and the Recharts parts `LineChart`, `AreaChart`, `BarChart`, `Line`, `Area`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `ReferenceLine` |
| `@oakestra/ui/data-table`   | `DataTable`, `createDataTableColumnHelper`, types `DataTableColumnDef`, `DataTableColumnMeta`, `DataTableProps` (TanStack Table v9)                                                                                                                                    |
| `@oakestra/ui/command`      | `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandItem`, ... (cmdk)                                                                                                                                                                                   |
| `@oakestra/ui/map`          | `Map`, `MapMarker`, `MarkerTooltip`, `MapControls`, `MapGeoJSON`, `useMap`, ... (MapLibre GL)                                                                                                                                                                          |
| `@oakestra/ui/location-map` | `LocationMap`, `toMapLocation` (markers and radius circles; MapLibre loads only when a map renders)                                                                                                                                                                    |

Import charts from `@oakestra/ui/chart`, never from `recharts` directly:

```tsx
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  type ChartConfig,
} from '@oakestra/ui/chart';

const config = { jobs: { label: 'Jobs', color: 'var(--chart-1)' } } satisfies ChartConfig;

export function JobsChart({ data }: { data: { day: string; jobs: number }[] }) {
  return (
    <ChartContainer config={config} className="ex:h-48 ex:w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="jobs" stroke="var(--color-jobs)" dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
```

`DataTable` notes: `label` is required (accessible name), `data` may be `undefined` while
loading, `isLoading` shows skeleton rows, `onRowClick` makes rows clickable, column
`meta: { numeric: true }` right-aligns numbers. Sorting, search and paging are built in.

Never import a deep path such as `@oakestra/ui/src/components/button`. It would bypass the
shared singleton and give your addon a second copy of the component and its React context.

## Testing

`@oakestra/dashboard-sdk/testing` renders a component with everything the shell provides, so
components that use the SDK hooks can be tested without the shell. It is for test files only: lint
rejects it in addon runtime code, and it is not a shared dependency. It needs
`@testing-library/react` (an optional peer dependency of the SDK) and `@testing-library/dom`
(its peer), `vitest` or any other runner,
and a DOM environment such as jsdom.

```tsx
import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';

it('shows the cluster names', async () => {
  const { notify } = renderInHost(<ClusterList />, {
    user: { username: 'alice', roles: ['Application_Provider'] }, // null renders logged out
    api: { clusters: { list: async () => [{ cluster_name: 'edge-1' }] as Cluster[] } },
    addon: { addonId: 'example' }, // basePath becomes /addons/example
    route: '/addons/example/details/1', // optional, defaults to the base path
    path: '/addons/example/details/:itemId', // optional route pattern, makes useParams() work
  });
  expect(await screen.findByText('edge-1')).toBeTruthy();
  expect(notify.calls).toEqual([]);
});
```

`renderInHost` wraps the element in a fresh `QueryClient` (retries off), a memory data router
(so `useMatches`, `useBlocker` and friends work like in the shell),
`HostContext` and `AddonContext`, and returns the Testing Library result plus `user`, `api`,
`notify`, `queryClient`, `host` and `addon`.

- `path` is the route pattern the element is rendered under. Without it the element matches `*`
  and `useParams()` is empty. `route` and `path` are read once; navigate with links or `useNavigate`
  afterwards.
- `api` is a partial `OakestraApi`: give only the endpoints the component calls. Calling anything
  else throws `api.<group>.<method>() was called, but this test did not mock it`.
- `contributions` fills the slots the component hosts with `<Slot>` (same shape as
  `AddonDefinition.contributions`); roles, `visible` and `order` are applied, but there are no
  error boundaries. Without it every `<Slot>` renders its `empty`.
- `notify` records its calls (`notify.calls`, `{ level, message, options? }`; `notify.clear()`),
  independent of the test runner.
- `contributionSource` is `{ remote, displayName, version }`, what the `source` argument of a
  `<Slot render>` receives for the addon under test. Use it to test how a page marks a
  runtime-loaded addon; by default none of them are set, like a package built into the dashboard.
- `features` lists the features `useFeatureEnabled()` reports as enabled. Without it every
  feature counts as enabled.
- `links` is what `useHostLinks()` returns, e.g. `{ grafanaUrl: 'https://grafana.example' }`.
  Without it there are no links.

`createCommandContext(options)` builds the `CommandContext` a command gets, so `run` and `search`
can be called directly, without rendering. It takes `user`, `api`, `addon`, `features` and
`queryClient`, and records `notify` calls and every path passed to `navigate` (`ctx.navigations`).
Like the shell, its `navigate` throws for a relative path:

```ts
import { createCommandContext } from '@oakestra/dashboard-sdk/testing';

const ctx = createCommandContext({
  addon: { addonId: 'jobs' },
  api: { clusters: { list: async () => clusters } },
});
const results = await jobsSource.search('edge', ctx, new AbortController().signal);
expect(results[0]?.path).toBe('/addons/jobs/details/job-1');
```

For your own render function there are smaller pieces: `createTestHost(options)` returns the
context values (`host`, `addon`, `user`, `api`, `notify`, `route`), `TestHostProvider` renders them
(`<TestHostProvider testHost={...} queryClient={...}>`), and `createMockApi(partial)`,
`createNotifyRecorder()` and `createTestQueryClient()` build the parts.

The example addon has a working setup: `addons/example/vitest.config.ts` (jsdom, `css: false` so
the Tailwind entry is not processed, built on `vite.config.ts` so `virtual:oakestra-addon`
resolves) and `src/widgets/widgets.test.tsx`.

## What an addon may import

Addons are built and deployed separately from the shell, so they can only use what exists at
runtime. The ESLint config (`packages/eslint-config/index.js`) enforces this for every file in
`addons/**`:

| Import                                                                                   | Allowed?                                     |
| ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Your own files (inside `addons/<your-addon>/`)                                           | Yes                                          |
| `@oakestra/dashboard-sdk`, `@oakestra/dashboard-sdk/federation`                          | Yes (`/federation` in `vite.config.ts`)      |
| `@oakestra/dashboard-sdk/vite`                                                           | `vite.config.ts` and `vitest.config.ts` only |
| `virtual:oakestra-addon` (`ADDON_ID`, provided by `oakestraAddon()`)                     | Yes                                          |
| `@oakestra/dashboard-sdk/testing`                                                        | Test files only (`*.test.ts(x)`)             |
| `@oakestra/ui`, `@oakestra/ui/chart`, `/data-table`, `/command`, `/map`, `/location-map` | Yes                                          |
| `@oakestra/ui/theme.css` (and other `@oakestra/ui/*.css`)                                | Yes                                          |
| `@oakestra/api`                                                                          | **Types only** (`import type`)               |
| Any other `@oakestra/*` package, any `@oakestra/*/src/...` path                          | No                                           |
| Files of the shell or of another addon                                                   | No                                           |
| Third-party npm packages                                                                 | Not restricted by lint. See below.           |

Third-party packages:

- `react`, `react-dom`, `react-router` and `@tanstack/react-query` are shared singletons. Your
  addon uses the shell's copies (React 19, React Router 8, TanStack Query 5). Import
  `react-router`, never `react-router/dom`.
- Anything else (for example `lucide-react` or a date library) is bundled into your addon. That
  is fine for stateless libraries. A library that needs a React provider from the shell does not
  work, because the shell's providers belong to its own copy.

## Other exports

The SDK also exports these. Most addons do not need them.

| Export                                                                                                                                                                                                                                                                                                                                                       | Description                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `SDK_VERSION`                                                                                                                                                                                                                                                                                                                                                | SDK version string, `'0.1.0'`.                                                                                    |
| `EXTENSION_POINT_IDS`                                                                                                                                                                                                                                                                                                                                        | Array of all extension point ids.                                                                                 |
| `HostContext`, `AddonContext`                                                                                                                                                                                                                                                                                                                                | The React contexts behind the hooks. Use the hooks instead; tests can use the providers.                          |
| `Slot`, `SlotProps`, `SlotSource`, `SlotRendererContext`                                                                                                                                                                                                                                                                                                     | Host an extension point (see above). `SlotRendererContext` is how the shell provides the renderer; do not use it. |
| `HostContextValue`, `AddonContextValue`, `HostLinks`                                                                                                                                                                                                                                                                                                         | Types of the context values.                                                                                      |
| `AddonCrumbProps`                                                                                                                                                                                                                                                                                                                                            | Props of a `crumb` component: `{ params }`.                                                                       |
| `ExtensionPoints`, `ExtensionPointId`, `RenderablePointId`, `SlotContext`, `Contributions`, `ContributionBase`, `NavItem`, `NavSubItem`, `NavGroup`, `Widget`, `WidgetSize`, `Tab`, `IconProps`, `EmptyContext`, `CommandAction`, `CommandSource`, `CommandContext`, `CommandAddon`, `CommandResult`, `CommandResultTone`, `CommandTarget`, `CommandDisplay` | Types for extension points.                                                                                       |
| `seedFromLists`, `useSearchParam`                                                                                                                                                                                                                                                                                                                            | Query-cache seeding for route-less detail pages and one URL search param as state. See the API report.            |
| `Permissions`, `Notify`, `NotifyOptions`, `CurrentUser`, `Role`, `KnownRole`, `OakestraApi`                                                                                                                                                                                                                                                                  | Types used by the hooks.                                                                                          |
| `@oakestra/dashboard-sdk/vite`: `oakestraAddon`, `OakestraAddonOptions`                                                                                                                                                                                                                                                                                      | The Vite plugin for addons, see [packaging](packaging.md#build-configuration).                                    |
| `@oakestra/dashboard-sdk/vite/client`                                                                                                                                                                                                                                                                                                                        | Types of `virtual:oakestra-addon`, for `compilerOptions.types` in `tsconfig.json`.                                |
| `@oakestra/dashboard-sdk/federation`: `sharedDeps`, `withoutFallback`                                                                                                                                                                                                                                                                                        | The shared config that `oakestraAddon()` uses, see [packaging](packaging.md#shared-dependencies).                 |
