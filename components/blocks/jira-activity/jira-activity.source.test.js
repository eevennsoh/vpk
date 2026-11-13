const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
	JIRA_ACTIVITY_ENTRIES,
	JIRA_ACTIVITY_CURRENT_USER,
} = require("./data.ts");
const {
	activityActorVpkLogo,
	mentionSegmentForActor,
} = require("./jira-activity-actor-mention.ts");

const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, "index.tsx"), "utf8");
const HEADER_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-header.tsx"),
	"utf8",
);
const EVENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-event.tsx"),
	"utf8",
);
const SEGMENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-segments.tsx"),
	"utf8",
);
const COMMENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-comment.tsx"),
	"utf8",
);
const IMAGE_PREVIEW_DIALOG_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-image-preview-dialog.tsx"),
	"utf8",
);
const TYPES_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-types.ts"),
	"utf8",
);
const CARD_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-card.tsx"),
	"utf8",
);
const CHANGED_FILES_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-changed-files.tsx"),
	"utf8",
);
const NODE_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-node.tsx"),
	"utf8",
);
const DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../website/demos/blocks/jira-activity-demo.tsx"),
	"utf8",
);
const DETAIL_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../app/data/details/blocks/jira-activity.ts"),
	"utf8",
);
const VARIANT_REGISTRY_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../website/registry/blocks-variants.ts"),
	"utf8",
);

test("agent mention chips use canonical agent identity without a visible at-sign", () => {
	assert.match(SEGMENTS_SOURCE, /brandName=\{segment\.brandName\}/u);
	assert.match(
		SEGMENTS_SOURCE,
		/case "agent-mention":[\s\S]*?>\s*\{segment\.text\}\s*<\/Tag>[\s\S]*?case "app-mention":/u,
	);
	assert.doesNotMatch(
		SEGMENTS_SOURCE,
		/case "agent-mention":[\s\S]*?@\{segment\.text\}[\s\S]*?case "app-mention":/u,
	);
});

test("activity events render actor prefixes as mention chips by actor kind", () => {
	const actorMentionSource = fs.readFileSync(
		path.join(__dirname, "jira-activity-actor-mention.ts"),
		"utf8",
	);
	assert.match(TYPES_SOURCE, /type: "user-mention"/u);
	assert.match(TYPES_SOURCE, /type: "agent-mention"/u);
	assert.match(TYPES_SOURCE, /type: "app-mention"/u);
	assert.match(SEGMENTS_SOURCE, /data-jira-activity-user-mention/u);
	assert.match(SEGMENTS_SOURCE, /data-jira-activity-agent-mention/u);
	assert.match(SEGMENTS_SOURCE, /data-jira-activity-app-mention/u);
	assert.match(SEGMENTS_SOURCE, /type="user"/u);
	assert.match(SEGMENTS_SOURCE, /type="agent"/u);
	assert.match(actorMentionSource, /case "person":/u);
	assert.match(actorMentionSource, /type: "user-mention"/u);
	assert.match(actorMentionSource, /case "agent":/u);
	assert.match(actorMentionSource, /type: "agent-mention"/u);
	assert.match(actorMentionSource, /case "app":/u);
	assert.match(actorMentionSource, /type: "app-mention"/u);
	assert.match(EVENT_SOURCE, /mentionSegmentForActor\(entry\.actor\)/u);
	assert.doesNotMatch(EVENT_SOURCE, /font-medium text-text">\{entry\.actor\.name\}/u);
});

test("activity events flatten pill chrome to plain text", () => {
	assert.match(SEGMENTS_SOURCE, /appearance\?: "chip" \| "plain"/u);
	assert.match(SEGMENTS_SOURCE, /appearance = "chip"/u);
	assert.match(
		EVENT_SOURCE,
		/<JiraActivitySegments\s+appearance="plain"\s+segments=\{\[mentionSegmentForActor\(entry\.actor\)\]\}/u,
	);
	assert.match(
		EVENT_SOURCE,
		/<JiraActivitySegments\s+appearance="plain"\s+segments=\{visibleEventSegments\(entry\.segments\)\}/u,
	);
	assert.match(EVENT_SOURCE, /<Lozenge variant=\{pullRequestStatusLozengeVariant\(status\)\}>\{status\}<\/Lozenge>/u);
	assert.doesNotMatch(EVENT_SOURCE, /<span className="text-text">\{status\}<\/span>/u);
	assert.doesNotMatch(COMMENT_SOURCE, /appearance="plain"/u);

	const plainBranch = SEGMENTS_SOURCE.match(
		/if \(appearance === "plain"\) \{[\s\S]*?\n\t\}/u,
	)?.[0];
	assert.ok(plainBranch, "plain appearance branch should be present");
	assert.match(plainBranch, /case "lozenge":/u);
	assert.match(plainBranch, /case "label":/u);
	assert.match(plainBranch, /case "tag":/u);
	assert.doesNotMatch(plainBranch, /case "user-mention":/u);
	assert.doesNotMatch(plainBranch, /case "agent-mention":/u);
	assert.match(plainBranch, /case "app-mention":/u);
	assert.doesNotMatch(plainBranch, /case "priority":/u);
	assert.match(plainBranch, /className="text-text"/u);
	assert.doesNotMatch(plainBranch, /<Lozenge/u);
	assert.doesNotMatch(plainBranch, /<Tag/u);
	assert.doesNotMatch(plainBranch, /<Avatar/u);
	assert.doesNotMatch(plainBranch, /<BrandLogoMark/u);
});

test("plain event appearance keeps person and agent names as mention chips", () => {
	const plainBranch = SEGMENTS_SOURCE.match(
		/if \(appearance === "plain"\) \{[\s\S]*?\n\t\}/u,
	)?.[0];
	assert.ok(plainBranch, "plain appearance branch should be present");
	assert.doesNotMatch(plainBranch, /case "user-mention":/u);
	assert.doesNotMatch(plainBranch, /case "agent-mention":/u);
	assert.match(
		SEGMENTS_SOURCE,
		/case "user-mention":[\s\S]*data-jira-activity-user-mention[\s\S]*<Avatar[\s\S]*type="user"[\s\S]*variant="editor"/u,
	);
	assert.match(
		SEGMENTS_SOURCE,
		/case "agent-mention":[\s\S]*data-jira-activity-agent-mention[\s\S]*<AgentAvatarVisual[\s\S]*type="agent"[\s\S]*variant="editor"/u,
	);
	assert.match(EVENT_SOURCE, /mentionSegmentForActor\(entry\.actor\)/u);
	assert.doesNotMatch(EVENT_SOURCE, /Triage assistant|Rovo/u);
});

test("automation events move the Automation tag onto a 12px timestamp icon", () => {
	assert.match(EVENT_SOURCE, /function isAutomationSegment/u);
	assert.match(EVENT_SOURCE, /segment\.type === "tag" && segment\.text === AUTOMATION_TAG_TEXT/u);
	assert.match(EVENT_SOURCE, /visibleEventSegments\(entry\.segments\)/u);
	assert.match(
		EVENT_SOURCE,
		/import AutomationIcon from "@atlaskit\/icon\/core\/automation"/u,
	);
	assert.match(
		EVENT_SOURCE,
		/className="size-3 shrink-0 text-text-subtlest \[&_svg\]:size-3!"/u,
	);
	assert.match(
		EVENT_SOURCE,
		/render=\{<AutomationIcon color="currentColor" label="" size="small" \/>\}/u,
	);
	assert.match(EVENT_SOURCE, /<span className="sr-only">Automation<\/span>/u);
	assert.doesNotMatch(
		EVENT_SOURCE,
		/<JiraActivitySegments[\s\S]*appearance="plain"[\s\S]*segments=\{entry\.segments\}/u,
	);

	const automatedEvents = JIRA_ACTIVITY_ENTRIES.filter(
		(entry) =>
			entry.kind === "event" &&
			entry.segments.some((segment) => segment.type === "tag" && segment.text === "Automation"),
	);
	assert.deepEqual(
		automatedEvents.map((entry) => entry.id),
		["sla", "delegated", "moved-progress"],
	);
	assert.ok(
		automatedEvents.every((entry) => entry.segments.at(-1)?.type === "tag"),
	);
});

test("app mentions render as product BrandLogoMark tags, not hexagon agent avatars", () => {
	// Agent chips keep AgentAvatarVisual + type="agent"; product/app chips use
	// BrandLogoMark (same pattern as PullRequest repo pills) without type="other".
	assert.match(
		SEGMENTS_SOURCE,
		/case "agent-mention":[\s\S]*?<AgentAvatarVisual[\s\S]*?type="agent"/u,
	);
	assert.match(
		SEGMENTS_SOURCE,
		/case "app-mention":[\s\S]*?<BrandLogoMark[\s\S]*?frame="chip"[\s\S]*?name=\{segment\.brandName\}/u,
	);
	assert.match(
		SEGMENTS_SOURCE,
		/case "app-mention":[\s\S]*?>\s*@\{segment\.text\}\s*<\/Tag>/u,
	);
	// GitHub's near-black glyph is inverted for dark mode by `BrandLogoMark`
	// itself, not here. CSS filters on nested elements compose, so a caller-level
	// `dark:invert` around the mark would double-invert it back to near-black.
	assert.doesNotMatch(
		SEGMENTS_SOURCE,
		/dark:(?:\[[^\]]*\]:)*invert/u,
		"dark-mode glyph inversion is centralized in BrandLogoMark — a caller-level invert double-inverts",
	);
	assert.doesNotMatch(
		SEGMENTS_SOURCE,
		/case "app-mention":\s*\/\/ Product tag[\s\S]*?<AgentAvatarVisual/u,
	);
	assert.doesNotMatch(
		SEGMENTS_SOURCE,
		/case "app-mention":[\s\S]*?type="other"/u,
	);
});

