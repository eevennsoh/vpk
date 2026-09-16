---
name: VPK
description: Shared visual contract for Venn Prototype Kit surfaces.
colors:
  surface: "var(--ds-surface)"
  surface-raised: "var(--ds-surface-raised)"
  surface-overlay: "var(--ds-surface-overlay)"
  surface-sunken: "var(--ds-surface-sunken)"
  text: "var(--ds-text)"
  text-subtle: "var(--ds-text-subtle)"
  text-subtlest: "var(--ds-text-subtlest)"
  text-inverse: "var(--ds-text-inverse)"
  brand-bold: "var(--ds-background-brand-bold)"
  brand-bold-hovered: "var(--ds-background-brand-bold-hovered)"
  brand-bold-pressed: "var(--ds-background-brand-bold-pressed)"
  neutral-subtle: "var(--ds-background-neutral-subtle)"
  neutral-subtle-hovered: "var(--ds-background-neutral-subtle-hovered)"
  border: "var(--ds-border)"
  border-bold: "var(--ds-border-bold)"
  border-focused: "var(--ds-border-focused)"
  danger: "var(--ds-background-danger)"
  warning: "var(--ds-background-warning)"
  success: "var(--ds-background-success)"
  discovery: "var(--ds-background-discovery)"
  information: "var(--ds-background-information)"
typography:
  display:
    font: "var(--ds-font-heading-xxlarge)"
  body:
    fontFamily: "var(--ds-font-family-body)"
    fontSize: "var(--text-sm)"
    fontWeight: "var(--ds-font-weight-regular)"
    lineHeight: "var(--text-sm--line-height)"
  label:
    fontFamily: "var(--ds-font-family-body)"
    fontSize: "var(--text-xs)"
    fontWeight: "var(--ds-font-weight-medium)"
    lineHeight: "var(--text-xs--line-height)"
  code:
    font: "var(--ds-font-code)"
rounded:
  xs: "var(--ds-radius-xsmall)"
  sm: "var(--ds-radius-small)"
  md: "var(--ds-radius-medium)"
  lg: "var(--ds-radius-large)"
  xl: "var(--ds-radius-xlarge)"
  tile: "var(--ds-radius-tile, 25%)"
spacing:
  xs: "var(--ds-space-050)"
  sm: "var(--ds-space-100)"
  md: "var(--ds-space-200)"
  lg: "var(--ds-space-300)"
  xl: "var(--ds-space-400)"
components:
  button-primary:
    backgroundColor: "{colors.brand-bold}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-subtle}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    paddingBlock: "16px"
    shadow: "var(--ds-shadow-raised)"
  input:
    backgroundColor: "var(--ds-background-input)"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
---

# Design System: VPK

This root `DESIGN.md` defines shared toolkit constraints for VPK. It is
not a single product identity. Product and art surfaces can add a more specific
`DESIGN.md` under `components/projects/<name>/` or `components/arts/<name>/`;
the nearest nested file owns that surface's visual direction while this root
file continues to define the common implementation contract.

This document and its frontmatter guide contributors and agents; they do not
generate or override runtime styles. Before editing a surface, read the nearest
applicable nested `DESIGN.md`, if present. Otherwise, use this file and the
existing surface. Component recipes summarize defaults; shared component source
owns supported variants, states, and slot geometry.

## 1. Overview

VPK is a prototyping toolkit for product surfaces, agent workflows, and
visual experiments. The shared design system must stay useful across quiet
operational tools and expressive art demos, so the root posture is restrained,
semantic, and theme-aware. It provides a stable baseline rather than a fixed
brand personality.

The canonical runtime stack is `@atlaskit/tokens`, `app/tailwind-theme.css`,
and `app/shadcn-theme.css`. Agents and contributors must prefer Tailwind
classes that map to ADS semantic tokens, then decorative Tailwind accent
classes, and only then raw `token()` or `var(--ds-...)` values for dynamic
values or unmapped edge cases.

