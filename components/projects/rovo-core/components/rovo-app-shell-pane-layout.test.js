const assert = require("node:assert/strict");
const path = require("node:path");
const { afterEach, beforeEach, test } = require("node:test");
const React = require("react");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

// Local stand-ins expose rendered geometry and resizable-panel sizing. Origin
// selection, clamping, breakpoint policy and width memory run in the real module.
const mocks = {
	"motion/react": `
		import React from "react";
		export function AnimatePresence({ children }) { return children; }
		export const motion = { div: ({ animate, children, exit, initial, ...props }) => (
			<div {...props} data-motion-initial={JSON.stringify(initial)}
				data-motion-animate={JSON.stringify(animate)} data-motion-exit={JSON.stringify(exit)}>{children}</div>
		) };
	`,
	"@/components/ui/resizable": `
		import React from "react";
		export function ResizablePanelGroup({ children, onLayoutChanged }) {
			return <div data-pane-group="true">
				<button onClick={() => onLayoutChanged({ "rovo-app-chat-pane": 40 })}>Resize to forty percent</button>
				<button onClick={() => onLayoutChanged({ "rovo-app-chat-pane": Infinity })}>Invalid resize</button>
				<button onClick={() => onLayoutChanged({ unrelated: 10 })}>Unrelated resize</button>
				<button onClick={() => onLayoutChanged({ "rovo-app-chat-pane": 100 })}>Chat occupies group</button>
				{children}
			</div>;
		}
		export function ResizablePanel({ children, defaultSize, groupResizeBehavior, id, maxSize, minSize, ...props }) {
			return <div {...props} id={id} data-default-size={defaultSize} data-min-size={minSize}
				data-max-size={maxSize} data-resize-behavior={groupResizeBehavior}>{children}</div>;
		}
		export function ResizableHandle() { return <div role="separator" />; }
	`,
};

const source = `
	import { useRef, useState } from "react";
	import { RovoAppShellPaneLayoutCore, useRovoAppShellPanePresentation, useRovoAppShellSize }
		from "@/components/projects/rovo-core/components/rovo-app-shell-pane-layout";
	let chatInstance = 0;
	function Chat() {
		const [instance] = useState(() => ++chatInstance);
		return <section role="region" aria-label="Chat" data-chat-instance={instance}>
			<textarea aria-label="Draft" defaultValue="Unsent draft" />
			<div data-chat-scroll="true">Chat history</div>
		</section>;
	}
	function setRect(element, rect) {
		if (element) element.getBoundingClientRect = () => new DOMRect(...rect);
	}
	export default function Harness({
		width = 700, height = 600, shellRect = [100, 50, width, height],
		composerRect = [140, 450, 400, 100], clickedRect = [190, 120, 300, 80],
		previewRect = [160, 180, 350, 180], missingShell = false, missingComposer = false,
		artifactOpen, priorityActive = false,
	}) {
		const shellRef = useRef(null);
		const composerRef = useRef(null);
		const clickedRef = useRef(null);
		const previewRef = useRef(null);
		const [isOpen, setIsOpen] = useState(false);
		const [documentId, setDocumentId] = useState("document-a");
		const resolvedOpen = artifactOpen ?? isOpen;
		const shellSize = useRovoAppShellSize(shellRef);
		const presentation = useRovoAppShellPanePresentation({
			shellRef, composerRef, shellSize, artifact: { isOpen: resolvedOpen, documentId }, priorityActive,
		});
		return <div ref={(element) => {
			shellRef.current = missingShell ? null : element;
			if (element) {
				Object.defineProperty(element, "clientWidth", { configurable: true, value: width });
				Object.defineProperty(element, "clientHeight", { configurable: true, value: height });
				setRect(element, shellRect);
			}
		}}>
			<output role="status" aria-label="Shell size">{shellSize.width}x{shellSize.height}</output>
			<output role="status" aria-label="Pane mode">{presentation.shouldSplitArtifactPane ? "split" : "overlay"}</output>
			<div ref={(element) => { composerRef.current = missingComposer ? null : element; setRect(element, composerRect); }} />
			<div ref={(element) => { clickedRef.current = element; setRect(element, clickedRect); }} />
			<div ref={(element) => { previewRef.current = element; setRect(element, previewRect); }} />
			<button onClick={() => presentation.registerArtifactCard("document-a", previewRef.current)}>Register preview</button>
			<button onClick={() => { presentation.prepareArtifactOpen(clickedRef.current); setIsOpen(true); }}>Open clicked card</button>
			<button onClick={() => setIsOpen(true)}>Open artifact</button>
			<button onClick={() => setIsOpen(false)}>Close artifact</button>
			<button onClick={() => setDocumentId("document-b")}>Switch document</button>
			<RovoAppShellPaneLayoutCore presentation={presentation}
				artifactPane={resolvedOpen ? <aside role="complementary" aria-label="Artifact">{documentId}</aside> : null}
				chatPane={<Chat />}
				priorityPane={priorityActive ? <aside role="complementary" aria-label="Agent configuration">Configuration</aside> : undefined}
			/>
		</div>;
	}
`;

