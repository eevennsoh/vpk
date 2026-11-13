const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

async function renderActivity(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { PROJECT_BUTTER_SESSIONS } from "@/components/blocks/jira-work-item/project-butter/data";
			const initialSessions = [PROJECT_BUTTER_SESSIONS[1]];
			export default function ActivityProbe({ state = "running", onOpen, owner = false }) {
				const content = useProjectButterContent("filled", undefined, initialSessions);
				return <ThemeWrapper><ProjectButterActivity content={content} onOpenSession={onOpen} sessions={[{ ...initialSessions[0], state, role: owner ? "owner" : "viewer" }]} sidePanel={false} /></ThemeWrapper>;
			}`,
		props: { onOpen() {}, ...props },
	});
}

test("saved replies render agent mentions alongside their message", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ProjectButterReferenceCommentBody } from "@/components/blocks/jira-work-item/project-butter/reference-activity-body";
			export default function ReplyProbe() {
				return <ProjectButterReferenceCommentBody agents={[{ id: "claude", name: "Claude", brandName: "claude" }]} markdown="@[subagent:claude] adfadsf" />;
			}`,
	});
	assert.equal(view.container.textContent.includes("@[subagent:claude]"), false);
	assert.equal(view.container.querySelector("[data-jira-activity-agent-mention]")?.textContent, "Claude");
	assert.equal(view.container.textContent.includes("adfadsf"), true);
});

test("saved mentions resolve when the agent roster arrives after the reply", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ProjectButterReferenceCommentBody } from "@/components/blocks/jira-work-item/project-butter/reference-activity-body";
			export default function ReplyProbe() {
				const [loaded, setLoaded] = React.useState(false);
				return <><button onClick={() => setLoaded(true)}>Load agents</button><ProjectButterReferenceCommentBody agents={loaded ? [{ id: "claude", name: "Claude", brandName: "claude" }] : []} markdown="@[subagent:claude] adfadsf" /></>;
			}`,
	});
	await view.click(view.getByRole("button", { name: "Load agents" }));
	assert.equal(view.container.querySelector("[data-jira-activity-agent-mention]")?.textContent, "Claude");
});

test("session choices belong to Venn while Annie's sessions stay private", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
			import { ProjectButterSessionStart } from "@/components/blocks/jira-work-item/project-butter/activity-session-start";
			import { PROJECT_BUTTER_SESSIONS } from "@/components/blocks/jira-work-item/project-butter/data";
			const sessions = matchingAgentSessions({ id: "claude", name: "Claude" }, PROJECT_BUTTER_SESSIONS, { includeCompleted: true });
			export default function OwnershipProbe() {
				return <ThemeWrapper><output>{sessions.map((session) => session.invokedBy.name + ": " + session.title).join(" | ")}</output>{PROJECT_BUTTER_SESSIONS.filter((session) => session.id === "butter-cursor-forecast" || session.id === "butter-claude-onboarding-feedback").map((session) => <ProjectButterSessionStart key={session.id} session={session} onOpen={() => {}} />)}</ThemeWrapper>;
			}`,
	});
	assert.equal(view.getByText(/Venn: Summarize onboarding feedback/u).textContent, "Venn: Summarize onboarding feedback | Venn: Rewrite the incident postmortem");
	const annie = view.getByRole("listitem", { name: /^Compare the Q3 revenue forecast/u });
	assert.equal(annie.querySelector('button[aria-label^="Compare the Q3 revenue forecast"]'), null);
	assert.equal(annie.querySelector('[data-slot="tooltip-trigger"]') !== null, true);
	const venn = view.getByRole("button", { name: /^Summarize onboarding feedback/u });
	assert.equal(venn.getAttribute("aria-describedby"), null);
});

test("a session start presents the long-form agent session card in its thread", async () => {
	await renderActivity();
	const start = document.querySelector('[data-project-butter-session-start="butter-scoping"]');
	assert.equal(start.textContent.includes("Troubleshoot 403 API errors"), true);
	assert.equal(start.textContent.includes("Working"), true);
	assert.equal(start.querySelector('[data-testid="agent-session-row-butter-scoping"]') !== null, true);
	const thread = start.closest("[data-jira-activity-entry-id]");
	assert.equal(thread.dataset.jiraActivityEntryId, "invocation-butter-scoping");
	assert.equal(thread.querySelector('[data-slot="jira-activity-comment-header"]').textContent.includes("Annie Cook added Jira Scoping agent"), true);
	assert.equal(start.querySelector('[data-slot="tooltip-trigger"]') !== null, true);
	const identity = thread.firstElementChild.querySelector('[data-slot="human-agent-avatar"]');
	assert.equal(identity?.getAttribute("aria-label"), "Jira Scoping agent, used by Annie Cook");
	assert.equal(identity?.querySelector('[data-avatar-role="human"]') !== null, true);
	assert.equal(identity?.querySelector('[data-avatar-role="agent"]') !== null, true);
	assert.equal(document.querySelector('[data-jira-activity-entry-id="agent-added-butter-scoping"]') === null, true);
	assert.equal(thread.querySelector("[data-jira-activity-agent-mention]") === null, true, "the invoker no longer at-mentions the agent");
});

