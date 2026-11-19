const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const VARIANTS = ["experimental-v2", "experimental-v3", "team-eu26"];
const ACTOR = { id: "reviewer", name: "Reviewer", kind: "person" };

function activityFixture() {
	return [
		{
			id: "opened", kind: "opened", actor: ACTOR, occurredAtMs: 100,
			timestamp: "3 minutes ago", headBranch: "feature/replies", baseBranch: "main",
		},
		{
			id: "review", kind: "review-submitted", actor: ACTOR, occurredAtMs: 200,
			timestamp: "2 minutes ago", decision: "commented", body: "Original review thread.",
			allowReply: true, allowResolve: true, resolved: false,
		},
		{
			id: "comment", kind: "comment-posted", actor: ACTOR, occurredAtMs: 300,
			timestamp: "1 minute ago", body: "Later provider comment.",
		},
	];
}

function harness(variant) {
	const root = `@/components/blocks/jira-work-item/${variant}`;
	const rail = variant === "experimental-v2";
	return `
import { useState } from "react";
import { JiraActivityViewControl } from "@/components/blocks/jira-activity";
import { ActivityChatCommentsProvider } from "${root}/context-activity-chat-comments";
import { PullRequestActivityPanel } from "${root}/components/pull-request-detail/pull-request-activity-panel";
${rail
		? `import { ActivityRailChromeProvider } from "${root}/components/activity-panel";`
		: `import { SectionNavigationProvider } from "${root}/context-section-navigation";`}

export default function Harness({ activity }) {
	const [chrome, setChrome] = useState(null);
	const panel = <PullRequestActivityPanel activity={activity} />;
	return (
		<ActivityChatCommentsProvider>
			${rail ? `<ActivityRailChromeProvider setChrome={setChrome}>
				{chrome ? <>
					<JiraActivityViewControl {...chrome} />
					<output aria-label="Rail activity count">{chrome.count}</output>
				</> : null}
				{panel}
			</ActivityRailChromeProvider>` : `<SectionNavigationProvider active={false}>
				{panel}
			</SectionNavigationProvider>`}
		</ActivityChatCommentsProvider>
	);
}
`;
}

async function selectView(view, current, choice) {
	const trigger = view.getByRole("button", { name: current });
	if (trigger.getAttribute("aria-expanded") !== "true") await view.click(trigger);
	await view.click(view.getByRole("menuitemradio", { name: choice }));
	await view.press(null, "Escape");
}

function commentOrder(view) {
	return [...view.container.querySelectorAll('[data-jira-activity-entry-kind="comment"]')]
		.map((node) => node.textContent).join("\n");
}

for (const variant of VARIANTS) {
	test(`${variant}: local replies and resolution survive equal activity; revisions reset entries and retain the view`, async () => {
		const activity = activityFixture();
		const view = await renderComponent({ source: harness(variant), props: { activity }, strictMode: true });

		await view.click(view.getByRole("button", { name: "Reply" }));
		await view.fill(view.getByRole("textbox", { name: "Leave a reply..." }), "Local reply survives.");
		await view.press(view.getByRole("textbox", { name: "Leave a reply..." }), "Enter");
		assert.equal(view.queryByText("Local reply survives.") !== null, true, "reply submitted through the UI");
		await view.click(view.getByRole("button", { name: "Resolve" }));
		assert.equal(view.queryByRole("button", { name: "Reopen" }) !== null, true, "thread resolved through the UI");

		await selectView(view, "Show oldest", "Latest");
		await selectView(view, "Show latest", "Comments");
		await view.rerender({ activity: structuredClone(activity) });
		const replyPresent = view.queryByText("Local reply survives.") !== null;
		const threadResolved = view.queryByRole("button", { name: "Reopen" }) !== null;
		assert.equal(`${replyPresent}:${threadResolved}`, "true:true", "equal-content rerender preserves the local reply and resolved thread");

		const revised = structuredClone(activity);
		revised[1].body = "Updated provider thread.";
		await view.rerender({ activity: revised });

		assert.equal(view.queryByText("Local reply survives.") === null, true, "a new revision discards local replies");
		assert.equal(view.queryByText(/Original review thread\./u) === null, true);
		assert.equal(view.queryByText(/Updated provider thread\./u) !== null, true);
		assert.equal(view.queryByRole("button", { name: "Resolve" }) !== null, true, "provider unresolved state replaces local resolution");
		assert.equal(view.queryByRole("button", { name: "Reopen" }) === null, true);
		assert.equal(view.queryByRole("button", { name: "Show comments" }) !== null, true, "the comments filter survives a revision");
		assert.equal(view.queryByText(/opened the pull request from/u) === null, true, "events remain filtered out");
		const ordered = commentOrder(view);
		assert.equal(ordered.includes("Later provider comment."), true);
		assert.equal(ordered.indexOf("Later provider comment.") < ordered.indexOf("Updated provider thread."), true, "the latest-first sort survives a revision");

		await view.click(view.getByRole("button", { name: "Reply" }));
		await view.fill(view.getByRole("textbox", { name: "Leave a reply..." }), "Reply on the new revision.");
		await view.press(view.getByRole("textbox", { name: "Leave a reply..." }), "Enter");
		assert.equal(view.queryByText("Reply on the new revision.") !== null, true);
		assert.equal(view.queryByText(/Updated provider thread\./u) !== null, true, "a reply after a revision change builds on the new entries");

		if (variant === "experimental-v2") {
			await selectView(view, "Show comments", "Latest");
			assert.equal(
				view.container.querySelector('output[aria-label="Rail activity count"]').textContent,
				String(view.container.querySelectorAll("[data-jira-activity-entry-id]").length),
				"rail chrome count matches the rendered entries with all activities shown",
			);
		}
	});
}
