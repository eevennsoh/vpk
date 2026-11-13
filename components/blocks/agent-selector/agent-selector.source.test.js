const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { renderComponent } = require("../../../scripts/lib/render-component.js");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const COMPONENT_SOURCE = fs.readFileSync(path.join(__dirname, "components/agent-selector.tsx"), "utf8");
const DATA_SOURCE = fs.readFileSync(path.join(__dirname, "data/demo-agents.ts"), "utf8");
const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/website/demos/blocks/agent-selector-demo.tsx"), "utf8");
const DETAILS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app/data/details/blocks/agent-selector.ts"), "utf8");
const VARIANT_REGISTRY_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/website/registry/blocks-variants.ts"), "utf8");
const AGENT_SELECTOR_DROPDOWN_CALLSITE_SOURCES = [
	"components/blocks/agent-selector/page.tsx",
	"components/blocks/jira-kanban/index.tsx",
	"components/projects/jira/components/column-agent-assignment.tsx",
	"components/projects/jira/components/work-item-modal/agent-panel.tsx",
	"components/projects/jira/components/work-item-modal/sidebar-stack.tsx",
	"components/projects/rovo-core/components/rovo-app-brand.tsx",
].map((sourcePath) => ({
	source: fs.readFileSync(path.join(process.cwd(), sourcePath), "utf8"),
	sourcePath,
}));

test("inline recommendations stay first, selectable, and searchable without duplication", async () => {
	const selected = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-selector/components/inline-agent-selector.tsx",
		exportName: "InlineAgentSelector",
		props: {
			agents: [{ id: "council", name: "The Council", byline: "" }, { id: "coding", name: "Coding agent", byline: "" }],
			softwareAgentIds: ["coding"],
			recommendedAgentId: "council",
			favoriteAgentIds: ["council"],
			onFavoriteAgentIdsChange: () => {},
			getActions: (agent) => [{ id: "start", label: "Start", icon: null, onSelect: () => selected.push(agent.id) }],
		},
	});
	const recommendation = view.getByRole("button", { name: "The Council (Recommended)" });
	assert.equal(view.container.querySelector("[data-agent-id]")?.getAttribute("data-agent-id"), "council");
	assert.equal(view.container.querySelectorAll('[data-agent-id="council"]').length, 1);
	await view.click(recommendation);
	assert.deepEqual(selected, ["council"]);
	const search = view.getByRole("textbox", { name: "Search agents" });
	await view.fill(search, "coding");
	assert.equal(view.container.querySelector('[data-agent-id="council"]'), null);
	await view.fill(search, "council");
	assert.equal(view.getByRole("button", { name: "The Council (Recommended)" }) !== null, true);
});

test("AgentSelector keyboard navigation skips disabled agents", async () => {
	const selected = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-selector/components/agent-selector.tsx",
		exportName: "AgentSelector",
		props: {
			agents: [
				{ id: "first", name: "First", byline: "" },
				{ id: "disabled", name: "Unavailable", byline: "" },
				{ id: "last", name: "Last", byline: "" },
			],
			disabledAgentIds: ["disabled"],
			onAgentToggle: (id) => selected.push(id),
			pinningEnabled: false,
			searchVariant: "palette",
			selectionMode: "single",
		},
	});
	const search = view.getByRole("combobox", { name: "Search agents" });
	const list = view.getByRole("listbox", { name: "Suggestions" });
	assert.equal(search.getAttribute("aria-controls"), list.id);
	assert.equal(view.getByRole("option", { name: /Unavailable/u }).getAttribute("aria-disabled"), "true");
	await view.focus(search);
	await view.press(search, "ArrowDown");
	assert.equal(view.isFocused(search), true);
	assert.equal(search.getAttribute("aria-activedescendant"), view.getByRole("option", { name: /Last/u }).id);
	await view.press(search, "Enter");
	assert.deepEqual(selected, ["last"]);
	await view.fill(search, "First");
	const filtered = view.getByRole("option", { name: /First/u });
	assert.equal(search.getAttribute("aria-activedescendant"), filtered.id);
	assert.equal(view.isFocused(search), true);
	await view.fill(search, "No matching agent");
	assert.equal(search.hasAttribute("aria-activedescendant"), false);
	await view.fill(search, "Last");
	assert.equal(search.getAttribute("aria-activedescendant"), view.getByRole("option", { name: /Last/u }).id);
});

test("Jira kanban example uses space-pinned agents", async () => {
	const view = await renderComponent({
		entry: "components/blocks/agent-selector/page.tsx",
		mocks: { "@/components/ui-custom/agent-avatar-visual": 'export function AgentAvatarVisual() { return null; }' },
		props: { presentation: "standalone", variant: "jira" },
	});
	assert.equal(view.getByText("Pinned by space") !== null, true);
	assert.equal(view.getByText("More agents") !== null, true);
	const unpin = view.getByRole("button", { name: "Unpin Readiness Checker" });
	assert.equal(unpin.getAttribute("aria-pressed"), "true");
	await view.click(unpin);
	assert.equal(view.container.querySelector('[aria-label="Pin Readiness Checker"]')?.getAttribute("aria-pressed"), "false");
	const group = view.container.querySelector('[data-value="readiness-checker"]')?.closest("[cmdk-group]");
	assert.equal(group?.querySelector("[cmdk-group-heading]")?.textContent, "More agents");
});

