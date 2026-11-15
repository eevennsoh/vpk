// Assertions compare strings, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// regenerate reads the committed history through a ref, the way useChat does, so it only
// sees the edit if the hook defers it until after the edited messages have rendered.
const PROBE = `import { useEffect, useRef, useState } from "react";
	import { useRovoAppMessageEditActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-message-edit-actions";
	const text = (role, id, value) => ({ id, role, parts: [{ type: "text", text: value }] });
	const describe = (messages) => messages.map((message) => message.id + ":" + message.parts.map((part) => part.text).join("")).join(",");
	export default function Probe() {
		const [messages, setMessages] = useState([text("user", "u1", "hi"), text("assistant", "a1", "hello there")]);
		const committedRef = useRef(messages);
		useEffect(() => { committedRef.current = messages; }, [messages]);
		const [log, setLog] = useState([]);
		const record = (entry) => setLog((current) => [...current, entry]);
		const [editingMessageId, setEditingMessageId] = useState("u1");
		const { editMessage } = useRovoAppMessageEditActions({
			beginThreadHydration: () => record("begin"),
			completeThreadHydration: () => record("complete"),
			normalizedMessages: messages,
			regenerate: () => record("regenerate[" + describe(committedRef.current) + "]"),
			resetObservedTurnComplete: () => {},
			resetPendingArtifactAssociation: () => {},
			setEditingMessageId,
			setMessages,
		});
		return <div>
			<p data-probe="messages">{describe(messages)}</p>
			<p data-probe="log">{log.join(" ")}</p>
			<p data-probe="editing">{editingMessageId ?? "none"}</p>
			<button type="button" onClick={() => { void editMessage("u1", "  howdy  "); }}>edit</button>
		</div>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

test("editing replaces the history, then regenerates against the edited history", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "edit" }));
	assert.equal(read("messages"), "u1:howdy", "later turns are dropped and the text is trimmed");
	assert.equal(read("editing"), "none");
	await React.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
	assert.equal(read("log"), "begin complete regenerate[u1:howdy]");
});
