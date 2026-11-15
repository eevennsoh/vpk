// Assertions compare strings, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const PROBE = `import { useState } from "react";
	import { useRovoAppUserMessageActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-user-message-actions";
	const textOf = (message) => message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
	export default function Probe() {
		const [messages, setMessages] = useState([]);
		const { appendLocalUserMessage } = useRovoAppUserMessageActions({ setMessages });
		return <div>
			<p data-probe="messages">{messages.map(textOf).join(",")}</p>
			<p data-probe="roles">{messages.map((message) => message.role).join(",")}</p>
			<button type="button" onClick={() => {
				appendLocalUserMessage({ files: [], text: "first" });
				appendLocalUserMessage({ files: [], text: "second" });
			}}>append twice</button>
		</div>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

test("two appends in one handler both land as user messages", async () => {
	const view = await renderComponent({ source: PROBE });
	// The second append must build on the first through the state updater, not the rendered list.
	await view.click(view.getByRole("button", { name: "append twice" }));
	assert.equal(read("messages"), "first,second");
	assert.equal(read("roles"), "user,user");
});
