const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { parseHTML } = require("linkedom");
const { loadCjsModuleFromText } = require("../../../scripts/lib/esbuild-cjs-loader.js");

let harnessPromise;
function loadHarness() {
	harnessPromise ??= (async () => {
		const realFiles = new Set([
			"agent-session-card.tsx", "use-agent-session-menu.ts", "agent-session-types.ts",
			"agent-session-selection-gesture.ts", "agent-session-drag-interactive.ts", "agent-list-session.ts",
			"agent-session-more-menu.tsx",
			"assigned-agents-session-menu.tsx",
			"agent-session-continue-menu.tsx",
			"jira-session-flyout.tsx",
		]);
		const mocks = new Map([
			["motion/react", `
				import React from "react";
				function host(tag) { return function Host({ children, animate, initial, exit, layout, layoutRoot, transition, onAnimationComplete, ...props }) { return React.createElement(tag, props, children); }; }
				export const motion = { li: host("li"), span: host("span"), div: host("div") };
				export function AnimatePresence({ children }) { return children; }
				export function useReducedMotion() { return true; }
			`],
			["agent-list-card", `
				import React from "react";
				export function AgentListIdentity() { return null; }
				export function AgentListRow({ item, onView, renderViewTrigger, hoverActions, renderIdentity }) {
					const body = onView ? React.createElement("button", { onClick: () => onView(item), "data-body-trigger": "" }, item.title) : React.createElement("span", { "data-body-readout": "" }, item.title);
					return React.createElement(React.Fragment, null, renderIdentity(null), renderViewTrigger && onView ? renderViewTrigger(body) : body, hoverActions.menu);
				}
			`],
			["agent-session-continue-menu", `
				import React from "react";
				export function AgentSessionContinueMenu({ trigger, anchor, open, onOpenChange, actions, copied }) {
					return React.createElement(React.Fragment, null,
						trigger ? React.cloneElement(trigger, { onClick: () => onOpenChange(true) }) : null,
						open ? React.createElement("div", { role: "menu", "data-menu": "continue", "data-anchor": anchor?.current?.tagName ?? "BUTTON" },
							React.createElement("span", null, "Continue in"),
							React.createElement("button", { role: "menuitem", onClick: actions.onCopyPrompt, "data-copied": copied }, "Terminal"),
							React.createElement("button", { role: "menuitem", onClick: () => onOpenChange(false) }, "Close")) : null);
				}
			`],
			["agent-session-more-menu", `
				import React from "react";
				export function AgentSessionMoreMenu({ open, onOpenChange, actions }) {
					return React.createElement(React.Fragment, null,
						React.createElement("button", { "data-more": "", onClick: (event) => { event.stopPropagation(); onOpenChange(!open); } }, "More"),
						open ? React.createElement("div", { role: "menu", "data-menu": "more" }, React.createElement("button", { role: "menuitem", onClick: () => { actions.onDismiss?.(); onOpenChange(false); } }, "Dismiss")) : null);
				}
			`],
			["agent-session-medium-drag", `
				export function AgentSessionMediumDrag({ children, sessionDrag }) { return children(sessionDrag ? { "data-drag-bind": "" } : undefined); }
			`],
			["assignment-card-boundary", `
				import React from "react";
				export function AgentSessionCard({ item, onView }) {
					return React.createElement("li", { "data-host": item.host, "data-view-capability": onView ? "enabled" : "absent" }, React.createElement("button", { disabled: !onView, onClick: onView }, item.title));
				}
			`],
			["dropdown-menu", `
				import React from "react";
				export function DropdownMenu({ children }) { return children; }
				export function DropdownMenuTrigger({ render, children }) { return React.cloneElement(render, null, children); }
				export function DropdownMenuContent({ children, anchor, ref, side, align, sideOffset }) { return React.createElement("div", { ref, role: "menu", "data-anchor-kind": anchor ? "explicit" : "trigger", "data-side": side, "data-align": align, "data-side-offset": sideOffset }, children); }
				export function DropdownMenuItem({ children, disabled }) { return React.createElement("button", { role: "menuitem", disabled }, children); }
				export function DropdownMenuGroup({ children }) { return React.createElement("div", null, children); }
				export function DropdownMenuLabel({ children }) { return React.createElement("span", null, children); }
				export function DropdownMenuSeparator() { return null; }
			`],
			["button", `import React from "react"; export function Button({ children, ...props }) { return React.createElement("button", props, children); }`],
			["tooltip", `
				import React from "react";
				export function Tooltip({ children }) { return children; }
				export function TooltipTrigger({ children, render }) { return render ? React.cloneElement(render, null, children) : children; }
				export function TooltipContent({ children }) { return React.createElement("div", { role: "tooltip" }, children); }
			`],
			["agent-avatar-visual", `export function AgentAvatarVisual() { return null; }`],
			["logo-third-party", `export function LogoThirdParty() { return null; } export function GithubLogo() { return null; }`],
			["agent-session-link-work-item-submenu", `import React from "react"; export function AgentSessionLinkWorkItemSubmenu() { return React.createElement("div", { role: "menuitem" }, "Link work item"); }`],
			["card-glow", `
				export function CardGlowLayers() { return null; }
				export function cardGlowSurfaceStyle() { return {}; }
				export function useCardGlowPointer() { return {}; }
				export function useCardGlowSurface() { return undefined; }
			`],
			["jira-session-flyout", `
				import React from "react";
				export function createJiraSessionFlyoutHandle() { return { close() {} }; }
				export function JiraSessionFlyoutTrigger({ children }) { return React.createElement("div", { "data-session-preview-trigger": "" }, children); }
				export function JiraSessionFlyoutSurface() { return null; }
				export function JiraSessionFlyoutSuspensionProvider({ children, suspended }) { return React.createElement("div", { "data-preview-suspended": suspended }, children); }
			`],
			["hover-card", `
				import React from "react";
				export function HoverCard() { return null; } export function HoverCardContent() { return null; } export function HoverCardViewport() { return null; }
				export function HoverCardTrigger({ handle, children }) { return React.createElement("div", { "data-hover-handle": handle.id }, children); }
			`],
			["jira-session-flyout-data", `
				export function createJiraSessionFlyoutHandle() { return { id: "inactive", close() {}, open() {} }; }
				export function formatSessionChecks() { return ""; } export const JIRA_SESSION_UPDATED_LABEL = "Updated"; export function prStateLozenge() { return ""; }
			`],
			["agent-states", `export function AgentStates() { return null; }`],
			["agent-profile-card", `export function AgentProfileCard() { return null; }`],
			["smart-link", `export function SmartLink() { return null; } export const SMART_LINK_MODAL_ACTIONS = [];`],
			["avatar", `export function Avatar() { return null; } export function AvatarFallback() { return null; } export function AvatarImage() { return null; }`],
			["lozenge", `export function Lozenge() { return null; }`],
			["metadata-path-link", `export function MetadataPathLink() { return null; } export function MetadataPathValue() { return null; }`],
			["tag", `export function Tag() { return null; }`],
			["progress-circle", `export function ProgressCircle() { return null; }`],
			["agent-avatars", `export function getAgentProfileBannerSrc() { return ""; }`],
			["jira-session-details-card", `export function JiraSessionDetailsCard() { return null; }`],
			["jira-session-untracked-work-card", `export function JiraSessionUntrackedWorkCard() { return null; }`],
			["cone-safezone", `export function ConeSafezone() { return null; } export function ConeSafezoneContent() { return null; }`],
			["agent-session-arrival-motion", `export const AGENT_SESSION_TOP_ARRIVAL_TRANSFORM = "none"; export const AGENT_SESSION_TOP_ARRIVAL_TRANSITION = {}; export function toAgentSessionTopArrivalTransform() { return "none"; }`],
			["agent-session-approve", `export function approveActionLabel() { return "Approve"; } export function resolveApproveTarget() { return {}; }`],
			["agent-list", `export { isCodingAgentListItem } from "./components/blocks/agent-list/agent-list-session.ts";`],
			["agent-session-glow", `export function resolveAgentSessionGlow() { return { bloom: false, stroke: false, style: {} }; }`],
			["use-agent-session-scroll-preview", `export function useAgentSessionScrollPreview() { return { activeItemId: null, onOpenChange() {} }; }`],
			["use-agent-session-status-departure", `export function useAgentSessionStatusDeparture({ items }) { return { items, exitingItemIds: new Set(), onDepartureComplete() {} }; }`],
			["agent-session-compact-card", `export function AgentSessionAttachedCard() { return null; } export function AgentSessionCompactCard() { return null; }`],
			["agent-session-long-metadata", `export const AGENT_SESSION_STATUS_LABEL = {}; export function toAgentSessionMetadataSegments() { return []; }`],
			["agent-session-work-item", `
				export function bindAgentSessionFlyoutActions() { return {}; }
				export function resolveAgentSessionWorkItemKey() { return undefined; }
				export function suggestedAgentSessionWorkItemKey() { return undefined; }
				export function toAgentSessionUntrackedWorkFlyoutItem(item) { return { id: item.id, title: item.title }; }
				export function toJiraIssueAgentActivityFromSession(item) { return item; }
			`],
			["agent-session-transfer-member", `export function agentSessionAccentColor() { return "blue"; }`],
			["session-cohort", `export function isTransferSourceFaded() { return false; }`],
			["use-media-query", `export function useMediaQuery() { return true; }`],
			["utils", `export function cn(...classes) { return classes.flat().filter(Boolean).join(" "); }`],
			["icon", `export function Icon() { return null; }`],
			["agent-session-select-mark", `export function AgentSessionSelectMark() { return null; }`],
			["agent-session-expired-hint", `export function AgentSessionExpiredHint({ children }) { return children; }`],
			["agent-session-viewer-hint", `export function AgentSessionViewerHint() { return null; } export function AgentSessionViewerTooltip({ children }) { return children; }`],
			["agent-session-metadata", `export function AgentSessionLongMetadata() { return null; } export function AgentSessionShortMetadata() { return null; }`],
			["agent-session-lifecycle", `export function AgentSessionLifecycle() { return null; } export function AgentSessionShortLifecycleIcon() { return null; }`],
		]);
		const result = await esbuild.build({
			stdin: {
				contents: `export { AgentSessionCard } from "./components/blocks/agent-session/agent-session-card.tsx"; export { AgentSessionMoreMenu } from "./components/blocks/agent-session/agent-session-more-menu.tsx"; export { useAgentSessionMenu } from "./components/blocks/agent-session/use-agent-session-menu.ts"; export { AssignedAgentsSessionMenu } from "./components/blocks/agent-assignment/components/assigned-agents-session-menu.tsx"; export { AgentSessionContinueMenu } from "./components/blocks/agent-session/agent-session-continue-menu.tsx"; export { JiraSessionFlyoutSuspensionProvider, JiraSessionFlyoutTrigger } from "./components/blocks/product-sidebar/variants/jira-session-flyout.tsx"; export { AgentSession } from "./components/blocks/agent-session/index.tsx";`,
				resolveDir: process.cwd(), loader: "tsx",
			},
			bundle: true, platform: "node", format: "cjs", write: false, jsx: "automatic",
			plugins: [{ name: "card-boundaries", setup(build) {
				build.onResolve({ filter: /.*/ }, (args) => {
					if (args.path.endsWith("/agent-session/index.tsx")) return undefined;
					if (args.importer.endsWith("assigned-agents-session-menu.tsx") && args.path.endsWith("agent-session-card")) return { path: "assignment-card-boundary", namespace: "card-mock" };
					if (/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(args.path)) return { path: args.path, external: true };
					const basename = path.basename(args.path);
					if (realFiles.has(basename)) return undefined;
					if (args.path === "@/lib/tokens") return { path: "tokens", namespace: "card-mock" };
					if (args.path.startsWith("@atlaskit/")) return { path: "icon-default", namespace: "card-mock" };
					const key = mocks.has(args.path) ? args.path : basename;
					if (mocks.has(key)) return { path: key, namespace: "card-mock" };
					return undefined;
				});
				build.onLoad({ filter: /.*/, namespace: "card-mock" }, (args) => ({
					contents: args.path === "tokens" ? `export function token() { return "8px"; }` : args.path === "icon-default" ? `export default function Icon() { return null; }` : mocks.get(args.path),
					loader: "tsx", resolveDir: process.cwd(),
				}));
			} }],
		});
		return loadCjsModuleFromText(result.outputFiles[0].text, "agent-session-card-activation-harness.cjs");
	})();
	return harnessPromise;
}

