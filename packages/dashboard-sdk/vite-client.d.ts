/**
 * Types of the module that `oakestraAddon()` from `@oakestra/dashboard-sdk/vite` provides to
 * addon source files. Add `"@oakestra/dashboard-sdk/vite/client"` to `compilerOptions.types` in
 * the addon's tsconfig.json.
 *
 * A script file on purpose (no top-level import or export): only there does `declare module`
 * declare a new module instead of augmenting an existing one.
 */
declare module 'virtual:oakestra-addon' {
  /** The `name` passed to `oakestraAddon()` in vite.config.ts, the id for `defineAddon()`. */
  export const ADDON_ID: string;
}
