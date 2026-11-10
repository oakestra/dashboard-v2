# Changesets

Run `pnpm changeset` for any change to `@oakestra/dashboard-sdk`, `@oakestra/ui` or
`@oakestra/api`. `.github/workflows/release-packages.yml` turns pending changesets into a
`chore: version packages` PR; merging it publishes to npm.

The three packages are a `fixed` group: they always share one version, so addon authors only
need to know one number.

For prereleases (say, before an SDK minor or major that affects addons), run
`pnpm changeset pre enter beta` (or `rc`) and commit `.changeset/pre.json`. Version PRs then
produce `0.3.0-beta.0`, `-beta.1`, ..., published under the `beta` dist-tag. `pnpm changeset pre
exit` makes the next version PR the stable release under `latest`. Don't name it `canary`, that
tag belongs to the on-demand snapshots.