test("favorite appearance removes a saved agent without selecting it", async () => {
	const updates = [];
	const selections = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-selector/components/agent-selector.tsx",
		exportName: "AgentSelector",
		props: {
			agents: [{ id: "first", name: "First", byline: "" }],
			defaultPinnedAgentIds: ["first"],
			onAgentToggle: (id) => selections.push(id),
			onPinnedAgentIdsChange: (ids) => updates.push(ids),
			pinningAppearance: "favorite",
		},
	});
	const favorite = view.getByRole("button", { name: "Remove First from favorites" });
	assert.equal(favorite.getAttribute("aria-pressed"), "true");
	await view.click(favorite);
	assert.deepEqual(updates, [[]]);
	assert.deepEqual(selections, []);
});

async function loadAgentSelectorHarness() {
	const mockModules = new Map([
		["@atlaskit/icon/core/add", "export default function Icon() { return null; }"],
		["@atlaskit/icon/core/chevron-right", "export default function Icon() { return null; }"],
		["@atlaskit/icon/core/ai-agent", "export default function Icon() { return null; }"],
		["@atlaskit/icon/core/pin-filled", "export default function Icon() { return 'PIN_FILLED'; }"],
		["@atlaskit/icon/core/pin", "export default function Icon() { return 'PIN_OUTLINE'; }"],
		["@atlaskit/icon/core/star-starred", "export default function Icon() { return 'STAR_FILLED'; }"],
		["@atlaskit/icon/core/star-unstarred", "export default function Icon() { return 'STAR_OUTLINE'; }"],
		["@atlaskit/icon/core/video-stop-overlay", "export default function Icon() { return null; }"],
		[
			"motion/react",
			`
				import React from "react";
				export const motion = {
					span(props) {
						const { animate, custom, initial, variants, ...rest } = props;
						return React.createElement("span", rest, props.children);
					},
				};
				export function useReducedMotion() { return false; }
			`,
		],
		["@/app/data/directory/agents", "export const ROVO_AGENT_SELECTOR_AGENTS = [];"],
		[
			"@/components/ui/command",
			`
				import React from "react";
				export function Command(props) { return React.createElement("div", null, props.children); }
				export function CommandEmpty(props) { return React.createElement("div", null, props.children); }
				export function CommandGroup(props) { return React.createElement("div", null, props.children); }
				export function CommandInput() { return null; }
				export function CommandPrimitiveInput(props) { return props.children; }
				export function CommandItem(props) {
					return React.createElement(
						"div",
						{
							"aria-checked": props["aria-checked"],
							"aria-haspopup": props["aria-haspopup"],
							"data-agent-id": props.value,
							role: "option",
						},
						props.children,
					);
				}
				export function CommandList(props) { return React.createElement("div", null, props.children); }
			`,
		],
		[
			"@/components/ui/button",
			`
				import React from "react";
				export function Button(props) {
					return React.createElement(
						"button",
						{
							"aria-hidden": props["aria-hidden"],
							"aria-label": props["aria-label"],
							"aria-pressed": props["aria-pressed"],
							type: props.type,
						},
						props.children,
					);
				}
			`,
		],
		[
			"@/components/ui/icon",
			`
				import React from "react";
				export function Icon(props) {
					return React.createElement("span", { "data-icon": true }, props.render);
				}
			`,
		],
		["@/components/ui/icon-tile", "export function IconTile() { return null; }"],
		["@/components/ui/spinner", "export function Spinner() { return null; }"],
		["@/components/ui/vpk-icons", "export function CheckIcon() { return null; } export function SearchIcon() { return null; }"],
		["@/components/ui-custom/agent-avatar-visual", "export function AgentAvatarVisual() { return null; }"],
		["@/components/ui-custom/rich-text-editor", "export function RichTextCommandMenuSearchField() { return null; }"],
		["@/components/hooks/use-has-vertical-overflow", "export function useHasVerticalOverflow() { return { ref() {}, showTopScrollMask: false }; }"],
		["@/lib/utils", "export function cn(...values) { return values.filter(Boolean).join(' '); }"],
	]);
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToStaticMarkup } from "react-dom/server";
				import { AgentSelector } from "./components/blocks/agent-selector/components/agent-selector.tsx";

				export function renderMixedAgentRows() {
					return renderToStaticMarkup(React.createElement(AgentSelector, {
						agents: [
							{ id: "session-agent", name: "Session agent", byline: "Has a session" },
							{ id: "toggle-agent", name: "Toggle agent", byline: "Can be assigned" },
						],
						onAgentToggle() {},
						pinningEnabled: false,
						selectionMode: "multiple",
						selectedAgentIds: ["session-agent"],
						submenuAgentIds: ["session-agent"],
					}));
				}

				export function renderAssignmentCatalogPins() {
					return renderToStaticMarkup(React.createElement(AgentSelector, {
						agents: [
							{ id: "github-copilot", name: "GitHub Copilot", byline: "Agent by GitHub" },
							{ id: "release-notes-drafter", name: "Release Notes Drafter", byline: "Drafts notes" },
							{ id: "code-reviewer", name: "Code Reviewer", byline: "Reviews code" },
							{ id: "readiness-checker", name: "Readiness Checker", byline: "Checks readiness" },
							{ id: "rfp-drafting-agent", name: "RFP Drafter", byline: "Drafts RFPs" },
						],
						onAgentToggle() {},
						pinnedAgentIds: ["rfp-drafting-agent", "readiness-checker"],
						pinningEnabled: true,
						selectionMode: "single",
						selectedAgentIds: ["github-copilot", "release-notes-drafter", "code-reviewer", "readiness-checker"],
						showSelectedTickInSingleSelect: false,
						submenuAgentIds: ["github-copilot", "release-notes-drafter"],
					}));
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "agent-selector-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "agent-selector-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (!mockModules.has(args.path)) {
							return undefined;
						}
						return { path: args.path, namespace: "agent-selector-test-mock" };
					});
					build.onLoad({ filter: /.*/, namespace: "agent-selector-test-mock" }, (args) => ({
						contents: mockModules.get(args.path),
						loader: "tsx",
						resolveDir: process.cwd(),
					}));
				},
			},
		],
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("agent rows use 8px left padding while preserving the compact trailing inset", () => {
	assert.match(
		COMPONENT_SOURCE,
		/const AGENT_ROW_BASE_CLASS =\s*"grid h-11 w-full items-center gap-3 rounded-md py-0 pr-1\.5 pl-2 text-left";/u,
	);
});

