---
description: ADS lookups — atlas ads CLI commands first, ADS MCP only as fallback
paths:
  - "components/**/*.tsx"
  - "app/**/*.tsx"
  - "**/*.css"
---

# ADS Lookups

Retrieve ADS content with the `atlas ads` CLI first — same structured content as the ADS MCP, but faster and cheaper, and the MCP server has hung here for minutes on a single call. It ships as an Atlas CLI plugin (`/opt/atlassian/bin/atlas`), so the command is `atlas ads <cmd>`; there is no bare `ads` binary. Portable fallback on other machines: `npx @atlaskit/ads-cli <cmd>`. Add `--json` when you will parse the output, and use `atlas ads batch --command … --command …` when several lookups serve one decision.

| When you need...                        | Run                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan a UI (components + tokens + icons) | `atlas ads batch --command "search <terms> --type component" --command "search <terms> --type token" --command "search <terms> --type icon"`, or `atlas ads search <terms>` for one unified sweep |
| Search one kind                         | `atlas ads search <q> --type component` / `--type token` / `--type icon` (`[--limit N]`)                                                                                              |
| Exact single lookup                     | `atlas ads component <Name>` / `atlas ads token <name>` / `atlas ads icon <IconName>`                                                                                                 |
| Whole catalog                           | `atlas ads component --all` / `atlas ads token --all` / `atlas ads icon --all`                                                                                                        |
| Foundations guidelines                  | `atlas ads docs <topic...>` (e.g. `atlas ads docs spacing`)                                                                                                                           |
| Accessibility guidelines                | `atlas ads docs a11y <buttons\|forms\|images\|colors\|focus\|keyboard\|screenReaders\|aria\|wcag\|general>`                                                                            |
| ESLint rule docs                        | `atlas ads lint-rules [term...] [--limit N]`                                                                                                                                          |
| Migration guides                        | `atlas ads docs migration <avatar-xsmall-to-xxsmall\|jira-spotlight\|single-step\|multi-step\|motion>`                                                                                 |

Reach for the ADS MCP only when the CLI is unavailable or erroring, or for capabilities with no CLI equivalent: `ads_analyze_a11y`, `ads_analyze_localhost_a11y`, `ads_suggest_a11y_fixes`, `ads_i18n_conversion_guide`, and the broader non-ADS `atlaskit_search_components` / `atlaskit_get_components` catalog.
