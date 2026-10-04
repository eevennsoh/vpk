---
description: AI SDK / Chat architecture — useChat, Rovo Serve, data parts, streaming
paths:
  - "app/contexts/**"
  - "app/api/chat-sdk/**"
  - "backend/chat/**"
  - "backend/routes/**"
  - "backend/lib/**"
  - "rovo/**"
  - "lib/rovo-*.ts"
  - "components/projects/rovo*/**"
  - "components/projects/studio/**"
---

# AI SDK / Chat Architecture

**Dependencies:** `ai` (core streaming/transport) and `@ai-sdk/react` (React hooks).

Frontend pattern:

- `useChat` hook from `@ai-sdk/react` manages message state, streaming, and submission
- Rovo app transports point to `API_ENDPOINTS.ROVO_APP_CHAT` (`/api/rovo/chat`); direct Chat SDK/demo surfaces use `/api/chat-sdk`
- Messages use the `UIMessage` type from `ai`
- Route-local `contextDescription` values are additive. When a route, demo, or suggestion adds hidden prompt context, merge it with provider defaults via `mergeRovoContextDescriptions()` instead of replacing existing board/work-item/suggestion scope.
- Keep route-local hidden context bounded with explicit start/end labels and route-owned tests for the formatting and merge path.

Custom data parts sent by the backend (`data-` prefix in SSE, stripped in frontend):

- `widget-loading` — signals widget loading state
- `widget-data` — delivers widget payload to the frontend
- `widget-error` — widget generation error
- `suggested-questions` — provides follow-up question suggestions
- `thinking-status` — thinking visualization state
- `thinking-event` — tool call lifecycle events (start/result/error phases)
- `agent-execution` — agent task execution updates
- `artifact-result` — artifact system output
- `cancel-streaming` — cancel signal to frontend
- `clear` — clear message content
- `finish` — stream completion marker
- `id` — message/stream identity
- `kind` — message kind metadata
- `title` — thread/artifact title update
- `route-decision` — routing metadata
- `tool-approval` — tool approval request (file/bash permissions)
- `turn-complete` — turn boundary signal

Backend streaming (`backend/chat/*`, mounted by route handlers):

- `createUIMessageStream` + `pipeUIMessageStreamToResponse` from `ai` handle SSE streaming

Rovo Serve integration (`backend/lib/rovo-gateway.js`):

- **Hybrid backend selection**: Chat SDK requests default to AI Gateway unless the caller selects Rovo. Rovo app managed runs start on AI Gateway and delegate artifact, plan, or tool-heavy turns to Rovo when available.
- Detection: reads `.dev-rovo-port` file → sets `ROVO_PORT` env var → pings `/healthcheck`
- Streaming: `streamViaRovo()` uses the V3 two-step API (`POST /v3/set_chat_message` then `GET /v3/stream_chat`)
- Non-streaming: `generateTextViaRovo()` wraps streaming for title generation, suggestions, and clarification cards
- If a request explicitly selects Rovo and `rovo serve` is unavailable, the backend returns 503 with instructions to restart

Key files:

- `app/contexts/context-rovo-chat.tsx` — `useChat` integration, data part handling, message transformation
- `rovo/config.js` — system prompt builder, model config, payload construction
- `backend/routes/chat-sdk.js` — Express route owner for `/api/chat-sdk`
- `backend/routes/rovo-chat-proxy.js` — Express route owner for Rovo chat proxy traffic
- `backend/chat/chat-sdk-handler.js` — Chat SDK streaming handler using `createUIMessageStream`
- `backend/chat/chat-sdk-handler-composition.js` — server dependency composition for Chat SDK handlers
- `backend/chat/rovo-stream.js` — Rovo app streaming orchestration
- `backend/lib/rovo-gateway.js` — Rovo Serve streaming/text bridge
- `backend/lib/rovo-client.js` — Low-level V3 REST + SSE client for `rovo serve`
- `backend/lib/ai-gateway-helpers.js` — AI Gateway helpers for chat, media, suggestions, and other gateway-backed flows
- `backend/server.js` — runtime startup, static serving, process listen, and WebSocket wiring
- `app/api/chat-sdk/route.ts` — dev proxy forwarding to Express; `/agents` referers default to AI Gateway if no backend preference is present