The root contract optimizes for prototypes that feel deliberate on first load
and responsive during repeated work: dense enough for frequent use, legible
enough for review, and flexible enough for each nested surface's atmosphere.

**Key characteristics:**

- Semantic token use before raw color values.
- Compact controls, clear focus states, and explicit disabled states.
- Flat or lightly raised surfaces, with overlay elevation reserved for real
  layering.
- Atlassian product familiarity without copying one product's full chrome.
- Nested project and art identities take priority for mood, palette emphasis,
  and visual storytelling.

### Sources of truth

- [Token priority and authoring](.agents/rules/token-priority.md): semantic
  aliases, font shorthand, and CSS conventions.
- [Component ownership](.agents/rules/component-architecture.md): shared
  variants, real interaction capabilities, and scoped design-system lint.
- [Motion decisions](.agents/rules/motion-decisions.md) and
  [Base UI motion](.agents/rules/motion-base-ui.md): role-specific timing,
  reduced motion, and overlay lifecycle.
- [UI performance](.agents/docs/playbooks/improve-ui-performance.md): interaction
  measurement and deliberate state lifetime.
- Runtime styling lives in [globals.css](app/globals.css),
  [tailwind-theme.css](app/tailwind-theme.css), and
  [shadcn-theme.css](app/shadcn-theme.css). [ThemeWrapper](components/utils/theme-wrapper.tsx)
  applies ADS color, spacing, typography, and shape through `setGlobalTheme()`.

## 2. Colors

VPK colors resolve through ADS CSS variables and Tailwind semantic aliases.
Do not treat the light-mode hex comments in CSS as the source of truth because
theme mode and ADS token resolution can change the final values.

### Primary

- **Brand Bold** (`bg-primary`, `var(--ds-background-brand-bold)`): Use for
  primary actions and user-originated chat surfaces.
  Keep it rare enough that it remains an action signal.
- **Selected State** (`bg-bg-selected`, `text-text-selected`,
  `border-border-selected`): Use for pressed, expanded, selected, or active
  controls when the state needs to persist. Keep the selected triad together:
  selected background, selected text, and selected border or marker.

### Neutral

- **Surface** (`bg-surface`, `bg-background`): Use for page and app-shell
  backgrounds.
- **Raised Surface** (`bg-surface-raised`, `bg-card`): Use for cards, panels,
  and repeated items that need local grouping.
- **Overlay Surface** (`bg-surface-overlay`, `bg-popover`): Use for popovers,
  menus, floating panels, and dialogs.
- **Sunken Surface** (`bg-surface-sunken`): Use for recessed containers,
  preview wells, and scrollable regions inside the main surface. Do not use it
  as the default page background to create contrast against cards.
- **Text Stack** (`text-text`, `text-text-subtle`,
  `text-text-subtlest`): Use the full text stack for hierarchy before adding
  decorative color.
- **Border Stack** (`border-border`, `border-border-bold`,
  `ring-ring`): Use borders and rings for structure, focus, and state before
  adding shadows.

### Status and accent

- **Danger, warning, success, discovery, and information** use the
  `bg-bg-*`, `text-text-*`, `text-icon-*`, and `border-border-*` semantic
  families. Match status color to meaning; do not use status colors only for
  decoration.
- **Success** is a semantic role, not a decorative green accent. Use the
  success token family for completion states even when the visual hue appears
  lime or green.
- **Decorative accents** can use the mapped Tailwind hue scale, such as
  `bg-blue-400`, `text-purple-500`, or `bg-teal-50`, because those classes
  still resolve through ADS-compatible theme variables.
- **Icon tiles** use the mapped variant set: gray, blue, teal, green, lime,
  yellow, orange, red, magenta, and purple. Use the bold variants only when
  the tile needs to carry strong categorization.
- **Chart colors** are for data visualization. Use chart token mappings for
  series and pair color with labels, legends, patterns, or shapes when meaning
  must remain clear without color.

### Named rules

**The semantic-first rule.** Start with classes such as `bg-surface-raised`,
`text-text-subtle`, and `border-border-bold`. Raw `var(--ds-...)` values are
escape hatches, not the normal authoring path.