test("AgentSelector footer uses 4px top padding", () => {
	assert.match(
		COMPONENT_SOURCE,
		/<div className="sticky bottom-0 z-10 flex shrink-0 flex-col border-t border-border bg-popover p-0 pt-1">/u,
	);
});

test("AgentSelector demo list omits Rovo Dev", () => {
	assert.doesNotMatch(DATA_SOURCE, /name:\s*"Rovo Dev"/u);
	assert.doesNotMatch(DATA_SOURCE, /id:\s*"rovo-dev"/u);
});

test("AgentSelector demo uses single selection without multi-select toggling", () => {
	assert.match(PAGE_SOURCE, /variant === "selected-agent-actions"[\s\S]*\["ai-insights-agent"\][\s\S]*variant === "jira"[\s\S]*"github-copilot"[\s\S]*"release-notes-drafter"[\s\S]*"code-reviewer"[\s\S]*"readiness-checker"[\s\S]*\["github-copilot"\]/u);
	assert.match(PAGE_SOURCE, /function selectAgent\(agentId: string\) \{[\s\S]*setSelectedAgentIds\(\[agentId\]\);[\s\S]*\}/u);
	assert.match(PAGE_SOURCE, /selectionMode="single"/u);
	assert.doesNotMatch(PAGE_SOURCE, /currentIds\.includes\(agentId\)[\s\S]*currentIds\.filter/u);
});

