# syntax=docker/dockerfile:1.7

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json ./backend/package.json
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    corepack enable && \
    pnpm install --prod --frozen-lockfile --config.strict-dep-builds=false

COPY backend ./backend
COPY lib ./lib
COPY rovo ./rovo
# The scripts/lib modules the backend requires; backend/dockerfile-runtime-files.test.js
# fails when a backend require reaches a file this image does not copy.
COPY scripts/lib/dev-tmux-session.js ./scripts/lib/dev-tmux-session.js
COPY scripts/lib/pid-lock-file.js ./scripts/lib/pid-lock-file.js
COPY scripts/lib/worktree-ports.js ./scripts/lib/worktree-ports.js

# Copy the prebuilt Next.js export output (static HTML files).
# CI runs `pnpm run build:export` before building this runtime image.
COPY out ./backend/public

EXPOSE 8080

CMD ["node", "backend/server.js"]