async function withCard(props, verify, Component) {
	const { window } = parseHTML("<!doctype html><html><body><div id='app'></div></body></html>");
	const names = ["window", "document", "Element", "HTMLElement", "Node", "navigator", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"];
	const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
	const copied = [];
	for (const [name, value] of Object.entries({
		window, document: window.document, Element: window.Element, HTMLElement: window.HTMLElement, Node: window.Node,
		navigator: { platform: "MacIntel", clipboard: { writeText: async (command) => { copied.push(command); } } },
		IS_REACT_ACT_ENVIRONMENT: true,
	})) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
	const root = createRoot(window.document.getElementById("app"));
	window.requestAnimationFrame = (callback) => { queueMicrotask(() => callback(0)); return 0; };
	window.cancelAnimationFrame = () => {};
	try {
		const { AgentSessionCard } = await loadHarness();
		await React.act(async () => { root.render(React.createElement(Component ?? AgentSessionCard, props)); });
		const click = async (element) => React.act(async () => { element.click(); });
		const render = async (nextProps) => React.act(async () => { root.render(React.createElement(Component ?? AgentSessionCard, nextProps)); });
		await verify({ document: window.document, window, copied, click, render });
	} finally {
		await React.act(async () => { root.unmount(); });
		for (const [name, descriptor] of descriptors) {
			if (descriptor) Object.defineProperty(globalThis, name, descriptor);
			else delete globalThis[name];
		}
	}
}

const LOCAL_ITEM = { id: "local-readiness", title: "Final readiness", host: "local", state: "complete", agent: { id: "claude", name: "Claude", kind: "agent" } };

test("local cards retain their hover preview and open Continue in on click", async () => {
	await withCard({
		item: LOCAL_ITEM, sessionDrag: {}, flyoutHandle: {},
		flyoutSession: { id: LOCAL_ITEM.id, title: LOCAL_ITEM.title },
	}, async ({ document, click }) => {
		assert.ok(document.querySelector("[data-session-preview-trigger]"));
		await click(document.querySelector("article"));
		assert.ok(document.querySelector('[data-menu="continue"]'));
	});
});

test("owner cards retain their hover session preview while viewer cards keep it private", async () => {
	for (const props of [
		{ item: { ...LOCAL_ITEM, host: "cloud" } },
		{ item: { ...LOCAL_ITEM, role: "viewer" } },
		{ item: LOCAL_ITEM, isResumable: () => false },
		{ item: LOCAL_ITEM, triageRow: { mark: { isLead: true, isMarked: false, onActivate() {} } } },
	]) {
		await withCard({
			...props, sessionDrag: {}, flyoutHandle: {},
			flyoutSession: { id: LOCAL_ITEM.id, title: LOCAL_ITEM.title },
		}, async ({ document }) => {
			assert.equal(document.querySelector("[data-session-preview-trigger]") !== null, props.item.role !== "viewer");
		});
	}
});

test("a draggable local card opens Continue in instead of invoking View or copying directly", async () => {
	let views = 0;
	await withCard({ item: LOCAL_ITEM, sessionDrag: {}, onView: () => { views++; } }, async ({ document, copied, click }) => {
		const article = document.querySelector("article");
		assert.equal(article.getAttribute("tabindex"), "0");
		assert.equal(article.hasAttribute("data-drag-bind"), true);
		assert.equal(document.querySelector("[data-body-trigger]"), null, "the body must remain a drag surface");
		await click(article);
		assert.equal(views, 0);
		assert.deepEqual(copied, []);
		const menu = document.querySelector('[data-menu="continue"]');
		assert.ok(menu);
		assert.equal(menu.getAttribute("data-anchor"), "ARTICLE");
		await click(menu.querySelector("button"));
		assert.deepEqual(copied, ["claude --resume local-readiness"]);
		assert.equal(menu.querySelector("button").getAttribute("data-copied"), "true");
	});
});

test("the local card ellipsis opens only the record menu and can dismiss the card", async () => {
	let dismissed = 0;
	await withCard({ item: LOCAL_ITEM, sessionDrag: {}, onToggleVisibility: () => { dismissed++; } }, async ({ document, click }) => {
		await click(document.querySelector("[data-more]"));
		assert.ok(document.querySelector('[data-menu="continue"]') === null);
		await click(document.querySelector('[data-menu="more"] button'));
		assert.equal(dismissed, 1);
		assert.equal(document.querySelector('[data-menu="continue"]'), null);
	});
});

test("Enter opens the local draggable card continuation menu", async () => {
	await withCard({ item: LOCAL_ITEM, sessionDrag: {} }, async ({ document, window }) => {
		const event = new window.Event("keydown", { bubbles: true, cancelable: true });
		event.key = "Enter";
		await React.act(async () => { document.querySelector("article").dispatchEvent(event); });
		assert.ok(document.querySelector('[data-menu="continue"]'));
	});
});

test("an assigned local row shares continuation while cloud rows retain View", async () => {
	await withCard({ item: LOCAL_ITEM, density: "long" }, async ({ document, click }) => {
		await click(document.querySelector("[data-body-trigger]"));
		assert.ok(document.querySelector('[data-menu="continue"]'));
	});
	let views = 0;
	await withCard({ item: { ...LOCAL_ITEM, host: "cloud" }, onView: () => { views++; } }, async ({ document, click }) => {
		await click(document.querySelector("[data-body-trigger]"));
		assert.equal(views, 1);
		assert.equal(document.querySelector('[data-menu="continue"]'), null);
	});
});

test("multi-select keeps its selection gesture instead of opening continuation", async () => {
	let selections = 0;
	await withCard({ item: LOCAL_ITEM, sessionDrag: {}, triageRow: { mark: { isLead: true, isMarked: false, onActivate: () => { selections++; } } } }, async ({ document, click }) => {
		await click(document.querySelector("article"));
		assert.equal(selections, 1);
		assert.equal(document.querySelector('[data-menu="continue"]'), null);
	});
});

test("viewer and unresumable local cards do not advertise continuation", async () => {
	for (const props of [{ item: { ...LOCAL_ITEM, role: "viewer" } }, { item: LOCAL_ITEM, isResumable: () => false }]) {
		await withCard(props, async ({ document, click }) => {
			await click(document.querySelector("article"));
			assert.equal(document.querySelector('[data-menu="continue"]'), null);
			assert.equal(document.querySelector("[data-body-trigger]"), null);
		});
	}
});

test("local continuation and more actions never open together", async () => {
	await withCard({ item: LOCAL_ITEM, sessionDrag: {} }, async ({ document, click }) => {
		await click(document.querySelector("article"));
		assert.ok(document.querySelector('[data-menu="continue"]'));
		await click(document.querySelector("[data-more]"));
		assert.ok(document.querySelector('[data-menu="more"]'));
		assert.equal(document.querySelector('[data-menu="continue"]'), null);
	});
});

test("the resume gate prevents copying while the prototype Terminal option stays enabled", async () => {
	await withCard({ item: LOCAL_ITEM, sessionDrag: {}, isResumable: () => false, onContinueInAgent: () => {} }, async ({ document, click, copied }) => {
		await click(document.querySelector("article"));
		const terminal = document.querySelector('[data-menu="continue"] button');
		assert.equal(terminal.disabled, false);
		await click(terminal);
		assert.deepEqual(copied, []);
	});
});

test("the real local more menu contains only Dismiss even when linking is available", async () => {
	const { renderToStaticMarkup } = require("react-dom/server");
	const { AgentSessionMoreMenu } = await loadHarness();
	for (const isCloud of [false, true]) {
		const html = renderToStaticMarkup(React.createElement(AgentSessionMoreMenu, {
			actions: { onLinkWorkItem() {}, onDismiss() {} }, item: LOCAL_ITEM, open: true,
			onOpenChange() {}, isCloud, showLinkWorkItemMenuItem: true,
		}));
		const { document } = parseHTML(html);
		assert.deepEqual([...document.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent), isCloud ? ["Rename", "Delete", "Link work item", "Dismiss"] : ["Dismiss"]);
	}
});

test("expired session menus offer only Delete and require the delete capability", async () => {
	const { renderToStaticMarkup } = require("react-dom/server");
	const { AgentSessionMoreMenu } = await loadHarness();
	for (const canDelete of [false, true]) {
		const html = renderToStaticMarkup(React.createElement(AgentSessionMoreMenu, {
			actions: { onRename() {}, onLinkWorkItem() {}, onDismiss() {}, ...(canDelete ? { onDelete() {} } : {}) },
			item: { ...LOCAL_ITEM, host: "cloud", role: "expired" }, open: true,
			onOpenChange() {}, isCloud: true, showLinkWorkItemMenuItem: true,
		}));
		const { document } = parseHTML(html);
		const items = [...document.querySelectorAll('[role="menuitem"]')];
		assert.deepEqual(items.map((item) => item.textContent), ["Delete"]);
		assert.equal(items[0].disabled, !canDelete);
	}
});

test("a late close from the previous menu cannot close its sibling or release the host", async () => {
	const { useAgentSessionMenu } = await loadHarness();
	const hostOpenStates = [];
	function Probe() {
		const menu = useAgentSessionMenu({
			canResume: true, isCloud: false, item: LOCAL_ITEM, resumeCommand: "claude --resume local-readiness",
			onMoreMenuOpenChange: (open) => hostOpenStates.push(open),
		});
		return React.createElement("div", null,
			React.createElement("button", { "data-open-continue": "", onClick: () => menu.setIsContinueOpen(true) }),
			React.createElement("button", { "data-open-more": "", onClick: () => menu.setIsOpen(true) }),
			React.createElement("button", { "data-close-continue": "", onClick: () => menu.setIsContinueOpen(false) }),
			React.createElement("button", { "data-close-more": "", onClick: () => menu.setIsOpen(false) }),
			React.createElement("span", { "data-open-menu": "" }, menu.isOpen ? "more" : menu.isContinueOpen ? "continue" : "closed"));
	}
	await withCard({}, async ({ document, click }) => {
		await click(document.querySelector("[data-open-continue]"));
		await click(document.querySelector("[data-open-more]"));
		await click(document.querySelector("[data-close-continue]"));
		assert.equal(document.querySelector("[data-open-menu]").textContent, "more");
		assert.deepEqual(hostOpenStates, [true, true]);
		await click(document.querySelector("[data-close-more]"));
		assert.deepEqual(hostOpenStates, [true, true, false]);
	}, Probe);
});

test("assignment adapters offer View only to cloud sessions", async () => {
	const { AssignedAgentsSessionMenu } = await loadHarness();
	const selected = [];
	await withCard({
		addAgentLabel: "Add agent",
		rows: ["local", "cloud"].map((host) => ({ id: host, name: host, host, byline: "", statusLabel: "Working", role: "owner" })),
		onSelectAgent: (agent) => selected.push(agent.host),
	}, async ({ document, click }) => {
		assert.equal(document.querySelector('[data-host="local"]').getAttribute("data-view-capability"), "absent");
		await click(document.querySelector('[data-host="cloud"] button'));
		assert.deepEqual(selected, ["cloud"]);
	}, AssignedAgentsSessionMenu);
});

test("prototype continuation options stay enabled and use the card's right edge", async () => {
	const { renderToStaticMarkup } = require("react-dom/server");
	const { AgentSessionContinueMenu } = await loadHarness();
	for (const available of [false, true]) {
		const html = renderToStaticMarkup(React.createElement(AgentSessionContinueMenu, {
			item: LOCAL_ITEM, anchor: { current: null }, open: true, copied: false, onOpenChange() {},
			actions: available ? { onContinueInAgent() {}, onCopyPrompt() {} } : {},
		}));
		const { document } = parseHTML(html);
		assert.equal(document.querySelector('[role="menu"]').getAttribute("data-anchor-kind"), "explicit");
		const items = [...document.querySelectorAll('[role="menuitem"]')];
		assert.deepEqual(items.map((item) => item.textContent), ["Claude", "Terminal"]);
		assert.deepEqual(items.map((item) => item.disabled), [false, false]);
		assert.equal(document.querySelector('[role="menu"]').getAttribute("data-side"), "right");
		assert.equal(document.querySelector('[role="menu"]').getAttribute("data-align"), "start");
		assert.equal(document.querySelector('[role="menu"]').getAttribute("data-side-offset"), "8");
	}
});

test("card-anchored continuation dismisses outside its card and popup", async () => {
	const { AgentSessionContinueMenu } = await loadHarness();
	const closeRequests = [];
	function Probe() {
		const anchor = React.useRef(null);
		const [open, setOpen] = React.useState(true);
		return React.createElement(React.Fragment, null,
			React.createElement("article", { ref: anchor }, React.createElement("span", { "data-inside-card": "" }, "Local card")),
			open ? React.createElement(AgentSessionContinueMenu, {
				anchor, open, actions: {}, copied: false, item: LOCAL_ITEM,
				onOpenChange: (nextOpen) => { closeRequests.push(nextOpen); setOpen(nextOpen); },
			}) : null,
			React.createElement("button", { "data-outside-card": "", onClick: (event) => event.stopPropagation() }, "Outside"));
	}
	await withCard({}, async ({ document, window, click }) => {
		await click(document.querySelector("[data-inside-card]"));
		await click(document.querySelector('[role="menu"] span'));
		assert.deepEqual(closeRequests, []);
		// Linkedom does not model capture order; press before the click handler stops propagation.
		await React.act(async () => { document.querySelector("[data-outside-card]").dispatchEvent(new window.Event("pointerdown", { bubbles: true })); });
		assert.deepEqual(closeRequests, [false]);
		assert.ok(document.querySelector('[role="menu"]') === null);
		await click(document.querySelector("[data-outside-card]"));
		assert.deepEqual(closeRequests, [false], "unmount removes the outside-click listener");
	}, Probe);
});

test("clicking the local drag card again closes continuation without replacing its drag host", async () => {
	await withCard({ item: LOCAL_ITEM, sessionDrag: {} }, async ({ document, click }) => {
		const article = document.querySelector("article");
		await click(article);
		assert.ok(document.querySelector('[data-menu="continue"]'));
		await click(article);
		assert.equal(document.querySelector('[data-menu="continue"]'), null);
		assert.equal(document.querySelector("article"), article);
		assert.equal(article.hasAttribute("data-drag-bind"), true);
	});
});

test("Escape closes a card-anchored continuation menu and restores card focus", async () => {
	const { AgentSessionContinueMenu } = await loadHarness();
	let focused = 0;
	function Probe() {
		const anchor = React.useRef(null);
		const [open, setOpen] = React.useState(true);
		return React.createElement(React.Fragment, null,
			React.createElement("article", { ref: (node) => { anchor.current = node; if (node) node.focus = () => { focused++; }; }, tabIndex: 0 }, "Local card"),
			open ? React.createElement(AgentSessionContinueMenu, { anchor, open, actions: {}, copied: false, item: LOCAL_ITEM, onOpenChange: setOpen }) : null);
	}
	await withCard({}, async ({ document, window }) => {
		const event = new window.Event("keydown", { bubbles: true, cancelable: true });
		event.key = "Escape";
		await React.act(async () => { document.querySelector('[role="menu"]').dispatchEvent(event); });
		assert.equal(document.querySelector('[role="menu"]'), null);
		assert.equal(focused, 1);
	}, Probe);
});

test("nested preview suspension preserves an ancestor's drag suspension", async () => {
	const { JiraSessionFlyoutSuspensionProvider: Suspension, JiraSessionFlyoutTrigger: Trigger } = await loadHarness();
	let previewsClosed = 0;
	const handle = { id: "real", close: () => { previewsClosed++; }, open() {} };
	function Probe() {
		return React.createElement(Suspension, { suspended: true },
			React.createElement(Suspension, { suspended: false },
				React.createElement(Trigger, { handle, session: { id: "local", title: "Local" } }, React.createElement("span", null, "Local card"))));
	}
	await withCard({}, async ({ document }) => {
		assert.equal(document.querySelector("[data-hover-handle]").getAttribute("data-hover-handle"), "inactive");
		assert.equal(previewsClosed, 1);
	}, Probe);
});

test("unmounting an open menu releases its host's preview suspension", async () => {
	const events = [];
	await withCard({ item: LOCAL_ITEM, sessionDrag: {}, onMoreMenuOpenChange: (open) => events.push(open) }, async ({ document, click }) => {
		await click(document.querySelector("article"));
		assert.deepEqual(events, [true]);
	});
	assert.deepEqual(events, [true, false]);
});

test("the session list suspends all hover previews until its click menu closes", async () => {
	const { AgentSession } = await loadHarness();
	const items = [LOCAL_ITEM, { ...LOCAL_ITEM, id: "second" }];
	await withCard({ items, sessionDrag: {} }, async ({ document, click }) => {
		const marker = document.querySelector("[data-preview-suspended]");
		assert.equal(marker.getAttribute("data-preview-suspended"), "false");
		const article = document.querySelector('[data-testid="agent-session-row-local-readiness"] article');
		await click(article);
		assert.equal(marker.getAttribute("data-preview-suspended"), "true");
		await click(article);
		assert.equal(marker.getAttribute("data-preview-suspended"), "false");
		assert.equal(document.querySelector('[data-testid="agent-session-row-local-readiness"] article'), article);
	}, AgentSession);
});

test("removing the active card restores hover previews for the remaining sessions", async () => {
	const { AgentSession } = await loadHarness();
	const second = { ...LOCAL_ITEM, id: "second" };
	await withCard({ items: [LOCAL_ITEM, second], sessionDrag: {} }, async ({ document, click, render }) => {
		await click(document.querySelector('[data-testid="agent-session-row-local-readiness"] article'));
		assert.equal(document.querySelector("[data-preview-suspended]").getAttribute("data-preview-suspended"), "true");
		await render({ items: [second], sessionDrag: {} });
		assert.equal(document.querySelector("[data-preview-suspended]").getAttribute("data-preview-suspended"), "false");
	}, AgentSession);
});
