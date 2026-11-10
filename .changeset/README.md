# Changesets

Run `pnpm changeset` for any change to `@oakestra/dashboard-sdk`, `@oakestra/ui` or
`@oakestra/api`. `.github/workflows/release-packages.yml` turns pending changesets into a
`chore: version packages` PR; merging it publishes to npm.
