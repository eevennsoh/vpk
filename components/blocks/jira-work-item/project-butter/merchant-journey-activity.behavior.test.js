const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const journeySession = { id: "journey-session", agent: { id: "claude", name: "Claude", brandName: "claude" }, title: "Merchant onboarding", host: "cloud", state: "running", message: "Authored session message", invokedBy: { name: "Venn" }, invokedAtMs: 1793836800000, timeLabel: "Just now" };
const otherSession = { ...journeySession, id: "other-session", agent: { id: "codex", name: "Codex", brandName: "openai" }, title: "Unrelated review", state: "needs-input" };
const props = { open: true, onClose() {}, initialPreset: "filled", currentUser: { name: "Venn" }, autoAssignClaudeToCurrentUser: true, workItem: { code: "PAY-999", title: "Authored summary", status: "To do", assignee: { name: "Venn" } }, journeySession };
const mocks = {
	"@/components/blocks/jira-work-item/project-butter/project-butter-shell": `export function ProjectButterShell({ children }) { return <div>{children}</div>; }`,
	"@/components/blocks/jira-work-item/project-butter/attachment-drop-overlay": `export function AttachmentDropZone() { return null; }`,
	"@/components/blocks/jira-work-item/project-butter/project-butter-header": `export function ProjectButterHeader({ content }) { return <><p data-field="status">{content.status}</p><p data-field="assignee">{content.assignee.name}</p><button onClick={() => content.setAssignee({ name: "Diego Santos" })}>Assign Diego</button><button onClick={() => content.setAssignee({ name: "Unassigned" })}>Unassign</button><button onClick={() => content.setStatus("Blocked")}>Set blocked</button></>; }`,
	"@/components/blocks/jira-work-item/project-butter/project-butter-crew": `export function ProjectButterCrew({ onStartAgent }) { return <button onClick={() => onStartAgent({ id: "claude", name: "Claude", brandName: "claude" })}>Launch Claude</button>; }`,
	"@/components/blocks/jira-work-item/project-butter/project-butter-body": `export function ProjectButterBody({ content, detailsSlotRef, onOpenSession, sessions }) { return <div>
		<p data-field="description">{content.description}</p><p data-field="summary">{content.summary}</p><p data-field="sessions">{sessions.map((session) => session.id + ":" + session.title + ":" + session.state + ":" + session.message).join("|")}</p>
		<input aria-label="Comment draft" value={content.commentDraft} onChange={(event) => content.setCommentDraft(event.target.value)} />
		<button onClick={() => content.setSummary("Edited summary")}>Edit summary</button>
		<button onClick={() => content.setDescription("My authored description")}>Edit description</button>
		<button onClick={() => content.setDescription("")}>Clear description</button>
		<button onClick={() => { content.beginSuggestionAudit("Description", "accept"); content.setDescription("My accepted description"); content.endSuggestionAudit(); }}>Accept real description</button>
		<button onClick={() => content.setActivityEntries((entries) => [...entries, { id: "authored-comment", kind: "comment", actor: { id: "venn", name: "Venn", kind: "person" }, timestamp: "Just now", body: [{ type: "text", text: "Keep my comment" }] }])}>Add comment</button>
		<button onClick={() => content.setActivityEntries((entries) => entries.map((entry) => entry.id === "authored-comment" ? { ...entry, replies: [...(entry.replies ?? []), { id: "authored-reply", actor: { id: "venn", name: "Venn", kind: "person" }, timestamp: "Just now", body: "Keep my reply" }] } : entry))}>Reply to journey</button>
		<button onClick={() => content.setActivityEntries((entries) => entries.map((entry) => entry.id === "merchant-started-journey-session" ? { ...entry, replies: [...(entry.replies ?? []), { id: "claude-thread-reply", actor: { id: "venn", name: "Venn", kind: "person" }, timestamp: "Just now", body: "Keep my thread reply" }] } : entry))}>Reply to Claude</button>
		<button onClick={() => content.setActivityEntries((entries) => [...entries, { id: "merchant-pr", kind: "comment", actor: { id: "claude", name: "Claude", kind: "agent" }, timestamp: "Just now", body: [{ type: "text", text: "Earlier PR update" }], replies: [{ id: "legacy-reply", actor: { id: "venn", name: "Venn", kind: "person" }, timestamp: "Just now", body: "Keep my old PR reply" }] }])}>Add old PR reply</button>
		<p data-field="activity">{content.activityEntries.map((entry) => entry.id + ":" + (entry.kind === "comment" ? entry.body.map((part) => part.text).join("") + (entry.replies ?? []).map((reply) => reply.body).join("") : "audit " + entry.actor.name + " " + entry.segments.map((part) => part.text).join(""))).join("|")}</p>
		<p data-field="suggestion-details">{(content.auditChanges["butter-accepted-suggestions"]?.changes ?? []).map((change) => change.label + ":" + change.after).join("|")}</p>
		{sessions.map((session) => <button key={session.id} onClick={() => onOpenSession(session.id)}>Open {session.id}</button>)}
		<div ref={detailsSlotRef} />
	</div>; }`,
	"@/components/blocks/jira-work-item/project-butter/project-butter-details": `export function ProjectButterDetails({ agentField, content }) { return <>{agentField}<p data-field="labels">{content.detailFields.labels.join(",")}</p><p data-field="parent">{content.detailFields.parent}</p><p data-field="points">{content.detailFields.storyPoints}</p><button onClick={() => content.setDetailFields((fields) => ({ ...fields, labels: ["authored-label"] }))}>Edit labels</button><button onClick={() => content.setDetailFields((fields) => ({ ...fields, storyPoints: "8" }))}>Edit story points</button></>; }`,
	"@/components/blocks/jira-work-item/project-butter/project-butter-session-chat": `export function ProjectButterSessionChat({ children, open }) { return open ? <div>{children}</div> : null; }`,
	"@/components/blocks/jira-work-item/project-butter/project-butter-session": `export function ProjectButterSession({ draft, onDraftChange, session }) { return <><p data-field="active-session">{session.id}:{session.state}</p><input aria-label="Session draft" value={draft} onChange={(event) => onDraftChange(event.target.value)} /></>; }`,
};