**The nested identity rule.** A project or art-specific `DESIGN.md` may define
its own color character, but it must still resolve through the shared token
system unless the surface is intentionally experimental.

## 3. Typography

**Display font:** Atlassian Sans through `var(--ds-font-family-body)`.
**Body font:** Atlassian Sans through `var(--ds-font-family-body)`.
**Code font:** Atlassian Mono through `var(--ds-font-family-code)`.

Typography should feel functional and composed. Use ADS font shorthand tokens
such as `font.heading.*`, `font.body`, `font.body.small`, and `font.code` when
applying composite typography. The frontmatter's `font` entries represent CSS
font shorthand. For ordinary UI text, `text-sm` pairs 14px type with 20px line
height and `text-xs` pairs 12px with 16px; use mapped utilities for weight and
color. Avoid viewport-scaled type for fixed tool surfaces because it makes
compact controls unpredictable.

### Hierarchy

- **Display:** Use sparingly for true page or prototype introductions. Prefer
  ADS heading tokens, not arbitrary oversized type.
- **Headline:** Use for page titles, route-level headings, and major panels.
- **Title:** Use for card titles, inspector headings, modal headings, and
  focused work areas.
- **Body:** Use for readable interface text. Keep long-form body copy around
  65 to 75 characters per line.
- **Label:** Use for controls, metadata, compact headers, and badges. Keep
  labels direct and avoid repeated explanatory copy.
- **Code:** Use for identifiers, commands, file paths, model names, and
  generated snippets.

### Named rules

**The container-fit rule.** Text must fit inside its parent at mobile and
desktop sizes. If a label cannot fit, change layout or wrapping before shrinking
the interface into an unreadable state.

**The no-display-in-panels rule.** Compact panels, cards, sidebars, and
dashboards use tighter type. Hero-scale typography belongs only to true hero or
showcase surfaces.

**The body-copy rule.** Paragraphs, descriptions, and list items use `text-text`
by default. Reserve `text-text-subtle` for metadata, labels, captions, and
secondary navigation.

## 4. Content and interaction copy

Interface copy should be active, short, plain, and specific. The words on a
surface are part of its interaction design, so they should make the user's next
step obvious without adding explanatory chrome.

- **Case:** Use sentence case for product UI headings, buttons, tabs, menu
  items, tooltips, empty states, tags, lozenges, badges, and table headers.
  Preserve proper nouns such as Jira, Confluence, Trello, Atlassian, and VPK.
- **Actions:** Buttons and calls to action use imperative verbs such as "Save",
  "Delete", "Connect", or "Create agent". Avoid "Submit", "OK", "Click here",
  and generic action labels that do not describe the result.
- **Links:** Link text must describe the destination or action. Prefer "Learn
  about permissions" over "Learn more".
- **Errors:** Error copy names the reason and gives a recovery action. Avoid
  vague fallback text such as "Something went wrong" when the failure mode is
  knowable.
- **Translation:** Leave room for strings to grow and avoid concatenating
  sentence fragments in UI code. Longer translated labels must not break fixed
  controls.
- **Inclusive language:** Prefer plain words and gender-neutral language. Avoid
  idioms or cultural metaphors that obscure the meaning across locales.
- **Tone during friction:** Keep errors, destructive confirmations, and billing
  copy direct and calm. Reserve playful copy for appropriate success or welcome
  moments.

## 5. Layout, shape, and focus

Layout should use spacing, grouping, and component shape before decorative
effects. Keep the root contract token-first, but apply the tokens through the
repo's semantic Tailwind classes whenever a class exists.

- **Spacing rhythm:** Start spacing, padding, margin, gap, and inset values on
  the ADS 8px rhythm through classes mapped from `--ds-space-*`. Use smaller
  steps for component interiors and larger steps for unrelated page regions.
- **Relationship by proximity:** Related controls sit closer together than
  unrelated groups. Avoid applying the same gap everywhere when hierarchy needs
  to stay scannable.
