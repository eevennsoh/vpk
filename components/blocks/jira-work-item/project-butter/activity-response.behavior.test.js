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

test("a session start is the agent's own comment with an inline session chip", async () => {
	await renderActivity();
	const start = document.querySelector('[data-project-butter-session-start="butter-scoping"]');
	const copy = start.textContent.replace(/\s+/gu, " ").trim();
	assert.equal(copy.startsWith("I started a session "), true);
	assert.equal(copy.endsWith("Troubleshoot 403 API errors and I am looking into it. I'll work on Troubleshoot 403 API errors and report back here with updates as I make progress."), true);
	const thread = start.closest("[data-jira-activity-entry-id]");
	assert.equal(thread.dataset.jiraActivityEntryId, "invocation-butter-scoping");
	assert.equal(thread.textContent.includes("Jira Scoping agent"), true);
	// The invoker's "added" row sits on the rail, alone or folded into an adjacent update summary.
	const feed = document.querySelector("[data-project-butter-activity-feed]").textContent.replace(/\s+/gu, " ");
	assert.equal(feed.includes("Annie Cook added Jira Scoping agent") || /updates: added Jira Scoping agent/u.test(feed), true);
	assert.equal(thread.querySelector("[data-jira-activity-agent-mention]") === null, true, "the invoker no longer at-mentions the agent");
});

test("a running session chip opens chat with the keyboard", async () => {
	const opened = [];
	const view = await renderActivity({ onOpen: (id) => opened.push(id) });
	const chip = view.getByRole("button", { name: "Open Jira Scoping agent chat" });
	assert.equal(chip.closest("[data-project-butter-session-start]") !== null, true);
	assert.equal(chip.textContent.includes("Troubleshoot 403 API errors"), true);
	const thread = document.querySelector('[data-jira-activity-entry-id="invocation-butter-scoping"]');
	assert.equal(thread.querySelector('[aria-label="Replies"]') === null, true, "a running session without messages has no replies yet");
	await view.press(chip, "Enter");
	assert.deepEqual(opened, ["butter-scoping"]);
});

test("the session chip follows live session state", async () => {
	const opened = [];
	const onOpen = (id) => opened.push(id);
	const view = await renderActivity({ onOpen });
	await view.rerender({ state: "needs-input", onOpen });
	await view.click(view.getByRole("button", { name: "Needs input, open Jira Scoping agent chat" }));
	await view.rerender({ state: "complete", onOpen });
	await view.click(view.getByRole("button", { name: "Finished, open Jira Scoping agent chat" }));
	assert.deepEqual(opened, ["butter-scoping", "butter-scoping"]);
});

test("a seeded session thread shows its latest reply behind Show N more replies", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { PROJECT_BUTTER_SESSIONS } from "@/components/blocks/jira-work-item/project-butter/data";
			const sessions = PROJECT_BUTTER_SESSIONS.filter((session) => session.id === "butter-cursor-forecast");
			export default function CursorProbe() {
				const content = useProjectButterContent("filled", undefined, sessions);
				return <ThemeWrapper><ProjectButterActivity content={content} onOpenSession={() => {}} sessions={sessions} sidePanel={false} /></ThemeWrapper>;
			}`,
	});
	const thread = document.querySelector('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
	const toggle = view.getByRole("button", { name: /Show 4 more replies/u });
	assert.equal(toggle.getAttribute("aria-expanded"), "false");
	const shown = () => [...thread.querySelectorAll('[aria-label="Replies"] > div')].filter((node) => !node.hidden).map((node) => node.textContent);
	assert.equal(shown().length, 1);
	assert.equal(shown()[0].includes("Which revenue line should we keep?"), true);
	await view.click(toggle);
	assert.equal(shown().length, 5);
	assert.equal(view.getByRole("button", { name: "Hide replies" }).getAttribute("aria-expanded"), "true");
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

// Regression: "Canva with Sarah Lim" rendered "CW" because unbranded agents only carried a Rovo
// `vpkLogo`, which the shared avatar ignores for non-Rovo agents. Every agent needs real art.
test("every reference agent has a brand mark or agent art, never initials", async () => {
	await renderComponent({
		source: `import React from "react";
			import { referenceActivityEntries } from "@/components/blocks/jira-work-item/project-butter/reference-activity";
			const actors = referenceActivityEntries().flatMap((entry) => [entry.actor, ...(entry.kind === "comment" ? (entry.replies ?? []).map((reply) => reply.actor) : [])]);
			export default function ActorProbe() { return <ul>{actors.filter((actor) => actor.kind === "agent").map((actor, index) => <li data-art={actor.brandName ?? actor.avatarSrc ?? ""} key={index}>{actor.name}</li>)}</ul>; }`,
	});
	const agents = [...document.querySelectorAll("li")].map((node) => [node.textContent, node.dataset.art]);
	assert.equal(agents.some(([name, art]) => name === "Canva with Sarah Lim" && art === "canva"), true);
	assert.deepEqual(agents.filter(([, art]) => !art), []);
});

test("pinning a comment from its header lifts it to the top of the feed until it is unpinned", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			export default function PinProbe() {
				const content = useProjectButterContent("filled", undefined, []);
				return <ThemeWrapper><ProjectButterActivity content={content} onOpenSession={() => {}} sessions={[]} sidePanel={false} /></ThemeWrapper>;
			}`,
	});
	const rows = () => [...document.querySelectorAll("[data-jira-activity-entry-id]")].filter((node) => !node.parentElement.closest("[data-jira-activity-entry-id]"));
	const comments = () => rows().filter((node) => node.querySelector('button[aria-label="Pin comment"], button[aria-label="Unpin comment"]'));
	const target = comments().at(-1);
	const id = target.dataset.jiraActivityEntryId;
	assert.notEqual(rows()[0].dataset.jiraActivityEntryId, id, "the probe pins a comment that does not already lead the feed");
	const pin = target.querySelector('button[aria-label="Pin comment"]');
	assert.equal(pin.getAttribute("aria-pressed"), "false");
	await view.click(pin);
	const lead = rows()[0];
	assert.equal(lead.dataset.jiraActivityEntryId, id);
	assert.equal(lead.textContent.includes("Pinned"), true);
	assert.equal(lead.querySelector('button[aria-label="Unpin comment"]').getAttribute("aria-pressed"), "true");
	await view.click(lead.querySelector('button[aria-label="Unpin comment"]'));
	assert.notEqual(rows()[0].dataset.jiraActivityEntryId, id);
	assert.equal(comments().some((node) => node.dataset.jiraActivityEntryId === id && !node.textContent.includes("Pinned")), true);
});

test("Reply opens the work item's own comment box with the reply placeholder", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			export default function ReplyProbe() {
				const content = useProjectButterContent("filled", undefined, []);
				return <ThemeWrapper><ProjectButterActivity content={content} onOpenSession={() => {}} sessions={[]} sidePanel={false} /></ThemeWrapper>;
			}`,
	});
	assert.equal(document.querySelector('[aria-label="Reply editor"]'), null);
	await view.click(view.getAllByRole("button", { name: "Reply" })[0]);
	const reply = document.querySelector('form[aria-label="Reply editor"]');
	assert.equal(reply?.hasAttribute("data-project-butter-comment-editor"), true, "replies reuse the comment box");
	assert.equal(reply.querySelector(".rich-text-editor-content").style.getPropertyValue("--rich-text-placeholder"), '"Leave a reply..."');
	assert.deepEqual([...reply.querySelectorAll("button")].map((button) => button.getAttribute("aria-label")), ["Mention an agent or person", "Start dictation", "Submit"]);
});
