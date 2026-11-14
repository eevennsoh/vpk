const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const DIALOG = "components/blocks/conversation-starter/components/conversation-starter.tsx";
const ROW = "components/blocks/conversation-starter/components/conversation-starter-row.tsx";
const PICKER = "components/blocks/conversation-starter/components/starter-icon-picker.tsx";
const DATA = "components/blocks/conversation-starter/data/starters.ts";

test("Conversation Starter is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("conversation-starter", "Conversation Starter"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("conversation-starter", "Conversation Starter"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ ConversationStarterDialog \} from "@\/components\/blocks\/conversation-starter";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"conversation-starter": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/conversation-starter-demo"\)/u,
	);
});

test("Conversation Starter docs demo starts closed until the trigger is clicked", () => {
	const source = readProjectFile("components/blocks/conversation-starter/page.tsx");

	assert.match(source, /const \[open, setOpen\] = useState\(false\);/u);
	assert.match(source, /Edit conversation starters/u);
});

test("Conversation Starter exposes controlled, generate, and save props", () => {
	const source = readProjectFile(DIALOG);
	const indexSource = readProjectFile("components/blocks/conversation-starter/index.ts");

	assert.match(source, /export interface ConversationStarterDialogProps/u);
	assert.match(source, /starters\?: readonly ConversationStarter\[\]/u);
	assert.match(source, /defaultStarters\?: readonly ConversationStarter\[\]/u);
	assert.match(source, /onStartersChange\?: \(starters: readonly ConversationStarter\[\]\) => void/u);
	assert.match(source, /onSave\?: \(starters: readonly ConversationStarter\[\]\) => void/u);
	assert.match(source, /onGenerate\?:/u);
	assert.match(source, /maxStarters\?: number/u);
	assert.match(indexSource, /ConversationStarterDialog/u);
	assert.match(indexSource, /ConversationStarter\b/u);
	assert.match(indexSource, /StarterIconKey/u);
});

test("Conversation Starter always shows exactly maxStarters rows (default 3)", () => {
	const source = readProjectFile(DIALOG);

	assert.match(source, /DEFAULT_MAX_STARTERS = 3/u);
	assert.match(source, /maxStarters = DEFAULT_MAX_STARTERS/u);
	// Incoming lists are truncated and padded to exactly `max` slots.
	assert.match(source, /function seedDraft/u);
	assert.match(source, /starters\.slice\(0, max\)/u);
	assert.match(source, /while \(rows\.length < max\)/u);
});

test("Conversation Starter composes the VPK InputGroup without bespoke field overrides", () => {
	const row = readProjectFile(ROW);

	assert.match(row, /from "@\/components\/ui\/input-group"/u);
	assert.match(row, /<InputGroup>/u);
	assert.match(row, /<InputGroupInput/u);
	assert.match(row, /align="inline-start"/u);
	assert.match(row, /align="inline-end"/u);
	assert.match(row, /<InputGroupAddon align="inline-start" className="text-icon-subtlest">/u);
	assert.match(row, /<InputGroupAddon align="inline-end" className="text-icon-subtlest">/u);
	// No hand-rolled bordered field / token overrides.
	assert.doesNotMatch(row, /border-input/u);
	assert.doesNotMatch(row, /bg-bg-input/u);
});

test("Conversation Starter clears a row's text rather than removing the row", () => {
	const dialog = readProjectFile(DIALOG);
	const row = readProjectFile(ROW);

	assert.match(row, /onClear: \(id: string\) => void/u);
	assert.match(row, /Clear conversation starter/u);
	assert.match(row, /CrossCircleIcon/u);
	assert.match(row, /shape="circle"/u);
	assert.match(row, /<CrossCircleIcon label="" size="small" color="currentColor" \/>/u);
	assert.match(dialog, /function handleClear\(id: string\)/u);
	assert.match(dialog, /\{ \.\.\.s, text: "" \}/u);
	// Faithful to the design: no add-row affordance or empty state.
	assert.doesNotMatch(dialog, /Add conversation starter/u);
});

test("Conversation Starter supports drag-to-reorder via dnd-kit", () => {
	const dialog = readProjectFile(DIALOG);
	const row = readProjectFile(ROW);

	assert.match(dialog, /import \{[\s\S]*DndContext[\s\S]*\} from "@dnd-kit\/core"/u);
	assert.match(dialog, /restrictToVerticalAxis/u);
	assert.match(dialog, /verticalListSortingStrategy/u);
	assert.match(dialog, /arrayMove\(prev, oldIndex, newIndex\)/u);
	assert.match(row, /useSortable\(\{ id: starter\.id \}\)/u);
	// Drag listeners bind to the handle, not the whole row.
	assert.match(row, /setActivatorNodeRef/u);
	assert.match(row, /DragHandleVerticalIcon/u);
});

test("Conversation Starter lets each starter change its icon", () => {
	const picker = readProjectFile(PICKER);
	const data = readProjectFile(DATA);

	assert.match(picker, /export function StarterIconPicker/u);
	assert.match(picker, /Change conversation starter icon/u);
	assert.match(picker, /className="text-icon-subtlest"/u);
	assert.match(picker, /onChange\(icon\)/u);
	assert.match(picker, /role="option"/u);
	assert.match(data, /export const STARTER_ICON_OPTIONS/u);
	assert.match(data, /DEFAULT_STARTER_ICON: StarterIconKey = "ai-chat"/u);
});

test("Conversation Starter dialog clips full-width sections to the rounded dialog shell", () => {
	const source = readProjectFile(DIALOG);

	assert.match(source, /<DialogContent className="gap-0 overflow-hidden p-0"/u);
	assert.match(source, /className="flex items-center justify-end gap-2 border-t border-border bg-surface-overlay/u);
});

test("Conversation Starter generates a fallback set when no handler is given", () => {
	const source = readProjectFile(DIALOG);

	assert.match(source, /Generate for me/u);
	assert.match(source, /isLoading=\{isGenerating\}/u);
	assert.match(source, /onGenerate\s*\?\s*await onGenerate\(\)/u);
	assert.match(source, /fallbackGenerate\(maxStarters, idCounter\)/u);
	assert.match(source, /seedDraft\(generated, maxStarters/u);
});

test("Conversation Starter keeps a draft so Cancel discards and Add commits", () => {
	const source = readProjectFile(DIALOG);

	// Draft is re-seeded each time the dialog opens.
	assert.match(source, /if \(open && !wasOpen\.current\)/u);
	assert.match(source, /setDraft\(seedDraft\(seedRef\.current, maxStarters, idCounter\)\)/u);
	// Cancel just closes (no commit); Save trims, commits, and closes.
	assert.match(source, /onClick=\{\(\) => onOpenChange\(false\)\}/u);
	assert.match(source, /function handleSave\(\)/u);
	assert.match(source, /\.filter\(\(s\) => s\.text\.length > 0\)/u);
	assert.match(source, /onSave\?\.\(cleaned\)/u);
});