- **Radius by component intent:** Use the established shared primitive radius
  first. Buttons and nav items stay in the medium radius family, inputs in the
  large family, cards in the shared `rounded-xl` contract, avatars and pills in
  the full radius family, and tile components in the tile radius family.
- **Focus anatomy:** Preserve shared Button, Input, and Textarea focused borders
  and 3px rings. Native controls and links use the global 2px outline with a 2px
  offset. Keep the applicable treatment visible and shaped to the control.
- **Focus clearance:** No scrollport, clipping ancestor, animated reveal slot,
  or adjacent control may cut off that treatment. Reserve at least 4px around
  VPK's outward focus indicators. When layout geometry must stay fixed, expand
  the clipping boundary with matching negative margin and internal padding
  (for example, `-m-1 p-1`); for a collapsing reveal wrapper, retain clipping
  at rest and expose overflow while a descendant is `:focus-visible`. A raised
  `z-index` solves sibling overlap only—it cannot repair ancestor clipping.
- **Touch targets:** Interactive controls should keep at least a 32px target in
  touch contexts, even when the visible glyph is smaller.

### Responsive behavior

- Reflow multi-column content and collapse navigation as space narrows. Keep
  critical actions available; let wide tables scroll within their own region.
- Prefer logical inline/block properties or start/end utilities where layout
  should mirror in right-to-left locales.
- Check narrow, tablet, and desktop layouts, 200% zoom, and longer labels. Use
  320px, 768px, and 1280px as starting viewports, then include the target surface's
  relevant sizes. Preserve usable touch targets when using compact variants.

## 6. Elevation

VPK uses tonal layering first and shadow second. A surface should usually
communicate hierarchy through semantic background, border, spacing, and state.
Use shadow when a layer genuinely floats above another layer or needs a hover
or overlay affordance.

### Shadow vocabulary

- **Raised** (`shadow-sm`, `shadow-md`,
  `var(--ds-shadow-raised)`): Use for cards and small panels that need gentle
  separation.
- **Overflow** (`shadow-lg`, `var(--ds-shadow-overflow)`): Use for content
  that scrolls or visually breaks out of its container.
- **Overlay** (`shadow-xl`, `shadow-2xl`,
  `var(--ds-shadow-overlay)`): Use for dialogs, popovers, command surfaces,
  and floating controls.

### Named rules

**The no-fake-depth rule.** Do not add shadow to make a bland layout feel more
designed. Fix hierarchy, spacing, and content grouping first.

**The overlay-only rule.** Popovers, menus, dialogs, and floating toolbars can
use overlay elevation. Inline sections and ordinary page bands should usually
remain unframed.

**The plane-pairing rule.** Pair raised surfaces with raised shadow when they
need movement or lift, and pair overlay surfaces with overlay shadow. Do not
mix overlay shadow into ordinary inline content.

## 7. Components

Shared components should feel compact, predictable, and stateful. Product and
art surfaces own their composition and visual direction; shared components retain
their implementation contract. Search the existing surface and `components/ui/`,
`components/ui-custom/`, and `components/ui-audio/` before building. Use supported
variants and slots; shared primitives own appearance and geometry. Preserve
supplied reference copy and layout when reproducing a specific product state.

### Interaction states

- Cover applicable hover, focus, pressed, selected, disabled, loading, error,
  and empty states. Persistent selection differs from a transient press.
- Loading feedback should preserve control geometry, hit targets, and accessible
  names. Use the shared loading appearance; consumers must guard pending actions
  against repeated pointer and keyboard activation. `isLoading` alone does not
  disable keyboard activation.
- Only enable an action when its consumer supplies the real capability. Missing
  callbacks should produce display-only, disabled, or omitted UI.
- Associate field errors with their fields; use page-level notices for request
  failures. Empty states should explain the situation and offer a real next step.

### Buttons

- **Shape and size:** `size="default"` and `size="icon"` use 32px targets and
  16px glyphs. `compact` and `icon-compact` use 24px targets and 12px glyphs.
  Buttons use `rounded-md`; `shape="circle"` uses the shared full-radius variant.
  Reserve compact sizes for dense surfaces and preserve touch targets.