test("AgentSelector exposes a standalone picker demo for inspection", () => {
	assert.match(PAGE_SOURCE, /presentation\?: "dropdown" \| "standalone";/u);
	assert.match(PAGE_SOURCE, /presentation === "standalone"[\s\S]*data-agent-selector-demo="standalone"[\s\S]*\{selector\}/u);
	assert.match(DEMO_SOURCE, /export function AgentSelectorDemoStandalone/u);
	assert.match(DEMO_SOURCE, /<AgentSelectorPage presentation="standalone" \/>/u);
	assert.match(DEMO_SOURCE, /<AgentSelectorPage presentation="standalone" variant="selected-agent-actions" \/>/u);
	assert.match(DETAILS_SOURCE, /demoSlug: "agent-selector-demo-standalone"/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-selector-demo-standalone"[\s\S]*default: mod\.AgentSelectorDemoStandalone/u);
});

test("AgentSelector defaults to the unified Agent Directory catalog", () => {
	assert.match(COMPONENT_SOURCE, /import \{ ROVO_AGENT_SELECTOR_AGENTS \} from "@\/app\/data\/directory\/agents";/u);
	assert.match(COMPONENT_SOURCE, /agents = ROVO_AGENT_SELECTOR_AGENTS/u);
	assert.match(DATA_SOURCE, /AGENT_SELECTOR_DEMO_AGENTS:[\s\S]*= ROVO_AGENT_SELECTOR_AGENTS;/u);
});

test("AgentSelector hides command checkmarks for single-select usage by default", () => {
	assert.match(COMPONENT_SOURCE, /selectionMode = "multiple"/u);
	assert.match(COMPONENT_SOURCE, /const supportsMultipleSelection = selectionMode === "multiple";/u);
	// CommandItem's built-in check lane is multiple-select only. Single-select uses
	// a separate custom subtle tile (below); in-progress rows never show a tick.
	assert.match(COMPONENT_SOURCE, /const showCheckIcon = supportsMultipleSelection && !isInProgress && !isSubmenuTrigger;/u);
	assert.match(COMPONENT_SOURCE, /showCheckIcon=\{showCheckIcon\}/u);
	assert.match(COMPONENT_SOURCE, /data-checked=\{showCheckIcon && isChecked \? true : undefined\}/u);
	// Checkbox semantics (role + aria-checked) stay tied to multiple-select only;
	// a single-select tick is a visual affordance, not a checkbox.
	assert.match(COMPONENT_SOURCE, /aria-checked=\{showCheckIcon \? isChecked : undefined\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /role=\{(?:rowRole|supportsMultipleSelection)/u);
});

test("AgentSelector filled pins stay on the pinned set when assigned agents sit in More agents", async () => {
	const harness = await loadAgentSelectorHarness();
	const markup = harness.renderAssignmentCatalogPins();

	assert.match(markup, /Unpin Readiness Checker/u);
	assert.match(markup, /Unpin RFP Drafter/u);
	assert.match(markup, /<button(?=[^>]*aria-label="Unpin Readiness Checker")(?=[^>]*aria-pressed="true")[^>]*>[\s\S]*PIN_FILLED[\s\S]*?<\/button>/u);
	assert.match(markup, /<button(?=[^>]*aria-label="Unpin RFP Drafter")(?=[^>]*aria-pressed="true")[^>]*>[\s\S]*PIN_FILLED[\s\S]*?<\/button>/u);
	assert.doesNotMatch(markup, /Unpin GitHub Copilot|Unpin Release Notes Drafter|Unpin Code Reviewer/u);
	assert.doesNotMatch(
		markup,
		/<button(?=[^>]*aria-label="Pin (?:GitHub Copilot|Release Notes Drafter|Code Reviewer)")(?=[^>]*aria-pressed="true")/u,
	);
	assert.match(markup, /<button(?=[^>]*aria-label="Pin GitHub Copilot")(?=[^>]*aria-pressed="false")[^>]*>[\s\S]*PIN_OUTLINE[\s\S]*?<\/button>/u);
	assert.match(markup, /<button(?=[^>]*aria-label="Pin Release Notes Drafter")(?=[^>]*aria-pressed="false")[^>]*>[\s\S]*PIN_OUTLINE[\s\S]*?<\/button>/u);
	assert.match(markup, /<button(?=[^>]*aria-label="Pin Code Reviewer")(?=[^>]*aria-pressed="false")[^>]*>[\s\S]*PIN_OUTLINE[\s\S]*?<\/button>/u);
});

test("AgentSelector exposes submenu rows as actions while retaining checkbox semantics for toggles", async () => {
	const selected = [];
	const props = {
		agents: [{ id: "session-agent", name: "Session agent", byline: "" }, { id: "toggle-agent", name: "Toggle agent", byline: "" }],
		submenuAgentIds: ["session-agent"],
		pinningEnabled: false,
		onAgentToggle: (id) => selected.push(id),
	};
	const view = await renderComponent({ entry: "components/blocks/agent-selector/components/agent-selector.tsx", exportName: "AgentSelector", props });
	const session = view.getByRole("option", { name: /Session agent/u });
	const toggle = view.getByRole("option", { name: /Toggle agent/u });
	assert.equal(session.getAttribute("aria-haspopup"), "menu");
	assert.equal(session.hasAttribute("aria-checked"), false);
	assert.equal(toggle.getAttribute("aria-checked"), "false");
	assert.equal(toggle.hasAttribute("aria-haspopup"), false);
	await view.rerender({ ...props, submenuRole: "dialog" });
	assert.equal(view.getByRole("option", { name: /Session agent/u }).getAttribute("aria-haspopup"), "dialog");
	const search = view.getByRole("combobox", { name: "Search agents" });
	await view.fill(search, "Session agent");
	await view.press(search, "Enter");
	assert.deepEqual(selected, ["session-agent"]);
});

test("AgentSelector single-select tick uses the VPK check in a transparent icon tile", () => {
	// Opt-in prop, default off so existing single-select consumers are unchanged.
	assert.match(COMPONENT_SOURCE, /showSelectedTickInSingleSelect\?: boolean;/u);
	assert.match(COMPONENT_SOURCE, /showSelectedTickInSingleSelect = false,/u);
	// Single-select tick derives independently of the multi-select check lane.
	assert.match(
		COMPONENT_SOURCE,
		/const showSingleSelectTick =\s*!isInProgress\s*&& !isSubmenuTrigger\s*&& !supportsMultipleSelection\s*&& showSelectedTickInSingleSelect\s*&& isChecked;/u,
	);
	// Rendered as the VPK CheckIcon in subtle color, inside a 24px transparent
	// IconTile (small = size-6). `iconSize="small"` is required: transparent tiles
	// default their glyph to the medium (16px) icon size, so without it the check
	// renders oversized instead of the intended small (12px) tick.
	assert.match(COMPONENT_SOURCE, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/u);
	assert.match(COMPONENT_SOURCE, /import \{[^}]*\bCheckIcon\b[^}]*\} from "@\/components\/ui\/vpk-icons";/u);
	assert.match(
		COMPONENT_SOURCE,
		/<IconTile[\s\S]*className=\{cn\("ml-1 text-icon-subtle",[\s\S]*icon=\{<CheckIcon size="small" \/>\}[\s\S]*iconSize="small"[\s\S]*size="small"[\s\S]*variant="transparent"[\s\S]*\/>/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /showSingleSelectTick && "[^"]*bg-bg-selected/u);
	assert.match(COMPONENT_SOURCE, /const AGENT_LABEL_CLASS = "menu-row-title text-left";/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /showSingleSelectTick && "[^"]*text-text-selected/u);
	// The default and selected-agent-actions demo variants turn it on; jira does
	// not. Jira / Assign agent never treat selection as a filled pin.
	assert.match(
		PAGE_SOURCE,
		/showSelectedTickInSingleSelect=\{variant === "default" \|\| variant === "selected-agent-actions"\}/u,
	);
	assert.match(PAGE_SOURCE, /pinningEnabled/u);
	assert.match(PAGE_SOURCE, /variant === "jira"[\s\S]*"github-copilot"[\s\S]*"release-notes-drafter"[\s\S]*"code-reviewer"[\s\S]*"readiness-checker"/u);
});

test("AgentSelector uses stable command values for duplicate agent names", () => {
	assert.match(COMPONENT_SOURCE, /key=\{agent\.id\}/u);
	assert.match(COMPONENT_SOURCE, /value=\{agent\.id\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /value=\{agent\.name\}/u);
});

test("AgentSelector applies active search queries to selected and unselected agents", () => {
	assert.match(COMPONENT_SOURCE, /function filterAgentsByQuery\([\s\S]*agents\.filter\(\(agent\) => matchesAgent\(agent, normalizedQuery\)\)[\s\S]*: \[\.\.\.agents\];/u);
	assert.match(COMPONENT_SOURCE, /const ordered = \[\s*\.\.\.filterAgentsByQuery\(selectedAgents, normalizedQuery\),\s*\.\.\.filterAgentsByQuery\(unselectedAgents, normalizedQuery\),\s*\];/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /return \[\.\.\.selectedAgents, \.\.\.filteredUnselectedAgents\];/u);
});

test("AgentSelector de-duplicates visibleAgents by id so React keys stay unique", () => {
	// Guards the "Encountered two children with the same key" crash: whether the
	// duplicate arrives via repeated selectedIds or a duplicated agents list,
	// the final list feeding the keyed .map must contain each id once.
	assert.match(
		COMPONENT_SOURCE,
		/De-duplicate by id so each agent renders once with a unique React key/u,
	);
	assert.match(COMPONENT_SOURCE, /const seen = new Set<string>\(\);/u);
	assert.match(
		COMPONENT_SOURCE,
		/return ordered\.filter\(\(agent\) => \{\s*if \(seen\.has\(agent\.id\)\) \{\s*return false;\s*\}\s*seen\.add\(agent\.id\);\s*return true;\s*\}\);/u,
	);
});

test("AgentSelector action labels use subtle text color", () => {
	assert.match(COMPONENT_SOURCE, /const ACTION_LABEL_CLASS = "text-text-subtle";/u);
	assert.match(COMPONENT_SOURCE, /<span className=\{ACTION_LABEL_CLASS\}>\{action\.label\}<\/span>/u);
	assert.match(COMPONENT_SOURCE, /<span className=\{ACTION_LABEL_CLASS\}>\{browseAgentsLabel\}<\/span>/u);
	assert.match(COMPONENT_SOURCE, /<span className=\{ACTION_LABEL_CLASS\}>\{createAgentLabel\}<\/span>/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /<span className="text-text">\{(?:action\.label|browseAgentsLabel|createAgentLabel)\}<\/span>/u);
});

test("AgentSelector group headings use the semibold subheading treatment", () => {
	assert.match(
		COMPONENT_SOURCE,
		/!px-0 !py-1\.5 \*\*:\[\[cmdk-group-heading\]\]:font-semibold/u,
	);
});

test("AgentSelector shows a picker heading only when supplied", async () => {
	const view = await renderComponent({
		entry: "components/blocks/agent-selector/components/agent-selector.tsx",
		exportName: "AgentSelector",
		props: { agents: [], heading: "Switch to another agent" },
	});
	assert.equal(view.getByText("Switch to another agent").textContent, "Switch to another agent");
	await view.rerender({ agents: [] });
	assert.equal(view.queryByText("Switch to another agent"), null);
});

test("AgentSelector rows use greeting prompt text rhythm and shared agent avatars", () => {
	assert.match(COMPONENT_SOURCE, /const AGENT_ROW_BASE_CLASS =\s*"grid h-11 w-full items-center gap-3 rounded-md py-0 pr-1\.5 pl-2 text-left";/u);
	assert.match(COMPONENT_SOURCE, /const AGENT_ROW_CHECK_COLS = "grid-cols-\[24px_minmax\(0,1fr\)_auto\]";/u);
	assert.match(COMPONENT_SOURCE, /const AGENT_ROW_PLAIN_COLS = "grid-cols-\[24px_minmax\(0,1fr\)\]";/u);
	assert.match(COMPONENT_SOURCE, /const AGENT_COPY_CLASS =\s*"flex min-h-\[34px\] min-w-0 flex-col justify-start overflow-hidden";/u);
	// Title + byline use the shared editor-palette type treatment (menu-row-*
	// utilities) rather than re-deriving line-height with text-sm/leading-*.
	assert.match(COMPONENT_SOURCE, /const AGENT_LABEL_CLASS = "menu-row-title text-left";/u);
	assert.match(COMPONENT_SOURCE, /const AGENT_DESCRIPTION_CLASS = "menu-row-byline text-left";/u);
	assert.match(COMPONENT_SOURCE, /import \{ AgentAvatarVisual \} from "@\/components\/ui-custom\/agent-avatar-visual";/u);
	assert.match(COMPONENT_SOURCE, /<AgentAvatarVisual[\s\S]*avatarSrc=\{agent\.avatarSrc\}[\s\S]*brandName=\{agent\.brandName\}[\s\S]*logoName=\{agent\.logoName\}[\s\S]*sizePx=\{size\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /<LogoThirdParty/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /<AtlassianLogo/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /grid-cols-\[32px_minmax\(0,1fr\)_auto\]/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-sm"/u);
	assert.match(COMPONENT_SOURCE, /className=\{cn\([\s\S]*AGENT_ROW_BASE_CLASS,[\s\S]*showCheckIcon \? AGENT_ROW_CHECK_COLS : AGENT_ROW_PLAIN_COLS,/u);
	assert.match(COMPONENT_SOURCE, /className=\{cn\(AGENT_COPY_CLASS, "flex-1"\)\}/u);
	assert.match(COMPONENT_SOURCE, /className=\{AGENT_LABEL_CLASS\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /block truncate text-sm font-normal leading-[45] text-text-subtle/u);
});

test("AgentSelector pin actions reveal without permanently reserving label space and split pinned rows", () => {
	assert.match(COMPONENT_SOURCE, /import PinFilledIcon from "@atlaskit\/icon\/core\/pin-filled";/u);
	assert.match(COMPONENT_SOURCE, /import PinIcon from "@atlaskit\/icon\/core\/pin";/u);
	// Filled pins follow the pinned set only. Selected / assigned / used rows
	// never get a persistent filled pin. Hover reveals an outline pin on unpinned
	// rows; tick-mode selected rows still suppress that hover pin.
	assert.doesNotMatch(COMPONENT_SOURCE, /showSelectionPin/u);
	assert.match(
		COMPONENT_SOURCE,
		/const showPinButton =\s*!isInProgress && pinningEnabled && \(isPinned \|\| \(isInteractionActive && !showSingleSelectTick\)\);/u,
	);
	assert.match(COMPONENT_SOURCE, /const pinFilled = isPinned;/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /pinFilled = isPinned \|\|/u);
	assert.match(COMPONENT_SOURCE, /marginLeft: showPinButton \? 8 : 0,[\s\S]*opacity: showPinButton \? 1 : 0,[\s\S]*width: showPinButton \? 24 : 0/u);
	assert.match(COMPONENT_SOURCE, /`\$\{isPinned \? "Unpin" : "Pin"\} \$\{agent\.name\}`/u);
	assert.match(COMPONENT_SOURCE, /aria-hidden=\{!showPinButton\}/u);
	assert.match(COMPONENT_SOURCE, /aria-pressed=\{isPinned\}/u);
	assert.match(COMPONENT_SOURCE, /tabIndex=\{showPinButton \? 0 : -1\}/u);
	assert.match(COMPONENT_SOURCE, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*onTogglePinned\(agent\.id\);/u);
	assert.match(COMPONENT_SOURCE, /heading=\{pinnedItemsLabel\}/u);
	assert.match(COMPONENT_SOURCE, /heading=\{hasPinnedAgents \|\| inProgressAgents\.length > 0 \? moreItemsLabel : !showSearch \? heading : undefined\}/u);
	assert.match(COMPONENT_SOURCE, /moreItemsLabel = "More agents"/u);
	assert.match(COMPONENT_SOURCE, /pinnedItemsLabel = "Pinned"/u);
	// Pin reveal is instant: a plain span with conditional inline styles, no
	// Motion animate/transition to play in or out. The right margin collapses to
	// 0 when the single-select tick follows so the pin↔check gap stays 4px.
	assert.match(COMPONENT_SOURCE, /style=\{\{\s*marginLeft: showPinButton \? 8 : 0,[\s\S]*marginRight: showPinButton \? \(showSingleSelectTick \? 0 : 4\) : 0,\s*opacity: showPinButton \? 1 : 0,\s*width: showPinButton \? 24 : 0,\s*\}\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /animate=\{\{\s*marginLeft: showPinButton/u);
});

test("AgentSelector renders in-progress agents in a top section with stop-on-hover", () => {
	// Opt-in prop surface: absent/empty = feature off (list behaves as before).
	assert.match(COMPONENT_SOURCE, /inProgressAgentIds\?: readonly string\[\];/u);
	assert.match(COMPONENT_SOURCE, /inProgressLabel = "In progress"/u);
	assert.match(COMPONENT_SOURCE, /onStopAgent\?: \(agentId: string\) => void;/u);

	// Repo-canonical stop affordance (matches agent-list / jira-for-you),
	// not a bare "stop" icon (which does not resolve in @atlaskit/icon).
	assert.match(COMPONENT_SOURCE, /import VideoStopOverlayIcon from "@atlaskit\/icon\/core\/video-stop-overlay";/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /from "@atlaskit\/icon\/core\/stop"/u);

	// In-progress rows: no tick/pin. The rainbow spinner marks the running agent
	// at rest and crossfades to a red stop control on hover/focus.
	// Regression (stop-hover race): the reveal must be CSS-driven, not React state.
	// A React-state reveal (`showStopButton`) lagged the pointer by a render, so a
	// hover/click over the freshly-revealed button could land on the row instead.
	// The stop control now reveals + re-enables pointer-events via group-hover /
	// focus-visible on the group/command-item row, matching the Jira sidebar.
	assert.doesNotMatch(COMPONENT_SOURCE, /showStopButton/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /tabIndex=\{showStopButton/u);
	// In-progress rows never show a tick: the multi-select check lane excludes them
	// and the single-select tile requires !isInProgress.
	assert.match(COMPONENT_SOURCE, /const showCheckIcon = supportsMultipleSelection && !isInProgress && !isSubmenuTrigger;/u);
	assert.match(COMPONENT_SOURCE, /const showSingleSelectTick =\s*!isInProgress\s*&&/u);
	assert.match(COMPONENT_SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(COMPONENT_SOURCE, /<Spinner label=\{`\$\{agent\.name\} running`\} size="sm" variant="rainbow" \/>/u);
	// Spinner fades out while the stop button + its pointer-events fade in, all
	// gated by CSS hover/focus so the button's hit area is synchronous with the
	// pointer (no render-lag frame where the row eats the hover/click).
	assert.match(COMPONENT_SOURCE, /group-hover\/command-item:opacity-0/u);
	// The decorative spinner must be pointer-events-none: at opacity 0 it forms a
	// stacking context that paints above the sibling stop button, so with default
	// pointer-events it would intercept the click meant for the stop control.
	assert.match(COMPONENT_SOURCE, /pointer-events-none col-start-1 row-start-1 transition-opacity/u);
	assert.match(COMPONENT_SOURCE, /"opacity-0 pointer-events-none transition-opacity duration-fast ease-out-practical motion-reduce:transition-none"/u);
	assert.match(COMPONENT_SOURCE, /"group-hover\/command-item:opacity-100 group-hover\/command-item:pointer-events-auto"/u);
	assert.match(COMPONENT_SOURCE, /"focus-visible:opacity-100 focus-visible:pointer-events-auto"/u);
	// Stop icon uses the danger (red) token, not the subtle icon color.
	assert.match(COMPONENT_SOURCE, /col-start-1 row-start-1 size-6 text-icon-danger/u);
	assert.match(COMPONENT_SOURCE, /aria-label=\{`Stop \$\{agent\.name\}`\}/u);
	// Clicking the stop control cancels the run without firing the row's open-chat
	// select — stopPropagation is the click-side half of the same race.
	assert.match(COMPONENT_SOURCE, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*onStop\?\.\(agent\.id\);/u);

	// The in-progress group renders first (top of the list) and is excluded from
	// pinned/more so each agent appears once.
	assert.match(COMPONENT_SOURCE, /agents=\{inProgressAgents\}[\s\S]*heading=\{inProgressLabel\}[\s\S]*isInProgressGroup/u);
	assert.match(COMPONENT_SOURCE, /pinnedAgentIdSet\.has\(agent\.id\) && !inProgressAgentIdSet\.has\(agent\.id\)/u);
	assert.match(COMPONENT_SOURCE, /!pinnedAgentIdSet\.has\(agent\.id\) && !inProgressAgentIdSet\.has\(agent\.id\)/u);
});

test("AgentSelector exposes the Jira kanban catalog demo", () => {
	assert.match(PAGE_SOURCE, /variant\?: "default" \| "selected-agent-actions" \| "jira";/u);
	assert.doesNotMatch(PAGE_SOURCE, /inProgressAgentIds/u);
	assert.doesNotMatch(PAGE_SOURCE, /onStopAgent/u);
	assert.doesNotMatch(PAGE_SOURCE, /setInProgressAgentIds/u);
	assert.doesNotMatch(DETAILS_SOURCE, /title: "Jira kanban"[\s\S]{0,240}In progress/u);
	assert.match(PAGE_SOURCE, /searchVariant="palette"/u);
	assert.match(PAGE_SOURCE, /selectionMode="single"/u);
	assert.match(PAGE_SOURCE, /pinningEnabled/u);
	assert.match(PAGE_SOURCE, /showSelectedTickInSingleSelect=\{variant === "default" \|\| variant === "selected-agent-actions"\}/u);
	assert.match(PAGE_SOURCE, /onBrowseAgents=\{\(\) => undefined\}/u);
	assert.match(PAGE_SOURCE, /onCreateAgent=\{\(\) => undefined\}/u);
	assert.match(PAGE_SOURCE, /variant === "jira" \? DEFAULT_PINNED_SPACE_AGENT_IDS : \[\]/u);
	assert.match(PAGE_SOURCE, /moreItemsLabel=\{variant === "jira" \? "More agents" : undefined\}/u);

	// Wired end-to-end: demo wrapper -> variant registry -> details example.
	assert.match(DEMO_SOURCE, /export function AgentSelectorDemoJira/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"agent-selector-demo-jira"[\s\S]*default: mod\.AgentSelectorDemoJira/u);
	assert.match(DETAILS_SOURCE, /demoSlug: "agent-selector-demo-jira"/u);
});

test("AgentSelector suppresses the byline reveal on the selected row so promotion to the top does not flash it", () => {
	// Regression: selecting a hovered agent floats it to the top (visibleAgents
	// orders selected first). Because rows are keyed by id, the clicked row's
	// hovered "active" copy state used to ride the reorder up and animate back to
	// idle at the top — a byline flash/jump. The reveal must exclude the checked
	// row, and the flip must be instant for the checked row (and under reduced
	// motion) so no active→idle animation plays during the promotion.
	assert.match(COMPONENT_SOURCE, /const revealByline = isInteractionActive && !isChecked;/u);
	assert.match(COMPONENT_SOURCE, /const copyInstant = isChecked \|\| prefersReducedMotion;/u);
	assert.match(COMPONENT_SOURCE, /const prefersReducedMotion = useReducedMotion\(\);/u);
	assert.match(COMPONENT_SOURCE, /import \{ motion, useReducedMotion, type Variants \} from "motion\/react";/u);
	// The copy block reads the gated reveal and passes `copyInstant` as motion
	// `custom` to the copy wrapper plus both the label and byline spans.
	assert.match(COMPONENT_SOURCE, /animate=\{revealByline \? "active" : "idle"\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /animate=\{isInteractionActive \? "active" : "idle"\}/u);
	const customPasses = COMPONENT_SOURCE.match(/custom=\{copyInstant\}/gu) ?? [];
	assert.equal(customPasses.length, 3);
	// The instant flip MUST live inside the variant — a variant's own transition
	// overrides the `transition` prop — so the variants are dynamic functions of
	// `instant` that collapse the transition to a 0-duration snap when set.
	assert.match(COMPONENT_SOURCE, /idle: \(instant: boolean\) =>/u);
	assert.match(COMPONENT_SOURCE, /active: \(instant: boolean\) =>/u);
	assert.match(COMPONENT_SOURCE, /transition: instant \? \{ duration: 0 \} :/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /transition=\{copyTransition\}/u);
});

test("AgentSelector dropdowns do not inherit the generic menu height cap", () => {
	assert.match(COMPONENT_SOURCE, /h-\[26rem\] max-h-\[min\(26rem,var\(--available-height,26rem\)\)\]/u);
	for (const { source, sourcePath } of AGENT_SELECTOR_DROPDOWN_CALLSITE_SOURCES) {
		assert.match(
			source,
			/className="max-h-none w-\[360px\] overflow-hidden p-0"/u,
			`${sourcePath} must let AgentSelector own its 26rem available-height cap`,
		);
	}
});

test("AgentSelector Command root uses DropdownMenuContent container radius", () => {
	// The selector uses the shared menu radius without an important override.
	// Keep AgentSelector on the same non-important class so Assign agents / Use skills
	// match other dropdown surfaces. SkillSelector has no separate radius override.
	const commandSource = fs.readFileSync(
		path.join(process.cwd(), "components/ui/command.tsx"),
		"utf8",
	);
	const dropdownSource = fs.readFileSync(
		path.join(process.cwd(), "components/ui/dropdown-menu.tsx"),
		"utf8",
	);
	const skillSource = fs.readFileSync(
		path.join(process.cwd(), "components/blocks/skill-selector/components/skill-selector.tsx"),
		"utf8",
	);
	assert.match(dropdownSource, /surface:\s*"[^"]*\brounded-lg\b/u);
	assert.match(
		commandSource,
		/"bg-popover text-popover-foreground rounded-xl p-1 flex size-full flex-col overflow-hidden"/u,
	);
	assert.doesNotMatch(
		commandSource,
		/"bg-popover text-popover-foreground rounded-xl! p-1 flex size-full flex-col overflow-hidden"/u,
	);
	assert.match(COMPONENT_SOURCE, /flex-1 rounded-lg p-1/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /rounded-xl!/u);
	assert.doesNotMatch(skillSource, /rounded-xl!/u);
	assert.match(COMPONENT_SOURCE, /-mx-1 -mt-1 overflow-hidden rounded-t-lg/u);
});

test("AgentSelector can swap its boxed search for the editor-palette bar", () => {
	// Default stays the bordered CommandInput so existing directory and toolbar
	// surfaces are untouched.
	assert.match(COMPONENT_SOURCE, /searchVariant = "boxed",/u);
	assert.match(COMPONENT_SOURCE, /searchVariant === "palette" \?/u);
	// The palette branch reuses the shared field rather than restyling a copy.
	assert.match(COMPONENT_SOURCE, /<RichTextCommandMenuSearchField/u);
	// cmdk's Command root owns Arrow/Enter for this list, so the field must not
	// swallow them — without this the list stops responding to the keyboard.
	assert.match(COMPONENT_SOURCE, /hostOwnsKeyNavigation/u);

	// Gallery/demo surfaces match Assign agents (palette), not the boxed default.
	assert.match(PAGE_SOURCE, /searchVariant="palette"/u);
	assert.match(DETAILS_SOURCE, /name: "searchVariant"/u);

	// SkillSelector is a thin wrapper over AgentSelector; the variant has to
	// reach it or "Use skills" cannot match "Assign agents".
	const skillSource = fs.readFileSync(
		path.join(process.cwd(), "components/blocks/skill-selector/components/skill-selector.tsx"),
		"utf8",
	);
	assert.match(skillSource, /searchVariant\?: AgentSelectorProps\["searchVariant"\];/u);
	assert.match(skillSource, /searchVariant=\{searchVariant\}/u);
});

test("AgentSelector fades its list under the search header once scrolled", () => {
	// The search field is sticky above a scrolling list, so content sliding under
	// it must fade rather than hard-clip — the same treatment the editor-palette
	// command menus use. Gated on showTopScrollMask so a short list is unmasked.
	assert.match(COMPONENT_SOURCE, /useHasVerticalOverflow<HTMLDivElement>\(\)/u);
	assert.match(COMPONENT_SOURCE, /useActiveAgentOption\(listOverflow\.ref, !showSearch\)[\s\S]*ref=\{activeOptionRef\}/u);
	assert.match(
		COMPONENT_SOURCE,
		/listOverflow\.showTopScrollMask\s*&& "scroll-mask-top overscroll-contain \[--scroll-mask-fade-size:3rem\]"/u,
	);
});
