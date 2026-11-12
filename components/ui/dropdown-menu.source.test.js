const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
	path.join(__dirname, "dropdown-menu.tsx"),
	"utf8",
);

test("dropdown menu popup uses a 12px container radius and 4px padding", () => {
	assert.match(source, /popup:\s*"[^"]*\brounded-xl\b/u);
	assert.match(source, /popup:\s*"[^"]*\bp-1\b/u);
	assert.doesNotMatch(source, /popup:\s*"[^"]*\brounded-lg\b/u);
});

test("dropdown menu front slot icons use a 24px subtle icon container", () => {
	assert.match(source, /const dropdownMenuFrontSlotClassName =\s*"inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle/u);
	assert.match(source, /<span className=\{dropdownMenuFrontSlotClassName\}>/u);
	assert.doesNotMatch(source, /elemBefore \? \([\s\S]*?<span className=\{cn\("inline-flex h-5/u);
});

test("dropdown menu selected indicator uses a 24px container aligned with item icons", () => {
	assert.match(source, /indicator:\s*"pointer-events-none absolute left-2 inline-flex size-6 items-center justify-center text-icon-subtle/u);
});

test("selection is a subtle check glyph and nothing else — no blue state anywhere", () => {
	// A checked row must render exactly like an unchecked one: same surface, same
	// label colour, same hover/pressed. The check mark alone marks the active
	// choice, and it sits on the subtle icon token so a long list stays quiet
	// instead of stacking a second competing signal on every selected row.
	assert.match(source, /checkedState: "",/u);
	for (const token of ["bg-bg-selected", "text-text-selected", "text-icon-selected"]) {
		assert.doesNotMatch(
			source,
			new RegExp(`\\b${token}\\b`, "u"),
			`${token} reintroduces a blue selected state`,
		);
	}
	// The `selected` prop still marks the row for consumers and still drives the
	// default trailing check; it just carries no styling of its own.
	assert.match(source, /data-selected=\{isSelected \|\| undefined\}/u);
	assert.match(source, /elemAfter \?\? \(selected \? <CheckMarkIcon label="" size="small" \/> : undefined\)/u);
	assert.doesNotMatch(source, /data-selected:[a-z[]/u);
});

test("dropdown menu rows use an 8px item radius", () => {
	assert.match(source, /selectableItem:\s*"[^"]*\brounded-lg\b/u);
	assert.match(source, /data-slot="dropdown-menu-item"[\s\S]*\brounded-lg\b/u);
	assert.match(source, /data-slot="dropdown-menu-sub-trigger"[\s\S]*\brounded-lg\b/u);
	assert.doesNotMatch(source, /\brounded-sm\b/u);
});

test("submenu triggers can omit the default chevron for custom trigger controls", () => {
	assert.match(source, /showChevron\?: boolean;/u);
	assert.match(source, /showChevron = true,/u);
	assert.match(source, /\{showChevron \? \([\s\S]*ChevronRightIcon[\s\S]*\) : null\}/u);
});

test("dropdown menu shortcut strings render as VPK keycaps", () => {
	assert.match(source, /import \{ Kbd, KbdGroup \} from "@\/components\/ui\/kbd";/u);
	assert.match(source, /function DropdownMenuShortcutKeys\(\{ shortcut \}: Readonly<\{ shortcut: string \}>\)/u);
	assert.match(source, /<DropdownMenuShortcutKeys shortcut=\{children\} \/>/u);
	assert.match(source, /<KbdGroup>[\s\S]*<Kbd key=\{`\$\{key\}-\$\{index\}`\}>\{key\}<\/Kbd>[\s\S]*<\/KbdGroup>/u);
	assert.match(source, /return <Kbd>\{trimmedShortcut\}<\/Kbd>;/u);
});

test("dropdown menu single rows lock to a fixed 32px height", () => {
	assert.match(source, /const dropdownMenuRowHeightClassName = "h-8 py-0";/u);
	assert.match(
		source,
		/shouldWrapText \? dropdownMenuWrappingRowClassName : dropdownMenuRowHeightClassName/u,
	);
	assert.match(
		source,
		/allowTextWrap \? dropdownMenuWrappingRowClassName : dropdownMenuRowHeightClassName/u,
	);
});

test("dropdown menu rows only use vertical padding when text can wrap", () => {
	assert.match(
		source,
		/const dropdownMenuWrappingRowClassName = "min-h-8 py-1\.5";/u,
	);
	assert.match(source, /allowTextWrap\?: boolean;/u);
	assert.match(
		source,
		/const shouldWrapText = allowTextWrap \|\| Boolean\(description\);/u,
	);
	assert.match(
		source,
		/shouldWrapText \? "whitespace-normal break-words" : "truncate"/u,
	);
});

test("dropdown menu item maps onSelect to Base UI click activation", () => {
	assert.match(
		source,
		/type DropdownMenuItemClickHandler = NonNullable<MenuPrimitive\.Item\.Props\["onClick"\]>;/u,
	);
	assert.match(
		source,
		/interface DropdownMenuItemProps extends Omit<MenuPrimitive\.Item\.Props, "onSelect">/u,
	);
	assert.match(
		source,
		/const handleClick: DropdownMenuItemClickHandler = \(event\) => \{\s*onClick\?\.\(event\);[\s\S]*onSelect\?\.\(event\);[\s\S]*event\.preventBaseUIHandler\(\);[\s\S]*\};/u,
	);
	assert.match(source, /onClick=\{handleClick\}/u);
});

test("selectable rows can move the check to the trailing edge for left-aligned labels", () => {
	// The default stays the historical leading check, so no existing callsite
	// shifts. `end` is strictly opt-in.
	for (const component of ["DropdownMenuCheckboxItem", "DropdownMenuRadioItem"]) {
		assert.match(
			source,
			new RegExp(`interface ${component}Props[\\s\\S]*?indicatorPlacement\\?: DropdownMenuIndicatorPlacement;`, "u"),
			`${component} does not accept indicatorPlacement`,
		);
	}
	assert.equal(source.match(/indicatorPlacement = "start",/gu).length, 2);
	assert.match(source, /export type DropdownMenuIndicatorPlacement = "start" \| "end";/u);

	// The leading gutter and the indicator must move together: dropping `pl-8`
	// without moving the glyph would leave a vacant start column, and moving
	// the glyph without dropping `pl-8` would indent labels past nothing.
	assert.equal(
		source.match(/isIndicatorAtEnd \? dropdownStyles\.selectableItemIndicatorEnd : null,/gu).length,
		2,
	);
	assert.equal(
		source.match(/isIndicatorAtEnd \? dropdownStyles\.indicatorEnd : dropdownStyles\.indicator/gu).length,
		2,
	);
	// Trailing tick is in-flow `ml-auto` like SubTrigger; undoing `pl-8` is
	// enough because the glyph no longer needs a reserved 24px gutter.
	assert.match(source, /selectableItemIndicatorEnd: "pl-2",/u);
	assert.match(source, /indicatorEnd:\s*"pointer-events-none ml-auto inline-flex shrink-0/u);
	assert.match(source, /const isDefaultSelectionGlyph = Boolean\(selected\) && elemAfter === undefined/u);
	assert.match(source, /isDefaultSelectionGlyph\s*\n\s*\? dropdownStyles\.indicatorEnd/u);

	// DOM order follows visual order so a trailing check is announced after the
	// label it qualifies, not before it.
	assert.equal(
		source.match(/\{isIndicatorAtEnd \? null : indicator\}\s*\{children\}\s*\{isIndicatorAtEnd \? indicator : null\}/gu).length,
		2,
	);
});

test("trailing selected indicators keep the tick and match the submenu chevron slot", () => {
	// Selected rows stay a check mark. End placement is in-flow `ml-auto` at
	// `size="small"` so the tick shares padding and size with SubTrigger's `>`.
	assert.match(source, /function DropdownMenuSelectionGlyph\(/u);
	assert.match(source, /render=\{<CheckMarkIcon label="" size="small" \/>\}/u);
	assert.doesNotMatch(
		source,
		/const IndicatorIcon = atEnd \? ChevronRightIcon : CheckMarkIcon/u,
	);
	assert.equal(source.match(/<DropdownMenuSelectionGlyph \/>/gu).length, 2);
});

test("Base UI selection indicators center glyphs without baseline offset", () => {
	assert.match(
		source,
		/const dropdownMenuSelectionIndicatorClassName =\s*"flex items-center justify-center leading-none";/u,
	);
	assert.equal(
		source.match(
			/<MenuPrimitive\.(?:Checkbox|Radio)ItemIndicator\s+className=\{dropdownMenuSelectionIndicatorClassName\}\s*>/gu,
		)?.length,
		2,
	);
});

test("caller elemAfter stays pointer-interactive", () => {
	// The default tick can sit in `indicatorEnd` (`pointer-events-none`). A
	// caller-supplied trailing control, like the Auto merge Switch, must not.
	assert.match(source, /const isDefaultSelectionGlyph = Boolean\(selected\) && elemAfter === undefined/u);
	assert.doesNotMatch(
		source,
		/resolvedElemAfter \? \(\s*<span\s+className=\{cn\(\s*dropdownStyles\.indicatorEnd/u,
	);
});
