const assert = require("node:assert/strict");
const test = require("node:test");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const { renderComponent } = require("../../../../scripts/lib/render-component.js");
const { BUTTER_DONE_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/done.ts");
const { BUTTER_IN_PROGRESS_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/in-progress.ts");
const { BUTTER_IN_REVIEW_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/in-review.ts");
const { BUTTER_TODO_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/todo.ts");

/** Opens every collapsed "N updates" row so individual changes are reachable. */
async function expandUpdates(view) {
	for (const button of [...document.querySelectorAll('[data-project-butter-update-group] button[aria-expanded="false"]')]) await view.click(button);
}

const COLUMN_MAPS = [
	["To do", BUTTER_TODO_PLACEHOLDERS, ["PAY-118", "PAY-124", "PAY-125", "PAY-127"]],
	["In progress", BUTTER_IN_PROGRESS_PLACEHOLDERS, ["PAY-105", "PAY-107", "PAY-123", "PAY-130"]],
	["In review", BUTTER_IN_REVIEW_PLACEHOLDERS, ["PAY-112", "PAY-115", "PAY-119", "PAY-132", "PAY-104", "PAY-109", "PAY-121", "PAY-128"]],
	["Done", BUTTER_DONE_PLACEHOLDERS, ["PAY-101", "PAY-102", "PAY-113", "PAY-126"]],
];

const HARNESS = `import React from "react";
	import { BUTTER_WORK_ITEM_PLACEHOLDERS } from "@/components/projects/butter/data/work-item-placeholders";
	import { attachmentDisplayName } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
	import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

	const session = {
		id: "pay-118-agent",
		title: "Carry artwork",
		state: "complete",
		message: "Artwork fields listed",
		agent: { id: "claude", name: "Claude", brandName: "claude" },
		host: "local",
		invokedBy: { name: "Diego Santos" },
		timeLabel: "1h ago",
	};
	const waiting = { ...session, id: "pay-118-waiting", state: "needs-input", title: "Waiting on p95" };

	function commentText(entry) {
		return entry.kind === "comment" ? entry.body.map((part) => part.type === "text" ? part.text : "").join(" ") : "";
	}

	export default function Harness({
		code,
		preset = "filled",
		description,
		labels,
		dueDate,
		storyPoints,
		reporterName,
		defaultReporterName,
		withSession = false,
		passMap = true,
	}) {
		const workItem = code ? {
			code,
			title: code === "PAY-118" ? "Carry card artwork into the next wallet epic" : "Board item",
			description,
			labels,
			dueDate,
			storyPoints,
			reporter: reporterName ? { name: reporterName } : undefined,
		} : undefined;
		const content = useProjectButterContent(
			preset,
			workItem,
			withSession ? [session, waiting] : undefined,
			passMap ? BUTTER_WORK_ITEM_PLACEHOLDERS : undefined,
			defaultReporterName ? { name: defaultReporterName } : undefined,
		);
		const comments = content.activityEntries.filter((entry) => entry.kind === "comment" && !String(entry.id).startsWith("invocation-"));
		const replies = comments.flatMap((entry) => entry.kind === "comment" ? entry.replies ?? [] : []);
		return <div>
			<p data-field="description">{content.description}</p>
			<p data-field="reporter">{content.reporter?.name ?? ""}</p>
			<p data-field="child">{content.relatedWork.children.map((item) => item.key).join(",")}</p>
			<p data-field="linked">{content.relatedWork.linked.map((item) => item.key).join(",")}</p>
			<p data-field="attachment">{content.attachments.map(attachmentDisplayName).join("|")}</p>
			<p data-field="attachment-preview">{content.attachments.map((item) => item.previewSrc ?? "").join("|")}</p>
			<p data-field="comment">{comments.map(commentText).join(" ")}</p>
			<p data-field="reply">{replies.map((reply) => reply.body).join(" ")}</p>
			<p data-field="session">{content.activityEntries.filter((entry) => String(entry.id).startsWith("invocation-")).map((entry) => entry.id).join(",")}</p>
			<p data-field="parent">{content.detailFields.parent}</p>
			<p data-field="labels">{content.detailFields.labels.join(",")}</p>
			<p data-field="components">{content.detailFields.components.join(",")}</p>
			<p data-field="fix">{content.detailFields.fixVersion}</p>
			<p data-field="story-points">{content.detailFields.storyPoints}</p>
			<p data-field="cost">{content.detailFields.costCenter}</p>
			<p data-field="campaign">{content.detailFields.campaignGoal}</p>
			<p data-field="platforms">{content.detailFields.targetPlatforms.join(",")}</p>
			<p data-field="reach">{content.detailFields.estimatedReach}</p>
			<p data-field="audience">{content.detailFields.audienceSegment}</p>
			<p data-field="region">{content.detailFields.campaignRegion.region}</p>
			<p data-field="asset">{content.detailFields.assetObject}</p>
			<p data-field="due">{content.dueDate ? content.dueDate.toISOString().slice(0, 10) : ""}</p>
			<p data-field="summary">{content.summary}</p>
		</div>;
	}`;

function field(name, root = document) {
	return root.querySelector(`[data-field="${name}"]`)?.textContent ?? "";
}

function renderHarness(props) {
	return renderComponent({ source: HARNESS, props });
}

test("each column map authors description, children, attachments, and comments", () => {
	for (const [column, source, codes] of COLUMN_MAPS) {
		for (const code of codes) {
			assert.equal(source[code] !== undefined, true, `${column} ${code} is authored`);
			assert.equal(source[code].description.length > 0, true, code);
			assert.equal(source[code].children.length > 0, true, code);
			assert.equal(source[code].attachments.length > 0, true, code);
			assert.equal(source[code].comments.length > 0, true, code);
		}
	}
});

test("every board attachment previews a distinct primary ambient illustration, varied within each work item", () => {
	const seen = new Set();
	for (const [, source, codes] of COLUMN_MAPS) {
		for (const code of codes) {
			const families = new Set();
			const colors = new Set();
			for (const attachment of source[code].attachments) {
				const match = /^\/ambient\/(.+)\/primary\/(\w+)\.(?:svg|png)$/u.exec(attachment.previewSrc ?? "");
				assert.notEqual(match, null, `${attachment.id} previews a primary ambient illustration`);
				assert.equal(existsSync(join(__dirname, "../../../../public", attachment.previewSrc)), true, attachment.previewSrc);
				assert.equal(seen.has(attachment.previewSrc), false, `${attachment.previewSrc} is reused`);
				seen.add(attachment.previewSrc);
				families.add(match[1]);
				colors.add(match[2]);
			}
			assert.equal(families.size, source[code].attachments.length, `${code} mixes designs`);
			assert.equal(colors.size, source[code].attachments.length, `${code} mixes colors`);
		}
	}
});

test("default Gallery attachments all have distinct primary ambient previews", async () => {
	const view = await renderHarness({});
	const previews = field("attachment-preview", view.container).split("|");
	assert.equal(previews.length, 8);
	for (const preview of previews) {
		assert.match(preview, /^\/ambient\/.+\/primary\/\w+\.(?:svg|png)$/u);
		assert.equal(existsSync(join(__dirname, "../../../../public", preview)), true, preview);
	}
	assert.equal(new Set(previews).size, previews.length);
	await view.unmount();
});

test("opening a card from each column fills that map's sections", async () => {
	for (const [, source, codes] of COLUMN_MAPS) {
		for (const code of codes) {
			const placeholder = source[code];
			const view = await renderHarness({ code });
			assert.equal(field("description", view.container), placeholder.description, code);
			assert.equal(field("reporter", view.container), placeholder.reporter, code);
			assert.equal(field("child", view.container).split(",").includes(placeholder.children[0].key), true, code);
			assert.equal(field("attachment", view.container).includes(placeholder.attachments[0].name), true, code);
			assert.equal(field("attachment-preview", view.container).includes(placeholder.attachments[0].previewSrc), true, code);
			assert.equal(field("comment", view.container).includes(placeholder.comments[0].markdown), true, code);
			assert.equal(field("campaign", view.container), "", code);
			await view.unmount();
		}
	}
});

test("opened PAY-118 fills description, child, attachment, comment, and detail fields", async () => {
	await renderHarness({ code: "PAY-118", storyPoints: 5 });
	assert.equal(field("description").includes("LegacyGatewayAdapter"), true);
	assert.equal(field("description").includes("PAY-118"), true);
	assert.equal(field("reporter"), "Priya Raman");
	assert.equal(field("child").includes("PAY-201"), true);
	assert.equal(field("linked").includes("PAY-115"), true);
	assert.equal(field("attachment").includes("Card artwork field map"), true);
	assert.equal(field("comment").includes("issuer artwork id"), true);
	assert.equal(field("reply").includes("p95"), true);
	assert.equal(field("parent"), "PAY-100 Payments SDK v2 migration");
	assert.equal(field("labels"), "wallet");
	assert.equal(field("components").includes("Frontend"), true);
	assert.equal(field("fix"), "v2.0");
	assert.equal(field("story-points"), "5");
	assert.equal(field("cost"), "RD-100-ENGINEERING");
	assert.equal(field("campaign"), "");
	assert.equal(field("platforms"), "");
	assert.equal(field("reach"), "");
	assert.equal(field("audience"), "");
	assert.equal(field("region"), "");
	assert.equal(field("asset"), "");
	assert.equal(field("due"), "");
	assert.equal(field("summary"), "Carry card artwork into the next wallet epic");
});

test("placeholder fill keeps the card due date, reporter, labels, and description when the card already has them", async () => {
	await renderHarness({
		code: "PAY-118",
		description: "Already written",
		dueDate: "2026-08-17",
		labels: ["billing"],
		reporterName: "Diego Santos",
	});
	assert.equal(field("description"), "Already written");
	assert.equal(field("reporter"), "Diego Santos");
	assert.equal(field("labels"), "billing");
	assert.equal(field("due"), "2026-08-17");
	assert.equal(field("child").includes("PAY-201"), true);
});

test("placeholder fill keeps a complete agent session in the activity feed", async () => {
	await renderHarness({ code: "PAY-118", withSession: true });
	// Needs-input sessions join the feed too; the separate Needs input block is gone.
	assert.equal(field("session"), "invocation-pay-118-agent,invocation-pay-118-waiting");
	assert.equal(field("comment").includes("issuer artwork id"), true);
});

test("a missing placeholder key gets a default reporter and leaves other fields blank", async () => {
	await renderHarness({ code: "PAY-404" });
	assert.equal(field("description"), "");
	assert.equal(field("child"), "");
	assert.equal(field("attachment"), "");
	assert.equal(field("comment"), "");
	assert.equal(field("reporter"), "Annie Cook");
	assert.equal(field("fix"), "");
});

test("empty and blank presets stay empty when a placeholder exists", async () => {
	await renderHarness({ code: "PAY-118", preset: "empty" });
	assert.equal(field("description"), "");
	assert.equal(field("attachment"), "");
	assert.equal(field("comment"), "");
	assert.equal(field("reporter"), "Priya Raman");
	await renderHarness({ code: "PAY-118", preset: "blank" });
	assert.equal(field("description"), "");
	assert.equal(field("child"), "");
});

test("items without an authored reporter use the host's current person in every preset", async () => {
	for (const preset of ["filled", "empty", "blank"]) {
		await renderHarness({ code: "PAY-999", preset, defaultReporterName: "Venn" });
		assert.equal(field("reporter"), "Venn");
	}
});

test("the reference demo stays filled when no board item is open", async () => {
	await renderHarness({});
	assert.equal(field("description").includes("The current onboarding experience"), true);
	assert.equal(field("fix"), "v2.0");
	assert.equal(field("attachment").includes("Q1 Marketing Strategy"), true);
	assert.equal(field("comment").length > 0, true);
	assert.equal(field("comment").includes("issuer artwork id"), false);
	assert.equal(field("due"), "2026-05-25");
});

test("a board item without the placeholder map stays blank", async () => {
	await renderHarness({ code: "PAY-118", passMap: false });
	assert.equal(field("description"), "");
	assert.equal(field("child"), "");
	assert.equal(field("attachment"), "");
});

const JOURNEY_HARNESS = `import React from "react";
	import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
	import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
	import { useProjectButterSessions } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-sessions";
	import { applyProjectButterSuggestion, listProjectButterSuggestions, revertMatchingProjectButterSuggestions } from "@/components/blocks/jira-work-item/project-butter/suggestion-model";
	const venn = { name: "Venn", avatarUrl: "/avatar-user/venn.png" };
	const claude = { id: "claude", name: "Claude", brandName: "claude" };
	export default function Journey({ host = true, assignee, code = "PAY-999" }) {
		const content = useProjectButterContent("empty", { code, title: "Improve onboarding", assignee: assignee ? { name: assignee } : undefined }, undefined, undefined, venn, host ? { currentUser: venn, showAuditInActivity: true } : undefined);
		const model = useProjectButterSessions("empty", code, undefined, host ? venn : undefined);
		function accept() {
			const snapshot = { ...content.detailFields, description: content.description, descriptionDraft: content.descriptionDraft, dueDate: content.dueDate, reporter: content.reporter };
			for (const suggestion of listProjectButterSuggestions(snapshot, "payments")) {
				if (["description", "dueDate", "parent", "labels"].includes(suggestion.field)) applyProjectButterSuggestion(suggestion, content);
			}
		}
		function acceptField(field) {
			const snapshot = { ...content.detailFields, description: content.description, descriptionDraft: content.descriptionDraft, dueDate: content.dueDate, reporter: content.reporter };
			const suggestion = listProjectButterSuggestions(snapshot, "payments").find((item) => item.field === field);
			if (suggestion) applyProjectButterSuggestion(suggestion, content);
		}
		function undoLabels() {
			const snapshot = { ...content.detailFields, description: content.description, descriptionDraft: content.descriptionDraft, dueDate: content.dueDate, reporter: content.reporter };
			const suggestion = listProjectButterSuggestions({ ...snapshot, labels: [] }, "payments").find((item) => item.field === "labels");
			if (suggestion) revertMatchingProjectButterSuggestions([suggestion], snapshot, content);
		}
		function start() {
			const session = model.startAgent(claude, content.summary);
			content.recordSessionInvocation(session, host ? venn : undefined);
			content.recordSessionInvocation(session, host ? venn : undefined);
		}
		return <ThemeWrapper>
			<button onClick={accept}>Accept suggestions</button>
			<button onClick={() => acceptField("description")}>Accept description</button>
			<button onClick={() => acceptField("parent")}>Accept parent</button>
			<button onClick={() => acceptField("labels")}>Accept labels</button>
			<button onClick={undoLabels}>Undo labels</button>
			<button onClick={() => content.setSummary("An edited summary")}>Edit summary</button>
			<button onClick={start}>Start Claude</button>
			<button onClick={() => content.recordSessionInvocation(model.startCoding(content.summary))}>Start coding</button>
			<p data-field="assignee">{content.assignee.name}</p>
			<p data-field="invoker">{model.sessions.at(-1)?.invokedBy?.name}</p>
			<ProjectButterActivity content={content} empty sidePanel={false} sessions={model.sessions} onOpenSession={() => undefined} />
		</ThemeWrapper>;
	}`;

test("Butter combines accepted suggestions into one expanding Activity entry", async () => {
	const view = await renderComponent({ source: JOURNEY_HARNESS });
	await view.click(view.getByRole("button", { name: "Accept description" }));
	assert.notEqual(view.queryByRole("button", { name: /Venn\s*updated description\s*Just now/u }), null);
	await view.click(view.getByRole("button", { name: "Accept parent" }));
	await view.click(view.getByRole("button", { name: "Accept labels" }));
	const changes = view.getAllByRole("button", { name: /Venn\s*updated .*Just now/u });
	assert.equal(changes.length, 1);
	assert.match(changes[0].textContent, /updated description, parent, and labels/u);
	await view.click(changes[0]);
	assert.equal(document.getElementById(changes[0].getAttribute("aria-controls")).textContent.includes("onboarding, sdk-v2"), true);
	await view.click(view.getByRole("button", { name: "Undo labels" }));
	assert.notEqual(view.queryByRole("button", { name: /Venn\s*updated description and parent\s*Just now/u }), null);
	await view.click(view.getByRole("button", { name: "Edit summary" }));
	assert.equal(document.querySelector("[data-project-butter-update-group] button").textContent, "2 updates: changed summary, description and parent.");
	await expandUpdates(view);
	assert.notEqual(view.queryByRole("button", { name: /Venn\s*updated summary\s*Just now/u }), null);
	assert.equal(view.getAllByRole("button", { name: /Venn\s*updated .*Just now/u }).length, 2);
});

test("the combined suggestion update uses the edit pencil", async () => {
	const source = JOURNEY_HARNESS
		.replace('import React from "react";', 'import React from "react"; import EditIcon from "@atlaskit/icon/core/edit";')
		.replace("<ThemeWrapper>", '<ThemeWrapper><span data-reference-edit><EditIcon label="" size="small" /></span>');
	const view = await renderComponent({ source });
	await view.click(view.getByRole("button", { name: "Accept suggestions" }));
	const row = document.querySelector('[data-jira-activity-entry-id="butter-accepted-suggestions"]');
	const pencil = document.querySelector("[data-reference-edit] svg path")?.getAttribute("d");
	assert.equal(typeof pencil, "string");
	assert.equal(row?.querySelector('[data-slot="icon"] svg path')?.getAttribute("d"), pencil);
	await view.unmount();
});

test("the Butter project shows changes and agent activity in one feed", async () => {
	const source = JOURNEY_HARNESS.replace("<ProjectButterActivity content=", "<ProjectButterActivity singleView content=");
	const view = await renderComponent({ source });
	assert.equal(view.queryByRole("tablist", { name: "Activity views" }), null);
	assert.notEqual(view.queryByRole("heading", { name: "Activity" }), null);
	await view.click(view.getByRole("button", { name: "Accept suggestions" }));
	await view.click(view.getByRole("button", { name: "Start Claude" }));
	await expandUpdates(view);
	assert.notEqual(view.queryByRole("button", { name: /Venn\s*updated description, due date, parent, and labels\s*Just now/u }), null);
	assert.notEqual(view.queryByRole("button", { name: /Venn\s*automatically assigned this work item to Venn\s*Just now/u }), null);
	assert.equal(document.querySelectorAll('[data-jira-activity-entry-id^="invocation-"]').length, 1);
	await view.unmount();
});

test("starting Claude records Venn invocation and auto-assignment once in Activity", async () => {
	const view = await renderComponent({ source: JOURNEY_HARNESS });
	await view.click(view.getByRole("button", { name: "Start Claude" }));
	assert.equal(field("assignee"), "Venn");
	assert.equal(field("invoker"), "Venn");
	assert.equal(document.querySelectorAll('[data-jira-activity-entry-id^="invocation-"]').length, 1);
	await expandUpdates(view);
	assert.equal(view.getAllByRole("button", { name: /Venn\s*automatically assigned this work item to Venn\s*Just now/u }).length, 1);
	assert.equal(document.querySelector("[data-project-butter-activity-feed]").textContent.includes("Venn added Claude"), true);
	await view.click(view.getByRole("button", { name: "Start Claude" }));
	assert.equal(document.querySelectorAll('[data-jira-activity-entry-id^="invocation-"]').length, 2);
	await expandUpdates(view);
	assert.equal(view.getAllByRole("button", { name: /Venn\s*automatically assigned this work item to Venn\s*Just now/u }).length, 1);
});

test("starting Claude preserves a person manually assigned to the work item", async () => {
	const view = await renderComponent({ source: JOURNEY_HARNESS, props: { assignee: "Diego Santos" } });
	await view.click(view.getByRole("button", { name: "Start Claude" }));
	assert.equal(field("assignee"), "Diego Santos");
	assert.equal(view.queryByRole("button", { name: /automatically assigned this work item/u }) === null, true);
	assert.equal(field("invoker"), "Venn");
});

test("the hosted coding action uses Venn attribution without opting into auto-assignment", async () => {
	const view = await renderComponent({ source: JOURNEY_HARNESS });
	await view.click(view.getByRole("button", { name: "Start coding" }));
	assert.equal(field("invoker"), "Venn");
	assert.equal(field("assignee"), "Unassigned");
});

test("the shared work item keeps Annie attribution in the one Activity feed without Butter host context", async () => {
	const view = await renderComponent({ source: JOURNEY_HARNESS, props: { host: false } });
	await view.click(view.getByRole("button", { name: "Accept suggestions" }));
	await expandUpdates(view);
	assert.equal(view.queryByRole("button", { name: /Venn\s*updated description/u }) === null, true);
	assert.equal(view.queryByRole("button", { name: /Annie Cook\s*updated description\s*Just now/u }) !== null, true);
	await view.click(view.getByRole("button", { name: "Start Claude" }));
	assert.equal(field("assignee"), "Unassigned");
	assert.equal(field("invoker"), "Annie Cook");
});

test("Butter audit and assignment survive switching to another item and back", async () => {
	const view = await renderComponent({ source: JOURNEY_HARNESS });
	await view.click(view.getByRole("button", { name: "Accept suggestions" }));
	await view.click(view.getByRole("button", { name: "Start Claude" }));
	await view.rerender({ code: "PAY-998" });
	assert.equal(field("assignee"), "Unassigned");
	assert.equal(view.queryByRole("button", { name: /Venn\s*updated description/u }) === null, true);
	await view.rerender({ code: "PAY-999" });
	assert.equal(field("assignee"), "Venn");
	await expandUpdates(view);
	assert.equal(view.queryByRole("button", { name: /Venn\s*updated description/u }) !== null, true);
	assert.equal(document.querySelectorAll('[data-jira-activity-entry-id^="invocation-"]').length, 1);
});