test("agent comments support an inline read-only progress checklist", () => {
	assert.match(
		TYPES_SOURCE,
		/progressChecklist\?: readonly JiraActivityProgressItem\[\]/u,
	);
	assert.match(COMMENT_SOURCE, /import \{ Checkbox \} from "@\/components\/ui\/checkbox";/u);
	assert.match(
		COMMENT_SOURCE,
		/<ul aria-label="Agent progress"[\s\S]*entry\.progressChecklist\.map[\s\S]*<Checkbox[\s\S]*checked=\{item\.completed\}[\s\S]*disabled/u,
	);
	// Checklist labels wrap inside the rail; checkbox stays fixed width.
	assert.match(
		COMMENT_SOURCE,
		/<ul aria-label="Agent progress" className="mt-3 grid min-w-0 gap-1\.5">/u,
	);
	assert.match(
		COMMENT_SOURCE,
		/className="mt-0\.5 shrink-0 disabled:opacity-100"/u,
	);
	assert.match(
		COMMENT_SOURCE,
		/<span className=\{cn\("min-w-0 wrap-break-word", item\.completed \? "text-text-subtlest" : null\)\}>/u,
	);
});

test("agent comments render outputs and image evidence as compact Artifact List rows", () => {
	assert.match(TYPES_SOURCE, /imageAttachment\?: JiraActivityImageAttachment/u);
	assert.match(TYPES_SOURCE, /outputs\?: readonly ArtifactListItem\[\]/u);
	assert.match(
		TYPES_SOURCE,
		/export interface JiraActivityImageAttachment[\s\S]*filename: string/u,
	);
	assert.doesNotMatch(
		TYPES_SOURCE,
		/export interface JiraActivityImageAttachment[\s\S]*description\?: string/u,
	);
	assert.match(
		COMMENT_SOURCE,
		/import \{ ArtifactList, type ArtifactListItem \} from "@\/components\/ui-custom\/artifact-list";/u,
	);
	assert.doesNotMatch(COMMENT_SOURCE, /from "next\/image"|from "@\/components\/ui\/attachment"/u);
	assert.match(
		COMMENT_SOURCE,
		/function imageAttachmentArtifact[\s\S]*source: "Image"[\s\S]*logoSrc: attachment\.src/u,
	);
	assert.match(
		COMMENT_SOURCE,
		/function commentArtifactItems[\s\S]*\.\.\.\(entry\.outputs \?\? \[\]\)[\s\S]*imageAttachmentArtifact/u,
	);
	assert.match(
		COMMENT_SOURCE,
		/<ArtifactList[\s\S]*className="mt-3 min-w-0 max-w-full border border-border bg-transparent shadow-none"[\s\S]*items=\{artifactItems\}[\s\S]*variant="compact"/u,
	);
	assert.match(COMMENT_SOURCE, /entry\.imageAttachment\?\.filename === item\.id/u);
	assert.match(COMMENT_SOURCE, /setPreviewAttachment\(entry\.imageAttachment\)/u);
	assert.match(COMMENT_SOURCE, /onOpen=\{handleOpenArtifact\}/u);
	assert.match(
		COMMENT_SOURCE,
		/function openCommentArtifact[\s\S]*window\.open\(item\.href, "_blank", "noopener,noreferrer"\)/u,
	);
	assert.match(COMMENT_SOURCE, /<JiraActivityImagePreviewDialog/u);
	assert.match(IMAGE_PREVIEW_DIALOG_SOURCE, /<Dialog open=\{attachment !== null\}/u);
	assert.match(IMAGE_PREVIEW_DIALOG_SOURCE, /sm:max-w-6xl/u);
	assert.match(IMAGE_PREVIEW_DIALOG_SOURCE, /rounded-lg border border-border bg-surface-sunken/u);
	assert.match(IMAGE_PREVIEW_DIALOG_SOURCE, /<Image[\s\S]*alt=\{attachment\.alt\}[\s\S]*src=\{attachment\.src\}/u);
});

test("sample feed covers all three entry kinds", () => {
	const kinds = new Set(JIRA_ACTIVITY_ENTRIES.map((entry) => entry.kind));
	assert.ok(kinds.has("event"));
	assert.ok(kinds.has("comment"));
	assert.ok(kinds.has("changed-files"));
});

