# Arklyn Office — production image (Next.js standalone server).
# Build:  docker build -t arklyn-office .
# Optional: --build-arg WITH_CLAUDE_CODE=true to ship the Claude Code CLI (~250 MB) for the Claude Code backend.

ARG WITH_CLAUDE_CODE=false

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=127.0.0.1
RUN groupadd --system --gid 1001 office && useradd --system --uid 1001 --gid office --create-home office
COPY --from=build --chown=office:office /app/.next/standalone ./
COPY --from=build --chown=office:office /app/.next/static ./.next/static
COPY --from=build --chown=office:office /app/public ./public

# The Agent SDK spawns a platform binary that output tracing does not pick up: ship it only when asked.
FROM base AS claude-code-false
FROM base AS claude-code-true
COPY --from=deps --chown=office:office /app/node_modules/@anthropic-ai ./node_modules/@anthropic-ai

FROM claude-code-${WITH_CLAUDE_CODE} AS run
USER office
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