function field(name) {
	return document.querySelector(`[data-field="${name}"]`)?.textContent ?? "";
}

function renderJourney(extra = {}) {
	return renderComponent({ entry: "components/blocks/jira-work-item/project-butter/project-butter-jira-work-item.tsx", exportName: "ProjectButterJiraWorkItem", props: { ...props, ...extra }, mocks });
}

test("Claude selection renders one activity snapshot with an agent mention", async () => {
	const view = await renderComponent({ source: `import React from "react";
		import { ThemeWrapper } from "@/components/utils/theme-wrapper";
		import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
		import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
		import { projectMerchantJourney } from "@/components/blocks/jira-work-item/project-butter/merchant-journey-activity";
		const venn = { name: "Venn", avatarUrl: "/avatar-user/venn/venn.png" };
		const session = { id: "journey-session", title: "Merchant onboarding", state: "running", host: "cloud", message: "Working", agent: { id: "claude", name: "Claude", brandName: "claude" }, invokedBy: { name: "Venn" }, timeLabel: "Just now" };
		export default function Harness() {
			const content = useProjectButterContent("empty", { code: "PAY-999", title: "Merchant onboarding" }, undefined, undefined, venn, { currentUser: venn, showAuditInActivity: true });
			const projected = projectMerchantJourney({ content, sessions: [], phase: "working", session, autoAssignTo: venn });
			return <ThemeWrapper><ProjectButterActivity content={{ ...projected.content, activitySort: "oldest" }} sessions={projected.sessions} empty sidePanel={false} singleView onOpenSession={() => undefined} /></ThemeWrapper>;
		}` });
	const entries = document.querySelectorAll('[data-jira-activity-entry-id="merchant-agent-added-journey-session"]');
	assert.equal(entries.length, 1);
	assert.equal(entries[0].textContent.includes("Venn added Claude and self-assigned the issue"), true);
	assert.equal(entries[0].querySelector('[data-jira-activity-agent-mention]')?.textContent, "Claude");
	assert.equal(entries[0].textContent.includes("Just now"), true);
	assert.equal(entries[0].querySelector('[aria-expanded]'), null);
	assert.equal(document.querySelector('[data-jira-activity-entry-id="merchant-assignment"]'), null);
	const acknowledgment = document.querySelectorAll('[data-jira-activity-entry-id="merchant-started-journey-session"]');
	assert.equal(acknowledgment.length, 1);
	assert.equal(acknowledgment[0].textContent.includes("Claude"), true);
	assert.equal(acknowledgment[0].textContent.includes("I'm looking into this issue now. I'll report back here with updates as I make progress."), true);
	const statusChange = document.querySelectorAll('[data-jira-activity-entry-id="merchant-status-journey-session"]');
	assert.equal(statusChange.length, 1);
	assert.match(statusChange[0].textContent, /Claude\s+changed status from To do to In progress/u);
	assert.deepEqual([...document.querySelectorAll("[data-jira-activity-entry-id]")].map((entry) => entry.getAttribute("data-jira-activity-entry-id")).filter((id) => id !== "butter-empty-created"), ["merchant-started-journey-session", "merchant-status-journey-session", "merchant-agent-added-journey-session", "butter-accepted-suggestions"]);
	await view.unmount();
});

