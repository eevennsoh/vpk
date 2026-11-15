---
description: Skills, parallel work model, agent teams, behavioral rules
paths:
  - ".agents/**"
  - ".claude/**"
  - ".codex/**"
  - ".cursor/**"
  - ".rovo/**"
  - "scripts/validate-agents*.js"
  - "scripts/validate-skills*.js"
---

# Agent Operations

## Skills and Agents

- Skills: `.agents/skills/*/SKILL.md`
- Agents: `.agents/agents/*`
- Provider mirrors: `.cursor/`, `.claude/`, `.codex/`, and `.rovo/` contain provider-specific config plus symlinks back to `.agents/`. Add a symlink only for a folder that provider reads; hooks are wired by literal `.agents/hooks/...` paths in each provider's config (`.claude/hooks` is kept for Claude Code).
- Skill types: workflow skills are multi-step procedures; utility skills are single-purpose helpers

Skill catalog: `.agents/skills/INDEX.md` (generated — regenerate with `node scripts/validate-skills.js --update-index`).

`validate-skills.js` caps a `SKILL.md` body at 300 lines; move detail into `references/` and link it with "read X when Y". Trigger eval kits live in `evals/triggers.json` as the `{query, should_trigger}` rows skill-creator's `run_eval` reads (run recipe: `.agents/skills/vpk-html/evals/README.md`); the validator checks their format.

## File Edits

- Edit files at a literal path (absolute in a worktree) with the edit or patch tool. Do not use `sed -i` or globbed or variable paths for in-place edits: they skip review, and a path outside the worktree stalls on approval. `AGENTS.md` (Code Quality) carries the always-loaded copy of this rule; keep the two in step.

## Parallel Work Model

Choose one model based on communication needs:

| Mode        | Best for                                           | Coordination                              | Cost   |
| ----------- | -------------------------------------------------- | ----------------------------------------- | ------ |
| Subagents   | Independent tasks where only results matter        | Main agent coordinates                    | Lower  |
| Agent teams | Cross-area work needing direct teammate discussion | Shared task list + teammate collaboration | Higher |

Subagent rule: always wait for all subagents before yielding results.

## Agent Teams Management

Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

- In-process mode: select teammate with Shift+Up/Down, toggle task list with Ctrl+T
- Split pane mode: set `"teammateMode": "tmux"`
- Delegate mode: Shift+Tab
- Default lifecycle: `Explore -> Implement -> Test -> Tidy`

Detailed ownership and phase guidance is in `## Appendix -> Agent Team Workflow Reference`.

## Skill Validation

- When editing `.agents/skills/**/scripts/*`, run the narrow script test or smoke path before handoff. For Python tests named `test_*.py`, run them directly with `python3 path/to/test_*.py`; for helper scripts without tests, run the documented smoke command or explain the blocker.
- For `SKILL.md` or reference-only edits, `git diff --check` is enough unless the doc changes command behavior, validation expectations, or script names.

## Local Overrides

You can add gitignored local overrides:

```text
.agents/skills/vpk-deploy/SKILL.local.md
.claude.local.md
```

Note: `.claude.local.md` should be added to `.gitignore` if used for personal/local settings.
