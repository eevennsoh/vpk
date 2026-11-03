const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { accessibleName, renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderRelated(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { MotionConfig } from "motion/react";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
			export default function RelatedProbe({ shown = true, onUnhandledEscape }) {
				const content = useProjectButterContent("filled");
				return <MotionConfig reducedMotion="always"><div onKeyDown={(event) => { if (event.key === "Escape") onUnhandledEscape?.(); }}>
					<button type="button">Outside related work</button>
					{shown ? <ProjectButterRelatedWork content={content} /> : null}
				</div></MotionConfig>;
			}`,
		mocks: {
			"@/components/blocks/jira-work-item/project-butter/project-butter-attachments": `export function ProjectButterAttachments() { return null; }`,
		},
		props,
	});
}

const summaryButtons = (key) => [...document.querySelectorAll(`[role="textbox"][aria-label="Edit summary for ${key}"]`)];
const childRows = (view) => [...view.getByRole("list", { name: "Child work items" }).children]
	.filter((row) => row.querySelector('[aria-label^="Edit summary for "]'));
const rowSummary = (row) => row.querySelector('[aria-label^="Edit summary"]').textContent;

async function chooseDisplay(view, type = "subitems") {
	await view.click(document.querySelector(`[data-related-type="${type}"] button[aria-label="More actions"]`));
}

test("child summary Save and Cancel isolate editing and Escape returns focus without dismissing the host", async () => {
	let escaped = 0;
	const view = await renderRelated({ onUnhandledEscape: () => escaped++ });
	assert.equal(view.queryByText("10/15") !== null, true);
	await view.click(summaryButtons("VITA-4")[0]);
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-4" }) !== null, true);
	assert.equal(view.tabOrder().includes("Edit summary for VITA-5"), false, "other rows must leave keyboard navigation during a summary edit");
	assert.equal(view.queryByRole("button", { name: "Edit priority for VITA-4: Medium. Edit" }) === null, true, "summary actions replace the row metadata");
	await view.fill(view.getByRole("textbox", { name: "Edit summary for VITA-4" }), "Discard this edit");
	await view.click(view.getByRole("button", { name: "Cancel summary for VITA-4" }));
	assert.equal(summaryButtons("VITA-4")[0].textContent, "Write copy for welcome screen");
	assert.equal(view.isFocused(summaryButtons("VITA-4")[0]), true);
	await view.click(summaryButtons("VITA-4")[0]);
	await view.fill(view.getByRole("textbox", { name: "Edit summary for VITA-4" }), "Saved welcome copy");
	await view.click(view.getByRole("button", { name: "Save summary for VITA-4" }));
	assert.equal(summaryButtons("VITA-4")[0].textContent, "Saved welcome copy");
	await view.click(summaryButtons("VITA-4")[0]);
	await view.fill(view.getByRole("textbox", { name: "Edit summary for VITA-4" }), "Escape this edit");
	await view.press(view.getByRole("textbox", { name: "Edit summary for VITA-4" }), "Escape");
	assert.equal(summaryButtons("VITA-4")[0].textContent, "Saved welcome copy");
	assert.equal(view.tabOrder().includes("Edit summary for VITA-5"), true);
	assert.equal(view.isFocused(summaryButtons("VITA-4")[0]), true);
	assert.equal(escaped, 0);
});

test("keyboard Save, Cancel and Escape on the summary actions return focus to the settled summary", async () => {
	let escaped = 0;
	const view = await renderRelated({ onUnhandledEscape: () => escaped++ });
	const summary = () => summaryButtons("VITA-5")[0];
	await view.focus(summary());
	await view.fill(summary(), "Keyboard saved copy");
	await view.press(summary(), "Tab");
	assert.equal(view.isFocused(view.getByRole("button", { name: "Save summary for VITA-5" })), true);
	await view.press(null, "Enter");
	assert.equal(summary().textContent, "Keyboard saved copy");
	assert.equal(view.isFocused(summary()), true, "focus must not drop to the body after keyboard Save");
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-5" }), null, "the settled summary does not re-enter editing");
	await view.press(summary(), "x");
	await view.fill(summary(), "Discard via Escape on Cancel");
	await view.focus(view.getByRole("button", { name: "Cancel summary for VITA-5" }));
	await view.press(null, "Escape");
	assert.equal(summary().textContent, "Keyboard saved copy");
	assert.equal(view.isFocused(summary()), true);
	assert.equal(escaped, 0, "Escape on the actions cancels the edit, not the host dialog");
});

test("repeated work-item keys keep independent summaries when rows are saved or removed", async () => {
	const view = await renderRelated();
	assert.equal(summaryButtons("VITA-4").length, 2);
	await view.click(summaryButtons("VITA-4")[1]);
	await view.fill(view.getByRole("textbox", { name: "Edit summary for VITA-4" }), "Second reference only");
	await view.click(view.getByRole("button", { name: "Save summary for VITA-4" }));
	assert.deepEqual(summaryButtons("VITA-4").map((button) => button.textContent), ["Write copy for welcome screen", "Second reference only"]);
	await view.click(view.getAllByRole("button", { name: "More actions for VITA-4" })[1]);
	await view.click(view.getByRole("menuitem", { name: "Delete" }));
	assert.equal(summaryButtons("VITA-4").every((button) => button.textContent === "Write copy for welcome screen"), true);
	assert.equal(view.queryByText("Second reference only") === null, true);
});

test("summary and composer drafts survive remounting the related surface", async () => {
	const view = await renderRelated();
	await view.click(summaryButtons("VITA-4")[0]);
	await view.fill(view.getByRole("textbox", { name: "Edit summary for VITA-4" }), "Keep the unfinished summary");
	await view.rerender({ shown: false });
	await view.rerender({ shown: true });
	assert.equal(view.getByRole("textbox", { name: "Edit summary for VITA-4" }).textContent, "Keep the unfinished summary");
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-4" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Cancel summary for VITA-4" }));
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	await view.fill(view.getByRole("combobox", { name: "Create child work item" }), "Keep the unfinished child");
	await view.rerender({ shown: false });
	await view.rerender({ shown: true });
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	assert.equal(view.getByRole("combobox", { name: "Create child work item" }).value, "Keep the unfinished child");
});

test("inline creation, existing-item search, and pasted links add real rows at the top", async () => {
	const view = await renderRelated();
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	const composer = view.getByRole("combobox", { name: "Create child work item" });
	assert.equal(composer.getAttribute("placeholder"), "Create new, search or paste existing");
	await view.fill(composer, "Write a focused acceptance checklist");
	await view.click(view.getByRole("option", { name: "Create “Write a focused acceptance checklist”" }));
	assert.equal(rowSummary(childRows(view)[0]), "Write a focused acceptance checklist");
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	await view.fill(view.getByRole("combobox", { name: "Create child work item" }), "analytics events");
	await view.click(view.getByRole("option", { name: /VITA-12Add analytics events for onboarding steps/u }));
	assert.equal(summaryButtons("VITA-12")[0].textContent, "Add analytics events for onboarding steps");
	await view.click(view.getByRole("button", { name: "Add linked work" }));
	const linkedComposer = view.getByRole("combobox", { name: "Add linked work" });
	const clipboardData = new DataTransfer();
	clipboardData.setData("text", "https://hello.atlassian.net/browse/VITA-11");
	await React.act(async () => linkedComposer.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData })));
	assert.equal(linkedComposer.value, "VITA-11");
	await view.click(view.getByRole("option", { name: /VITA-11Integrate onboarding flow with auth system/u }));
	assert.equal(summaryButtons("VITA-11")[0].textContent, "Integrate onboarding flow with auth system");
	assert.equal(view.queryByRole("button", { name: "Edit relationship for VITA-11: Clones. Edit" }) !== null, true);
});

test("related due dates preserve the selected calendar date across timezones", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 7, 15, 12) });
	const previousTimezone = process.env.TZ;
	try {
		for (const timezone of ["America/Los_Angeles", "Pacific/Kiritimati"]) {
			process.env.TZ = timezone;
			const view = await renderComponent({
				source: `import React, { useState } from "react";
					import { RelatedDueDateField } from "@/components/blocks/jira-work-item/project-butter/related-row-fields";
					export default function DueDateProbe() {
						const [dueDate, setDueDate] = useState("2026-08-27");
						return <><RelatedDueDateField item={{ id: "date-probe", key: "VITA-4", summary: "Date probe", status: "To do", priority: "Medium", assignee: "Unassigned", dueDate }} onChange={setDueDate} /><output aria-label="Stored due date" role="status">{dueDate}</output></>;
					}`,
			});
			await view.click(view.getByRole("button", { name: "Edit due date for VITA-4, Aug 27" }));
			assert.equal(view.getByRole("button", { name: /August 27th, 2026.*selected/u }).textContent, "27");
			await view.click(view.getByRole("button", { name: /August 28th, 2026/u }));
			assert.equal(view.getByRole("status", { name: "Stored due date" }).textContent, "2026-08-28");
			await view.click(view.getByRole("button", { name: "Edit due date for VITA-4, Aug 28" }));
			assert.equal(view.getByRole("button", { name: /August 28th, 2026.*selected/u }).textContent, "28");
			await view.unmount();
		}
	} finally {
		if (previousTimezone === undefined) delete process.env.TZ;
		else process.env.TZ = previousTimezone;
	}
});

test("display options identify the initial source order as Rank", async () => {
	const view = await renderRelated();
	const initialOrder = childRows(view).map(rowSummary);
	assert.equal(initialOrder[0], "Write copy for welcome screen");
	await chooseDisplay(view);
	await view.click(view.getByRole("button", { name: "Ordering, Rank" }));
	assert.equal(view.getByRole("menuitem", { name: "Rank" }).getAttribute("data-selected"), "true");
	assert.equal(view.getByRole("menuitem", { name: "Priority" }).getAttribute("data-selected"), null);
	await view.click(view.getByRole("menuitem", { name: "Rank" }));
	await chooseDisplay(view);
	assert.deepEqual(childRows(view).map(rowSummary), initialOrder);
});

test("display options order rows, hide completed work, and hide selected properties", async () => {
	const view = await renderRelated();
	await chooseDisplay(view);
	await view.click(view.getByRole("button", { name: "Ordering, Rank" }));
	await view.click(view.getByRole("menuitem", { name: "Priority" }));
	await chooseDisplay(view);
	assert.equal(rowSummary(childRows(view)[0]), "Design progress indicator component");
	await chooseDisplay(view);
	await view.click(view.getByRole("switch", { name: "Hide done work items" }));
	await view.click(view.getByRole("button", { name: "Priority" }));
	await chooseDisplay(view);
	assert.equal(view.queryByRole("button", { name: "Edit summary for VITA-5" }) === null, true);
	assert.equal(childRows(view).length, 5);
	assert.equal(view.queryByRole("button", { name: "Edit priority for VITA-4: Medium. Edit" }) === null, true);
	assert.equal(view.queryByText("10/15") !== null, true, "progress includes the complete list when done rows are filtered out");
});

const crewSession = (id, state, name) => ({ id, state, title: `${name} work`, agent: { id: name.toLowerCase(), name }, timeLabel: "Today" });

function renderCrew(props) {
	return renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterCrew } from "@/components/blocks/jira-work-item/project-butter/project-butter-crew";
			export default function CrewProbe(props) { return <ThemeWrapper><ProjectButterCrew {...props} /></ThemeWrapper>; }`,
		props: { onOpenSession() {}, sessions: [], useReferenceCrew: false, ...props },
	});
}

