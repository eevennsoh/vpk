const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

// Assertions compare strings and booleans only; see the note atop render-component.js.
const { accessibleName, cleanup, renderComponent } = require(path.join(__dirname, "render-component.js"));
const { act } = require("react");

const COUNTER_SOURCE = `
	import { useState } from "react";

	export function Counter({ label = "Count", onEscape }) {
		const [count, setCount] = useState(0);
		return (
			<div onKeyDown={(event) => { if (event.key === "Escape") onEscape?.(); }}>
				<p>{label}: {count}</p>
				<button type="button" onClick={() => setCount((value) => value + 1)}>Increment</button>
			</div>
		);
	}
`;

test("fill replaces contenteditable text and delivers a native input event", async () => {
	const view = await renderComponent({ source: `import { useState } from "react";
		export default function Editable() { const [value, setValue] = useState(""); return <><div contentEditable role="textbox" aria-label="Comment" onInput={(event) => setValue(event.currentTarget.textContent)} /><p>Saved: {value}</p></>; }` });
	await view.fill(view.getByRole("textbox", { name: "Comment" }), "First draft");
	assert.equal(view.queryByText("Saved: First draft") !== null, true);
	await view.fill(view.getByRole("textbox", { name: "Comment" }), "Replacement");
	assert.equal(view.queryByText("Saved: Replacement") !== null, true);
	assert.equal(view.getByRole("textbox", { name: "Comment" }).textContent, "Replacement");
});

test("renders an inline component with props", async () => {
	const view = await renderComponent({ exportName: "Counter", props: { label: "Clicks" }, source: COUNTER_SOURCE });

	assert.equal(view.getByText("Clicks: 0").tagName, "P");
	assert.equal(view.getByRole("button", { name: "Increment" }).type, "button");
	assert.ok(!view.queryByRole("button", { name: "Missing" }));
	assert.throws(() => view.getByRole("link"), /Found no element for role link[\s\S]*button "Increment"/u);
});

test("native tables expose headers, rows and cells without overriding their roles", async () => {
	const view = await renderComponent({ source: `export default function TableProbe() { return <table aria-label="Work"><thead><tr><th scope="col">Summary</th></tr></thead><tbody><tr><th scope="row">PAY-1</th><td>First item</td></tr></tbody></table>; }` });
	assert.equal(view.getByRole("table", { name: "Work" }).tagName, "TABLE");
	assert.equal(view.getByRole("columnheader", { name: "Summary" }).tagName, "TH");
	assert.equal(view.getByRole("rowheader", { name: "PAY-1" }).tagName, "TH");
	assert.equal(view.getByRole("cell", { name: "First item" }).tagName, "TD");
	assert.equal(view.getAllByRole("row").length, 2);
	assert.equal(view.getAllByRole("rowgroup").length, 2);
});

test("click updates state and focuses the clicked button", async () => {
	const view = await renderComponent({ exportName: "Counter", source: COUNTER_SOURCE });
	const button = view.getByRole("button", { name: "Increment" });

	await view.click(button);
	await view.click(button);

	assert.ok(view.getByText("Count: 2"));
	assert.ok(view.isFocused(button));
});

test("rerender replaces props on the mounted component without resetting state", async () => {
	const view = await renderComponent({ exportName: "Counter", props: { label: "Before" }, source: COUNTER_SOURCE });

	await view.click(view.getByRole("button", { name: "Increment" }));
	await view.rerender({ label: "After" });

	assert.ok(view.getByText("After: 1"));
});

test("rerender with a new key remounts, so an entity switch can be tested both in place and re-keyed", async () => {
	const view = await renderComponent({ exportName: "Counter", props: { key: "a", label: "A" }, source: COUNTER_SOURCE });

	await view.click(view.getByRole("button", { name: "Increment" }));
	await view.rerender({ key: "a", label: "A" });
	assert.ok(view.getByText("A: 1"), "the same key keeps state");
	await view.rerender({ key: "b", label: "B" });
	assert.ok(view.getByText("B: 0"), "a new key starts fresh");
	await view.rerender({ key: "a", label: "A" });
	assert.ok(view.getByText("A: 0"), "returning to a previous key is also a fresh mount");
});

