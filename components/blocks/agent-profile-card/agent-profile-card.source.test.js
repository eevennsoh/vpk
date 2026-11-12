const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Agent Profile Card preview uses a direct route instead of the generic dynamic preview loader", () => {
	const source = readProjectFile("app/preview/blocks/agent-profile-card/page.tsx");

	assert.match(
		source,
		/import AgentProfileCardPage from "@\/components\/blocks\/agent-profile-card\/page";/u,
	);
	assert.match(
		source,
		/import \{ getPreviewPageTitle \} from "@\/lib\/project-page-title";/u,
	);
	assert.match(source, /title: getPreviewPageTitle\("agent-profile-card", "blocks"\),/u);
	assert.match(source, /return <AgentProfileCardPage \/>;/u);
	assert.doesNotMatch(source, /RenderPreviewCategoryPage/u);
});

test("Agent Profile Card title actions use chat label and edit icon controls", () => {
	const source = readProjectFile("components/blocks/agent-profile-card/components/agent-profile-card.tsx");
	const entitySource = readProjectFile("components/ui-custom/entity-card/agent-profile.tsx");

	assert.match(source, /<EntityCard\.AgentProfile \{\.\.\.props\} \/>/u);
	assert.match(entitySource, /import EditIcon from "@atlaskit\/icon\/core\/edit";/u);
	assert.doesNotMatch(entitySource, /SwapIcon/u);
	assert.match(entitySource, /editActionLabel\?: string;/u);
	assert.match(entitySource, /onEditAction\?: \(\) => void;/u);
	assert.match(entitySource, /const resolvedSwapActionLabel = swapActionLabel \?\? "Chat with agent";/u);
	assert.match(entitySource, /const resolvedEditActionLabel = editActionLabel \?\? `Edit \$\{name\}`;/u);
	assert.match(
		entitySource,
		/<Button[\s\S]*aria-label=\{resolvedSwapActionLabel\}[\s\S]*size="icon-compact"[\s\S]*<AiChatIcon label="" size="small" \/>/u,
	);
	assert.match(
		entitySource,
		/<Button[\s\S]*aria-label=\{resolvedEditActionLabel\}[\s\S]*onClick=\{onEditAction\}[\s\S]*size="icon-compact"[\s\S]*<EditIcon label="" size="small" \/>/u,
	);
});

test("Agent Profile Card supports opt-in overlay elevation", () => {
	const entitySource = readProjectFile("components/ui-custom/entity-card/agent-profile.tsx");

	assert.match(entitySource, /surface\?: "raised" \| "overlay";/u);
	assert.match(entitySource, /surface === "overlay" \? "bg-surface-overlay" : "bg-surface-raised"/u);
	assert.match(entitySource, /surface === "overlay" \? "shadow-2xl" : "shadow-sm"/u);
});

test("Agent Profile Card forwards submitted composer text to its consumer", () => {
	const entitySource = readProjectFile("components/ui-custom/entity-card/agent-profile.tsx");

	assert.match(entitySource, /onInputAction\?: \(prompt: string\) => void \| Promise<void>;/u);
	assert.match(entitySource, /const prompt = reply\.trim\(\);/u);
	assert.match(entitySource, /void onInputAction\?\.\(prompt\);/u);
});

test("Agent Profile Card composer keeps the shared floating prompt border", () => {
	const entitySource = readProjectFile("components/ui-custom/entity-card/agent-profile.tsx");

	assert.match(entitySource, /<FloatingComposer/u);
	assert.doesNotMatch(entitySource, /\bborder-0\b/u);
	assert.doesNotMatch(
		entitySource,
		/className="[^"]*border border-border[^"]*shadow-md[^"]*"/u,
	);
});
