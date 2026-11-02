const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

async function renderActivity(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { PROJECT_BUTTER_SESSIONS } from "@/components/blocks/jira-work-item/project-butter/data";
			const initialSessions = [PROJECT_BUTTER_SESSIONS[1]];
			export default function ActivityProbe({ state = "running", onOpen }) {
				const content = useProjectButterContent("filled", undefined, initialSessions);
				return <ThemeWrapper><ProjectButterActivity content={content} onOpenSession={onOpen} sessions={[{ ...initialSessions[0], state }]} sidePanel={false} /></ThemeWrapper>;
			}`,
		props: { onOpen() {}, ...props },
	});
}

test("invocation names both agents with the canonical at-mention Tag", async () => {
	await renderActivity();
	const tags = [...document.querySelectorAll('[data-jira-activity-agent-mention]')];
	assert.deepEqual(tags.map((tag) => tag.querySelector("[data-tag-text]").textContent), ["Jira Scoping agent", "Jira Coding agent"]);
	assert.equal(tags.every((tag) => tag.dataset.slot === "tag" && tag.dataset.type === "agent"), true);
});

test("running agent reply is a compact status row that opens chat with the keyboard", async () => {
	const opened = [];
	const view = await renderActivity({ onOpen: (id) => opened.push(id) });
	const response = document.querySelector('[data-project-butter-agent-response="butter-scoping"]');
	assert.equal(Boolean(response), true);
	assert.equal(response.closest('[aria-label="Replies"]').textContent.includes("Jira Scoping agent"), false);
	assert.equal(view.getByRole("button", { name: "Open Jira Scoping agent chat" }).textContent.trim(), "Working");
	assert.equal(response.querySelector('[aria-label="Jira Scoping agent, used by Annie Cook"]') !== null, true);
	await view.press(view.getByRole("button", { name: "Open Jira Scoping agent chat" }), "Enter");
	assert.deepEqual(opened, ["butter-scoping"]);
});

test("compact agent reply follows live session state without restoring the session header", async () => {
	const opened = [];
	const onOpen = (id) => opened.push(id);
	const view = await renderActivity({ onOpen });
	await view.rerender({ state: "needs-input", onOpen });
	await view.click(view.getByRole("button", { name: "Needs input, open Jira Scoping agent chat" }));
	await view.rerender({ state: "complete", onOpen });
	await view.click(view.getByRole("button", { name: "Finished, open Jira Scoping agent chat" }));
	assert.deepEqual(opened, ["butter-scoping", "butter-scoping"]);
	assert.equal(view.getByRole("button", { name: "Finished, open Jira Scoping agent chat" }).textContent.trim(), "Finished");
});

test("shared Activity still renders ordinary reply cards when no reply replacement is provided", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { JiraActivity } from "@/components/blocks/jira-activity";
			const entry = { id: "parent", kind: "comment", actor: { id: "author", name: "Author", kind: "person" }, body: [{ type: "text", text: "Parent comment" }], timestamp: "Today", replies: [{ id: "reply", actor: { id: "responder", name: "Responder", kind: "person" }, timestamp: "Yesterday", body: "Ordinary reply" }] };
			export default function ReplyProbe({ replace = false }) { return <ThemeWrapper><JiraActivity composer={null} entries={[entry]} hideHeader renderReply={replace ? () => <p>Custom reply row</p> : undefined} /></ThemeWrapper>; }`,
	});
	assert.equal(view.queryByText("Ordinary reply") !== null, true);
	await view.rerender({ replace: true });
	assert.equal(view.queryByText("Ordinary reply") === null, true);
	assert.equal(view.queryByText("Custom reply row") !== null, true);
	await view.rerender({ replace: false });
	assert.equal(view.queryByText("Ordinary reply") !== null, true);
});
