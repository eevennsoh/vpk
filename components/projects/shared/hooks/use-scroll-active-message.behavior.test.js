// Scroll-linked active-message tracking shared by Rovo/Studio (RovoAppScrollActiveTracker) and the Chat Timeline block.
// happy-dom has no layout, so geometry is stubbed on the scrollport and message nodes.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));
const { resolveScrollActiveMessageId } = require("./use-scroll-active-message.ts");

// 500px viewport at the top of the page: the active line sits at 150px.
function stubScrollport(element, { scrollTop = 0, scrollHeight = 2000, clientHeight = 500 } = {}) {
	Object.defineProperty(element, "scrollTop", { configurable: true, value: scrollTop, writable: true });
	Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
	Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
	element.getBoundingClientRect = () => ({ bottom: clientHeight, height: clientHeight, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0 });
	return element;
}

function stubTop(element, top) {
	element.getBoundingClientRect = () => ({ bottom: top + 40, height: 40, left: 0, right: 0, top, width: 0, x: 0, y: top });
	return element;
}

function fakeMessages(tops) {
	return Object.entries(tops).map(([id, top]) => ({ id, node: stubTop(document.createElement("div"), top) }));
}

test("the last message across the 30% line is active mid-scroll", () => {
	const container = stubScrollport(document.createElement("div"), { scrollTop: 600 });
	assert.equal(resolveScrollActiveMessageId(container, fakeMessages({ a: -400, b: 100, c: 300 })), "b");
	assert.equal(resolveScrollActiveMessageId(container, fakeMessages({ a: -400, b: 150, c: 151 })), "b", "the line itself counts");
});

test("the scroll start snaps to the first message", () => {
	const container = stubScrollport(document.createElement("div"), { scrollTop: 10 });
	assert.equal(resolveScrollActiveMessageId(container, fakeMessages({ a: -400, b: -200, c: 100 })), "a");
	assert.equal(resolveScrollActiveMessageId(container, []), null);
});

test("before any message crosses the line, the fallback decides", () => {
	const container = stubScrollport(document.createElement("div"), { scrollTop: 40 });
	const messages = fakeMessages({ a: 200, b: 400 });
	assert.equal(resolveScrollActiveMessageId(container, messages), null);
	assert.equal(resolveScrollActiveMessageId(container, messages, { fallback: "first" }), "a");
});

test("the scroll end snaps to the last message only when asked", () => {
	const container = stubScrollport(document.createElement("div"), { scrollTop: 1491 });
	const messages = fakeMessages({ a: -900, b: 0, c: 400 });
	assert.equal(resolveScrollActiveMessageId(container, messages), "b");
	assert.equal(resolveScrollActiveMessageId(container, messages, { snapToEnd: true }), "c");
	assert.equal(resolveScrollActiveMessageId(container, [], { snapToEnd: true }), null);
});

function buildRovoThread() {
	const container = stubScrollport(document.body.appendChild(document.createElement("div")), { scrollTop: 0 });
	const nodes = {};
	for (const [id, role] of [["u1", "user"], ["a1", "assistant"], ["u2", "user"]]) {
		const node = container.appendChild(document.createElement("div"));
		node.setAttribute("data-message-id", id);
		node.setAttribute("data-role", role);
		nodes[id] = node;
	}
	return { container, nodes };
}

test("RovoAppScrollActiveTracker reports the active user message on mount and on scroll, and stops on unmount", async () => {
	const { container, nodes } = buildRovoThread();
	stubTop(nodes.u1, 0);
	stubTop(nodes.a1, 60);
	stubTop(nodes.u2, 400);
	const reported = [];
	const view = await renderComponent({
		entry: "components/projects/rovo-core/components/rovo-app-scroll-sync.tsx",
		exportName: "RovoAppScrollActiveTracker",
		props: { onActiveChange: (id) => reported.push(id), scrollRef: { current: container } },
	});
	assert.deepEqual(reported, ["u1"], "resolved once on mount");

	container.scrollTop = 500;
	stubTop(nodes.u1, -500);
	stubTop(nodes.a1, 100);
	stubTop(nodes.u2, 300);
	container.dispatchEvent(new Event("scroll"));
	assert.deepEqual(reported, ["u1", "u1"], "an assistant message across the line never becomes active");

	stubTop(nodes.a1, -300);
	stubTop(nodes.u2, 100);
	container.dispatchEvent(new Event("scroll"));
	assert.deepEqual(reported, ["u1", "u1", "u2"]);

	await view.unmount();
	container.dispatchEvent(new Event("scroll"));
	assert.equal(reported.length, 3, "the scroll listener is removed on unmount");
});

test("RovoAppScrollActiveTracker reports null when no user message has crossed the line", async () => {
	const { container, nodes } = buildRovoThread();
	container.scrollTop = 40;
	stubTop(nodes.u1, 200);
	stubTop(nodes.a1, 260);
	stubTop(nodes.u2, 400);
	const reported = [];
	await renderComponent({
		entry: "components/projects/rovo-core/components/rovo-app-scroll-sync.tsx",
		exportName: "RovoAppScrollActiveTracker",
		props: { onActiveChange: (id) => reported.push(id), scrollRef: { current: container } },
	});
	assert.deepEqual(reported, [null]);
});

const HOOK_HARNESS = `
import { useRef } from "react";
import { useScrollActiveMessage } from "@/components/projects/shared/hooks/use-scroll-active-message";

export default function Harness({ container, getMessages, onActiveChange }) {
	const scrollRef = useRef(container);
	useScrollActiveMessage({ fallback: "first", getMessages, onActiveChange, scrollRef, snapToEnd: true });
	return null;
}
`;

test("a new getMessages re-resolves, so a thread that gains messages updates without a scroll", async () => {
	const container = stubScrollport(document.body.appendChild(document.createElement("div")), { scrollTop: 1500 });
	const reported = [];
	const onActiveChange = (id) => reported.push(id);
	const firstMessages = fakeMessages({ a: -900, b: 0 });
	const view = await renderComponent({
		props: { container, getMessages: () => firstMessages, onActiveChange },
		source: HOOK_HARNESS,
	});
	assert.deepEqual(reported, ["b"], "the scroll end snaps to the last message");

	const getFirstMessages = () => firstMessages;
	await view.rerender({ container, getMessages: getFirstMessages, onActiveChange });
	await view.rerender({ container, getMessages: getFirstMessages, onActiveChange });
	assert.deepEqual(reported, ["b", "b"], "a stable getMessages does not re-resolve on re-render");

	const nextMessages = fakeMessages({ a: -900, b: 0, c: 400 });
	await view.rerender({ container, getMessages: () => nextMessages, onActiveChange });
	assert.deepEqual(reported, ["b", "b", "c"]);
});