test("press dispatches key events and emulates Enter/Space activation", async () => {
	let escapes = 0;
	const view = await renderComponent({ exportName: "Counter", props: { onEscape: () => escapes++ }, source: COUNTER_SOURCE });
	const button = view.getByRole("button", { name: "Increment" });

	await view.press(button, "Escape");
	await view.press(button, "Enter");
	await view.press(button, " ");
	await view.press(view.getByText("Count: 2"), "Enter");

	assert.equal(escapes, 1);
	assert.ok(view.getByText("Count: 2"), "Enter on a non-activatable element must not click");
});

test("focus only lands on focusable elements and Tab follows sequential focus order", async () => {
	const view = await renderComponent({
		exportName: "Controls",
		source: `
			export function Controls() {
				return (
					<div>
						<button type="button">First</button>
						<button type="button" disabled>Disabled</button>
						<button type="button" tabIndex={-1}>Programmatic</button>
						<div hidden><button type="button">Hidden</button></div>
						<a href="/next">Next</a>
						<p>Plain text</p>
					</div>
				);
			}
		`,
	});
	assert.deepEqual(view.tabOrder(), ["First", "Next"]);

	await view.focus(view.getByText("Plain text"));
	assert.ok(view.isFocused(document.body));
	await view.focus(view.getByRole("button", { name: "Programmatic" }));
	assert.equal(accessibleName(document.activeElement), "Programmatic");

	await view.focus(view.getByRole("button", { name: "First" }));
	await view.press(null, "Tab");
	assert.equal(accessibleName(document.activeElement), "Next");
	await view.press(null, "Tab", { shiftKey: true });
	assert.equal(accessibleName(document.activeElement), "First");
});

test("clicking a disabled button does not activate it", async () => {
	let clicks = 0;
	const view = await renderComponent({
		exportName: "DisabledButton",
		props: { onClick: () => clicks++ },
		source: `export function DisabledButton({ onClick }) { return <button disabled onClick={onClick}>Save</button>; }`,
	});

	await view.click(view.getByRole("button", { name: "Save" }));

	assert.equal(clicks, 0);
	assert.ok(!view.isFocused(view.getByRole("button", { name: "Save" })));
});

test("fill drives a controlled input through React onChange", async () => {
	const view = await renderComponent({
		exportName: "Search",
		source: `
			import { useState } from "react";
			export function Search() {
				const [query, setQuery] = useState("");
				return (
					<label>
						Search
						<input value={query} onChange={(event) => setQuery(event.target.value)} />
						<output>{query ? "Results for " + query : "Empty"}</output>
					</label>
				);
			}
		`,
	});

	await view.fill(view.getByRole("textbox", { name: /Search/u }), "tokens");

	assert.ok(view.getByText("Results for tokens"));
});

test("mocks replace bare, @/ and matching relative imports; CSS imports are stubbed", async () => {
	const view = await renderComponent({
		exportName: "Tagged",
		mocks: {
			"@/components/ui/tag": `export function Tag({ children }) { return <span data-mock-tag>{children}</span>; }`,
			"@atlaskit/icon/core/cross": `export default function CrossIcon() { return <svg data-mock-icon />; }`,
		},
		source: `
			import "./app/globals.css";
			import CrossIcon from "@atlaskit/icon/core/cross";
			import { Tag } from "@/components/ui/tag";
			import { Tag as RelativeTag } from "./components/ui/tag";
			export function Tagged() {
				return <div><Tag>Alias</Tag><RelativeTag>Relative</RelativeTag><CrossIcon /></div>;
			}
		`,
	});

	assert.equal(view.container.querySelectorAll("[data-mock-tag]").length, 2);
	assert.ok(view.container.querySelector("[data-mock-icon]"));
});

