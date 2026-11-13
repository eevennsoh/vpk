# VPK (Venn Prototype Kit)

Next.js 16 + Express backend with Rovo Serve for primary chat and AI Gateway
for explicit helper and media routes, deployable to Atlassian Micros.

## Architecture

This project uses a dual-mode runtime:

**Local Development (two processes):**

```text
Browser → Next.js (:3000) → app/api/* proxy → Express (:8080) → Rovo Serve
                                                        ↘ AI Gateway-assisted helper/media routes
```

**Production (single process):**

```text
Browser → Express (:8080) → serves static export + handles /api/* → Rovo Serve
                                                        ↘ AI Gateway-assisted helper/media routes
```

Both modes use the same `/api/*` relative paths - no code changes needed between environments.

## Quick Start

### Prerequisites

- Node.js >=20.9.0 (CI uses Node 24)
- pnpm
- ASAP credentials for AI Gateway (see [guide-setup.md](./.cursor/skills/vpk-setup/references/guide-setup.md))

### Installation

```bash
# Install all dependencies (frontend + backend via pnpm workspaces)
pnpm install

# Copy and configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### Development

```bash
pnpm run rovo  # Rovo Serve + backend + frontend
pnpm run dev   # Frontend + backend without Rovo Serve
```

Open the frontend URL printed by the command. Agent and worktree launcher details
live in [AGENTS.md](./AGENTS.md).

### Verify Setup

```bash
curl http://localhost:8080/api/health
```

Should show `"authMethod": "ASAP"` and all env vars as `"SET"`.

## Commands

```bash
pnpm install       # Install dependencies
pnpm run rovo      # Rovo Serve + backend + frontend
pnpm run dev       # Frontend + backend
pnpm run lint      # ESLint
pnpm run typecheck # TypeScript
```

## Skills

See the generated [local skills catalog](./.agents/skills/INDEX.md) for available
workflows and [AGENTS.md](./AGENTS.md) for provider-neutral agent context.

## Deployment to Micros

For complete deployment instructions, see [guide-deployment.md](./.cursor/skills/vpk-deploy/references/guide-deployment.md).

**Quick deploy:**

```bash
./.cursor/skills/vpk-deploy/scripts/deploy.sh <service-name> <version>
# Example: ./.cursor/skills/vpk-deploy/scripts/deploy.sh my-prototype 1.0.1
```

**Before first deployment:**

- Update `service-descriptor.yml` with your service name (replace `YOUR-SERVICE-NAME`)
- Service name limit: ≤26 characters, lowercase-with-hyphens

## Project Structure

```
app/                    # Next.js App Router
├── api/                # Dev-only proxy routes (chat-sdk, health)
├── contexts/           # React Context providers
│   ├── context-chat.tsx           # Generic chat panel state
│   ├── context-rovo-chat.tsx      # Rovo AI chat with streaming/widgets
│   ├── context-sidebar.tsx        # Sidebar visibility and route tracking
│   ├── context-system-prompt.tsx  # Custom AI prompt with localStorage
│   └── context-work-item-modal.tsx # Work item detail modal state
├── hooks/              # Custom React hooks
│   └── index.ts                  # Hook exports
├── providers.tsx       # Client-side provider composition
├── [page routes]/      # confluence/, jira/, rovo/, search/, widgets/
└── layout.tsx          # Root layout (server component)

backend/
└── server.js           # Express server (production runtime)

components/
├── blocks/             # Feature blocks (modular structure)
│   ├── layout/         # AppLayout shell (nav + sidebar + content)
│   ├── navigation/     # TopNavigation
│   ├── sidebar/        # Sidebar with product variants
│   ├── confluence/     # Document editing
│   ├── jira/           # Kanban board
│   ├── rovo/           # AI chat (full + panel)
│   ├── search/         # Search results
│   └── widget/         # Embeddable widgets
├── ui/                 # Shared UI primitives
└── utils/              # Utility components (theme-wrapper.tsx)

