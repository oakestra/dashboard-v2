# Packaging and shipping an addon UI

The reference implementation is `addons/example`.

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

An addon is a Vite project. The `oakestraAddon()` plugin from `@oakestra/dashboard-sdk/vite`
holds everything the shell expects from the build; next to it you only add React and Tailwind.
This is `addons/example/vite.config.ts`:

```ts
import { oakestraAddon } from '@oakestra/dashboard-sdk/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `name` is the addon name in /ui-addons and the definition id (ADDON_ID); `prefix` the one of
    // prefix(ex) in src/addon.css.
    oakestraAddon({ name: 'example', prefix: 'ex', port: 5174 }),
  ],
});
```

The options:

| Option   | Default             | Meaning                                                                                                                                                                                   |
| -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`   | required            | The addon name: Module Federation container name (the shell loads `<name>/addon`), the name in `/ui-addons` and the container suffix `addonui-<name>`. Lowercase letters, digits and `-`. |
| `prefix` | required            | Your Tailwind prefix, the same as `prefix(...)` in `addon.css`. Lowercase letters only. See [styling](#styling).                                                                          |
| `entry`  | `'./src/index.tsx'` | The module the shell loads. Its default export must be your `defineAddon({...})`.                                                                                                         |
| `port`   | `5174`              | Port of the dev server and of `vite preview`. Give every addon its own.                                                                                                                   |

Invalid values fail when Vite loads the config, with a message that names the option.

What the plugin sets up:

| Setting                                      | Purpose                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `exposes: { './addon': entry }`              | The module the shell loads. The key `./addon` is fixed.                                                                            |
| `shared: { ...withoutFallback(sharedDeps) }` | Take React, React Router, TanStack Query, the SDK and `@oakestra/ui` from the shell. See below.                                    |
| `manifest: true`                             | Emits `mf-manifest.json`. The shell loads addons by this manifest.                                                                 |
| `filename: 'remoteEntry.js'`                 | Name of the remote entry file. The container's nginx config marks it `no-cache` by this name.                                      |
| `publicPath: 'auto'`                         | Chunk URLs are resolved relative to the manifest URL, so the same build works under `/addon-assets/<name>/` and from a dev server. |
| `dts: false`                                 | No type generation for remotes; the SDK provides the types.                                                                        |
| `base: './'` in builds, `'/'` in dev         | Relative asset URLs in the production build, for the same reason.                                                                  |
| `build.target: 'esnext'`                     | The federation runtime uses top-level `await`.                                                                                     |
| `server.port`, `server.strictPort`           | `port`. A port in use is an error instead of a silent switch to another port, which would break the override URL.                  |
| `server.origin: http://localhost:<port>`     | Makes dev asset URLs absolute, so the shell (on another port) fetches them from the dev server.                                    |
| `server.cors`, `preview.cors`, preview port  | The shell runs on another origin (`localhost:5173`) and needs CORS to load your files.                                             |

The federation options (the first six rows) are the contract with the shell and cannot be
changed. The others are defaults: a value in your own `vite.config.ts` wins, for example
`server: { host: true }` or another `base`.

The plugin also does two checks for you:

