# Build context: this directory (docker build -t addon-__NAME__-ui .)
# The bundle is the same for every platform, so build it once on the build host instead of under
# QEMU, where native bundler bindings can crash.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
RUN npm install --global pnpm@__PNPM_VERSION__
WORKDIR /app

# Commit pnpm-lock.yaml (run `pnpm install` once): the image builds from it.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Addon UI contract: plain HTTP on port 80, reachable as addonui-<name> on the dashboard network.
FROM nginx:1.30-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
# The nginx image renders templates/*.template with envsubst on start. Both variables must be
# defined, or the literal ${...} would end up in the config. API_UPSTREAM stays empty for a UI-only
# addon; set it to the backend's URL to enable /api/.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
ENV API_UPSTREAM=""

EXPOSE 80
