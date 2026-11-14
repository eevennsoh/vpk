// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// Both hooks wired as the shells wire them, with the thread's messages, streaming flag, thread id
// and realtime generation state held locally and driven by buttons.
const PROBE = `import { useState } from "react";
	import { useRovoAppShellScrollAnchor, useRovoAppShellScrollFollow } from "@/components/projects/rovo-core/hooks/use-rovo-app-shell-scroll-anchor";
	const user = (id) => ({ id, role: "user", parts: [{ type: "text", text: "Question " + id }] });
	export default function Probe() {
		const [messages, setMessages] = useState([user("u1")]);
		const [isStreaming, setIsStreaming] = useState(false);
		const [runtimeThreadId, setRuntimeThreadId] = useState("thread-1");
		const [generationState, setGenerationState] = useState("idle");
		const [scrollActiveTimelineSelection, setScrollActiveTimelineSelection] = useState(null);
		const anchor = useRovoAppShellScrollAnchor();
		const follow = useRovoAppShellScrollFollow({
			anchor, displayMessages: messages, isStreaming, messages, realtimeGenerationState: generationState,
			runtimeThreadId, scrollActiveTimelineSelection, setScrollActiveTimelineSelection,
		});
		const submit = (source) => {
			anchor.queueTypedScrollAnchor(source, messages.at(-1).id);
			setIsStreaming(true);
			if (source === "realtime") { anchor.realtimeTypedResponseStartedRef.current = true; setGenerationState("generating"); }
			setMessages((current) => [...current, user("u" + (current.length + 1))]);
		};
		return <div>
			<p data-probe="follow">{anchor.scrollFollowMode + ":" + (anchor.scrollAnchorMessageId ?? "none")}</p>
			<p data-probe="timeline">{follow.activeTimelineMessageId ?? "none"}</p>
			<button type="button" onClick={() => submit("standard")}>typed submit</button>
			<button type="button" onClick={() => submit("realtime")}>voice submit</button>
			<button type="button" onClick={() => setIsStreaming(false)}>reply done</button>
			<button type="button" onClick={() => setGenerationState("complete")}>voice reply done</button>
			<button type="button" onClick={() => setRuntimeThreadId("thread-2")}>switch thread</button>
			<button type="button" onClick={() => follow.handleScrollActiveTimelineChange("u1")}>scroll to u1</button>
		</div>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

async function renderProbe() {
	const view = await renderComponent({ source: PROBE });
	return { press: (name) => view.click(view.getByRole("button", { name })) };
}

test("a typed turn anchors on its new user message, then follows the bottom when the reply finishes", async () => {
	const probe = await renderProbe();
	assert.equal(read("follow"), "bottom:none");
	await probe.press("typed submit");
	assert.equal(read("follow"), "target:u2", "anchored on the message the submit added");
	await probe.press("reply done");
	assert.equal(read("follow"), "bottom:none");
});

test("a voice turn stays anchored until the realtime reply completes", async () => {
	const probe = await renderProbe();
	await probe.press("voice submit");
	assert.equal(read("follow"), "target:u2");
	await probe.press("reply done");
	assert.equal(read("follow"), "target:u2", "a standard stream ending does not release a voice anchor");
	await probe.press("voice reply done");
	assert.equal(read("follow"), "bottom:none");
});

test("changing thread releases the anchor and the scrolled-to timeline item", async () => {
	const probe = await renderProbe();
	await probe.press("typed submit");
	await probe.press("scroll to u1");
	assert.equal(read("timeline"), "u1");
	await probe.press("switch thread");
	assert.deepEqual([read("follow"), read("timeline")], ["bottom:none", "u2"], "back to the latest item of the new thread");
});
