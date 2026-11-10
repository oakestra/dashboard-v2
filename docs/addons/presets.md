# Deployment presets

A preset customizes one dashboard deployment without rebuilding the image: which built-in
features are on, what the sidebar looks like and which addon UIs ship with the deployment. It is
meant for operators and for companies that run their own Oakestra with their own default set of
pages.

Without a preset every built-in feature is on, addon UIs come from the addons manager and the
sidebar is as the features declare it.

## Format

A preset is a JSON file. Point your editor at the JSON Schema for completion and checks (copy
[`apps/shell/preset.schema.json`](../../apps/shell/preset.schema.json) next to your file; the
examples in `apps/shell/presets/` use `../preset.schema.json`):

```json
{
  "$schema": "./preset.schema.json",
  "modules": ["overview", "applications", "profile", "settings", "help"],
  "home": "/applications",
  "addonDiscovery": true,
  "addons": [
    {
      "name": "acme-infra",
      "entry": "/bundled-addons/acme-infra/mf-manifest.json",
      "version": "1.2.0",
      "sdk": "^0.1.0",
      "mount": "/infrastructure"
    }
  ],
  "nav": {
    "groupLabels": { "main": "Workloads" },
    "items": {
      "addon:applications:applications": { "label": "Apps", "order": 5 },
      "addon:help:help": { "hidden": true }
    }
  }
}
```

Every object is strict: a misspelled key is an error, not silently ignored. A preset that does not
parse, names a module that does not exist, or has addons whose `mount` collides with a built-in
route stops the dashboard at startup with an error page that lists the problems. Examples to copy
are in [`apps/shell/presets/`](../../apps/shell/presets/): `default.json` (the same as no preset,
spelled out) and `minimal.json` (no admin features, addon discovery off).