const originalResizeObserver = globalThis.ResizeObserver;
let observers;
beforeEach(() => {
	observers = [];
	globalThis.ResizeObserver = class {
		constructor(callback) {
			this.callback = callback;
			this.disconnected = false;
			observers.push(this);
		}
		observe(element) { this.element = element; }
		disconnect() { this.disconnected = true; }
	};
});
afterEach(() => {
	globalThis.ResizeObserver = originalResizeObserver;
});

const render = (props = {}) => renderComponent({ source, mocks, props });
const panel = (view, kind) => view.container.querySelector(`#rovo-app-${kind}-pane`);
const motionNode = (view) => view.container.querySelector("[data-motion-initial]");
const initial = (view) => JSON.parse(motionNode(view).getAttribute("data-motion-initial"));
const click = (view, name) => view.click(view.getByRole("button", { name }));
async function measure() {
	await React.act(async () => {
		for (const observer of observers.filter((entry) => !entry.disconnected)) observer.callback([]);
	});
}

const origin = (x, y, width, height, shellWidth = 700) => ({
	opacity: 1, x, y, scaleX: width / shellWidth, scaleY: height / 600, borderRadius: 32,
});

test("clicked card wins over cached preview, uses shell coordinates, and is consumed", async () => {
	const view = await render();
	await click(view, "Register preview");
	await click(view, "Open clicked card");
	assert.deepEqual(initial(view), origin(90, 70, 300, 80));
	assert.equal(view.getByRole("complementary", { name: "Artifact" }).textContent, "document-a");
	await click(view, "Close artifact");
	await click(view, "Open artifact");
	assert.deepEqual(initial(view), origin(60, 130, 350, 180));
	await click(view, "Switch document");
	assert.deepEqual(initial(view), origin(68, 408, 344, 100));
});

test("clicked and cached cards clamp geometry with their distinct height caps", async () => {
	for (const [method, heightCap] of [["clicked", 140], ["cached", 220]]) {
		const view = await render({ clickedRect: [90, 40, 100, 20], previewRect: [90, 40, 100, 20] });
		if (method === "cached") await click(view, "Register preview");
		await click(view, method === "clicked" ? "Open clicked card" : "Open artifact");
		assert.deepEqual(initial(view), origin(16, 16, 260, 40));
		await click(view, "Close artifact");
		await view.rerender({ clickedRect: [90, 40, 600, 300], previewRect: [90, 40, 600, 300] });
		if (method === "cached") await click(view, "Register preview");
		await click(view, method === "clicked" ? "Open clicked card" : "Open artifact");
		assert.deepEqual(initial(view), origin(16, 16, 420, heightCap));
		await view.unmount();
	}
});

test("composer fallback applies offsets and clamps its opening dimensions", async () => {
	const view = await render();
	await click(view, "Open artifact");
	assert.deepEqual(initial(view), origin(68, 408, 344, 100));
	await click(view, "Close artifact");
	await view.rerender({ composerRect: [10, 10, 100, 10] });
	await click(view, "Open artifact");
	assert.deepEqual(initial(view), origin(16, 16, 260, 72));
	await click(view, "Close artifact");
	await view.rerender({ composerRect: [140, 450, 900, 300] });
	await click(view, "Open artifact");
	assert.deepEqual(initial(view), origin(68, 408, 420, 140));
});

test("missing references keep a safe origin and cards work without a composer", async () => {
	const missingShell = await render({ missingShell: true });
	await click(missingShell, "Register preview");
	await click(missingShell, "Open clicked card");
	assert.equal(missingShell.getByRole("status", { name: "Shell size" }).textContent, "0x0");
	assert.equal(motionNode(missingShell).style.width, "100%");
	assert.equal(motionNode(missingShell).style.height, "100%");
	assert.deepEqual(initial(missingShell), { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 32 });
	await missingShell.unmount();
	const missingComposer = await render({ missingComposer: true });
	await click(missingComposer, "Open artifact");
	assert.deepEqual(initial(missingComposer), origin(0, 0, 320, 96));
	await click(missingComposer, "Close artifact");
	await click(missingComposer, "Register preview");
	await click(missingComposer, "Open artifact");
	assert.deepEqual(initial(missingComposer), origin(60, 130, 350, 180));
});