test("direct jumps synthesize a session and rewind removes future progress without storing it", async () => {
	const view = await renderJourney({ journeyPhase: "merged" });
	assert.equal(field("sessions").includes("journey-session:Merchant onboarding:complete"), true);
	assert.equal(field("activity").includes("merchant-agent-added-journey-session"), true);
	assert.equal(field("activity").includes("merchant-started-journey-session"), true);
	assert.equal(field("activity").includes("PR #284 merged"), true);
	assert.equal(field("activity").includes("merchant-merged:PR #284 merged"), true);
	assert.equal(field("status"), "Done");
	await view.rerender({ ...props, journeyPhase: "pr" });
	assert.equal(field("sessions").includes("journey-session:Merchant onboarding:running"), true);
	assert.equal(field("activity").includes("opened PR #284"), true);
	assert.equal(field("activity").includes("PR #284 merged"), false);
	assert.equal(field("activity").includes("checks passed after"), false);
	await view.rerender({ ...props, journeyPhase: "invoke" });
	assert.equal(field("sessions"), "");
	assert.equal(field("activity").includes("merchant-"), false);
	assert.equal(field("activity").includes("invocation-journey-session"), false);
	await view.rerender(props);
	assert.equal(field("status"), "To do");
	assert.doesNotMatch(field("activity"), /merchant-|butter-accepted-suggestions/u);
});

test("Claude's status snapshot is shown once from working onward and disappears when rewound", async () => {
	const view = await renderJourney({ journeyPhase: "working" });
	assert.equal(field("activity").split("merchant-status-journey-session").length - 1, 1);
	assert.match(field("activity"), /Claude changed status from To do to In progress/u);
	await view.rerender({ ...props, journeyPhase: "pr" });
	assert.equal(field("activity").split("merchant-status-journey-session").length - 1, 1);
	await view.rerender({ ...props, journeyPhase: "merged" });
	assert.equal(field("activity").split("merchant-status-journey-session").length - 1, 1);
	await view.rerender({ ...props, journeyPhase: "invoke" });
	assert.equal(field("activity").includes("merchant-status-journey-session"), false);
	await view.rerender({ ...props, journeyPhase: "working" });
	assert.equal(field("activity").split("merchant-status-journey-session").length - 1, 1);
	await view.unmount();
});

