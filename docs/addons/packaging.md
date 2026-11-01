# Packaging and shipping an addon UI

This page explains how an addon UI is built, styled, packaged as a container and connected to
the dashboard, and how versions and upgrades work. The reference implementation is
`addons/example`.

Contents:

- [Build configuration](#build-configuration)
- [Styling](#styling)
- [The container](#the-container)
- [The marketplace definition and `/ui-addons`](#the-marketplace-definition-and-ui-addons)
- [Testing the production build locally](#testing-the-production-build-locally)
- [SDK versions and compatibility](#sdk-versions-and-compatibility)
- [Upgrades](#upgrades)
- [Current limitation: addons live in this repository](#current-limitation-addons-live-in-this-repository)

## Build configuration

An addon is a Vite project with the `@module-federation/vite` plugin. This is
`addons/example/vite.config.ts`:

```ts
import { federation } from '@module-federation/vite';
import { sharedDeps, withoutFallback } from '@oakestra/dashboard-sdk/federation';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const port = 5174;

export default defineConfig(({ command }) => ({
  // Relative asset URLs: in production the addon is served below /addon-assets/example/, in
  // development straight from this dev server.
  base: command === 'build' ? './' : '/',
  build: { target: 'esnext' },
  plugins: [
    react(),
    tailwindcss(),
    federation({
      // Must equal the addon name in /ui-addons and the `id` in the addon definition.
      name: 'example',
      filename: 'remoteEntry.js',
      exposes: { './addon': './src/index.tsx' },
      // The addon only ever runs inside the shell, so it never ships its own React, SDK, etc.
      shared: { ...withoutFallback(sharedDeps) },
      manifest: true,
      publicPath: 'auto',
      dts: false,
    }),
  ],
  server: {
    port,
    strictPort: true,
    origin: `http://localhost:${port}`,
    cors: true,
  },
  preview: { port, strictPort: true, cors: true },
}));
```

What each setting does and whether you may change it:

| Setting                                      | Purpose                                                                                                                            | Change?                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `name`                                       | Module Federation container name. The shell loads `<name>/addon`.                                                                  | Set to your addon name                         |
| `exposes: { './addon': './src/index.tsx' }`  | The module the shell loads. Its default export must be your `defineAddon({...})`.                                                  | Keep the key `./addon`; the file path is yours |
| `shared: { ...withoutFallback(sharedDeps) }` | Take React, React Router, TanStack Query, the SDK and `@oakestra/ui` from the shell. See below.                                    | Keep                                           |
| `manifest: true`                             | Emits `mf-manifest.json`. The shell loads addons by this manifest.                                                                 | Keep                                           |
| `filename: 'remoteEntry.js'`                 | Name of the remote entry file. The container's nginx config marks it `no-cache` by this name.                                      | Keep                                           |
| `publicPath: 'auto'`                         | Chunk URLs are resolved relative to the manifest URL, so the same build works under `/addon-assets/<name>/` and from a dev server. | Keep                                           |
| `base: command === 'build' ? './' : '/'`     | Relative asset URLs in the production build, for the same reason.                                                                  | Keep                                           |
| `build.target: 'esnext'`                     | The federation runtime uses top-level `await`.                                                                                     | Keep                                           |
| `dts: false`                                 | No type generation for remotes; the SDK provides the types.                                                                        | Keep                                           |
| `server.port`, `server.origin`               | Dev server address. `origin` makes asset URLs absolute, so the shell (on another port) fetches them from the dev server.           | Port: yes, keep `origin` in sync               |
| `server.cors`, `preview.cors`                | The shell runs on another origin (`localhost:5173`) and needs CORS to load your files in development.                              | Keep                                           |

### Shared dependencies

`sharedDeps` (in `packages/dashboard-sdk/src/federation.ts`) is the single list of shared
libraries for the shell and every addon. All of them are **singletons**: exactly one copy exists
on the page.

| Package                                                                                     | `requiredVersion`              |
| ------------------------------------------------------------------------------------------- | ------------------------------ |
| `react`                                                                                     | `^19.0.0`                      |
| `react-dom`                                                                                 | `^19.0.0`                      |
| `react-router`                                                                              | `^8.0.0`                       |
| `@tanstack/react-query`                                                                     | `^5.0.0`                       |
| `@oakestra/dashboard-sdk`                                                                   | `^0.1.0` (`^` + `SDK_VERSION`) |
| `@oakestra/ui`                                                                              | `^0.1.0`                       |
| `@oakestra/ui/chart`, `@oakestra/ui/data-table`, `@oakestra/ui/command`, `@oakestra/ui/map` | `^0.1.0`                       |

Subpath imports such as `react/jsx-runtime` and `react-dom/client` are shared automatically with
the settings of their package.

These libraries must be singletons because they hold global state: React's hook dispatcher, the
router and query contexts, the SDK's contexts, and the Radix providers inside `@oakestra/ui`. A
second copy would not see the shell's state. Typical results are "Invalid hook call" errors or
`useHostContext() was called outside the Oakestra dashboard shell`.

`withoutFallback()` sets `import: false` on every entry. The addon then bundles **no** fallback
copy and always uses the shell's copy. If sharing were misconfigured, the addon would fail to load
with an error instead of quietly running a second React.

## Styling

Addons use Tailwind CSS v4 and the dashboard's design tokens. This is
`addons/example/src/addon.css`:

```css
/*
 * Addons generate utilities only. The shell already loaded Tailwind's reset and the token values;
 * a second preflight here would reset the shell's styles after the addon loads.
 */
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
@import '@oakestra/ui/theme.css';

@source './';
```

Line by line:

| Line                        | Why                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tailwindcss/theme.css`     | Tailwind's default theme (spacing, colors such as `fuchsia-600`), so utilities resolve.                                                                                                                   |
| `tailwindcss/utilities.css` | Generates the utility classes your files use.                                                                                                                                                             |
| `@oakestra/ui/theme.css`    | Maps the dashboard tokens (`bg-primary`, `text-muted-foreground`, `border`, chart colors, ...) to the shell's CSS variables, and defines the `dark:` variant. It contains no values; the shell owns them. |
| `@source './'`              | Tells Tailwind to scan the folder of `addon.css` (your `src/`) for class names.                                                                                                                           |

Rules:

- **No preflight.** Do not `@import 'tailwindcss'` (it includes the preflight reset) and do not
  import `@oakestra/ui/styles.css`. The shell already loaded both. A second reset, loaded later,
  overrides the shell's styles on the whole page.
- **Import `addon.css` from `src/index.tsx`** (`import './addon.css';`). The federation build
  then loads the CSS together with your module.
- **Use tokens for colors** (`bg-card`, `text-muted-foreground`, `border-border`, ...). They
  follow light and dark mode automatically. Dark mode is the `.dark` class on the page; use the
  `dark:` variant for anything extra.
- **Your CSS is global.** Tailwind utilities are harmless, because the shell generates the same
  ones. Any custom CSS you write applies to the whole dashboard, so keep it rare and scope it to
  your own class names.
- Classes used inside `@oakestra/ui` components are generated by the shell, not by your build.
- If you keep class names outside `src/`, add another `@source` line for them.

## The container

The addon UI ships as a container image that serves the static build. The shell never builds or
bundles your addon; it only downloads it at runtime.

### The contract

| Requirement           | Value                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Protocol and port     | Plain HTTP on port 80                                                                                                                                  |
| Container name        | `addonui-<name>`, for example `addonui-insights`                                                                                                       |
| Network               | A Docker network that the dashboard container is on. The dashboard's nginx resolves the name with Docker's DNS (`DNS_RESOLVER`, default `127.0.0.11`). |
| Files at the web root | `mf-manifest.json`, `remoteEntry.js`, `assets/...` (the Vite `dist/` folder)                                                                           |
| Cache headers         | See below                                                                                                                                              |

The dashboard's nginx (`apps/shell/docker/nginx.conf.template`) has this location:

```nginx
location ~ ^/addon-assets/([a-z0-9-]+)/(.*)$ {
  set $addon_upstream addonui-$1;
  proxy_pass http://$addon_upstream:80/$2$is_args$args;
  ...
}
```

So `/addon-assets/insights/mf-manifest.json` becomes `http://addonui-insights:80/mf-manifest.json`.
The name pattern `[a-z0-9-]+` keeps the proxy from reaching other containers. Because the
upstream is a variable, the dashboard starts even when no addon container exists; a missing
container gives an HTTP 502 for its files. The dashboard's nginx adds no cache headers of its own
on this path; the headers your container sends reach the browser.

In the planned Oakestra setup the addons monitor starts the container under the name
`addonui-<name>`. That part of the real addons engine does not exist yet. In this repository
the compose file `docker-compose.dev.yml` simply names a service `addonui-example`.

### Dockerfile and nginx config

The example's `Dockerfile` builds from the **repository root** (it needs the workspace packages):

```dockerfile
# Build context: repository root (docker build -f addons/example/Dockerfile .)
FROM node:24-alpine AS build
RUN npm install --global pnpm@12.16.1
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@oakestra/addon-example..."
RUN pnpm --filter @oakestra/addon-example build

# Addon UI contract: plain HTTP on port 80, reachable as addonui-<name> on the dashboard network.
FROM nginx:1.30-alpine
COPY --from=build /repo/addons/example/dist /usr/share/nginx/html
COPY addons/example/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

For your addon, replace `@oakestra/addon-example` with your package name and `addons/example`
with your folder (four places). Build with:

```sh
docker build -f addons/insights/Dockerfile -t addon-insights-ui .
```

`addons/example/docker/nginx.conf` sets the cache headers:

| Path                | `Cache-Control`                       | Why                                                                        |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `/mf-manifest.json` | `no-cache`                            | Same name in every release. Cached, it would keep loading the old version. |
| `/remoteEntry.js`   | `no-cache`                            | Same reason.                                                               |
| `/assets/...`       | `public, max-age=31536000, immutable` | File names contain a content hash, so a new release has new names.         |
| anything else       | none; missing files are 404           |                                                                            |

`no-cache` means "revalidate before use", not "never store". Keep these headers when you write
your own config. If a CDN or another proxy sits in front of the dashboard, it must respect them.

## The marketplace definition and `/ui-addons`

> **Status:** everything in this section is **planned** for the real Oakestra addons-manager and
> marketplace-manager. Today the real marketplace rejects a definition with a `ui` block (HTTP 422,
> `ui: Unknown field.`), never returns `ui`, and the real addons-manager has no `GET /ui-addons`.
> The mock in `tools/mock-addons-manager` implements the planned behavior when it runs with
> `UI_BLOCK_SUPPORT=true` (the compose file sets it). The dashboard already supports it.

### The `ui` block

An addon is described by a definition in the marketplace: name, description, services
(containers), volumes and networks. An addon with a UI adds a `ui` block:

```json
{
  "name": "insights",
  "description": "Cluster insights for the dashboard.",
  "services": [
    {
      "service_name": "insights-ui",
      "image": "ghcr.io/your-org/addon-insights-ui:0.1.0",
      "networks": ["oakestra-net"]
    }
  ],
  "networks": [{ "name": "oakestra-net", "driver": "bridge" }],
  "ui": { "service": "insights-ui", "sdk": "^0.1.0" }
}
```

| Field        | Meaning                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------- |
| `ui.service` | The `service_name` of the service that serves the UI. Must be one of the addon's `services`. |
| `ui.sdk`     | Semver range of the dashboard SDK the UI was built against, for example `^0.1.0`.            |

The definition `name` is the addon name. It must match the federation `name` and the
`defineAddon` `id`, and it gives the container name `addonui-<name>`.

The dashboard's addon manager (`/addon-manager/marketplace`, Admin only) can register such a
definition. Its form checks that `ui.service` is one of the services and that `ui.sdk` is a valid
semver range.

### `GET /ui-addons`

The shell calls `GET /ui-addons`. The dashboard's nginx proxies it to
`<ADDONS_MANAGER_ADDRESS>/api/v1/ui-addons` (default `root_addons_manager:11101`). The answer is
an array:

```json
[{ "name": "insights", "version": "0.1.0", "sdk": "^0.1.0" }]
```

| Field     | Rules in the shell               | Source in the mock                                                                                                                       |
| --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `name`    | Required, matches `^[a-z0-9-]+$` | Name of the installed addon                                                                                                              |
| `version` | Required, non-empty string       | Stored separately, default `0.1.0`; set with `PUT /__test/addons/<name>` `{ "version": "..." }`. No addon model has a version field yet. |
| `sdk`     | Required, valid semver range     | `ui.sdk` of the addon's marketplace definition                                                                                           |

The mock lists an addon when it is installed, its status is `active`, and its marketplace
definition has a `ui` block. The shell ignores invalid entries (console warning) and duplicate
names (the first one wins). How the real addons-manager will report `version` is not defined
yet.

If `/ui-addons` fails (no addons manager, HTTP error, no JSON), the shell treats addons as
unavailable. It keeps addons it already loaded and does not show an error toast.

Shell config (from the dashboard container's environment, rendered into `config.json`):

| Env var                   | Config field           | Default                     |
| ------------------------- | ---------------------- | --------------------------- |
| `UI_ADDONS_URL`           | `uiAddonsUrl`          | `/ui-addons`                |
| `ADDONS_POLL_INTERVAL_MS` | `addonsPollIntervalMs` | `15000` (minimum `1000`)    |
| `ADDONS_MANAGER_ADDRESS`  | nginx upstream         | `root_addons_manager:11101` |
| `DNS_RESOLVER`            | nginx `resolver`       | `127.0.0.11`                |

## Testing the production build locally

The dev override (see the [tutorial](README.md#step-9-run-it-locally-with-the-dev-override))
loads your Vite dev server. To test the **production build** with caching, relative URLs and the
`/ui-addons` flow, use one of these.

### Without Docker

Four terminals, from the repository root:

```sh
# 1. Build and serve your addon (vite preview, same port as the dev server)
pnpm --filter @oakestra/addon-insights build
pnpm --filter @oakestra/addon-insights preview

# 2. Mock addons manager with ui block support, on port 11101
UI_BLOCK_SUPPORT=true pnpm --filter @oakestra/mock-addons-manager start

# 3. Mock system-manager on port 10000 (or a real one)
pnpm --filter @oakestra/mock-system-manager start

# 4. Shell; ADDON_ASSETS mirrors the nginx /addon-assets/<name>/ proxy
ADDON_ASSETS=insights=http://localhost:5175 pnpm dev
```

Then make the mock list your addon (installed, active, with a `ui` block):

```sh
curl -X PUT http://localhost:11101/__test/addons/insights \
  -H 'content-type: application/json' \
  -d '{"enabled": true, "version": "0.1.0", "sdk": "^0.1.0"}'
```

Open `http://localhost:5173` and log in as `Admin` / `Admin`. `pnpm dev` proxies `/ui-addons` to
`ADDONS_MANAGER_URL` (default `http://localhost:11101`). Do not use `pnpm dev:mock` here: it
answers `/ui-addons` in the browser with an empty list.

### With Docker Compose

`docker-compose.dev.yml` runs production images of the shell, the example addon, the mock
addons manager and the mock system-manager. To add your addon without changing that file, create
an override file at the repository root, for example `compose.insights.yml`:

```yaml
services:
  addonui-insights:
    build:
      context: .
      dockerfile: addons/insights/Dockerfile
```

Start the stack with both files, then register the addon with the same `curl` command as above
(the mock is on host port 11101):

```sh
docker compose -f docker-compose.dev.yml -f compose.insights.yml up --build -d
```

The dashboard is on `http://localhost:8080`. The service name is the container's DNS name, which
is what the dashboard's nginx looks up.

## SDK versions and compatibility

The SDK is the contract between the shell and addons. Its version is `SDK_VERSION`, currently
`0.1.0`.

How the check works:

1. Your addon declares a semver range in the marketplace definition (`ui.sdk`), which reaches the
   shell as `sdk` in `/ui-addons`.
2. Before downloading anything, the shell checks `semver.satisfies(shellSdkVersion, range)`.
   Prerelease versions of the shell (for example `1.1.0-rc.1`) are accepted by matching ranges.
3. If the version does not satisfy the range, the addon gets the state `incompatible` with the
   message `Addon requires dashboard SDK <range>, this dashboard provides <version>`. Its files
   are not downloaded and none of its UI appears. Its page shows "Addon not compatible".

The shell does not read the range from your bundle. It trusts `/ui-addons`, so **keep `ui.sdk`
in sync with the SDK version you build against**. Use `^` plus that version, for example
`^0.1.0`.

The SDK's release rules for extension points (from `packages/dashboard-sdk/src/extension-points.ts`):

| Change                                                                    | SDK release |
| ------------------------------------------------------------------------- | ----------- |
| New extension point                                                       | Minor       |
| Renamed or removed extension point, incompatible change of a context type | Major       |

Other changes follow normal semver: additions are minor, anything that breaks existing addons is
major.

While the SDK is `0.x`, a caret range only allows patch releases: `^0.1.0` means
`>=0.1.0 <0.2.0`. The SDK treats a `0.x` minor release as possibly breaking.

An addon that uses an extension point the running shell does not know is not rejected. That
point's contributions are dropped with a console warning, and the rest of the addon works.

## Upgrades

| What happens in `/ui-addons`                  | What the shell does                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new addon appears                           | Loads it. Nav items, widgets and tabs appear without a reload.                                                                                                      |
| A loaded addon reports a new `version`        | Keeps running the old code. Shows a toast once per version: "A new version of `<name>` is available" with a **Reload** button. After the reload, the new code runs. |
| An addon disappears (disabled or uninstalled) | Removes its contributions. Its pages show "Addon disabled".                                                                                                         |
| A `failed` addon is still listed              | Retries the load on every poll (a container can be `active` before it serves files).                                                                                |
| An `incompatible` addon is still listed       | Retries only when its `version` or `sdk` changes.                                                                                                                   |

A loaded Module Federation module cannot be replaced inside a running React app, which is why an
upgrade needs a reload. When an admin installs an addon through the dashboard's addon manager,
the shell refreshes `/ui-addons` at once instead of waiting for the next poll.

Always change `version` when you ship new code. If the version stays the same, users get no
prompt; they get the new code only at their next page load (the manifest and `remoteEntry.js`
are `no-cache`).

## Current limitation: addons live in this repository

`@oakestra/dashboard-sdk` and `@oakestra/ui` are **not published to npm yet**. Addons therefore
live in this monorepo under `addons/`, depend on them with `workspace:*`, and build from the
repository root (see the Dockerfile above). `pnpm-workspace.yaml` already includes `addons/*`,
so a new folder there becomes a workspace package after `pnpm install`.

Running `pnpm lint`, `pnpm typecheck` and `pnpm build` at the root also checks and builds every
addon.

Once the packages are published, an addon can live in its own repository and depend on fixed
versions instead.