test("a running session card opens chat with the keyboard", async () => {
	const opened = [];
	const view = await renderActivity({ onOpen: (id) => opened.push(id), owner: true });
	const card = view.getByRole("button", { name: /^Troubleshoot 403 API errors/u });
	assert.equal(card.getAttribute("aria-describedby"), null);
	assert.equal(card.closest("[data-project-butter-session-start]") !== null, true);
	assert.equal(card.textContent.includes("Troubleshoot 403 API errors"), true);
	const thread = document.querySelector('[data-jira-activity-entry-id="invocation-butter-scoping"]');
	assert.equal(thread.querySelector('[aria-label="Replies"]') === null, true, "a running session without messages has no replies yet");
	await view.press(card, "Enter");
	assert.deepEqual(opened, ["butter-scoping"]);
});

test("the session card follows live session state", async () => {
	const opened = [];
	const onOpen = (id) => opened.push(id);
	const view = await renderActivity({ onOpen, owner: true });
	await view.rerender({ state: "needs-input", onOpen, owner: true });
	assert.equal(document.querySelector('[data-project-butter-session-start="butter-scoping"] button[aria-label="Needs input"]') !== null, true);
	await view.click(view.getByRole("button", { name: /^Troubleshoot 403 API errors/u }));
	await view.rerender({ state: "complete", onOpen, owner: true });
	assert.equal(document.querySelector('[data-project-butter-session-start="butter-scoping"] button[aria-label="Finished"]') !== null, true);
	await view.click(view.getByRole("button", { name: /^Troubleshoot 403 API errors/u }));
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
	assert.equal(thread.firstElementChild.querySelector('[data-slot="human-agent-avatar"]')?.getAttribute("aria-label"), "Cursor, used by Annie Cook");
	const replyIdentity = thread.querySelector('[aria-label="Replies"] [data-slot="human-agent-avatar"]');
	assert.equal(replyIdentity?.getAttribute("aria-label"), "Cursor, used by Annie Cook");
	assert.equal(replyIdentity?.querySelector('[data-avatar-role="human"]') !== null, true);
	assert.equal(replyIdentity?.querySelector('[data-avatar-role="agent"]') !== null, true);
	const toggle = view.getByRole("button", { name: /Show 4 more replies/u });
	assert.equal(toggle.getAttribute("aria-expanded"), "false");
	const shown = () => [...thread.querySelectorAll('[aria-label="Replies"] > div')].filter((node) => !node.hidden).map((node) => node.textContent);
	assert.equal(shown().length, 1);
	assert.equal(shown()[0].includes("Which revenue line should we keep?"), true);
	await view.click(toggle);
	assert.equal(shown().length, 5);
	const humanReplies = [...thread.querySelectorAll('[aria-label="Replies"] > div')].filter((node) => node.querySelector('[data-slot="jira-activity-comment-header"]')?.textContent.includes("Annie Cook"));
	assert.equal(humanReplies.length > 0, true);
	assert.equal(humanReplies.every((node) => node.querySelector('[data-slot="human-agent-avatar"]') === null), true);
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

test("agent reply attribution applies only to the agent that owns the session", async () => {
	await renderComponent({
		source: `import React from "react";
			import { JiraActivity } from "@/components/blocks/jira-activity";
			const agent = { id: "agent-a", name: "Agent A", kind: "agent" };
			const entry = { id: "parent", kind: "comment", actor: agent, attributedBy: { name: "Annie" }, body: [{ type: "text", text: "Parent" }], timestamp: "Today", replies: [
				{ id: "same", actor: agent, timestamp: "Today", body: "Same agent" },
				{ id: "other", actor: { id: "agent-b", name: "Agent B", kind: "agent" }, timestamp: "Today", body: "Other agent" },
			] };
			export default function ReplyAttributionProbe() { return <JiraActivity composer={null} entries={[entry]} hideHeader />; }`,
	});
	const replies = [...document.querySelectorAll('[aria-label="Replies"] > div')];
	assert.equal(replies[0].querySelector('[data-slot="human-agent-avatar"]')?.getAttribute("aria-label"), "Agent A, used by Annie");
	assert.equal(replies[1].querySelector('[data-slot="human-agent-avatar"]'), null);
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
	// Regression (PR review): replying while pinned writes the row back to state; the transient tag must not persist.
	await view.click([...lead.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "Reply" || button.textContent === "Reply"));
	await view.fill(view.getByRole("textbox", { name: "Leave a reply..." }), "Reply while pinned");
	await view.click(lead.querySelector('form[aria-label="Reply editor"] button[aria-label="Submit"]'));
	assert.equal(rows()[0].textContent.includes("Reply while pinned"), true);
	assert.equal(rows()[0].textContent.includes("👀"), false);
	await view.click(rows()[0].querySelector('button[aria-label="Unpin comment"]'));
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

test("an agent reacts after the reply appears, even if the activity view remounts", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { PROJECT_BUTTER_SESSIONS } from "@/components/blocks/jira-work-item/project-butter/data";
			const sessions = PROJECT_BUTTER_SESSIONS.filter((session) => session.id === "butter-claude-onboarding-feedback");
			export default function ReplyProbe() {
				const content = useProjectButterContent("filled", undefined, sessions);
				const [visible, setVisible] = React.useState(true);
				return <ThemeWrapper><button onClick={() => setVisible((current) => !current)}>Toggle activity</button>{visible ? <ProjectButterActivity content={content} onOpenSession={() => {}} sessions={sessions} sidePanel={false} /> : null}</ThemeWrapper>;
			}`,
	});
	const thread = document.querySelector('[data-jira-activity-entry-id="invocation-butter-claude-onboarding-feedback"]');
	await view.click([...thread.querySelectorAll('[aria-label="Replies"] button[aria-label="Reply"]')].at(-1));
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
	await view.click(thread.querySelector('form[aria-label="Reply editor"] button[aria-label="Submit"]'));
	let reply = [...thread.querySelectorAll('[aria-label="Replies"] > div')].at(-1);
	assert.equal(reply.textContent.includes("@[subagent:claude]"), false);
	assert.equal(reply.querySelector('[data-jira-activity-agent-mention]')?.textContent.includes("Claude"), true);
	assert.equal(reply.textContent.includes("👀"), false);
	await view.click(view.getByRole("button", { name: "Toggle activity" }));
	await view.click(view.getByRole("button", { name: "Toggle activity" }));
	const deadline = Date.now() + 10000;
	do {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
		reply = [...document.querySelectorAll('[data-jira-activity-entry-id="invocation-butter-claude-onboarding-feedback"] [aria-label="Replies"] > div')].at(-1);
	} while (!reply.textContent.includes("👀") && Date.now() < deadline);
	assert.equal(reply.textContent.includes("👀"), true);
});

test("starting an agent from the details field immediately highlights its activity card without scrolling", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: { "@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
			export const useRovoChatControls = () => controls;
			export const useOptionalRovoChatControls = () => controls;
			export const useOptionalRovoChat = () => null;` },
		props: { initialPreset: "filled", onClose() {}, open: true, cloudAgentSelector: true, shell: "gallery" },
	});
	const feed = document.querySelector("[data-project-butter-activity-feed]");
	const scrollport = feed.parentElement.parentElement;
	scrollport.style.overflowY = "auto";
	scrollport.scrollTop = 500;
	scrollport.getBoundingClientRect = () => ({ top: 0, bottom: 700, height: 700 });
	const scrolls = [];
	scrollport.scrollTo = (options) => scrolls.push(options);
	const originalAnimate = window.Element.prototype.animate;
	const animations = [];
	window.Element.prototype.animate = function (frames, options) {
		if (this.parentElement?.hasAttribute("data-jira-linking-glow-backdrop")) animations.push({ frames, options, direction: this.parentElement.dataset.jiraLinkingGlowDirection });
		return { cancel() {}, onfinish: null };
	};
	try {
		await view.click(view.getByRole("group", { name: "Agents field" }).querySelector("button"));
		await view.click(view.getByRole("button", { name: "Claude (Recommended)" }));
		const card = [...document.querySelectorAll("[data-project-butter-session-start]")].find((node) => node.dataset.projectButterSessionStart.startsWith("reference:"));
		assert.equal(Boolean(card?.querySelector("[data-variant='uncaptured-work']")), true);
		assert.equal(scrolls.length, 0, "starting a session does not scroll");
		assert.notEqual(card.querySelector("[data-jira-linking-glow-trace]"), null);
		assert.equal(card.querySelector("[data-jira-linking-glow-halo]"), null);
		assert.equal(card.querySelector("[data-jira-linking-glow-backdrop]").parentElement === card, true);
		assert.equal(animations.at(-1)?.direction, "left-to-right");
		assert.equal(animations.at(-1)?.frames.at(-1).transform, "translateX(200%)");
		assert.equal(document.body.textContent.includes("Claude started"), true);
		const toast = document.querySelector('[data-slot="sonner-toast"]');
		assert.notEqual(toast.querySelector('[data-slot="avatar"][data-shape="hexagon"]'), null, "the selected agent's avatar appears in the toast");
		assert.equal(document.body.textContent.includes("A new session was added to activity."), true);
		card.getBoundingClientRect = () => ({ top: 900, bottom: 1200, height: 300 });
		assert.equal(view.queryByRole("button", { name: "Open in chat" }) !== null, true);
		await view.click(view.getByRole("button", { name: "View session" }));
		assert.deepEqual(scrolls.at(-1), { top: 1400, behavior: "smooth" });
	} finally {
		await view.unmount();
		window.Element.prototype.animate = originalAnimate;
	}
});