test("breakpoint transitions retain chat draft, focus, scroll and mount identity", async () => {
	const view = await render({ width: 790 });
	const draft = view.getByRole("textbox", { name: "Draft" });
	const instance = view.getByRole("region", { name: "Chat" }).getAttribute("data-chat-instance");
	await view.fill(draft, "Draft kept across panes");
	await view.focus(draft);
	view.container.querySelector("[data-chat-scroll]").scrollTop = 85;
	for (const width of [790, 800, 980, 767, 1600]) {
		await view.rerender({ width, artifactOpen: true });
		await measure();
		const split = width >= 800;
		assert.equal(view.getByRole("status", { name: "Pane mode" }).textContent, split ? "split" : "overlay");
		assert.equal(view.queryByRole("separator") !== null, split);
		assert.equal(panel(view, "artifact") !== null, split);
		assert.equal(motionNode(view) !== null, !split);
		assert.equal(view.getByRole("textbox", { name: "Draft" }).value, "Draft kept across panes");
		assert.equal(view.isFocused(draft), true);
		assert.equal(view.container.querySelector("[data-chat-scroll]").scrollTop, 85);
		assert.equal(view.getByRole("region", { name: "Chat" }).getAttribute("data-chat-instance"), instance);
	}
	assert.equal(panel(view, "chat").getAttribute("data-default-size"), "560");
	assert.equal(panel(view, "artifact").getAttribute("data-default-size"), "1040");
	assert.equal(panel(view, "chat").getAttribute("data-resize-behavior"), "preserve-pixel-size");
	assert.equal(panel(view, "artifact").compareDocumentPosition(panel(view, "chat")) & Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING);
});

test("user-resized chat width reopens in pixels and clamps for narrower shells", async () => {
	const view = await render({ width: 1000 });
	await click(view, "Open artifact");
	assert.equal(panel(view, "chat").getAttribute("data-default-size"), "450");
	await click(view, "Resize to forty percent");
	assert.equal(panel(view, "chat").getAttribute("data-default-size"), "450");
	await click(view, "Invalid resize");
	await click(view, "Unrelated resize");
	await click(view, "Close artifact");
	await click(view, "Chat occupies group");
	await view.rerender({ width: 1200 });
	await measure();
	await click(view, "Open artifact");
	assert.equal(panel(view, "chat").getAttribute("data-default-size"), "400");
	assert.equal(panel(view, "artifact").getAttribute("data-default-size"), "800");
	await view.rerender({ width: 800 });
	await measure();
	assert.equal(panel(view, "chat").getAttribute("data-default-size"), "360");
	assert.equal(panel(view, "artifact").getAttribute("data-default-size"), "440");
	await view.rerender({ width: 1200 });
	await measure();
	assert.equal(panel(view, "chat").getAttribute("data-default-size"), "400");
});

test("Studio configuration occupies the pane and preserves artifact resize memory", async () => {
	const view = await render({ width: 1000 });
	await click(view, "Open artifact");
	await click(view, "Resize to forty percent");
	await view.rerender({ width: 1000, priorityActive: true });
	assert.equal(view.getByRole("complementary", { name: "Agent configuration" }).textContent, "Configuration");
	assert.equal(view.queryByRole("region", { name: "Chat" }) === null, true);
	assert.equal(view.queryByRole("complementary", { name: "Artifact" }) === null, true);
	assert.equal(view.queryByRole("separator") === null, true);
	assert.equal(view.getByRole("status", { name: "Pane mode" }).textContent, "overlay");
	await view.rerender({ width: 1000 });
	assert.equal(view.queryByRole("complementary", { name: "Agent configuration" }) === null, true);
	assert.equal(panel(view, "chat").getAttribute("data-default-size"), "400");
});

test("shell measurements update on resize and disconnect on cleanup", async () => {
	const view = await render();
	assert.equal(view.getByRole("status", { name: "Shell size" }).textContent, "700x600");
	assert.equal(observers.length, 1);
	await view.rerender({ width: 950, height: 500 });
	await measure();
	assert.equal(view.getByRole("status", { name: "Shell size" }).textContent, "950x500");
	await view.unmount();
	assert.equal(observers.every((observer) => observer.disconnected), true);
});

test("without ResizeObserver measurement safely retains the initial size", async () => {
	globalThis.ResizeObserver = undefined;
	const view = await render();
	await click(view, "Open artifact");
	assert.equal(view.getByRole("status", { name: "Shell size" }).textContent, "0x0");
	assert.equal(motionNode(view).style.width, "100%");
	assert.equal(observers.length, 0);
});
