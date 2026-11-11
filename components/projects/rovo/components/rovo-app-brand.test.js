const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-brand.tsx"),
	"utf8",
);
const HEADER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-header.tsx"),
	"utf8",
);
const STUDIO_HEADER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/studio/components/rovo-app-header.tsx"),
	"utf8",
);
const BACK_BUTTON_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/rovo-agent-back-button.tsx"),
	"utf8",
);

test("the Codex chat header uses the compact coding-agent artwork", async () => {
	const view = await renderComponent({
		entry: "components/projects/rovo-core/components/rovo-app-brand.tsx",
		exportName: "RovoAppBrand",
		props: { enableAgentSelector: false },
		mocks: {
			"@/app/contexts": `export function useRovoSelectedAgent() { return { selectedAgent: { id: "review-agent", name: "Codex", brandName: "openai-codex" }, selectedAgentId: "review-agent", selectableAgents: [], isCustomAgentSelected: true, selectAgent() {}, resetAgentToRovo() {} }; }`,
			"@/components/blocks/agent-selector": `export function AgentSelector() { return null; }`,
			"@/app/data/directory/agents": `export function isRovoAgentProfile() { return false; }`,
		},
	});
	assert.equal(view.container.querySelector("img")?.getAttribute("src"), "/3p/openai-codex/glyph.svg");
	assert.equal(view.container.querySelector('[data-slot="avatar"]')?.getAttribute("data-shape"), "hexagon");
	assert.equal(view.container.querySelector('[data-slot="avatar"]')?.getAttribute("aria-label"), "Codex");
});

test("RovoAppBrand agent selector keeps a single selected agent", () => {
	assert.match(SOURCE, /useRovoSelectedAgent/u);
	assert.match(SOURCE, /selectableAgents/u);
	assert.match(SOURCE, /function handleAgentSelect\(agentId: string\) \{/u);
	assert.match(SOURCE, /selectAgent\(agentId\);/u);
	assert.match(SOURCE, /onAgentToggle=\{handleAgentSelect\}/u);
	assert.match(SOURCE, /selectionMode="single"/u);
	assert.match(SOURCE, /agents=\{selectableAgents\}/u);
	assert.doesNotMatch(SOURCE, /selectedAgentIds=\{selectedAgentIds\}/u);
	assert.doesNotMatch(SOURCE, /currentIds\.includes\(agentId\)[\s\S]*currentIds\.filter/u);
});

test("RovoAppBrand uses selected-agent actions while a custom agent is active", () => {
	assert.match(SOURCE, /selectedAgentActions = useMemo<readonly AgentSelectorAction\[\]>/u);
	assert.match(SOURCE, /id: "chat-with-rovo"[\s\S]*label: "Chat with Rovo"[\s\S]*resetAgentToRovo\(\);/u);
	assert.match(SOURCE, /id: "edit-agent"[\s\S]*label: "Edit agent"/u);
	assert.match(SOURCE, /heading=\{isCustomAgentSelected \? "Switch to another agent" : undefined\}/u);
	assert.match(SOURCE, /selectedAgentActions=\{selectedAgentActions\}/u);
	assert.match(SOURCE, /const triggerLabel = isRovoAgentProfile\(selectedAgent\) \? "Rovo" : selectedAgent\.name;/u);
	assert.match(SOURCE, /ROVO_APP_BRAND_CONTAINER_VARIANTS/u);
	assert.match(SOURCE, /<AnimatePresence initial=\{false\} mode="wait">/u);
	assert.match(SOURCE, /key=\{selectedAgentId\}/u);
	assert.match(SOURCE, /variants=\{identityItemVariants\}/u);
	assert.match(SOURCE, /className="-ml-0\.5 size-4 shrink-0 text-icon-subtle group-aria-expanded\/button:text-icon-selected"/u);
	assert.doesNotMatch(SOURCE, /className="-ml-0\.5 size-4 text-icon-selected"/u);
});

test("RovoAppBrand can render a fixed identity without an agent selector", () => {
	assert.match(SOURCE, /enableAgentSelector\?: boolean;/u);
	assert.match(SOURCE, /if \(!enableAgentSelector\) \{/u);
	assert.match(SOURCE, /<div className=\{cn\("flex h-8 min-w-0 shrink-0 items-center px-2 text-sm font-medium text-text", className\)\}>[\s\S]*\{identity\}/u);
});

test("fullscreen Rovo header exposes a custom-agent back button", () => {
	assert.match(HEADER_SOURCE, /<RovoAgentBackButton \/>/u);
	assert.match(BACK_BUTTON_SOURCE, /useRovoSelectedAgent/u);
	assert.match(BACK_BUTTON_SOURCE, /isCustomAgentSelected \? \(/u);
	assert.match(BACK_BUTTON_SOURCE, /<AnimatePresence initial=\{false\}>/u);
	assert.match(BACK_BUTTON_SOURCE, /<motion\.div[\s\S]*key="back-to-rovo"[\s\S]*variants=\{buttonVariants\}/u);
	assert.match(BACK_BUTTON_SOURCE, /aria-label="Back to Rovo"/u);
	assert.match(BACK_BUTTON_SOURCE, /resetAgentToRovo\(\);[\s\S]*onBack\?\.\(\);/u);
	assert.match(BACK_BUTTON_SOURCE, /onClick=\{handleBack\}/u);
});

test("Rovo and Studio headers share the core header while Studio owns send mode", () => {
	assert.match(HEADER_SOURCE, /export function RovoAppHeaderCore/u);
	assert.match(HEADER_SOURCE, /moreMenuFooter\?: ReactNode;/u);
	assert.match(HEADER_SOURCE, /\{moreMenuFooter\}/u);
	assert.match(
		STUDIO_HEADER_SOURCE,
		/import type \{ RovoAppSendMode \} from "@\/components\/projects\/rovo-core\/lib\/rovo-app-dispatch";/u,
	);
	assert.match(STUDIO_HEADER_SOURCE, /function StudioSendModeMenu/u);
	assert.match(STUDIO_HEADER_SOURCE, /<DropdownMenuLabel>Send mode<\/DropdownMenuLabel>/u);
	assert.match(STUDIO_HEADER_SOURCE, /moreMenuFooter=\{\(/u);
	assert.doesNotMatch(HEADER_SOURCE, /Send mode/u);
});