- **Primary:** Use `bg-primary`, `text-primary-foreground`,
  `hover:bg-primary-hovered`, and pressed or expanded selected-state classes.
  Do not use primary styling for more than one action in the same section.
- **Secondary and outline:** Use neutral subtle backgrounds, semantic borders,
  and `text-text-subtle` rather than inventing low-contrast custom palettes.
- **Ghost:** Use transparent rest state with neutral subtle hover and active
  backgrounds.
- **Focus:** Preserve `focus-visible:border-ring` and
  `focus-visible:ring-ring/50` behavior.
- **Icons:** Let the shared variant own icon color, including separate semantic
  icon roles for neutral, selected, and disclosure states. Glyphs use
  `currentColor`; consumer overrides must not break state styling.

### Cards and containers

- **Shape:** Cards use `rounded-xl` in shared primitives. Repeated cards should
  not nest inside other cards.
- **Background:** Use `bg-card` or `bg-surface-raised` for framed content. Use
  full-width bands or unframed layouts for page sections.
- **Padding:** Compose Card with Header, Content, and Footer slots. The root owns
  vertical padding; slots own horizontal and footer padding. Default spacing is
  16px; `size="sm"` uses 12px. Image and footer slots adjust edge padding.
- **Shadow:** The shared Card supplies `shadow-sm` by default. Choose an
  unframed layout or existing container variant when content needs flatter
  grouping.

### Inputs and fields

- **Shape:** Inputs use `rounded-lg`, 32px height, and compact horizontal
  padding. `isCompact` uses 28px height.
- **Default:** Use semantic input background and border classes, not raw
  background colors.
- **Subtle:** Subtle inputs can reveal border and background on hover or focus.
  Subtle or borderless fields still need a visible affordance of editability.
- **Focus:** Preserve focused border and ring styles. Do not remove focus rings
  for visual quietness.
- **Disabled and read-only:** Disabled controls block interaction and use their
  primitive's disabled treatment. Read-only fields prevent editing but may remain
  focusable, selectable, copyable, and scrollable; they are not disabled controls.
- **Labels:** Every editable field needs a visible label. Placeholder text is a
  hint, not a label.

### Navigation

- **Style:** Navigation should be scannable before decorative. Use clear active
  states, compact gaps, and semantic text colors.
- **Tabs:** Persistent tabs need selected text plus a selected underline,
  marker, border, or background. A lone color change is not enough.
- **Sidebars:** Use sidebar token aliases in shared sidebar primitives. Override
  motion easing with shared duration and easing tokens when needed.
- **Route surfaces:** `app/` files are entrypoints. The durable visual design
  ownership usually lives in `components/projects/*`, `components/arts/*`,
  `components/blocks/*`, `components/ui/*`, or `components/website/*`.

### Icons and icon buttons

- **Source:** Use Atlaskit icons first, icon-lab icons second, and product logos
  from `@/components/ui/logo`. Avoid Unicode arrows, HTML entities, emoji, or
  handwritten glyphs for controls.
- **Size:** Product UI icons default to 16px glyphs; compact buttons use 12px.
  For stronger emphasis, place the glyph in a larger tile or button rather than
  scaling the glyph.
- **Color:** Standalone icons inherit `currentColor` from a semantic icon role.
  Pair `text-icon-subtle` with `text-text-subtle` and `text-icon-danger` with
  `text-text-danger`; matching roles can resolve to different colors.
- **Accessibility:** Icon-only buttons need an accessible name. Decorative icons
  sitting beside visible text should be hidden from assistive technology.

### Status and data primitives

- **Section messages:** Use a semantic background, role icon, title, neutral
  body text, and optional link-style actions. Use them for page-level or
  request-level notices, not field validation.
- **Tags:** Tags are decorative classification for categories, labels, and file
  types. They should not communicate semantic status.
- **Lozenges:** Lozenges communicate semantic status. Use the ADS visual-uplift
  treatment: a subtler status or accent fill, bolder status/accent text, and a
  subtle decorative border.
