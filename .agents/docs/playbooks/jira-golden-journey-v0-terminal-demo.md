# ASX Terminal Stage — Presenter Script

Live-presentation walkthrough for the "Terminal" card in the ASX (Agent
Sessions Experience) gallery at `/jira-golden-journey-v0`. The demo is presenter-paced: each
beat's typing/output animates on its own, then waits for you to advance.

## Setup

1. Start the dev stack for this worktree: `pnpm run dev:tmux:start`.
2. Open the Portless URL from `pnpm ports` and navigate to `/jira-golden-journey-v0`.
3. Click the **Terminal** tile in the gallery dock.

## Controls (keep these in your head, not on screen)

| Action | Key / click |
| --- | --- |
| Advance to the next beat | `→` or `Space` |
| Skip a beat's animation instantly (still one beat at a time) | `→` / `Space` again while it's mid-animation |
| Roll back to the previous beat (instant) | `Backspace` |
| Move the highlight up/down the Jira list | `↑` / `↓` |
| "Open" the highlighted issue in Jira (narrate this — nothing is built) | `Enter` |
| Restart the whole story | `R`, or the **Restart** button in the top bar |
| Trigger the very first split | Click anywhere on the terminal frame |

`Backspace` is the safety net: if you get ahead of your narration, tap it to
step back a beat and re-explain. Switching to a different gallery card and back
also resets the demo, so you can't leave it mid-story by accident.

The `↑`/`↓` highlight + `Enter` is a talking point, not a real navigation: move
the cursor onto, say, **ASX-198**, then say "and from here I'd just hit enter to
jump straight to this issue in Jira." The highlight bar sells that it's a live,
navigable list — everything the left pane shows is intentionally something a real
terminal could render.

## Beat-by-beat walkthrough

**0 — Opening.** The Claude Code pane fills the frame, full width. Status bar
reads "click the terminal to open Jira." Say: *this is just Claude Code, like
any terminal session.*

**Click the frame → Beat 1 (split).** The frame splits 50/50: Jira CLI shell
on the left, Claude Code on the right. Say: *now let's bring in a second pane
to watch the work.*

**→ Beat 2 (connect).** Left pane types `jira connect --space asx`, prints a
short boot sequence, then fades into the Jira CLI dashboard for *Agent Sessions
Experience (ASX) · asx.atlassian.net* with the seeded backlog (4 open items) and
one already-done item. Say: *this is a CLI-native Jira session view — sections
for what's waiting on you, what's running, and what's done.* (Optional: press
`↑`/`↓` to move the highlight and mention `Enter` opens the issue in Jira.)

**→ Beat 3 (create a work item).** Right pane: Claude is asked to create a
work item for a card-overflow bug on the Kanban stage and start on it. Watch
**ASX-247** appear under *Working* on the left, live. Say: *I didn't touch the
Jira pane — it just picked that up.*

**→ Beat 4 (pick up existing backlog).** Claude is asked to pick up
**ASX-231** (the flaky gallery snapshot test). It moves from *Backlog* to *Working*.

**→ Beat 5 (parallel dispatch).** Claude kicks off the rest of the backlog —
**ASX-198**, **ASX-244**, **ASX-217** — all at once. Five items are now
*Working* simultaneously. Say: *this is the payoff — multiple agents running
in parallel, and the board just reflects it.*

**→ Beat 6 (needs input).** **ASX-198** flips to *Needs input* (yellow) with
a question about dark-mode default behavior. Say: *and when an agent needs a
decision, it shows up here — not buried in a chat thread.*

**→ Beat 7 (reply).** A reply is typed directly into the Jira pane's dispatch
line. ASX-198 goes back to *Working*.

**→ Beat 8 (first completions).** **ASX-247** and **ASX-244** land — each
gets a `#PR open` label. Say: *sessions are already opening PRs.*

**→ Beat 9 (remaining completions).** **ASX-231**, **ASX-217**, and
**ASX-198** land. All six items are now *Done*, each with a PR label.

**→ Beat 10 (summary).** Claude is asked to summarize the session: *"6
sessions run · 6 PRs opened · backlog cleared."* Status bar reads "demo
complete · R to restart."

## If something goes off-script

- Got ahead of your narration? Tap `Backspace` to step back one beat instantly
  and re-explain, or press `R` to replay from the top.
- Q&A mid-demo: it's safe to leave the frame sitting on any beat — nothing
  times out or auto-advances on its own.
