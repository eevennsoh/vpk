const assert = require("node:assert/strict");
const { test } = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const HARNESS = `import { useMemo, useRef } from "react";
import { useSessionMentionFlight } from "@/components/blocks/jira-at-mention";
export default function Harness({ active = true, composerVisible = true, composerHeight = 112, editorReady = true, requestId = 1, withSource = true, onScroll, onSettled, onTrace }) {
	const body = useRef(null);
	const scrollport = useRef(null);
	const request = useMemo(() => {
		const chip = document.createElement("span"); chip.textContent = "Claude";
		return { id: requestId, entryId: "session", source: withSource ? { chip, rect: new DOMRect(500, 650, 124, 24) } : null };
	}, [requestId, withSource]);
	const flight = useSessionMentionFlight(body, request, active, onTrace, onSettled);
	return <div style={{ overflowY: "auto" }} ref={(node) => {
		if (!node) return;
		scrollport.current = node;
		Object.defineProperties(node, { clientHeight: { configurable: true, value: 700 }, scrollHeight: { configurable: true, value: 1800 } });
		node.getBoundingClientRect = () => new DOMRect(0, 0, 900, 700);
		node.scrollTo = ({ top, behavior }) => { node.scrollTop = top; onScroll({ top, behavior }); };
	}}><div ref={body}>
		{flight}
		<div data-project-butter-activity-header ref={(node) => { if (node) node.getBoundingClientRect = () => new DOMRect(0, 0, 900, 64); }} />
		<div data-jira-activity-entry-id="session">
			{composerVisible ? <div data-project-butter-comment-editor ref={(node) => { if (node) node.getBoundingClientRect = () => new DOMRect(100, 700 - (scrollport.current?.scrollTop ?? 0), 600, composerHeight); }}>
				{editorReady ? <div contentEditable suppressContentEditableWarning ref={(node) => { if (node) node.getBoundingClientRect = () => new DOMRect(100, 712 - (scrollport.current?.scrollTop ?? 0), 580, composerHeight - 40); }}>
					<span className="rich-text-mention-chip" ref={(node) => { if (node) node.getBoundingClientRect = () => new DOMRect(100, 712 - (scrollport.current?.scrollTop ?? 0), 124, 24); }}>Claude</span>
				</div> : null}
			</div> : null}
		</div>
		<div data-project-butter-comment-bar ref={(node) => { if (node) node.getBoundingClientRect = () => new DOMRect(0, 620, 900, 80); }} />
	</div></div>;
}`;

function controlFrames(t, reduced) {
	const previousMatch = window.matchMedia;
	const previousRequest = globalThis.requestAnimationFrame;
	const previousCancel = globalThis.cancelAnimationFrame;
	const frames = new Map();
	let nextId = 0;
	window.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
	globalThis.requestAnimationFrame = (callback) => { frames.set(++nextId, callback); return nextId; };
	globalThis.cancelAnimationFrame = (id) => frames.delete(id);
	t.after(() => {
		window.matchMedia = previousMatch;
		globalThis.requestAnimationFrame = previousRequest;
		globalThis.cancelAnimationFrame = previousCancel;
	});
	return frames;
}

async function advanceFrame(frames) {
	const next = frames.entries().next().value;
	assert.ok(next, "a preparation frame should be pending");
	frames.delete(next[0]);
	await act(() => next[1](performance.now()));
}

for (const [label, reduced, withSource] of [["reduced motion", true, true], ["a missing source clone", false, false]]) {
	test(`${label} reveals the reply instantly before reporting completion`, async (t) => {
		const frames = controlFrames(t, reduced);
		const scrolls = [];
		const completions = [];
		let traces = 0;
		const view = await renderComponent({ source: HARNESS, props: {
			withSource,
			onScroll: (scroll) => scrolls.push(scroll),
			onTrace: () => { traces++; },
			onSettled: (id, reason) => completions.push({ id, reason, bottom: document.querySelector("[data-project-butter-comment-editor]").getBoundingClientRect().bottom }),
		} });
		assert.deepEqual(completions, []);
		assert.deepEqual(scrolls, []);
		await advanceFrame(frames);
		await advanceFrame(frames);
		assert.deepEqual(scrolls, [{ top: 204, behavior: "instant" }]);
		assert.deepEqual(completions, [{ id: 1, reason: "landed", bottom: 608 }]);
		assert.equal(traces, 0);
		assert.equal(document.querySelector("[data-project-butter-mention-flight]") === null, true);
		await view.unmount();
	});

	test(`${label} waits for the editor and a stable grown draft before measuring reveal`, async (t) => {
		const frames = controlFrames(t, reduced);
		const scrolls = [];
		const completions = [];
		const props = { withSource, onScroll: (scroll) => scrolls.push(scroll), onTrace() {}, onSettled: (id, reason) => completions.push({ id, reason, bottom: document.querySelector("[data-project-butter-comment-editor]").getBoundingClientRect().bottom }) };
		const view = await renderComponent({ source: HARNESS, props: { ...props, editorReady: false, composerHeight: 72 } });
		await advanceFrame(frames);
		assert.deepEqual(completions, []);
		await view.rerender({ ...props, composerHeight: 72 });
		await advanceFrame(frames);
		await view.rerender({ ...props, composerHeight: 220 });
		await advanceFrame(frames);
		await advanceFrame(frames);
		assert.deepEqual(completions, []);
		assert.deepEqual(scrolls, []);
		await advanceFrame(frames);
		assert.deepEqual(scrolls, [{ top: 312, behavior: "instant" }]);
		assert.deepEqual(completions, [{ id: 1, reason: "landed", bottom: 608 }]);
		await view.unmount();
	});
}

test("normal motion displays its source clone in the first commit and an interrupted request cannot replay", async (t) => {
	const frames = controlFrames(t, false);
	const completions = [];
	const props = { onScroll() {}, onTrace() {}, onSettled: (id, reason) => completions.push({ id, reason }) };
	const view = await renderComponent({ source: HARNESS, props });
	const clone = document.querySelector("[data-project-butter-mention-flight]");
	assert.equal(clone?.textContent, "Claude");
	assert.equal(clone?.dataset.flightPhase, "preparing");
	assert.equal(clone?.style.transform, "translate3d(500px, 650px, 0)");
	assert.equal(frames.size > 0, true);
	assert.deepEqual(completions, []);
	await view.rerender({ ...props, active: false });
	assert.deepEqual(completions, [{ id: 1, reason: "interrupted" }]);
	await view.rerender(props);
	assert.equal(document.querySelector("[data-project-butter-mention-flight]") === null, true);
	assert.equal(frames.size, 0);
	assert.equal(completions.length, 1);
	await view.unmount();
});

test("a replacement request owns exactly one clone and cannot receive stale completion", async (t) => {
	controlFrames(t, false);
	const completions = [];
	const props = { onScroll() {}, onTrace() {}, onSettled: (id, reason) => completions.push({ id, reason }) };
	const view = await renderComponent({ source: HARNESS, props });
	await view.rerender({ ...props, requestId: 2 });
	assert.equal(document.querySelectorAll("[data-project-butter-mention-flight]").length, 1);
	assert.equal(document.querySelector("[data-project-butter-mention-flight]")?.textContent, "Claude");
	assert.deepEqual(completions, []);
	await view.rerender({ ...props, active: false, requestId: 2 });
	assert.deepEqual(completions, [{ id: 2, reason: "interrupted" }]);
	await view.unmount();
});
