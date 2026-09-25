const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Contract tests for the `experimental-v2` fork of the Jira Work Item surface.
//
// v2 was created as a full copy of `experimental/` so it can diverge on any
// pixel without risk to v1. These tests protect the two properties that make
// that fork safe rather than merely duplicated:
//
//   1. Isolation — neither tree imports the other, so an edit in one can never
//      change the other's rendered surface.
//   2. A shared model — the session/planner reducer under `data/` stays single-
//      sourced, so behavioral fixes reach both variants.
//
// As v2 diverges, the "starts as a duplicate" assertion below is expected to be
// relaxed; isolation and the shared model are the durable contracts.

const BLOCK_DIR = __dirname;
const V1_DIR = path.join(BLOCK_DIR, "experimental");
const V2_DIR = path.join(BLOCK_DIR, "experimental-v2");

// V2 intentionally diverges in its ArtifactPane-backed metadata rail and its
// persistent-panel header controls. Every other mirrored module stays
// structurally synchronized with v1.
const V2_DIVERGENCES = new Set([
	"components/context-panel.tsx",
	"components/context-editable-header.tsx",
	"components/context-resources.tsx",
	"components/context-title-actions.tsx",
	"components/context-title-bar.tsx",
	// v2 titles use ADS `font.heading.xxlarge`; v1 keeps the text-xl utility treatment.
	"components/inline-edit-treatment.ts",
	"components/detail-field-editors.tsx",
	"components/details-sections.tsx",
	"components/experimental-breadcrumb-actions.tsx",
	"components/experimental-work-item-dialog.tsx",
	"components/experimental-work-item-layout.tsx",
	"components/floating-session-surface.tsx",
	"components/details-tab.tsx",
	"components/activity-panel.tsx",
	"components/activity-composer-context-pills.tsx",
	"components/activity-composer.tsx",
	"components/automation-tab.tsx",
	"components/ai-planner-panel.tsx",
	"components/metadata-rail.tsx",
	"context-jira-work-item.tsx",
	"lib/activity-composer-session-routing.ts",
	"lib/jira-activity-adapter.test.js",
	"lib/jira-activity-adapter.ts",
	"use-jira-work-item-controller.ts",
	// The three context popovers moved to segmented tabs and the shared
	// `context-popover-parts` chrome; v1 keeps its original underline treatment.
	"components/attachments-popover.tsx",
	"components/subtasks-popover.tsx",
	"components/linked-work-items-popover.tsx",
	// v2 opens the agent/skill selectors with the borderless editor-palette
	// search bar so they match the "/" menu and the metadata pickers on the
	// same screen; v1 keeps the boxed CommandInput.
	"components/activity-composer-agent-context-pill.tsx",
	"components/activity-composer-skill-context-pill.tsx",
	"experimental-v2-jira-work-item.tsx",
]);

// Modules that exist only in v2. They have no v1 twin, so they are excluded
// from the structural-duplicate comparison but must still be declared here so
// an accidental new file is caught rather than silently accepted.
const V2_ONLY_FILES = new Set([
	"components/development-repository-picker.tsx",
	"components/experimental-header-overflow-menu.tsx",
	"components/context-popover-parts.tsx",
	// Shared Activity → chat comment-pill state (Code Review composerInputContext path).
	"context-activity-chat-comments.tsx",
	// Failing CI checks → activity composer chip (legacy staging helpers).
	"context-failing-checks-composer.tsx",
	"lib/failing-checks-composer-context.ts",
	"lib/failing-checks-composer-context.test.js",
	// Shared TipTap description surface used by WI ContextEditableDescription
	// and PullRequestOverview — v1 keeps its own inline RichTextEditor wiring.
	"components/context-description-editor.tsx",
	// Status + Reported by under the editable title (migrated out of Details rail).
	"components/context-title-meta.tsx",
	// Details/Activities toggle lives at the top of the metadata rail (extracted module).
	"components/metadata-rail-toggle.tsx",
	"context-metadata-rail.tsx",
	// Details/Activity/PR view union + type guard (kept out of the provider
	// module so Fast Refresh can treat that file as components/hooks only).
	"lib/metadata-rail-view.ts",
	// Pull requests Select in ContextResources; v1 has no PR surface.
	"components/pull-requests-panel.tsx",
	"components/pull-requests-select.tsx",
	"components/pull-request-sort-control.tsx",
	"components/pull-request-detail/pull-request-files.tsx",
	"components/pull-request-detail/pull-request-guide.tsx",
	// Guided-review chapter jump + scroll-spy (v2 PR surface only).
	"lib/pull-request-guide-active-chapter.ts",
	"lib/pull-request-guide-active-chapter.test.js",
	"components/pull-request-detail/pull-request-detail-header.tsx",
	"components/pull-request-detail/pull-request-overview.tsx",
	"components/pull-request-detail/pull-request-detail-view.tsx",
	"components/pull-request-detail/pull-request-context-rail.tsx",
	"components/pull-request-detail/pull-request-details-rail.tsx",
	"components/pull-request-detail/pull-request-activity-panel.tsx",
	"components/pull-request-detail/pull-request-sticky-header-shell.tsx",
	// v2 promotes `@Agent` runs in authored comment copy into mention chips; v1
	// keeps comment bodies as a single plain-text segment.
	"lib/activity-mention-segments.ts",
	// Shared metadata-rail / embedded-chat width for the v2 dialog overlay.
	"lib/layout-constants.ts",
	// v2's Development rail section derives copy-ready git commands from the
	// work item; v1 still renders the connect-a-repository empty state.
	"lib/development-commands.test.js",
	"lib/development-commands.ts",
	// Connected-repo fixtures / helpers live outside the picker component file
	// so Fast Refresh can treat that module as components-only.
	"lib/development-repositories.ts",
	// File-size split: static adapter fixtures/tests stay v2-only.
	"lib/jira-activity-adapter-static.test.js",
	// Live CI elapsed clock helpers for the PR details rail.
	"lib/pull-request-check-elapsed.test.js",
	"lib/pull-request-check-elapsed.ts",
	// Phase-section model for the Pull requests resource dropdown.
	"lib/pull-request-phases.ts",
	"lib/pull-request-phases.test.js",
	"lib/pull-request-detail-data.ts",
	"lib/pull-request-detail-data.test.js",
	"lib/pull-request-detail-data-ui.test.js",
	// Review submit: verdict → Approvers status + sonner toast copy.
	"lib/pull-request-review-submit.ts",
	"lib/pull-request-review-submit.test.js",
	"lib/show-pull-request-review-toast.tsx",
	// File-size split: initial reviewed-chapter seed lives outside the fixture module.
	"lib/resolve-initial-reviewed-chapter-ids.ts",
	"lib/pull-request-activity-adapter.ts",
	"lib/pull-request-activity-adapter.test.js",
	// Selected PR filter Tag status → icon/color map (open/merged/failed/draft).
	"lib/pull-request-status-presentation.ts",
	"lib/pull-request-status-presentation.test.js",
]);

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