test("empty crew shows the current viewer and adds the chosen searchable agent", async () => {
	const selected = [];
	const view = await renderCrew({ onStartAgent: (agent) => selected.push(agent) });
	assert.equal(view.queryByRole("img", { name: "Annie Cook, Currently viewing" }) !== null, true);
	assert.equal(view.queryByRole("img", { name: "Add agent" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Annie Cook, Currently viewing. Add agent" }));
	await view.fill(view.getByRole("combobox", { name: "Search agents" }), "Codex");
	await view.click(view.getByRole("option", { name: /^Codex/u }));
	assert.deepEqual(selected.map((agent) => ({ id: agent.id, name: agent.name })), [{ id: "codex", name: "Codex" }]);
	assert.equal(view.queryByRole("combobox", { name: "Search agents" }) === null, true);
});

test("filled crew sorts sessions by urgency and routes session and add-agent selections", async () => {
	const sessions = [crewSession("done", "complete", "Finished"), crewSession("running", "running", "Working"), crewSession("input", "needs-input", "Blocked")];
	const opened = [];
	const selected = [];
	const view = await renderCrew({ onOpenSession: (session) => opened.push(session.id), onStartAgent: (agent) => selected.push(agent.id), sessions });
	await view.click(view.getByRole("button", { name: /^Working on this work item\./u }));
	assert.deepEqual([...view.getByRole("dialog", { name: "Agent sessions" }).querySelectorAll("li")].map((item) => item.querySelector("button")?.textContent.split(" work")[0]), ["Blocked", "Working", "Finished"]);
	await view.click(view.getByRole("button", { name: /^Working work/u }));
	assert.deepEqual(opened, ["running"]);
	await view.click(view.getByRole("button", { name: /^Working on this work item\./u }));
	await view.click(view.getByRole("button", { name: "Add agent" }));
	await view.fill(view.getByRole("combobox", { name: "Search agents" }), "Figma");
	await view.click(view.getByRole("option", { name: /^Figma/u }));
	assert.deepEqual(selected, ["figma"]);
});

test("crew without an add-agent capability does not advertise an enabled picker", async () => {
	const view = await renderCrew();
	assert.equal(view.getByRole("button", { name: "Annie Cook, Currently viewing. Add agent" }).disabled, true);
	assert.equal(view.queryByRole("combobox", { name: "Search agents" }) === null, true);
});

test("reference crew keeps its initial members while matching session labels follow live state", async () => {
	const sessions = [
		{ ...crewSession("butter-coding", "needs-input", "Jira Coding agent"), agent: { id: "rovo-dev", name: "Jira Coding agent" } },
		crewSession("butter-scoping", "running", "Jira Scoping agent"),
		{ ...crewSession("butter-claude", "needs-input", "Claude"), agent: { id: "claude", name: "Claude", brandName: "claude" } },
	];
	const props = { onOpenSession() {}, sessions, useReferenceCrew: true };
	const view = await renderCrew(props);
	const initialLabel = accessibleName(view.getByRole("button", { name: /^Working on this work item\./u }));
	assert.equal(initialLabel.includes("Jira Coding agent"), false);
	assert.equal(initialLabel.includes("Jira Scoping agent"), false);
	assert.equal(view.getAllByRole("img", { name: /^(Sarah Lim|Marcus Kim|Claude|Codex|Cursor|Figma|Rovo),/u }).length, 7);
	assert.equal(view.queryByRole("img", { name: "Claude, Needs input" }) !== null, true);
	await view.rerender({ ...props, sessions: sessions.map((session) => session.id === "butter-claude" ? { ...session, state: "running" } : session) });
	assert.equal(view.queryByRole("img", { name: "Claude, Working" }) !== null, true);
	assert.equal(view.queryByRole("img", { name: "Claude, Needs input" }) === null, true);
});

test("reference crew appends a newly picked agent and combines its sessions by urgency", async () => {
	const selected = [];
	const sessions = [{ ...crewSession("butter-claude", "needs-input", "Claude"), agent: { id: "claude", name: "Claude", brandName: "claude" } }];
	const props = { onOpenSession() {}, onStartAgent: (agent) => selected.push(agent), sessions, useReferenceCrew: true };
	const view = await renderCrew(props);
	await view.click(view.getByRole("button", { name: /^Working on this work item\./u }));
	await view.click(view.getByRole("button", { name: "Add agent" }));
	await view.fill(view.getByRole("combobox", { name: "Search agents" }), "Code Reviewer");
	await view.click(view.getByRole("option", { name: /Code Reviewer/u }));
	assert.equal(selected.length, 1);
	const running = { ...crewSession("review-running", "running", "Code Reviewer"), agent: selected[0] };
	await view.rerender({ ...props, sessions: [...sessions, running] });
	assert.equal(view.queryByRole("img", { name: "Code Reviewer, Working" }) !== null, true);
	const blocked = { ...running, id: "review-input", state: "needs-input" };
	await view.rerender({ ...props, sessions: [...sessions, running, blocked] });
	assert.equal(view.getAllByRole("img", { name: "Code Reviewer, Needs input" }).length, 1, "an agent occupies one mark, using its most urgent session state");
	assert.equal(view.queryByRole("img", { name: "Code Reviewer, Working" }) === null, true);
	await view.rerender({ ...props, sessions: [...sessions, { ...running, state: "complete" }, { ...blocked, state: "complete" }] });
	assert.equal(view.getAllByRole("img", { name: "Code Reviewer, Completed" }).length, 1);
});


test("working crew uses the six-dot Bloom indicator and removes it after completion", async () => {
	const props = { sessions: [crewSession("running", "running", "Codex")] };
	const view = await renderCrew(props);
	const spinner = view.getByRole("status", { name: "Working" });
	assert.equal(spinner.hasAttribute("data-iconic-orb"), true);
	assert.equal(spinner.querySelectorAll("circle").length, 6);
	await view.rerender({ ...props, onOpenSession() {}, useReferenceCrew: false, sessions: [crewSession("running", "complete", "Codex")] });
	assert.equal(view.queryByRole("status", { name: "Working" }) === null, true);
	assert.equal(accessibleName(view.getByRole("button", { name: /^Working on this work item\./u })).includes("Codex, Completed"), true);
});

const SECTIONS_HARNESS = `import React from "react";
	import { MotionConfig } from "motion/react";
	import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
	import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
	import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
	export default function SectionsProbe() {
		const content = useProjectButterContent("filled");
		return <ThemeWrapper><MotionConfig reducedMotion="always"><div className="flex flex-col gap-6">
			<ProjectButterDescription content={content} empty={false} />
			<ProjectButterRelatedWork content={content} />
		</div></MotionConfig></ThemeWrapper>;
	}`;

test("Related work collapses to a summary and its groups collapse independently", async () => {
	const view = await renderComponent({ source: SECTIONS_HARNESS });
	const childHeading = () => view.getByRole("button", { name: /^(Collapse|Expand) Child work items /u });
	const related = view.getByRole("button", { name: "Collapse Related work" });
	assert.equal(related.getAttribute("aria-expanded"), "true");
	assert.equal(view.queryByRole("heading", { name: "Related work", level: 2 }) !== null, true);
	assert.equal(document.querySelector('[data-component="RelatedWorkCollapsedSummary"]'), null);
	await view.click(view.getByRole("button", { name: "Collapse Attachments" }));
	assert.equal(view.queryByRole("button", { name: "Documents, 4 attachments" }) === null, true);
	assert.equal(view.queryByRole("button", { name: "Add attachment" }) === null, true);
	assert.equal(view.queryByRole("list", { name: "Child work items" }) !== null, true);
	assert.equal(view.queryByRole("list", { name: "Linked work" }) !== null, true);
	assert.equal(childHeading().getAttribute("aria-label"), "Collapse Child work items 10 of 15 done, 5 in progress, 0 to do");
	await view.click(childHeading());
	assert.equal(view.queryByRole("list", { name: "Child work items" }) === null, true);
	assert.equal(childHeading().textContent.includes("10/15"), true);
	assert.equal(view.queryByRole("button", { name: "Add child work item" }) === null, true);
	await view.click(view.getByRole("button", { name: "Collapse Linked work" }));
	await view.click(view.getByRole("button", { name: "Description" }));
	assert.equal(view.queryByRole("list", { name: "Linked work" }) === null, true);
	assert.equal(view.queryByRole("textbox", { name: "Work item description" }) === null, true);
	for (const trigger of [view.getByRole("button", { name: "Description" }), view.getByRole("button", { name: "Expand Attachments" }), childHeading(), view.getByRole("button", { name: "Expand Linked work" })]) {
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
	}
	assert.equal(view.tabOrder().includes("Edit summary for VITA-9"), false);
	assert.equal(view.tabOrder().includes("More actions for Hero Image - Summer Launch.png"), false);
	await view.click(view.getByRole("button", { name: "Expand Linked work" }));
	assert.equal(view.queryByRole("list", { name: "Linked work" }) !== null, true);
	assert.equal(view.queryByRole("list", { name: "Child work items" }) === null, true);
	await view.click(view.getByRole("button", { name: "Collapse Related work" }));
	assert.equal(view.getByRole("button", { name: "Expand Related work" }).getAttribute("aria-expanded"), "false");
	assert.equal(view.getByRole("list", { name: "8 attachments, 15 subitems, 8 linked work items" }).textContent, "8158");
	assert.equal(view.queryByRole("list", { name: "Linked work" }) === null, true);
	assert.equal(view.tabOrder().includes("Expand Attachments"), false);
	await view.click(view.getByRole("button", { name: "Expand Related work" }));
	assert.equal(view.queryByRole("list", { name: "Linked work" }) !== null, true);
	assert.equal(document.querySelector('[data-component="RelatedWorkCollapsedSummary"]'), null);
});

test("collapsing sections preserves attachment stacks", async () => {
	const view = await renderComponent({ source: SECTIONS_HARNESS });
	await view.click(view.getByRole("button", { name: "Documents, 4 attachments" }));
	await view.click(view.getByRole("button", { name: "Collapse Attachments" }));
	await view.click(view.getByRole("button", { name: "Expand Attachments" }));
	assert.equal(view.getByRole("button", { name: "Close documents" }).getAttribute("aria-expanded"), "true");
	assert.equal(view.tabOrder().includes("More actions for Q1 Marketing Strategy & Goals"), true);
});

test("collapsing child work commits the live summary edit", async () => {
	const view = await renderComponent({ source: SECTIONS_HARNESS });
	await view.click(summaryButtons("VITA-4")[0]);
	await view.fill(view.getByRole("textbox", { name: "Edit summary for VITA-4" }), "Keep this collapsed draft");
	await view.click(view.getByRole("button", { name: /^(Collapse|Expand) Child work items /u }));
	assert.equal(view.queryByRole("textbox", { name: "Edit summary for VITA-4" }) === null, true);
	await view.click(view.getByRole("button", { name: /^(Collapse|Expand) Child work items /u }));
	// Leaving the row commits the live edit (reference InlineEditableTextCell), so collapsing keeps the text.
	assert.equal(summaryButtons("VITA-4")[0].textContent, "Keep this collapsed draft");
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-4" }) === null, true);
});
