/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "true" for e2e builds to expose `window.__OAK_DEBUG__`. */
  readonly VITE_OAK_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
