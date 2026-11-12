const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { FREQUENT_EMOJI, emojiLabel } = require("./data/emoji-frequent.ts");

const readSource = (relativePath) =>
	fs.readFileSync(path.join(__dirname, relativePath), "utf8");

const BARREL_SOURCE = readSource("index.ts");
const FREQUENT_SOURCE = readSource("data/emoji-frequent.ts");
const PANEL_SOURCE = readSource("components/emoji-picker-panel.tsx");
const POPOVER_SOURCE = readSource("components/emoji-picker-popover.tsx");
const QUICK_BAR_SOURCE = readSource("components/emoji-quick-bar.tsx");
const REACTION_BAR_SOURCE = readSource("components/emoji-reaction-bar.tsx");
const REACTION_PILL_SOURCE = readSource("components/emoji-reaction-pill.tsx");
const PAGE_SOURCE = readSource("page.tsx");
const TOOLTIP_SOURCE = readSource("../../ui/tooltip.tsx");

test("the quick bar offers exactly six frequent reactions", () => {
	assert.equal(FREQUENT_EMOJI.length, 6);
	assert.equal(new Set(FREQUENT_EMOJI).size, 6);
	// Every glyph carries a spoken name so screen readers never announce
	// raw codepoints.
	for (const emoji of FREQUENT_EMOJI) {
		const label = emojiLabel(emoji);
		assert.notEqual(label, emoji, `expected a spoken name for ${emoji}`);
		assert.match(label, /^[a-z ]+$/u);
	}
	// Unknown glyphs degrade to the glyph rather than throwing.
	assert.equal(emojiLabel("🫥"), "🫥");
	assert.match(FREQUENT_SOURCE, /export const FREQUENT_EMOJI = \[[\s\S]*\] as const;/u);
});

test("the popover anchors through Base UI's render prop, not asChild", () => {
	assert.match(
		POPOVER_SOURCE,
		/import \{ Popover, PopoverContent, PopoverTrigger \} from "@\/components\/ui\/popover";/u,
	);
	assert.match(POPOVER_SOURCE, /<PopoverTrigger render=\{triggerElement\} \/>/u);
	assert.doesNotMatch(POPOVER_SOURCE, /asChild/u);
	// PopoverContent hardcodes w-72 and a roomy gap-2.5/p-2.5, so each view sets
	// its own width and tightens the frame to 4px around the icon-button row.
	assert.match(POPOVER_SOURCE, /isFullView \? "w-72 gap-0 p-0" : "w-auto gap-0 p-1"/u);
	// The portal clears the work-item dialog's z-index by default.
	assert.match(POPOVER_SOURCE, /positionerClassName = "z-\[502\]"/u);
	assert.match(POPOVER_SOURCE, /positionerClassName=\{positionerClassName\}/u);
	// Selection is repeatable: the popup stays open so several emoji can be added.
	assert.match(POPOVER_SOURCE, /function handleSelect[\s\S]*onSelect\(emoji\);/u);
	assert.doesNotMatch(
		POPOVER_SOURCE,
		/function handleSelect[\s\S]*handleOpenChange\(false\);/u,
	);
	// A real dismissal still resets the requested view for next time.
	assert.match(POPOVER_SOURCE, /setView\(defaultView\);/u);
});

test("frimousse loads only through the dynamic full-picker panel", () => {
	// The 762 KB emojibase fetch and the picker library must both stay off the
	// common path — the quick bar needs neither.
	assert.match(POPOVER_SOURCE, /dynamic\(\(\) => import\("\.\/emoji-picker-panel"\)/u);
	assert.match(POPOVER_SOURCE, /ssr: false/u);
	assert.doesNotMatch(POPOVER_SOURCE, /from "frimousse"/u);
	assert.doesNotMatch(QUICK_BAR_SOURCE, /from "frimousse"/u);
	assert.doesNotMatch(REACTION_BAR_SOURCE, /from "frimousse"/u);
	assert.doesNotMatch(REACTION_PILL_SOURCE, /from "frimousse"/u);
	// Exactly one module may import it.
	assert.match(PANEL_SOURCE, /\} from "frimousse";/u);
	// The panel is loaded via `dynamic()`, which needs a default export.
	assert.match(PANEL_SOURCE, /export default EmojiPickerPanel;/u);
});

