const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const read = (name) => readFileSync(join(__dirname, name), "utf8");

const SHELL_SOURCE = read("card.tsx");
const INTERACTION_SOURCE = read("use-card-interaction.ts");
const PARTS_SOURCE = read("parts.tsx");
const VARIANTS_SOURCE = read("variants.tsx");
const AGENT_SOURCE = read("agent.tsx");
const AGENT_EXPANDED_SOURCE = read("agent-expanded.tsx");
const APP_SOURCE = read("app.tsx");
const SKILL_SOURCE = read("skill.tsx");
const TOOL_SOURCE = read("tool.tsx");
const KNOWLEDGE_SOURCE = read("knowledge.tsx");
const INDEX_SOURCE = read("index.ts");
const SKILL_TAG_SOURCE = read(join("..", "skill-tag.tsx"));
const AGENT_BROWSER_SOURCE = readFileSync(
	join(__dirname, "..", "..", "blocks", "agent-browser", "components", "agent-browser.tsx"),
	"utf8",
);

test("shell preserves the bordered surface and hover-elevation classes", () => {
	assert.match(SHELL_SOURCE, /group\/card/u);
	assert.match(SHELL_SOURCE, /data-active=\{active \|\| undefined\}/u);
	// Resting fill is the overlay surface so cards match their elevated container
	// (modals/dialogs sit on surface-overlay); identical to `surface` in light mode
	// but correctly lighter in dark mode. See #966-followup.
	assert.match(SHELL_SOURCE, /rounded-md bg-surface-overlay p-4/u);
	// Focus ring + border fade now key off the overlay select button's focus-visible
	// state (via :has) instead of the article's own focus, since the article is no
	// longer focusable — see the overlay-button regression test below (#709).
	assert.match(SHELL_SOURCE, /has-\[\[data-slot=card-directory-select\]:focus-visible\]:ring-3 has-\[\[data-slot=card-directory-select\]:focus-visible\]:ring-ring\/50/u);
	assert.match(SHELL_SOURCE, /willChange: "transform"/u);
	// The resting border is an overlay pseudo-element that fades out on hover/focus so
	// only the elevation shadow remains — never a persistent real border in the resting
	// state. A *selected* card is the deliberate exception (see the selected-border test).
	assert.doesNotMatch(SHELL_SOURCE, /\bborder border-border\b/u);
	assert.match(SHELL_SOURCE, /after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-md after:border after:transition-colors/u);
	assert.match(SHELL_SOURCE, /after:border-border hover:after:border-transparent has-\[\[data-slot=card-directory-select\]:focus-visible\]:after:border-transparent/u);
	assert.match(SHELL_SOURCE, /active = false/u);
	assert.match(SHELL_SOURCE, /active && !selected && "after:border-transparent"/u);
	assert.match(SHELL_SOURCE, /const cardVariants = \{[\s\S]*rest: \{ boxShadow: "none" \},[\s\S]*hover: hoverAnimation,[\s\S]*\} as const;/u);
	assert.match(SHELL_SOURCE, /animate: active \? "hover" : "rest"/u);
	assert.match(SHELL_SOURCE, /initial: "rest"/u);
	assert.match(SHELL_SOURCE, /variants: cardVariants/u);
	assert.match(SHELL_SOURCE, /whileHover: "hover"/u);
	assert.doesNotMatch(SHELL_SOURCE, /hover:border-border-selected/u);
	assert.doesNotMatch(SHELL_SOURCE, /hover:after:ring-border-selected/u);
});

