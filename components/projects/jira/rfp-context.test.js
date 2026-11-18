const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const AGENTS_VIEW_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const JIRA_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/website/demos/projects/jira-demo.tsx"),
	"utf8",
);
const DETAILS_ACCORDION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira/components/work-item-modal/details-accordion.tsx"),
	"utf8",
);
const ATTACHMENTS_SECTION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira/components/work-item-modal/attachments-section.tsx"),
	"utf8",
);
const ATTACHMENT_PREVIEW_CARD_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/attachment-preview-card.tsx"),
	"utf8",
);
const ROVO_CHAT_CONTEXT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/contexts/context-rovo-chat.tsx"),
	"utf8",
);

async function loadRfpContextHarness() {
	const mockModules = new Map([
		[
			"@atlaskit/icon/core/file",
			`
				export default function FileIcon() {
					return null;
				}
			`,
		],
		[
			"@/lib/rovo-suggestions",
			`
				export const defaultSuggestions = [
					{
						id: "work-last-7-days",
						label: "Last 7 days of work",
						type: "skill",
					},
					{
						id: "draft-confluence-page",
						label: "Draft Confluence page",
						type: "skill",
					},
					{
						id: "translate-text",
						label: "Translate this text",
						type: "skill",
					},
				];
			`,
		],
	]);

	const result = await esbuild.build({
		stdin: {
			contents: `
				export { BOARD_COLUMNS, RFP_CLIENT_NAMES_BY_CODE } from "./components/projects/jira/data/board-data";
				export {
					AGENTS_BOARD_CONTEXT_LABEL,
					RFP_101_WORK_ITEM,
					formatActiveJiraWorkItemContext,
					formatAgentsBoardContext,
					getAgentsWorkItemForCard,
					resolveAgentsChatScreenContext,
				} from "./components/projects/jira/data/rfp-work-items";
				export { mergeRovoContextDescriptions } from "./lib/rovo-context";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "rfp-context-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		loader: {
			".css": "empty",
		},
		plugins: [
			{
				name: "rfp-context-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (!mockModules.has(args.path)) {
							return undefined;
						}

						return {
							path: args.path,
							namespace: "rfp-context-test-mock",
						};
					});

					build.onLoad(
						{ filter: /.*/, namespace: "rfp-context-test-mock" },
						(args) => ({
							contents: mockModules.get(args.path),
							loader: "tsx",
							resolveDir: process.cwd(),
						}),
					);
				},
			},
		],
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("RFP-101 active work item formats a bounded hidden Jira context block", async () => {
	const harness = await loadRfpContextHarness();
	const context = harness.formatActiveJiraWorkItemContext(harness.RFP_101_WORK_ITEM);

	assert.match(context, /^\[Active Jira Work Item Context\]/);
	assert.match(context, /\[End Active Jira Work Item Context\]$/);
	assert.match(context, /Acmecorp/);
	assert.match(context, /Description: Acmecorp is evaluating Atlassian/);
	assert.match(context, /Due date: Jun 8, 2026/);
	assert.match(context, /Labels: Acmecorp, qualification, enterprise/);
	assert.doesNotMatch(context, /competitive-replacement/);
	assert.match(context, /multi-thousand users/);
	assert.match(context, /Deal size: multi-thousand users; budget qualification pending/);
	assert.match(context, /incumbent service-management, CMDB/);
	assert.match(context, /Response team needs:/);
	assert.doesNotMatch(context, /Child work items:/);
	assert.doesNotMatch(context, /RFP-105: Build requirement matrix/);
	assert.match(context, /rfp-intake-notes\.page/);
	assert.doesNotMatch(context, /enterprise-rfp-requirements\.pdf/);
	assert.doesNotMatch(context, /Recent activity:/);
	assert.doesNotMatch(context, /Sales engineering can own JSM workflows/);
});

test("RFP-101 only includes the intake notes attachment", async () => {
	const harness = await loadRfpContextHarness();
	const attachments = harness.RFP_101_WORK_ITEM.attachments;

	assert.equal(attachments.length, 1);
	assert.deepEqual(
		attachments.map((attachment) => attachment.ext),
		["page"],
	);
	assert.equal(attachments[0]?.displayName, "RFP intake notes");
	assert.equal(attachments[0]?.previewSrc, "/generated/rfp-confluence-intake-notes.png");
	assert.ok(
		attachments.every((attachment) => !("sourceHref" in attachment)),
	);
	assert.deepEqual(
		attachments
			.filter((attachment) => attachment.sourceProduct)
			.map((attachment) => attachment.sourceLabel),
		["Confluence page"],
	);

	const context = harness.formatActiveJiraWorkItemContext(harness.RFP_101_WORK_ITEM);
	assert.match(context, /rfp-intake-notes\.page/);
	assert.doesNotMatch(context, /proposal-audio-briefing\.mp3/);
	assert.doesNotMatch(context, /proposal-walkthrough\.mp4/);
});

test("board fallback formats bounded visible /agents context", async () => {
	const harness = await loadRfpContextHarness();
	const context = harness.formatAgentsBoardContext();

	assert.match(context, /^\[Agents Board Context\]/);
	assert.match(context, /\[End Agents Board Context\]$/);
	assert.match(context, /Enterprise RFP Response/);
	assert.match(context, /RFP Intake: 7 work items/);
	assert.match(context, /RFP-101: Acmecorp: Prepare for bid recommendation for ESM RFP/);
	assert.ok(context.length < 1_500);
});

test("non-RFP-101 work items format a lightweight active work item context", async () => {
	const harness = await loadRfpContextHarness();
	const workItem = harness.getAgentsWorkItemForCard({
		code: "RFP-102",
		title: "Northstar Bank: Parse supplier questionnaire and requested files",
	});

	assert.equal(workItem.code, "RFP-102");
	assert.equal(workItem.title, "Northstar Bank: Parse supplier questionnaire and requested files");
	assert.equal(workItem.account, "Northstar Bank");
	assert.match(workItem.description, /Review the Northstar Bank supplier packet/);
	assert.ok(workItem.description.length > 250);

	const context = harness.formatActiveJiraWorkItemContext(workItem);
	assert.match(context, /^\[Active Jira Work Item Context\]/);
	assert.match(context, /Key: RFP-102/);
	assert.match(context, /Title: Northstar Bank: Parse supplier questionnaire and requested files/);
	assert.match(context, /Labels: Northstar Bank, requirements, attachments/);
	assert.match(context, /Description: Review the Northstar Bank supplier packet/);
	assert.match(context, /customer-reference requests/);
	assert.match(context, /Child work items:/);
	assert.match(context, /Northstar Bank .*owner:/);
	assert.match(context, /Attachments:/);
	assert.match(context, /northstar-bank-/);
	assert.match(context, /Recent activity:/);
	assert.match(context, /\[End Active Jira Work Item Context\]$/);
	assert.equal(harness.formatActiveJiraWorkItemContext(null), undefined);
});

test("every visible agents board card resolves to a substantial work item description", async () => {
	const harness = await loadRfpContextHarness();
	const cards = harness.BOARD_COLUMNS.flatMap((column) => column.cards);

	assert.equal(cards.length, 16);

	for (const card of cards) {
		const workItem = harness.getAgentsWorkItemForCard(card);
		assert.equal(workItem.code, card.code);
		assert.equal(workItem.title, card.title);
		assert.equal(typeof workItem.description, "string", `${card.code} is missing a description`);
		assert.ok(workItem.description.length > 220, `${card.code} description is too short`);
	}
});

test("every visible RFP board card has one unique client tag", async () => {
	const harness = await loadRfpContextHarness();
	const cards = harness.BOARD_COLUMNS.flatMap((column) => column.cards);
	const clientNames = Object.values(harness.RFP_CLIENT_NAMES_BY_CODE);

	assert.equal(new Set(clientNames).size, cards.length);
	assert.equal(harness.RFP_CLIENT_NAMES_BY_CODE["RFP-101"], "Acmecorp");

	for (const card of cards) {
		const expectedClient = harness.RFP_CLIENT_NAMES_BY_CODE[card.code];
		const clientTags = card.tags.filter((tag) => clientNames.includes(tag.text));
		assert.match(card.title, new RegExp(`^${expectedClient}:`, "u"));
		assert.equal(clientTags.length, 1, `${card.code} should have exactly one client tag`);
		assert.equal(clientTags[0].text, expectedClient);
		if (card.code === "RFP-101") {
			assert.equal(clientTags[0].text, "Acmecorp");
		} else {
			assert.notEqual(clientTags[0].text, "Acmecorp", `${card.code} should not use Acmecorp`);
		}
	}
});

test("non-RFP-101 work items have varied comments, attachments, subtasks, and statuses", async () => {
	const harness = await loadRfpContextHarness();
	const cards = harness.BOARD_COLUMNS.flatMap((column) => column.cards)
		.filter((card) => card.code !== "RFP-101");
	const workItems = cards.map((card) => harness.getAgentsWorkItemForCard(card));
	const attachmentCounts = new Set(workItems.map((workItem) => workItem.attachments?.length ?? 0));
	const childItemCounts = new Set(workItems.map((workItem) => workItem.childItems?.length ?? 0));
	const commentCounts = new Set(workItems.map((workItem) => workItem.comments?.length ?? 0));
	const childStatuses = new Set(workItems.flatMap((workItem) => (
		workItem.childItems ?? []
	).map((childItem) => childItem.status)));

	assert.ok(attachmentCounts.size > 1, "attachment counts should vary across fake clients");
	assert.ok(childItemCounts.size > 1, "subtask counts should vary across fake clients");
	assert.ok(commentCounts.size > 1, "comment counts should vary across fake clients");
	assert.deepEqual([...childStatuses].sort(), ["done", "inprogress", "todo"]);

	for (const workItem of workItems) {
		const clientName = harness.RFP_CLIENT_NAMES_BY_CODE[workItem.code];
		assert.ok(clientName);
		assert.ok((workItem.attachments?.length ?? 0) >= 1, `${workItem.code} should have attachments`);
		assert.ok((workItem.childItems?.length ?? 0) >= 2, `${workItem.code} should have subtasks`);
		assert.ok((workItem.comments?.length ?? 0) >= 1, `${workItem.code} should have comments`);
		assert.ok(
			workItem.attachments.some((attachment) => attachment.displayName.includes(clientName)),
			`${workItem.code} should have client-specific attachment names`,
		);
		assert.ok(
			workItem.childItems.some((childItem) => childItem.summary.includes(clientName)),
			`${workItem.code} should have client-specific subtask names`,
		);
		assert.ok(
			workItem.comments.some((comment) => comment.content.includes(clientName)),
			`${workItem.code} should have client-specific Jira comments`,
		);
	}
});

test("work item labels are derived from visible board card tags", async () => {
	const harness = await loadRfpContextHarness();
	const cards = harness.BOARD_COLUMNS.flatMap((column) => column.cards);
	const rfp101Card = cards.find((card) => card.code === "RFP-101");

	assert.ok(rfp101Card);
	assert.deepEqual(
		harness.RFP_101_WORK_ITEM.labels,
		rfp101Card.tags.map((tag) => tag.text),
	);
	assert.deepEqual(harness.RFP_101_WORK_ITEM.labelTags, rfp101Card.tags);

	for (const card of cards) {
		const workItem = harness.getAgentsWorkItemForCard(card);
		assert.deepEqual(
			workItem.labels,
			card.tags.map((tag) => tag.text),
			`${card.code} label text should match board`,
		);
		assert.deepEqual(workItem.labelTags, card.tags, `${card.code} label colors should match board`);
	}
});

test("work item details render the board tag model", () => {
	assert.match(DETAILS_ACCORDION_SOURCE, /const labelTags: WorkItemLabelTag\[\] = workItem\.labelTags\?\.length/);
	assert.match(DETAILS_ACCORDION_SOURCE, /<TagGroup className="gap-1">/);
	assert.match(DETAILS_ACCORDION_SOURCE, /<Tag key=\{label\.text\} color=\{label\.color\}>/);
	assert.doesNotMatch(DETAILS_ACCORDION_SOURCE, /enterprise-rfp", "q4-sales/);
});

test("agents attachment grid mixes simple file icons with source product logos", () => {
	assert.match(ATTACHMENTS_SECTION_SOURCE, /from "@\/components\/ui\/icon-tile";/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /from "@\/components\/ui\/logo";/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /from "@\/components\/ui-custom\/attachment-preview-card";/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /from "@\/components\/ui-custom\/rovo-generation";/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /from "@\/components\/ui\/vpk-icons";/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /AtlassianLogo/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /ATTACHMENT_SOURCE_LABELS/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /name=\{file\.sourceProduct\}/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /FileChartColumnIcon/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /Music2Icon/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /VideoIcon/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /<MoreHorizontalIcon size="small" \/>/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /<PlusIcon size="small" \/>/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /<IconTile[\s\S]*size="medium"/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /variant="redBold"/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /icon=\{<Music2Icon \/>\}/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /size=\{12\}/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /if \(file\.previewHtml\)/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /srcDoc=\{file\.previewHtml\}/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /trailingVisual=\{renderAttachmentIcon\(file\)\}/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /scrollIntoView\(\{[\s\S]*behavior: "smooth"[\s\S]*block: "center"/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /highlightedKey=\{highlightedAttachmentKey\}/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /const ATTACHMENT_GENERATION_DURATION_SECONDS = 2;/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /const \[isGenerationActive, setIsGenerationActive\] = useState\(isHighlighted\);/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /const showGenerationEffect = isGenerationActive;/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /const handleGenerationComplete = useCallback\(\(\) => \{[\s\S]*setIsGenerationActive\(false\);[\s\S]*\}, \[\]\);/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /const resetKey = `\$\{props\.isHighlighted === true\}:\$\{props\.highlightedKey \?\? "default"\}`;[\s\S]*<AttachmentPreviewCardContent key=\{resetKey\}/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /<RovoGeneration\.Root[\s\S]*border[\s\S]*glow/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /duration=\{ATTACHMENT_GENERATION_DURATION_SECONDS\}/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /generating=\{isGenerationActive\}/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /onGenerationComplete=\{handleGenerationComplete\}/);
	assert.match(ATTACHMENTS_SECTION_SOURCE, /highlightedAttachmentKey=\{meta\.highlightedAttachmentKey\}/);
	assert.match(ATTACHMENT_PREVIEW_CARD_SOURCE, /data-highlighted-attachment=\{isGenerationActive \? "true" : undefined\}/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /animate-attachment-added-glow/);
	assert.doesNotMatch(ATTACHMENT_PREVIEW_CARD_SOURCE, /const showGenerationEffect = isHighlighted \|\| isGenerationActive;/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /icon=\{renderAttachmentIcon\(file\)\}/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /\/website\/vpk-logo-dark\.svg/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /label="VPK"/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /showVpkLogo/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /\{file\.date\}/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /\{file\.ext\}\s*<\/span>/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /uppercase/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /@atlaskit\/icon\/core/);
	assert.doesNotMatch(ATTACHMENTS_SECTION_SOURCE, /ConfluenceIcon|LoomIcon|Google|Microsoft/);
});

test("agents chat screen resolver switches from board fallback to active work item", async () => {
	const harness = await loadRfpContextHarness();

	const boardContext = harness.resolveAgentsChatScreenContext(null);
	assert.deepEqual(boardContext.chatContextBar, {
		label: harness.AGENTS_BOARD_CONTEXT_LABEL,
		iconName: "board",
		signature: "agents-board:enterprise-rfp-response",
	});
	assert.match(boardContext.contextDescription, /^\[Agents Board Context\]/);
	assert.equal(boardContext.greeting, undefined);

	const workItemContext = harness.resolveAgentsChatScreenContext(harness.RFP_101_WORK_ITEM);
	assert.deepEqual(workItemContext.chatContextBar, {
		label: "RFP-101: Acmecorp: Prepare for bid recommendation for ESM RFP",
		iconName: "work-item",
		signature: "agents-work-item:RFP-101",
	});
	assert.match(workItemContext.contextDescription, /^\[Active Jira Work Item Context\]/);

	const translatedPrompt = workItemContext.greeting.suggestions.find(
		(suggestion) => suggestion.id === "translate-text",
	);
	assert.equal(translatedPrompt.label, "Recommend an assignee");
	assert.equal(translatedPrompt.prompt, "Recommend an assignee");
});

test("Rovo context merging preserves active work item context and suggestion context", async () => {
	const harness = await loadRfpContextHarness();
	const merged = harness.mergeRovoContextDescriptions(
		"[Active Jira Work Item Context]\nKey: RFP-101\n[End Active Jira Work Item Context]",
		"[Work Summary Scope]\nSearch Jira and Confluence.\n[End Work Summary Scope]",
	);

	assert.equal(
		merged,
		[
			"[Active Jira Work Item Context]\nKey: RFP-101\n[End Active Jira Work Item Context]",
			"[Work Summary Scope]\nSearch Jira and Confluence.\n[End Work Summary Scope]",
		].join("\n\n"),
	);
});

test("Rovo provider merges default context with per-prompt context", () => {
	assert.match(
		ROVO_CHAT_CONTEXT_SOURCE,
		/import \{[^}]*\bmergeSendPromptOptions,[^}]*\} from "@\/app\/contexts\/rovo-chat-helpers";/,
	);
	const { mergeSendPromptOptions } = loadRovoChatHelpers();
	const merged = mergeSendPromptOptions(
		{ contextDescription: "[Active Jira Work Item Context]\nKey: RFP-101\n[End Active Jira Work Item Context]", skillId: "default-skill" },
		{ contextDescription: "  [Work Summary Scope]\nSearch Jira.\n[End Work Summary Scope]  " },
	);
	assert.equal(
		merged.contextDescription,
		"[Active Jira Work Item Context]\nKey: RFP-101\n[End Active Jira Work Item Context]\n\n[Work Summary Scope]\nSearch Jira.\n[End Work Summary Scope]",
	);
	assert.equal(merged.skillId, "default-skill");
});

function loadRovoChatHelpers() {
	const result = esbuild.buildSync({
		stdin: {
			contents: 'export { mergeSendPromptOptions } from "@/app/contexts/rovo-chat-helpers";',
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "rfp-context-rovo-chat-helpers-entry.ts",
		},
		bundle: true,
		format: "cjs",
		loader: { ".css": "empty" },
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, "rfp-context-rovo-chat-helpers.cjs");
}

test("Agents view opens the richer active work item through the presentation controller", () => {
	assert.match(AGENTS_VIEW_SOURCE, /getAgentsWorkItemForCard\(card\)/);
	assert.match(AGENTS_VIEW_SOURCE, /applyRfpDemoWorkItemState\(getAgentsWorkItemForCard\(card\), rfpDemo\.state\)/);
	assert.match(AGENTS_VIEW_SOURCE, /workItemPresentation\.openModal\(workItem\)/);
	assert.match(AGENTS_VIEW_SOURCE, /workItem=\{selectedWorkItem\}/);
});

test("Agents demo feeds active work item context into RovoChatProvider defaults", () => {
	assert.match(
		JIRA_DEMO_SOURCE,
		/resolveAgentsChatScreenContext\(workItemPresentation\.state\.workItem\)/,
	);
	assert.match(JIRA_DEMO_SOURCE, /contextDescription: mergeRovoContextDescriptions/);
	assert.match(JIRA_DEMO_SOURCE, /agentsChatScreenContext\.contextDescription/);
	assert.match(JIRA_DEMO_SOURCE, /formatRfpDemoContext\(rfpDemo\.state\)/);
	assert.match(JIRA_DEMO_SOURCE, /rfpDemoContext/);
	assert.match(JIRA_DEMO_SOURCE, /const chatAgentProfiles = useMemo/);
	assert.match(JIRA_DEMO_SOURCE, /getAgentsDemoAgentProfiles\(rfpDemo\.state\)/);
	assert.match(
		JIRA_DEMO_SOURCE,
		/<RovoChatProvider[\s\S]*agentProfiles=\{chatAgentProfiles\}[\s\S]*defaultPromptOptions=\{chatPromptOptions\}/,
	);
	assert.doesNotMatch(JIRA_DEMO_SOURCE, /autoSelectAgentId/);
	assert.match(JIRA_DEMO_SOURCE, /chatContextBar=\{agentsChatScreenContext\.chatContextBar\}/);
	assert.match(JIRA_DEMO_SOURCE, /chatGreeting=\{agentsChatScreenContext\.greeting\}/);
});
