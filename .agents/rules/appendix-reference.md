---
description: Directory structure, env vars, provider reference, skills catalog, team workflow, validation checklists
paths:
  - "backend/**"
  - "app/contexts/**"
  - "app/providers.tsx"
  - ".agents/**"
---

# Appendix

Directory map: `.agents/knowledge/repo-map.json` (generated — `node scripts/generate-repo-map.js`).

## Environment Variables

**Hybrid chat mode** — AI Gateway-backed chat requires AI Gateway credentials, while Rovo-selected flows require Rovo Serve plus the session token printed by `pnpm run rovo`.

Optional environment variables:

- `DEBUG=true` - Enable verbose logging
- `PORT=8080` - Backend server port
- `BACKEND_URL=http://localhost:8080` - Backend URL for frontend
- `ROVO_PORT` - Rovo Serve port (auto-set by `pnpm run rovo`; do not set manually)
- `ROVO_POOL_SIZE=1` - Number of Rovo Serve instances in pool (default 1; set `pnpm run rovo -- 6` for full pool)
- `ROVO_FORCE_CLEAN_START=true` - Kill all existing Rovo instances before starting
- `AI_GATEWAY_URL`, `AI_GATEWAY_URL_GOOGLE`, `AI_GATEWAY_USE_CASE_ID`, `AI_GATEWAY_CLOUD_ID`, `AI_GATEWAY_USER_ID`, `ASAP_*` - Configure AI Gateway-backed chat, image, sound, suggestions, and Realtime voice routes
- `NEXT_PUBLIC_API_URL` - API URL for production builds

## Provider Reference

| Context         | File                                       | Purpose                                             |
| --------------- | ------------------------------------------ | --------------------------------------------------- |
| Rovo chat       | `app/contexts/context-rovo-chat.tsx`       | AI chat via AI SDK `useChat` with streaming/widgets |
| Creation mode   | `app/contexts/context-creation-mode.tsx`   | Creation mode state                                 |
| Sidebar         | `app/contexts/context-sidebar.tsx`         | Sidebar visibility and route                        |
| Work item modal | `app/contexts/context-work-item-modal.tsx` | Work item detail modal using State/Actions/Meta     |
| Theme           | `components/utils/theme-wrapper.tsx`       | Light/dark/system mode                              |

## Skills and Agents

Skill catalog: `.agents/skills/INDEX.md` (generated — regenerate with `node scripts/validate-skills.js --update-index`).

- Figma pipeline agents: `vpk-agent-extractor` (haiku), `vpk-agent-implementer` (opus), `vpk-agent-validator` (haiku)

## Agent Team Workflow Reference

Recommended role ownership:

| Phase     | Role                                     | Owns                              | Purpose                                  |
| --------- | ---------------------------------------- | --------------------------------- | ---------------------------------------- |
| Explore   | Explorer                                 | Read-only investigation           | Find patterns and scope files            |
| Implement | Frontend/Backend/Token/Docs implementers | Distinct file sets                | Deliver changes without conflicts        |
| Test      | Tester                                   | Validation tools + browser checks | Verify lint, type, visual, and a11y      |
| Tidy      | General-purpose agent + `/vpk-tidy` skill | Modified implementation files     | Enforce architecture and maintainability |

Team rules:

- Start with exploration
- Do not assign the same file to multiple implementers
- Tester reports issues back; does not apply fixes
- Run tidy last after validation passes