test("Claude's updates share the first comment and preserve human replies across journey steps", async () => {
	const journeyProps = { ...props, journeySession: { ...journeySession, invokedAtMs: Date.now() - 10_000 } };
	const view = await renderJourney({ ...journeyProps, journeyPhase: "pr" });
	assert.equal(field("activity").includes("merchant-started-journey-session"), true);
	assert.equal(field("activity").includes("opened PR #284"), true);
	assert.equal(field("activity").includes("merchant-pr:"), false);
	await view.click(view.getByRole("button", { name: "Add old PR reply" }));
	assert.equal(field("activity").includes("Keep my old PR reply"), true);
	await view.click(view.getByRole("button", { name: "Reply to Claude" }));
	await view.rerender({ ...journeyProps, journeyPhase: "merged" });
	assert.equal(field("activity").includes("Keep my thread reply"), true);
	assert.equal(field("activity").includes("Keep my old PR reply"), true);
	assert.equal(field("activity").includes("pushed a fix"), true);
	assert.equal(field("activity").includes("checks passed after"), true);
	assert.equal(field("activity").includes("PR #284 merged"), true);
	await view.rerender({ ...journeyProps, journeyPhase: "working" });
	assert.equal(field("activity").includes("Keep my thread reply"), true);
	assert.equal(field("activity").includes("opened PR #284"), false);
	assert.equal(field("activity").includes("PR #284 merged"), false);
	await view.rerender({ ...journeyProps, journeyPhase: "merged" });
	assert.equal(field("activity").split("Keep my thread reply").length - 1, 1);
	assert.equal(field("activity").split("PR #284 merged").length - 1, 1);
	await view.unmount();
});

test("direct Invoke prepares empty ticket fields only in the presentation", async () => {
	const view = await renderJourney({ journeyPhase: "invoke" });
	assert.equal(field("description").includes("Payments SDK v2"), true);
	assert.equal(field("labels"), "onboarding,sdk-v2");
	assert.equal(field("parent"), "PAY-100 Payments SDK v2 migration");
	assert.equal(field("points"), "5");
	assert.equal(field("activity").includes("Venn updated description, due date, parent, labels, and story points"), true);
	assert.match(field("suggestion-details"), /Description:Help merchants adopt Payments SDK v2/u);
	assert.match(field("suggestion-details"), /Due Date:2026-12-15/u);
	assert.match(field("suggestion-details"), /Parent:PAY-100 Payments SDK v2 migration/u);
	assert.match(field("suggestion-details"), /Labels:onboarding, sdk-v2/u);
	assert.match(field("suggestion-details"), /Story points:5/u);
	await view.rerender(props);
	assert.equal(field("description"), "");
	assert.equal(field("labels"), "");
	assert.equal(field("parent"), "");
	assert.equal(field("points"), "");
	assert.doesNotMatch(field("activity"), /merchant-|butter-accepted-suggestions/u);
});

test("syncing board story points does not create an activity entry, while a user edit does", async () => {
	const galleryProps = { ...props, showAuditInActivity: true, journeyPhase: "invoke" };
	const view = await renderJourney(galleryProps);
	await view.rerender({ ...galleryProps, workItem: { ...props.workItem, storyPoints: 3 } });
	assert.equal(field("points"), "3");
	assert.equal(field("activity").includes("Venn updated story points"), false);
	await view.click(view.getByRole("button", { name: "Edit story points" }));
	assert.equal(field("points"), "8");
	assert.equal(field("activity").includes("Venn updated story points"), true);
	await view.unmount();
});

test("projected preparation merges with a real acceptance without persisting or duplicating it", async () => {
	const galleryProps = { ...props, showAuditInActivity: true };
	const view = await renderJourney({ ...galleryProps, journeyPhase: "invoke" });
	await view.click(view.getByRole("button", { name: "Accept real description" }));
	assert.equal(field("activity").split("butter-accepted-suggestions").length - 1, 1);
	assert.match(field("suggestion-details"), /Description:My accepted description/u);
	assert.match(field("suggestion-details"), /Due Date:2026-12-15/u);
	await view.click(view.getByRole("button", { name: "Add comment" }));
	await view.rerender(galleryProps);
	assert.equal(field("activity").includes("Keep my comment"), true);
	assert.equal(field("activity").split("butter-accepted-suggestions").length - 1, 1);
	assert.match(field("suggestion-details"), /Description:My accepted description/u);
	assert.doesNotMatch(field("suggestion-details"), /Due Date:2026-12-15/u);
	await view.rerender({ ...galleryProps, journeyPhase: "invoke" });
	assert.equal(field("activity").split("butter-accepted-suggestions").length - 1, 1);
	assert.match(field("suggestion-details"), /Due Date:2026-12-15/u);
	await view.unmount();
});

