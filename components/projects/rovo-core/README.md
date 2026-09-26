# Rovo Core

`rovo-core` owns behavior that is shared by the `/rovo` and `/studio` app
surfaces. Route adapters and route hooks keep product-specific policy at the
edge so shared code does not grow route conditionals.

## Route Behavior Matrix

| Behavior | `/rovo` | `/studio` | Current owner |
| --- | --- | --- | --- |
| Route root | `/rovo` | `/studio` | `rovo-app-adapter.ts` and `studio-app-adapter.ts` |
| Queue provider | Thin route re-export of shared queue context | Thin route re-export of shared queue context | `rovo-core/hooks/use-rovo-app-queue.tsx` |
| Queue processing | Shared idle wait, peek/gate/shift/dispatch loop, active dispatch flag, re-prepend, and send-settle retry | Same shared loop with a Studio-owned immediate-dispatch pause callback before queue shift | `rovo-core/lib/rovo-app-queue-state.ts` plus route callbacks |
| Thread list refresh | Shared focus/visibility refresh, optimistic deletion, and 15s passive refresh option | Same shared lifecycle with serialized no-op refresh suppression and no passive interval | `rovo-core/hooks/use-rovo-app-thread-list.ts` |
| Persistence key | Shared thread persistence key includes title, messages, visibility, active artifact state, and route thread id | Same shared key shape | `rovo-core/lib/rovo-app-thread-route-sync.ts` |
| Thread hydration and navigation | Shared refresh, hydrate-by-id, blank reset, active-thread background persistence, route popstate handling, missing-thread recovery, and pending thread creation lifecycle | Same shared lifecycle; Studio creation/send-mode policy stays outside the helper | `rovo-core/lib/rovo-app-thread-lifecycle.ts` plus route callbacks |
| Thread deletion | Shared optimistic deletion lifecycle, queued action cleanup, and active run reset callback | Same shared lifecycle; Studio agent/demo policy stays outside the hook | `rovo-core/lib/rovo-app-thread-deletion.ts` |
| Title generation | Shared pending-title request validation, AI title resolution, assistant-text fallback, and pending-state clear | Same shared lifecycle | `rovo-core/lib/rovo-app-title-lifecycle.ts` plus route callbacks |
| Suggested questions | Shared streaming/queue suppression, request dedupe, abort handling, stale-thread guard, backend-unavailable suppression, and assistant-message append | Same shared lifecycle | `rovo-core/lib/rovo-app-suggestions-lifecycle.ts` plus route callbacks |
| App header | Shared brand, back button, artifact menu, new-chat action, and optional route-owned menu content | Same shared header with a Studio-owned send-mode footer slot | `rovo-core/components/rovo-app-header.tsx` plus route wrappers |
| Surface shell | Shared top-navigation shell, hover-reveal sidebar lifecycle, thread deletion transition, and thread selection routing | Same shared shell; route wrapper supplies Studio product id, root path, thread-list hook, path builder, and sidebar | `rovo-core/components/rovo-app-surface-shell.tsx` plus route wrappers |
| Shell pane layout | Shared resizable artifact/chat split and animated overlay pane | Same shared layout; Studio shell passes agent config into the core priority pane | `rovo-core/components/rovo-app-shell-pane-layout.tsx` |
| API client paths | Shared Rovo app endpoints from `API_ENDPOINTS` | Same shared endpoint set, with Studio chat body options | `rovo-core/lib/api.ts` plus route adapter chat options |
| Chat transport | Shared AI SDK transport construction, API endpoint, and prepared request body bridge | Same shared transport; Studio route adapter contributes source and creation-mode options | `rovo-core/hooks/use-rovo-app-chat-transport.ts`, `rovo-core/lib/rovo-app-hook-helpers.ts`, and route adapters |
| Chat request body | Plain Rovo app body; no Studio source flag; no creation mode passthrough | Adds `chatSdkSource: "studio"` and allows validated `creationMode` | `rovo-core/lib/rovo-app-hook-helpers.ts`, `rovo-core/lib/rovo-app-route-adapter.ts`, and route adapters |
| Creation mode | Not exposed by the public hook contract | Supports `agent` and `skill` creation continuation metadata | Studio route hook, shared payload helpers |
| Send mode | Queue-first behavior | Queue or immediate mode, with immediate interruption side effects | Studio route hook, shared dispatch resolvers |
| Clarification continuations | Shared answer, dismiss, and deferred-dismiss wait/send lifecycle; plan-mode deferred tool answers can resume planning | Same shared lifecycle with Studio-owned creation metadata, submit callback, and send-failure rollback | `rovo-core/lib/rovo-app-clarification-lifecycle.ts` plus route callbacks |
| Plan review lifecycle | Shared accept/revise payload construction, deferred-tool resume body, planning-session restart, dismissed tracker reset, and local user-message dispatch | Same shared lifecycle; Studio does not add creation-mode policy to plan review turns | `rovo-core/lib/rovo-app-plan-review-lifecycle.ts` plus route callbacks |
| Plan retry lifecycle | Shared stream-finished/no-plan detection, clarification suppression, hidden retry payload dispatch, and best-effort failure handling | Same shared lifecycle; Studio does not add creation-mode policy to hidden plan retries | `rovo-core/lib/rovo-app-plan-retry-lifecycle.ts` plus route callbacks |
| Active run lifecycle | Shared local active-run records, attached-run chunk promotion, useChat finish/error cleanup, completed-turn release wait, explicit cancel debounce/fallback, thread-run cancellation, active-turn interruption, and interrupted-message marking | Same shared lifecycle; Studio creation/send policy and interrupt ref bridge stay route-local | `rovo-core/lib/rovo-app-run-lifecycle.ts` |
| Panel behavior | Shared panel state shape, artifact open/save/delete/hide dispatch, active selection persistence, and streaming/completed auto-open decisions | Same panel lifecycle and auto-open decisions | `rovo-core/lib/rovo-app-artifact-panel-dispatcher.ts` |
| Artifact behavior | Shared document, streaming artifact, active artifact, message ownership, manual edit, checkpoint, and hydration helpers | Same shared helper set | `rovo-core/lib/rovo-app-*artifact*.ts` |
| Streaming artifact deltas | Shared requestAnimationFrame batching, flush, clear, and unmount cleanup for streamed artifact content | Same shared delta buffer lifecycle | `rovo-core/hooks/use-rovo-app-streaming-artifact-delta-buffer.ts` |
| Rovo data parts | Shared AI SDK/Rovo stream data-part dispatch for artifact metadata, deltas, finish, artifact result, route decision, and turn completion | Same shared data-part dispatcher | `rovo-core/lib/rovo-app-data-part-dispatcher.ts` |
| Realtime message append/persist | Shared realtime message creation, local merge, thread record update, and persistence bridge | Same shared bridge; Studio can pass custom realtime parts for route-owned result cards | `rovo-core/lib/rovo-app-realtime-message-state.ts` plus route callbacks |
| Message display policy | Shared assistant text sanitization, widget visibility, action visibility, and blank-message suppression | Same shared policy; Studio adds an automation artifact-list parser/widget as a route-owned tool-driven widget | `rovo-core/lib/rovo-app-message-display.ts`, `studio/lib/studio-automation-artifact-list.ts`, `studio/components/studio-automation-artifact-list-widget.tsx`, and Studio message/shell registration |
| Plan widget metadata | Shared enriched plan title/summary scheduling, attempt dedupe, persistence, local message update, server reconciliation, hydration, and not-found cleanup | Same shared plan metadata lifecycle | `rovo-core/hooks/use-rovo-app-plan-widget-metadata-enrichment.ts` and `rovo-core/lib/rovo-app-plan-widget-metadata-persistence.ts` |
| Voice behavior | Shared voice core with `sessionPolicyMode: "auto"`; default realtime sessions can auto respond; shared voice steer dispatch | Shared voice core with `sessionPolicyMode: "manual-turn-taking"`; manual turn-taking policy by default; shared voice steer dispatch | `rovo-core/hooks/use-realtime-voice.ts`, `rovo-realtime-voice-session-policy.ts`, and `rovo-app-voice-steer-dispatcher.ts` |
| Clicky overlay and state | Shared cursor state, pointer target contract, cursor glyph, speech bubble, response overlay, and paint-aware overlay behavior | Same shared cursor state and overlay behavior, including screenshot target coordinates for Studio screen-assistant flows | `rovo-core/hooks/use-clicky.ts` and `rovo-core/components/clicky/*` |
| Clicky voice bridge | Shared activation, Realtime connection, and one-time initial-context injection lifecycle; route wrapper owns the Rovo prompt | Same shared lifecycle; Studio wrapper appends live product knowledge from the agent catalog at injection time | `rovo-core/hooks/use-clicky-voice.ts` plus route prompt wrappers |
| Prompt/delegation dispatch lifecycle | Shared text normalization, thread resolution, queue decision, enqueue/kick lifecycle, prompt send execution, streaming-artifact interruption, optimistic rollback, and direct delegation handoff | Same shared lifecycle with Studio-owned immediate interruption callbacks, queued-action acceleration, and creation-mode/send-mode inputs | `rovo-core/lib/rovo-app-dispatch.ts`, `rovo-app-dispatch-lifecycle.ts`, `rovo-app-delegation-dispatcher.ts`, and route callbacks |

## Extraction Boundary

- Shared core may own pure normalization, state transitions, callback-driven
  lifecycle bridges, queue decisions, payload builders, route adapters, API
  helpers, and streaming parsers.
- `use-rovo-app-core` owns the shared hook body. Route hooks should stay thin:
  they supply queue context, route adapters, clarification policy, send-mode
  state, and route-specific side-effect callbacks without adding shared control
  flow back into `/rovo` or `/studio`.
- Route shells remain product-specific. Share pure layout helpers and focused
  primitives in `rovo-core`, but do not merge the Rovo and Studio shells.
