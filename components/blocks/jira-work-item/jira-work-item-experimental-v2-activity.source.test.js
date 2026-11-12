const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Activity + guided-PR-review contract tests for the `experimental-v2` Jira
// Work Item surface.
//
// These live apart from `jira-work-item-experimental-v2.source.test.js` (which owns the
// fork-isolation and shared-model contracts) because the activity composer is
// where v2 wires the most cross-component behavior: agent mentions, the
// comment/broadcast delivery split, composer context chips, and the guided PR
// review submit path that now lives in the PR sticky header.

const BLOCK_DIR = __dirname;

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

test("experimental v2 shows Submit review in the PR sticky header on guided PR review", () => {
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	const contextPillsSource = readBlockFile("experimental-v2/components/activity-composer-context-pills.tsx");
	const composerSource = readBlockFile("experimental-v2/components/activity-composer.tsx");
	const contextPanelSource = readBlockFile("experimental-v2/components/context-panel.tsx");
	const detailHeaderSource = readBlockFile(
		"experimental-v2/components/pull-request-detail/pull-request-detail-header.tsx",
	);
	const detailViewSource = readBlockFile(
		"experimental-v2/components/pull-request-detail/pull-request-detail-view.tsx",
	);

	// Visibility: open selected PR + guided review progress only — not approval-state gated.
	assert.match(
		compositionSource,
		/!selectedPullRequestIdentity[\s\S]*selectedPullRequestEntry\?\.pullRequest\?\.status !== "Open"[\s\S]*pullRequestReviewState\?\.identity !== selectedPullRequestIdentity[\s\S]*pullRequestReviewState\.total === 0/u,
	);
	assert.doesNotMatch(
		compositionSource,
		/!selectedPullRequestIdentity[\s\S]*!selectedPullRequestApprovalState[\s\S]*pullRequestReviewState/u,
	);
	assert.match(compositionSource, /label: "Submit review"/u);
	assert.doesNotMatch(compositionSource, /Review submitted/u);
	assert.match(
		compositionSource,
		/const checkedCount = reviewedChapterIds\.size \+ inlineComments\.length/u,
	);
	assert.match(
		compositionSource,
		/badge: checkedCount > 0 \? String\(checkedCount\) : undefined/u,
	);
	assert.doesNotMatch(compositionSource, /import CommentIcon from "@atlaskit\/icon\/core\/comment"/u);
	assert.doesNotMatch(compositionSource, /badge: badgeCount/u);
	assert.match(
		compositionSource,
		/disabled: !onPullRequestApprove,/u,
	);
	assert.match(
		compositionSource,
		/submitDisabled: pullRequestReviewSubmitDisabled/u,
	);
	assert.match(
		compositionSource,
		/const pullRequestReviewSubmitDisabled = !onPullRequestApprove;/u,
	);
	assert.doesNotMatch(
		compositionSource,
		/submitDisabled: !pullRequestReviewSubmissionAvailable/u,
		"guided-review availability must not disable Send while the reviewer has a draft",
	);
	// Submit review lives in the PR sticky header, not the activity context pills.
	assert.match(compositionSource, /submitReviewAction=\{pullRequestSubmitReviewAction\}/u);
	assert.doesNotMatch(compositionSource, /primaryAction=\{pullRequestReviewAction\}/u);
	assert.doesNotMatch(composerSource, /primaryAction=\{primaryAction\}/u);
	assert.doesNotMatch(contextPillsSource, /primaryAction/u);
	assert.doesNotMatch(contextPillsSource, /from "@\/components\/ui\/badge"/u);
	assert.match(contextPanelSource, /submitReviewAction=\{submitReviewAction\}/u);
	assert.match(detailViewSource, /submitReviewAction=\{submitReviewAction\}/u);
	assert.match(
		detailHeaderSource,
		/submitReviewAction=\{isOpen \? submitReviewAction : undefined\}/u,
	);
	assert.match(
		compositionSource,
		/handlePullRequestInlineCommentsChange[\s\S]*inlineComments: comments/u,
	);
	assert.match(
		compositionSource,
		/commentCount: pullRequestReviewState\.inlineComments\.length/u,
	);
	assert.match(
		composerSource,
		/commentCount=\{pullRequestReview\.commentCount\}/u,
	);
	// Context pills start with working agents, then Assign agents / Use skills.
	assert.match(
		contextPillsSource,
		/\{workingSessions\.length > 0 && onOpenAgentChat \? \([\s\S]*summaryLabel[\s\S]*<ActivityComposerAgentContextPill[\s\S]*<ActivityComposerSkillContextPill/u,
	);
	// The catalog/default surface keeps the v5-style masked composer clean: no
	// context-pill row unless a host supplies context or an agent-chat capability.
	assert.match(
		composerSource,
		/composerContextBar !== undefined \? composerContextBar : onOpenAgentChat \? \([\s\S]*<ActivityComposerContextPills[\s\S]*\) : null/u,
	);
	// Opening guided PR review must not drop the working-agents summary pill.
	assert.match(
		composerSource,
		/const workingSessions = state\.sessions\.filter\(\(session\) => session\.status !== "completed"\);/u,
	);
});

test("experimental v2 keeps comment-only composer delivery as the non-target default", () => {
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	const contextSource = readBlockFile("experimental-v2/context-jira-work-item.tsx");
	const composerSource = readBlockFile("experimental-v2/components/activity-composer.tsx");

	assert.match(contextSource, /composerDelivery = "comment"/u);
	assert.match(compositionSource, /composerAgents\?: readonly AgentSelectorAgent\[\];/u);
	assert.match(compositionSource, /<ActivityComposer[\s\S]*agents=\{composerAgents\}/u);
	assert.match(composerSource, /const availableAgents = agents \?\? ROVO_AGENT_SELECTOR_AGENTS;/u);
	assert.match(composerSource, /agents[\s\S]*subagent: agents\.map\(mapAgentToMentionItem\)[\s\S]*: EDITOR_PALETTE_MENTION_SOURCES/u);
	assert.match(
		composerSource,
		/findMentionedAvailableAgents\([\s\S]*handledAgentIds,[\s\S]*handledAgentNames,[\s\S]*for \(const invokedAgent of invokedAgents\)[\s\S]*actions\.invokeAgent/u,
	);
	assert.match(
		composerSource,
		/onAgentPromptSubmit\?\.\([\s\S]*\.\.\.handledAgentIds,[\s\S]*\.\.\.invokedAgents\.map\(\(agent\) => agent\.id\)/u,
		"composer should report both active and newly invoked mentioned agents to orchestration callbacks",
	);
	assert.match(
		composerSource,
		/meta\.composerDelivery === "broadcast-active-agents"[\s\S]*actions\.broadcastComment\(promptWithActivityContext\);[\s\S]*else \{[\s\S]*actions\.addComment\(promptWithActivityContext\);/u,
	);
});

test("experimental v2 opens Activity and scrolls to the latest entry after agent-mention submit", () => {
	const composerSource = readBlockFile("experimental-v2/components/activity-composer.tsx");
	const activityPanelSource = readBlockFile("experimental-v2/components/activity-panel.tsx");
	const metadataRailContextSource = readBlockFile("experimental-v2/context-metadata-rail.tsx");

	assert.match(
		composerSource,
		/import \{ useMetadataRail \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/context-metadata-rail"/u,
	);
	assert.match(composerSource, /const \{ requestRevealLatestActivity \} = useMetadataRail\(\);/u);
	// Only agent mention / steer / invoke paths reveal Activity — plain comments stay put.
	assert.match(
		composerSource,
		/if \(handledAgentIds\.size === 0 && invokedAgents\.length === 0\) \{[\s\S]*\} else \{[\s\S]*requestRevealLatestActivity\(\);/u,
	);
	assert.match(
		metadataRailContextSource,
		/requestRevealLatestActivity = useCallback\(\(entryId\?: string\) => \{[\s\S]*setPanelView\("activity"\)[\s\S]*setActivityRevealRequest/u,
	);
	assert.match(
		activityPanelSource,
		/import \{ useMetadataRail \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/context-metadata-rail"/u,
	);
	assert.match(
		activityPanelSource,
		/activityRevealRequest[\s\S]*consumeActivityRevealRequest[\s\S]*useMetadataRail\(\)/u,
	);
	assert.match(
		activityPanelSource,
		/requestRevealLatestActivity/u,
	);
	assert.match(
		activityPanelSource,
		/target\.closest\("\[hidden\]"\)/u,
		"reveal/auto-scroll must wait until the Activity tab is visible",
	);
	assert.match(
		activityPanelSource,
		/ACTIVITY_REVEAL_SETTLE_MS/u,
		"reveal must stay open long enough for staged prompt comments to become latest",
	);
	assert.match(
		activityPanelSource,
		/preferredEntryId \? "start" : activityScrollBlock/u,
		"targeted reveals pin the entry start (agent name); latest keeps sort-aware block",
	);
	assert.match(
		activityPanelSource,
		/activityRevealRequest\?\.entryId/u,
		"auto-scroll must defer while a targeted reveal owns the viewport",
	);
	assert.match(
		activityPanelSource,
		/scrollActivityEntryIntoView\([\s\S]*consumeActivityRevealRequest\(nonce\)/u,
	);
	assert.match(
		activityPanelSource,
		/block,/u,
	);
	assert.match(
		activityPanelSource,
		/const activityScrollBlock = sortOrder === "descending" \? "start" : "end"/u,
	);
});

test("the activity panel gives reactions and human replies somewhere to land", () => {
	const activityPanelSource = readBlockFile("experimental-v2/components/activity-panel.tsx");
	const adapterSource = readBlockFile("experimental-v2/lib/jira-activity-adapter.ts");

	// The timeline is controlled here (entries derive from meta.activityEvents),
	// so JiraActivity's built-in reducer can never apply a reaction: without an
	// explicit callback both branches of `applyAction` are inert and every
	// reaction click would be a silent no-op.
	assert.match(activityPanelSource, /onToggleReaction=\{handleToggleReaction\}/u);
	assert.match(activityPanelSource, /toggleReaction\(entry\.reactions \?\? \[\], emoji, JIRA_WORK_ITEM_CURRENT_USER\.id\)/u);
	assert.match(activityPanelSource, /collectActivityActors\(meta\.activityEvents\)/u);
	assert.doesNotMatch(
		activityPanelSource,
		/mapActivityEventsToJiraEntries\(meta\.activityEvents, activityReferenceTimeMs\)/u,
		"reaction actors must not rebuild the complete rendered timeline on every 400ms tick",
	);
	assert.match(activityPanelSource, /actors=\{reactionActors\}/u);

	// Human comments now expose Reply (allowReply flipped to true), but they have
	// no session to route into — their drafts must be kept rather than dropped.
	assert.match(adapterSource, /allowReply: true,/u);
	assert.match(activityPanelSource, /onSubmitReply=\{handleSubmitReply\}/u);
	assert.match(activityPanelSource, /actions\.replySession\(event\.sessionId, body\)/u);
	assert.match(activityPanelSource, /setLocalReplies\(\(previous\) => \(\{/u);

	// Local state is overlaid per entry id rather than replacing the derived
	// array, so streaming session updates keep flowing through untouched.
	assert.match(activityPanelSource, /const entries = derivedEntries\.map\(\(entry\) => \{/u);
	assert.doesNotMatch(activityPanelSource, /useState\(derivedEntries\)/u);
});

test("activity comments reuse the Code Review composer-pill path on the sticky activity composer", () => {
	const activityPanelSource = readBlockFile("experimental-v2/components/activity-panel.tsx");
	const activityComposerSource = readBlockFile("experimental-v2/components/activity-composer.tsx");
	const sessionSurfaceSource = readBlockFile("experimental-v2/components/floating-session-surface.tsx");
	const contextSource = readBlockFile("experimental-v2/context-activity-chat-comments.tsx");
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	const sharedChipSource = fs.readFileSync(
		path.join(BLOCK_DIR, "../../ui-custom/comments-composer-chip.tsx"),
		"utf8",
	);
	const floatingComposerSource = fs.readFileSync(
		path.join(BLOCK_DIR, "../../projects/shared/components/floating-composer.tsx"),
		"utf8",
	);

	assert.match(compositionSource, /ActivityChatCommentsProvider/u);
	assert.match(activityPanelSource, /useActivityChatComments/u);
	assert.match(activityPanelSource, /onAddCommentToChat=\{handleAddCommentToChat\}/u);
	assert.match(activityPanelSource, /onAddReplyToChat=\{handleAddReplyToChat\}/u);
	assert.match(activityPanelSource, /attachActivityCommentToComposer/u);
	assert.match(activityPanelSource, /jiraActivitySegmentsToPlainText\(entry\.body\)/u);
	assert.doesNotMatch(activityPanelSource, /openChat\("floating"\)/u);
	assert.doesNotMatch(activityPanelSource, /actions\.openLatestOrCreateGeneralSession\(\)/u);

	assert.match(contextSource, /focusRequestKey/u);
	assert.match(contextSource, /return \[\.\.\.current, comment\]/u);
	const failingChecksContextSource = readBlockFile("experimental-v2/context-failing-checks-composer.tsx");
	assert.match(failingChecksContextSource, /promptPrefill/u);
	assert.match(failingChecksContextSource, /options\?: StageFailingChecksOptions/u);

	assert.match(activityComposerSource, /CommentsComposerChip/u);
	assert.match(activityComposerSource, /FailingChecksComposerChip/u);
	assert.match(activityComposerSource, /inputContext=\{composerInputContext\}/u);
	assert.match(activityComposerSource, /inputContextSubmitText=\{composerInputContextSubmitText\}/u);
	assert.match(activityComposerSource, /subtitle: "Comment"/u);
	assert.doesNotMatch(activityComposerSource, /subtitle: comment\.timestamp/u);
	assert.match(activityComposerSource, /testId="activity-comments-chip"/u);
	assert.match(activityComposerSource, /Discuss these activity comments\./u);
	assert.match(activityComposerSource, /serializeActivityCommentsContext\(meta\.workItem, activityChatComments\)/u);
	assert.match(activityComposerSource, /serializeFailingChecksContext\(failingChecks\)/u);
	assert.match(activityComposerSource, /failingChecksPromptPrefill/u);
	assert.match(activityComposerSource, /setDraft\(failingChecksPromptPrefill\)/u);
	assert.match(activityComposerSource, /focusRequestKey/u);
	assert.match(activityComposerSource, /removeActivityChatComments\(\)/u);
	assert.match(activityComposerSource, /removeFailingChecks\(\)/u);
	assert.match(compositionSource, /FailingChecksComposerProvider/u);
	assert.match(compositionSource, /handlePullRequestFixOpen/u);
	assert.match(compositionSource, /resolvePullRequestFixCheckName/u);
	assert.match(compositionSource, /buildPullRequestFixComposerPrompt/u);
	assert.match(
		compositionSource,
		/setFixComposer\(\{\s*checkName: resolvePullRequestFixCheckName\(checks\),\s*defaultValue,\s*\}\)/u,
	);
	assert.match(compositionSource, /onPullRequestFix=\{handlePullRequestFixOpen\}/u);
	assert.match(compositionSource, /pullRequestFix=\{activePullRequestFix\}/u);
	assert.match(
		compositionSource,
		/handlePullRequestFixSubmit = useCallback<[\s\S]*\(\(submission\) => \{[\s\S]*onPullRequestFix\?\.\(selectedPullRequestIdentity, submission\.agentId\)/u,
	);
	assert.match(
		compositionSource,
		/const activePullRequestFix[\s\S]*defaultValue: fixComposer\.defaultValue/u,
	);
	assert.doesNotMatch(compositionSource, /stageChecks\(/u);
	assert.doesNotMatch(compositionSource, /onFailingChecksSubmit/u);

	assert.match(floatingComposerSource, /inputContext\?: ReactNode/u);
	assert.match(floatingComposerSource, /<PromptInputHeader/u);
	assert.doesNotMatch(sessionSurfaceSource, /CommentsComposerChip/u);
	assert.doesNotMatch(sessionSurfaceSource, /composerInputContext=/u);
	assert.match(sharedChipSource, /export function CommentsComposerChip/u);
	assert.match(sharedChipSource, /ComposerContextChip/u);
	// Inset separators match DropdownMenuSeparator (`dropdownStyles.separator`:
	// `bg-border mx-1 my-1 h-px`) — not full-bleed `divide-y`.
	const composerContextChipSource = fs.readFileSync(
		path.join(BLOCK_DIR, "../../ui-custom/composer-context-chip.tsx"),
		"utf8",
	);
	assert.match(composerContextChipSource, /dropdownStyles\.separator/u);
	assert.doesNotMatch(composerContextChipSource, /divide-y/u);
});
