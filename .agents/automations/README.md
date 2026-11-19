# Codex automation definitions

Tracked copies of VPK's scheduled Codex jobs (decision D12 in `.agents/docs/hardening-record.md`). The installed jobs live outside the repo at `~/.codex/automations/<id>/automation.toml`; Codex reads only those.

Each file here holds the portable fields: `id`, `kind`, `name`, `prompt`, `status`, `rrule`, `model`, `reasoning_effort` and `execution_environment`. To install one, copy it to `~/.codex/automations/<id>/automation.toml` and append the machine fields `target`, `cwds`, `created_at` and `updated_at` (copy them from an existing job). The repo is public: never put a token or credential in a definition.

- A job that opens pull requests starts its prompt with "Invoke `$vpk-scheduled-automation`" and is listed in `EXPECTED_PRODUCER_AUTOMATION_IDS` in `scripts/verify-saved-producer-automations.mjs`; `node scripts/verify-saved-producer-automations.mjs` checks the installed copies.
- `automation-merge` is the one job that merges (decision D11). It is not a producer: it merges only open PRs labelled `automation` and `automerge:allowed` that `scripts/automation-merge-eligibility.mjs` passes, that carry a Codex review on the current head, and whose `vpk-git-ship` review gate is clear, using `merge-remote.js` with the reviewed head. Producers choose `automerge:allowed` or `risk:needs-human` with that script's `--policy` mode (`$vpk-scheduled-automation`, step 6). It runs locally with the owner's `gh` auth on purpose: a merge made with an Actions `GITHUB_TOKEN` does not trigger push workflows, so main CI and the Perf budget job would not run.
- Use the latest model of each family (for example `gpt-6.2-sol`, `gpt-6-luna`).
- New drafts are installed with `status = "PAUSED"`; the owner activates them. `automation-merge` is tracked `ACTIVE` by the owner's decision.
