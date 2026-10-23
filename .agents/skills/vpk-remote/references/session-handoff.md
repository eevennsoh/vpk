# Session handoff — move a conversation onto API billing

Handoff mode moves the **conversation itself** off the OAuth login, rather than
delegating a task to a worker. The user keeps chatting in the same context,
billed through Proximity, on any Claude or GPT model at any effort.

Everything runs through one launcher, `ai-api`, kept outside the repo in
`~/.config/litellm-proximity/` (it is machine plumbing shared by Claude Code
and Codex). This skill only parses intent and runs it.

## The launcher

```bash
ai-api <claude|codex> [--model M] [--effort E]
       [--resume ID | --continue | --fork ID | --fork-last]
       [--new-window | --background "task"] [--dry-run] [-- extra app args]
```

- **Routing is automatic.** Same-vendor models go straight to Proximity
  (`localhost:29576`). Cross-vendor models (GPT in Claude Code, Claude in
  Codex) go through the LiteLLM translator on `127.0.0.1:4000`, which
  `ai-api` **starts by itself** when it is not already running.
- **Defaults** live in `~/.config/litellm-proximity/defaults.env`
  (`CLAUDE_MODEL`, `GPT_MODEL`, `*_EFFORT_DEFAULT`, and `ALIAS_<name>` short
  names). Read that file for the current values; never hardcode them here.
- **Effort** passes through translation: Claude Code `--effort` becomes
  OpenAI `reasoning.effort`, and Codex `model_reasoning_effort` becomes
  Anthropic `output_config.effort` (verified 2026-10-21 for `medium`,
  `xhigh`, `max`).
- `--dry-run` prints the exact command and changes nothing. `--new-window`
  opens the session in a new labelled **herdr tab** (`api-<model>`) in the
  caller's workspace when run inside herdr (`HERDR_ENV=1`), where herdr tracks
  the agent's state; elsewhere it opens a new window of the macOS default
  terminal (whatever app opens `.command` files; Terminal.app unless changed). `--background
  "task"` runs headless instead: nothing opens. `ai-api` appends a verify step
  to the task (run the relevant test plus lint and typecheck where they exist,
  never claim an unrun check) and asks for a fixed `RESULT / CHANGED / CHECKS /
  NOTES` block. The `RESULT` line becomes the macOS notification (for example
  `Fixed sidebar flicker · lint ✓ typecheck ✓`). The block is saved as
  `~/.config/litellm-proximity/runs/<stamp>-<app>.summary.md`, with a final
  `reopen:` line to continue the run interactively. A missing block shows as
  "no summary returned" rather than a silent success.

## Session modes

| User intent | Flag | Effect |
| --- | --- | --- |
| "switch this session to API", "move the rest of this chat over" | `--fork <current id>` | New session that starts with the full current history |
| "continue my last session on API" | `--continue` | Resume the most recent session in this directory |
| "resume session X on API" | `--resume X` | Reopen that exact session |
| "start a fresh API session" | *(none)* | New empty session |

**Fork, don't resume, the session you are running in.** Two processes
appending to one transcript corrupt it. A fork copies the history into a new
session ID, so the OAuth session stays intact and the user can go back to it.

The current session ID is in the environment: `$CLAUDE_CODE_SESSION_ID`
(Claude Code) or `$CODEX_THREAD_ID` (Codex). Which app you are in decides the
first argument to `ai-api`.

Cross-app handoff (a Claude Code conversation continuing inside Codex, or the
reverse) is **not possible**: the transcript formats differ. Offer a fresh
session in the other app with a short summary as its first prompt instead.

## Procedure

1. **Parse** the request into app, model, effort, and mode using the intent
   rules in SKILL.md. Unstated values take the defaults.
2. **Echo the plan in one line** before launching — for example
   `Forking this session → Claude Code · gpt-6.1-sol · effort high`.
3. **Launch.** The starting session may itself be on API (started with
   `ai-api` or `claude-gw`); the handoff works the same and costs no OAuth.
   Use it to switch model or effort mid-conversation. A running session cannot switch itself to API, so pick:
   - **Background** (`--background "<task>"`) when the request carries a
     self-contained task and the user does not need to watch it — "fix X",
     "do this in the background". No window opens; report the log path and
     that a notification will fire.
   - **New window** (`--new-window`, plus `-- "<task>"` if there is one)
     when the user wants to keep chatting or steer — "move this chat",
     "continue on sol", or a bare `/vpk-remote`.
   A background run is one task, not a conversation. Report the summary file
   path. Results stay in the summary and the forked session, not in this
   thread: if the user later asks how it went, read the summary file (a few
   lines), never the log.
4. **Tell the user to stop typing in the OAuth session** once the API one is
   open, so further turns stop drawing OAuth credit. Nothing else is needed;
   the OAuth login itself stays signed in.

A handoff costs one short OAuth turn. Never summarize or re-read the
conversation to perform it — the fork carries the history for free.

## Spending no OAuth at all

A handoff still costs the one OAuth turn that asked for it. To spend none,
start on API from a terminal instead: `ai-api claude`, `ai-api codex`,
`ai-api claude --continue`, `ai-api codex --fork-last`. Mention this when the
user says credit is gone.

## Verified

2026-10-21: a Claude Code session on Sonnet was forked with `--new-window` into
the default terminal on `gpt-6.1-sol`, and the new session recalled a fact from the
original conversation.

2026-10-21: `--background` on Claude Code (fork onto `gpt-6.1-sol`) and Codex
(on `claude-sonnet-5-5`) both completed with no window; the forked run recalled
the original chat, and its reopen line resumed it.

2026-10-22: background runs on Claude Code (Sonnet) and Codex (Sol) in a test
repo ran their checks and returned the summary block; the notification showed
the `RESULT` line.

## Known limits

- Claude Code on a GPT model prints an "unrecognized model, assuming 200k
  window" notice and loses Anthropic-only features (prompt caching, thinking
  blocks). Codex on a Claude model loses Codex's GPT-tuned prompts; file edits
  and shell work.
- Codex needs `</dev/null` for headless `codex exec` through `ai-api`, or it
  waits on stdin.
- The Claude and Codex **desktop apps** cannot be relaunched by `ai-api`. A
  handoff from a desktop app opens a terminal window (`--new-window`) or a background run, which
  resumes the same session store the desktop app uses.
