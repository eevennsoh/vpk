# 005 — Isolate chat message updates from the workspace

Priority P2, investigation first · Effort 2–3 days if justified · Risk higher/shared · Depends on 001–004 · Planned at `d35d42fc0`, 2026-09-12.

## Current state

`app/contexts/context-rovo-chat.tsx:2223–2359` creates one context value containing message data (`uiMessages`), surface state and actions. `useRovoChat()` reads that whole context. `components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo.ts:20` needs actions but subscribes to the full value; `:53–59` calls `replaceMessages` for playback frames. EU26 calls this hook at project `page.tsx:96`. `components/projects/page.tsx:155` needs surface/actions, and board `experimental/page.tsx:292` reads optional chat context.

Changing the context invalidates consumers even if they only destructure actions. This is a source-confirmed subscription boundary; repeated board cost during playback/real streaming has not yet been established. The hidden duplicate renderer is handled first in 002.

## Scope

Existing context plus small sibling context/adapter modules; chat playback hook, shared shell, experimental board and their directly necessary imports/tests. Do not rewrite the 2,000-plus-line provider, transport, persistence or AI backend. Follow `chat-architecture.md`, relevant context rules and React 19 `use(Context)` / `<Context value={…}>` patterns. Preserve other projects' public contracts through compatible APIs during migration.

## Investigation and conditional implementation

1. Drift-check scope against `d35d42fc0`. Record local deterministic agent playback while the board remains visible, then type/search or switch views during updates. Track board/list/sidebar commits per message, message renderer cost and input latency. Profile production behavior as well as development, with no external sends.
2. If unrelated workspace components do not perform material work, close this candidate with that evidence. Do not split contexts merely for style.
3. If confirmed, introduce narrow stable action/surface subscriptions, or an existing selector/store mechanism if already canonical. Keep streaming/message subscribers separate. Inspect callback dependencies: an action context with changing callback identities still invalidates consumers.
4. Migrate the directly affected consumers together to the canonical narrow interface, keeping message readers on the message interface. Avoid duplicating provider state or introducing local mirrors. Keep the established broader hook compatible for consumers outside the migration.
5. Repeat playback and concurrent interactions. Separately measure actual backend first-token time only when that flow is intentionally exercised; provider/model wait is not React rendering time.

## Verification and done criteria

`node --test app/contexts/context-rovo-chat-select-agent.test.js app/contexts/rovo-chat-helpers.test.js` must pass. Add behavioral tests proving message changes do not notify action-only consumers, actions remain current, and surface changes still update shell/overlay correctly. Verify thread/agent selection, queued turns, cancellation, draft retention, close/reopen and playback timing. Register new component node:test suites for unfiltered test discovery.

Run `pnpm run lint`, `pnpm run typecheck` and the route performance journey. For app changes use `next-dev-loop`, visual evidence, and keyboard/a11y checks. Exercise a second shared chat consumer to catch broad context regressions.

Done: measured message-only commits no longer propagate into unrelated workspace rendering; concurrent interaction latency improves beyond variance; message ordering, cancellation and surface state are unchanged. Stop if achieving this requires a broader transport/provider redesign, or if callback identity prevents an honest narrow boundary. Report that separate scope and do not improvise a global store migration. Log measured or rejected results in the README.
