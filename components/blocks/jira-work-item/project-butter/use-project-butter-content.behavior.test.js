const assert = require("node:assert/strict");
const test = require("node:test");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const { renderComponent } = require("../../../../scripts/lib/render-component.js");
const { BUTTER_DONE_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/done.ts");
const { BUTTER_IN_PROGRESS_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/in-progress.ts");
const { BUTTER_IN_REVIEW_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/in-review.ts");
const { BUTTER_TODO_PLACEHOLDERS } = require("../../../../components/projects/butter/data/work-item-placeholders/todo.ts");

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
		reporterName,
		withSession = false,
		passMap = true,
	}) {
		const workItem = code ? {
			code,
			title: code === "PAY-118" ? "Carry card artwork into the next wallet epic" : "Board item",
			description,
			labels,
			dueDate,
			reporter: reporterName ? { name: reporterName } : undefined,
		} : undefined;
		const content = useProjectButterContent(
			preset,
			workItem,
			withSession ? [session, waiting] : undefined,
			passMap ? BUTTER_WORK_ITEM_PLACEHOLDERS : undefined,
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
			<p data-field="criteria">{content.detailFields.acceptanceCriteria}</p>
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

test("every attachment previews a distinct ambient illustration, varied within each work item", () => {
	const seen = new Set();
	for (const [, source, codes] of COLUMN_MAPS) {
		for (const code of codes) {
			const families = new Set();
			const colors = new Set();
			for (const attachment of source[code].attachments) {
				const match = /^\/ambient\/(.+)\/(?:primary|shade|tint)\/(\w+)\.(?:svg|png)$/u.exec(attachment.previewSrc ?? "");
				assert.notEqual(match, null, `${attachment.id} previews an ambient illustration`);
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
	await renderHarness({ code: "PAY-118" });
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
	assert.equal(field("criteria").includes("named owner"), true);
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
	assert.equal(field("session"), "invocation-pay-118-agent");
	assert.equal(field("comment").includes("issuer artwork id"), true);
});

test("a missing placeholder key stays blank and does not throw", async () => {
	await renderHarness({ code: "PAY-404" });
	assert.equal(field("description"), "");
	assert.equal(field("child"), "");
	assert.equal(field("attachment"), "");
	assert.equal(field("comment"), "");
	assert.equal(field("reporter"), "");
	assert.equal(field("fix"), "");
});

test("empty and blank presets stay empty when a placeholder exists", async () => {
	await renderHarness({ code: "PAY-118", preset: "empty" });
	assert.equal(field("description"), "");
	assert.equal(field("attachment"), "");
	assert.equal(field("comment"), "");
	await renderHarness({ code: "PAY-118", preset: "blank" });
	assert.equal(field("description"), "");
	assert.equal(field("child"), "");
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
