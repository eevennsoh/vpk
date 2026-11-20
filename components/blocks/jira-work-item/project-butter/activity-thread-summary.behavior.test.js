const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderWorkItem() {
	return renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: {
			"@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
				export const useRovoChatControls = () => controls;
				export const useOptionalRovoChatControls = () => controls;
				export const useOptionalRovoChat = () => null;`,
		},
		props: { initialPreset: "filled", onClose() {}, open: true, sessionActivityView: true },
	});
}

test("reply actions select a target without staying pressed in either activity view", async () => {
	const view = await renderWorkItem();
	const feed = document.querySelector("[data-project-butter-activity-feed]");
	const thread = [...feed.querySelectorAll('[data-jira-activity-entry-id^="invocation-"]')].find((row) => row.querySelector('[aria-label="Replies"] button[aria-label="Reply"]'));
	const id = thread.dataset.jiraActivityEntryId;
	const parentReply = thread.querySelector('[data-slot="jira-activity-comment-header"] button[aria-label="Reply"]');
	await view.click(parentReply);
	assert.equal(parentReply.getAttribute("aria-pressed"), null);
	assert.equal(view.queryByRole("button", { name: "Remove reply target" }) !== null, true);
	const nestedReply = [...thread.querySelectorAll('[aria-label="Replies"] button[aria-label="Reply"]')].find((button) => !button.closest("[hidden]"));
	await view.click(nestedReply);
	assert.equal(nestedReply.getAttribute("aria-pressed"), null);
	assert.equal(view.queryByRole("button", { name: "Remove reply target" }) !== null, true);
	await view.click(view.getByRole("tab", { name: "Agent sessions" }));
	const otherActivity = view.getByRole("button", { name: "Other agent activity" });
	assert.equal(otherActivity.getAttribute("aria-expanded"), "false");
	await view.click(otherActivity);
	const sessionThread = [...document.querySelectorAll(`[data-jira-activity-entry-id="${id}"]`)].find((row) => !row.closest("[hidden]"));
	const sessionReply = sessionThread.querySelector('[data-slot="jira-activity-comment-header"] button[aria-label="Reply"]');
	await view.click(sessionReply);
	assert.equal(sessionReply.getAttribute("aria-pressed"), null);
	assert.equal(view.queryByRole("button", { name: "Remove reply target" }) !== null, true);
});

test("timeline summaries can be opened independently and restored", async () => {
	const view = await renderWorkItem();
	const feed = document.querySelector("[data-project-butter-activity-feed]");
	assert.equal(view.queryByRole("button", { name: "More comment actions" }) === null, true);
	const disclosure = [...feed.querySelectorAll("button")].find((button) => /Show \d+ more repl/u.test(button.textContent));
	assert.equal(Boolean(disclosure), true);
	await view.focus(disclosure);
	await view.press(disclosure, "Enter");
	assert.equal(disclosure.getAttribute("aria-expanded"), "true");
	assert.equal(disclosure.textContent.trim(), "Hide replies");
	await view.press(disclosure, "Enter");
	assert.equal(disclosure.getAttribute("aria-expanded"), "false");
	const actions = [...feed.querySelectorAll('button[aria-label="Summarize thread"]')];
	assert.equal(actions.length >= 2, true);
	const firstThread = actions[0].closest("li[data-jira-activity-entry-id]");
	const secondThread = actions[1].closest("li[data-jira-activity-entry-id]");
	await view.click(actions[0]);
	assert.equal(actions[0].getAttribute("aria-expanded"), "true");
	assert.equal(firstThread.textContent.includes("Thread summary"), true);
	assert.equal(firstThread.querySelector("[data-suggestion-text-reveal]") !== null, true);
	assert.equal(actions[1].getAttribute("aria-expanded"), "false");
	await view.click(actions[1]);
	assert.equal(actions[1].getAttribute("aria-expanded"), "true");
	assert.equal(secondThread.textContent.includes("Thread summary"), true);
	await view.click([...firstThread.querySelectorAll("button")].find((button) => button.textContent === "Show replies"));
	assert.equal(actions[0].getAttribute("aria-expanded"), "false");
	assert.equal(firstThread.querySelector("[data-suggestion-text-reveal]") === null, true);
	assert.equal(actions[1].getAttribute("aria-expanded"), "true");
	await view.click(actions[0]);
	assert.equal(firstThread.querySelector("[data-suggestion-text-reveal]") !== null, true);
	await view.click(view.getByRole("tab", { name: "Agent sessions" }));
	assert.equal(view.getAllByRole("button", { name: "Summarize thread" }).length > 0, true);
	assert.equal(view.queryByRole("button", { name: "More comment actions" }) === null, true);
});

test("the attributed pair finishes before later participants enter in order", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { useWorkItemThreadSummary } from "@/components/blocks/jira-work-item/project-butter/activity-thread-summary";
			const entry = { id: "sequence", kind: "comment", actor: { id: "agent", name: "Agent", kind: "agent" }, attributedBy: { name: "Venn" }, body: [], timestamp: "now", replies: [
				{ id: "one", actor: { id: "annie", name: "Annie", kind: "person" }, body: "One", timestamp: "now" },
				{ id: "two", actor: { id: "liam", name: "Liam", kind: "person" }, body: "Two", timestamp: "now" },
			] };
			export default function Sequence() {
				const summary = useWorkItemThreadSummary(entry);
				return <ThemeWrapper>{summary.renderAvatar(entry, null)}{summary.renderAction(entry.replies)}{summary.renderReplies(null, () => {}, { text: "Summary", fixtureReplyCount: 2 })}</ThemeWrapper>;
			}`,
		mocks: { "@/components/ui-custom/human-agent-avatar": `import React from "react"; export function HumanAgentAvatar({ onAnimationComplete }) { return <button data-pair-finished onClick={onAnimationComplete}>Finish pair</button>; }` },
	});
	const extras = () => [...document.querySelectorAll("[data-summary-avatar-stack] > span")];
	await view.click(view.getByRole("button", { name: "Summarize thread" }));
	assert.equal(extras().length, 2);
	assert.equal(extras().every((avatar) => avatar.classList.contains("opacity-0")), true);
	await view.click(document.querySelector("[data-pair-finished]"));
	assert.equal(extras().every((avatar) => avatar.classList.contains("opacity-100")), true);
	assert.deepEqual(extras().map((avatar) => avatar.style.transitionDelay), ["0s", "0.05s"]);
	await view.click(view.getByRole("button", { name: "Show replies" }));
	await view.click(view.getByRole("button", { name: "Summarize thread" }));
	assert.equal(extras().every((avatar) => avatar.classList.contains("opacity-0")), true);
});