test("authored content, audit, and drafts survive rewinding while generated suggestions stay temporary", async () => {
	const view = await renderJourney({ journeyPhase: "merged" });
	await view.click(view.getByRole("button", { name: "Edit summary" }));
	await view.click(view.getByRole("button", { name: "Edit description" }));
	await view.click(view.getByRole("button", { name: "Edit labels" }));
	await view.click(view.getByRole("button", { name: "Add comment" }));
	await view.click(view.getByRole("button", { name: "Reply to journey" }));
	await view.fill(view.getByRole("textbox", { name: "Comment draft" }), "Keep my draft");
	await view.click(view.getByRole("button", { name: "Open journey-session" }));
	await view.fill(view.getByRole("textbox", { name: "Session draft" }), "Keep session draft");
	await view.rerender(props);
	assert.equal(field("summary"), "Edited summary");
	assert.equal(field("description"), "My authored description");
	assert.equal(field("labels"), "authored-label");
	assert.equal(field("parent"), "");
	assert.equal(field("points"), "");
	assert.equal(field("activity").includes("Keep my comment"), true);
	assert.equal(field("activity").includes("audit"), true);
	assert.equal(view.getByRole("textbox", { name: "Comment draft" }).value, "Keep my draft");
	assert.equal(view.queryByRole("textbox", { name: "Session draft" }) === null, true);
	await view.rerender({ ...props, journeyPhase: "working" });
	assert.equal(field("activity").includes("Keep my reply"), true);
	await view.click(view.getByRole("button", { name: "Open journey-session" }));
	assert.equal(view.getByRole("textbox", { name: "Session draft" }).value, "Keep session draft");
	assert.equal(field("description"), "My authored description");
	assert.equal(field("labels"), "authored-label");
});

test("projection reuses the actual journey session and preserves unrelated sessions", async () => {
	const initialSessions = [{ ...journeySession, title: "Actual session title", message: "Actual user session message" }, otherSession];
	const view = await renderJourney({ journeyPhase: "merged", initialSessions });
	assert.equal(field("sessions").includes("journey-session:Actual session title:complete"), true);
	assert.equal(field("sessions").includes("other-session:Unrelated review:needs-input"), true);
	await view.rerender({ ...props, initialSessions, journeyPhase: "working" });
	assert.equal(field("sessions").includes("journey-session:Actual session title:running:Actual user session message"), true);
	await view.rerender({ ...props, initialSessions });
	assert.equal(field("sessions").includes("journey-session"), false);
	assert.equal(field("sessions").includes("other-session:Unrelated review:needs-input"), true);
	assert.equal(field("activity").includes("invocation-journey-session"), false);
});

test("clearing a projected value remains an authored edit across gallery steps", async () => {
	const view = await renderJourney({ journeyPhase: "invoke" });
	await view.click(view.getByRole("button", { name: "Clear description" }));
	assert.equal(field("description"), "");
	await view.rerender({ ...props, journeyPhase: "merged" });
	assert.equal(field("description"), "");
	await view.rerender(props);
	assert.equal(field("description"), "");
});

test("journey controls stay outside the work item", async () => {
	const view = await renderJourney();
	assert.equal(document.querySelector("[data-project-butter-journey-controls]") !== null, false);
	await view.rerender({ ...props, journeyControls: "Gallery steps" });
	assert.equal(document.querySelector("[data-project-butter-journey-controls]") !== null, false);
});