lib/                    # Shared utilities (api-config.ts, platform-feature-flags.ts)
rovo/                   # AI config (config.js - prompt builder)
scripts/                # Dev scripts (dev-backend.js, dev-frontend.js)
.cursor/                # AI configs (agents, skills)
```

### Block Structure Pattern

Each feature block follows a modular structure:

```
components/blocks/[feature]/
├── page.tsx              # Main container (public API)
├── components/           # Feature-specific sub-components
└── hooks/, data/, lib/   # Optional: hooks, static data, types
```

## Environment Variables

Required in `.env.local`:

```
AI_GATEWAY_URL
AI_GATEWAY_USE_CASE_ID
AI_GATEWAY_CLOUD_ID
AI_GATEWAY_USER_ID
ASAP_PRIVATE_KEY
ASAP_KID
ASAP_ISSUER
```

Optional:

```
DEBUG=true                              # Verbose logging
PORT=8080                               # Backend port
BACKEND_URL=http://localhost:8080       # Backend URL for dev proxy
NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE=false  # Use the pre-finesse ADS theme
```

The finesse flag defaults to enabled. Restart the dev server after changing it;
production bundles must be rebuilt because `NEXT_PUBLIC_` values are baked in.

LLM routing behavior:

- Default: Rovo-first (`pnpm run rovo` starts a single instance by default; use `pnpm run rovo --6` for full pool)
- Main chat: `/api/chat-sdk` requires Rovo Serve and returns `503` if Rovo is unavailable
- AI Gateway-assisted helper/media tasks: image, sound, suggestions, titles/metadata, and Realtime voice use AI Gateway when configured
- Inspect current routing at `GET /api/health` under `llmRouting`

See [guide-setup.md](./.cursor/skills/vpk-setup/references/guide-setup.md) for detailed credential setup.

## Theming

VPK supports light/dark/system theme modes with localStorage persistence:

- Theme state managed by `ThemeWrapper` at `components/utils/theme-wrapper.tsx`
- Applies `.light`/`.dark` classes on `<html>` and relies on the token aliases in `app/shadcn-theme.css` and `app/tailwind-theme.css`
- Exports: `useTheme()`, `ThemeToggle`, `ThemeSelector`

## Code Style

- **Package manager**: pnpm
- **Indentation**: Tabs
- **Imports**: Use `@/` path alias
- **UI**: shadcn/Base UI-style primitives in `components/ui`, styled with Tailwind + CSS variables
- **Icons**: `lucide-react` + Atlassian product/app logos via `components/ui/logo.tsx` (`@atlaskit/logo`)

## Component Architecture

Components follow mandatory architectural rules:

1. **Modular** - Components <150 lines; split larger ones into sub-components
2. **Logic isolated** - Business logic in custom hooks, components are pure UI
3. **Data decoupled** - Static data (nav items, configs) in separate data files
4. **Type safe** - All components have `Readonly<ComponentNameProps>` interfaces
5. **No boolean props** - Use variants, slots, or compound components

Use the `/vpk-tidy` skill to refactor components following these patterns.

See [AGENTS.md](./AGENTS.md) for detailed architectural guidelines.

## Documentation

- [guide-setup.md](./.cursor/skills/vpk-setup/references/guide-setup.md) - Local development setup with ASAP auth
- [guide-deployment.md](./.cursor/skills/vpk-deploy/references/guide-deployment.md) - Micros deployment guide
- [guide-model-switch.md](./.cursor/skills/vpk-setup/references/guide-model-switch.md) - Switch between Claude and GPT models

## Troubleshooting

**Port already in use:**

Ports are per worktree, so a busy port is usually this worktree's own stack or another worktree's. Stop this worktree's stack, or list every worktree's stack and stop one by its id:

```bash
pnpm run dev:tmux:stop
```

```bash
pnpm ports
```

```bash
pnpm ports kill <id>
```

Never kill by port number (`lsof … | xargs kill`): the process on that port may be another worktree's server.

**ASAP_PRIVATE_KEY missing:**

- Ensure `.env.local` exists
- Private key must be quoted and use `\n` for newlines

**AI Gateway 401 errors:**

- Verify ASAP credentials in health check
- Check principal is whitelisted for your use case

For more help, see the troubleshooting sections in [guide-setup.md](./.cursor/skills/vpk-setup/references/guide-setup.md) or [guide-deployment.md](./.cursor/skills/vpk-deploy/references/guide-deployment.md).

**Dev server not starting:**

- Check this worktree's ports and stacks: `pnpm ports`
- Stop this worktree's stack: `pnpm run dev:tmux:stop`; another worktree's: `pnpm ports kill <id>`

**"Cannot find module" errors:**

- Reinstall: `rm -rf node_modules && pnpm install`

**Theme not persisting:**

- Clear localStorage: `localStorage.removeItem('ui-theme')` and refresh
