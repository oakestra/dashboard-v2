---
'@oakestra/api': minor
---

Addon management: Zod models (`marketplaceAddonSchema`, `installedAddonSchema`, `registerAddonInputSchema`, status constants and `isTransitionalAddonStatus`) and the `createAddonsManagerApi` / `createMarketplaceApi` endpoint factories on top of `createAddonsClient`. They are separate from `createOakestraApi` because the addons-manager and marketplace-manager live behind their own base URLs.
