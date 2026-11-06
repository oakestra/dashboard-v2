# Troubleshooting addon UIs

Start with the browser's developer tools. The shell logs addon problems to the console with the
prefix `[addons]`, and crashing contributions with `[addon:<name>]`.

## Quick reference

| Symptom                                                              | Likely cause                                                                | Fix                                                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Addon page says "No dashboard UI for ..."                            | The addon is not in `/ui-addons` (not active, no `ui` block, invalid entry) | Check `/ui-addons` and the console for `[addons] ignoring invalid /ui-addons entry`                               |
| Addon page says "Addons unavailable"                                 | `/ui-addons` failed (no addons manager, HTTP error, no JSON)                | Check the addons manager and `ADDONS_MANAGER_ADDRESS`. For local work use the dev override                        |
| Addon page says "Addon not compatible"                               | The shell's SDK version is outside the addon's `sdk` range                  | Fix `ui.sdk` in the definition, or rebuild against this SDK. See [states](#addon-states)                          |
| Addon page says "Addon failed to load"                               | Files not reachable, or the definition is invalid                           | Read the error under the message. See [states](#addon-states) and [definition errors](#invalid-definition-errors) |
| Addon page says "Addon disabled"                                     | The addon left `/ui-addons` during this session                             | Enable or reinstall it, then reload                                                                               |
| Addon page says "Page not found"                                     | The addon loaded, but no addon route matches the URL                        | Check route `path`s (relative, no leading `/`) and links (build them with `useAddonPath()`)                       |
| `useHostContext() was called outside the Oakestra dashboard shell`   | The addon has its own copy of the SDK                                       | See [below](#usehostcontext-was-called-outside-the-oakestra-dashboard-shell)                                      |
| "Invalid hook call" or hooks behave strangely                        | Two copies of React                                                         | See [duplicate React](#duplicate-react-or-invalid-hook-call)                                                      |
| Addon renders without styles                                         | `addon.css` not imported, or classes outside the scanned folder             | See [styles](#styles-missing-or-shell-styles-broken)                                                              |
| The whole dashboard looks different after the addon loads            | The addon loaded a second Tailwind preflight                                | See [styles](#styles-missing-or-shell-styles-broken)                                                              |
| An inline "... failed to render." with a Reload button               | That component threw an error                                               | See [a contribution crashes](#a-contribution-crashes)                                                             |
| Nav item, widget or tab does not appear                              | `roles` or `visible()` hides it, or the addon is not `loaded`               | Log in with a role that matches; check the addon state                                                            |
| Application tab does not appear                                      | Same as above. Without any contributed tab, the page shows no tabs at all   | Check that the addon is `loaded` and the tab is not hidden by `roles`                                             |
| A command or search result does not appear in Ctrl K                 | `roles` hides it, the query is too short, or the source fails               | See [my command does not appear](#my-command-does-not-appear)                                                     |
| Cluster widget does not appear                                       | The cluster page is only for `Admin` and `Infrastructure_Provider`          | Log in with one of these roles                                                                                    |
| Users still see the old version                                      | No reload yet, `version` unchanged, or caching                              | See [old version](#old-version-still-served)                                                                      |
| `?addon-override=...` has no effect                                  | Production build of the shell, or a wrong URL                               | See [dev override](#dev-override-not-applied)                                                                     |
| CORS errors or 404s for chunks from `localhost:5173` in dev          | Dev server CORS or `origin` setting                                         | See [CORS](#cors-errors-on-the-dev-server)                                                                        |
| `Port 5174 is already in use` when starting the dev server           | `strictPort: true` and another addon (or the example) uses the port         | Give each addon its own `port` in `oakestraAddon()` in `vite.config.ts`                                           |
| `vite build` fails with `class selector(s) without the addon prefix` | Your CSS contains classes that would override the shell's                   | See [unprefixed classes](#the-build-fails-with-class-selectors-without-the-addon-prefix)                          |

## Addon states

The shell keeps one state per addon UI. Admins see it in the addon manager
(`/addon-manager/installed`, nav "Addons") in the column **Dashboard UI**, and in the detail
sheet of an addon. On phones the column is hidden; open the detail sheet. Hover or focus a
"Failed" or "Incompatible" badge to see the reason. UIs without an installed addon (for example a
dev override) are listed in the section "Dashboard UIs without an installed addon".

| State          | Badge              | Meaning                                                                                             | Retried?                                  |
| -------------- | ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `loading`      | "Loading"          | The shell is downloading and checking the addon.                                                    | -                                         |
| `loaded`       | "Loaded" + version | Running. Routes and contributions are registered.                                                   | -                                         |
| `incompatible` | "Incompatible"     | The `sdk` range from `/ui-addons` does not include the shell's SDK version. Nothing was downloaded. | Only when `version` or `sdk` changes      |
| `failed`       | "Failed"           | Download or validation failed. The message says why.                                                | On every `/ui-addons` poll (default 15 s) |
| (none)         | "None"             | The addon ships no UI or is not active.                                                             | -                                         |

The same states show on the addon's own page (`/addons/<name>`): a skeleton while loading,
"Addon not compatible" or "Addon failed to load" with the error text. Admins also get a "Manage
addons" button there.

### `incompatible`

The message reads `Addon requires dashboard SDK <range>, this dashboard provides <version>`.

- Your definition's `ui.sdk` must include the SDK version of the running dashboard. For SDK
  `0.1.0` use `^0.1.0`.
- Remember that `^0.1.0` does not include `0.2.0`. See
  [SDK versions](packaging.md#sdk-versions-and-compatibility).
- After you fix the range, the shell retries at the next poll (the `sdk` value changed).

### `failed`

Common errors:

| Error text (in the badge tooltip or on the addon page)                  | Cause                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Module Federation runtime error about the manifest or a fetch failure | `/addon-assets/<name>/mf-manifest.json` is not reachable. The container is missing, not named `addonui-<name>`, not on the dashboard's network, or not ready. A missing container gives HTTP 502. Open the URL in the browser to check. |
| `loadRemote("<name>/addon") returned nothing`                           | The remote has no `./addon` expose. Check that `vite.config.ts` uses `oakestraAddon()` and its `entry` (default `./src/index.tsx`).                                                                                                     |
| `./addon has no default export with an addon definition`                | `src/index.tsx` does not `export default defineAddon({...})`.                                                                                                                                                                           |
| `Invalid addon definition: ...`                                         | See [invalid definition errors](#invalid-definition-errors).                                                                                                                                                                            |
| `Addon definition id "<a>" does not match the addon name "<b>"`         | `id` in `defineAddon` differs from the name in `/ui-addons`. Use `id: ADDON_ID` from `virtual:oakestra-addon` and check `name` in `oakestraAddon()` against the marketplace definition.                                                 |

A failed addon is retried on every poll, because a container can be `active` in the addons
manager before nginx inside it serves files. The full error is also in the console:
`[addons] failed to load "<name>"`.

## Invalid definition errors

The shell validates your `defineAddon({...})` object with Zod. The error starts with
`Invalid addon definition:` and lists each problem with its path, for example
`contributions.nav.items[0].path`. TypeScript catches most of these at build time; the runtime
check also protects against JavaScript addons and version drift.

| Problem             | Example                                                                | Fix                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Id mismatch         | `id: 'Insights'`, but `/ui-addons` says `insights`                     | Use the exact same name everywhere (see [what must match](README.md#step-2-what-must-match))                                                              |
| Absolute nav path   | `path: '/addons/insights'`                                             | Nav paths (including those of `children`) are relative: `path: ''` for the index, `path: 'jobs'` for a sub page. URLs like `https://...` are rejected too |
| Absolute route path | `{ path: '/jobs', ... }`                                               | `{ path: 'jobs', ... }`                                                                                                                                   |
| Duplicate ids       | Two `home.widgets` items with `id: 'main'`                             | Ids must be unique per extension point within your addon, and sub-item ids among the `children` of one nav item                                           |
| Missing field       | A widget without `title`, a tab without `label`                        | Add the field (see the [reference](reference.md#extension-points))                                                                                        |
| Not a component     | `component: 'MyWidget'` (a string), or `undefined` from a wrong import | Pass the component itself: `component: MyWidget`. An element (`<MyWidget />`) passes validation but fails when it renders                                 |

**Unknown extension points are not an error.** The shell drops them and logs
`[addons] <name>: ignoring unknown extension points [...]`. The rest of the addon loads. If your
contribution is missing and you see this warning, check the point id for typos, or the running
shell is older than the SDK you used.

## `useHostContext() was called outside the Oakestra dashboard shell`

The full message: `useHostContext() was called outside the Oakestra dashboard shell. If this
runs inside the shell, check that @oakestra/dashboard-sdk is shared as a singleton in the
federation config.`

The SDK's hooks read a React context that the shell provides. If your addon uses its own copy of
the SDK module, it reads its own, empty context. Check:

- `vite.config.ts` uses `oakestraAddon()` from `@oakestra/dashboard-sdk/vite`, which shares the
  SDK with `withoutFallback(sharedDeps)`, and no second federation plugin of its own.
- You import the SDK only as `@oakestra/dashboard-sdk`, never as a file path into
  `packages/dashboard-sdk/src`.
- The component is rendered by the shell (as a page or contribution). The hooks do not work in a
  standalone page, a test without providers, or a separate React root you created yourself.

In tests, render the component with `renderInHost` from `@oakestra/dashboard-sdk/testing` (see
[Testing](reference.md#testing)).

A related error, `useAddonContext() can only be used inside UI contributed by an addon.`, means
`useAddonContext()`, `useAddonBasePath()` or `useAddonPath()` ran outside an addon page or
contribution. Nav item icons are rendered outside that context.

## Duplicate React or "Invalid hook call"

React hooks fail when a component is rendered by one copy of React and calls hooks of another.
The same goes for React Router and TanStack Query: a second copy does not see the shell's router
or `QueryClient` ("No QueryClient set" and similar errors).

- Build with `oakestraAddon()`. It shares these libraries with `import: false`, so your build
  contains no copy of them.
- Import `react-router`, never `react-router/dom`. The `/dom` entry bundles its own copy of the
  router contexts.
- Do not import `@oakestra/ui` through deep paths (`@oakestra/ui/src/...`). Use the root or the
  subpaths `/chart`, `/data-table`, `/command`, `/map`. Lint reports deep imports.
- A third-party library that needs a provider from the shell does not work: it is bundled into
  your addon and has its own context.

## Styles missing or shell styles broken

Your addon renders, but without styles:

- `src/index.tsx` must import the stylesheet: `import './addon.css';`. Without it, the CSS is not
  part of the loaded module.
- `addon.css` must contain `@source './';` (relative to the CSS file). Tailwind only generates
  classes it finds in scanned files. Add more `@source` lines for class names outside `src/`.
- Every class needs your prefix (`ex:text-sm`, not `text-sm`). Unprefixed classes are not
  generated by your build; some still work by accident because the shell happens to use them.
- Class names built at runtime (`` `bg-${color}-500` ``) are not found by the scanner. Write full
  class names.

Parts of the shell disappear or change layout (often the sidebar) once your addon loads:

- Your stylesheet contains unprefixed classes. It loads after the shell's, so a `.hidden` or
  `.flex` in it overrides the shell's responsive classes. `vite build` with `oakestraAddon()`
  fails in that case, see [below](#the-build-fails-with-class-selectors-without-the-addon-prefix).
  An addon built without the plugin has no such check.

The whole dashboard changes (fonts, margins, buttons) after your addon loads:

- Your CSS includes Tailwind's preflight reset a second time. Do not `@import 'tailwindcss';` and
  do not import `@oakestra/ui/styles.css`. Use exactly the three imports from
  `addons/example/src/addon.css`. See [styling](packaging.md#styling).
- Custom CSS rules in your addon are global. Scope them to your own class names.

Colors look wrong in dark mode: use token classes (`bg-card`, `text-muted-foreground`, ...)
instead of fixed colors, or add `dark:` variants.

## The build fails with "class selectors without the addon prefix"

`oakestraAddon()` checks every CSS file of the build. A class selector that does not start with
your prefix (`.ex\:...`) would apply to the shell's markup too and could override its classes,
so the build stops (the dev server prints the same text as a warning):

```text
[plugin oakestra-addon]
RolldownError: assets/src-DYVShKiM.css: 2 class selectors without the addon prefix "ex:":
  .card-title
  .ex\:x .hidden
The addon stylesheet loads after the shell's in the same cascade layer, ...
```

- **Listed selectors** come from CSS written by hand in `addon.css` (or another stylesheet you
  import), since Tailwind prefixes the utilities of your code. Write custom classes as
  `@utility card-title { ... }` in `addon.css` and use them as `ex:card-title`; Tailwind gives
  them the prefix. Do not import third-party stylesheets with global class names. Only the bare
  `.dark` class is allowed unprefixed.
- **`no class selector carries the configured prefix "ex:", all of them start with "ins:"`**:
  `addon.css` uses `prefix(ins)` but `vite.config.ts` says `prefix: 'ex'`. Use the same prefix in
  both places, and on every class.
- **`no class selector carries the prefix "ex:"`**: `addon.css` has no `prefix(...)`, so Tailwind
  generates plain utilities (also for class-like words in comments). Add it:
  `@import 'tailwindcss/theme.css' layer(theme) prefix(ex);`, and prefix every class.

## A contribution crashes

Every widget, tab and addon page runs inside its own error boundary. When one throws, only
place shows a calm inline state instead: `<title or label> from <addon> failed to render.`, a
note that the rest of the page keeps working, a **Reload** button (it renders the component
again) and a collapsed **Error details** with the error message. If the addon's code could not
be downloaded at all, the button is **Reload page**. For a page the label is "Page". The console shows `[addon:<name>] <label> crashed`.
The rest of the page, the sidebar and other contributions keep working.

Other isolation rules:

- A `visible()` function that throws hides only its item and logs
  `[extensions] visible() threw, hiding contribution`.
- A nav item icon that throws is hidden; the link stays.

Try it with the example addon: its "Crash test" home widget (`ThrowingWidget`) throws when
`localStorage` has `oakestra.example.throw` set to `1`. In the browser console:

```js
localStorage.setItem('oakestra.example.throw', '1');
location.reload();
```

Remove it with `localStorage.removeItem('oakestra.example.throw')`. Remove `ThrowingWidget`
when you copy the example.

## My command does not appear

The "Find or run anything" palette (Ctrl or Cmd K) shows what addons contribute at
`command.actions` and `command.sources`. If yours is missing:

- **Roles.** `roles` on the action or source hides it from everyone else. Log in with a matching
  role. The palette itself needs a login.
- **The addon is not `loaded`.** A `failed` or `incompatible` addon contributes nothing. Admins
  get a notice with a link to the addon manager after about 30 seconds of a failure.
- **Invalid definition.** An action needs exactly one of `path` and `run`, and its `path` must be
  relative to the addon's base path (no leading `/`, no `..`). Otherwise the addon fails with a
  message that names the contribution, see [definition errors](#invalid-definition-errors).
- **Source results.** A source is only called for queries of at least `minQueryLength`
  characters (default 2). Results need a unique `id` and a `label`, and an absolute `path`
  from `ctx.addon.path(...)` (or a `run`). An invalid one is dropped with a console warning
  `[commands] <source>: ignoring invalid result`, and a source returns at most 20.
- **The source fails.** The palette then shows "<label> could not be searched" and keeps the
  other groups. Look in the console and the network tab. `search` has five seconds and an
  `AbortSignal`; a rejected or slow request, or a result that is not an array, counts as failing.
- **`navigate` throws.** `ctx.navigate()` takes absolute paths only. Use `ctx.addon.path(...)`.
- **The module is switched off.** A preset that leaves a built-in module out removes its commands
  and searches with it.

## Old version still served

- **The page was not reloaded.** A loaded addon is never swapped in a running page. When
  `/ui-addons` reports a new `version`, the shell shows "A new version of `<name>` is available"
  with a **Reload** button, once per version.
- **`version` did not change.** Then there is no prompt. Users get the new code at their next page
  load. Bump `version` with every release.
- **Caching.** `mf-manifest.json` and `remoteEntry.js` keep their names in every release and must
  be sent with `Cache-Control: no-cache`. Check the response headers of
  `/addon-assets/<name>/mf-manifest.json` in the browser's network tab. If you wrote your own
  nginx config, copy the rules from `addons/example/docker/nginx.conf`. A CDN or proxy in front of
  the dashboard must not cache these two files.
- **The old container still runs.** Check which image `addonui-<name>` runs.

## Dev override not applied

The dev override (`?addon-override=<name>=<manifest URL>`) loads an addon from a local Vite dev
server. Check:

- **Development build only.** It works with `pnpm dev` and `pnpm dev:mock` of the shell. Production
  builds (the Docker image, the compose stack on port 8080) ignore it completely; the code is
  removed at build time.
- **The format.** `?addon-override=insights=http://localhost:5175/mf-manifest.json`. The name must
  match `^[a-z0-9-]+$` and the URL must be `http:` or `https:`, pointing at `mf-manifest.json`.
  Invalid values are ignored without a message.
- **It is stored.** The shell saves overrides in `localStorage` under `oakestra.addon-overrides`
  and applies them on every page load until you remove them. Remove one with an empty URL:
  `?addon-override=insights=`. Or delete the key in the developer tools.
- **It is read once per page load.** Changing `localStorage` by hand needs a reload.
- **The dev server runs.** Open the manifest URL in the browser.

An override wins over the entry from `/ui-addons` for the same name. If the addon is not in
`/ui-addons`, the override adds it with version `0.0.0-dev` and SDK range `*`. Overrides also work
when `/ui-addons` is unreachable, as long as the shell never received a list in this page load.

## CORS errors on the dev server

The shell runs on `http://localhost:5173`, your addon's dev server on another port. The browser
therefore needs CORS headers, and asset URLs must point at the dev server:

- `oakestraAddon()` sets `server.cors` and `preview.cors` to `true`. Do not set them to `false`
  in `vite.config.ts`.
- It also sets `server.origin` to the dev server address (`http://localhost:<port>`). It makes
  the URLs of your dev assets absolute. Without it, some URLs are root-relative, and the browser
  asks the shell on `localhost:5173` for your files, which fails with 404s. If you set your own
  `server.origin` (another host name, for example), it must still point at the dev server.
- If you change `port`, `origin` follows automatically. Update the override URL too.
