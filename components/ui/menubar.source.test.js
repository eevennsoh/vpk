const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "menubar.tsx"), "utf8");

test("menubar content opens with an 8px trigger gap", () => {
	assert.match(source, /sideOffset = 8/u);
	assert.match(source, /<DropdownMenuContent[\s\S]*sideOffset=\{sideOffset\}/u);
});

test("menubar submenu content keeps the 12px menu container radius and 4px padding", () => {
	assert.match(source, /data-slot="menubar-sub-content"[\s\S]*\brounded-xl\b/u);
	assert.match(source, /data-slot="menubar-sub-content"[\s\S]*\bp-1\b/u);
	assert.doesNotMatch(source, /data-slot="menubar-sub-content"[\s\S]*\brounded-lg\b/u);
});

test("menubar items keep shortcut and icon children in the flex row", () => {
	assert.match(source, /import \{ Menu as MenuPrimitive \} from "@base-ui\/react\/menu";/u);
	assert.doesNotMatch(source, /DropdownMenuItem,/u);
	assert.match(source, /<MenuPrimitive\.Item[\s\S]*data-slot="menubar-item"/u);
	assert.match(source, /relative flex w-full cursor-pointer items-center gap-2 rounded-lg/u);
	assert.match(source, /hasStructuredSlots \? \([\s\S]*\) : \(\s*children\s*\)/u);
});

test("menubar menu rows use an 8px item radius", () => {
	assert.match(source, /const menubarRowBaseClassName =\s*"[^"]*\brounded-lg\b/u);
	assert.doesNotMatch(source, /const menubarRowBaseClassName =\s*"[^"]*\brounded-sm\b/u);
	assert.match(source, /data-slot="menubar-sub-trigger"[\s\S]*\brounded-lg\b/u);
});

test("menubar front slot icons use a 24px subtle icon container", () => {
	assert.match(source, /className="inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle \[&_\[data-slot=icon\]\]:text-icon-subtle \[&_svg\]:text-icon-subtle"/u);
	assert.doesNotMatch(source, /elemBefore \? \([\s\S]*?<span className=\{cn\("inline-flex h-5/u);
});

test("menubar selection checkmarks use the subtle icon color", () => {
	assert.match(source, /data-slot="menubar-checkbox-item-indicator"/u);
	assert.match(source, /data-slot="menubar-radio-item-indicator"/u);
	assert.equal(source.match(/className="text-icon-subtle"/gu)?.length, 2);
	assert.doesNotMatch(source, /className="text-text-selected"/u);
	assert.equal(source.match(/data-checked:text-text data-checked:data-\[highlighted\]:text-text/gu)?.length, 2);
	assert.doesNotMatch(source, /data-checked:bg-bg-selected/u);
	assert.doesNotMatch(source, /data-checked:text-text-selected/u);
});

test("menubar rows default to fixed 32px height", () => {
	assert.match(source, /const menubarRowHeightClassName = "h-8 py-0 whitespace-nowrap";/u);
	assert.match(
		source,
		/shouldWrapText \? menubarWrappingRowClassName : menubarRowHeightClassName/u,
	);
	assert.match(
		source,
		/allowTextWrap \? menubarWrappingRowClassName : menubarRowHeightClassName/u,
	);
	assert.match(
		source,
		/<DropdownMenuSubTrigger[\s\S]*allowTextWrap \? menubarWrappingRowClassName : menubarRowHeightClassName/u,
	);
	assert.doesNotMatch(source, /\bpy-2\b/u);
});

test("menubar rows default to 8px horizontal padding", () => {
	assert.match(source, /const menubarRowHorizontalPaddingClassName = "px-2";/u);
	assert.match(
		source,
		/<MenuPrimitive\.Item[\s\S]*menubarRowHorizontalPaddingClassName/u,
	);
	assert.match(
		source,
		/<DropdownMenuSubTrigger[\s\S]*menubarRowHorizontalPaddingClassName/u,
	);
	assert.match(source, /"pr-2 pl-10 data-checked:text-text/u);
	assert.doesNotMatch(source, /\bpx-3\b/u);
	assert.doesNotMatch(source, /\bpr-3\b/u);
});

test("menubar rows only use dropdown vertical padding when text can wrap", () => {
	assert.match(
		source,
		/const menubarWrappingRowClassName = "min-h-8 py-1\.5 whitespace-normal break-words";/u,
	);
	assert.match(source, /allowTextWrap\?: boolean;/u);
	assert.match(source, /const shouldWrapText = allowTextWrap \|\| Boolean\(description\);/u);
	assert.match(source, /shouldWrapText \? "whitespace-normal break-words" : "truncate"/u);
});

test("menubar shortcuts align to the far edge of the direct item row", () => {
	assert.match(source, /import \{ Kbd, KbdGroup \} from "@\/components\/ui\/kbd";/u);
	assert.doesNotMatch(source, /DropdownMenuShortcut/u);
	assert.match(source, /data-slot="menubar-shortcut"/u);
	assert.match(source, /ml-auto inline-flex shrink-0 items-center justify-end pl-6/u);
	assert.match(source, /group-data-\[highlighted\]\/menubar-item:\[&_kbd\]:text-text-subtle/u);
	assert.match(source, /<MenubarShortcutKeys shortcut=\{children\} \/>/u);
});

test("menubar shortcut strings render as VPK keycaps", () => {
	assert.match(source, /function MenubarShortcutKeys\(\{ shortcut \}: Readonly<\{ shortcut: string \}>\)/u);
	assert.match(source, /<KbdGroup>[\s\S]*<Kbd key=\{`\$\{key\}-\$\{index\}`\}>\{key\}<\/Kbd>[\s\S]*<\/KbdGroup>/u);
	assert.match(source, /return <Kbd>\{trimmedShortcut\}<\/Kbd>;/u);
});

test("menubar selected item icons use the VPK Icon wrapper", () => {
	assert.match(source, /import CheckMarkIcon from "@atlaskit\/icon\/core\/check-mark";/u);
	assert.match(source, /import \{ Icon \} from "@\/components\/ui\/icon";/u);
	assert.match(source, /<MenuPrimitive\.CheckboxItem[\s\S]*<Icon[\s\S]*render=\{<CheckMarkIcon label="" size="small" \/>\s*\}/u);
	assert.match(source, /<MenuPrimitive\.RadioItem[\s\S]*<Icon[\s\S]*render=\{<CheckMarkIcon label="" size="small" \/>\s*\}/u);
});
