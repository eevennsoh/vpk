# Push Corrections Down the Ladder

Use this when the user corrects you, a reviewer flags a repeat finding, or you notice the same mistake in a second place. The goal is that the next agent — in any tool, with little context — cannot make the same mistake.

Agents extend the patterns they read. A workaround or a comment justifying one gets copied until it becomes the de facto pattern, so the fix belongs in the environment, not only in the current diff.

## The Ladder

Pick the lowest rung that can hold the lesson. Lower rungs are enforced for every tool; higher rungs are guidance that agents can miss.

| Rung | Holds | Reaches | VPK examples |
| --- | --- | --- | --- |
| 1. Codebase | One paved path; the wrong thing is impossible or has nothing to copy | Everyone | `@/lib/motion` recipes; the `_` unused-variable convention; global reduced-motion owners in `app/globals.css` + `app/providers.tsx` |
| 2. Static analysis | Mechanical patterns: syntax, imports, types, generated drift | Everyone, in the editor and CI | `eslint.config.mjs` + `eslint-suppressions.json`; `scripts/verify-source-guardrails.js`; `verify:*` checks |
| 3. Rules / review | Short context-dependent guidance | Claude Code (`paths:`) and Cursor (generated `.mdc` mirrors); Codex only when it reads them | `.agents/rules/*.md` |
| 4. Skills | Multi-step procedures and verification | Agents that load the skill | `vpk-verify` feature map + `control-vpk` |
| 5. Style guide | Taste and visual judgment | Human review | `DESIGN.md` |

Codex doesn't auto-load `.agents/rules/`, and Cursor attaches only `.mdc` files. VPK's history shows the consequence: after the overlay-border rule landed, most repeats came from Cursor, while import-boundary findings dropped from 7.7 to 1.1 per 100 PRs once they became lint. Treat a prose rule for a mechanical pattern as a stopgap.

## Workflow

1. **Name the mistake precisely.** Write the smallest bad example and the correct version. If you can't write both, it's rung 3–5 material.
2. **Look for the copy you followed.** Search for the pattern (`rg`). If older code taught it, fix or delete that source first, or make the lint rule below flag it (rung 1).
3. **Add or tighten the check (rung 2).**
   - Syntax patterns: add a selector to the matching array near the top of `eslint.config.mjs` (`react19Syntax`, `motionTokenSyntax`, `capabilitySyntax`, …). Flat config replaces rule options wholesale, so extend the shared arrays or `restrictedImports()` instead of adding a new `no-restricted-*` block.
   - Import boundaries: pass a pattern to `restrictedImports(...)` for the owning scope.
   - Text or cross-file contracts that ESLint can't see: extend `scripts/verify-source-guardrails.js` (its allowlist entries need a reason).
   - Add a case to `scripts/eslint-boundary-rules.test.js` using real ESLint results: the original mistake must fail and representative valid usage must pass.
4. **Baseline, don't bulk-fix, when the pattern is widespread.** Make the rule `error`, then record today's violations:

   ```bash
   ./node_modules/.bin/eslint app components backend hooks lib rovo scripts tests types next.config.ts tailwind.config.ts twg-install.test.js --suppress-rule <rule-id>
   ```

   `pnpm run verify:eslint-suppressions` fails any PR in which a rule's suppressed total grows, so the ledger only shrinks. After fixing old violations, run `pnpm run lint -- --prune-suppressions`. Never regenerate suppressions to hide a violation you just introduced.
5. **Shrink the prose.** Once a rule is enforced, cut its prose to one line that names the check (for example "(lint: `react-hooks/refs`)"). Keep only the judgment that lint can't express.
6. **Scope any rule text.** Put it in the narrowest `.agents/rules/*.md` file with `paths:` frontmatter, update the AGENTS.md scope table (`scripts/agent-rule-scopes.test.js` checks that they match), and run `node scripts/generate-cursor-rules.js` so Cursor gets the same rule.
7. **Validate:** `node --test scripts/eslint-boundary-rules.test.js`, `pnpm run lint`, `pnpm run lint:design-system`, `pnpm run typecheck`, and `pnpm run verify:fast`.

## Failure Modes

- **A comment that justifies a workaround.** The next agent reads it as permission. Fix the cause, or encode the exception in config with an owner, scope, and reason.
- **A rule that contradicts the code.** Fix whichever is wrong in the same change. For example, the old "guard every animation for reduced motion" rule ignored the global owners and produced buggy duplicate branches.
- **Autofixing without checking every position a rule matches.** `react/jsx-no-leaked-render` also matches prop values, and its ternary fix turned `aria-selected={a && b}` into `null`, which drops an attribute that rendered `"false"`. Scope rules to the exact AST position the policy means, and review a sample of autofix output before applying it repo-wide.
- **Source-regex tests as proof.** Assert behavior or use a real ESLint/TypeScript result. Tests that grep implementation text break on refactors and hide regressions. For UI, render the real component with `renderComponent()` from `scripts/lib/render-component.js` and assert what a user can reach and trigger: roles, names, `tabOrder()`, focus, and callbacks. Example: `components/blocks/jira-issue/uncaptured-work-chin.behavior.test.js`.
- **Over-verification.** Default proof is one `control-vpk capture <route>`. Add states only when the change depends on them, and stop when the user says they'll verify it themselves (`VPK_VERIFY=manual`).
- **Enforcing new taste.** Repeated feedback motivates enforcing an agreed policy. It isn't a design decision by itself, so propose the contract and its affected consumers first.