test("changed-files activity renders agent outputs with the compact Artifact List variant", () => {
	const changedFiles = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.kind === "changed-files");
	assert.ok(changedFiles?.sessionItem, "expected an agent session summary");
	assert.equal(changedFiles.sessionItem.title, "Conduct performance benchmarking");
	assert.deepEqual(
		changedFiles.outputs.map((output) => output.title),
		["Audience Engagement Report", "Chat summary title"],
	);
	assert.match(
		CHANGED_FILES_SOURCE,
		/import \{ ArtifactList, type ArtifactListItem \} from "@\/components\/ui-custom\/artifact-list";/u,
	);
	assert.match(CHANGED_FILES_SOURCE, /items=\{entry\.outputs\}/u);
	assert.match(CHANGED_FILES_SOURCE, /variant="compact"/u);
	assert.match(CHANGED_FILES_SOURCE, /import \{[\s\S]*AgentListActivityHeader,[\s\S]*type AgentListItem,[\s\S]*\} from "@\/components\/blocks\/agent-list";/u);
	assert.match(CHANGED_FILES_SOURCE, /className="grid gap-3"[\s\S]*\{header\}/u);
	assert.match(CHANGED_FILES_SOURCE, /className="grid gap-4 p-3"[\s\S]*\{header\}/u);
	assert.doesNotMatch(CHANGED_FILES_SOURCE, /flex h-14 min-w-0 items-center/u);
	assert.doesNotMatch(CHANGED_FILES_SOURCE, /StatusSuccessIcon|\? "Done"/u);
	assert.doesNotMatch(CHANGED_FILES_SOURCE, /pullRequestNumber|Ready for review/u);
	assert.match(CHANGED_FILES_SOURCE, /metadataPrefix=\{statusPresentation \? \([\s\S]*\{statusPresentation\.label\}/u);
	assert.match(CHANGED_FILES_SOURCE, /timeFallback=\{entry\.timestamp\}/u);
	assert.match(CHANGED_FILES_SOURCE, /className="flex shrink-0 items-center gap-1 text-text"/u);
	assert.doesNotMatch(CHANGED_FILES_SOURCE, /flex shrink-0 items-center gap-1 font-medium/u);
	assert.equal(changedFiles.sessionItem.completedSecondsAgo, 5 * 60);
	assert.match(CHANGED_FILES_SOURCE, /const sessionItem = entry\.sessionItem;/u);
	assert.match(CHANGED_FILES_SOURCE, /aria-label=\{`\$\{viewActionLabel\} \$\{sessionItem\.agent\.name\}`\}/u);
	assert.match(CHANGED_FILES_SOURCE, /onClick=\{\(\) => onView\?\.\(sessionItem\)\}/u);
	assert.match(CHANGED_FILES_SOURCE, /\{viewActionLabel\}[\s\S]*viewActionLabel === "Open" \? <LinkExternalIcon label="" size="small" \/> : null/u);
	assert.doesNotMatch(CHANGED_FILES_SOURCE, /ButtonGroup|Open with \$\{item\.agent\.name\}/u);
	assert.match(CHANGED_FILES_SOURCE, /action=\{\([\s\S]*<Button[\s\S]*onClick=\{\(\) => onView\?\.\(sessionItem\)\}/u);
	assert.match(CHANGED_FILES_SOURCE, /openLabel=\{outputOpenLabel\}/u);
	assert.match(CHANGED_FILES_SOURCE, /variant\?: "activity" \| "jira-issue";/u);
	// Activity chrome matches JiraActivityCard: transparent, borderless, rounded-xl.
	assert.match(
		CHANGED_FILES_SOURCE,
		/group\/activity-card w-full overflow-visible rounded-xl bg-transparent/u,
	);
	assert.match(CHANGED_FILES_SOURCE, /"group\/activity-card w-full rounded-xl bg-transparent"/u);
	assert.doesNotMatch(CHANGED_FILES_SOURCE, /"group\/activity-card w-full bg-surface"/u);
	// Artifact list sits as a nested attachment under borderless comment chrome.
	assert.match(
		CHANGED_FILES_SOURCE,
		/border border-border bg-transparent shadow-none/u,
	);
	assert.match(CHANGED_FILES_SOURCE, /style=\{isJiraIssue \? undefined : \{ boxShadow: "none" \}\}/u);
	assert.match(CHANGED_FILES_SOURCE, /entry\.outputs\.length > 0 \? "p-3" : "px-3 pb-3 pt-0"/u);
	assert.match(
		INDEX_SOURCE,
		/<JiraActivityChangedFiles[\s\S]*entry=\{entry\}[\s\S]*hideLeadAvatar[\s\S]*onView=\{onViewSession\}/u,
	);
});

test("sample feed documents work by people, AI agents, and apps", () => {
	const actorKinds = new Set(
		JIRA_ACTIVITY_ENTRIES.map((entry) => entry.actor.kind),
	);
	assert.ok(actorKinds.has("person"));
	assert.ok(actorKinds.has("agent"));
	assert.ok(actorKinds.has("app"));
});

test("the current user is a person with an avatar (authors comments/replies)", () => {
	assert.equal(JIRA_ACTIVITY_CURRENT_USER.kind, "person");
	assert.equal(JIRA_ACTIVITY_CURRENT_USER.name, "Venn");
	assert.equal(JIRA_ACTIVITY_CURRENT_USER.avatarSrc, "/avatar-user/venn/venn.png");
});

test("Rovo mentions use the official RovoColorIcon mark, not hexagon agent art", () => {
	const rovoEntries = JIRA_ACTIVITY_ENTRIES.filter((entry) => entry.actor.name === "Rovo");
	assert.ok(rovoEntries.length > 0, "sample feed should include Rovo rows");
	for (const entry of rovoEntries) {
		assert.equal(entry.actor.vpkLogo, "rovo");
		assert.equal(entry.actor.avatarSrc, undefined);
		assert.deepEqual(mentionSegmentForActor(entry.actor), {
			type: "agent-mention",
			text: "Rovo",
			vpkLogo: "rovo",
		});
	}

	const dataSource = fs.readFileSync(path.join(__dirname, "data.ts"), "utf8");
	assert.doesNotMatch(dataSource, /jira-theme-analyzer/u);
	assert.match(SEGMENTS_SOURCE, /import \{ RovoColorIcon \} from "@\/components\/ui\/logo"/u);

	const rovoBranch = SEGMENTS_SOURCE.match(
		/segment\.vpkLogo === "rovo" \? \([\s\S]*?\) : \(/u,
	)?.[0];
	assert.ok(rovoBranch, "Rovo mention branch should be present");
	assert.match(rovoBranch, /<RovoColorIcon/u);
	assert.match(rovoBranch, /<IconTile/u);
	assert.doesNotMatch(rovoBranch, /<AgentAvatarVisual/u);
	assert.doesNotMatch(rovoBranch, /hexagon/u);
});

test("non-Rovo agent spines keep hexagon art, not the Rovo product mark", () => {
	const progressEntries = JIRA_ACTIVITY_ENTRIES.filter(
		(entry) => entry.sessionItem?.agent.name === "Progress tracker",
	);
	assert.ok(progressEntries.length >= 2, "expected Progress tracker session cards");
	for (const entry of progressEntries) {
		assert.equal(entry.actor.name, "Progress tracker");
		assert.notEqual(entry.actor.vpkLogo, "rovo");
		assert.equal(
			entry.actor.avatarSrc,
			"/avatar-agent-new/blue/backlog-buddy.svg",
		);
		assert.equal(activityActorVpkLogo(entry.actor), undefined);
		assert.deepEqual(mentionSegmentForActor(entry.actor), {
			type: "agent-mention",
			text: "Progress tracker",
			avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		});
	}

	for (const entry of JIRA_ACTIVITY_ENTRIES) {
		if (entry.actor.kind !== "agent" || entry.actor.name === "Rovo") continue;
		assert.notEqual(entry.actor.vpkLogo, "rovo");
		assert.equal(activityActorVpkLogo(entry.actor), undefined);
		assert.notEqual(mentionSegmentForActor(entry.actor).vpkLogo, "rovo");
	}

	assert.equal(
		activityActorVpkLogo({
			id: "progress-tracker",
			kind: "agent",
			name: "Progress tracker",
			vpkLogo: "rovo",
		}),
		undefined,
	);
	assert.equal(
		activityActorVpkLogo({
			id: "rovo-dev",
			kind: "agent",
			name: "Rovo",
		}),
		"rovo",
	);

	assert.match(NODE_SOURCE, /vpkLogo=\{activityActorVpkLogo\(actor\)\}/u);
	assert.match(COMMENT_SOURCE, /vpkLogo=\{activityActorVpkLogo\(actor\)\}/u);
	assert.doesNotMatch(NODE_SOURCE, /RovoColorIcon/u);
	assert.doesNotMatch(COMMENT_SOURCE, /RovoColorIcon/u);
});

test("the comment entry has a rich body and a collapsible section", () => {
	// The rich session comment is agent-authored; a human snapshot comment also
	// exists in the feed, so target the agent comment specifically.
	const comment = JIRA_ACTIVITY_ENTRIES.find(
		(entry) => entry.kind === "comment" && entry.actor.kind === "agent",
	);
	assert.ok(comment, "expected an agent comment entry");
	assert.ok(comment.collapsible, "comment should have a collapsible section");
	const bodyTypes = new Set(comment.body.map((segment) => segment.type));
	assert.ok(bodyTypes.has("code"), "body should include an inline code chip");
	assert.ok(bodyTypes.has("link"), "body should include a file/link chip");
});

test("agent/app-driven events carry a neutral event icon", () => {
	const labelled = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.id === "labelled");
	assert.equal(labelled.kind, "event");
	assert.equal(labelled.icon, "label");
});

test("status events use the neutral Project status icon", () => {
	assert.match(
		NODE_SOURCE,
		/import ProjectStatusIcon from "@atlaskit\/icon\/core\/project-status"/u,
	);
	assert.match(NODE_SOURCE, /status: ProjectStatusIcon/u);
	assert.match(NODE_SOURCE, /"in-progress": ProjectStatusIcon/u);
	assert.match(NODE_SOURCE, /className="text-icon-subtle"/u);
	assert.doesNotMatch(NODE_SOURCE, /ClockIcon|text-icon-warning/u);
});

test("description events use the Align text left work-item icon", () => {
	assert.match(
		TYPES_SOURCE,
		/\| "description"/u,
	);
	assert.match(
		NODE_SOURCE,
		/import AlignTextLeftIcon from "@atlaskit\/icon\/core\/align-text-left"/u,
	);
	assert.match(NODE_SOURCE, /description: AlignTextLeftIcon/u);
	assert.match(NODE_SOURCE, /linked: BranchIcon/u);
});

test("Teamwork Graph events use the VPK-wrapped functional icon", () => {
	assert.match(
		NODE_SOURCE,
		/import TeamworkGraphIcon from "@atlaskit\/icon-lab\/core\/teamwork-graph";/u,
	);
	assert.match(NODE_SOURCE, /"teamwork-graph": TeamworkGraphIcon/u);
	assert.match(NODE_SOURCE, /<Icon[\s\S]*render=\{<IconComponent color="currentColor" label="" size="small" \/>\}/u);
	assert.doesNotMatch(NODE_SOURCE, /TeamworkGraphMark/u);
});

test("delegated events use the ADS agent icon", () => {
	assert.match(
		NODE_SOURCE,
		/import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent"/u,
	);
	assert.match(NODE_SOURCE, /delegated: AiAgentIcon/u);
	assert.doesNotMatch(NODE_SOURCE, /ShortcutIcon/u);
	assert.doesNotMatch(NODE_SOURCE, /delegated: PersonAssigneeIcon/u);
});

test("assigned events use the ADS person-assignee icon", () => {
	assert.match(
		NODE_SOURCE,
		/import PersonAssigneeIcon from "@atlaskit\/icon-lab\/core\/person-assignee";/u,
	);
	assert.match(NODE_SOURCE, /assigned: PersonAssigneeIcon/u);
	assert.match(TYPES_SOURCE, /\| "assigned"/u);
	const assigned = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.id === "assigned");
	assert.equal(assigned.kind, "event");
	assert.equal(assigned.icon, "assigned");
});

test("commit, pull-request, and app events map to ADS SCM/app glyphs", () => {
	assert.match(TYPES_SOURCE, /\| "commit"/u);
	assert.match(TYPES_SOURCE, /\| "pull-request"/u);
	assert.match(TYPES_SOURCE, /\| "app"/u);
	assert.match(
		NODE_SOURCE,
		/import CommitIcon from "@atlaskit\/icon\/core\/commit"/u,
	);
	assert.match(
		NODE_SOURCE,
		/import PullRequestIcon from "@atlaskit\/icon\/core\/pull-request"/u,
	);
	assert.match(
		NODE_SOURCE,
		/import AppIcon from "@atlaskit\/icon\/core\/app"/u,
	);
	assert.match(NODE_SOURCE, /commit: CommitIcon/u);
	assert.match(NODE_SOURCE, /"pull-request": PullRequestIcon/u);
	assert.match(NODE_SOURCE, /app: AppIcon/u);
});

test("PR activity nodes use PullRequestIcon, not BranchIcon", () => {
	const prEntries = JIRA_ACTIVITY_ENTRIES.filter(
		(entry) => entry.kind === "event" && entry.pullRequest,
	);
	assert.ok(prEntries.length > 0, "expected a pull-request activity row");
	for (const entry of prEntries) {
		assert.equal(entry.icon, "pull-request");
	}
	assert.match(NODE_SOURCE, /"pull-request": PullRequestIcon/u);
	assert.match(NODE_SOURCE, /linked: BranchIcon/u);
	assert.match(
		INDEX_SOURCE,
		/entry\.kind === "event"\s*\? \(entry\.pullRequest \? "pull-request" : entry\.icon\)\s*: undefined/u,
	);
});

test("event rows prefer EventGlyph over ActorGlyph whenever icon is set", () => {
	// Commit/push gutters must not fall through to AgentAvatarVisual.
	// The choice lives in JiraActivityEntryGlyph, shared by event rows and the Butter timeline preview.
	assert.match(
		NODE_SOURCE,
		/function JiraActivityEntryGlyph[\s\S]*?icon !== undefined \? <EventGlyph icon=\{icon\} \/> : <ActorGlyph[\s\S]*?<JiraActivityEntryGlyph actor=\{actor\} icon=\{icon\} \/>/u,
	);
	assert.match(NODE_SOURCE, /commit: CommitIcon/u);
	assert.match(
		NODE_SOURCE,
		/function ActorGlyph[\s\S]*?<AgentAvatarVisual[\s\S]*?function EventGlyph/u,
	);
	const eventGlyph = NODE_SOURCE.match(
		/function EventGlyph\([\s\S]*?\n\}\n/u,
	)?.[0];
	assert.ok(eventGlyph, "EventGlyph function should be present");
	assert.match(eventGlyph, /EVENT_ICON\[icon\]/u);
	assert.doesNotMatch(eventGlyph, /AgentAvatarVisual/u);
});

test("the Medium priority event uses the Agent Sessions priority icon treatment", () => {
	const assigned = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.id === "assigned");
	assert.equal(assigned.kind, "event");
	assert.deepEqual(assigned.segments.at(-1), { type: "priority", text: "Medium" });
	assert.match(
		TYPES_SOURCE,
		/export type JiraActivityPriority = "Highest" \| "High" \| "Medium" \| "Low" \| "Lowest"/u,
	);
	assert.match(TYPES_SOURCE, /type: "priority"; text: JiraActivityPriority/u);
	assert.match(SEGMENTS_SOURCE, /PriorityHighestIcon/u);
	assert.match(SEGMENTS_SOURCE, /PriorityHighIcon/u);
	assert.match(SEGMENTS_SOURCE, /PriorityMediumIcon/u);
	assert.match(SEGMENTS_SOURCE, /PriorityLowIcon/u);
	assert.match(SEGMENTS_SOURCE, /PriorityLowestIcon/u);
	assert.match(SEGMENTS_SOURCE, /Highest: "text-icon-danger"/u);
	assert.match(SEGMENTS_SOURCE, /High: "text-icon-danger"/u);
	assert.match(SEGMENTS_SOURCE, /Medium: "text-icon-warning"/u);
	assert.match(SEGMENTS_SOURCE, /Low: "text-icon-information"/u);
	assert.match(SEGMENTS_SOURCE, /Lowest: "text-icon-information"/u);
	assert.match(
		SEGMENTS_SOURCE,
		/case "priority":[\s\S]*<span className="text-text">\{segment\.text\}<\/span>/u,
	);
});

test("inline code chips use the ADS code family at 12px", () => {
	assert.match(SEGMENTS_SOURCE, /from "@\/lib\/tokens"/u);
	assert.match(SEGMENTS_SOURCE, /fontFamily: token\("font\.family\.code"\)/u);
	assert.match(SEGMENTS_SOURCE, /CHIP_BASE = "rounded-xs px-1 text-xs leading-4 align-middle"/u);
	assert.doesNotMatch(SEGMENTS_SOURCE, /text-\[0\.8125rem\]|font-mono text-/u);
});

test("work-item labels render as Tags; workflow states stay lozenges", () => {
	const labelled = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.id === "labelled");
	const movedTodo = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.id === "moved-todo");
	const movedProgress = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.id === "moved-progress");
	assert.deepEqual(
		labelled.segments.filter((segment) => segment.type === "label"),
		[
			{ type: "label", text: "Bug", color: "red" },
			{ type: "label", text: "UI Polish", color: "green" },
		],
	);
	assert.deepEqual(
		movedTodo.segments.filter((segment) => segment.type === "lozenge").map((segment) => segment.text),
		["Triage", "Todo"],
	);
	assert.deepEqual(
		movedProgress.segments.filter((segment) => segment.type === "lozenge").map((segment) => segment.text),
		["Todo", "In Progress"],
	);
	assert.deepEqual(
		movedTodo.segments.filter((segment) => segment.type === "transition-arrow"),
		[{ type: "transition-arrow" }],
	);
	assert.deepEqual(
		movedProgress.segments.filter((segment) => segment.type === "transition-arrow"),
		[{ type: "transition-arrow" }],
	);
	assert.match(SEGMENTS_SOURCE, /import ArrowRightIcon from "@atlaskit\/icon\/core\/arrow-right"/u);
	assert.match(SEGMENTS_SOURCE, /className="mx-1 align-middle text-icon-subtle"/u);
	assert.match(SEGMENTS_SOURCE, /case "label":[\s\S]*<Tag[\s\S]*data-jira-activity-label/u);
	assert.match(SEGMENTS_SOURCE, /case "lozenge":[\s\S]*<Lozenge className="align-middle"/u);
	assert.doesNotMatch(SEGMENTS_SOURCE, /LABEL_LOZENGE_VARIANT|LABEL_DOT_CLASS/u);
});