test("Next.js runtime modules have safe default stubs", async () => {
	const view = await renderComponent({
		exportName: "Nav",
		source: `
			import Image from "next/image";
			import Link from "next/link";
			import { usePathname, useRouter, useSearchParams } from "next/navigation";
			export function Nav() {
				const router = useRouter();
				return (
					<nav aria-label={"Path " + usePathname() + useSearchParams().toString()}>
						<Link href="/docs" prefetch={false}>Docs</Link>
						<Image alt="Logo" height={16} priority src={{ src: "/logo.svg" }} width={16} />
						<button type="button" onClick={() => router.push("/docs")}>Go</button>
					</nav>
				);
			}
		`,
	});

	assert.ok(view.getByRole("navigation", { name: "Path /" }));
	assert.equal(view.getByRole("link", { name: "Docs" }).getAttribute("href"), "/docs");
	assert.equal(view.getByRole("img", { name: "Logo" }).getAttribute("src"), "/logo.svg");
	await view.click(view.getByRole("button", { name: "Go" }));
});

test("renders a real repo component from its entry path", async () => {
	let clicks = 0;
	const view = await renderComponent({
		entry: "components/ui/button.tsx",
		exportName: "Button",
		props: { children: "Save", onClick: () => clicks++ },
	});

	await view.press(view.getByRole("button", { name: "Save" }), "Enter");

	assert.equal(clicks, 1);
});

test("errors thrown by event handlers reject the interaction", async () => {
	const view = await renderComponent({
		exportName: "Broken",
		source: `export function Broken() { return <button onClick={() => { throw new Error("handler exploded"); }}>Boom</button>; }`,
	});

	await assert.rejects(view.click(view.getByRole("button", { name: "Boom" })), /handler exploded/u);
});

test("unmount runs effect cleanup and cleanup() empties the document, including portals", async () => {
	const events = [];
	const source = `
		import { useEffect } from "react";
		import { createPortal } from "react-dom";
		export function Overlay({ onCleanup }) {
			useEffect(() => onCleanup, [onCleanup]);
			return <div>Inline{createPortal(<div role="dialog" aria-label="Portal" />, document.body)}</div>;
		}
	`;
	const first = await renderComponent({ exportName: "Overlay", props: { onCleanup: () => events.push("first") }, source });
	await renderComponent({ exportName: "Overlay", props: { onCleanup: () => events.push("second") }, source });

	assert.equal(first.getAllByRole("dialog", { name: "Portal" }).length, 2);

	await first.unmount();
	assert.deepEqual(events, ["first"]);
	assert.equal(first.container.isConnected, false);

	await cleanup();
	assert.deepEqual(events, ["first", "second"]);
	assert.equal(document.body.childNodes.length, 0);
});

test("Motion components mount, exit through AnimatePresence and re-enter without failing the test", async () => {
	const view = await renderComponent({
		source: `
import { AnimatePresence, motion } from "motion/react";
export function Fade({ show }) {
	return <AnimatePresence>{show ? <motion.p key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Saved</motion.p> : null}</AnimatePresence>;
}
`,
		exportName: "Fade",
		props: { show: true },
	});
	// Toggling mid-animation cancels it; before the cancel patch this rejected `finished` unhandled.
	await view.rerender({ show: false });
	await view.rerender({ show: true });
	assert.equal(view.getByText("Saved").textContent, "Saved");
});

test("strictMode mounts effects twice, as development does, so setup/cleanup bugs surface", async () => {
	const source = `
import { useEffect } from "react";
export function Probe({ log }) {
	useEffect(() => {
		log.push("setup");
		return () => log.push("cleanup");
	}, [log]);
	return null;
}
`;
	const strict = [];
	await renderComponent({ exportName: "Probe", props: { log: strict }, source, strictMode: true });
	assert.deepEqual(strict, ["setup", "cleanup", "setup"]);
	const plain = [];
	await renderComponent({ exportName: "Probe", props: { log: plain }, source });
	assert.deepEqual(plain, ["setup"]);
});

