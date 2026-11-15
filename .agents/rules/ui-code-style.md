---
description: VPK UI code style — primitives, icons, images, shadows, dates, key imports, CSS baseline
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.css"
---

# UI Code Style

- UI primitives: `components/ui/*`; icons: `@atlaskit/icon/core/*`, then `@atlaskit/icon-lab/core/*`; product logos: `@/components/ui/logo`. When editing icons, check consistency across all icons in the component.
- Use `next/image` with explicit dimensions. Put static assets in `public/`, reference absolute paths, and group them under `1p/`, `3p/`, `illustration/`, or `illustration-ai/`.
- Shadows: `shadow-sm` / `shadow-md` (raised), `shadow-lg` (overflow), `shadow-xl`/`shadow-2xl` (overlay; overlay surfaces follow `.agents/rules/gotchas-ui.md`), which `app/tailwind-theme.css` maps to ADS elevation; `token("elevation.shadow.*")` only in inline styles.
- Dates: `Intl.DateTimeFormat("en-US", { dateStyle: "medium" })` (always specify locale to avoid SSR/client hydration mismatch).

Key imports:

```tsx
import { token } from "@/lib/tokens"; // spacing, shadows, dynamic values only
import { cn } from "@/lib/utils"; // class merging (all className props)
import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react"; // chat message state + streaming
import { DefaultChatTransport, type UIMessage } from "ai"; // transport + message types
```

## Browser Support

Allow Newly Available CSS features (Baseline 2023+) without `@supports` fallbacks. For Limited-Availability features (e.g. `container-type: scroll-state`, scroll-driven animations), treat them as progressive enhancement — degrade silently, no polyfill.
