# SDK reference

This page describes `@oakestra/dashboard-sdk` (version `0.1.0`) as an addon author uses it. The
source is in `packages/dashboard-sdk/src`. For a guided introduction, start with the
[tutorial](README.md#tutorial-build-your-first-addon-ui).

Contents:

- [The addon definition](#the-addon-definition)
- [Extension points](#extension-points)
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

| Field           | Type                    | Description                                                                                      |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `id`            | `string`                | Required. Must equal the addon name in `/ui-addons`, which is also the Module Federation `name`. |
| `routes`        | `readonly AddonRoute[]` | Optional. Pages below `/addons/<id>/`.                                                           |
| `contributions` | `Contributions`         | Optional. Items per extension point, see [Extension points](#extension-points).                  |

### `AddonRoute`

| Field       | Type                    | Description                                                                             |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `path`      | `string`                | Relative to the addon base path. Must not start with `/`. Omit it for an index route.   |
| `index`     | `boolean`               | `true` for the index route (the page at `/addons/<id>`).                                |
| `Component` | `ComponentType`         | The page component.                                                                     |
| `children`  | `readonly AddonRoute[]` | Nested routes. The parent component renders them with `<Outlet />` from `react-router`. |

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
- The breadcrumb shows only the addon id. Nested addon pages do not add breadcrumb entries.
- Routes have no role check. See [Users and roles](#users-and-roles).

Nested routes and a lazy page:

```tsx
import { defineAddon } from '@oakestra/dashboard-sdk';
import { lazy } from 'react';
import { Outlet, useParams } from 'react-router';

function JobsLayout() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Jobs</h1>
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
  routes: [
    { index: true, Component: JobList },
    {
      path: 'jobs',
      Component: JobsLayout,
      children: [
        { index: true, Component: JobList },
        { path: ':jobId', Component: JobDetail },
      ],
    },
    { path: 'reports', Component: ReportsPage },
  ],
});
```

### Validation

The shell validates every loaded definition with Zod before it registers anything. If validation
fails, the addon gets the state `failed` and nothing of it is shown. It is rejected when:

- the module has no default export object,
- `id` is missing, empty or differs from the name in `/ui-addons`,
- a route `path` starts with `/`, or `Component` is not a React component (a function or a
  `memo`/`lazy`/`forwardRef` object; a JSX element is not caught here and fails when it renders),
- a contribution misses a required field (`id`, `label`/`title`, `component`, `path`), or a field
  has the wrong type (for example `order` that is not a finite number),
- two contributions **to the same extension point** have the same `id`,
- a nav item `path` is absolute (`/x`) or a URL (`https:...`).

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
| `home.widgets`            | `Widget`                  | `{}`                           | Overview page `/`, widget grid                                                                                            |
| `application.detail.tabs` | `Tab<ApplicationContext>` | `{ applicationId }`            | `/applications/:appId`, tab list after "Services"                                                                         |
| `service.detail.tabs`     | `Tab<ServiceContext>`     | `{ applicationId, serviceId }` | `/applications/:appId/services/:serviceId`, tab list after "JSON"                                                         |
| `cluster.widgets`         | `Widget<ClusterContext>`  | `{ clusterId }`                | `/infrastructure/clusters/:clusterId`, bottom of the page (only `Admin` and `Infrastructure_Provider` can open this page) |

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

The shell's **Settings** page (`/settings`, pinned to the bottom of the sidebar) holds settings
of the dashboard itself only. There is no extension point for it. If your addon has settings,
give it its own page and link it as a sub-item:

```tsx
routes: [
  { index: true, Component: OverviewPage },
  { path: 'settings', Component: SettingsPage },
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

`roles` only hides the link. If the settings are for administrators, the page has to check
`usePermissions()` itself (see [Users and roles](#users-and-roles)). The example addon's
`src/pages/SettingsPage.tsx` shows the pattern.

Earlier development builds had a `settings.panels` point for cards on the shell's Settings page.
It no longer exists. An addon that still declares it loads; the shell logs `ignoring unknown
extension points` and shows no panel.

### `Widget<C>` (`home.widgets`, `cluster.widgets`)

| Field       | Type                                                 | Description                                       |
| ----------- | ---------------------------------------------------- | ------------------------------------------------- |
| `title`     | `string`                                             | Required. The shell renders it as the card title. |
| `component` | `ComponentType<C>`                                   | Required. Rendered inside the card.               |
| `visible`   | `(context: C, user: CurrentUser \| null) => boolean` | Optional. See [`visible`](#visible).              |

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

### `visible`

`visible(context, user)` runs every time the slot renders, after the `roles` check. Return
`false` to hide the item. If it throws, the shell hides the item and logs the error. It is not
a React component, so do not call hooks in it.

### Error isolation

Every rendered contribution and every addon page has its own error boundary. If your component
throws, only its box shows an error ("<title> from addon "<id>" failed to render." plus the error
message). The rest of the page keeps working. See
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
  return <p className="text-sm">Load of cluster {clusterId}</p>;
}

function ServiceLogs({ applicationId, serviceId }: ServiceContext) {
  return (
    <p className="text-sm">
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

| Hook / helper                      | Returns                        | Where it works                      | Description                                                                                                       |
| ---------------------------------- | ------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `useOakestraApi()`                 | `OakestraApi`                  | anywhere in the shell               | API client with the user's token. See [The API client](#the-api-client).                                          |
| `useCurrentUser()`                 | `CurrentUser \| null`          | anywhere in the shell               | The logged-in user, `null` when logged out.                                                                       |
| `usePermissions()`                 | `Permissions`                  | anywhere in the shell               | `{ roles, hasRole(role), hasAnyRole(roles) }` for the current user.                                               |
| `useNotify()`                      | `Notify`                       | anywhere in the shell               | Toasts: `success`, `info`, `warning`, `error`.                                                                    |
| `useAddonContext()`                | `AddonContextValue`            | addon pages and addon contributions | `{ addonId, version, basePath }` of the addon the component belongs to.                                           |
| `useAddonBasePath()`               | `string`                       | addon pages and addon contributions | `basePath` from `useAddonContext()`, for example `/addons/insights`.                                              |
| `useHostContext()`                 | `HostContextValue`             | anywhere in the shell               | Everything at once: `{ sdkVersion, user, api, notify }`. `sdkVersion` is the shell's SDK version.                 |
| `addonQueryKey(addonId, ...parts)` | `['addon', addonId, ...parts]` | anywhere (plain function)           | Query key prefix, see [Data fetching rules](#data-fetching-rules).                                                |
| `hasAnyRole(user, roles)`          | `boolean`                      | anywhere (plain function)           | `true` if `roles` is empty or missing, or the user has one of them. `false` for `null` user and a non-empty list. |

Errors:

- `useHostContext()` (and every hook built on it) throws `useHostContext() was called outside
the Oakestra dashboard shell...` when it finds no shell. Inside the shell this means your build
  did not share the SDK. See [troubleshooting](troubleshooting.md#usehostcontext-was-called-outside-the-oakestra-dashboard-shell).
- `useAddonContext()` throws `useAddonContext() can only be used inside UI contributed by an
addon.` outside addon pages and contributions. Nav item icons are rendered outside this
  context, so do not call it in an icon.

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
    <dl className="grid grid-cols-2 gap-1 text-sm">
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

// For endpoints the typed groups do not cover. `api.fetch` adds the bearer token and handles the
// token refresh, but it does not throw on HTTP errors and does not validate the body.
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
| `visible(context, user)`           | Hides widgets and tabs (not nav items)       |
| `usePermissions()`, `hasAnyRole()` | Your own checks in components                |

Addon **routes have no role check**. Hiding a nav item does not protect its page. Check
`usePermissions()` in the page:

```tsx
import { usePermissions } from '@oakestra/dashboard-sdk';
import { EmptyState } from '@oakestra/ui';

export function AdminOnlyPage() {
  const permissions = usePermissions();
  // Nav item `roles` only hides the link. The URL still works, so the page checks as well.
  if (!permissions.hasRole('Admin')) {
    return <EmptyState title="Not allowed" description="This page is for administrators." />;
  }
  return <p>Admin tools</p>;
}
```

UI checks are for a good user experience. The real permission check happens in the backend.

## Data fetching rules

The shell and all addons share **one** TanStack Query `QueryClient`. That has consequences:

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

Invalidate your own keys. The shell's query keys are not part of the SDK contract.

## `@oakestra/ui`

`@oakestra/ui` is the dashboard's component library: shadcn/ui components on Radix, styled with
Tailwind CSS v4. It is a shared singleton, so your addon uses the shell's copy and its components
look and behave the same. The full list is in `packages/ui/src/index.ts`. Storybook shows all of
them: `pnpm storybook` (port 6006).

**Root entry** (`@oakestra/ui`), always loaded:

| Kind               | Components                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composites         | `PageHeader`, `SectionCard`, `StatCard`, `StatusBadge`, `StatusDot`, `EmptyState`, `ConfirmDialog`                                                                                                                                                         |
| Layout and content | `Card` (+ `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`), `Tabs`, `Accordion`, `Collapsible`, `Separator`, `ScrollArea`, `Table`, `Skeleton`, `Badge`, `Avatar`, `Alert`, `Progress`, `Pagination`, `Breadcrumb` |
| Forms              | `Button`, `Input`, `Textarea`, `Label`, `Field` (+ `FieldLabel`, `FieldError`, ...), `Checkbox`, `RadioGroup`, `Select`, `Switch`, `Toggle`, `ToggleGroup`                                                                                                 |
| Overlays           | `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `Tooltip`, `DropdownMenu`                                                                                                                                                                                     |
| Helpers            | `cn` (class name merge), `useIsMobile`, `toast` (prefer `useNotify()`)                                                                                                                                                                                     |

`StatusBadge` and `StatCard` take a `tone`: `success` (healthy), `warning` (degraded), `info` (in
progress), `destructive` (failed), `neutral` (inactive or unknown). Pick the tone by meaning, not
by color.

**Subpath entries**, each a separate shared chunk that is only downloaded by pages that import it:

| Import                    | Contents                                                                                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@oakestra/ui/chart`      | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`, `type ChartConfig`, and the Recharts parts `LineChart`, `AreaChart`, `BarChart`, `Line`, `Area`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `ReferenceLine` |
| `@oakestra/ui/data-table` | `DataTable`, `createDataTableColumnHelper`, types `DataTableColumnDef`, `DataTableColumnMeta`, `DataTableProps` (TanStack Table v9)                                                                                                                                    |
| `@oakestra/ui/command`    | `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandItem`, ... (cmdk)                                                                                                                                                                                   |
| `@oakestra/ui/map`        | `Map`, `MapMarker`, `MarkerTooltip`, `MapControls`, `MapGeoJSON`, `useMap`, ... (MapLibre GL)                                                                                                                                                                          |

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
    <ChartContainer config={config} className="h-48 w-full">
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

## What an addon may import

Addons are built and deployed separately from the shell, so they can only use what exists at
runtime. The ESLint config (`packages/eslint-config/index.js`) enforces this for every file in
`addons/**`:

| Import                                                                  | Allowed?                                |
| ----------------------------------------------------------------------- | --------------------------------------- |
| Your own files (inside `addons/<your-addon>/`)                          | Yes                                     |
| `@oakestra/dashboard-sdk`, `@oakestra/dashboard-sdk/federation`         | Yes (`/federation` in `vite.config.ts`) |
| `@oakestra/ui`, `@oakestra/ui/chart`, `/data-table`, `/command`, `/map` | Yes                                     |
| `@oakestra/ui/theme.css` (and other `@oakestra/ui/*.css`)               | Yes                                     |
| `@oakestra/api`                                                         | **Types only** (`import type`)          |
| Any other `@oakestra/*` package, any `@oakestra/*/src/...` path         | No                                      |
| Files of the shell or of another addon                                  | No                                      |
| Third-party npm packages                                                | Not restricted by lint. See below.      |

Third-party packages:

- `react`, `react-dom`, `react-router` and `@tanstack/react-query` are shared singletons. Your
  addon uses the shell's copies (React 19, React Router 8, TanStack Query 5). Import
  `react-router`, never `react-router/dom`.
- Anything else (for example `lucide-react` or a date library) is bundled into your addon. That
  is fine for stateless libraries. A library that needs a React provider from the shell does not
  work, because the shell's providers belong to its own copy.

## Other exports

The SDK also exports these. Most addons do not need them.

| Export                                                                                                                                                                                            | Description                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SDK_VERSION`                                                                                                                                                                                     | SDK version string, `'0.1.0'`.                                                           |
| `EXTENSION_POINT_IDS`                                                                                                                                                                             | Array of all extension point ids.                                                        |
| `HostContext`, `AddonContext`                                                                                                                                                                     | The React contexts behind the hooks. Use the hooks instead; tests can use the providers. |
| `HostContextValue`, `AddonContextValue`                                                                                                                                                           | Types of the context values.                                                             |
| `ExtensionPoints`, `ExtensionPointId`, `RenderablePointId`, `SlotContext`, `Contributions`, `ContributionBase`, `NavItem`, `NavSubItem`, `NavGroup`, `Widget`, `Tab`, `IconProps`, `EmptyContext` | Types for extension points.                                                              |
| `Permissions`, `Notify`, `NotifyOptions`, `CurrentUser`, `Role`, `KnownRole`, `OakestraApi`                                                                                                       | Types used by the hooks.                                                                 |
| `@oakestra/dashboard-sdk/federation`: `sharedDeps`, `withoutFallback`                                                                                                                             | Build config, see [packaging](packaging.md#build-configuration).                         |