test("agent output cards summarize the change and expose a View action", () => {
	// The card can open its owning session, so it accepts an onView handler that
	// the timeline wires from onViewSession.
	assert.match(CHANGED_FILES_SOURCE, /type AgentListItem,/u);
	assert.match(CHANGED_FILES_SOURCE, /onView\?: \(item: AgentListItem\) => void/u);
	assert.match(
		INDEX_SOURCE,
		/<JiraActivityChangedFiles[\s\S]*entry=\{entry\}[\s\S]*hideLeadAvatar[\s\S]*onView=\{onViewSession\}/u,
	);
	// A short generated-work summary renders as its own paragraph above the outputs.
	assert.match(
		CHANGED_FILES_SOURCE,
		/<p className="text-sm leading-5 text-text">\{entry\.description\}<\/p>/u,
	);
	// The ellipsis "More actions" affordance is replaced by a persistent,
	// caller-labelled action. Only the external "Open" treatment gets the
	// external-link icon; in-product custom artifacts use "View".
	assert.match(CHANGED_FILES_SOURCE, /\{viewActionLabel\}/u);
	assert.match(
		CHANGED_FILES_SOURCE,
		/viewActionLabel === "Open" \? <LinkExternalIcon label="" size="small" \/> : null/u,
	);
});

test("Jira Activity exposes controlled entries and replaceable composer contracts", () => {
	assert.match(INDEX_SOURCE, /defaultEntries\?: readonly JiraActivityEntry\[\]/u);
	assert.match(INDEX_SOURCE, /onEntriesChange\?: \(entries: readonly JiraActivityEntry\[\]\) => void/u);
	assert.match(INDEX_SOURCE, /composer\?: ReactNode \| null/u);
	assert.match(INDEX_SOURCE, /renderCommentAction\?: \(entry:/u);
	assert.match(INDEX_SOURCE, /renderEntry\?: \(entry: JiraActivityEntry\) => ReactNode \| undefined/u);
	assert.match(INDEX_SOURCE, /activeEntryId\?: string/u);
	assert.match(INDEX_SOURCE, /onAddCommentToChat\?: \(entry: JiraActivityCommentEntry\) => void/u);
	assert.match(INDEX_SOURCE, /onAddReplyToChat\?: \(reply: JiraActivityReply, entry: JiraActivityCommentEntry\) => void/u);
	assert.match(INDEX_SOURCE, /onViewSession\?: \(item: AgentListItem\) => void/u);
	assert.match(INDEX_SOURCE, /onViewSession=\{onViewSession\}/u);
	assert.match(INDEX_SOURCE, /composer === undefined/u);
	assert.match(INDEX_SOURCE, /filter\?: JiraActivityFilter/u);
	assert.match(INDEX_SOURCE, /defaultFilter\?: JiraActivityFilter/u);
	assert.match(INDEX_SOURCE, /onFilterChange\?: \(next: JiraActivityFilter\) => void/u);
	assert.match(INDEX_SOURCE, /data-jira-activity-entry-id=\{entry\.id\}/u);
	assert.match(INDEX_SOURCE, /aria-current=\{entry\.id === activeEntryId \? "step" : undefined\}/u);
	assert.match(INDEX_SOURCE, /data-active=\{entry\.id === activeEntryId \? "" : undefined\}/u);
	assert.match(INDEX_SOURCE, /const customEntry = renderEntry\?\.\(entry\);/u);
	assert.match(INDEX_SOURCE, /const defaultEntry = entry\.kind === "event"/u);
	assert.match(INDEX_SOURCE, /customEntry !== undefined \? customEntry : defaultEntry/u);
	// Timeline rows shrink inside narrow rails so artifact titles can truncate.
	assert.match(INDEX_SOURCE, /className=\{cn\("group\/activity flex w-full min-w-0 flex-col gap-4", className\)\}/u);
	assert.match(INDEX_SOURCE, /className="group\/activity-event flex min-w-0 gap-2"/u);
});

test("activity comments expose an outlined Add to chat control left of expand/collapse", () => {
	const addToChatSource = fs.readFileSync(
		path.join(__dirname, "jira-activity-add-to-chat-button.tsx"),
		"utf8",
	);
	const commentTextSource = fs.readFileSync(
		path.join(__dirname, "lib/jira-activity-comment-text.ts"),
		"utf8",
	);

	assert.match(addToChatSource, /import CommentAddIcon from "@atlaskit\/icon\/core\/comment-add"/u);
	assert.match(addToChatSource, /aria-label="Add to chat"/u);
	assert.match(addToChatSource, /variant="outline"/u);
	assert.doesNotMatch(addToChatSource, /variant="ghost"/u);
	assert.match(addToChatSource, /<TooltipProvider delay=\{0\}>/u);
	assert.match(addToChatSource, /<TooltipContent>Add to chat<\/TooltipContent>/u);
	assert.match(COMMENT_SOURCE, /JiraActivityAddToChatButton/u);
	assert.match(COMMENT_SOURCE, /onAddToChat\?: \(\) => void/u);
	assert.match(COMMENT_SOURCE, /onAddReplyToChat\?: \(reply: JiraActivityReply\) => void/u);
	assert.match(
		COMMENT_SOURCE,
		/\{action\}[\s\S]*\{addToChatAction\}[\s\S]*\{repliesToggle\}/u,
	);
	assert.match(INDEX_SOURCE, /onAddToChat=\{\s*onAddCommentToChat\s*\? \(\) => onAddCommentToChat\(entry\)/u);
	assert.match(commentTextSource, /export function jiraActivitySegmentsToPlainText/u);
	assert.match(commentTextSource, /export function serializeActivityCommentsContext/u);
	assert.match(commentTextSource, /Activity comments \(local prompt context\):/u);
});

test("the header shows an activity count and a text-link sort control", () => {
	// Count with singular/plural wording.
	assert.match(HEADER_SOURCE, /\{count\}\s*\{count === 1 \? "Activity" : "Activities"\}/u);
	// Trigger keeps a short "Show …" form; menu items drop Show/first/only.
	assert.match(HEADER_SOURCE, /ascending: "Show oldest"/u);
	assert.match(HEADER_SOURCE, /descending: "Show latest"/u);
	assert.match(HEADER_SOURCE, /"agents-only": "Show agents"/u);
	assert.match(HEADER_SOURCE, /"needs-input": "Show needs input"/u);
	assert.match(HEADER_SOURCE, /"comments-only": "Show comments"/u);
	assert.match(HEADER_SOURCE, /"insights-only": "Show insights"/u);
	assert.match(HEADER_SOURCE, /ascending: "Oldest"/u);
	assert.match(HEADER_SOURCE, /descending: "Latest"/u);
	assert.match(HEADER_SOURCE, /"agents-only": "Agents"/u);
	assert.match(HEADER_SOURCE, /"needs-input": "Needs input"/u);
	assert.match(HEADER_SOURCE, /"comments-only": "Comments"/u);
	assert.match(HEADER_SOURCE, /"insights-only": "Insights"/u);
	assert.doesNotMatch(HEADER_SOURCE, /Show (?:latest|oldest) first|Agents only|Show agents only/u);
	// Compact menu: override default min-w-56 so short labels hug content.
	assert.match(HEADER_SOURCE, /className="w-auto min-w-0"/u);
	// Sort trigger is a borderless text link, not a bordered pill.
	assert.match(HEADER_SOURCE, /hover:underline/u);
	assert.match(HEADER_SOURCE, /text-text-subtlest \[&_svg\]:text-icon-subtlest/u);
	assert.match(HEADER_SOURCE, /ACTIVITY_SORT_TRIGGER_REVEAL_CLASS/u);
	assert.match(HEADER_SOURCE, /pointer-events-none opacity-0/u);
	assert.match(HEADER_SOURCE, /group-hover\/activity:opacity-100/u);
	assert.doesNotMatch(HEADER_SOURCE, /group-focus-within\/activity:opacity-100/u);
	assert.match(HEADER_SOURCE, /group-has-\[:focus-visible\]\/activity:opacity-100/u);
	assert.match(HEADER_SOURCE, /aria-expanded:opacity-100/u);
	assert.match(HEADER_SOURCE, /motion-reduce:transition-none/u);
	assert.doesNotMatch(HEADER_SOURCE, /display:\s*none/u);
	// Its portal clears the work-item dialog's z-index.
	assert.match(HEADER_SOURCE, /positionerClassName="z-\[502\]"/u);
	// View/sort control is extractable for rail relocation; count can be omitted.
	assert.match(HEADER_SOURCE, /export function JiraActivityViewControl/u);
	assert.match(HEADER_SOURCE, /trigger = "label"/u);
	assert.match(HEADER_SOURCE, /trigger\?: "label" \| "chevron"/u);
	assert.match(
		HEADER_SOURCE,
		/data-jira-work-item-metadata-rail-sort-trigger="activity"/u,
	);
	// Chevron trigger is an inset ghost icon (not a heavy outline segment).
	// Shell inset on top/right/bottom (`my-1 me-1`); label→icon gap is segment `gap-1.5`.
	assert.match(
		HEADER_SOURCE,
		/CHEVRON_TRIGGER_CLASS =\s*"my-1 me-1 shrink-0 border-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0! focus-visible:ring-offset-0!"/u,
	);
	assert.doesNotMatch(
		HEADER_SOURCE,
		/CHEVRON_TRIGGER_CLASS[\s\S]*aria-expanded:border-transparent/u,
	);
	assert.doesNotMatch(
		HEADER_SOURCE,
		/isChevron \? \([\s\S]*aria-pressed=\{pressed \|\| undefined\}/u,
	);
	assert.match(
		HEADER_SOURCE,
		/isChevron \? \([\s\S]*className=\{CHEVRON_TRIGGER_CLASS\}[\s\S]*size="icon-compact"[\s\S]*variant="ghost"/u,
	);
	assert.match(HEADER_SOURCE, /showAgentsOption = true/u);
	assert.match(HEADER_SOURCE, /filterMode\?: JiraActivityViewFilterMode/u);
	assert.match(HEADER_SOURCE, /PULL_REQUEST_ACTIVITY_FILTER_VALUES/u);
	assert.doesNotMatch(HEADER_SOURCE, /DropdownMenuSeparator/u);
	assert.match(HEADER_SOURCE, /listedFilters\.map/u);
	assert.match(HEADER_SOURCE, /case "pull-request":/u);
	assert.match(HEADER_SOURCE, /showCount = true/u);
	assert.match(HEADER_SOURCE, /showCount \? \(/u);
	assert.match(HEADER_SOURCE, /flex w-full min-w-0 items-center justify-between gap-2/u);
	assert.match(HEADER_SOURCE, /menuAlign="end"/u);
	assert.doesNotMatch(
		HEADER_SOURCE,
		/\{count === 1 \? "Activity" : "Activities"\}[\s\S]*<span aria-hidden[\s\S]*·/u,
	);
	assert.match(INDEX_SOURCE, /hideHeader\?: boolean/u);
	assert.match(INDEX_SOURCE, /hideHeader = false/u);
	assert.match(INDEX_SOURCE, /hideHeader \? null : \(/u);
	assert.match(
		INDEX_SOURCE,
		/export \{\s*JiraActivityHeader,\s*JiraActivityViewControl,\s*\} from "\.\/jira-activity-header"/u,
	);
});

test("the header offers Insights only to insight-aware Jira consumers", () => {
	const expectedAgentCards = JIRA_ACTIVITY_ENTRIES.filter(
		(entry) =>
			entry.actor.kind === "agent" &&
			(entry.kind === "comment" || (entry.kind === "changed-files" && entry.outputs !== undefined)),
	);
	assert.deepEqual(
		expectedAgentCards.map((entry) => entry.kind),
		["comment", "changed-files"],
	);
	assert.match(
		HEADER_SOURCE,
		/const JIRA_ACTIVITY_FILTER_VALUES = \[\s*"agents-only",\s*"needs-input",\s*"comments-only",\s*\]/u,
	);
	assert.match(
		HEADER_SOURCE,
		/const JIRA_ACTIVITY_INSIGHTS_FILTER_VALUES = \[\s*\.\.\.JIRA_ACTIVITY_FILTER_VALUES,\s*"insights-only",\s*\]/u,
	);
	assert.match(
		HEADER_SOURCE,
		/const PULL_REQUEST_ACTIVITY_FILTER_VALUES = \[\s*"comments-only",\s*\]/u,
	);
	assert.match(
		HEADER_SOURCE,
		/const activeLabel = filterActive\s*\? FILTER_TRIGGER_LABELS\[filter\]\s*: SORT_TRIGGER_LABELS\[sortOrder\]/u,
	);
	assert.match(TYPES_SOURCE, /\| "needs-input"/u);
	assert.match(TYPES_SOURCE, /\| "comments-only"/u);
	assert.match(TYPES_SOURCE, /\| "insights-only"/u);
	assert.match(TYPES_SOURCE, /category\?: "insight"/u);
	assert.match(TYPES_SOURCE, /createdAtMs\?: number/u);
	assert.match(INDEX_SOURCE, /filterJiraActivityEntries\(entries, filter\)/u);
	assert.match(INDEX_SOURCE, /count=\{visibleEntries\.length\}/u);
	// Sample feed seeds a waiting agent comment for the Needs input filter.
	const needsInput = JIRA_ACTIVITY_ENTRIES.filter(
		(entry) => entry.kind === "comment" && entry.sessionItem?.state === "needs-input",
	);
	assert.equal(needsInput.length, 1);
	assert.equal(needsInput[0].id, "root-cause");
});

test("the header omits the separator and collapse control", () => {
	assert.doesNotMatch(HEADER_SOURCE, /relative h-6 min-w-2 flex-1/u);
	assert.doesNotMatch(HEADER_SOURCE, /aria-label=\{collapsed \? "Expand activity" : "Collapse activity"\}/u);
	assert.doesNotMatch(HEADER_SOURCE, /onCollapsedChange/u);
});

test("Jira Activity supports externally controlled collapse state", () => {
	assert.match(INDEX_SOURCE, /collapsed\?: boolean/u);
	assert.doesNotMatch(INDEX_SOURCE, /defaultCollapsed/u);
	assert.doesNotMatch(INDEX_SOURCE, /onCollapsedChange/u);
	assert.match(INDEX_SOURCE, /const collapsed = controlledCollapsed \?\? false;/u);
	// Timeline and composer are gated behind the collapsed flag.
	assert.match(INDEX_SOURCE, /\{collapsed \? null : \(\s*<ol/u);
	assert.match(INDEX_SOURCE, /count=\{visibleEntries\.length\}/u);
});

test("the linked event uses the Jira Queue pull-request row", () => {
	const linked = JIRA_ACTIVITY_ENTRIES.find((entry) => entry.id === "linked");
	assert.equal(linked.kind, "event");
	assert.equal(linked.icon, "pull-request");
	assert.deepEqual(linked.pullRequest, {
		number: 1847,
		title: "Fix threaded comment highlight bottom corners",
		status: "Open",
		additions: 148,
		deletions: 37,
		authorName: "Venn",
		repository: "acme/storefront",
		branch: "fix/comment-highlight",
		targetBranch: "main",
		createdAtMs: Date.UTC(2026, 4, 12, 13, 40),
		updatedAtMs: Date.UTC(2026, 4, 12, 13, 58),
	});
	assert.doesNotMatch(EVENT_SOURCE, /created pull request/u);
	assert.match(EVENT_SOURCE, /function pullRequestStatusLozengeVariant/u);
	assert.match(EVENT_SOURCE, /case "Open":\s*return "success"/u);
	assert.match(EVENT_SOURCE, /case "Merged":\s*return "discovery"/u);
	assert.match(EVENT_SOURCE, /const _exhaustive: never = status/u);
	assert.match(EVENT_SOURCE, /<Lozenge variant=\{pullRequestStatusLozengeVariant\(status\)\}>\{status\}<\/Lozenge>/u);
	assert.doesNotMatch(EVENT_SOURCE, /<span className="text-text">\{status\}<\/span>/u);
	assert.match(EVENT_SOURCE, /className="flex min-w-0 items-center gap-1"/u);
	assert.match(EVENT_SOURCE, /className="flex shrink-0 items-center gap-1"/u);
	assert.match(EVENT_SOURCE, /className="text-text-success">\+\{additions\}/u);
	assert.match(EVENT_SOURCE, /className="text-text-danger">-\{deletions\}/u);
	assert.match(EVENT_SOURCE, /onOpenPullRequest\?: \(entry: JiraActivityEventEntry\) => void/u);
	assert.match(
		EVENT_SOURCE,
		/onOpenPullRequest \? \(\s*<button[\s\S]*type="button"[\s\S]*hover:underline[\s\S]*onClick=\{\(\) => onOpenPullRequest\(entry\)\}[\s\S]*\{titleLabel\}[\s\S]*<\/button>\s*\) : \(\s*<span className="min-w-0 truncate text-text"/u,
	);
	assert.match(INDEX_SOURCE, /onOpenPullRequest\?: \(entry: JiraActivityEventEntry\) => void/u);
	assert.match(
		INDEX_SOURCE,
		/<JiraActivityEvent[\s\S]*entry=\{entry\}[\s\S]*onOpenPullRequest=\{onOpenPullRequest\}/u,
	);
	assert.doesNotMatch(EVENT_SOURCE, /font-mono|ml-auto|flex-1 truncate text-text/u);
});

test("Jira Activity owns the shared activity card used by agent comments", () => {
	assert.match(
		COMMENT_SOURCE,
		/import \{ JiraActivityCard \} from "\.\/jira-activity-card"/u,
	);
	assert.match(COMMENT_SOURCE, /<JiraActivityCard/u);
	assert.match(COMMENT_SOURCE, /<\/JiraActivityCard>/u);
	assert.match(COMMENT_SOURCE, /item=\{entry\.sessionItem\}/u);
	assert.match(COMMENT_SOURCE, /onView=\{onViewSession\}/u);
	assert.match(
		INDEX_SOURCE,
		/export \{ JiraActivityCard, type JiraActivityCardProps \} from "\.\/jira-activity-card"/u,
	);
	assert.match(CARD_SOURCE, /export interface JiraActivityCardProps/u);
	assert.match(CARD_SOURCE, /export function JiraActivityCard/u);
	assert.match(
		CARD_SOURCE,
		/import \{\s*AgentListActivityHeader,[\s\S]*type AgentListItem,[\s\S]*\} from "@\/components\/blocks\/agent-list"/u,
	);
	assert.match(CARD_SOURCE, /<AgentListActivityHeader/u);
	assert.match(CARD_SOURCE, /<AgentListActivityHeader[\s\S]*leadWithAgentName/u);
	assert.match(CARD_SOURCE, /messageTimestamp=\{timestamp\}/u);
	assert.match(CARD_SOURCE, /timestampMeta\?: ReactNode/u);
	assert.match(CARD_SOURCE, /<span className="shrink-0">\{timestamp\}<\/span>[\s\S]*\{timestampMeta\}/u);
	assert.match(CARD_SOURCE, /activityGroupClass[\s\S]*group\/activity-card/u);
	// Hover group wraps the outer card (header + body + replies), not only the body grid.
	assert.match(
		CARD_SOURCE,
		/activityGroupClass,\s*\/\/[\s\S]*?"w-full min-w-0 overflow-visible bg-transparent"/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /"group\/activity-card w-full overflow-hidden/u);
	assert.match(CARD_SOURCE, /actionVisibilityClass[\s\S]*group-hover\/activity-card:opacity-100/u);
	// Comment cards are borderless and transparent — no fill over the feed surface.
	// Overflow stays visible so Avatar's hover scale is not clipped on the flush card edge.
	// min-w-0 keeps checklist / artifact content from forcing a horizontal rail scrollbar.
	assert.match(CARD_SOURCE, /"w-full min-w-0 overflow-visible bg-transparent"/u);
	assert.match(
		CARD_SOURCE,
		/const body = \(\s*<div className="min-w-0 text-sm leading-5 text-text">\{children\}<\/div>\s*\);/u,
	);
	assert.match(CARD_SOURCE, /\{body\}/u);
	assert.doesNotMatch(CARD_SOURCE, /<\/div>\s*\{children\}/u);
	assert.doesNotMatch(CARD_SOURCE, /"w-full overflow-visible bg-surface"/u);
	assert.doesNotMatch(CARD_SOURCE, /"w-full overflow-hidden bg-surface"/u);
	assert.doesNotMatch(CARD_SOURCE, /border border-border|border-t border-border|showFooterBorder/u);
	// Both human and agent comments render the shared prompt-input composer on
	// the compact in-card surface (same floating chrome, smaller controls).
	assert.match(COMMENT_SOURCE, /variant="flush"/u);
	assert.doesNotMatch(COMMENT_SOURCE, /variant="reply"|variant="comment"/u);
	assert.match(
		COMMENT_SOURCE,
		/entry\.sessionItem\s*\? "Ask, @mention, or \/ for actions"\s*:\s*"Leave a reply\.\.\."/u,
	);
	assert.match(COMMENT_SOURCE, /entry\.sessionItem\s*\? undefined\s*:\s*entry\.collapsible/u);
	assert.doesNotMatch(
		COMMENT_SOURCE,
		/w-full overflow-hidden rounded-lg border border-border bg-surface/u,
	);
});

test("documents the standalone activity card under Jira Activity", () => {
	assert.match(DETAIL_SOURCE, /title: "Activity card"/u);
	assert.match(DETAIL_SOURCE, /demoSlug: "jira-activity-demo-activity-card"/u);
	assert.match(DETAIL_SOURCE, /name: "JiraActivityCard"/u);
	assert.match(DEMO_SOURCE, /export function JiraActivityCardDemo/u);
	assert.match(DEMO_SOURCE, /<JiraActivityCard/u);
	assert.match(DEMO_SOURCE, /item=\{entry\.sessionItem\}/u);
	assert.match(DEMO_SOURCE, /placeholder="Ask, @mention, or \/ for actions"/u);
	// The compact in-card geometry is the composer's own `flush` surface, not a
	// className blob copied into each callsite.
	assert.match(DEMO_SOURCE, /variant="flush"/u);
	assert.doesNotMatch(DEMO_SOURCE, /overflow-visible px-1\.5 pt-1 pb-3/u);
	assert.doesNotMatch(DEMO_SOURCE, /border-0 rounded-none bg-transparent/u);
	assert.match(
		VARIANT_REGISTRY_SOURCE,
		/"jira-activity-demo-activity-card"[\s\S]*JiraActivityCardDemo/u,
	);
});
