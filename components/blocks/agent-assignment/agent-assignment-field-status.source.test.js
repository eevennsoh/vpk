const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const React = require("react");
const { parseHTML } = require("linkedom");
const { createRoot } = require("react-dom/client");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadAssignedAgentPipHarness() {
	const mockModules = new Map([
		[
			"@/components/ui/popover",
			`
				import React from "react";
				export function Popover(props) { return React.createElement("div", { "data-open": props.open }, props.children); }
				export function PopoverTrigger(props) { return props.render ?? props.children ?? null; }
				export function PopoverContent(props) { return React.createElement("div", { "data-assignment-menu": "" }, props.children); }
			`,
		],
		[
			"@/components/ui/hover-card",
			`
				import React from "react";
				export function HoverCard(props) { return React.createElement("div", null, props.children); }
				export function HoverCardTrigger() { return null; }
				export function HoverCardContent(props) { return React.createElement("div", null, props.children); }
			`,
		],
		[
			"@/components/ui/tooltip",
			`
				import React from "react";
				export function TooltipProvider(props) { return props.children; }
				export function Tooltip(props) {
					return React.createElement(
						"div",
						{ "data-assignment-tooltip": "", "data-open": props.open ? "true" : "false" },
						props.children,
					);
				}
				export function TooltipTrigger(props) {
					if (props.render) {
						return React.cloneElement(props.render, {}, props.children);
					}
					return props.children ?? null;
				}
				export function TooltipContent() { return null; }
			`,
		],
		["@/components/ui/avatar", "export function Avatar(props) { return props.children ?? null; }"],
		["@/components/ui/vpk-icons", "export function PlusIcon() { return null; }"],
		["@/lib/tokens", "export function token() { return ''; }"],
		["@/lib/utils", "export function cn(...values) { return values.filter(Boolean).join(' '); }"],
		["@/components/ui/sonner", "export const SONNER_TOAST_AUTO_DISMISS_MS = 8000;"],
		["@/components/blocks/agent-selector", "export function AgentSelector() { return null; }"],
		[
			"@/components/ui-custom/agent-avatar-visual",
			`
				import React from "react";
				export function AgentAvatarVisual(props) {
					return React.createElement("span", {
						"aria-label": props.label,
						"data-assignment-avatar": "",
						"data-status": props.status ?? "",
					});
				}
			`,
		],
	]);
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { AgentAssignment } from "./components/blocks/agent-assignment/components/agent-assignment.tsx";

				const AGENTS = [
					{ id: "release-notes-drafter", name: "Release Notes Drafter", byline: "Drafts notes" },
					{ id: "code-reviewer", name: "Code Reviewer", byline: "Reviews code" },
					{ id: "readiness-checker", name: "Readiness Checker", byline: "Checks readiness" },
				];

				export function AssignedAgentPipProbe() {
					const assignedAgents = [
						{ ...AGENTS[0], statusKind: "needs-input", statusLabel: "Needs input" },
						{ ...AGENTS[1], statusKind: "finished", statusLabel: "Finished" },
						{ ...AGENTS[2], statusKind: "idle", statusLabel: "Idle" },
					];
					return React.createElement(AgentAssignment, {
						agents: AGENTS,
						assignedAgents,
						onAssignedAgentIdsChange() {},
						onAssignedAgentSelect() {},
						variant: "simple",
					});
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "agent-assignment-pip-harness.tsx",
		},
		bundle: true,
		external: ["react", "react-dom"],
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "agent-assignment-pip-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (args.path.includes("assigned-agents-menu")) {
							return { path: "assigned-agents-menu", namespace: "agent-assignment-pip-mock" };
						}
						if (args.path.includes("assigned-agents-session-menu")) {
							return { path: "assigned-agents-session-menu", namespace: "agent-assignment-pip-mock" };
						}
						if (args.path.includes("agent-assignment-default-field")) {
							return { path: "agent-assignment-default-field", namespace: "agent-assignment-pip-mock" };
						}
						if (args.path.includes("assignment-session")) {
							return { path: "assignment-session", namespace: "agent-assignment-pip-mock" };
						}
						if (args.path.includes("agent-session-target-menu")) {
							return { path: "agent-session-target-menu", namespace: "agent-assignment-pip-mock" };
						}
						if (mockModules.has(args.path)) {
							return { path: args.path, namespace: "agent-assignment-pip-mock" };
						}
						return undefined;
					});
					build.onLoad({ filter: /.*/, namespace: "agent-assignment-pip-mock" }, (args) => {
						const resolveDir = process.cwd();
						if (args.path === "assigned-agents-menu") {
							return {
								contents: `
									import React from "react";
									export function AssignedAgentsMenu(props) {
										return React.createElement(
											"div",
											{ "data-assigned-agents-menu": "" },
											(props.rows ?? []).map((row) => React.createElement(
												"button",
												{
													"data-assigned-agent-row": row.id,
													key: row.id,
													onClick() { props.onSelectAgent(row); },
													type: "button",
												},
												row.name,
											)),
										);
									}
								`,
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "assigned-agents-session-menu") {
							return {
								contents: "export function AssignedAgentsSessionMenu() { return null; }",
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "agent-assignment-default-field") {
							return {
								contents: "export function AgentAssignmentDefaultField() { return null; }",
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "assignment-session") {
							return {
								contents: "export function toAssignmentSessionItem() { return {}; }",
								loader: "tsx",
								resolveDir,
							};
						}
						if (args.path === "agent-session-target-menu") {
							return { contents: "export function AgentSessionTargetMenu() { return null; }", loader: "tsx", resolveDir };
						}
						return {
							contents: mockModules.get(args.path),
							loader: "tsx",
							resolveDir,
						};
					});
				},
			},
		],
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "agent-assignment-pip-harness.cjs");
}

