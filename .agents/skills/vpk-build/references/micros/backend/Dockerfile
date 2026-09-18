# Multi-stage: build Next static export, then serve via tiny Express.
# No pnpm install of hundreds of deps — the extracted project has a
# minimal dep set (typically <15 packages), so the builder stage is fast.

FROM node:20-alpine AS builder
WORKDIR /build

# Install pnpm and all deps (dev deps needed for `next build`).
COPY package*.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile=false

# Copy config and source.
COPY tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY hooks ./hooks
COPY public ./public
COPY scripts/prepare-static-export.mjs ./scripts/prepare-static-export.mjs

# Produce ./out/ (static export).
RUN NEXT_OUTPUT=export pnpm run build && node scripts/prepare-static-export.mjs out --compress

# ---- Production image ----
FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/server.js ./
COPY backend/lib ./lib
COPY --from=builder /build/out ./public

EXPOSE 8080
CMD ["node", "server.js"]
