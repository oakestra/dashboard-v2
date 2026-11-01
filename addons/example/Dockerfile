# Build context: repository root (docker build -f addons/example/Dockerfile .)
FROM node:24-alpine AS build
RUN npm install --global pnpm@12.16.1
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@oakestra/addon-example..."
RUN pnpm --filter @oakestra/addon-example build

# Addon UI contract: plain HTTP on port 80, reachable as addonui-<name> on the dashboard network.
FROM nginx:1.30-alpine
COPY --from=build /repo/addons/example/dist /usr/share/nginx/html
COPY addons/example/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