test("a host can replace the agent-start toast with its own confirmation", async () => {
	const added = [];
	const view = await renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: { "@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
			export const useRovoChatControls = () => controls;
			export const useOptionalRovoChatControls = () => controls;
			export const useOptionalRovoChat = () => null;` },
		props: { initialPreset: "filled", onClose() {}, onAgentAdded: (session) => added.push(session), open: true, cloudAgentSelector: true, shell: "gallery" },
	});
	await view.click(view.getByRole("group", { name: "Agents field" }).querySelector("button"));
	await view.click(view.getByRole("button", { name: "Claude (Recommended)" }));
	assert.equal(added.length, 1);
	assert.equal(added[0].agent.name, "Claude");
	assert.ok(document.querySelector(`[data-project-butter-session-start="${added[0].id}"]`));
	assert.equal(document.body.textContent.includes("Claude started"), false);
	await view.unmount();
});

test("starting an agent with reduced motion does not scroll or animate", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: { "@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
			export const useRovoChatControls = () => controls;
			export const useOptionalRovoChatControls = () => controls;
			export const useOptionalRovoChat = () => null;` },
		props: { initialPreset: "filled", onClose() {}, open: true, cloudAgentSelector: true, shell: "gallery" },
	});
	const originalMatchMedia = window.matchMedia;
	window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
	const feed = document.querySelector("[data-project-butter-activity-feed]");
	const scrollport = feed.parentElement.parentElement;
	scrollport.style.overflowY = "auto";
	scrollport.scrollTop = 500;
	scrollport.getBoundingClientRect = () => ({ top: 0, bottom: 700, height: 700 });
	const scrolls = [];
	scrollport.scrollTo = (options) => scrolls.push(options);
	try {
		await view.click(view.getByRole("group", { name: "Agents field" }).querySelector("button"));
		await view.click(view.getByRole("button", { name: "Claude (Recommended)" }));
		const card = [...document.querySelectorAll("[data-project-butter-session-start]")].find((node) => node.dataset.projectButterSessionStart.startsWith("reference:"));
		assert.equal(Boolean(card), true);
		assert.equal(scrolls.length, 0);
		assert.equal(card.querySelector("[data-jira-linking-glow-trace], [data-jira-linking-glow-backdrop]"), null);
		await view.click(view.getByRole("button", { name: "View session" }));
		assert.equal(scrolls.at(-1)?.behavior, "auto");
	} finally {
		await view.unmount();
		window.matchMedia = originalMatchMedia;
	}
});

test("the new session toast opens that session in the host chat", async () => {
	const opened = [];
	const view = await renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: { "@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
			export const useRovoChatControls = () => controls;
			export const useOptionalRovoChatControls = () => controls;
			export const useOptionalRovoChat = () => null;` },
		props: { initialPreset: "filled", onClose() {}, onOpenCloudSession: (session, draft, workItem) => { opened.push({ session, draft, workItem }); return true; }, open: true, cloudAgentSelector: true, shell: "gallery" },
	});
	await view.click(view.getByRole("group", { name: "Agents field" }).querySelector("button"));
	await view.click(view.getByRole("button", { name: "Claude (Recommended)" }));
	const card = [...document.querySelectorAll("[data-project-butter-session-start]")].find((node) => node.dataset.projectButterSessionStart.startsWith("reference:"));
	await view.click(view.getByRole("button", { name: "Open in chat" }));
	assert.equal(opened.length, 1);
	assert.equal(opened[0].session.id, card.dataset.projectButterSessionStart);
	assert.equal(opened[0].session.agent.name, "Claude");
	assert.equal(opened[0].workItem.code, "VITA-1");
});
