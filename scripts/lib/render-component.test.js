const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

// Assertions compare strings and booleans only; see the note atop render-component.js.
const { accessibleName, cleanup, renderComponent } = require(path.join(__dirname, "render-component.js"));

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

test("renders an inline component with props", async () => {
	const view = await renderComponent({ exportName: "Counter", props: { label: "Clicks" }, source: COUNTER_SOURCE });

	assert.equal(view.getByText("Clicks: 0").tagName, "P");
	assert.equal(view.getByRole("button", { name: "Increment" }).type, "button");
	assert.ok(!view.queryByRole("button", { name: "Missing" }));
	assert.throws(() => view.getByRole("link"), /Found no element for role link[\s\S]*button "Increment"/u);
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

test("the document starts empty for every test", () => {
	assert.equal(document.body.childNodes.length, 0);
	assert.ok(document.activeElement === document.body);
});