/** Repo-relative paths of every `.ts`/`.tsx`/`.js` file under `dir`, recursively. */
function listSourceFiles(dir) {
	return fs
		.readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.(?:tsx?|js)$/u.test(entry.name))
		.map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

test("experimental v2 exists with a distinctly named composition root", () => {
	assert.ok(fs.existsSync(V2_DIR));

	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	assert.match(compositionSource, /export function ExperimentalV2JiraWorkItem\(/u);
	assert.match(compositionSource, /stageKey\?: string;/u);
	assert.match(compositionSource, /<ExperimentalV2JiraWorkItemContent[\s\S]*stageKey=\{props\.stageKey\}/u);
	assert.doesNotMatch(compositionSource, /<ExperimentalV2JiraWorkItemContent[\s\S]*key=\{props\.initialStateRevision\}/u);
	assert.match(compositionSource, /export default ExperimentalV2JiraWorkItem;/u);
	assert.match(compositionSource, /export type ExperimentalV2JiraWorkItemProps/u);
	// The v1 root filename must not linger in v2 — both roots are imported side
	// by side by the block index, so their names have to stay distinct.
	assert.equal(fs.existsSync(path.join(V2_DIR, "experimental-jira-work-item.tsx")), false);
});

test("experimental v2 resets stage-scoped view state only after the stage key changes", () => {
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");

	assert.match(compositionSource, /const previousStageKeyRef = useRef\(stageKey\);/u);
	assert.match(
		compositionSource,
		/useLayoutEffect\(\(\) => \{[\s\S]*Object\.is\(previousStageKeyRef\.current, stageKey\)[\s\S]*return;[\s\S]*previousStageKeyRef\.current = stageKey;[\s\S]*setDescriptionViewMode\("rendered"\);[\s\S]*setSelectedPullRequestIdentity\(null\);[\s\S]*setPullRequestReviewByIdentity\(\{\}\);[\s\S]*setReviewComposerIdentity\(null\);[\s\S]*setFixComposer\(null\);[\s\S]*setPullRequestReviewerStatuses\(\{\}\);[\s\S]*removeFailingChecks\(\);[\s\S]*\}, \[removeFailingChecks, stageKey\]\);/u,
	);
});

test("experimental v2 opens the shared agent chat as a full-height sibling column", () => {
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	const dialogSource = readBlockFile("experimental-v2/components/experimental-work-item-dialog.tsx");
	const layoutSource = readBlockFile("experimental-v2/components/experimental-work-item-layout.tsx");
	const sessionSurfaceSource = readBlockFile("experimental-v2/components/floating-session-surface.tsx");
	const sharedOverlaySource = fs.readFileSync(
		path.join(BLOCK_DIR, "../../projects/jira-golden-journeys-v0/components/jira-golden-journeys-v0-rovo-overlay.tsx"),
		"utf8",
	);

	assert.match(
		compositionSource,
		/const agentChatOpen = chatSurface === "floating";[\s\S]*sidebar=\{<FloatingSessionSurface composerToolsAfterAdd=\{composerToolsAfterAdd\} onSessionReply=\{onSessionReply\} \/>\}[\s\S]*sidebarOpen=\{agentChatOpen\}[\s\S]*aria-hidden=\{agentChatOpen\}[\s\S]*className="group\/metadata-resize relative flex min-h-0 min-w-0 flex-1 flex-col"[\s\S]*inert=\{agentChatOpen \? true : undefined\}[\s\S]*<MetadataRail[\s\S]*activity=\{\([\s\S]*<ActivityPanel[\s\S]*activitySessionThread=\{activitySessionThread\}[\s\S]*onOpenPullRequest=\{handlePullRequestSelect\}[\s\S]*railChromeEnabled=\{selectedPullRequestEntry === null\}[\s\S]*automationRules=\{automationRules\}[\s\S]*borderless[\s\S]*currentReviewerStatus=\{selectedPullRequestReviewerStatus\}[\s\S]*selectedPullRequestEntry=\{selectedPullRequestEntry\}[\s\S]*\/>/u,
	);
	assert.doesNotMatch(compositionSource, /blanketContent=\{[\s\S]*<FloatingSessionSurface/u);
	assert.match(sessionSurfaceSource, /<AsxRovoOverlay[\s\S]*placement="embedded"/u);
	assert.match(
		sessionSurfaceSource,
		/function getSessionPlaybackVariant\([\s\S]*"claude-code-build"[\s\S]*completedCount >= 1 && completedCount <= 3[\s\S]*playbackVariant: getSessionPlaybackVariant\(activeSession\)/u,
	);
	assert.match(
		sessionSurfaceSource,
		/shop-4821-ci-fix" && session\.status === "running"[\s\S]*return "ci-fix"/u,
	);
	assert.match(
		sessionSurfaceSource,
		/const interceptedOnApplyAfterResponse = intercepted\.onApplyAfterResponse;[\s\S]*onApplyAfterResponse: interceptedOnApplyAfterResponse[\s\S]*preserveCompletedSessionTranscript\(\);[\s\S]*await interceptedOnApplyAfterResponse\(\);/u,
	);
	assert.doesNotMatch(sessionSurfaceSource, /children|createPortal|portalToViewport/u);
	assert.match(sharedOverlaySource, /placement === "embedded"/u);
	assert.match(
		dialogSource,
		/data-jira-work-item-main-column[\s\S]*data-jira-work-item-chat-column/u,
	);
	assert.match(dialogSource, /grid-cols-\[minmax\(0,1fr\)\]/u);
	assert.match(
		dialogSource,
		/const sidePanelStyle = \{[\s\S]*"--work-item-side-panel-width": `\$\{sidebarWidth\}px`[\s\S]*style=\{sidePanelStyle\}/u,
	);
	assert.match(
		dialogSource,
		/transition-\[margin-right\][\s\S]*@\[860px\]\/workitemdialog:mr-\[var\(--work-item-side-panel-width\)\][\s\S]*data-jira-work-item-header-column/u,
	);
	assert.match(
		dialogSource,
		/absolute inset-y-0 right-0 z-30[\s\S]*translate-x-full[\s\S]*@\[860px\]\/workitemdialog:w-\[var\(--work-item-side-panel-width\)\][\s\S]*sidebarOpen \? "translate-x-0" : "pointer-events-none"/u,
	);
	assert.match(dialogSource, /transition-\[margin-right\] duration-medium ease-in-out motion-reduce:transition-none/u);
	assert.match(dialogSource, /transition-transform duration-medium ease-in-out[\s\S]*motion-reduce:transition-none/u);
	assert.match(dialogSource, /sidebarResizing[\s\S]*\? "transition-none"[\s\S]*group\/chat-panel[\s\S]*\{sidebarOpen \? \([\s\S]*\{sidebarResizeHandle\}[\s\S]*\) : null\}/u);
	assert.match(dialogSource, /aria-hidden=\{!sidebarOpen\}[\s\S]*inert=\{sidebarOpen \? undefined : true\}/u);
	assert.match(
		dialogSource,
		/className="grid h-full min-h-0 min-w-0 grid-rows-\[auto_minmax\(0,1fr\)\]"[\s\S]*data-jira-work-item-main-column/u,
	);
	assert.match(layoutSource, /\{metadataCollapsed \? null : \(/u);
	assert.match(
		layoutSource,
		/sticky bottom-0 z-10 bg-surface-overlay[\s\S]*@\[860px\]\/agentlayout:bg-transparent[\s\S]*data-jira-work-item-composer-dock/u,
	);
	assert.match(layoutSource, /from-transparent to-surface-overlay/u);
});

test("experimental v2 metadata panel exposes a notch-only resize handle and chat-only divider", () => {
	const compositionSource = readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx");
	const layoutSource = readBlockFile("experimental-v2/components/experimental-work-item-layout.tsx");

	assert.match(
		compositionSource,
		/setMetadataPanelMaxWidth\(resolveMetadataPanelMaxWidth\(width\)\)[\s\S]*useSidebarResize\(\{[\s\S]*defaultWidth: METADATA_PANEL_DEFAULT_WIDTH_PX,[\s\S]*direction: "rtl",[\s\S]*maxWidth: metadataPanelMaxWidth,[\s\S]*minWidth: METADATA_PANEL_MIN_WIDTH_PX,[\s\S]*minWidthResistance: true,[\s\S]*onBodyWidthChange=\{handleDialogBodyWidthChange\}[\s\S]*<ExperimentalWorkItemLayout[\s\S]*metadataPanelResizing=\{metadataPanelResize\.isResizing\}[\s\S]*metadataPanelWidth=\{metadataPanelResize\.sidebarWidth\}/u,
	);
	assert.match(
		compositionSource,
		/function WorkItemSidePanelResizeHandle[\s\S]*<SidebarResizeHandle[\s\S]*aria-label=\{ariaLabel\}[\s\S]*aria-valuenow=\{resize\.sidebarWidth\}[\s\S]*bottom-6![\s\S]*\[&>div\]:h-16[\s\S]*\[&>div\]:transition-\[opacity,background-color,scale\][\s\S]*hover:\[&>div\]:scale-105[\s\S]*\[&>div\]:duration-medium[\s\S]*motion-reduce:\[&>div\]:scale-100[\s\S]*data-testid=\{testId\}[\s\S]*onKeyDown=\{resize\.onResizeHandleKeyDown\}[\s\S]*onPointerDown=\{resize\.onResizeHandlePointerDown\}[\s\S]*role="separator"[\s\S]*side="left"[\s\S]*tabIndex=\{0\}/u,
	);
	assert.match(
		compositionSource,
		/sidebar=\{<FloatingSessionSurface composerToolsAfterAdd=\{composerToolsAfterAdd\} onSessionReply=\{onSessionReply\} \/>\}[\s\S]*sidebarResizeHandle=\{\([\s\S]*ariaLabel="Resize agent chat panel"[\s\S]*top-0![\s\S]*bottom-0![\s\S]*left-0![\s\S]*bg-border[\s\S]*group-hover\/chat-panel:\[&>div\]:opacity-100[\s\S]*resize=\{metadataPanelResize\}[\s\S]*testId="jira-work-item-chat-resize-handle"[\s\S]*sidebarResizing=\{metadataPanelResize\.isResizing\}[\s\S]*sidebarWidth=\{metadataPanelResize\.sidebarWidth\}/u,
	);
	assert.match(
		compositionSource,
		/ariaLabel="Resize details and activity panel"[\s\S]*top-\[3\.875rem\]![\s\S]*left-\[calc\(-1\.5rem\+0\.375rem\)\]![\s\S]*bg-transparent![\s\S]*hover:bg-transparent![\s\S]*data-\[active\]:bg-transparent![\s\S]*focus-visible:bg-transparent![\s\S]*focus-visible:ring-0[\s\S]*group-hover\/metadata-panel:\[&>div\]:opacity-100[\s\S]*resize=\{metadataPanelResize\}[\s\S]*testId="jira-work-item-metadata-resize-handle"/u,
	);
	assert.match(layoutSource, /group\/metadata-panel order-3 min-w-0/u);
	assert.doesNotMatch(compositionSource, /group-hover\/metadata-resize:(?:bg-border|\[&>div\]:opacity-100)/u);
	assert.doesNotMatch(compositionSource, /\s\[&>div\]:opacity-100/u);
});

test("experimental v2 and v1 are mutually isolated", () => {
	for (const filePath of listSourceFiles(V2_DIR)) {
		assert.doesNotMatch(
			fs.readFileSync(filePath, "utf8"),
			/jira-work-item\/experimental\//u,
			`${path.relative(BLOCK_DIR, filePath)} still imports from the v1 experimental tree`,
		);
	}

	for (const filePath of listSourceFiles(V1_DIR)) {
		assert.doesNotMatch(
			fs.readFileSync(filePath, "utf8"),
			/experimental-v2/u,
			`${path.relative(BLOCK_DIR, filePath)} leaks a v2 reference into the v1 tree`,
		);
	}
});

test("experimental v2 starts as a structural duplicate of v1", () => {
	const v1Files = listSourceFiles(V1_DIR)
		.map((filePath) => path.relative(V1_DIR, filePath))
		.filter((relativePath) => relativePath !== "experimental-jira-work-item.tsx")
		.sort();
	const v2Files = listSourceFiles(V2_DIR)
		.map((filePath) => path.relative(V2_DIR, filePath))
		.filter((relativePath) => relativePath !== "experimental-v2-jira-work-item.tsx")
		.filter((relativePath) => !V2_ONLY_FILES.has(relativePath))
		.sort();

	assert.deepEqual(v2Files, v1Files);

	// Every remaining file differs from its v1 twin only in the rewritten import path.
	for (const relativePath of v2Files) {
		if (V2_DIVERGENCES.has(relativePath)) {
			continue;
		}
		const v1Source = fs.readFileSync(path.join(V1_DIR, relativePath), "utf8");
		const v2Source = fs.readFileSync(path.join(V2_DIR, relativePath), "utf8");
		const normalizedV2 = v2Source
			.replaceAll("jira-work-item/experimental-v2/", "jira-work-item/experimental/")
			.replaceAll("jira-activity-adapter-v2-harness.cjs", "jira-activity-adapter-harness.cjs");
		assert.equal(normalizedV2, v1Source, `${relativePath} has diverged from its v1 twin`);
	}
});

test("experimental v2 shares the session/planner data layer with v1", () => {
	assert.match(
		readBlockFile("experimental-v2/experimental-v2-jira-work-item.tsx"),
		/@\/components\/blocks\/jira-work-item\/data\/session-state/u,
	);
	assert.match(
		readBlockFile("experimental-v2/use-jira-work-item-controller.ts"),
		/@\/components\/blocks\/jira-work-item\/data\/session-state/u,
	);
	// No forked copy of the model lives under v2.
	assert.equal(fs.existsSync(path.join(V2_DIR, "data")), false);
});

test("experimental v2 Development starts with a searchable provider-branded repository picker", () => {
	const detailsSectionsSource = readBlockFile("experimental-v2/components/details-sections.tsx");
	const repositoryPickerSource = readBlockFile("experimental-v2/components/development-repository-picker.tsx");
	const developmentRepositoriesSource = readBlockFile("experimental-v2/lib/development-repositories.ts");

	assert.match(
		detailsSectionsSource,
		/className="flex min-w-0 flex-col gap-1"[\s\S]*<DevelopmentRepositoryPicker \/>[\s\S]*Create branch in Bitbucket Cloud[\s\S]*Create branch in GitHub/u,
	);
	assert.doesNotMatch(detailsSectionsSource, /DevelopmentCopyField|Copy branch command|Copy commit command|Copy work item key/u);
	assert.match(repositoryPickerSource, /<Popover open=\{open\} onOpenChange=\{handleOpenChange\}>/u);
	assert.match(repositoryPickerSource, /className="w-\(--anchor-width\) max-w-\[calc\(100vw-2rem\)\] gap-0 overflow-hidden p-0"/u);
	assert.match(repositoryPickerSource, /label="Search repositories"[\s\S]*All repositories/u);
	assert.match(repositoryPickerSource, /useCommandMenuScrollMask\(\)[\s\S]*rich-text-command-menu rich-text-command-menu-embedded[\s\S]*rich-text-command-menu-list/u);
	assert.match(repositoryPickerSource, /import \{ SearchIcon \} from "@\/components\/ui\/vpk-icons"/u);
	assert.match(repositoryPickerSource, /icon=\{<SearchIcon className="size-4 text-icon-subtle" \/>\}/u);
	assert.match(repositoryPickerSource, /className="h-11 w-full justify-start gap-3 rounded-lg px-2 pe-9 font-normal"/u);
	assert.equal((repositoryPickerSource.match(/inline-flex size-6 shrink-0 items-center justify-center leading-none \[&_svg\]:size-6!/gu) ?? []).length, 1);
	assert.match(repositoryPickerSource, /import LinkExternalIcon from "@atlaskit\/icon\/core\/link-external";/u);
	assert.match(repositoryPickerSource, /import FolderAddIcon from "@atlaskit\/icon-lab\/core\/folder-add";/u);
	assert.match(repositoryPickerSource, /import HardwareAuditIcon from "@atlaskit\/icon-lab\/core\/hardware-audit";/u);
	// Hover/focus-within reveals a far-right open-in-tab control; stopPropagation keeps row select separate.
	assert.match(
		repositoryPickerSource,
		/className="group\/repository-row relative"[\s\S]*href=\{url\}[\s\S]*event\.stopPropagation\(\)[\s\S]*rel="noopener noreferrer"[\s\S]*target="_blank"/u,
	);
	assert.match(
		repositoryPickerSource,
		/pointer-events-none opacity-0 transition-opacity duration-normal ease-out-practical[\s\S]*group-hover\/repository-row:pointer-events-auto group-hover\/repository-row:opacity-100[\s\S]*group-has-\[:focus-visible\]\/repository-row:pointer-events-auto group-has-\[:focus-visible\]\/repository-row:opacity-100[\s\S]*focus-visible:pointer-events-auto focus-visible:opacity-100/u,
	);
	assert.match(
		repositoryPickerSource,
		/aria-label=\{`Open \$\{name\} repository`\}[\s\S]*render=\{<LinkExternalIcon label="" size="small" \/>\}/u,
	);
	assert.match(repositoryPickerSource, /className="size-4" render=\{<LinkExternalIcon label="" size="small" \/>\}/u);
	assert.match(repositoryPickerSource, /text-icon-subtle/u);
	assert.match(
		repositoryPickerSource,
		/className="size-6 shrink-0" render=\{<FolderAddIcon label="" \/>\}[\s\S]*Add repositories/u,
	);
	assert.match(
		repositoryPickerSource,
		/className="size-6 shrink-0" render=\{<HardwareAuditIcon label="" \/>\}[\s\S]*Add environment/u,
	);
	assert.doesNotMatch(repositoryPickerSource, /@atlaskit\/icon\/core\/add|render=\{<AddIcon /u);
	assert.match(repositoryPickerSource, /<ChevronDownIcon label="" size="small" \/>/u);
	assert.equal((repositoryPickerSource.match(/<Separator className="mx-2 my-1 data-horizontal:w-auto" \/>/gu) ?? []).length, 1);
	assert.match(
		developmentRepositoriesSource,
		/export const CONNECTED_REPOSITORY_COUNT = DEVELOPMENT_REPOSITORIES\.length;/u,
	);
	assert.doesNotMatch(
		developmentRepositoriesSource,
		/formatConnectedRepositoryCountLabel|\b\d+ Repos?\b/u,
	);
	assert.match(
		repositoryPickerSource,
		/import \{[\s\S]*CONNECTED_REPOSITORY_COUNT[\s\S]*DEVELOPMENT_REPOSITORIES[\s\S]*stripUrlScheme[\s\S]*\} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/lib\/development-repositories"/u,
	);
	assert.match(
		repositoryPickerSource,
		/\{CONNECTED_REPOSITORY_COUNT\} Connected repositories/u,
	);
	assert.doesNotMatch(repositoryPickerSource, /selectedRepository|DEFAULT_REPOSITORY_ID|Select repository,/u);
	assert.match(developmentRepositoriesSource, /provider: "github"[\s\S]*provider: "bitbucket"/u);
	assert.match(repositoryPickerSource, /<GithubLogo borderless label="" size="small" \/>/u);
	assert.match(repositoryPickerSource, /<BitbucketLogo appearance="brand" label="" size="small" \/>/u);
	assert.match(developmentRepositoriesSource, /symphony-explainer[\s\S]*proximity[\s\S]*id: "storefront"[\s\S]*id: "vpk"/u);
	// Full URLs stay on the option data (search / future links); bylines strip the scheme.
	assert.match(developmentRepositoriesSource, /https:\/\/github\.com\/eevensoh\/symphony-explainer[\s\S]*https:\/\/bitbucket\.org\/atlassian\/vpk/u);
	assert.match(repositoryPickerSource, /`\$\{repository\.name\} \$\{repository\.url\}`/u);
	assert.match(developmentRepositoriesSource, /export function stripUrlScheme\(url: string\): string/u);
	assert.ok(
		developmentRepositoriesSource.includes('return url.replace(/^https?:\\/\\//i, "");'),
		"stripUrlScheme should drop a leading http(s):// case-insensitively",
	);
	assert.match(repositoryPickerSource, /\{stripUrlScheme\(url\)\}/u);
	// Tiny behavior check mirroring `stripUrlScheme` (CJS contract test can't import the TSX module).
	const stripUrlScheme = (url) => url.replace(/^https?:\/\//i, "");
	assert.equal(stripUrlScheme("https://github.com/eevensoh/symphony-explainer"), "github.com/eevensoh/symphony-explainer");
	assert.equal(stripUrlScheme("HTTP://bitbucket.org/acme/storefront"), "bitbucket.org/acme/storefront");
	assert.equal(stripUrlScheme("github.com/eevensoh/proximity"), "github.com/eevensoh/proximity");
	assert.match(repositoryPickerSource, /const REPOSITORY_LABEL_CLASS = "menu-row-title text-left";/u);
	assert.match(repositoryPickerSource, /const REPOSITORY_DESCRIPTION_CLASS = "menu-row-byline text-left";/u);
	// Byline URL stays hidden until hover/focus — same Motion reveal as AgentSelector.
	assert.match(repositoryPickerSource, /import \{ motion, useReducedMotion, type Variants \} from "motion\/react";/u);
	assert.match(repositoryPickerSource, /const revealByline = isInteractionActive;/u);
	assert.match(repositoryPickerSource, /const copyInstant = Boolean\(prefersReducedMotion\);/u);
	assert.match(repositoryPickerSource, /animate=\{revealByline \? "active" : "idle"\}/u);
	assert.match(repositoryPickerSource, /onMouseEnter=\{\(\) => setIsInteractionActive\(true\)\}/u);
	assert.match(repositoryPickerSource, /onFocus=\{\(\) => setIsInteractionActive\(true\)\}/u);
	assert.match(repositoryPickerSource, /function selectRepository\(\) \{[\s\S]*handleOpenChange\(false\);/u);
	assert.match(repositoryPickerSource, /Add repositories[\s\S]*Add environment/u);
	assert.doesNotMatch(repositoryPickerSource, /Recents|Checkbox|owner|Refresh|DX docs validation|Select multiple/u);
	assert.match(repositoryPickerSource, /positionerClassName="z-\[502\]"/u);
});

test("experimental v2 sticky composer does not mount codebase repo or branch pickers", () => {
	const composerSource = readBlockFile("experimental-v2/components/activity-composer.tsx");
	const developmentRepositoriesSource = readBlockFile("experimental-v2/lib/development-repositories.ts");

	assert.doesNotMatch(composerSource, /ActivityComposerCodebasePickers|activity-composer-codebase-pickers|jira-work-item-composer-codebase/u);
	assert.equal(
		fs.existsSync(path.join(V2_DIR, "components/activity-composer-codebase-pickers.tsx")),
		false,
	);
	// Branch defaults / resolvers were composer-picker-only; Repositories pane keeps the list helpers.
	assert.doesNotMatch(
		developmentRepositoriesSource,
		/DEFAULT_DEVELOPMENT_REPOSITORY_ID|DEVELOPMENT_BRANCHES|DEFAULT_DEVELOPMENT_BRANCH|resolveDevelopmentRepository|resolveDevelopmentBranch/u,
	);
	assert.match(developmentRepositoriesSource, /export const DEVELOPMENT_REPOSITORIES/u);
	assert.match(developmentRepositoriesSource, /export const CONNECTED_REPOSITORY_COUNT/u);
	assert.match(developmentRepositoriesSource, /export function stripUrlScheme/u);
});

test("experimental v2 working-agents menu includes waiting sessions without changing its dismissal contract", () => {
	const contextPillsSource = readBlockFile("experimental-v2/components/activity-composer-context-pills.tsx");
	const composerSource = readBlockFile("experimental-v2/components/activity-composer.tsx");

	assert.match(
		contextPillsSource,
		/<RichTextSuggestionMenu[\s\S]*className="rich-text-command-menu-borderless w-full!"[\s\S]*title="Working agents"/u,
	);
	assert.match(composerSource, /state\.sessions\.filter\(\(session\) => session\.status !== "completed"\)/u);
	assert.match(contextPillsSource, /`Waiting for \$\{session\.waitingOn\.agentName\}`/u);
	assert.match(contextPillsSource, /"code-planner": \[[\s\S]*"Plan the guest checkout architecture"/u);
	assert.match(contextPillsSource, /"claude-code": \[[\s\S]*"Implement and verify guest checkout"/u);
	assert.match(
		contextPillsSource,
		/session\.scriptId === "shop-4821-ci-fix"[\s\S]*CI_REPAIR_ACTIVITY_SCRIPT/u,
	);
	assert.doesNotMatch(contextPillsSource, /"github-copilot":|"unit-test-creator":/u);
	assert.match(contextPillsSource, /label: session\.agentName,/u);
	assert.match(contextPillsSource, /inlineMetadata: \([\s\S]*<WorkingSessionActivityByline[\s\S]*sessionIndex=\{sessionIndex\}/u);
	assert.match(contextPillsSource, /<AgentAvatarVisual[\s\S]*sizePx=\{24\}/u);
	assert.match(contextPillsSource, /brandName=\{session\.agentBrandName\}/u);
	assert.match(contextPillsSource, /vpkLogo=\{session\.agentName === "Rovo" \? "rovo" : undefined\}/u);
	assert.match(contextPillsSource, /<CyclingByline className="menu-row-byline">/u);
	assert.match(contextPillsSource, /import \{ AnimatedDots \} from "@\/components\/ui-custom\/animated-dots";/u);
	assert.match(contextPillsSource, /const NEEDS_INPUT_STATUS_LABEL = "Needs input";/u);
	assert.match(
		contextPillsSource,
		/needsUserInput \? \(\s*<span className="inline-flex min-w-0 items-baseline">\s*<Shimmer as="span">\{activity\}<\/Shimmer>\s*<AnimatedDots \/>\s*<\/span>\s*\) : activity/u,
	);
	assert.match(contextPillsSource, /className="mb-2 flex flex-wrap gap-2"/u);
	assert.match(contextPillsSource, /WORKING_SESSION_ACTIVITY_STAGGER_MS \* \(sessionIndex \+ 1\)/u);
	assert.match(contextPillsSource, /window\.setTimeout\([\s\S]*window\.setInterval\([\s\S]*setActivityCycleIndex\(\(index\) => index \+ 1\)/u);
	assert.match(contextPillsSource, /window\.clearTimeout\(timeoutId\);[\s\S]*window\.clearInterval\(intervalId\);/u);
	assert.doesNotMatch(contextPillsSource, /Math\.random/u);
	assert.match(
		contextPillsSource,
		/const needsInputCount = workingSessions\.filter\(\(session\) => \([\s\S]*session\.status === "waiting" && session\.waitingOn\?\.kind === "user"[\s\S]*const summaryCount = needsInputCount > 0 \? needsInputCount : workingSessions\.length;[\s\S]*const summaryLabel = needsInputCount > 0[\s\S]*"agent needs" : "agents need"[\s\S]*"agent" : "agents"\} working`/u,
	);
	assert.match(
		contextPillsSource,
		/needsInputCount > 0 \? \([\s\S]*<Shimmer as="span">\{summaryLabel\}<\/Shimmer>[\s\S]*\) : summaryLabel/u,
	);
	assert.match(
		contextPillsSource,
		/<ContextBarPill[\s\S]*aria-label=\{summaryLabel\}[\s\S]*icon=\{\([\s\S]*<PixelLoader[\s\S]*className="size-3 justify-center"[\s\S]*pattern=\{needsInputCount > 0 \? "breathing" : "diagonal-top-left"\}[\s\S]*shape="dot"[\s\S]*size="small"/u,
	);
	assert.match(
		contextPillsSource,
		/trailing: session\.status === "waiting"[\s\S]*\{session\.waitingOn\?\.kind === "user" \? NEEDS_INPUT_STATUS_LABEL : "Waiting"\}[\s\S]*: null/u,
	);
	assert.doesNotMatch(contextPillsSource, /<Spinner/u);
});

test("experimental v2 running-agents menu dismisses after focus leaves its wrapper", () => {
	const contextPillsSource = readBlockFile("experimental-v2/components/activity-composer-context-pills.tsx");

	assert.match(contextPillsSource, /window\.addEventListener\("pointerdown", handlePointerDown, true\);/u);
	assert.match(contextPillsSource, /!containerRef\.current\?\.contains\(event\.target\)[\s\S]*onClose\(false\);/u);
	assert.match(contextPillsSource, /window\.addEventListener\("keydown", handleDismissKeyDown\);/u);
	assert.match(contextPillsSource, /event\.key === "Escape"[\s\S]*onClose\(true\);/u);
	assert.match(contextPillsSource, /window\.removeEventListener\("pointerdown", handlePointerDown, true\);/u);
	assert.match(contextPillsSource, /window\.removeEventListener\("keydown", handleDismissKeyDown\);/u);
});

test("context popover tab navigation keeps the shared default height and top gap", () => {
	for (const popover of ["attachments-popover.tsx", "subtasks-popover.tsx", "linked-work-items-popover.tsx"]) {
		const popoverSource = readBlockFile(`experimental/components/${popover}`);

		assert.match(popoverSource, /<TabsList variant="line" className="mt-2\.5 w-full px-2\.5">/u);
		assert.doesNotMatch(popoverSource, /<TabsList[^>]*\bpt-/u);
	}
});

test("experimental v2 context popovers share one segmented tab strip", () => {
	for (const popover of ["attachments-popover.tsx", "subtasks-popover.tsx", "linked-work-items-popover.tsx"]) {
		const popoverSource = readBlockFile(`experimental-v2/components/${popover}`);

		// One shared constant, so the three strips cannot drift apart. `variant="line"`
		// would put them back on the underline treatment v1 uses.
		assert.match(popoverSource, /<TabsList className=\{CONTEXT_POPOVER_TABS_LIST_CLASS\}>/u);
		assert.doesNotMatch(popoverSource, /<TabsList[^>]*variant="line"/u);
	}

	// The grey track is visible, so the strip is inset with a margin. Padding would
	// shrink the labels inside a full-bleed track instead of insetting the track.
	const partsSource = readBlockFile("experimental-v2/components/context-popover-parts.tsx");
	assert.match(partsSource, /CONTEXT_POPOVER_TABS_LIST_CLASS = "mx-2\.5 mt-2\.5 w-\[calc\(100%-1\.25rem\)\]"/u);
});

test("experimental v2 context popovers reuse one AI suggestion panel", () => {
	const partsSource = readBlockFile("experimental-v2/components/context-popover-parts.tsx");

	// Header count + collapse, then the shared "Uses AI" footer with feedback.
	assert.match(partsSource, /export function SuggestionPanel\(/u);
	assert.match(partsSource, /<AiSparkleIcon label="" color="currentColor" \/>/u);
	assert.match(partsSource, /<Footer className="justify-start gap-1 px-2 py-1">/u);
	assert.match(partsSource, /Uses AI\. Verify results\./u);

	// No popover may re-implement the panel locally.
	for (const popover of ["attachments-popover.tsx", "subtasks-popover.tsx", "linked-work-items-popover.tsx"]) {
		const popoverSource = readBlockFile(`experimental-v2/components/${popover}`);
		assert.doesNotMatch(popoverSource, /AiSparkleIcon|ThumbsUpIcon|ThumbsDownIcon/u);
	}
});

test("experimental v2 work item rows use type-coloured Jira glyphs", () => {
	const partsSource = readBlockFile("experimental-v2/components/context-popover-parts.tsx");

	assert.match(partsSource, /Task: \{ Glyph: TaskIcon, tone: "text-icon-accent-blue" \}/u);
	assert.match(partsSource, /Subtask: \{ Glyph: SubtasksIcon, tone: "text-icon-accent-blue" \}/u);
	assert.match(partsSource, /Story: \{ Glyph: StoryIcon, tone: "text-icon-accent-green" \}/u);
	assert.match(partsSource, /Bug: \{ Glyph: BugIcon, tone: "text-icon-accent-red" \}/u);
	assert.match(partsSource, /Epic: \{ Glyph: EpicIcon, tone: "text-icon-accent-purple" \}/u);

	for (const popover of ["subtasks-popover.tsx", "linked-work-items-popover.tsx"]) {
		const popoverSource = readBlockFile(`experimental-v2/components/${popover}`);
		assert.match(popoverSource, /<WorkItemTypeIcon type=\{/u);
	}
});

test("experimental v2 suggested subtasks commit only on confirm", () => {
	const popoverSource = readBlockFile("experimental-v2/components/subtasks-popover.tsx");

	// Checking a box must stay a reversible draft: the add only runs from the
	// Create button, which is disabled until at least one box is checked.
	assert.match(popoverSource, /const createSelectedSuggestions = \(\) => \{/u);
	assert.match(popoverSource, /disabled=\{selectedSuggestions\.length === 0\}/u);
	assert.match(popoverSource, /onClick=\{createSelectedSuggestions\}/u);
	assert.doesNotMatch(popoverSource, /onCheckedChange=\{[^}]*addContextResource/u);
});

test("experimental v2 context popovers compose tooltips with their triggers", () => {
	for (const popover of ["attachments-popover.tsx", "subtasks-popover.tsx", "linked-work-items-popover.tsx"]) {
		const popoverSource = readBlockFile(`experimental-v2/components/${popover}`);

		assert.match(
			popoverSource,
			/tooltip \? \([\s\S]*<Tooltip>[\s\S]*<TooltipTrigger render=\{<span className="inline-flex" \/>\}>[\s\S]*<PopoverTrigger render=\{trigger\} \/>[\s\S]*<TooltipContent positionerClassName="z-\[502\]">\{tooltip\}<\/TooltipContent>/u,
		);
	}
});

test("experimental v2 create-new attachments use reserved content-type icons at 16px", () => {
	const popoverSource = readBlockFile("experimental-v2/components/attachments-popover.tsx");

	// Live doc and Loom have reserved single-purpose glyphs; generic Page/Video
	// stand-ins read as the wrong object type.
	assert.match(popoverSource, /import PageLiveDocIcon from "@atlaskit\/icon-lab\/core\/page-live-doc";/u);
	assert.match(popoverSource, /import LoomIcon from "@atlaskit\/icon-lab\/core\/loom";/u);
	assert.match(popoverSource, /page: \{ Glyph: PageIcon, tone: "text-icon-accent-blue" \}/u);
	assert.match(popoverSource, /"live-doc": \{ Glyph: PageLiveDocIcon, tone: "text-icon-accent-magenta" \}/u);
	assert.match(popoverSource, /whiteboard: \{ Glyph: WhiteboardIcon, tone: "text-icon-accent-teal" \}/u);
	assert.match(popoverSource, /"loom-video": \{ Glyph: LoomIcon, tone: "text-icon-accent-blue" \}/u);

	// `size="small"` is 12px on new-core icons; the menu renders the 16px default.
	assert.match(popoverSource, /<Glyph label="" color="currentColor" \/>/u);
});

test("experimental v2 keeps the metadata panel visible and uses asymmetric header padding", () => {
	const dialogSource = readBlockFile("experimental-v2/components/experimental-work-item-dialog.tsx");
	const headerActionsSource = readBlockFile("experimental-v2/components/experimental-breadcrumb-actions.tsx");

	// No ModalHeader bottom padding; ContextTitleBar owns px-6 pb-4 on the title block.
	assert.match(dialogSource, /paddingBottom=\{0\}[\s\S]*paddingTop=\{token\("space\.150"\)\}/u);
	assert.doesNotMatch(dialogSource, /className="min-w-0 px-6 pb-4"/u);
	assert.match(dialogSource, /closeButtonDisabled=\{presentation === "inline"\}/u);
	assert.doesNotMatch(dialogSource, /showClose=\{presentation !== "inline"\}/u);
	assert.match(headerActionsSource, /aria-label="Collapse"/u);
	assert.match(headerActionsSource, /<ExperimentalHeaderOverflowMenu \/>[\s\S]*aria-label="Collapse"/u);
	assert.doesNotMatch(headerActionsSource, /ContextHeaderActions/u);
	assert.doesNotMatch(headerActionsSource, /Show metadata panel|Hide metadata panel/u);
	assert.doesNotMatch(headerActionsSource, /usePanelLayout|Popover|PanelRightIcon/u);
});

test("experimental v2 dialog matches Rovo Canvas even viewport inset sizing", () => {
	const dialogSource = readBlockFile("experimental-v2/components/experimental-work-item-dialog.tsx");
	const inlineIndex = dialogSource.indexOf('if (presentation === "inline")');
	const backdropIndex = dialogSource.indexOf("<Dialog.Backdrop");
	const inlineSource = dialogSource.slice(inlineIndex, backdropIndex);
	const popupSource = dialogSource.slice(backdropIndex);

	assert.ok(inlineIndex >= 0 && inlineIndex < backdropIndex);
	assert.match(inlineSource, /max-h-full w-full max-w-none shrink-0 outline-none/u);
	assert.match(inlineSource, /fillsInlineContainer \? "h-full min-h-0 flex-1 shrink" : null/u);
	assert.match(
		popupSource,
		/fixed inset-4 z-\[501\] h-auto w-auto max-w-none origin-center translate-x-0 translate-y-0 outline-none/u,
	);
	assert.doesNotMatch(popupSource, /calc\(100vw/u);
	assert.doesNotMatch(popupSource, /calc\(100vh|100dvh/u);
	assert.doesNotMatch(dialogSource, /max-w-\[1200px\]/u);
});

test("experimental v2 header overflow menu owns the restriction, watcher, and share actions", () => {
	const overflowMenuSource = readBlockFile(
		"experimental-v2/components/experimental-header-overflow-menu.tsx",
	);

	// The three actions moved out of the header row and must lead the menu.
	assert.match(
		overflowMenuSource,
		/\[\{ label: "Permission" \}, \{ label: "Watch", count: 1 \}, \{ label: "Share" \}\]/u,
	);
	assert.match(overflowMenuSource, /\{ label: "Log work", shortcut: "Q" \}/u);
	assert.match(overflowMenuSource, /\{ label: "Stop watching", shortcut: "W" \}/u);
	assert.match(overflowMenuSource, /\{ label: "Export to", submenu: \["Excel", "Word", "XML"\] \}/u);
	// Select cover keeps the chevron affordance but opens no flyout.
	assert.match(overflowMenuSource, /\{ label: "Select cover", chevron: true \}/u);
	assert.doesNotMatch(overflowMenuSource, /Select cover", submenu/u);
	assert.doesNotMatch(overflowMenuSource, /Switch to classic experience/u);
	// Dialog paints at z-[500]/[501]; both popup layers must clear it.
	assert.match(overflowMenuSource, /positionerClassName="z-\[502\]"/u);
	assert.match(overflowMenuSource, /positionerClassName="z-\[503\]"/u);
	// The popup opens to its full height instead of the shared 328px cap.
	assert.match(overflowMenuSource, /className="max-h-\[var\(--available-height\)\]"/u);
	// Separators are derived from group boundaries, never hand-placed.
	assert.match(overflowMenuSource, /\{groupIndex > 0 \? <DropdownMenuSeparator \/> : null\}/u);
});

test("experimental v2 reuses the Artifact Pane labels field", () => {
	const detailsTabSource = readBlockFile("experimental-v2/components/details-tab.tsx");
	const detailFieldEditorsSource = readBlockFile("experimental-v2/components/detail-field-editors.tsx");

	assert.match(
		detailsTabSource,
		/import \{ ArtifactLabelsField \} from "@\/components\/blocks\/artifact-pane\/artifact-labels-field";/u,
	);
	assert.match(
		detailsTabSource,
		/<ArtifactPanePropertyRow icon=\{<TagIcon label="" size="small" \/>\} label="Labels">/u,
	);
	assert.match(
		detailsTabSource,
		/<ArtifactLabelsField onChange=\{\(next\) => onChange\(\{ labels: next \}\)\} value=\{draft\.labels\} \/>/u,
	);
	assert.doesNotMatch(detailFieldEditorsSource, /export function LabelsRowField/u);
});

test("experimental v2 calendars are never narrower than their date triggers", () => {
	const detailFieldEditorsSource = readBlockFile("experimental-v2/components/detail-field-editors.tsx");

	assert.match(detailFieldEditorsSource, /className="w-auto min-w-\(--anchor-width\) p-2"/u);
});

test("experimental v2 reuses the Artifact Pane project field", () => {
	const detailsTabSource = readBlockFile("experimental-v2/components/details-tab.tsx");

	assert.match(
		detailsTabSource,
		/import \{ ArtifactProjectField \} from "@\/components\/blocks\/artifact-pane\/artifact-project-field";/u,
	);
	assert.match(
		detailsTabSource,
		/<ArtifactProjectField onChange=\{\(id\) => onChange\(\{ atlassianProject: id \}\)\} value=\{draft\.atlassianProject\} \/>/u,
	);
	assert.doesNotMatch(detailsTabSource, /function AtlassianProjectEditor/u);
});

test("the block index resolves every experimental surface from one map", () => {
	const indexSource = readBlockFile("index.tsx");

	assert.match(
		indexSource,
		/export type JiraWorkItemVariant = "default" \| "experimental" \| "experimental-v2" \| "experimental-v3" \| "experimental-v4" \| "experimental-v5" \| "team-eu26";/u,
	);
	assert.match(
		indexSource,
		/const EXPERIMENTAL_SURFACES = \{\s*experimental: ExperimentalJiraWorkItem,\s*"experimental-v2": ExperimentalV2JiraWorkItem,\s*"experimental-v3": ExperimentalV3JiraWorkItem,\s*"experimental-v4": ExperimentalV4JiraWorkItem,\s*"experimental-v5": ExperimentalV5JiraWorkItem,\s*"team-eu26": TeamEu26JiraWorkItem,\s*\} as const;/u,
	);
	assert.match(indexSource, /type ExperimentalVariant = keyof typeof EXPERIMENTAL_SURFACES;/u);
	assert.match(indexSource, /const ExperimentalSurface = EXPERIMENTAL_SURFACES\[surface\];/u);
	// One shared view owns the open/close plumbing for every experimental variant.
	assert.equal((indexSource.match(/function JiraWorkItemExperimentalView/gu) ?? []).length, 1);
});

test("experimental v2 opens the agent and skill pickers with the editor-palette search bar", () => {
	// Both pills are registered v2 divergences, so the structural-duplicate test
	// no longer guards them. Pin the reason for the divergence instead: the
	// selectors must request the borderless palette search field so they match
	// the "/" menu and the Parent/Labels pickers on the same screen.
	for (const relativePath of [
		"experimental-v2/components/activity-composer-agent-context-pill.tsx",
		"experimental-v2/components/activity-composer-skill-context-pill.tsx",
	]) {
		assert.match(readBlockFile(relativePath), /searchVariant="palette"/u, `${relativePath} dropped the palette search bar`);
	}

	// v1 stays on the boxed CommandInput — the divergence is deliberate, not drift.
	for (const relativePath of [
		"experimental/components/activity-composer-agent-context-pill.tsx",
		"experimental/components/activity-composer-skill-context-pill.tsx",
	]) {
		assert.doesNotMatch(readBlockFile(relativePath), /searchVariant=/u, `${relativePath} unexpectedly adopted a search variant`);
	}
});

test("the work-item skill picker has enough skills to scroll and keeps its pinned pair", () => {
	const variantOptionsSource = readBlockFile("experimental-v2/lib/work-item-picker-options.ts");
	const optionsSource = readBlockFile("lib/work-item-picker-options.ts");
	const skillIds = [...optionsSource.matchAll(/^\t\tid: "([^"]+)",$/gmu)].map((match) => match[1]);

	assert.match(
		variantOptionsSource,
		/from "@\/components\/blocks\/jira-work-item\/lib\/work-item-picker-options";/u,
	);

	// The list is a scroll-mask fixture as much as a menu: the picker viewport is
	// ~287px and rows are 44px, so it needs well over 7 skills to overflow and
	// show the fade at all.
	assert.ok(skillIds.length >= 10, `expected 10+ work-item skills, found ${skillIds.length}`);
	assert.equal(new Set(skillIds).size, skillIds.length, "work-item skill ids must be unique");

	// Adding skills must never displace the pinned pair — they render in their own
	// "Pinned by space" group above "More skills" and must still resolve.
	for (const pinnedId of ["summarize-comments", "improve-description"]) {
		assert.ok(skillIds.includes(pinnedId), `pinned skill ${pinnedId} is missing from the catalog`);
		assert.match(optionsSource, new RegExp(`"${pinnedId}",`, "u"), `${pinnedId} dropped out of the pinned defaults`);
	}
});

test("all Jira repository variants use the canonical VPK repository identity", async () => {
	for (const variant of ["experimental-v2", "experimental-v3", "experimental-v4", "experimental-v5", "team-eu26"]) {
		const { DEVELOPMENT_REPOSITORIES } = await import(`./${variant}/lib/development-repositories.ts`);
		assert.deepEqual(DEVELOPMENT_REPOSITORIES.find(({ id }) => id === "vpk"), {
			id: "vpk", name: "vpk", provider: "bitbucket", url: "https://bitbucket.org/atlassian/vpk",
		});
		assert.equal(DEVELOPMENT_REPOSITORIES.some(({ id, name, url }) => [id, name, url].some((value) => value.includes("vpk-rovo"))), false);
	}
});
