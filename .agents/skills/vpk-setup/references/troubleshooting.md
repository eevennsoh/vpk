# Setup Troubleshooting

Moved from `SKILL.md`: the full symptom-to-fix table for first-time setup, Rovo Serve, AI Gateway, ports, and voice mode.

## Symptom Table

| Issue | Quick Fix |
| ----- | --------- |
| Chat returns 503 | Rovo Serve not running — use `pnpm run rovo` to start all processes |
| Auth errors during ASAP save | `atlas upgrade` |
| "EADDRINUSE" error | Servers auto-find available ports within the worktree range. If still failing, check `pnpm ports`, stop the stale tmux stack with `pnpm run dev:tmux:stop` or `pnpm run rovo:tmux:stop`, then restart. |
| Next.js lock error | Remove stale lock: `rm -f .next/dev/lock` then restart |
| Turbopack cache corrupted | Clear cache: `rm -rf .next` then restart |
| Zombie processes blocking ports | `ROVO_FORCE_CLEAN_START=true pnpm run rovo` (graceful SIGTERM then SIGKILL fallback) |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` during dependency bootstrap | Use the noninteractive install path: `CI=true pnpm install --prefer-offline`. Do not start multiple `pnpm run ...` validations in parallel until dependency warmup has finished, because pnpm bootstraps share the same `node_modules` tree. |
| Config keeps resetting (`~/.rovo/config.yaml`) | Ensure you're using `pnpm run rovo` (not `rovo:setup`); setup is a one-off |
| Frontend 500 (providers) | Ensure `app/providers.tsx` matches import casing |
| "ASAP_PRIVATE_KEY: MISSING" | Check .env.local format - private key must be quoted and escaped |
| "Missing credentials" from Rovo Serve | `ROVO_SESSION_TOKEN` not set in `.env.local`. Copy the token from Serve's first-launch output (one-time setup, does not expire). Restart the dev stack after setting it. |
| "Missing credentials" when curling port 8000 | Port 8000 is Rovo Serve (not the VPK backend). Use `curl -H "Authorization: Bearer $ROVO_SESSION_TOKEN" http://localhost:8000/...` or use the backend port from `.dev-backend-port` instead. |
| No AI response (Rovo) | Verify `pnpm run rovo` is running and Rovo Serve started successfully |
| No AI response (AI Gateway-backed route) | Verify the AI Gateway URLs, ASAP credentials, and use case fields are set in `.env.local` |
| **Mismatched ASAP KID** | **You generated timestamp twice! Regenerate with single timestamp** |
| "Model Id [X] not found" | Model not whitelisted. Run `atlas ml aigateway usecase view --id YOUR-USE-CASE-ID -e stg-west` |
| Bedrock 403 while OpenAI works | Pull latest branch and confirm `backend/lib/ai-gateway-helpers.js` does **not** rewrite Bedrock URL; restart backend |
| Want to switch models | See [Model Switching Guide](guide-model-switch.md) |
| Rovo App voice mode 500 | Restart the backend so it picks up the latest `.env.local`. If using `STT_PRESET=qwen3-asr` or `qwen3-0.6b`, ensure an OpenAI-compatible transcription backend is available at `OPENAI_COMPATIBLE_STT_BASE_URL` (defaults to `http://localhost:8801/v1`) |
| Stale AI context / wrong answers | Rovo session may be corrupted — restart with `pnpm run rovo` |
| 409 "chat already in progress" | Background tasks may be using pinned panel ports — check that `PINNED_PORT_COUNT` matches your panel count. See [Port Isolation Guide](guide-ports.md) |
| 409 on first prompt (tmux) | Watch the affected Rovo pane. The fixed-port supervisor should restart the child automatically if recovery kills it. |
| Port stays unhealthy after recovery (tmux) | Check the specific Rovo pane for repeated restart failures, then restart `pnpm run rovo:tmux:start` if the underlying `rovo serve` command cannot come back healthy. |
