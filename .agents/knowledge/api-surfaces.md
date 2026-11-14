# API Surfaces — generated endpoint tables

Generated file. Do not edit by hand — run `node scripts/generate-api-surfaces.js`.

Judgment guidance lives in `.agents/rules/api-surfaces.md`; the tables live here because Claude Code
loads that rule into the session as soon as a file in its scope is read, and the tables would
ride along each time (see the Contextual Rules section of `AGENTS.md`). Source of truth is
`backend/routes/route-manifest.json`.

## Generated Endpoint Tables

<!-- generated:begin -->
<!-- Do not edit this section by hand. Run `node scripts/generate-api-surfaces.js`. -->

Generated from `backend/routes/route-manifest.json`.

### Backend Routes

| Method | Path | Runtime admin | Source |
| --- | --- | --- | --- |
| `GET` | `/api/agent-mode` | no | `backend/routes/agent-mode.js` |
| `POST` | `/api/agent-mode` | no | `backend/routes/agent-mode.js` |
| `POST` | `/api/agents/rfp-demo/agent/apply` | no | `backend/routes/demos.js` |
| `POST` | `/api/agents/rfp-demo/events/ticket-entered-column` | no | `backend/routes/demos.js` |
| `POST` | `/api/agents/rfp-demo/reset` | no | `backend/routes/demos.js` |
| `GET` | `/api/agents/rfp-demo/state` | no | `backend/routes/demos.js` |
| `POST` | `/api/agents/rfp-demo/state` | no | `backend/routes/demos.js` |
| `POST` | `/api/agents/rfp-demo/vpk-html-report` | no | `backend/routes/demos.js` |
| `GET` | `/api/browser-workspaces` | yes | `backend/routes/browser-workspaces.js` |
| `POST` | `/api/browser-workspaces` | yes | `backend/routes/browser-workspaces.js` |
| `DELETE` | `/api/browser-workspaces/:workspaceId` | yes | `backend/routes/browser-workspaces.js` |
| `GET` | `/api/browser-workspaces/:workspaceId` | yes | `backend/routes/browser-workspaces.js` |
| `GET` | `/api/browser-workspaces/:workspaceId/:action` | yes | `backend/routes/browser-workspaces.js` |
| `POST` | `/api/browser-workspaces/:workspaceId/:action` | yes | `backend/routes/browser-workspaces.js` |
| `POST` | `/api/browser-workspaces/:workspaceId/preview-session` | yes | `backend/routes/browser-workspaces.js` |
| `DELETE` | `/api/browser-workspaces/:workspaceId/preview-session/:sessionId` | yes | `backend/routes/browser-workspaces.js` |
| `GET` | `/api/browser-workspaces/:workspaceId/tabs` | yes | `backend/routes/browser-workspaces.js` |
| `POST` | `/api/browser-workspaces/:workspaceId/tabs` | yes | `backend/routes/browser-workspaces.js` |
| `DELETE` | `/api/browser-workspaces/:workspaceId/tabs/:tabIndex` | yes | `backend/routes/browser-workspaces.js` |
| `POST` | `/api/browser-workspaces/:workspaceId/tabs/:tabIndex/activate` | yes | `backend/routes/browser-workspaces.js` |
| `POST` | `/api/chat-cancel` | no | `backend/routes/chat-control.js` |
| `POST` | `/api/chat-sdk` | no | `backend/routes/chat-sdk.js` |
| `POST` | `/api/chat-sdk/skip-question` | no | `backend/routes/chat-skip-question.js` |
| `POST` | `/api/chat-title` | no | `backend/routes/ai-utilities.js` |
| `GET` | `/api/checkpoints` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/checkpoints` | yes | `backend/routes/rovo-app.js` |
| `DELETE` | `/api/checkpoints/:id` | yes | `backend/routes/rovo-app.js` |
| `POST` | `/api/checkpoints/:id/rollback` | yes | `backend/routes/rovo-app.js` |
| `GET` | `/api/chromium-preview` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/back` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/click` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/click-ref` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/fill-ref` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/forward` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/hover-ref` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/press` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/reload` | yes | `backend/routes/chromium-preview.js` |
| `GET` | `/api/chromium-preview/screenshot` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/scroll` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/select-ref` | yes | `backend/routes/chromium-preview.js` |
| `GET` | `/api/chromium-preview/snapshot` | yes | `backend/routes/chromium-preview.js` |
| `GET` | `/api/chromium-preview/stream` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/type` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/type-ref` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/viewport` | yes | `backend/routes/chromium-preview.js` |
| `POST` | `/api/chromium-preview/wheel` | yes | `backend/routes/chromium-preview.js` |
| `DELETE` | `/api/claim-test` | no | `backend/routes/demos.js` |
| `GET` | `/api/claim-test` | no | `backend/routes/demos.js` |
| `POST` | `/api/claim-test` | no | `backend/routes/demos.js` |
| `POST` | `/api/genui-chat` | no | `backend/routes/genui.js` |
| `POST` | `/api/genui-description-summary` | no | `backend/routes/ai-utilities.js` |
| `POST` | `/api/genui-export` | no | `backend/routes/genui.js` |
| `GET` | `/api/health` | no | `backend/routes/status.js` |
| `POST` | `/api/html-selector/dispatch` | no | `backend/routes/html-selector.js` |
| `GET` | `/api/html-selector/tokens` | no | `backend/routes/html-selector.js` |
| `GET` | `/api/image-proxy` | no | `backend/routes/media.js` |
| `POST` | `/api/local-folder` | no | `backend/routes/local-folder.js` |
| `DELETE` | `/api/orchestrator/log` | yes | `backend/routes/orchestrator.js` |
| `GET` | `/api/orchestrator/log` | no | `backend/routes/orchestrator.js` |
| `GET` | `/api/orchestrator/timeline` | no | `backend/routes/orchestrator.js` |
| `POST` | `/api/personal-graph/capture` | no | `backend/routes/personal-graph.js` |
| `GET` | `/api/personal-graph/explorer` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/ingest` | no | `backend/routes/personal-graph.js` |
| `GET` | `/api/personal-graph/log` | no | `backend/routes/personal-graph.js` |
| `GET` | `/api/personal-graph/page/*slug` | no | `backend/routes/personal-graph.js` |
| `PUT` | `/api/personal-graph/page/*slug` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/raw` | no | `backend/routes/personal-graph.js` |
| `GET` | `/api/personal-graph/search` | no | `backend/routes/personal-graph.js` |
| `GET` | `/api/personal-graph/source` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/source` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/summarize` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/twg/chat` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/twg/expand` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/twg/refresh` | no | `backend/routes/personal-graph.js` |
| `GET` | `/api/personal-graph/unprocessed-count` | no | `backend/routes/personal-graph.js` |
| `GET` | `/api/personal-graph/vault` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/vault/reset` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/personal-graph/vault/select` | no | `backend/routes/personal-graph.js` |
| `POST` | `/api/plan-title` | no | `backend/routes/ai-utilities.js` |
| `GET` | `/api/realtime/audio-conversation-token` | no | `backend/routes/realtime.js` |
| `GET` | `/api/rovo/background-streams` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/cancel-deferred-tool` | no | `backend/routes/chat-control.js` |
| `POST` | `/api/rovo/chat` | no | `backend/routes/rovo-chat-proxy.js` |
| `POST` | `/api/rovo/detach` | no | `backend/routes/rovo-app.js` |
| `DELETE` | `/api/rovo/documents` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/documents` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/documents` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/files/:fileId` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/files/upload` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/generated-media` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/messages` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/messages` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/runs/:threadId/cancel` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/runs/:threadId/detach` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/runs/:threadId/stream` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/suggestions` | no | `backend/routes/ai-utilities.js` |
| `DELETE` | `/api/rovo/threads` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/threads` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/threads` | no | `backend/routes/rovo-app.js` |
| `DELETE` | `/api/rovo/threads/:threadId` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/threads/:threadId` | no | `backend/routes/rovo-app.js` |
| `PUT` | `/api/rovo/threads/:threadId` | no | `backend/routes/rovo-app.js` |
| `DELETE` | `/api/rovo/threads/:threadId/browser-workspace` | yes | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/threads/:threadId/browser-workspace` | yes | `backend/routes/rovo-app.js` |
| `POST` | `/api/rovo/threads/:threadId/browser-workspace` | yes | `backend/routes/rovo-app.js` |
| `GET` | `/api/rovo/votes` | no | `backend/routes/rovo-app.js` |
| `PATCH` | `/api/rovo/votes` | no | `backend/routes/rovo-app.js` |
| `GET` | `/api/sessions/search` | no | `backend/routes/rovo-app.js` |
| `POST` | `/api/sound-generation` | no | `backend/routes/media.js` |
| `POST` | `/api/speech-transcription` | no | `backend/routes/media.js` |
| `POST` | `/api/standup` | no | `backend/routes/demos.js` |
| `GET` | `/api/status` | no | `backend/routes/status.js` |
| `GET` | `/api/status/rovo` | no | `backend/routes/status.js` |
| `POST` | `/api/studio/agent-data-flow` | no | `backend/routes/ai-utilities.js` |
| `POST` | `/api/ticket-classify` | no | `backend/routes/demos.js` |
| `GET` | `/api/vpk-html` | no | `backend/routes/vpk-html.js` |
| `GET` | `/api/vpk-html/*assetPath` | no | `backend/routes/vpk-html.js` |
| `POST` | `/api/vpk-html/apply-tokens` | no | `backend/routes/vpk-html.js` |
| `GET` | `/api/vpk-html/notes` | no | `backend/routes/vpk-html.js` |
| `PUT` | `/api/vpk-html/notes` | no | `backend/routes/vpk-html.js` |
| `POST` | `/api/vpk-html/publish-gist` | no | `backend/routes/vpk-html.js` |
| `GET` | `/healthcheck` | no | `backend/routes/status.js` |

### Next API Proxy Routes

| Method | Next path | Backend targets | Source |
| --- | --- | --- | --- |
| `GET` | `/api/agent-mode` | `GET /api/agent-mode` | `app/api/agent-mode/route.ts` |
| `POST` | `/api/agent-mode` | `POST /api/agent-mode` | `app/api/agent-mode/route.ts` |
| `POST` | `/api/agents/rfp-demo/agent/apply` | `POST /api/agents/rfp-demo/agent/apply` | `app/api/agents/rfp-demo/agent/apply/route.ts` |
| `POST` | `/api/agents/rfp-demo/events/ticket-entered-column` | `POST /api/agents/rfp-demo/events/ticket-entered-column` | `app/api/agents/rfp-demo/events/ticket-entered-column/route.ts` |
| `POST` | `/api/agents/rfp-demo/reset` | `POST /api/agents/rfp-demo/reset` | `app/api/agents/rfp-demo/reset/route.ts` |
| `GET` | `/api/agents/rfp-demo/state` | `GET /api/agents/rfp-demo/state` | `app/api/agents/rfp-demo/state/route.ts` |
| `POST` | `/api/agents/rfp-demo/state` | `POST /api/agents/rfp-demo/state` | `app/api/agents/rfp-demo/state/route.ts` |
| `POST` | `/api/agents/rfp-demo/vpk-html-report` | `POST /api/agents/rfp-demo/vpk-html-report` | `app/api/agents/rfp-demo/vpk-html-report/route.ts` |
| `GET` | `/api/browser-workspaces` | `GET /api/browser-workspaces` | `app/api/browser-workspaces/route.ts` |
| `POST` | `/api/browser-workspaces` | `POST /api/browser-workspaces` | `app/api/browser-workspaces/route.ts` |
| `DELETE` | `/api/browser-workspaces/:workspaceId` | `DELETE /api/browser-workspaces/:workspaceId` | `app/api/browser-workspaces/[workspaceId]/route.ts` |
| `GET` | `/api/browser-workspaces/:workspaceId` | `GET /api/browser-workspaces/:workspaceId` | `app/api/browser-workspaces/[workspaceId]/route.ts` |
| `GET` | `/api/browser-workspaces/:workspaceId/:action` | `GET /api/browser-workspaces/:workspaceId/:action` | `app/api/browser-workspaces/[workspaceId]/[action]/route.ts` |
| `POST` | `/api/browser-workspaces/:workspaceId/:action` | `POST /api/browser-workspaces/:workspaceId/:action` | `app/api/browser-workspaces/[workspaceId]/[action]/route.ts` |
| `POST` | `/api/browser-workspaces/:workspaceId/preview-session` | `POST /api/browser-workspaces/:workspaceId/preview-session` | `app/api/browser-workspaces/[workspaceId]/preview-session/route.ts` |
| `DELETE` | `/api/browser-workspaces/:workspaceId/preview-session/:sessionId` | `DELETE /api/browser-workspaces/:workspaceId/preview-session/:sessionId` | `app/api/browser-workspaces/[workspaceId]/preview-session/[sessionId]/route.ts` |
| `GET` | `/api/browser-workspaces/:workspaceId/tabs` | `GET /api/browser-workspaces/:workspaceId/tabs` | `app/api/browser-workspaces/[workspaceId]/tabs/route.ts` |
| `POST` | `/api/browser-workspaces/:workspaceId/tabs` | `POST /api/browser-workspaces/:workspaceId/tabs` | `app/api/browser-workspaces/[workspaceId]/tabs/route.ts` |
| `DELETE` | `/api/browser-workspaces/:workspaceId/tabs/:tabIndex` | `DELETE /api/browser-workspaces/:workspaceId/tabs/:tabIndex` | `app/api/browser-workspaces/[workspaceId]/tabs/[tabIndex]/route.ts` |
| `POST` | `/api/browser-workspaces/:workspaceId/tabs/:tabIndex/activate` | `POST /api/browser-workspaces/:workspaceId/tabs/:tabIndex/activate` | `app/api/browser-workspaces/[workspaceId]/tabs/[tabIndex]/activate/route.ts` |
| `POST` | `/api/chat-cancel` | `POST /api/chat-cancel` | `app/api/chat-cancel/route.ts` |
| `POST` | `/api/chat-sdk` | `POST /api/chat-sdk` | `app/api/chat-sdk/route.ts` |
| `POST` | `/api/chat-sdk/skip-question` | `POST /api/chat-sdk/skip-question` | `app/api/chat-sdk/skip-question/route.ts` |
| `POST` | `/api/chat-title` | `POST /api/chat-title` | `app/api/chat-title/route.ts` |
| `GET` | `/api/checkpoints` | `GET /api/checkpoints` | `app/api/checkpoints/route.ts` |
| `POST` | `/api/checkpoints` | `POST /api/checkpoints` | `app/api/checkpoints/route.ts` |
| `DELETE` | `/api/checkpoints/:id` | `DELETE /api/checkpoints/:id` | `app/api/checkpoints/[id]/route.ts` |
| `POST` | `/api/checkpoints/:id/rollback` | `POST /api/checkpoints/:id/rollback` | `app/api/checkpoints/[id]/rollback/route.ts` |
| `GET` | `/api/chromium-preview` | `GET /api/chromium-preview` | `app/api/chromium-preview/route.ts` |
| `POST` | `/api/chromium-preview` | `POST /api/chromium-preview` | `app/api/chromium-preview/route.ts` |
| `POST` | `/api/chromium-preview/:action` | `POST /api/chromium-preview/:action` | `app/api/chromium-preview/[action]/route.ts` |
| `GET` | `/api/chromium-preview/screenshot` | `GET /api/chromium-preview/screenshot` | `app/api/chromium-preview/screenshot/route.ts` |
| `GET` | `/api/chromium-preview/snapshot` | `GET /api/chromium-preview/snapshot` | `app/api/chromium-preview/snapshot/route.ts` |
| `GET` | `/api/chromium-preview/stream` | `GET /api/chromium-preview/stream` | `app/api/chromium-preview/stream/route.ts` |
| `POST` | `/api/genui-chat` | `POST /api/genui-chat` | `app/api/genui-chat/route.ts` |
| `POST` | `/api/genui-description-summary` | `POST /api/genui-description-summary` | `app/api/genui-description-summary/route.ts` |
| `POST` | `/api/genui-export` | `POST /api/genui-export` | `app/api/genui-export/route.ts` |
| `GET` | `/api/health` | `GET /api/health` | `app/api/health/route.ts` |
| `POST` | `/api/html-selector/dispatch` | `POST /api/html-selector/dispatch` | `app/api/html-selector/dispatch/route.ts` |
| `GET` | `/api/html-selector/tokens` | `GET /api/html-selector/tokens` | `app/api/html-selector/tokens/route.ts` |
| `DELETE` | `/api/orchestrator/log` | `DELETE /api/orchestrator/log` | `app/api/orchestrator/log/route.ts` |
| `GET` | `/api/orchestrator/log` | `GET /api/orchestrator/log` | `app/api/orchestrator/log/route.ts` |
| `GET` | `/api/orchestrator/timeline` | `GET /api/orchestrator/timeline` | `app/api/orchestrator/timeline/route.ts` |
| `POST` | `/api/personal-graph/capture` | `POST /api/personal-graph/capture` | `app/api/personal-graph/capture/route.ts` |
| `GET` | `/api/personal-graph/explorer` | `GET /api/personal-graph/explorer` | `app/api/personal-graph/explorer/route.ts` |
| `POST` | `/api/personal-graph/ingest` | `POST /api/personal-graph/ingest` | `app/api/personal-graph/ingest/route.ts` |
| `GET` | `/api/personal-graph/log` | `GET /api/personal-graph/log` | `app/api/personal-graph/log/route.ts` |
| `GET` | `/api/personal-graph/page/*slug` | `GET /api/personal-graph/page/*slug` | `app/api/personal-graph/page/[...slug]/route.ts` |
| `PUT` | `/api/personal-graph/page/*slug` | `PUT /api/personal-graph/page/*slug` | `app/api/personal-graph/page/[...slug]/route.ts` |
| `POST` | `/api/personal-graph/raw` | `POST /api/personal-graph/raw` | `app/api/personal-graph/raw/route.ts` |
| `GET` | `/api/personal-graph/search` | `GET /api/personal-graph/search` | `app/api/personal-graph/search/route.ts` |
| `GET` | `/api/personal-graph/source` | `GET /api/personal-graph/source` | `app/api/personal-graph/source/route.ts` |
| `POST` | `/api/personal-graph/source` | `POST /api/personal-graph/source` | `app/api/personal-graph/source/route.ts` |
| `POST` | `/api/personal-graph/summarize` | `POST /api/personal-graph/summarize` | `app/api/personal-graph/summarize/route.ts` |
| `POST` | `/api/personal-graph/twg/chat` | `POST /api/personal-graph/twg/chat` | `app/api/personal-graph/twg/chat/route.ts` |
| `POST` | `/api/personal-graph/twg/expand` | `POST /api/personal-graph/twg/expand` | `app/api/personal-graph/twg/expand/route.ts` |
| `POST` | `/api/personal-graph/twg/refresh` | `POST /api/personal-graph/twg/refresh` | `app/api/personal-graph/twg/refresh/route.ts` |
| `GET` | `/api/personal-graph/unprocessed-count` | `GET /api/personal-graph/unprocessed-count` | `app/api/personal-graph/unprocessed-count/route.ts` |
| `GET` | `/api/personal-graph/vault` | `GET /api/personal-graph/vault` | `app/api/personal-graph/vault/route.ts` |
| `POST` | `/api/personal-graph/vault/reset` | `POST /api/personal-graph/vault/reset` | `app/api/personal-graph/vault/reset/route.ts` |
| `POST` | `/api/personal-graph/vault/select` | `POST /api/personal-graph/vault/select` | `app/api/personal-graph/vault/select/route.ts` |
| `POST` | `/api/plan-title` | `POST /api/plan-title` | `app/api/plan-title/route.ts` |
| `GET` | `/api/realtime/audio-conversation-token` | `GET /api/realtime/audio-conversation-token` | `app/api/realtime/audio-conversation-token/route.ts` |
| `GET` | `/api/realtime/ws-url` |  | `app/api/realtime/ws-url/route.ts` |
| `GET` | `/api/rovo/background-streams` | `GET /api/rovo/background-streams` | `app/api/rovo/background-streams/route.ts` |
| `POST` | `/api/rovo/cancel-deferred-tool` | `POST /api/rovo/cancel-deferred-tool` | `app/api/rovo/cancel-deferred-tool/route.ts` |
| `POST` | `/api/rovo/chat` | `POST /api/rovo/chat` | `app/api/rovo/chat/route.ts` |
| `POST` | `/api/rovo/detach` | `POST /api/rovo/detach` | `app/api/rovo/detach/route.ts` |
| `DELETE` | `/api/rovo/documents` | `DELETE /api/rovo/documents` | `app/api/rovo/documents/route.ts` |
| `GET` | `/api/rovo/documents` | `GET /api/rovo/documents` | `app/api/rovo/documents/route.ts` |
| `POST` | `/api/rovo/documents` | `POST /api/rovo/documents` | `app/api/rovo/documents/route.ts` |
| `GET` | `/api/rovo/files/:fileId` | `GET /api/rovo/files/:fileId` | `app/api/rovo/files/[fileId]/route.ts` |
| `POST` | `/api/rovo/files/upload` | `POST /api/rovo/files/upload` | `app/api/rovo/files/upload/route.ts` |
| `GET` | `/api/rovo/generated-media` | `GET /api/rovo/generated-media` | `app/api/rovo/generated-media/route.ts` |
| `GET` | `/api/rovo/messages` | `GET /api/rovo/messages` | `app/api/rovo/messages/route.ts` |
| `POST` | `/api/rovo/messages` | `POST /api/rovo/messages` | `app/api/rovo/messages/route.ts` |
| `POST` | `/api/rovo/runs/:threadId/cancel` | `POST /api/rovo/runs/:threadId/cancel` | `app/api/rovo/runs/[threadId]/cancel/route.ts` |
| `POST` | `/api/rovo/runs/:threadId/detach` | `POST /api/rovo/runs/:threadId/detach` | `app/api/rovo/runs/[threadId]/detach/route.ts` |
| `GET` | `/api/rovo/runs/:threadId/stream` | `GET /api/rovo/runs/:threadId/stream` | `app/api/rovo/runs/[threadId]/stream/route.ts` |
| `POST` | `/api/rovo/suggestions` | `POST /api/rovo/suggestions` | `app/api/rovo/suggestions/route.ts` |
| `DELETE` | `/api/rovo/threads` | `DELETE /api/rovo/threads` | `app/api/rovo/threads/route.ts` |
| `GET` | `/api/rovo/threads` | `GET /api/rovo/threads` | `app/api/rovo/threads/route.ts` |
| `POST` | `/api/rovo/threads` | `POST /api/rovo/threads` | `app/api/rovo/threads/route.ts` |
| `DELETE` | `/api/rovo/threads/:threadId` | `DELETE /api/rovo/threads/:threadId` | `app/api/rovo/threads/[threadId]/route.ts` |
| `GET` | `/api/rovo/threads/:threadId` | `GET /api/rovo/threads/:threadId` | `app/api/rovo/threads/[threadId]/route.ts` |
| `PUT` | `/api/rovo/threads/:threadId` | `PUT /api/rovo/threads/:threadId` | `app/api/rovo/threads/[threadId]/route.ts` |
| `GET` | `/api/rovo/votes` | `GET /api/rovo/votes` | `app/api/rovo/votes/route.ts` |
| `PATCH` | `/api/rovo/votes` | `PATCH /api/rovo/votes` | `app/api/rovo/votes/route.ts` |
| `GET` | `/api/sessions/search` | `GET /api/sessions/search` | `app/api/sessions/search/route.ts` |
| `POST` | `/api/sound-generation` | `POST /api/sound-generation` | `app/api/sound-generation/route.ts` |
| `POST` | `/api/speech-transcription` | `POST /api/speech-transcription` | `app/api/speech-transcription/route.ts` |
| `POST` | `/api/sprint-board/tasks` |  | `app/api/sprint-board/tasks/route.ts` |
| `POST` | `/api/standup` | `POST /api/standup` | `app/api/standup/route.ts` |
| `GET` | `/api/status` | `GET /api/status` | `app/api/status/route.ts` |
| `GET` | `/api/status/rovo` | `GET /api/status/rovo` | `app/api/status/rovo/route.ts` |
| `POST` | `/api/studio/agent-data-flow` | `POST /api/studio/agent-data-flow` | `app/api/studio/agent-data-flow/route.ts` |
| `POST` | `/api/ticket-classify` | `POST /api/ticket-classify` | `app/api/ticket-classify/route.ts` |
| `GET` | `/api/vpk-html` | `GET /api/vpk-html` | `app/api/vpk-html/route.ts` |
| `GET` | `/api/vpk-html/*assetPath` | `GET /api/vpk-html/*assetPath` | `app/api/vpk-html/[...assetPath]/route.ts` |
| `POST` | `/api/vpk-html/apply-tokens` | `POST /api/vpk-html/apply-tokens` | `app/api/vpk-html/apply-tokens/route.ts` |
| `GET` | `/api/vpk-html/notes` | `GET /api/vpk-html/notes` | `app/api/vpk-html/notes/route.ts` |
| `PUT` | `/api/vpk-html/notes` | `PUT /api/vpk-html/notes` | `app/api/vpk-html/notes/route.ts` |
| `POST` | `/api/vpk-html/publish-gist` | `POST /api/vpk-html/publish-gist` | `app/api/vpk-html/publish-gist/route.ts` |

<!-- generated:end -->