- **Badges:** Badges are compact count primitives. Use neutral badges for
  counts and semantic badges only when the count itself carries state.
- **Tables:** Table cells use readable body text. Compact table density is for
  dense read-only views, not a default way to compress complex interaction.
- **Empty states:** Empty states need a sentence-case heading, useful body copy,
  and a clear next-step action when one exists.
- **Charts:** Use chart token mappings for series and include a label, legend,
  pattern, or shape cue so data remains understandable without color alone.

### Motion and interaction

- **Duration:** Use `duration-instant`, `duration-xxshort`, `duration-fast`,
  `duration-normal`, `duration-medium`, `duration-slow`, `duration-slower`,
  and `duration-slowest`.
- **Easing:** Use `ease-out-practical` for hover/press and small, frequent popup
  entrances. Reserve `ease-out` for prominent entrances; use `ease-in` for exit
  and `ease-in-out` for in-place transforms. Follow the role-specific recipes in
  [Motion decisions](.agents/rules/motion-decisions.md), including faster exits.
- **Animated properties:** Animate opacity and transforms before layout
  properties. Avoid motion that changes layout in ways that break scanning.
- **Reduced motion:** Duration and easing aliases do not automatically respect
  `prefers-reduced-motion`. Add explicit CSS guards or `useReducedMotion()` to
  disable non-essential motion or replace it with instant state changes.
- **Focus of motion:** Use one focal animation when multiple elements change.
  Dense dashboards and repeated work surfaces should not run idle decorative
  loops.

Responsiveness includes typing, switching views, dragging, and repeated opening.
Measure acknowledgement and usable-content completion separately, distinguish
rendering work from network/model wait, and compare the same conditions before
and after a change. Preserve drafts, focus, and scroll when choosing view lifetime;
follow the [UI performance playbook](.agents/docs/playbooks/improve-ui-performance.md).

### Signature surfaces

Product surfaces under `components/projects/*` should default to a quiet,
work-focused register. Art surfaces under `components/arts/*` can be more
expressive, but each art surface should own that expression in its nested
component folder rather than leaking those choices into shared primitives.

## 8. Accessibility baseline

Accessibility is part of the shared visual contract, not a late verification
step. Shared primitives should make the accessible path the default path for
feature code.

- **Forms:** Editable fields need visible labels and associated helper or error
  messaging. Do not use placeholders as the only label.
- **Focus and keyboard:** Every interaction must be reachable by keyboard, with
  visible focus and no keyboard trap. Escape should dismiss overlays where that
  behavior is expected.
- **Structure:** Pages use semantic landmarks, one `h1`, and headings that do
  not skip levels.
- **Status communication:** Do not rely on color alone. Pair semantic color
  with an icon, label, shape, or message.
- **Responsive access:** Interfaces must remain usable at 320px width and 200%
  zoom without clipping critical content or hiding critical actions.
- **Announcements:** Dynamic notices, inline validation, async errors, and toast
  or flag content should use polite live regions. Use assertive announcements
  only for urgent failures.

## 9. Do's and Don'ts

### Do:

- **Do** reuse shared components and their supported variants, sizes, and slots.
- **Do** use semantic tokens for meaning and mapped accents for decoration.
- **Do** verify applicable states, keyboard focus, reduced motion, and responsive
  behavior on the target surface.
- **Do** use `next/image` with explicit `width` and `height` for images.
- **Do** map Figma values to ADS spacing, radius, typography, shadow, and
  semantic color tokens during implementation.

### Don't:

- **Don't** introduce new `bg-[var(--ds-...)]`, `text-[var(--ds-...)]`, or
  arbitrary token utilities when a semantic class already exists.
- **Don't** default every page section to a card or nest cards inside cards.
- **Don't** use decorative side-stripe borders, gradient text, generic
  glassmorphism, or repeated identical icon-heading-text card grids.
- **Don't** let one art surface's palette, shader, or motion language become a
  shared primitive unless it is intentionally extracted into the toolkit.
