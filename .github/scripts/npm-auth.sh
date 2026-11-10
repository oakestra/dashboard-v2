#!/usr/bin/env bash
# Auth for the registries publish.ts uploads to: GitHub Packages always, npmjs.com when
# PUBLISH_TO_NPMJS is "true".
set -euo pipefail

npm config set //npm.pkg.github.com/:_authToken "$GITHUB_TOKEN"

# Only for the first npmjs publish: npmjs can't set up trusted publishing for a package that
# doesn't exist yet. Delete the secret once trusted publishing is configured.
if [ "${PUBLISH_TO_NPMJS:-}" = "true" ] && [ -n "${NPM_TOKEN:-}" ]; then
  npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
fi