test("direct working assigns Venn visibly and rewind restores unassigned without an authored assignment", async () => {
	const workItem = { ...props.workItem, assignee: undefined };
	const view = await renderJourney({ workItem, journeyPhase: "working" });
	assert.equal(field("assignee"), "Venn");
	assert.equal(field("activity").includes("Venn added Claude and self-assigned the issue"), true);
	assert.equal(field("activity").includes("invocation-journey-session"), false);
	await view.rerender({ ...props, workItem, journeyPhase: "invoke" });
	assert.equal(field("assignee"), "Unassigned");
	assert.equal(field("activity").includes("merchant-assignment"), false);
	await view.rerender({ ...props, workItem });
	assert.equal(field("assignee"), "Unassigned");
	assert.equal(field("activity").includes("merchant-assignment"), false);
});

test("manual assignment and status changes take precedence over every later projection", async () => {
	const workItem = { ...props.workItem, assignee: undefined };
	const view = await renderJourney({ workItem, journeyPhase: "working" });
	await view.click(view.getByRole("button", { name: "Assign Diego" }));
	await view.click(view.getByRole("button", { name: "Set blocked" }));
	await view.rerender({ ...props, workItem, journeyPhase: "merged" });
	assert.equal(field("assignee"), "Diego Santos");
	assert.equal(field("status"), "Blocked");
	assert.equal(field("activity").includes("merchant-assignment"), false);
	assert.equal(field("activity").includes("Venn added Claude and self-assigned the issue"), false);
	assert.equal(field("activity").includes("Venn added Claude"), true);
	await view.rerender({ ...props, workItem });
	assert.equal(field("assignee"), "Diego Santos");
	assert.equal(field("status"), "Blocked");
	await view.rerender({ ...props, workItem, journeyPhase: "working" });
	await view.click(view.getByRole("button", { name: "Unassign" }));
	assert.equal(field("assignee"), "Unassigned");
	assert.equal(field("activity").includes("merchant-assignment"), false);
});

test("an authored Claude mention remains a comment", async () => {
	const session = { ...journeySession, prompt: "@Claude please review the onboarding flow" };
	const view = await renderJourney({ journeySession: session, journeyPhase: "working" });
	assert.equal(field("activity").includes("invocation-journey-session"), true);
	assert.equal(field("activity").includes("please review the onboarding flow"), true);
	assert.equal(field("activity").includes("merchant-agent-added-journey-session"), false);
	await view.unmount();
});

test("a real gallery invocation keeps automatic assignment in the reversible projection", async () => {
	const started = [];
	const workItem = { ...props.workItem, assignee: undefined };
	const galleryProps = { ...props, workItem, journeyControls: "Gallery steps" };
	const view = await renderJourney({ ...galleryProps, journeySession: undefined, onAgentSessionStart: (session) => started.push(session) });
	await view.click(view.getByRole("button", { name: "Launch Claude" }));
	assert.equal(started.length, 1);
	await view.rerender({ ...galleryProps, journeySession: started[0], journeyPhase: "working" });
	assert.equal(field("assignee"), "Venn");
	assert.equal(field("activity").includes("Venn added Claude and self-assigned the issue"), true);
	assert.equal(field("activity").includes("invocation-"), false);
	await view.rerender({ ...galleryProps, journeySession: started[0], journeyPhase: "invoke" });
	assert.equal(field("assignee"), "Unassigned");
	assert.equal(field("activity").includes("merchant-assignment"), false);
	assert.equal(field("activity").includes("automatically assigned"), false);
});

test("the Claude activity snapshot keeps the original assignment action after reassignment", async () => {
	const started = [];
	const workItem = { ...props.workItem, assignee: undefined };
	const galleryProps = { ...props, workItem, journeyControls: "Gallery steps" };
	const view = await renderJourney({ ...galleryProps, journeySession: undefined, onAgentSessionStart: (session) => started.push(session) });
	await view.click(view.getByRole("button", { name: "Launch Claude" }));
	await view.rerender({ ...galleryProps, journeySession: started[0], journeyPhase: "working" });
	await view.click(view.getByRole("button", { name: "Assign Diego" }));
	assert.equal(field("assignee"), "Diego Santos");
	assert.equal(field("activity").includes("Venn added Claude and self-assigned the issue"), true);
	await view.unmount();
});
