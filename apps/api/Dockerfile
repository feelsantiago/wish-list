# API image (ADR-0046). Nx builds; Docker only packages.
#
# The build context is the `api:prune` output, never the repository root:
#   npx nx run api:docker-build
# which runs, after `api:prune`:
#   docker build -f apps/api/Dockerfile apps/api/dist
#
# Runs the server by default. The release step runs `node migrate.js` instead.
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first: a code-only change reuses this layer.
COPY package.json package-lock.json ./
COPY workspace_modules ./workspace_modules
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

USER node
EXPOSE 3000
CMD ["node", "main.js"]