test("shell paints a persistent blue border for a selected card (survives hover)", () => {
	assert.match(SHELL_SOURCE, /selected\?: boolean/u);
	assert.match(SHELL_SOURCE, /selected = false/u);
	// Selected → blue border with NO hover-transparent fade. Resting → gray border that fades.
	assert.match(SHELL_SOURCE, /selected\s*\n?\s*\?\s*"after:border-border-selected"/u);
	assert.match(SHELL_SOURCE, /:\s*"after:border-border hover:after:border-transparent/u);
});

test("shell uses a dedicated overlay <button> for selection, not a role=button wrapper", () => {
	// Regression for #709: a whole-card role="button" must not wrap nested interactive
	// controls (checkboxes, menu buttons). Selection is a real <button> overlay instead,
	// so nested controls are valid sibling controls rather than focusable descendants.
	assert.doesNotMatch(SHELL_SOURCE, /role="button"/u);
	assert.doesNotMatch(SHELL_SOURCE, /tabIndex=\{0\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /onKeyDown=/u);
	assert.match(SHELL_SOURCE, /<button/u);
	assert.match(SHELL_SOURCE, /data-slot="card-directory-select"/u);
	assert.match(SHELL_SOURCE, /aria-label=\{selectLabel\}/u);
	assert.match(SHELL_SOURCE, /onClick=\{handleSelect\}/u);
	assert.match(SHELL_SOURCE, /type="button"/u);
	// Overlay sits beneath card content so nested controls stay clickable.
	assert.match(SHELL_SOURCE, /absolute inset-0 z-0 cursor-pointer/u);
	assert.match(SHELL_SOURCE, /\[&>\*\]:relative \[&>\*\]:z-10/u);
	assert.doesNotMatch(SHELL_SOURCE, /whileTap/u);
	// Focus ring follows the overlay button's focus-visible state, not the article's.
	assert.match(SHELL_SOURCE, /has-\[\[data-slot=card-directory-select\]:focus-visible\]:ring-3/u);
});

test("inert card content lets clicks fall through to the select button", () => {
	assert.match(SHELL_SOURCE, /\[&>\*\]:pointer-events-none/u);
	assert.match(SHELL_SOURCE, /\[&_:is\(a,button,input,select,textarea\)\]:pointer-events-auto/u);
	assert.match(SHELL_SOURCE, /\[&_:is\(a,button,input,select,textarea\)\]:relative/u);
	assert.match(SHELL_SOURCE, /\[&_:is\(a,button,input,select,textarea\)\]:z-10/u);
	assert.match(SHELL_SOURCE, /\[&_\[role=button\]\]:pointer-events-auto/u);
	assert.match(SHELL_SOURCE, /\[&_\[role=menuitem\]\]:pointer-events-auto/u);
	assert.doesNotMatch(SHELL_SOURCE, /\[&_button\]:pointer-events-auto/u);
	assert.doesNotMatch(SHELL_SOURCE, /\[&_input\]:pointer-events-auto/u);
});

test("scrollable card body stays scrollable inside an interactive (selectable) card", () => {
	assert.match(AGENT_EXPANDED_SOURCE, /data-slot="card-directory-scroll"/u);
	assert.match(AGENT_EXPANDED_SOURCE, /pointer-events-auto relative z-10[^"]*overflow-y-auto/u);
	assert.match(AGENT_EXPANDED_SOURCE, /data-slot="card-directory-scroll"[\s\S]*?onScroll=/u);
	assert.match(AGENT_EXPANDED_SOURCE, /onClick=\{onSelect \? handleBodyClick : undefined\}/u);
	assert.match(AGENT_EXPANDED_SOURCE, /closest\("a,button,\[role=button\],\[role=menuitem\],input,select,textarea"\)/u);
});

test("interaction hook derives interactivity from onSelect and drops manual key handling", () => {
	assert.match(INTERACTION_SOURCE, /const interactive = Boolean\(onSelect\)/u);
	assert.match(INTERACTION_SOURCE, /useReducedMotion\(\)/u);
	assert.doesNotMatch(INTERACTION_SOURCE, /TAP_ANIMATION/u);
	assert.doesNotMatch(INTERACTION_SOURCE, /tapAnimation/u);
	assert.doesNotMatch(INTERACTION_SOURCE, /handleKeyDown/u);
	assert.doesNotMatch(INTERACTION_SOURCE, /event\.key/u);
	assert.match(INTERACTION_SOURCE, /handleSelect/u);
});

test("interaction hook keeps the card border visible while adding hover elevation", () => {
	assert.match(INTERACTION_SOURCE, /boxShadow: OVERLAY_SHADOW/u);
	assert.doesNotMatch(INTERACTION_SOURCE, /TRANSPARENT_BORDER_COLOR/u);
	assert.doesNotMatch(INTERACTION_SOURCE, /borderColor/u);
	assert.doesNotMatch(INTERACTION_SOURCE, /scale: 1\.006/u);
});

test("parts carry data-slot attributes for the shared shell pieces", () => {
	for (const slot of [
		"card-directory-header",
		"card-directory-byline",
		"card-directory-description",
		"card-directory-footer",
		"card-directory-stat",
		"card-directory-section",
		"card-directory-banner",
		"card-directory-capabilities",
	]) {
		assert.match(PARTS_SOURCE, new RegExp(`data-slot="${slot}"`, "u"));
	}
});

test("header leading is optional and only renders the leading span when present", () => {
	assert.match(PARTS_SOURCE, /leading\?: ReactNode/u);
	assert.match(PARTS_SOURCE, /className="flex items-center gap-2"/u);
	// Non-selectable leading still renders the bare inline span verbatim.
	assert.match(PARTS_SOURCE, /<span className="inline-flex shrink-0 items-center leading-none">\{leading\}<\/span>/u);
	assert.doesNotMatch(PARTS_SOURCE, /items-start/u);
});

test("header swaps the leading visual for a default 16x16 checkbox in selectable mode", () => {
	assert.match(PARTS_SOURCE, /import \{ Checkbox \} from "@\/components\/ui\/checkbox"/u);
	assert.match(PARTS_SOURCE, /selectable\?: boolean/u);
	assert.match(PARTS_SOURCE, /onSelectedChange\?: \(checked: boolean\) => void/u);
	assert.match(PARTS_SOURCE, /<EntityCardSelectableLeading\b/u);
	// Icon fades out on hover / keyboard-visible descendant focus / while selected; the checkbox fades in.
	assert.match(PARTS_SOURCE, /selected \? "opacity-0" : "opacity-100 group-hover\/card:opacity-0 group-has-\[:focus-visible\]\/card:opacity-0"/u);
	assert.match(PARTS_SOURCE, /group-hover\/card:pointer-events-auto group-hover\/card:opacity-100 group-has-\[:focus-visible\]\/card:pointer-events-auto group-has-\[:focus-visible\]\/card:opacity-100/u);
	assert.match(PARTS_SOURCE, /onCheckedChange=\{\(checked\) => onSelectedChange\?\.\(Boolean\(checked\)\)\}/u);
	// Icon + checkbox share a fixed 32px box so the swap never shifts layout; the checkbox
	// itself keeps its native 16x16 default (its className opens with opacity, not size-*).
	assert.match(PARTS_SOURCE, /relative inline-flex size-8 shrink-0 items-center justify-center/u);
	assert.match(PARTS_SOURCE, /<Checkbox\s+aria-label=\{label\}\s+checked=\{selected\}\s+className=\{cn\(\s*"opacity-0/u);
	assert.match(PARTS_SOURCE, /after:inset-0 focus-visible:pointer-events-auto focus-visible:opacity-100/u);
});

test("header supports a wider trailing status control without using the added checkmark", () => {
	assert.match(PARTS_SOURCE, /trailingStatus\?: ReactNode/u);
	assert.match(PARTS_SOURCE, /onAddedChange\?: \(checked: boolean\) => void/u);
	assert.match(PARTS_SOURCE, /const defaultTrailingStatus = onAddedChange \? \(/u);
	assert.match(PARTS_SOURCE, /const trailingStatusControl = trailingStatus \?\? defaultTrailingStatus;/u);
	assert.match(PARTS_SOURCE, /const hasTrailingStatus = Boolean\(trailingStatusControl\);/u);
	assert.match(PARTS_SOURCE, /action \|\| added \|\| hoverAdded \|\| hasTrailingStatus/u);
	assert.match(PARTS_SOURCE, /action[\s\S]*\? added \? "w-16" : "w-6 group-hover\/card:w-16 group-has-\[:focus-visible\]\/card:w-16 group-data-\[active=true\]\/card:w-16"[\s\S]*: added \? "w-8" : "w-0 group-hover\/card:w-8 group-has-\[:focus-visible\]\/card:w-8"/u);
	assert.match(PARTS_SOURCE, /hasTrailingStatus[\s\S]*\? added \? "-translate-x-10" : "group-hover\/card:-translate-x-10 group-has-\[:focus-visible\]\/card:-translate-x-10 group-data-\[active=true\]\/card:-translate-x-10"/u);
	assert.match(PARTS_SOURCE, /hasTrailingStatus\s*\? "pointer-events-auto absolute top-1\/2 right-0 inline-flex -translate-y-1\/2 items-center"/u);
	assert.match(PARTS_SOURCE, /\{trailingStatusControl \?\? <EntityCardAddedCheck/u);
	assert.match(PARTS_SOURCE, /export function EntityCardAddedSwitch/u);
	assert.match(PARTS_SOURCE, /"transition-opacity duration-fast ease-out motion-reduce:transition-none after:inset-0"/u);
	assert.match(PARTS_SOURCE, /<Switch[\s\S]*aria-label=\{`\$\{added \? "Remove" : "Add"\} \$\{title\}`\}[\s\S]*checked=\{added\}[\s\S]*onCheckedChange=\{onAddedChange\}/u);
	assert.match(SKILL_SOURCE, /trailingStatus\?: ReactNode/u);
	assert.match(SKILL_SOURCE, /onAddedChange\?: \(checked: boolean\) => void/u);
	assert.match(SKILL_SOURCE, /trailingStatus=\{trailingStatus\}/u);
	assert.match(SKILL_SOURCE, /onAddedChange=\{onAddedChange\}/u);
});

test("banner part draws the full-bleed cover and hexagon-outlined cover avatar", () => {
	assert.match(PARTS_SOURCE, /relative shrink-0 overflow-hidden bg-surface/u);
	assert.match(PARTS_SOURCE, /backgroundColor: coverColor/u);
	assert.match(PARTS_SOURCE, /getBannerCoverColor/u);
	assert.match(PARTS_SOURCE, /avatarBadge\?: ReactNode/u);
	assert.doesNotMatch(PARTS_SOURCE, /shape="hexagon"/u);
	assert.match(PARTS_SOURCE, /group\/avatar absolute top-6 left-4 h-12 w-\[42px\]/u);
	assert.match(PARTS_SOURCE, /data-size="xl"/u);
	assert.match(PARTS_SOURCE, /stroke-surface/u);
});

test("capabilities part renders a borderless icon-tile feature list (no inner scroll)", () => {
	assert.match(PARTS_SOURCE, /@atlaskit\/icon-lab\/core\/ai-model/u);
	assert.match(PARTS_SOURCE, /<ul className="flex flex-col gap-1">/u);
	assert.match(PARTS_SOURCE, /className="flex items-center gap-2"/u);
	assert.doesNotMatch(PARTS_SOURCE, /rounded-xl border border-border bg-bg-input/u);
	assert.doesNotMatch(PARTS_SOURCE, /max-h-44/u);
});

test("agent variant renders a hexagon avatar with rating and chat stats", async () => {
	assert.match(AGENT_SOURCE, /<AgentAvatarVisual/u);
	const view = await renderComponent({ entry: "components/ui-custom/entity-card/agent.tsx", exportName: "EntityCardAgent", props: { name: "Example agent", publisher: "Example" } });
	assert.notEqual(view.container.querySelector('[data-slot="avatar"][data-shape="hexagon"]'), null);
	await view.unmount();
	assert.match(AGENT_SOURCE, /StarUnstarredIcon/u);
	assert.match(AGENT_SOURCE, /AiChatIcon/u);
	assert.match(AGENT_SOURCE, /<EntityCardByline/u);
	assert.match(AGENT_SOURCE, /chats/u);
});

test("expanded agent variant adds a cover banner and scrollable capabilities to the agent layout", () => {
	assert.match(AGENT_EXPANDED_SOURCE, /<EntityCardBanner/u);
	assert.match(AGENT_EXPANDED_SOURCE, /avatarBadge=\{avatarBadge\}/u);
	assert.match(AGENT_EXPANDED_SOURCE, /<EntityCardCapabilities/u);
	assert.match(AGENT_EXPANDED_SOURCE, /capabilities: readonly \(EntityCardCapability \| string\)\[\]/u);
	assert.match(AGENT_EXPANDED_SOURCE, /StarUnstarredIcon/u);
	assert.match(AGENT_EXPANDED_SOURCE, /AiChatIcon/u);
	assert.match(AGENT_EXPANDED_SOURCE, /<EntityCardByline/u);
});

test("expanded agent variant declares a self-contained skill tag type", () => {
	assert.match(AGENT_EXPANDED_SOURCE, /export interface EntityCardSkillTag/u);
	assert.match(AGENT_EXPANDED_SOURCE, /skills\?: ReadonlyArray<EntityCardSkillTag>/u);
	assert.doesNotMatch(AGENT_EXPANDED_SOURCE, /from "\.\/template"/u);
});

test("expanded agent variant renders Works with sources and Skills tags", () => {
	assert.match(AGENT_EXPANDED_SOURCE, /TWGAppstack/u);
	assert.match(AGENT_EXPANDED_SOURCE, /<TWGAppstack animated=\{false\}/u);
	assert.match(AGENT_EXPANDED_SOURCE, /const ENTITY_CARD_SKILLS_MAX_ROWS = 2/u);
	assert.match(AGENT_EXPANDED_SOURCE, /<SkillTagGroup className=\{ENTITY_CARD_SKILLS_GROUP_CLASS_NAME\} maxRows=\{ENTITY_CARD_SKILLS_MAX_ROWS\}>/u);
	assert.match(AGENT_EXPANDED_SOURCE, /maxVisible=\{8\}/u);
	assert.match(AGENT_EXPANDED_SOURCE, /label="Works with"/u);
	assert.match(AGENT_EXPANDED_SOURCE, /label="Skills"/u);
});

test("expanded agent variant pins the header and footer around a scrollable body region", () => {
	assert.match(AGENT_EXPANDED_SOURCE, /data-slot="card-directory-sticky-header"/u);
	assert.match(AGENT_EXPANDED_SOURCE, /flex min-h-0 flex-auto flex-col gap-3 overflow-y-auto px-4 pt-2/u);
	assert.match(AGENT_EXPANDED_SOURCE, /<div className="pb-4">\s*<EntityCardCapabilities/u);
	// The expanded shell variant resets layout (clip + zero padding/gap).
	assert.match(VARIANTS_SOURCE, /gap-0 overflow-clip p-0/u);
	assert.match(AGENT_EXPANDED_SOURCE, /shrink-0 overflow-clip border-t border-border bg-surface/u);
	assert.match(AGENT_EXPANDED_SOURCE, /group-hover\/card:opacity-0 group-has-\[:focus-visible\]\/card:opacity-0/u);
	assert.match(AGENT_EXPANDED_SOURCE, /group-hover\/card:pointer-events-auto group-hover\/card:opacity-100 group-has-\[:focus-visible\]\/card:pointer-events-auto group-has-\[:focus-visible\]\/card:opacity-100/u);
});

test("skill variant uses a 32px icon tile, header byline, and a teammate stat", () => {
	assert.match(SKILL_SOURCE, /IconTile/u);
	assert.match(SKILL_SOURCE, /size="medium"/u);
	assert.match(SKILL_SOURCE, /@atlaskit\/icon\/core\/star-unstarred/u);
	assert.match(SKILL_SOURCE, /@atlaskit\/icon\/core\/people-group/u);
	assert.match(SKILL_SOURCE, /\{formatCompact\(teammateCount\)\} teammates/u);
	assert.match(SKILL_SOURCE, /EntityCardByline/u);
	assert.match(SKILL_SOURCE, /hoverAdded\?: boolean/u);
	assert.match(SKILL_SOURCE, /hoverAdded=\{hoverAdded\}/u);
	assert.match(SKILL_SOURCE, /onAddedChange=\{onAddedChange\}/u);
	assert.match(PARTS_SOURCE, /hoverAdded\?: boolean/u);
	assert.match(SKILL_SOURCE, /trailingStatus=\{trailingStatus\}/u);
	assert.doesNotMatch(PARTS_SOURCE, /from "motion\/react"/u);
	assert.doesNotMatch(PARTS_SOURCE, /AnimatePresence/u);
	assert.doesNotMatch(PARTS_SOURCE, /motion\.span/u);
	assert.match(PARTS_SOURCE, /"relative h-6 shrink-0 overflow-visible transition-\[width\] duration-fast ease-out motion-reduce:transition-none"/u);
	assert.match(PARTS_SOURCE, /: added \? "w-\[52px\]" : hoverAdded \? "w-6 group-hover\/card:w-\[52px\] group-data-\[active=true\]\/card:w-\[52px\]" : "w-6"/u);
	assert.match(PARTS_SOURCE, /"absolute top-0 right-0 z-\[1\] inline-flex transition-transform duration-fast ease-out motion-reduce:transition-none"/u);
	assert.match(PARTS_SOURCE, /: added \? "-translate-x-7" : hoverAdded \? "group-hover\/card:-translate-x-7 group-data-\[active=true\]\/card:-translate-x-7" : "translate-x-0"/u);
	assert.doesNotMatch(PARTS_SOURCE, /group-has-\[:focus-visible\]\/card:-translate-x-6/u);
	assert.doesNotMatch(PARTS_SOURCE, /group-hover\/card:pointer-events-none group-hover\/card:opacity-0 group-has-\[:focus-visible\]\/card:opacity-0/u);
	assert.match(PARTS_SOURCE, /"pointer-events-none absolute top-0 right-0 inline-flex size-6 origin-center items-center justify-center transition-\[opacity,transform\] duration-fast ease-out motion-reduce:transition-none"/u);
	assert.match(PARTS_SOURCE, /added\s*\? "scale-100 opacity-100"\s*: hoverAdded\s*\? "scale-75 opacity-0 group-hover\/card:scale-100 group-hover\/card:opacity-100 group-data-\[active=true\]\/card:scale-100 group-data-\[active=true\]\/card:opacity-100"\s*: "scale-75 opacity-0"/u);
	assert.match(PARTS_SOURCE, /<EntityCardAddedCheck className=\{added \? undefined : "text-icon-disabled"\} label=\{added \? "Added" : ""\} \/>/u);
	assert.doesNotMatch(PARTS_SOURCE, /group-hover\/card:scale-100 group-hover\/card:opacity-100 group-has-\[:focus-visible\]\/card/u);
	assert.doesNotMatch(PARTS_SOURCE, /absolute left-full inline-flex/u);
	assert.doesNotMatch(PARTS_SOURCE, /absolute left-full ml-2/u);
	assert.doesNotMatch(PARTS_SOURCE, /absolute right-full mr-2/u);
	assert.doesNotMatch(PARTS_SOURCE, /text-icon-disabled[^"]*group-has-\[:focus-visible\]/u);
});

test("app variant mirrors the tool card layout with tool, knowledge, and teammate counts", () => {
	assert.match(APP_SOURCE, /data-slot="entity-card-app"/u);
	assert.match(APP_SOURCE, /@atlaskit\/icon-lab\/core\/wrench/u);
	assert.match(APP_SOURCE, /@atlaskit\/icon\/core\/book-with-bookmark/u);
	assert.match(APP_SOURCE, /knowledgeCount\?: number/u);
	assert.match(APP_SOURCE, /\{toolCount\} tools/u);
	assert.match(APP_SOURCE, /\{knowledgeCount\} knowledge/u);
	assert.match(APP_SOURCE, /\{teammateCount\} teammates/u);
});

test("app variant reveals an onboarding prompt suggestion + handle on hover", () => {
	assert.match(APP_SOURCE, /promptSuggestion\?: string/u);
	assert.match(APP_SOURCE, /mentionHandle\?: string/u);
	// The swap only renders when a prompt is supplied; otherwise the card keeps its
	// plain description (backward compatible).
	assert.match(APP_SOURCE, /if \(promptSuggestion\) \{/u);
	// Resting (description + stats) and the prompt layer share one grid cell so the
	// card height never shifts; they cross-fade on card hover/focus-within.
	assert.match(APP_SOURCE, /\[grid-area:1\/1\][\s\S]*group-hover\/card:opacity-0 group-focus-within\/card:opacity-0/u);
	assert.match(APP_SOURCE, /opacity-0 \[grid-area:1\/1\][\s\S]*group-hover\/card:opacity-100 group-focus-within\/card:opacity-100/u);
	// Prompt is quoted; handle reads "@ <lowercase-id>".
	assert.match(APP_SOURCE, /“\$\{promptSuggestion\}”/u);
	assert.match(APP_SOURCE, /@ \{mentionHandle\}/u);
});

test("tool variant uses an app-logo tile with tool and teammate counts", () => {
	assert.match(TOOL_SOURCE, /@atlaskit\/icon-lab\/core\/wrench/u);
	assert.match(TOOL_SOURCE, /@atlaskit\/icon\/core\/people-group/u);
	assert.match(TOOL_SOURCE, /active\?: boolean/u);
	assert.match(TOOL_SOURCE, /<EntityCardMoreButton active=\{active\}/u);
	assert.match(TOOL_SOURCE, /tools/u);
	assert.match(TOOL_SOURCE, /teammates/u);
});

test("knowledge variant renders app identity, a publisher byline, and star/teammate stats", () => {
	assert.match(KNOWLEDGE_SOURCE, /data-slot="entity-card-knowledge"/u);
	assert.match(KNOWLEDGE_SOURCE, /title=\{name\}/u);
	assert.match(KNOWLEDGE_SOURCE, /byline=\{publisher \? <EntityCardByline publisher=\{publisher\} verified=\{verified\} \/> : undefined\}/u);
	assert.doesNotMatch(KNOWLEDGE_SOURCE, /providerName/u);
	assert.match(KNOWLEDGE_SOURCE, /@atlaskit\/icon\/core\/star-unstarred/u);
	assert.match(KNOWLEDGE_SOURCE, /@atlaskit\/icon\/core\/people-group/u);
	assert.match(KNOWLEDGE_SOURCE, /formatCompact\(starCount\)/u);
	assert.match(KNOWLEDGE_SOURCE, /\{formatCompact\(teammateCount\)\} teammates/u);
});

test("skill tag group collapses wrapped rows into the overflow count", () => {
	assert.match(SKILL_TAG_SOURCE, /getSkillCollectionMetadata/u);
	assert.match(SKILL_TAG_SOURCE, /type SkillTagColor = SkillCollectionId \| "2p3p"/u);
	assert.match(SKILL_TAG_SOURCE, /type SkillTagVariant = "default" \| "on-colored"/u);
	assert.match(SKILL_TAG_SOURCE, /bg-bg-inverse-subtle text-primary-foreground/u);
	assert.match(SKILL_TAG_SOURCE, /maxRows\?: number/u);
	assert.match(SKILL_TAG_SOURCE, /calculateVisibleSkillTagCount/u);
	assert.match(SKILL_TAG_SOURCE, /<SkillTagCount count=\{hiddenCount\} \/>/u);
	assert.match(SKILL_TAG_SOURCE, /ResizeObserver/u);
});

test("skill tag overlay remove always fades the trailing edge behind the control", () => {
	assert.match(SKILL_TAG_SOURCE, /const shouldShowOverlayScrim = hasOverlayReveal;/u);
	assert.match(SKILL_TAG_SOURCE, /data-slot="skill-tag-overlay-scrim"/u);
	assert.match(SKILL_TAG_SOURCE, /shouldShowOverlayScrim && "group-hover\/skill-tag:\[mask-image:linear-gradient/u);
	assert.match(SKILL_TAG_SOURCE, /group-has-\[:focus-visible\]\/skill-tag:pointer-events-auto group-has-\[:focus-visible\]\/skill-tag:opacity-100/u);
	assert.doesNotMatch(SKILL_TAG_SOURCE, /labelHasOverflow/u);
});

test("barrel exports the shell, parts, content components, and directory cards", () => {
	for (const symbol of [
		"EntityCardShell",
		"EntityCardHeader",
		"EntityCardFooter",
		"EntityCardStat",
		"EntityCardBanner",
		"EntityCardCapabilities",
		"EntityCardAgent",
		"EntityCardAgentExpanded",
		"EntityCardApp",
		"EntityCardSkill",
		"EntityCardTool",
		"EntityCardKnowledge",
		"EntityCardAgentCard",
		"EntityCardAgentExpandedCard",
		"EntityCardAppCard",
		"EntityCardSkillCard",
		"EntityCardToolCard",
		"EntityCardKnowledgeCard",
	]) {
		assert.match(INDEX_SOURCE, new RegExp(`\\b${symbol}\\b`, "u"));
	}
	// The template card is no longer an entity card — it lives in ui-custom/agent-card.
	assert.doesNotMatch(INDEX_SOURCE, /EntityCardTemplate/u);
});

test("entity-card namespace owns content, shell, directory cards, and parts", () => {
	for (const symbol of [
		"EntityCard",
		"Agent",
		"AgentExpanded",
		"AgentProfile",
		"App",
		"Knowledge",
		"ObjectTile",
		"Skill",
		"Tool",
		"Shell",
		"AgentCard",
		"AgentExpandedCard",
		"AppCard",
		"SkillCard",
		"ToolCard",
		"KnowledgeCard",
		"Header",
		"Description",
		"Footer",
		"Stat",
		"Byline",
		"MoreButton",
		"Section",
		"Banner",
		"Capabilities",
	]) {
		assert.match(INDEX_SOURCE, new RegExp(`\\b${symbol}\\b`, "u"));
	}
	assert.doesNotMatch(INDEX_SOURCE, /Template/u);
});

test("directory cards wrap entity-card content in the shared shell", () => {
	assert.match(VARIANTS_SOURCE, /<EntityCardShell active=\{active\}/u);
	assert.match(VARIANTS_SOURCE, /<EntityCardAgent\b/u);
	assert.match(VARIANTS_SOURCE, /<EntityCardAgentExpanded\b/u);
	assert.match(VARIANTS_SOURCE, /<EntityCardApp\b/u);
	assert.match(VARIANTS_SOURCE, /<EntityCardSkill\b/u);
	assert.match(VARIANTS_SOURCE, /<EntityCardTool\b/u);
	assert.match(VARIANTS_SOURCE, /<EntityCardKnowledge\b/u);
});

test("skill/app/tool/knowledge cards opt into multi-select when a `selected` boolean is passed", () => {
	// `onSelect` toggles; `(checked?: boolean)` lets the checkbox forward its state.
	assert.match(VARIANTS_SOURCE, /onSelect\?: \(checked\?: boolean\) => void/u);
	// App/tool/knowledge multi-select mode (checkbox swap + blue border) is gated on
	// `selected !== undefined`; skill cards also accept an explicit `selectable`
	// override for surfaces that use card clicks without the checkbox affordance.
	const gateCount = VARIANTS_SOURCE.match(/const selectable = selected !== undefined;/gu) ?? [];
	assert.equal(gateCount.length, 3);
	assert.match(VARIANTS_SOURCE, /const checkboxSelectable = selectable \?\? selected !== undefined;/u);
	assert.match(VARIANTS_SOURCE, /cardActionLabel\?: string/u);
	assert.match(VARIANTS_SOURCE, /function getDefaultShellSelectLabel/u);
	assert.match(VARIANTS_SOURCE, /return onSelect \|\| !onAddedChange \? selectLabel : addActionLabel;/u);
	assert.match(VARIANTS_SOURCE, /const addActionLabel = `\$\{added \? "Remove" : "Add"\} \$\{name\}`;/u);
	assert.match(VARIANTS_SOURCE, /const handleSelect = onSelect \?\? \(onAddedChange \? \(\) => onAddedChange\(!added\) : undefined\);/u);
	assert.match(VARIANTS_SOURCE, /const shellSelectLabel = cardActionLabel \?\? getDefaultShellSelectLabel\(\{ onAddedChange, onSelect, addActionLabel, selectLabel \}\);/u);
	// Each selectable wrapper threads selection to BOTH the shell (border) and content (checkbox).
	const shellLabelCount = VARIANTS_SOURCE.match(/selectLabel=\{shellSelectLabel\}/gu) ?? [];
	assert.equal(shellLabelCount.length, 4);
	assert.match(VARIANTS_SOURCE, /onSelectedChange=\{onSelect\}/u);
	const labelCount = VARIANTS_SOURCE.match(/\$\{selected \? "Deselect" : "Select"\} \$\{name\}/gu) ?? [];
	assert.equal(labelCount.length, 4);
});

test("agent-browser renders the shared EntityCardAgentCard (no inline card duplication)", () => {
	assert.match(AGENT_BROWSER_SOURCE, /import \{[\s\S]*EntityCardAgentCard,[\s\S]*\} from "@\/components\/ui-custom\/entity-card"/u);
	assert.match(AGENT_BROWSER_SOURCE, /<EntityCardAgentCard/u);
	assert.doesNotMatch(AGENT_BROWSER_SOURCE, /AgentDirectoryCard/u);
	assert.doesNotMatch(AGENT_BROWSER_SOURCE, /AGENT_CARD_HOVER_ANIMATION/u);
});
