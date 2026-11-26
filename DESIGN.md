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

When adding a rule here, decide first whether matching code can find a
violation (a class, token, prop, or component restyle). If it can, enforce it
as a lint error in `eslint.config.mjs` with a case in
`scripts/eslint-boundary-rules.test.js` and existing hits baselined in
`eslint-suppressions.json`, following
[Design-system lint maintenance](.agents/rules/component-architecture.md#design-system-lint-maintenance),
and keep a one-line rule plus its reason here. Only judgment-only rules live
here as prose alone.

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
  selected background, selected text, and selected border or marker. ADS
  finesse makes these states neutral; checked controls use the bold selected
  background and inverse mark. Keep focus indicators and primary actions distinct.

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

**The accent-is-not-status rule.** Mapped hue classes such as `bg-red-50` or
`text-green-600` are decoration for tags, file types, avatars, and categories.
Do not use them for errors, warnings, success, or selection; use the matching
semantic family, such as `bg-bg-danger` with `text-text-danger`.

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
font shorthand. The finesse theme gives medium through xxsmall headings a
500 weight; large and larger headings retain their existing weights. For
ordinary UI text, `text-sm` pairs 14px type with 20px line
height and `text-xs` pairs 12px with 16px; use mapped utilities for weight and
color. Avoid viewport-scaled type for fixed tool surfaces because it makes
compact controls unpredictable. Lint: `vpk-tokens/no-viewport-type`.

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
- **No all caps or eyebrows:** Do not uppercase or letter-space text in product
  surfaces, blocks, or shared components, including section labels, lozenges,
  tags, badges, and table headers. Do not place a small overline label above a
  heading. When a heading needs a category, put a Lozenge (status) or Tag
  (classification) beside it, or a byline under it. Art and website surfaces
  can opt in as part of their own identity, as can motion-led stages (see
  [Signature surfaces](#signature-surfaces)). Lint:
  `vpk-tokens/no-uppercase-tracking` (`.ts` and `.tsx` in projects, blocks,
  `ui`, `ui-custom`, and screen-assistant; finale stages excluded).
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
  moments. Do not apologize ("Sorry", "Unfortunately") unless the system caused
  the problem, and keep it brief when it did.

## 5. Layout, shape, and focus

Layout should use spacing, grouping, and component shape before decorative
effects. Keep the root contract token-first, but apply the tokens through the
repo's semantic Tailwind classes whenever a class exists.

- **Spacing rhythm:** Start spacing, padding, margin, gap, and inset values on
  the ADS 8px rhythm through classes mapped from `--ds-space-*`. Use smaller
  steps for component interiors and larger steps for unrelated page regions.
- **Spacing grid:** Padding, margin and gap are always multiples of 4px or 6px
  (2, 4, 6, 8, 12, 16, 18, 20, 24…). Never 10px (`*-2.5`) or 14px (`*-3.5`).
  When a component's side padding is 12px, its top and bottom padding is 12px
  too unless the design specifies otherwise. Text inputs keep ADS's `4px 10px`
  as the one exception. Lint: `vpk-tokens/no-off-grid-spacing`; existing uses
  are baselined in `eslint-suppressions.json`.
  Why: off-grid values like 10px break the 4px/6px rhythm and read as slightly
  wrong next to 12px neighbours.
  <!-- 2026-11-19: "right gap 12px is applied to top/bottom gap. Right now it's 10px (weird padding)… it should be increment of 4px or 6px when possible" -->
- **Relationship by proximity:** Related controls sit closer together than
  unrelated groups. Avoid applying the same gap everywhere when hierarchy needs
  to stay scannable.
- **Menu and picker rows:** Use a 2px gap between adjacent rows and an 8px
  (`rounded-lg`) corner radius for each row. In agent selectors, apply that
  radius to both the row surface and its agent button. Give the whole row the
  dropdown item's 6px top and bottom padding; let its content determine the
  height. Why: agent selectors follow the dropdown menu row treatment.
  This applies to every popover that lists rows, not only `DropdownMenu`: a
  `Popover` row list takes `dropdownStyles.surface` and `dropdownStyles.padding`
  from `components/ui/dropdown-menu.tsx` and marks each row `data-menu-row` so
  `menu-row-spacing` adds the 2px gap (`SourcesMenu` does this).
  <!-- 2026-11-17: "sources preview menu needs to have the new dropdown menu padding style" -->
  <!-- 2026-11-14: "each row item separation will need to be 2px"; "corner radius of each individual row item should be 8px not 6px" -->
  <!-- 2026-11-14: "follow dropdown menu rows logic, it's based on top/bottom padding"; "why only part of it is done that way? But not the entire row?"; "corner radius needs to be 8px" -->
- **Menu and picker subheadings:** Add a 6px top margin (`--ds-space-075`)
  when content precedes a subheading without a separator. Do not add this
  margin to the first subheading or after a separator.
  <!-- 2026-11-14: "if there's content above the subheading and we are not using a separator, we should be adding a margin-top of 6px" -->
- **Menu and picker separators:** Use `DropdownMenuSeparator` from
  `components/ui/dropdown-menu.tsx` between sections instead of a border on an
  adjacent row or container. Every separator extends from the menu surface's
  left edge to its right edge, including separators inside scrollable lists.
  Its shared treatment uses `bg-border`, a 1px line, and `--menu-inset` for
  edge-to-edge alignment and equal vertical margins; set `--menu-inset` to the
  surrounding menu's inset without introducing horizontal scrolling. Lint:
  `shadcn/no-restyle` (`menuRowSeparatorContract`) rejects row borders on
  `DropdownMenu*` items, labels, and groups.
  <!-- 2026-11-14: "for any separators, rather than a border bottom, we should be using this treatment" -->
  <!-- 2026-11-18: "it should be extending all the way left and right in the new styling guide" -->
- **Dropdown menus scroll vertically only:** Fit menu content within the available
  width; never require horizontal scrolling. Why: users cannot perform the
  intended top-to-bottom menu interaction with a horizontal scrollbar.
  <!-- 2026-11-18: "it's always top to bottom, there's never horizontal scrollbar, user can't perform that" -->
- **Radius by component intent:** Use the established shared primitive radius
  first, then the step for the component's class in
  [Radius by component](#radius-by-component). Choose by what the component
  is, not by taste.
- **Border width:** Resting borders, dividers, and outlines are 1px. Use 2px
  only for a selected marker, such as the tab underline, together with the
  selected colors. Do not thicken a resting border for emphasis or use
  fractional widths such as 1.5px. Lint: `vpk-tokens/no-fractional-border`.
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
- **Icon and label alignment:** Always center a side-by-side icon and label,
  including documentation heading anchors, on the same vertical centerline.
  Use the icon as a direct child of a flex row with `items-center` or give its
  wrapper `inline-flex items-center`. Why: a plain inline wrapper adds text
  baseline spacing that can make the glyph sit high even in a centered row.
  <!-- 2026-11-13: "why do i keep getting this icon and label is misaligned vertically issue" -->
  <!-- 2026-11-22: "it makes the icon an label alignment off all the time" -->
- **Board-column scrollbars:** Hide scrollbar chrome in scrollable board columns,
  including on hover, while keeping the columns scrollable. Why: keep the board
  visually clean.
  <!-- 2026-11-13: "on column hover we don't need to show any scrollbar on the column, please hide the scrollbar reveal" -->

### Radius by component

Sizes are the default values of the mapped `--ds-radius-*` tokens.

| Class | Default | Use for |
| --- | --- | --- |
| `rounded-xs` | 2px | Badges, tag counts and remove buttons, square avatar labels |
| `rounded-sm` | 4px | Lozenges, tags, checkboxes, keyboard shortcuts, date labels |
| `rounded-md` | 6px | Buttons, toggles, select triggers, tabs, nav items, tooltips, alerts |
| `rounded-lg` | 8px | Inputs, textareas, menu and picker rows, popovers, dropdown and context menus, hover cards |
| `rounded-xl` | 12px | Cards, dialogs, drawers, command palettes |
| `rounded-2xl` | 16px | Large media and showcase containers; `rounded-3xl` and `rounded-4xl` resolve to the same value |
| `rounded-full` | pill | Avatars, pills, circular buttons, switches, radios, rounded tags |
| `rounded-tile` | 25% | Tile and IconTile only |

Map a Figma radius to the nearest step instead of adding an arbitrary value such
as `rounded-[10px]`. Lint: `vpk-tokens/no-arbitrary-radius`.

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
- **Overlay** (`shadow-2xl`, `var(--ds-shadow-overlay)`): Use for dialogs,
  popovers, command surfaces, and floating controls. Shared primitive defaults
  and consumer restyling must use `shadow-2xl` for overlay elevation. Never use
  `shadow-xl` on overlay surfaces: it adds a second 1px perimeter to the ADS
  overlay shadow. There is no `shadow-overlay` class. Lint: the
  `overlaySurfaceContract` rejects `shadow-xl` on overlay `*Content`.

### Named rules

**The no-fake-depth rule.** Do not add shadow to make a bland layout feel more
designed. Fix hierarchy, spacing, and content grouping first.

**The overlay-only rule.** Popovers, menus, dialogs, and floating toolbars can
use overlay elevation. Inline sections and ordinary page bands should usually
remain unframed.

**The plane-pairing rule.** Pair raised surfaces with raised shadow when they
need movement or lift, and pair overlay surfaces with overlay shadow. Do not
mix overlay shadow into ordinary inline content.

**The single-perimeter rule.** Raised cards and overlay surfaces using an
elevation shadow, including shared primitive defaults, must never add a visible
decorative outer border, ring, or additional perimeter shadow. The elevation
shadow already defines the edge, so an added perimeter creates a double outline.
Keep distinct focus or selection indicators when they communicate state.
<!-- 2026-11-15: "this extra 1px border on the card" -->
<!-- 2026-11-16: "we don't add this extra 1px border stroke on menu overlays because the overlay shadow already visually mimic that" -->

## 7. Components

Shared components should feel compact, predictable, and stateful. Product and
art surfaces own their composition and visual direction; shared components retain
their implementation contract. Search the existing surface and `components/ui/`,
and `components/ui-custom/` before building. Use supported
variants and slots; shared primitives own appearance and geometry. Preserve
supplied reference copy and layout when reproducing a specific product state.

- **Menu search fields:** Use `DropdownMenuSearchField` from
  `components/ui/dropdown-menu.tsx` for search inside menus, including agent
  selectors and editor palettes. Preserve the shared 32px search row, 14px
  input text, the 16px `SearchIcon` from `components/ui/vpk-icons.tsx`, and 6px
  top and side insets from the popup edge. Never use a compact 12px search glyph
  or count the popup's padding twice; using the shared field alone does not
  guarantee the same rendered geometry. Measure the search icon and row visual
  centers, and the search input text and row label starts: each pair must align
  within 1px. Match the search icon column to the rows with
  `iconContainerSize`: use `16` for a standalone 16px search icon beside 16px
  row icons or icon tiles (Parent, Labels and Subtasks pickers); use `24` (the
  default) for a 16px search icon centered in a 24px container beside 24px avatars
  or tiles (agent selectors and editor palettes). The search glyph stays 16px in
  both layouts; only its container and alignment column change. Keep this popup
  search pattern distinct from a combobox whose input is the trigger. Why: matching the rows' leading
  visual size keeps search icons and text aligned with the row icons and labels.
  `tests/projects/butter-v1-create-card.spec.ts` guards the row-icon and label
  alignment. The inline-create work item type and priority menus keep
  `DropdownMenuContent`'s original default width (`min-w-56`, 224px) and have no
  search field.
  <!-- 2026-11-14: "the way i want my search box to appear consistently throughout EVERY component is the way we do it in agent selector" -->
  <!-- 2026-11-15: "why would you use a smaller search input design?? it should be the same as Labels or Parent" -->
  <!-- 2026-11-15: "We use 16x16 search icon when the individual rows are 16x16 icon or icon tile"; "We use 24x24 search icon container when the individual rows are 24x24 avatars or icon tile" -->
  <!-- 2026-11-15: "keep the same width like what we had before"; "we also dont need search input" (inline-create work item type menu); "the same should apply" (PriorityRowField menu). -->
- **Menu row icons:** For plain icons, use `IconTile` with
  `variant="transparent"`, `size="xxsmall"`, and `iconSize="small"`: a 12px
  glyph in a 16px container. Why: consistent icon size keeps menu rows visually
  balanced and aligned. This includes work item type, Priority, Parent and
  Subtasks pickers.
  <!-- 2026-11-21: "when we use pure icons for our menu, we should always follow this" — 12x12 glyph in a 16x16 transparent IconTile, superseding the earlier bare-icon instruction. -->
- **Searchable dropdowns:** Use `DropdownMenuContent` and `DropdownMenuItem`
  with their shared container padding and row styling; do not substitute command
  list rows or override the dropdown's default inset. Center leading row icons,
  including work item status glyphs, in the matching 16px or 24px alignment
  column on the same vertical centerline as the search icon. Keep alignment
  gutters outside the icon container; the column is layout
  space, not the visual's size. Use a 12px gap (`gap-3`) between that
  slot and the row text so keys and titles start at the search text's left edge,
  matching `ArtifactParentField`. Why: the search header and rows must share
  the same icon and text columns, as in the Parent menu. Searchable and ordinary
  dropdowns should look like the same component.
  <!-- 2026-11-14: "it isn't even following the dropdown menu existing rows pattern"; "even the padding and all is not the same" -->
  <!-- 2026-11-15: "help me also align the work item status to the search icon, you can see the parent menu can align nicely" -->
  <!-- 2026-11-15: "remove the 24x24 sizing of the icon tile but instead use 16x16"; "for the epic/parent icon tile, we can just have the icon" -->
  <!-- 2026-11-15: "actually icon size should be 12x12 not 16x16" supersedes the earlier 16px work item glyph size; search stays 16px. -->
  <!-- 2026-11-15: "actually we need to have it with the 16x16 container, otherwise it doesn't align nicely with the search icon" supersedes the earlier 12px container request. -->
- **Dropdown scroll edges:** Keep the standard bottom inset inside the scroll
  area (6px for the default menu inset), including in non-searchable submenus.
  When the list fits without scrolling, retain that inset below its last row.
  When the list overflows, extend the scroll viewport to the menu's inner
  bottom edge or fixed footer separator within 1px, so rows can scroll to that
  edge. Why: an empty strip outside the viewport cuts off visible row pixels.
  <!-- 2026-11-21: "we don't remove all bottom gap, like this that's not scrollable, we shouldn't remove the gap" -->
  <!-- 2026-11-21: "bottom gap problem. it shouldn't be a gap." -->
  <!-- 2026-11-14: "we shouldn't cut away pixels with the bottom gap like that." -->
  <!-- 2026-11-14: "we can't have this empty gap cut out UI problem." -->
  <!-- 2026-11-21: "the search icon is misaligned and there's this extra bottom gap. we shouldn't have that." -->
- **Scrollable searchable dropdowns:** Keep the search field fixed above the
  scrollable rows and use the shared scroll mask with a 3rem top fade when the
  list has scrolled. Why: the top fade shows rows moving beneath the fixed
  search field.
  <!-- 2026-11-14: "give me a longer list that will allow me to scroll. i want to make sure we apply the gradient mask fading gradient" -->
- **Menu and agent-selector scroll edges:** Do not apply a bottom gradient fade
  to scrollable menu or agent-selector lists. Clip rows cleanly at the container
  edge or fixed footer separator. Why: the straight container edge provides the
  clean cutout.
  <!-- 2026-11-14: "we don't need the gradient scroll fade at the bottom because we can rely on the straight clean cut out from the container edge"; "or any other menus we shouldn't do that too" -->

### Interaction states

- **An underline is always the color of the text it sits under.** Never draw a
  link-blue underline under neutral text. When a link wraps an element that sets
  its own text color (a Trace line, an Item, a title span), remove the link's
  underline (`no-underline`) and underline the text element itself, or give the
  link the text's color; color underlines only with `decoration-current`.
  Why: a mismatched underline reads as a broken, foreign link style.
  `vpk-tokens/no-mismatched-underline-color` rejects other `decoration-<color>`
  classes; `components/ui/trace.tsx` underlines `TraceTitle` itself.
  <!-- 2026-11-17: "we should never do blue underline for black text"; "underline color should always match text color" -->
- **Inline-create selector previews:** Priority and work item type triggers stay
  neutral while closed. While open, pointer hover and keyboard navigation preview
  both the candidate's icon and its semantic color, matching its menu row. Only
  selection commits the value; dismissing restores the committed icon and neutral
  color. Why: work item type previews must reveal color just like priority previews;
  changing only the glyph leaves the preview incomplete. Reuse the same visual
  renderer for the trigger and its rows. The inline-create browser regressions in
  `tests/projects/butter-v1-create-card.spec.ts` guard both selectors.
  <!-- 2026-11-15: "the changes we made for the priority change where the value visibly change as you scroll through the list"; "we should do the same ... but we need to color the work item type. right now it doesn't reveal the color." -->
- Cover applicable hover, focus, pressed, selected, disabled, loading, error,
  and empty states. Persistent selection differs from a transient press.
- Loading feedback should preserve control geometry, hit targets, and accessible
  names. Use the shared loading appearance; consumers must guard pending actions
  against repeated pointer and keyboard activation. `isLoading` alone does not
  disable keyboard activation.
- **Keep prototype controls enabled when their behavior is unfinished**, unless
  the user asks for a disabled state or the reference design shows one.
  Why: a prototype can include clickable placeholders without implementing the
  feature behind them.
  <!-- 2026-11-13: "this is just a prototype, it can be a button to no where" -->
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
- **Trailing affordance icons are 12px.** Disclosure chevrons, including Select
  and Combobox trigger chevrons, and external-link arrows that follow a label use
  12×12px (`size-3`) glyphs centered in a 16×16px slot; leading content icons in
  the same row stay 16px. Why: they are secondary hints and should not compete
  with the leading icon or the label. `components/ui/trace.tsx` sizes every icon
  after a `TraceTitle` and its collapsible chevron this way, so Task, Sources and
  Queue inherit it.
  <!-- 2026-11-17: "all the chevron, external link arrow size should be 12x12 not 16x16"; "Same for task, need to use 12x12 chevron" -->
  <!-- 2026-11-22: "chevron size is wrong here in the menu ... we want it to be 12x12 icon size" -->
- **Color:** Standalone icons inherit `currentColor` from a semantic icon role.
  Pair `text-icon-subtle` with `text-text-subtle` and `text-icon-danger` with
  `text-text-danger`; matching roles can resolve to different colors. Chevrons,
  bullets, sort arrows, and other secondary indicators use `text-icon-subtle`
  or `text-icon-subtlest`; do not use `text-icon-brand` as a general emphasis
  color.
- **Search magnifiers:** Use `color.icon.subtlest` (`text-icon-subtlest`) in
  search fields across navigation, menus, agent selectors, editor palettes, and
  other surfaces. Use `DropdownMenuSearchField`'s default icon or
  `InputGroupSearchAddon` when applicable. Why: search cues stay visually
  secondary to the surrounding content.
  <!-- 2026-11-21: "the icon color should be icon subtlest ... across all components and surfaces like search box, agent selector, editor palette ... and everywhere else" -->
- **Accessibility:** Icon-only buttons need an accessible name. Decorative icons
  sitting beside visible text should be hidden from assistive technology.

### Status and data primitives

- **Avatar stacks:** Use the shared `AvatarGroup` or `HumanAgentAvatar` for
  overlapping human and agent avatars. Mask the rear artwork so the actual
  surface shows through the gap in both resting and animated states. Never add
  a painted separator ring. Keep the avatar's own inset border and any focus or
  selection indicator.
  <!-- 2026-11-21: "in all the latest avata stack, it should be a mask cut out" -->
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
  Assign the categorical colors in order, `chart-1` through `chart-8`, unless
  there is a reason to remap. When a series represents a status, use the
  semantic chart colors: `chart-success`, `chart-warning`, `chart-danger`,
  `chart-information`, `chart-discovery`, and `chart-neutral`.

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
- **Spring and bounce:** `ease-spring` belongs to the role recipes in
  [Motion decisions](.agents/rules/motion-decisions.md), currently avatar hover.
  Do not add bounce, elastic, or overshoot easing to product surfaces; art
  surfaces can own expressive easing.
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

Motion-led stages are a mix of product UI and art: a choreographed scene inside
a project, such as the keynote finale under
`components/projects/jira-team-eu26-end/finale/`. They follow the art rules
within their own folder. A stage scaled from a Figma frame can keep the values
that scaling produces, including fractional border widths and arbitrary radii,
and can use uppercase labels. The rest of the project around the stage stays in
the product register.
<!-- 2026-11-14: "leave them as they are because they're all motion related projects. It's more of a unique mix of product UI + art project." -->

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
- **Don't** use the hero-metric template (oversized number, tiny label,
  decorative gradient) or sparklines with no labeled metric or legend.
- **Don't** let one art surface's palette, shader, or motion language become a
  shared primitive unless it is intentionally extracted into the toolkit.
