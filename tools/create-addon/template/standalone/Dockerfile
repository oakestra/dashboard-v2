# Build context: this directory (docker build -t addon-__NAME__-ui .)
FROM node:24-alpine AS build
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
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