- **Prefix check.** `vite build` fails when the CSS it emits contains a class selector without
  your prefix, and `vite` (dev) prints the same message as a warning. See [styling](#styling).
- **One addon name.** Source files import the name instead of repeating it, so the definition id
  cannot differ from `name`:

  ```ts
  import { ADDON_ID } from 'virtual:oakestra-addon';

  export default defineAddon({ id: ADDON_ID /* ... */ });
  ```

  For the types, `tsconfig.json` lists `"@oakestra/dashboard-sdk/vite/client"` in
  `compilerOptions.types`. Tests that import it need the plugin as well: the example's
  `vitest.config.ts` extends `vite.config.ts` (Module Federation switches itself off under
  Vitest).

`vite`, `@module-federation/vite` and `@tailwindcss/vite` are dev dependencies of the addon. The
first two are optional peer dependencies of the SDK, needed only for `@oakestra/dashboard-sdk/vite`.

### Shared dependencies

`sharedDeps` (in `packages/dashboard-sdk/src/federation.ts`) is the single list of shared
libraries for the shell and every addon. All of them are **singletons**: exactly one copy exists
on the page.

| Package                                                                                                                  | `requiredVersion`              |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `react`                                                                                                                  | `^19.0.0`                      |
| `react-dom`                                                                                                              | `^19.0.0`                      |
| `react-router`                                                                                                           | `^8.0.0`                       |
| `@tanstack/react-query`                                                                                                  | `^5.0.0`                       |
| `@oakestra/dashboard-sdk`                                                                                                | `^0.1.0` (`^` + `SDK_VERSION`) |
| `@oakestra/ui`                                                                                                           | `^0.1.0` (`^` + ui version)    |
| `@oakestra/ui/chart`, `@oakestra/ui/data-table`, `@oakestra/ui/command`, `@oakestra/ui/map`, `@oakestra/ui/location-map` | `^0.1.0`                       |

The `@oakestra/ui` range is `^` plus the version of the `@oakestra/ui` your addon resolves at
build time (from the project that runs `vite`), so it follows the ui copy you compile against. If
that package cannot be resolved, a built-in constant is used. Below 1.0.0 a caret allows patch
releases only: `^0.1.0` does not include `0.2.0`.

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
@import 'tailwindcss/theme.css' layer(theme) prefix(ex);
@import 'tailwindcss/utilities.css' layer(utilities);
@import '@oakestra/ui/theme.css';

@source './';
```

Line by line:

| Line                        | Why                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tailwindcss/theme.css`     | Tailwind's default theme (spacing, colors such as `fuchsia-600`), so utilities resolve. `prefix(ex)` puts your addon's prefix on every class, see below.                                                  |
| `tailwindcss/utilities.css` | Generates the utility classes your files use.                                                                                                                                                             |
| `@oakestra/ui/theme.css`    | Maps the dashboard tokens (`bg-primary`, `text-muted-foreground`, `border`, chart colors, ...) to the shell's CSS variables, and defines the `dark:` variant. It contains no values; the shell owns them. |
| `@source './'`              | Tells Tailwind to scan the folder of `addon.css` (your `src/`) for class names.                                                                                                                           |

Rules:

- **Prefix every class.** Write `ex:flex ex:gap-2 ex:md:hidden`, not `flex gap-2 md:hidden`. The
  prefix comes first, before variants. Your stylesheet loads after the shell's, in the same
  cascade layer, so an unprefixed utility it generates (say `.hidden`, picked up from a comment)
  would win over the shell's own responsive classes and could hide the sidebar. With a prefix,
  your classes never match shell markup and the shell's never match yours. Unprefixed classes in
  your code are not generated at all, so a missing prefix shows up right away as missing styles.
- **Pick a prefix of your own** and pass the same one to `oakestraAddon({ prefix })` in
  `vite.config.ts`. Tailwind accepts lowercase letters only (`a-z`, no digits or hyphens). Two
  addons with the same prefix can override each other's responsive classes, so use something
  unique: your addon name without the other characters is a safe choice (`ex` is the example's).
- **The build checks it.** `vite build` fails when the emitted CSS contains a class selector
  without your prefix, and lists the selectors and the file. The only exception is the bare
  `.dark` theme class, which the `dark:` variant refers to (`.ex\:dark\:x:is(.dark *)`). With
  the prefix in `addon.css`, such selectors come from CSS written by hand or imported: define
  custom classes with `@utility card-title { ... }` in `addon.css` and use them as
  `ex:card-title` (Tailwind prefixes them too), and do not import stylesheets with global class
  names. When no class has your prefix at all, the error says whether `addon.css` uses another
  prefix or none. `vite` (dev) prints the same message as a warning.
- **Prefix classes you pass to `@oakestra/ui` components too** (`<Button className="ex:w-full">`).
  `cn()` keeps both your class and the component's conflicting one (it does not know your
  prefix); yours usually wins because your stylesheet loads after the shell's. It still loses to
  more specific component classes such as `has-[>svg]:px-3`. An unprefixed class there only works
  if the shell happens to generate it.
- **No preflight.** Do not `@import 'tailwindcss'` (it includes the preflight reset) and do not
  import `@oakestra/ui/styles.css`. The shell already loaded both. A second reset, loaded later,
  overrides the shell's styles on the whole page.
- **Import `addon.css` from `src/index.tsx`** (`import './addon.css';`). The federation build
  then loads the CSS together with your module.
- **Use tokens for colors** (`bg-card`, `text-muted-foreground`, `border-border`, ...). They
  follow light and dark mode automatically. Dark mode is the `.dark` class on the page; use the
  `dark:` variant for anything extra.
- **Your CSS is global.** Prefixed utilities are safe, but any custom CSS you write applies to the
  whole dashboard, so keep it rare and use `@utility` for your own classes.
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
on this path; the headers your container sends reach the browser. The same path carries your
addon's backend: `/addon-assets/insights/api/...` reaches your container as `/api/...`, which is
what `useAddonApi()` calls. Add a `/api/` location to your container's nginx config (including the
server-sent events settings) as described in
[Calling your addon's backend](reference.md#calling-your-addons-backend); the `create-addon`
template already has it, driven by the `API_UPSTREAM` environment variable.

In the planned Oakestra setup the addons monitor starts the container under the name
`addonui-<name>`. That part of the real addons engine does not exist yet. In this repository
the compose file `compose.dev.yml` names a service `addonui-example`.

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

`pnpm create:addon` writes this file for your addon. By hand, replace `@oakestra/addon-example`
with your package name and `addons/example` with your folder (four places). Build with:

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

An addon made with `pnpm create:addon` has this file as `docker/default.conf.template` and also an
optional `/api/` proxy for the addon's own backend (`useAddonApi()`). Its Dockerfile copies the
template to `/etc/nginx/templates/` and defines `API_UPSTREAM` as empty, so a UI-only addon answers
`/api/` with 404. Run the container with `-e API_UPSTREAM=http://<backend>:<port>` to enable it
(scheme, host and port only: a path or trailing slash would replace every request's path).

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

The definition `name` is the addon name. It must match `name` in `oakestraAddon()` (and thereby
the `defineAddon` `id`, see [build configuration](#build-configuration)), and it gives the
container name `addonui-<name>`.

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

`compose.dev.yml` runs production images of the shell, the example addon, the mock
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
docker compose -f compose.dev.yml -f compose.insights.yml up --build -d
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

`@oakestra/dashboard-sdk`, `@oakestra/ui` and `@oakestra/api` are **not published to npm yet**.
Addons therefore
live in this monorepo under `addons/`, depend on them with `workspace:*`, and build from the
repository root (see the Dockerfile above). `pnpm-workspace.yaml` already includes `addons/*`,
so a new folder there becomes a workspace package after `pnpm install`.

Running `pnpm lint`, `pnpm typecheck` and `pnpm build` at the root also checks and builds every
addon.

The packages are ready for that: each one builds to `dist/` (ES modules and type declarations),
and CI copies `addons/example` out of the repository, installs the packed packages into it and
runs its typecheck, tests and build (`pnpm pack:check`). Once they are on npm, an addon can live
in its own repository:

- Install `@oakestra/dashboard-sdk` and `@oakestra/ui` from npm, in the versions of the dashboard
  you target. `@oakestra/api` comes with the SDK; add it yourself only if you import its types.
- Install the peer dependencies as well: `react`, `react-dom`, `react-router`,
  `@tanstack/react-query` and `tailwindcss`, `vite` and `@module-federation/vite` for
  `@oakestra/dashboard-sdk/vite`, plus `@testing-library/react` if your tests use
  `@oakestra/dashboard-sdk/testing`.
- `@oakestra/tsconfig` is internal to this repository and not published. Replace the `extends`
  in `tsconfig.json` with the compiler options of `packages/tsconfig/base.json` and
  `packages/tsconfig/react.json`.
- The Dockerfile builds the addon from its own directory (`pnpm install --frozen-lockfile`, then
  `pnpm build`) instead of filtering the workspace.

`pnpm create:addon <name> --dir <path>` does all of this for a new addon: it writes the addon
outside the repository with `@oakestra/*` as semver ranges of the current package versions, a
self-contained `tsconfig.json`, a Dockerfile that builds from the addon's own directory and a
short README. The packages must be on npm before `pnpm install` works there; `pnpm pack:check`
builds such a generated addon against the packed tarballs on every CI run.

`vite.config.ts`, `src/addon.css` and the code stay as they are: they import the same
specifiers. To try this before the first release, `pnpm pack:check --dir <dir>` (an empty
directory outside the repository) keeps such a copy, installed from the packed tarballs.