test("the document starts empty for every test", () => {
	assert.equal(document.body.childNodes.length, 0);
	assert.ok(document.activeElement === document.body);
});

// A listener registered before the tests (here, at file load) belongs to the file and stays.
const fileListenerCalls = [];
window.addEventListener("resize", () => fileListenerCalls.push("file"));
const leftoverCalls = [];
globalThis.__renderComponentLeftoverCalls = leftoverCalls;
const LEFTOVER_LISTENER_SOURCE = `
	globalThis.__renderComponentLeftoverCalls.push("loaded");
	window.addEventListener("resize", () => globalThis.__renderComponentLeftoverCalls.push("window"));
	document.addEventListener("visibilitychange", () => globalThis.__renderComponentLeftoverCalls.push("document"));
	export default function Probe() { return <p>Probe</p>; }
`;

test("a bundle's load-time window and document listeners work during its test", async () => {
	await renderComponent({ source: LEFTOVER_LISTENER_SOURCE });
	window.dispatchEvent(new Event("resize"));
	document.dispatchEvent(new Event("visibilitychange"));
	assert.deepEqual(leftoverCalls, ["loaded", "window", "document"]);
});

test("listeners a bundle leaves on window and document are removed after its test, so they cannot keep it alive", () => {
	leftoverCalls.length = 0;
	fileListenerCalls.length = 0;
	window.dispatchEvent(new Event("resize"));
	document.dispatchEvent(new Event("visibilitychange"));
	assert.deepEqual(leftoverCalls, []);
	assert.deepEqual(fileListenerCalls, ["file"]);
});

test("React events still reach body portals and onSelect after earlier tests rendered", async () => {
	const selected = [];
	const view = await renderComponent({
		props: { onSelect: (value) => selected.push(value) },
		source: `
			import { useState } from "react";
			import { createPortal } from "react-dom";
			export default function Portal({ onSelect }) {
				const [count, setCount] = useState(0);
				return <>
					<input aria-label="Field" defaultValue="selected text" onSelect={(event) => onSelect(event.currentTarget.value.slice(event.currentTarget.selectionStart, event.currentTarget.selectionEnd))} />
					{createPortal(<button type="button" onClick={() => setCount((value) => value + 1)}>Portal clicks: {count}</button>, document.body)}
				</>;
			}
		`,
	});
	await view.click(view.getByRole("button", { name: "Portal clicks: 0" }));
	assert.equal(view.queryByRole("button", { name: "Portal clicks: 1" }) !== null, true);
	const field = view.getByRole("textbox", { name: "Field" });
	await view.focus(field);
	field.setSelectionRange(0, 8);
	await act(async () => {
		document.dispatchEvent(new Event("selectionchange"));
	});
	assert.deepEqual(selected.slice(-1), ["selected"]);
});

test("the CommonJS loader does not keep the bundles it evaluates reachable from its own module", async () => {
	const loader = require.cache[require.resolve("./esbuild-cjs-loader.js")];
	const before = loader.children.length;
	await renderComponent({ exportName: "Counter", source: COUNTER_SOURCE });
	await renderComponent({ exportName: "Counter", source: COUNTER_SOURCE });
	assert.equal(loader.children.length, before);
});

// One callback registered on the same target and type in both phases: removing the registration a
// test added must leave the one that predates the tests, whichever phase each is in. Dispatching on
// <body> tells the phases apart: document hears the capture registration first, then the bubbling one.
const phaseCalls = { bubblingKept: [], capturingKept: [] };
const recordPhase = (calls) => (event) => calls.push(event.eventPhase === Event.CAPTURING_PHASE ? "capture" : "bubble");
const bubblingKept = recordPhase(phaseCalls.bubblingKept);
const capturingKept = recordPhase(phaseCalls.capturingKept);
document.addEventListener("harness-phase-bubbling-kept", bubblingKept);
document.addEventListener("harness-phase-capturing-kept", capturingKept, { capture: true });

