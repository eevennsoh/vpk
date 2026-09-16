# syntax=docker/dockerfile:1.7
# Source-backed runtime: one Express process owns APIs, WebSockets, and static export.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    corepack enable && \
    pnpm install --prod --frozen-lockfile --config.strict-dep-builds=false

COPY backend ./backend
COPY lib ./lib
COPY rovo ./rovo
COPY scripts/lib ./scripts/lib
COPY out ./backend/public

EXPOSE 8080
CMD ["node", "backend/extracted-server.js"]
