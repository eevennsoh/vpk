const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");

test("the shared toolbar uses workflow tones unless its owner supplies a resolver", () => {
	assert.doesNotMatch(SOURCE, /from "@\/components\/blocks\/jira-work-item\//u);
	assert.match(SOURCE, /getStatusVariant = getWorkflowPhaseLozengeVariant/u);
	assert.match(SOURCE, /variant=\{getStatusVariant\(status, statusOptions\)\}/u);
});

test("Jira Toolbar leads with Select all, Add agent, and Ask Rovo", () => {
	const assignIndex = SOURCE.indexOf('id: "assign"');
	const rovoIndex = SOURCE.indexOf('id: "ask-rovo"');
	assert.ok(assignIndex >= 0 && assignIndex < rovoIndex);
	assert.match(SOURCE, /ref=\{leadingRef\}[\s\S]*?<span>selected<\/span>[\s\S]*?Select all[\s\S]*?<ToolbarSeparator/u);
	assert.match(SOURCE, /@atlaskit\/icon-lab\/core\/rovo/u);
	assert.match(SOURCE, /icon: <RovoIcon label="" size="small"/u);
	assert.doesNotMatch(SOURCE, /RovoColorIcon|@\/components\/ui\/logo/u);
	assert.match(SOURCE, /@atlaskit\/icon\/core\/presenter-mode/u);
	assert.doesNotMatch(SOURCE, /Use skills|SkillSelector/u);
	assert.match(SOURCE, /id: "change-status",\s*alwaysOverflow: true/u);
	assert.match(SOURCE, /id: "delete",\s*alwaysOverflow: true/u);
});

test("Jira Toolbar only renders Merge for multi-selection", () => {
	assert.match(SOURCE, /selectedCount > 1[\s\S]*?id: "merge"[\s\S]*?: \[\]/u);
});

test("Jira Toolbar owns functional status, agent assignment, and clear callbacks", () => {
	assert.match(SOURCE, /onAgentAssignmentChange\(agentId, !selectedAgentIdSet\.has\(agentId\)\)/u);
	assert.match(SOURCE, /onSelect=\{\(\) => onStatusChange\(status\)\}/u);
	assert.match(SOURCE, /aria-label="Clear selection"[\s\S]*onClick=\{onClearSelection\}/u);
	assert.match(SOURCE, /event\.key === "Escape"[\s\S]*onClearSelection\(\)/u);
	assert.doesNotMatch(SOURCE, /addEventListener\("keydown", handleKeyDown, true\)/u);
});

test("toolbar Delete is disabled when its owner does not provide the removal capability", () => {
	assert.match(SOURCE, /id: "delete",[\s\S]*?<JiraToolbarAction\s+disabled=\{!onDelete\}/u);
	assert.match(SOURCE, /id: "delete",[\s\S]*?<DropdownMenuItem\s+disabled=\{!onDelete\}/u);
});

test("Jira Toolbar preserves agent assignment and launches real Rovo navigation", () => {
	assert.match(SOURCE, /defaultPinnedAgentIds=\{defaultPinnedAgentIds\}/u);
	assert.match(SOURCE, /<AgentSelector[\s\S]*searchVariant="palette"[\s\S]*selectionMode="single"/u);
	assert.match(SOURCE, /disabled=\{!onSelectAll\}/u);
	assert.match(SOURCE, /rovoChat\.openChat\("sidebar"\)/u);
	assert.match(SOURCE, /router\.push\("\/rovo"\)/u);
});

test("Jira Toolbar uses token motion with a reduced-motion path", () => {
	assert.match(SOURCE, /duration: 0\.25,[\s\S]*ease: motionEase\.out\b/u);
	assert.match(SOURCE, /duration: 0\.2,[\s\S]*ease: motionEase\.in\b/u);
	assert.match(SOURCE, /useReducedMotion\(\)/u);
	assert.match(SOURCE, /willChange: "transform, opacity"/u);
});

test("Jira Toolbar keeps only the toolbar inverse while popups inherit the app theme", () => {
	assert.match(SOURCE, /data-color-mode="dark"/u);
	assert.match(SOURCE, /data-subtree-theme=""/u);
	assert.match(SOURCE, /boxShadow: token\("elevation.shadow.overlay"\)/u);
	assert.doesNotMatch(SOURCE, /POPUP_THEME_PROPS/u);
	assert.match(SOURCE, /computeContextBarOverflow\(/u);
});

const SHORTCUT_FIXTURE = `
	import { JiraToolbar } from "@/components/blocks/jira-toolbar";
	export function SelectionBoard(props) {
		return <>
			<div>
				<button data-jira-issue-activation-control>Issue card</button>
				<input aria-label="Board search" />
				<textarea aria-label="Draft" />
				<div contentEditable role="textbox" aria-label="Editor" />
				<button>Other action</button>
				<div role="dialog"><button>Dialog action</button></div>
				<JiraToolbar {...props} />
			</div>
			<button data-jira-issue-activation-control>Other board card</button>
		</>;
	}
`;

async function selectionToolbar() {
	const calls = [];
	const props = {
		agents: [], selectedCount: 1, statusOptions: [],
		onSelectAll: () => calls.push("all"),
		onClearSelection: () => calls.push("clear"),
		onAgentAssignmentChange: () => calls.push("assign"),
		onStatusChange: () => calls.push("status"),
	};
	const view = await renderComponent({
		source: SHORTCUT_FIXTURE, exportName: "SelectionBoard", props,
		mocks: {
			"@/components/blocks/agent-selector": "export function AgentSelector() { return null; }",
			"@/app/contexts/context-rovo-chat-controls": "export function useOptionalRovoChatControls() { return null; }",
		},
	});
	return { view, props, calls };
}

test("Select all shows Command A keycaps and shares its callback with board shortcuts", async () => {
	const { view, calls } = await selectionToolbar();
	const button = view.getByRole("button", { name: "Select all" });
	assert.equal(button.getAttribute("aria-keyshortcuts"), "Meta+A Control+A");
	assert.deepEqual([...button.querySelectorAll('[data-slot="kbd"]')].map((key) => key.textContent), ["⌘", "A"]);
	await view.click(button);
	await view.press(view.getByRole("button", { name: "Issue card" }), "a", { metaKey: true });
	await view.press(button, "a", { ctrlKey: true });
	assert.deepEqual(calls, ["all", "all", "all"]);
});

test("Select all shortcuts preserve editors, other controls, and other boards", async () => {
	const { view, props, calls } = await selectionToolbar();
	for (const name of ["Board search", "Draft", "Editor"]) {
		await view.press(view.getByRole("textbox", { name }), "a", { metaKey: true });
	}
	for (const name of ["Other action", "Dialog action", "Other board card"]) {
		await view.press(view.getByRole("button", { name }), "a", { metaKey: true });
	}
	const card = view.getByRole("button", { name: "Issue card" });
	for (const flags of [{}, { metaKey: true, altKey: true }, { metaKey: true, shiftKey: true }, { metaKey: true, repeat: true }, { metaKey: true, isComposing: true }]) {
		await view.press(card, "a", flags);
	}
	assert.deepEqual(calls, []);
	await view.rerender({ ...props, onSelectAll: undefined });
	assert.equal(view.getByRole("button", { name: "Select all" }).disabled, true);
	assert.equal(view.getByRole("button", { name: "Select all" }).getAttribute("aria-keyshortcuts"), null);
	await view.press(card, "a", { metaKey: true });
	await view.rerender({ ...props, selectedCount: 0 });
	await view.press(card, "a", { metaKey: true });
	await view.rerender({ ...props, primaryActionOnly: true });
	await view.press(card, "a", { metaKey: true });
	assert.deepEqual(calls, []);
});
