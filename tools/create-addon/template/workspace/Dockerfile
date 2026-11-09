# Build context: repository root (docker build -f addons/__NAME__/Dockerfile .)
FROM node:24-alpine AS build
RUN npm install --global pnpm@__PNPM_VERSION__
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "__PACKAGE_NAME__..."
RUN pnpm --filter __PACKAGE_NAME__ build

# Addon UI contract: plain HTTP on port 80, reachable as addonui-<name> on the dashboard network.
FROM nginx:1.30-alpine
COPY --from=build /repo/addons/__NAME__/dist /usr/share/nginx/html
COPY addons/__NAME__/docker/default.conf.template /etc/nginx/templates/default.conf.template
# The nginx image renders templates/*.template with envsubst on start. Both variables must be
# defined, or the literal ${...} would end up in the config. API_UPSTREAM stays empty for a UI-only
# addon; set it to the backend's URL to enable /api/.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
ENV API_UPSTREAM=""

EXPOSE 80