| Field             | Meaning                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `modules`         | Built-in modules to enable, by id. Left out: all of them. `auth` is always on. |
| `home`            | Where `/` redirects when `overview` is not enabled. Required in that case.     |
| `addonDiscovery`  | `false` stops asking the addons manager (`/ui-addons`). Default `true`.        |
| `addons`          | Addon UIs that ship with the deployment, see [Preset addons](#preset-addons).  |
| `nav.items`       | Overrides for top-level sidebar items, see [Nav overrides](#nav-overrides).    |
| `nav.groupLabels` | Labels of the sidebar groups `main`, `management`, `addons` and `footer`.      |

## Modules

Module ids are a public contract: renaming one would break every preset that names it, so they
change only in a major version. They also share a namespace with addon names, so a preset addon
cannot be called like a core module. Some modules are addon packages linked into the dashboard
(kind `addon` in the table): they are selected the same way, and a preset addon with their name
replaces them, see [Replacing a linked module](#replacing-a-linked-module).

| Id               | Kind  | Contains                                                            | Nav item key                          |
| ---------------- | ----- | ------------------------------------------------------------------- | ------------------------------------- |
| `auth`           | core  | Login, password reset. Always on.                                   | none                                  |
| `overview`       | core  | The start page (`/`), showing the `home.widgets` of the others      | `core:overview:overview`              |
| `fleet`          | addon | Applications by cluster, with an inspector, at `/fleet`             | `addon:fleet:fleet`                   |
| `applications`   | addon | Applications, their services, instances and SLAs at `/applications` | `addon:applications:applications`     |
| `infrastructure` | addon | Clusters, the cluster map and cluster pages at `/infrastructure`    | `addon:infrastructure:infrastructure` |
| `users`          | addon | User management (Admin) at `/users`                                 | `addon:users:users`                   |
| `organizations`  | addon | Organizations and their members at `/organizations`                 | `addon:organizations:organizations`   |
| `addon-manager`  | core  | Installed addons and the marketplace (Admin)                        | `core:addon-manager:addon-manager`    |
| `profile`        | core  | The profile page of the current user                                | none (user menu)                      |
| `settings`       | core  | Platform-wide settings of the dashboard                             | `core:settings:settings`              |
| `help`           | addon | Help page at `/help`                                                | `addon:help:help`                     |

Services and SLA pages are part of `applications`: they are nested under
`/applications/:appId`.

The overview only greets the user and lays out what the other modules contribute as
`home.widgets`: `applications` brings the applications, services and instances tiles, "Needs
attention" and "Recent applications", `infrastructure` the clusters tile. Disabling a module
therefore also removes its tiles; with neither of the two the overview says it has nothing to show
yet. The same holds for the command palette (Ctrl or Cmd K): the actions and searches of a module
come from the module, so leaving it out removes them along with its pages. `fleet` is on by
default and goes away by leaving it out of `modules`, like any other. A replacement addon under a module's name brings its own widgets instead (or none). Single
widgets cannot be hidden or moved by a preset; the [widget table](reference.md#widget-sizes-on-the-overview)
lists their ids and orders, for addons that want to slot their own tiles in between.

### Hidden versus disabled

- A module left out of `modules` is **disabled**: its pages are gone (a typed URL shows "Page not
  found"), links to it from other pages are hidden, and its nav item does not exist.
- A nav item with `"hidden": true` is only **hidden**: the link is gone from the sidebar but the
  pages stay reachable by URL. Use it to declutter, not to restrict anything. Neither is an access
  control: the backend still decides what a user may do.

### `home`

The overview module owns `/`. If your preset leaves it out, set `home` to the path `/` should
redirect to, for example `"/applications"`. The preset is rejected without it, and `"/"` itself
(also with a query) is rejected because it would redirect to itself.

## Addon discovery

By default the dashboard asks the addons manager (`/ui-addons`) which addon UIs are active and
polls it. Set `"addonDiscovery": false` for deployments that run no addons manager. Pair that with
dropping `addon-manager` from `modules`. Preset addons keep working either way; one that failed to
load is retried every `ADDONS_POLL_INTERVAL_MS` until it succeeds.

## Preset addons

`addons` lists addon UIs that ship with the deployment. An entry is what the addons manager would
report (`name`, `version`, `sdk`, see [Packaging](packaging.md)) plus:

- `entry`: the URL of the addon's `mf-manifest.json`, either an absolute `http(s)` URL or a path on
  the dashboard's origin, such as `/bundled-addons/acme-infra/mf-manifest.json`.
- `mount` (optional): a top-level path, such as `/infrastructure`, where the addon is served
  instead of `/addons/<name>`. Lowercase letters, digits and hyphens, no parameters. It must not
  overlap a route of an enabled module and no two addons may share one. The check runs at startup.
  A visit to `/addons/<name>` of a mounted addon redirects to its mount.

The SDK compatibility check still applies. A preset addon is loaded as soon as the user is logged
in, without the addons manager. If `/ui-addons` also reports an addon with the same name, the
preset entry wins (the dashboard logs a warning), because the preset pins the version.

Typical uses: a company replacement for a built-in feature (drop `infrastructure`, mount your
own addon at `/infrastructure`), or extra pages that every installation of that company gets.

### Replacing a linked module

A preset addon named like a linked module (kind `addon` above, e.g. `help`) replaces it: the
built-in package is not loaded and your addon is served at the module's path (`/help`) unless the
entry sets its own `mount`. Links from other pages keep working. It does not have to be listed in
`modules`. Linked modules themselves do not appear in the addon manager; they are part of the
dashboard like the core modules.

In the addon manager, a preset addon is labeled "Part of this deployment" and cannot be disabled
or removed there; its detail view lists the nav item keys, which you need for overrides.

## Nav overrides

`nav.items` changes top-level sidebar items. The key is `kind:sourceId:itemId`:

- `core:settings:settings`: item `settings` of the built-in module `settings`.
- `addon:applications:applications`: item `applications` of the linked module `applications`.
- `addon:example:main`: item `main` of the addon `example`.

Fields, all optional: `label`, `order` (a number, lower first), `group` (`main`, `management`,
`addons` or `footer`) and `hidden`. Sub-items follow their parent. A `label` on an addon's own
item (the one that links to the addon itself) also renames the first breadcrumb of its pages. An
unknown key only logs a warning, because an addon may load late or not be installed.

To find the keys of an addon, open it in the addon manager (Addons, Installed) and read the nav
item keys in its detail view. Built-in keys are in the [module table](#modules).

## Delivering a preset

The image reads `PRESET_URL` (empty by default, meaning no preset). The dashboard fetches that URL
at startup, without caching, so editing the file and reloading is enough. nginx serves
`/preset.json` from `/usr/share/nginx/html/preset.json`.

**Mounted file.** Mount your `preset.json` and set `PRESET_URL=/preset.json`:

```sh
docker run -p 8080:80 \
  -e API_ADDRESS=10.0.0.5:10000 \
  -e PRESET_URL=/preset.json \
  -v "$PWD/preset.json:/usr/share/nginx/html/preset.json:ro" \
  ghcr.io/oakestra/dashboard-v2
```

```yaml
# compose
services:
  dashboard:
    image: ghcr.io/oakestra/dashboard-v2
    environment:
      API_ADDRESS: 10.0.0.5:10000
      PRESET_URL: /preset.json
    volumes:
      - ./preset.json:/usr/share/nginx/html/preset.json:ro
```

```yaml
# Kubernetes: a ConfigMap with the file, mounted over preset.json
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-preset
data:
  preset.json: |
    { "modules": ["overview", "applications", "profile", "settings", "help"], "addonDiscovery": false }
---
# in the Deployment's pod spec
containers:
  - name: dashboard
    image: ghcr.io/oakestra/dashboard-v2
    env:
      - { name: PRESET_URL, value: /preset.json }
    volumeMounts:
      - { name: preset, mountPath: /usr/share/nginx/html/preset.json, subPath: preset.json }
volumes:
  - name: preset
    configMap: { name: dashboard-preset }
```

**Derived image.** To ship your own addons without separate containers, build an image on top of
the dashboard. Build each addon (`pnpm build`) and copy its `dist/` to
`/usr/share/nginx/html/bundled-addons/<name>/`. nginx caches only the content-hashed files below
`assets/` for a year; the entry files (`mf-manifest.json`, `remoteEntry.js`) and everything else in
the folder, such as `index.html`, are revalidated on every load. An `index.html` there is served
but may not be framed:

```dockerfile
FROM ghcr.io/oakestra/dashboard-v2
COPY preset.json /usr/share/nginx/html/preset.json
COPY acme-infra/dist/ /usr/share/nginx/html/bundled-addons/acme-infra/
ENV PRESET_URL=/preset.json
```

The preset then refers to `"entry": "/bundled-addons/acme-infra/mf-manifest.json"`.

## Linked packages and remotes

Built-in features other than login, settings, profile and the addon manager are addon packages
(`modules/<name>`) written against the same contract as external addons (`defineAddon`, the SDK
hooks and `<Slot>`). They are linked into the shell, so they load like core code. None of them is
built as a remote yet. A package that needs its own release cycle can get a remote build later,
and a preset can already replace one with a company addon under the same mount (see
[Replacing a linked module](#replacing-a-linked-module)). Module ids and mounts stay stable either
way, so presets keep working.
