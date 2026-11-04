# Build context: repository root (docker build -f apps/shell/Dockerfile .)
FROM node:24-alpine AS build
RUN npm install --global pnpm@12.16.1
WORKDIR /repo

# Fetching only needs the lockfile, so this layer survives source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@oakestra/shell..."

# "true" exposes window.__OAK_DEBUG__ for the e2e suite. Never set it for release images.
ARG VITE_OAK_DEBUG=false
ENV VITE_OAK_DEBUG=${VITE_OAK_DEBUG}
RUN pnpm --filter @oakestra/shell build

FROM nginx:1.30-alpine
LABEL org.opencontainers.image.source="https://github.com/oakestra/dashboard"

COPY --from=build /repo/apps/shell/dist /usr/share/nginx/html
# The dev config would otherwise be served until the entrypoint overwrites it.
RUN rm -f /usr/share/nginx/html/config.json
COPY apps/shell/docker/nginx.conf.template apps/shell/docker/config.json.template /etc/oakestra/
COPY --chmod=0755 apps/shell/docker/entrypoint.sh /usr/local/bin/oakestra-entrypoint.sh

# API_URL wins over API_ADDRESS. API_ADDRESS (host:port of the system manager) is what the Angular
# dashboard used, so existing compose files keep working.
ENV API_URL="" \
    API_ADDRESS="" \
    UI_ADDONS_URL="/ui-addons" \
    ADDONS_POLL_INTERVAL_MS="15000" \
    GRAFANA_URL="" \
    ADDONS_MANAGER_URL="/addons-api" \
    MARKETPLACE_URL="/marketplace-api" \
    PRESET_URL="" \
    ADDONS_MANAGER_ADDRESS="root_addons_manager:11101" \
    MARKETPLACE_ADDRESS="marketplace_manager:11102" \
    DNS_RESOLVER="127.0.0.11"

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/oakestra-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
