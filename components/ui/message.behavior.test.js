// Message action presets: accessible names, vote toggling, and copy-to-clipboard.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { useState } from "react";
import {
	Message,
	MessageActions,
	MessageContent,
	MessageCopyAction,
	MessageEditAction,
	MessageRegenerateAction,
	MessageVoteActions,
} from "@/components/ui/message";

export default function Probe() {
	const [vote, setVote] = useState(null);
	return (
		<Message>
			<MessageContent>
				<p>Reply</p>
				<MessageActions reveal="hover">
					<MessageCopyAction text="Reply text" />
					<MessageVoteActions value={vote} onVote={setVote} />
					<MessageEditAction />
					<MessageRegenerateAction />
				</MessageActions>
				<output>{String(vote)}</output>
			</MessageContent>
		</Message>
	);
}
`;

test("preset actions are named buttons reachable by Tab, even when revealed on hover", async () => {
	const view = await renderComponent({ source: PROBE });
	assert.deepEqual(view.tabOrder(), ["Copy", "Like", "Dislike", "Edit", "Regenerate"]);
	await view.unmount();
});

test("vote actions toggle aria-pressed and report the next vote", async () => {
	const view = await renderComponent({ source: PROBE });
	const like = view.getByRole("button", { name: "Like" });
	assert.equal(like.getAttribute("aria-pressed"), "false");
	await view.click(like);
	assert.equal(view.getByRole("button", { name: "Like" }).getAttribute("aria-pressed"), "true");
	assert.equal(view.container.querySelector("output").textContent, "up");
	await view.click(view.getByRole("button", { name: "Like" }));
	assert.equal(view.container.querySelector("output").textContent, "null");
	await view.unmount();
});

test("copy writes the message text to the clipboard", async () => {
	const writes = [];
	Object.defineProperty(globalThis.navigator, "clipboard", {
		configurable: true,
		value: { writeText: async (text) => writes.push(text) },
	});
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "Copy" }));
	assert.deepEqual(writes, ["Reply text"]);
	await view.unmount();
});
