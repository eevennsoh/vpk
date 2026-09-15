---
description: Component architecture patterns — Context State/Actions/Meta, compound components, CVA variants
---

# Component Architecture

Reference details: `.agents/skills/vpk-tidy/SKILL.md`

Quick rules:

- Keep components under 150 lines where practical
- Move logic into hooks
- Move static data into `data/` files
- Use `Readonly<Props>` interfaces
- Shared `components/ui/**`, `components/ui-custom/**`, and
  `components/projects/shared/**` owners must not import an experimental
  variant. Move reusable behavior behind a shared model or require an explicit
  capability at the feature boundary.
- Render an interactive affordance only when its consumer supplies the real
  capability. Missing callbacks must produce display-only, disabled, or omitted
  UI, never an enabled control backed by an optional call or no-op handler.
  Register advertised drop targets with the owning transaction, and cover both
  capability-present and capability-absent behavior in focused tests.

Context pattern (`State/Actions/Meta`) lives in:

- `app/contexts/context-[name].tsx`
- Reference implementation: `app/contexts/context-work-item-modal.tsx`

Use convenience hooks such as:

- `useFooState()`
- `useFooActions()`
- `useFooData()` or `useFooMeta()`

Compound component namespace pattern:

```tsx
export const Composer = {
	Container: ComposerContainer,
	Textarea: ComposerTextarea,
	Actions: ComposerActions,
} as const;
```

CVA variant pattern for `components/ui/*`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva("base-classes", {
	variants: { variant: { default: "...", danger: "..." } },
	defaultVariants: { variant: "default" },
});

interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}
```

## Design-system lint maintenance

`eslint.config.mjs` owns the `@shadcn/lint` policy. The initial `no-restyle`
pilot covers Button and Badge consumers in Team EU26 and Agent Session
Column. Other primitives and features remain outside enforcement until
their customization is reviewed. Primitive implementations under
`components/ui/**` own their styling and are exempt from `no-restyle`.

After correcting UI misuse or incorporating user feedback:

- Assess whether an existing lint rule can prevent recurrence. When the
  mistake violates established repository guidance, tighten the narrowest
  applicable contract and add executable lint cases in the same change.
- When policy is new, subjective, or has uncertain impact on consumers,
  report a proposed contract and affected consumers instead of enforcing
  it globally. Repeated misuse motivates enforcement of an agreed policy;
  it does not establish a new design decision by itself.
- Prefer shared defaults and component variants. Add component contracts
  only where allowed customization differs. The linter discovers CVA
  variants and sizes from source, so adding an option usually needs no
  policy edit. Button owns appearance, padding, radius, and height; callers
  may control placement and width. Containers may deliberately allow
  padding, typography, or geometry after review.
- Never weaken a rule, broaden an allowance, or suppress a finding merely
  to make an implementation pass. A legitimate exception must identify its
  owner, scope, and design reason. Preserve reference geometry, ADS font
  shorthand, dynamic measurements, and explicit product capabilities.
- Keep token meaning and visual judgment in `DESIGN.md` and review.
  Declared palette aliases are not proof of correct semantic use. The
  other five plugin rules remain off pending separate validation.

For each contract or scope change, extend
`scripts/eslint-boundary-rules.test.js` with actual ESLint results: the
original mistake must produce the expected rule finding, representative
valid usage must pass, and relevant aliases/wrappers and scope boundaries
must behave correctly. Do not use source-grep assertions as proof of lint
enforcement. The suite is discovered by the existing `scripts/` unit gate.

Run `node --test scripts/eslint-boundary-rules.test.js`,
`pnpm run lint:design-system`, `pnpm run lint`, and `pnpm run typecheck`.
The pilot emits warnings for explanatory feedback; `lint:design-system`
uses `--max-warnings 0` in PR CI so new findings cannot silently pass.
Expand its paths together with the ESLint scope and regression cases.
For rendered changes, also prove the live route and accessibility.
Report what the contract prevents, its scope, and intentional exceptions.
For UI fixes without a contract edit, report whether prevention is already
covered, proposed for review, or unsuitable for a mechanical rule, with a reason.

## Performance ownership

For responsiveness, mounting or subscription changes, read [the performance playbook](../docs/playbooks/improve-ui-performance.md).

- Rovo consumers that need only supported surface/actions use `useRovoChatControls()`; provider-optional blocks use `useOptionalRovoChatControls()`. Keep message readers on the full context. Destructuring a broad context does not narrow its subscription.
- Reuse `MountOnFirstUse` for expensive unused project surfaces and `RetainedView` only for measured, bounded revisits. First-use deferral retains mounted effects after opening; Activity-based retention suspends hidden effects. Preserve drafts and verify hidden keyboard/focus behavior before choosing either.
- Keep hover/drag chrome separate from unchanged content and coalesce continuous geometry work to a frame. Promote measured behavior-preserving fixes at their shared owner; lifecycle/memory choices remain explicit capabilities until affected consumers are verified.