test("the full picker reads self-hosted emojibase data", () => {
	// Same-origin under public/emoji-data, so it works offline and survives the
	// Micros static export.
	assert.match(PANEL_SOURCE, /emojibaseUrl="\/emoji-data"/u);
	assert.match(PANEL_SOURCE, /locale="en"/u);
	assert.doesNotMatch(PANEL_SOURCE, /https?:\/\/(cdn\.)?jsdelivr|unpkg\.com/u);
	// The viewport, not the popover, owns the scroll so the height never animates.
	assert.match(PANEL_SOURCE, /max-h-64 overflow-y-auto/u);
	// ADS semantic classes only.
	assert.doesNotMatch(PANEL_SOURCE, /\[var\(--ds-/u);
});

test("the reaction pill inherits its selected styling from the Button base", () => {
	assert.match(REACTION_PILL_SOURCE, /aria-pressed=\{pressed\}/u);
	// components/ui/button.tsx already maps aria-pressed to the selected token
	// set. The only local selected background is the transient confirmation tone.
	assert.doesNotMatch(REACTION_PILL_SOURCE, /bg-bg-selected(?:\s|")/u);
	assert.match(REACTION_PILL_SOURCE, /confirmed && "aria-pressed:bg-bg-selected-hovered"/u);
	assert.doesNotMatch(REACTION_PILL_SOURCE, /text-text-selected|border-border-selected/u);
	assert.match(REACTION_PILL_SOURCE, /variant="outline"/u);
	assert.match(REACTION_PILL_SOURCE, /size="compact"/u);
	// Chips share Tag's geometry: the squarish `rounded-sm` corner and a 12px
	// label. `shape="circle"` would force `rounded-full!` and win over both.
	assert.match(REACTION_PILL_SOURCE, /rounded-sm/u);
	assert.match(REACTION_PILL_SOURCE, /text-xs/u);
	assert.doesNotMatch(REACTION_PILL_SOURCE, /shape="circle"/u);
	// The count is visible text; only the glyph is hidden from screen readers.
	assert.match(REACTION_PILL_SOURCE, /<span aria-hidden="true">\{emoji\}<\/span>/u);
	assert.match(
		REACTION_PILL_SOURCE,
		/<TextMorphing config=\{REACTION_COUNT_MORPH\} text=\{String\(count\)\} \/>/u,
	);
	// The glyph is aria-hidden, so the name must spell it out rather than
	// re-injecting the codepoint the hidden span just suppressed.
	assert.match(
		REACTION_PILL_SOURCE,
		/aria-label=\{label \?\? `\$\{count\} reacted with \$\{emojiLabel\(emoji\)\}`\}/u,
	);
	assert.match(
		REACTION_PILL_SOURCE,
		/import \{ emojiLabel, formatReactionActorNames \} from "\.\.\/data\/emoji-frequent";/u,
	);
});

test("the reaction count morphs per digit instead of swapping", () => {
	// Adding a reaction should roll the count rather than hard-cut it, so the
	// chip reads as the same number changing.
	assert.match(
		REACTION_PILL_SOURCE,
		/import TextMorphing from "@\/components\/visual\/text-morphing";/u,
	);
	assert.match(
		REACTION_PILL_SOURCE,
		/const REACTION_COUNT_MORPH: TextMorphConfig = \{[\s\S]*variant: "number",/u,
	);
	// Pills mount with an existing count on page load; rolling every chip in on
	// first paint would be noise, not feedback.
	assert.match(REACTION_PILL_SOURCE, /const REACTION_COUNT_MORPH[\s\S]*initial: false,/u);
	// 9 -> 10 widens the chip; easing the width keeps the row from jumping.
	assert.match(REACTION_PILL_SOURCE, /const REACTION_COUNT_MORPH[\s\S]*autoSize: true,/u);
	// Reduced motion is TextMorphing's job (it renders static text) — the pill
	// must not hand-roll a second, divergent guard for the digits.
	assert.doesNotMatch(REACTION_PILL_SOURCE, /useReducedMotion/u);
	// Timing comes from the shared preset, never a hardcoded duration here.
	assert.doesNotMatch(REACTION_PILL_SOURCE, /const REACTION_COUNT_MORPH[\s\S]*duration:/u);
});

test("reaction pills disclose the reacting people on hover and keyboard focus", () => {
	assert.match(REACTION_PILL_SOURCE, /reactorNames\?: readonly string\[\];/u);
	assert.match(REACTION_PILL_SOURCE, /if \(!reactorNames\?\.length\) return pill;/u);
	assert.match(REACTION_PILL_SOURCE, /<TooltipTrigger render=\{pill\} \/>/u);
	assert.match(
		REACTION_PILL_SOURCE,
		/<TooltipContent className="flex max-w-64 flex-col items-center pb-3 text-center">/u,
	);
	assert.match(REACTION_PILL_SOURCE, /<h1 aria-hidden="true" className="p-3 text-4xl leading-none">/u);
	assert.match(REACTION_PILL_SOURCE, /\{formatReactionActorNames\(reactorNames\)\}\{" "\}/u);
	assert.doesNotMatch(REACTION_PILL_SOURCE, /<span className="text-text-subtlest">/u);
	assert.doesNotMatch(TOOLTIP_SOURCE, /\bshadow-(?:sm|md|lg|xl|2xl)\b/u);
	assert.match(PAGE_SOURCE, /reactorNames: \["Code Planner", "GitHub Copilot", "Unit Test Creator"\]/u);
});

test("the quick bar offers actions without presenting selected state", () => {
	assert.doesNotMatch(QUICK_BAR_SOURCE, /aria-pressed|selected/u);
	assert.doesNotMatch(POPOVER_SOURCE, /selected/u);
	assert.doesNotMatch(REACTION_BAR_SOURCE, /selected/u);
});

test("quick-bar emoji scale on hover without moving the button", () => {
	assert.match(
		QUICK_BAR_SOURCE,
		/transition-transform[\s\S]*duration-normal[\s\S]*ease-out-practical/u,
	);
	assert.match(QUICK_BAR_SOURCE, /group-hover\/button:scale-125/u);
	assert.match(QUICK_BAR_SOURCE, /group-focus-visible\/button:scale-125/u);
	assert.match(QUICK_BAR_SOURCE, /motion-reduce:transform-none/u);
	assert.match(QUICK_BAR_SOURCE, /motion-reduce:transition-none/u);
	assert.doesNotMatch(QUICK_BAR_SOURCE, /className="rounded-sm text-base[^\n]*scale-/u);
});

test("the quick bar stays mounted when the full picker opens", () => {
	// Unmounting it would destroy the "More emoji" button that holds focus at
	// that moment, stranding keyboard users on <body> outside a portalled,
	// non-modal popup. It also makes aria-expanded truthful rather than
	// permanently false.
	assert.match(POPOVER_SOURCE, /<EmojiQuickBar[\s\S]*showMoreExpanded=\{isFullView\}[\s\S]*\/>/u);
	assert.match(POPOVER_SOURCE, /\{isFullView \? <EmojiPickerPanel onSelect=\{handleSelect\} \/> : null\}/u);
	// The disclosure toggles both ways, which is what aria-expanded promises.
	assert.match(POPOVER_SOURCE, /onShowMore=\{\(\) => setView\(isFullView \? "quick" : "full"\)\}/u);
	// Regression guard: the two views must not be mutually exclusive branches.
	assert.doesNotMatch(POPOVER_SOURCE, /isFullView \? \(\s*<EmojiPickerPanel/u);
});

test("the expanded quick bar right-aligns a neutral disclosure", () => {
	assert.match(
		QUICK_BAR_SOURCE,
		/showMoreExpanded \? "ml-auto" : null/u,
	);
	assert.match(
		QUICK_BAR_SOURCE,
		/aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle/u,
	);
	assert.match(
		QUICK_BAR_SOURCE,
		/aria-expanded:hover:bg-bg-neutral-subtle-hovered aria-expanded:active:bg-bg-neutral-subtle-pressed/u,
	);
});

test("the reaction bar groups its controls and leaves reaction data controlled", () => {
	assert.match(REACTION_BAR_SOURCE, /role="group"/u);
	assert.match(REACTION_BAR_SOURCE, /"aria-label": ariaLabel = "Reactions",/u);
	assert.match(REACTION_BAR_SOURCE, /aria-label=\{ariaLabel\}/u);
	assert.match(REACTION_BAR_SOURCE, /\{leading\}/u);
	assert.match(REACTION_BAR_SOURCE, /<EmojiReactionPill/u);
	assert.match(REACTION_BAR_SOURCE, /showAddReaction \? \(/u);
	assert.match(REACTION_BAR_SOURCE, /<EmojiPickerPopover/u);
	// Toggle math belongs to the consumer's reducer; local state is visual only.
	assert.doesNotMatch(REACTION_BAR_SOURCE, /useReducer/u);
	// The quick bar is its own labelled group of named emoji buttons.
	assert.match(QUICK_BAR_SOURCE, /role="group"/u);
	assert.match(QUICK_BAR_SOURCE, /aria-label="Frequently used reactions"/u);
	assert.match(QUICK_BAR_SOURCE, /aria-label=\{emojiLabel\(emoji\)\}/u);
	assert.match(
		QUICK_BAR_SOURCE,
		/<span[\s\S]*aria-hidden="true"[\s\S]*>\s*\{emoji\}\s*<\/span>/u,
	);
	assert.match(QUICK_BAR_SOURCE, /aria-expanded=\{showMoreExpanded\}/u);
	assert.match(QUICK_BAR_SOURCE, /aria-label="More emoji"/u);
});

test("picker selections add reactions without toggling existing ones off", () => {
	assert.match(
		REACTION_BAR_SOURCE,
		/function handlePickerSelect\(emoji: string\)[\s\S]*reactions\.some\([\s\S]*reaction\.emoji === emoji && reaction\.reacted[\s\S]*if \(alreadyReacted\)[\s\S]*setConfirmedReaction\(emoji\);[\s\S]*return;[\s\S]*onToggleReaction\(emoji\);/u,
	);
	assert.match(REACTION_BAR_SOURCE, /onSelect=\{handlePickerSelect\}/u);
	assert.match(REACTION_BAR_SOURCE, /onToggle=\{onToggleReaction\}/u);
	assert.match(
		REACTION_BAR_SOURCE,
		/confirmed=\{confirmedReaction === reaction\.emoji\}/u,
	);
	assert.match(REACTION_BAR_SOURCE, /CONFIRMATION_HOLD_MS = 250/u);
	assert.match(REACTION_PILL_SOURCE, /duration-fast ease-out-practical motion-reduce:transition-none/u);
});

test("every picker surface uses Tag's squarish corner, never a pill", () => {
	// `shape="circle"` compiles to `rounded-full!`, whose `!important` beats any
	// rounded-* class passed via className — so the whole block must avoid it.
	for (const source of [
		REACTION_PILL_SOURCE,
		QUICK_BAR_SOURCE,
		POPOVER_SOURCE,
		PANEL_SOURCE,
		REACTION_BAR_SOURCE,
	]) {
		assert.doesNotMatch(source, /shape="circle"/u);
		assert.doesNotMatch(source, /rounded-full/u);
	}
	// The add-reaction trigger and the quick-bar controls opt into rounded-sm
	// explicitly, since the Button size presets ship rounded-md.
	assert.match(POPOVER_SOURCE, /className="rounded-sm"/u);
	assert.match(QUICK_BAR_SOURCE, /className="rounded-sm text-base"/u);
	assert.match(PANEL_SOURCE, /rounded-sm text-lg/u);
});

test("the quick-bar divider is centered against Separator's stretch default", () => {
	// Separator ships `data-vertical:self-stretch`. `align-self: stretch` only
	// stretches when the cross size is `auto`, so pairing it with an explicit
	// `h-5` silently degrades to flex-start and pins the rule to the top of the
	// 32px button row. The override must carry the same `data-vertical:` variant:
	// a bare `.self-center` (0,1,0) loses to `.data-vertical\:self-stretch[data-vertical]`
	// (0,2,0), and matching the variant also lets tailwind-merge drop the base.
	assert.match(QUICK_BAR_SOURCE, /data-vertical:self-center/u);
	assert.doesNotMatch(QUICK_BAR_SOURCE, /className="mx-1 h-5"/u);
});

test("the barrel exports the block's public surface without leaking frimousse", () => {
	for (const name of [
		"EmojiPickerPopover",
		"EmojiQuickBar",
		"EmojiReactionBar",
		"EmojiReactionPill",
	]) {
		assert.match(BARREL_SOURCE, new RegExp(`export \\{ ${name} \\}`, "u"));
		assert.match(BARREL_SOURCE, new RegExp(`export type \\{ ${name}Props \\}`, "u"));
	}
	// The panel must NOT be re-exported as a value: a static re-export would pull
	// frimousse (and its emojibase fetch) into every consumer of the barrel,
	// defeating the dynamic import in EmojiPickerPopover. The type is erased at
	// runtime and is therefore safe.
	assert.doesNotMatch(BARREL_SOURCE, /export \{ EmojiPickerPanel \}/u);
	assert.match(BARREL_SOURCE, /export type \{ EmojiPickerPanelProps \}/u);
	assert.match(BARREL_SOURCE, /export type \{ EmojiReactionSummary \}/u);
	assert.match(BARREL_SOURCE, /export \{ emojiLabel, FREQUENT_EMOJI \}/u);
	// The catalog helper derives importPath from the barrel's default export.
	assert.match(BARREL_SOURCE, /export \{ default \} from "@\/components\/blocks\/emoji-picker\/page";/u);
});

test("every quick-bar glyph round-trips against the self-hosted emojibase data", () => {
	// Reactions are keyed by the raw glyph string, so a quick-bar pick and a
	// full-picker pick of the same emoji must produce byte-identical keys.
	// Thumbs-up is the trap: emojibase ships "\u{1F44D}\u{FE0F}", not bare
	// "\u{1F44D}", and the mismatch silently creates two pills for one reaction.
	const dataPath = path.join(
		__dirname,
		"../../../public/emoji-data/en/data.json",
	);
	assert.ok(
		fs.existsSync(dataPath),
		"public/emoji-data/en/data.json is missing — run `pnpm run sync:emoji-data`",
	);
	const glyphs = new Set();
	const collect = (entries) => {
		for (const entry of entries) {
			glyphs.add(entry.emoji);
			if (entry.skins) collect(entry.skins);
		}
	};
	collect(JSON.parse(fs.readFileSync(dataPath, "utf8")));
	for (const emoji of FREQUENT_EMOJI) {
		assert.ok(
			glyphs.has(emoji),
			`FREQUENT_EMOJI entry ${JSON.stringify(emoji)} (codepoints ${[...emoji]
				.map((character) => character.codePointAt(0).toString(16))
				.join(" ")}) does not match any emojibase glyph verbatim`,
		);
	}
});