function fieldAvatarStatus(document, agentName) {
	const avatar = [...document.querySelectorAll("[data-assignment-avatar]")]
		.find((node) => (node.getAttribute("aria-label") ?? "").startsWith(agentName));
	return avatar?.getAttribute("data-status") ?? "";
}

test("clicking an assigned-agents row dismisses that agent's needs-input field pip", async () => {
	const { window } = parseHTML("<!doctype html><html><body><div id='app'></div></body></html>");
	const originalGlobals = {
		document: globalThis.document,
		Event: globalThis.Event,
		HTMLElement: globalThis.HTMLElement,
		Node: globalThis.Node,
		window: globalThis.window,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
	};
	Object.assign(globalThis, {
		document: window.document,
		Event: window.Event,
		HTMLElement: window.HTMLElement,
		Node: window.Node,
		window,
		IS_REACT_ACT_ENVIRONMENT: true,
	});

	const harness = await loadAssignedAgentPipHarness();
	const root = createRoot(window.document.getElementById("app"));
	try {
		await React.act(async () => {
			root.render(React.createElement(harness.AssignedAgentPipProbe));
		});

		assert.equal(fieldAvatarStatus(window.document, "Release Notes Drafter"), "needs-input");
		assert.equal(fieldAvatarStatus(window.document, "Code Reviewer"), "finished");
		assert.equal(fieldAvatarStatus(window.document, "Readiness Checker"), "");
		assert.equal(
			[...window.document.querySelectorAll("[data-assignment-tooltip]")]
				.filter((node) => node.getAttribute("data-open") === "true")
				.length,
			0,
		);

		await React.act(async () => {
			window.document.querySelector("[data-assigned-agent-row='release-notes-drafter']").click();
		});

		assert.equal(fieldAvatarStatus(window.document, "Release Notes Drafter"), "");
		assert.equal(fieldAvatarStatus(window.document, "Code Reviewer"), "finished");
		assert.equal(fieldAvatarStatus(window.document, "Readiness Checker"), "");
	} finally {
		await React.act(async () => {
			root.unmount();
		});
		Object.assign(globalThis, originalGlobals);
	}
});