test("a test adds the same callback in the other phase", () => {
	document.addEventListener("harness-phase-bubbling-kept", bubblingKept, { capture: true });
	document.addEventListener("harness-phase-capturing-kept", capturingKept);
	document.body.dispatchEvent(new Event("harness-phase-bubbling-kept", { bubbles: true }));
	document.body.dispatchEvent(new Event("harness-phase-capturing-kept", { bubbles: true }));
	assert.deepEqual(phaseCalls, { bubblingKept: ["capture", "bubble"], capturingKept: ["capture", "bubble"] });
});

test("only the registration added during the test is removed, in its own phase", () => {
	phaseCalls.bubblingKept.length = 0;
	phaseCalls.capturingKept.length = 0;
	document.body.dispatchEvent(new Event("harness-phase-bubbling-kept", { bubbles: true }));
	document.body.dispatchEvent(new Event("harness-phase-capturing-kept", { bubbles: true }));
	assert.deepEqual(phaseCalls, { bubblingKept: ["bubble"], capturingKept: ["capture"] });
});

const nestedCalls = [];
document.addEventListener("harness-nested", () => nestedCalls.push("file"));

test("a parent test keeps the listener it added before a subtest while it runs", async (t) => {
	document.addEventListener("harness-nested", () => nestedCalls.push("parent"));
	await t.test("a subtest adds its own listener", () => {
		document.addEventListener("harness-nested", () => nestedCalls.push("child"));
	});
	document.dispatchEvent(new Event("harness-nested"));
	assert.deepEqual(nestedCalls, ["file", "parent"]);
});

test("the listener a parent test added before its subtest is removed when the parent ends", () => {
	nestedCalls.length = 0;
	document.dispatchEvent(new Event("harness-nested"));
	assert.deepEqual(nestedCalls, ["file"]);
});

const manualCleanupCalls = [];
document.addEventListener("harness-manual-cleanup", () => manualCleanupCalls.push("file"));

test("a manual cleanup in the middle of a test leaves listeners to the end of the test", async (t) => {
	document.addEventListener("harness-manual-cleanup", () => manualCleanupCalls.push("before cleanup"));
	await renderComponent({ source: LEFTOVER_LISTENER_SOURCE });
	await cleanup();
	assert.equal(document.body.childNodes.length, 0);
	document.addEventListener("harness-manual-cleanup", () => manualCleanupCalls.push("after cleanup"));
	document.dispatchEvent(new Event("harness-manual-cleanup"));
	assert.deepEqual(manualCleanupCalls, ["file", "before cleanup", "after cleanup"]);
	// The rendering suites also call cleanup from t.after, which runs after the harness afterEach.
	t.after(cleanup);
});

test("listeners added before and after a manual cleanup are removed at the end of that test; the file's stay", () => {
	manualCleanupCalls.length = 0;
	leftoverCalls.length = 0;
	document.dispatchEvent(new Event("harness-manual-cleanup"));
	document.dispatchEvent(new Event("visibilitychange"));
	assert.deepEqual(manualCleanupCalls, ["file"]);
	assert.deepEqual(leftoverCalls, []);
});

// Removal keeps each listener's options at its index, so a later `once` registration still fires once.
const onceCalls = [];

test("a test leaves a plain listener behind", () => {
	document.addEventListener("harness-options", () => onceCalls.push("plain"));
});

test("a once listener added after that removal fires once", () => {
	document.addEventListener("harness-options", () => onceCalls.push("once"), { once: true });
	document.dispatchEvent(new Event("harness-options"));
	document.dispatchEvent(new Event("harness-options"));
	assert.deepEqual(onceCalls, ["once"]);
});