test("pinning a session thread is shared between Timeline and Agent sessions", async () => {
	const view = await renderWorkItem();
	const feed = document.querySelector("[data-project-butter-activity-feed]");
	const thread = [...feed.querySelectorAll('[data-jira-activity-entry-id^="invocation-"]')].find((row) => row.querySelector("[data-jira-activity-replies-disclosure] button"));
	const id = thread.dataset.jiraActivityEntryId;
	const repliesGroup = () => thread.querySelector('[role="group"][aria-label="Replies"]');
	const visibleReplies = () => [...repliesGroup().children].filter((reply) => !reply.hidden).length;
	const replyDisclosure = () => thread.querySelector("[data-jira-activity-replies-disclosure] button");
	assert.equal(visibleReplies(), 1);
	await view.click(replyDisclosure());
	assert.equal(visibleReplies() > 1, true);
	const timelinePin = thread.querySelector('button[aria-label="Pin comment"]');
	await view.focus(timelinePin);
	await view.click(timelinePin);
	await new Promise((resolve) => requestAnimationFrame(resolve));
	assert.equal(feed.querySelector("[data-jira-activity-entry-id]").dataset.jiraActivityEntryId, id);
	assert.equal(feed.querySelectorAll(`[data-jira-activity-entry-id="${id}"]`).length, 1);
	assert.equal(thread.querySelector('button[aria-label="Unpin comment"]') !== null, true);
	assert.equal(view.isFocused(thread.querySelector('button[aria-label="Unpin comment"]')), true);
	assert.equal(visibleReplies(), 0);
	assert.match(replyDisclosure().lastElementChild.textContent, /^\d+ replies$/u);
	await view.click(replyDisclosure());
	assert.equal(visibleReplies() > 1, true);
	await view.click(replyDisclosure());
	assert.equal(visibleReplies(), 0);
	await view.click(view.getByRole("tab", { name: "Agent sessions" }));
	const sessionThread = [...document.querySelectorAll(`[data-jira-activity-entry-id="${id}"]`)].find((node) => !node.closest("[hidden]"));
	assert.equal(Boolean(sessionThread), true);
	assert.equal(sessionThread.querySelector('button[aria-label="Unpin comment"]') !== null, true);
	assert.equal(sessionThread.textContent.includes("Pinned"), true);
	await view.click(sessionThread.querySelector('button[aria-label="Unpin comment"]'));
	await new Promise((resolve) => requestAnimationFrame(resolve));
	assert.equal([...document.querySelectorAll(`[data-jira-activity-entry-id="${id}"]`)].filter((node) => !node.closest("[hidden]")).length, 1);
	const unpinnedSession = [...document.querySelectorAll(`[data-jira-activity-entry-id="${id}"]`)].find((node) => !node.closest("[hidden]"));
	const sessionPin = unpinnedSession.querySelector('button[aria-label="Pin comment"]');
	assert.equal(view.isFocused(sessionPin), true);
	await view.click(sessionPin);
	await view.click(view.getByRole("tab", { name: "Timeline" }));
	assert.equal(feed.querySelector(`[data-jira-activity-entry-id="${id}"] button[aria-label="Unpin comment"]`) !== null, true);
	await view.click(feed.querySelector(`[data-jira-activity-entry-id="${id}"] button[aria-label="Unpin comment"]`));
	assert.equal(feed.querySelector(`[data-jira-activity-entry-id="${id}"] button[aria-label="Pin comment"]`) !== null, true);
	assert.equal(visibleReplies(), 1);
});
