# Build context: repository root (docker build -f tools/mock-system-manager/Dockerfile .)
FROM node:24-alpine
RUN npm install --global pnpm@12.16.1
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --prod

COPY . .
RUN pnpm install --offline --frozen-lockfile --prod --filter "@oakestra/mock-system-manager..."

# Runs from the workspace on purpose: Node only strips TypeScript types outside node_modules, and
# the workspace packages are symlinks into packages/, so their sources stay outside it.
WORKDIR /repo/tools/mock-system-manager
ENV PORT=10000
EXPOSE 10000
USER node
CMD ["node", "src/server.ts"]
