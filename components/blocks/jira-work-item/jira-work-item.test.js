const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const BLOCK_DIR = __dirname;
const JIRA_WORK_ITEM_SOURCE = fs.readFileSync(path.join(BLOCK_DIR, "index.tsx"), "utf8");
const COMPONENT_DOC_LAYOUT_SOURCE = readProjectFile("app/components/[category]/[slug]/layout.tsx");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}



// ── Source shape: variant API + experimental preset ──────────────────────────

test("JiraWorkItem exposes the variant API and the minimal experimental preset prop", () => {
	assert.match(JIRA_WORK_ITEM_SOURCE, /export type JiraWorkItemVariant = "default" \| "experimental" \| "experimental-v2" \| "experimental-v3" \| "experimental-v4" \| "experimental-v5" \| "team-eu26";/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /variant\?: JiraWorkItemVariant;/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /variant = "default"/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /initialExperimentalPreset\?: JiraWorkItemExperimentalPreset;/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /initialExperimentalPreset = "filled"/u);
	assert.match(
		JIRA_WORK_ITEM_SOURCE,
		/variant === "default" \? \([\s\S]*<JiraWorkItemDefaultView[\s\S]*\) : \([\s\S]*<JiraWorkItemExperimentalView/u,
	);
	// All experimental surfaces resolve from one map, so the open/close plumbing
	// is written once and the variant union cannot drift from the surfaces.
	assert.match(
		JIRA_WORK_ITEM_SOURCE,
		/const EXPERIMENTAL_SURFACES = \{\s*experimental: ExperimentalJiraWorkItem,\s*"experimental-v2": ExperimentalV2JiraWorkItem,\s*"experimental-v3": ExperimentalV3JiraWorkItem,\s*"experimental-v4": ExperimentalV4JiraWorkItem,\s*"experimental-v5": ExperimentalV5JiraWorkItem,\s*"team-eu26": TeamEu26JiraWorkItem,\s*\} as const;/u,
	);
	assert.match(JIRA_WORK_ITEM_SOURCE, /type ExperimentalVariant = keyof typeof EXPERIMENTAL_SURFACES;/u);
	// The experimental preset type is the model's preset union.
	assert.match(JIRA_WORK_ITEM_SOURCE, /import type \{ JiraWorkItemPreset \} from "@\/components\/blocks\/jira-work-item\/data\/session-state";/u);
});

test("JiraWorkItem preserves the standard variant behavior (regression)", () => {
	const defaultViewSource = JIRA_WORK_ITEM_SOURCE.slice(
		JIRA_WORK_ITEM_SOURCE.indexOf("function JiraWorkItemDefaultView"),
		JIRA_WORK_ITEM_SOURCE.indexOf("function JiraWorkItemExperimentalView"),
	);
	// Standard view keeps the Jira work item modal + shared floating Rovo launcher + chat surface.
	assert.match(defaultViewSource, /const \[isIssueOpen, setIsIssueOpen\] = useState\(initialIssueOpen\);/u);
	assert.match(defaultViewSource, /<JiraWorkItemModal isOpen=\{isIssueOpen\} onClose=\{handleIssueClose\} \/>/u);
	assert.match(defaultViewSource, /\{isIssueOpen && chatSurface === null \? \([\s\S]*<FloatingRovoButton[\s\S]*product="jira"[\s\S]*\/>[\s\S]*\) : null\}/u);
	assert.match(defaultViewSource, /\{chatSurface === "floating" \? <RovoFloatingChat key="floating-chat" \/> : null\}/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /import FloatingRovoButton from "@\/components\/projects\/shared\/components\/floating-rovo-button";/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /import RovoFloatingChat from "@\/components\/projects\/rovo-floating-chat\/components\/rovo-floating-chat";/u);
	// Standard mock context is not inlined into the block source.
	assert.doesNotMatch(defaultViewSource, /Acmecorp: Prepare for bid recommendation for ESM RFP/u);
});

test("JiraWorkItem documentation provides the Rovo chat runtime", () => {
	assert.match(COMPONENT_DOC_LAYOUT_SOURCE, /"blocks\/jira-work-item"/u);
	assert.doesNotMatch(COMPONENT_DOC_LAYOUT_SOURCE, /"blocks\/agent-sessions"/u);
	assert.match(
		COMPONENT_DOC_LAYOUT_SOURCE,
		/<ComponentDocChatRuntimeProvider>\{children\}<\/ComponentDocChatRuntimeProvider>/u,
	);
});

test("JiraWorkItem experimental view delegates chat ownership to its composition", () => {
	const experimentalViewSource = JIRA_WORK_ITEM_SOURCE.slice(
		JIRA_WORK_ITEM_SOURCE.indexOf("function JiraWorkItemExperimentalView"),
		JIRA_WORK_ITEM_SOURCE.indexOf("export default JiraWorkItem"),
	);
	assert.match(experimentalViewSource, /const \[isIssueOpen, setIsIssueOpen\] = useState\(initialIssueOpen\);/u);
	assert.match(experimentalViewSource, /const ExperimentalSurface = EXPERIMENTAL_SURFACES\[surface\];/u);
	assert.match(experimentalViewSource, /<ExperimentalSurface[\s\S]*open=\{isIssueOpen\}[\s\S]*onClose=\{handleIssueClose\}[\s\S]*initialPreset=\{initialExperimentalPreset\}[\s\S]*\/>/u);
	// The top-level variant does not duplicate either surface; its composition
	// bridges session state into the shared Jira Issue Rovo overlay.
	assert.doesNotMatch(experimentalViewSource, /JiraWorkItemModal/u);
	assert.doesNotMatch(experimentalViewSource, /RovoFloatingChat/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /import \{ ExperimentalJiraWorkItem \} from "@\/components\/blocks\/jira-work-item\/experimental\/experimental-jira-work-item";/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /import \{ ExperimentalV2JiraWorkItem \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/experimental-v2-jira-work-item";/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /import \{ ExperimentalV3JiraWorkItem \} from "@\/components\/blocks\/jira-work-item\/experimental-v3\/experimental-v3-jira-work-item";/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /import \{ ExperimentalV4JiraWorkItem \} from "@\/components\/blocks\/jira-work-item\/experimental-v4\/experimental-v4-jira-work-item";/u);
	// The newest full fork is isolated from every earlier/default variant while
	// retaining Next's default SSR behavior and the shared surface contract.
	assert.match(JIRA_WORK_ITEM_SOURCE, /import dynamic from "next\/dynamic";/u);
	assert.doesNotMatch(JIRA_WORK_ITEM_SOURCE, /import \{ ExperimentalV5JiraWorkItem \} from/u);
	assert.match(
		JIRA_WORK_ITEM_SOURCE,
		/const ExperimentalV5JiraWorkItem = dynamic\(\s*\(\) => import\("@\/components\/blocks\/jira-work-item\/experimental-v5\/experimental-v5-jira-work-item"\)\s*\.then\(\(module\) => module\.ExperimentalV5JiraWorkItem\),\s*\);/u,
	);
	assert.doesNotMatch(JIRA_WORK_ITEM_SOURCE, /ExperimentalV5JiraWorkItem = dynamic\([\s\S]*ssr:\s*false/u);
	assert.doesNotMatch(JIRA_WORK_ITEM_SOURCE, /import \{ TeamEu26JiraWorkItem \} from/u);
	assert.match(
		JIRA_WORK_ITEM_SOURCE,
		/const TeamEu26JiraWorkItem = dynamic\(\s*\(\) => import\("@\/components\/blocks\/jira-work-item\/team-eu26\/team-eu26-jira-work-item"\)\s*\.then\(\(module\) => module\.TeamEu26JiraWorkItem\),\s*\);/u,
	);
	assert.doesNotMatch(JIRA_WORK_ITEM_SOURCE, /TeamEu26JiraWorkItem = dynamic\([\s\S]*ssr:\s*false/u);
	// Shared open/close shell is extracted and used by both views.
	assert.match(JIRA_WORK_ITEM_SOURCE, /function JiraWorkItemShell\(/u);
	assert.equal((JIRA_WORK_ITEM_SOURCE.match(/<JiraWorkItemShell onOpen=/gu) ?? []).length, 2);
});

test("Jira Work Item comment composers keep their height stable when focused", () => {
	for (const variant of [
		"experimental",
		"experimental-v2",
		"experimental-v3",
		"experimental-v4",
		"experimental-v5",
		"team-eu26",
	]) {
		const composerSource = readBlockFile(`${variant}/components/activity-composer.tsx`);
		const activityComposer = composerSource.match(/<JiraActivityComposer\b[\s\S]*?\/>/u)?.[0];

		assert.ok(activityComposer, `${variant} must render a JiraActivityComposer`);
		assert.match(
			activityComposer,
			/placeholder="Comment, @mention an agent, or \/ for skills"/u,
		);
		assert.doesNotMatch(
			activityComposer,
			/\bexpandOnFocus\b/u,
			`${variant} still expands its comment composer on focus`,
		);
	}
});

test("the title Open split button uses direct 24px coding-agent logos", () => {
	const titleActionsSource = readBlockFile("experimental/components/context-title-actions.tsx");

	assert.match(titleActionsSource, /<ButtonGroup variant="split">/u);
	assert.match(
		titleActionsSource,
		/<DropdownMenuItem[\s\S]*className="gap-0\.5"[\s\S]*elemBefore=\{agent\.logo\}/u,
	);
	assert.match(titleActionsSource, /<LogoThirdParty name=\{name\} size="small" borderless \/>/u);
	assert.match(titleActionsSource, /<RovoColorIcon size="small" \/>/u);
	assert.doesNotMatch(titleActionsSource, /LogoThirdParty[^>]*size="xxsmall"/u);
	assert.match(
		titleActionsSource,
		/export function ContextTitleActions\(\{[\s\S]*collapsed = false,[\s\S]*primaryAgentId = "claude-code",/u,
	);
	assert.match(titleActionsSource, /CODING_AGENTS\.find\(\(agent\) => agent\.id === primaryAgentId\)/u);
	assert.doesNotMatch(titleActionsSource, /useJiraWorkItemState|useJiraWorkItemActions|StatusPill/u);
	assert.match(titleActionsSource, /\{collapsed \? null : \([\s\S]*aria-label="No restrictions"[\s\S]*<EyeOpenIcon[\s\S]*aria-label="Share"/u);
	assert.match(titleActionsSource, /collapsed \? \([\s\S]*<DropdownMenu[\s\S]*aria-label="Actions"/u);
	assert.match(titleActionsSource, />\s*No restrictions\s*<\/DropdownMenuItem>/u);
	assert.match(titleActionsSource, /elemAfter=\{<Badge>1<\/Badge>\}[\s\S]*>\s*Watch\s*<\/DropdownMenuItem>/u);
	assert.match(titleActionsSource, />\s*Share\s*<\/DropdownMenuItem>/u);
});

test("the experimental surface reuses the Jira Issue floating Rovo chat", () => {
	const compositionSource = readBlockFile("experimental/experimental-jira-work-item.tsx");
	const dialogSource = readBlockFile("experimental/components/experimental-work-item-dialog.tsx");
	const floatingSurfaceSource = readBlockFile("experimental/components/floating-session-surface.tsx");
	const sessionScriptsSource = readBlockFile("data/session-scripts.ts");
	const sharedOverlaySource = readProjectFile("components/projects/jira-golden-journeys-v0/components/jira-golden-journeys-v0-rovo-overlay.tsx");
	assert.match(compositionSource, /<JiraWorkItemProvider/u);
	assert.match(
		compositionSource,
		/blanketContent=\{[\s\S]*<FloatingSessionSurface(?:\s[^>]*)?\/>[\s\S]*\}/u,
	);
	assert.match(
		dialogSource,
		/<\/Dialog\.Popup>\s*\{open \? blanketContent : null\}\s*<\/Dialog\.Portal>/u,
	);
	assert.match(floatingSurfaceSource, /import \{ AsxRovoOverlay \} from "@\/components\/projects\/jira-golden-journeys-v0\/components\/jira-golden-journeys-v0-rovo-overlay";/u);
	assert.match(floatingSurfaceSource, /useAsxAgentChatDemo\(\)/u);
	assert.match(floatingSurfaceSource, /question: getSessionQuestion\(activeSession\)/u);
	assert.match(floatingSurfaceSource, /intro: getSessionQuestionIntro\(activeSession\)/u);
	assert.match(floatingSurfaceSource, /activeSession\.status === "waiting"[\s\S]*script\.resumeMessage/u);
	assert.match(floatingSurfaceSource, /<AsxRovoOverlay/u);
	assert.match(floatingSurfaceSource, /onLauncherClick=\{actions\.openLatestOrCreateGeneralSession\}/u);
	assert.match(sharedOverlaySource, /onButtonClick=\{onLauncherClick\}/u);
	assert.match(sharedOverlaySource, /interceptClarificationAnswers=\{Boolean\(onInterceptSubmit \|\| onQuestionAnswer\)\}/u);
	assert.match(sharedOverlaySource, /onInterceptSubmit=\{onInterceptSubmit \?\? \(onQuestionAnswer \? handleQuestionAnswer : undefined\)\}/u);
	assert.equal((sessionScriptsSource.match(/waitAfterIndex:/gu) ?? []).length, 2);
	assert.match(sessionScriptsSource, /id: "shop-4821-improve-description"[\s\S]*label: "Add suggested description"[\s\S]*label: "Keep current description"/u);
	assert.match(sessionScriptsSource, /waitingQuestion: \{[\s\S]*id: "pricing-seat-band"[\s\S]*label: "Assume 5,000 seats"[\s\S]*label: "Model a 5,000–10,000-seat range"/u);
	assert.doesNotMatch(floatingSurfaceSource, /FloatingSession(?:Panel|Header|Transcript|Progress|Composer|Launcher)/u);
	for (const fileName of [
		"floating-session-panel.tsx",
		"floating-session-header.tsx",
		"floating-session-transcript.tsx",
		"floating-session-progress.tsx",
		"floating-session-composer.tsx",
		"floating-session-launcher.tsx",
	]) {
		assert.equal(fs.existsSync(path.join(BLOCK_DIR, "experimental/components", fileName)), false);
	}
});

test("the scripted demo sessions use human task titles", () => {
	const sessionScriptsSource = readBlockFile("data/session-scripts.ts");
	for (const title of [
		"Map Acmecorp’s compliance requirements",
		"Review Acmecorp’s bid risks",
		"Model pricing options for Acmecorp",
		"Recommend next steps for this work item",
	]) {
		assert.ok(sessionScriptsSource.includes(`title: "${title}"`));
	}
	for (const terseTitle of ["Compliance matrix", "Risk review", "Pricing draft", "Work item assistant"]) {
		assert.ok(!sessionScriptsSource.includes(`title: "${terseTitle}"`));
	}
});

test("the activity layout imports a real content-visibility hook", () => {
	const activityPanelSource = readBlockFile("experimental/components/activity-panel.tsx");
	const layoutSource = readBlockFile("experimental/components/experimental-work-item-layout.tsx");

	assert.match(activityPanelSource, /export function useHasActivity\(\): boolean/u);
	assert.match(activityPanelSource, /return meta\.activityEvents\.length > 0;/u);
	assert.match(layoutSource, /import \{ useHasActivity \} from .*activity-panel";/u);
	assert.match(activityPanelSource, /onSubmitReply=\{handleSubmitReply\}/u);
	assert.match(activityPanelSource, /actions\.replySession\(event\.sessionId, body\)/u);
});

test("the experimental modal hugs its content until the viewport gap cap", () => {
	const dialogSource = readBlockFile("experimental/components/experimental-work-item-dialog.tsx");
	const layoutSource = readBlockFile("experimental/components/experimental-work-item-layout.tsx");

	assert.match(dialogSource, /max-h-\[calc\(100dvh-24px\)\]/u);
	assert.match(dialogSource, /sm:max-h-\[calc\(100vh-120px\)\]/u);
	assert.match(dialogSource, /gridTemplateColumns: "minmax\(0, 1fr\)"/u);
	assert.doesNotMatch(dialogSource, /(?:^|[^-])h-\[calc\(100dvh-24px\)\]/u);
	assert.doesNotMatch(dialogSource, /sm:h-\[calc\(100vh-120px\)\]/u);
	assert.match(layoutSource, /@\[860px\]\/agentlayout:grid-rows-\[minmax\(0,1fr\)\]/u);
	assert.equal((layoutSource.match(/@\[860px\]\/agentlayout:\[grid-area:1\/1\]/gu) ?? []).length, 2);
	assert.doesNotMatch(layoutSource, /@\[860px\]\/agentlayout:absolute/u);
});

test("the experimental metadata control is a neutral disclosure with Queue Details motion", () => {
	const actionsSource = readBlockFile("experimental/components/experimental-breadcrumb-actions.tsx");
	const dialogSource = readBlockFile("experimental/components/experimental-work-item-dialog.tsx");
	const modalHeaderSource = readProjectFile("components/projects/jira/components/work-item-modal/modal-header.tsx");
	const panelLayoutSource = readBlockFile("experimental/context-panel-layout.tsx");
	const panelLayoutMotionSource = readBlockFile("experimental/context-panel-layout-motion.ts");
	const layoutSource = readBlockFile("experimental/components/experimental-work-item-layout.tsx");
	const titleBarSource = readBlockFile("experimental/components/context-title-bar.tsx");

	assert.doesNotMatch(actionsSource, /aria-pressed/u);
	assert.match(actionsSource, /aria-expanded=\{!metadataCollapsed\}/u);
	assert.match(actionsSource, /aria-controls="experimental-work-item-metadata-panel"/u);
	assert.match(actionsSource, /disabled=\{metadataTogglePending\}/u);
	assert.match(actionsSource, /metadataCollapsed \? "Show metadata panel" : "Hide metadata panel"/u);
	assert.match(actionsSource, /aria-expanded:border-transparent aria-expanded:bg-transparent/u);
	assert.equal((actionsSource.match(/variant="ghost"/gu) ?? []).length, 2);
	assert.doesNotMatch(actionsSource, /variant="outline"/u);
	// Collapsed-only preview: a hover-opened Popover anchored to the toggle icon
	// renders the borderless rail directly beneath it (no far-travel/gap dismiss).
	// Base UI keeps the popup open across the trigger->popup path; clicking docks.
	assert.match(actionsSource, /import \{ Popover, PopoverContent, PopoverTrigger \} from "@\/components\/ui\/popover"/u);
	assert.match(actionsSource, /import \{ MetadataRail \} from "@\/components\/blocks\/jira-work-item\/experimental\/components\/metadata-rail"/u);
	// The Popover wrapper is always mounted (stable trigger element), but the
	// controlled state rejects click-open so only collapsed-state hover can preview.
	assert.match(actionsSource, /open=\{metadataCollapsed && metadataPreviewOpen\}/u);
	assert.match(actionsSource, /eventDetails\.reason === "trigger-press"/u);
	assert.match(actionsSource, /eventDetails\.cancel\(\)/u);
	assert.match(actionsSource, /eventDetails\.cancel\(\);\s*setMetadataPreviewOpen\(false\)/u);
	assert.match(actionsSource, /openOnHover=\{metadataCollapsed\}/u);
	assert.match(actionsSource, /delay=\{120\}/u);
	assert.match(actionsSource, /closeDelay=\{80\}/u);
	assert.match(actionsSource, /render=\{toggleButton\}/u);
	assert.match(actionsSource, /<MetadataRail borderless \/>/u);
	assert.match(actionsSource, /align="end"/u);
	assert.match(actionsSource, /className="[^"]*border-0[^"]*shadow-2xl[^"]*dark:shadow-2xl[^"]*"/u);
	// The work-item dialog paints at z-[500]/[501]; the preview must sit above it,
	// or it mounts but is painted behind the dialog (invisible on screen).
	assert.match(actionsSource, /positionerClassName="z-\[600\]"/u);
	// The old right-edge peek-overlay pointer/focus wiring is gone.
	assert.doesNotMatch(actionsSource, /setMetadataPeek/u);
	assert.doesNotMatch(actionsSource, /peekProps/u);
	assert.match(dialogSource, /actionsClassName="gap-1"/u);
	assert.match(dialogSource, /closeButtonVariant="ghost"/u);
	assert.match(modalHeaderSource, /breadcrumbRevealOnHover \? "group\/breadcrumb-reveal"/u);
	assert.match(modalHeaderSource, /"min-w-0 overflow-visible"/u);
	assert.match(modalHeaderSource, /<BreadcrumbList className="-m-1 min-w-0 flex-nowrap overflow-hidden p-1">/u);
	assert.match(layoutSource, /<AnimatePresence initial=\{false\}>/u);
	assert.match(layoutSource, /id="experimental-work-item-metadata-panel"/u);
	assert.match(layoutSource, /transform: "translateX\(100%\)"/u);
	assert.match(layoutSource, /duration: 0\.25, ease: \[0, 0\.4, 0, 1\]/u);
	assert.match(layoutSource, /duration: 0\.2, ease: \[0\.6, 0, 0\.8, 0\.6\]/u);
	assert.match(layoutSource, /useReducedMotion\(\)/u);
	assert.match(layoutSource, /maxWidth: metadataCollapsed \? "800px" : "100%"/u);
	assert.match(layoutSource, /METADATA_CONTENT_COLLAPSE_TRANSITION/u);
	assert.match(layoutSource, /METADATA_CONTENT_EXPAND_TRANSITION/u);
	assert.equal((layoutSource.match(/layout=\{shouldReduceMotion \? false : "position"\}/gu) ?? []).length, 1);
	assert.match(layoutSource, /data-jira-work-item-content-column/u);
	// The floating right-edge peek overlay is gone: the collapsed-rail preview now
	// lives as a trigger-anchored dropdown owned by the breadcrumb actions, so the
	// layout no longer carries peek state, a peek slot, or the z-30 overlay.
	assert.doesNotMatch(layoutSource, /showMetadataPeek/u);
	assert.doesNotMatch(layoutSource, /metadataPeeking/u);
	assert.doesNotMatch(layoutSource, /setMetadataPeek/u);
	assert.doesNotMatch(layoutSource, /metadataPeek/u);
	assert.doesNotMatch(layoutSource, /METADATA_PEEK_VARIANTS/u);
	assert.doesNotMatch(layoutSource, /@\[860px\]\/agentlayout:z-30/u);
	// The docked panel still uses the overlay elevation via the rail itself, but
	// the layout file no longer applies its own peek boxShadow.
	assert.doesNotMatch(layoutSource, /boxShadow: token\("elevation\.shadow\.overlay"\)/u);
	const compositionSource = readBlockFile("experimental/experimental-jira-work-item.tsx");
	assert.doesNotMatch(compositionSource, /metadataPeek/u);
	const experimentalRailSource = readBlockFile("experimental/components/metadata-rail.tsx");
	assert.doesNotMatch(experimentalRailSource, /components\/blocks\/artifact-pane/u);
	assert.match(experimentalRailSource, /<Tabs defaultValue="details">/u);

	assert.match(titleBarSource, /maxWidth: metadataCollapsed \? "800px" : "100%"/u);
	assert.match(titleBarSource, /data-jira-work-item-title-column/u);
	assert.match(titleBarSource, /layout=\{shouldReduceMotion \? false : "position"\}/u);
	assert.match(titleBarSource, /onLayoutAnimationComplete=\{\(\) => setSettledMetadataCollapsed\(metadataCollapsed\)\}/u);
	assert.match(titleBarSource, /data-jira-work-item-title/u);
	assert.doesNotMatch(titleBarSource, /function AnimatedContextTitle\(/u);
	assert.match(titleBarSource, /<AnimatePresence initial=\{false\} mode="popLayout">/u);
	assert.match(titleBarSource, /key=\{metadataCollapsed \? "metadata-collapsed" : "metadata-expanded"\}/u);
	assert.match(titleBarSource, /collapsed=\{metadataCollapsed\}/u);
	assert.match(titleBarSource, /settledMetadataCollapsed === metadataCollapsed/u);
	assert.match(panelLayoutMotionSource, /METADATA_CONTENT_COLLAPSE_DURATION_MS = 200/u);
	assert.match(panelLayoutMotionSource, /METADATA_CONTENT_EXPAND_DURATION_MS = 250/u);
	assert.match(panelLayoutSource, /const \[metadataTogglePending, setMetadataTogglePending\] = useState\(false\);/u);
	assert.match(panelLayoutSource, /toggleMetadata = useCallback\(\(\) => \{[\s\S]*setMetadataTogglePending\(true\);[\s\S]*\}, \[\]\)/u);
	assert.match(panelLayoutSource, /setMetadataCollapsed\(\(collapsed\) => !collapsed\);[\s\S]*setMetadataTogglePending\(false\);/u);
	// Peek state moved out of the panel-layout owner: the collapsed-rail preview is
	// now a self-contained hover Popover on the toggle, so no peek state,
	// setter, docking-clear effect, or peek transitions remain here.
	assert.doesNotMatch(panelLayoutSource, /metadataPeeking/u);
	assert.doesNotMatch(panelLayoutSource, /setMetadataPeek/u);
	assert.doesNotMatch(panelLayoutSource, /METADATA_PEEK_ENTER_TRANSITION/u);
	assert.doesNotMatch(panelLayoutSource, /METADATA_PEEK_EXIT_TRANSITION/u);
	assert.match(titleBarSource, /const ACTIONS_EXIT_DURATION_MS = 50;/u);
	assert.match(titleBarSource, /duration: ACTIONS_EXIT_DURATION_MS \/ 1000,[\s\S]*ease: \[0\.6, 0, 0\.8, 0\.6\]/u);
	assert.match(titleBarSource, /duration: 0\.1,[\s\S]*ease: \[0\.4, 1, 0\.6, 1\]/u);
	assert.match(titleBarSource, /EXPANDED_ACTIONS_ENTER_TRANSITION[\s\S]*duration: 0\.05/u);
	assert.match(titleBarSource, /collapsed \? ACTIONS_ENTER_TRANSITION : EXPANDED_ACTIONS_ENTER_TRANSITION/u);
	assert.match(titleBarSource, /opacity: 0, scale: 0\.96/u);
	assert.match(titleBarSource, /const isInteractive = !hideForToggle && isLayoutSettled && !isAnimating;/u);
	assert.match(titleBarSource, /hideForToggle=\{metadataTogglePending\}/u);
	assert.match(titleBarSource, /onToggleExitComplete=\{completeMetadataToggle\}/u);
	assert.match(titleBarSource, /if \(!hideForToggle \|\| didCompleteToggleExit\.current\) return undefined;/u);
	assert.match(titleBarSource, /window\.setTimeout\(\(\) => \{[\s\S]*onToggleExitComplete\(\);[\s\S]*shouldReduceMotion \? 0 : ACTIONS_EXIT_DURATION_MS/u);
	assert.match(titleBarSource, /return \(\) => window\.clearTimeout\(timeout\);/u);
	assert.match(titleBarSource, /onAnimationComplete=\{\(\) => setIsAnimating\(false\)\}/u);
	assert.match(titleBarSource, /didCompleteToggleExit\.current = true;/u);
	assert.match(titleBarSource, /inert=\{isInteractive \? undefined : true\}/u);
	assert.match(titleBarSource, /willChange: isAnimating \? "transform, opacity" : undefined/u);
});

test("AI Planner is composed below the title with shared TWG and prompt primitives", () => {
	const contextPanelSource = readBlockFile("experimental/components/context-panel.tsx");
	const plannerPanelSource = readBlockFile("experimental/components/ai-planner-panel.tsx");
	const activityComposerSource = readBlockFile("experimental/components/activity-composer.tsx");
	const jiraActivityComposerSource = readProjectFile("components/blocks/jira-activity/jira-activity-composer.tsx");
	const activityPanelSource = readBlockFile("experimental/components/activity-panel.tsx");
	const agentContextPillSource = readBlockFile("experimental/components/activity-composer-agent-context-pill.tsx");
	const skillContextPillSource = readBlockFile("experimental/components/activity-composer-skill-context-pill.tsx");
	const contextPillsSource = readBlockFile("experimental/components/activity-composer-context-pills.tsx");
	const composerMotionSource = readBlockFile("experimental/components/jira-work-item-composer-motion.tsx");
	const layoutSource = readBlockFile("experimental/components/experimental-work-item-layout.tsx");
	const compositionSource = readBlockFile("experimental/experimental-jira-work-item.tsx");
	const contextResourcesSource = readBlockFile("experimental/components/context-resources.tsx");
	const contextEditableHeaderSource = readBlockFile("experimental/components/context-editable-header.tsx");
	const twgToolSource = readProjectFile("components/ui-custom/twg-tool.tsx");
	const agentSummaryRowSource = fs.readFileSync(
		path.join(process.cwd(), "components", "blocks", "agent", "components", "agent-summary-row.tsx"),
		"utf8",
	);
	const detailsSource = readBlockFile("experimental/components/details-tab.tsx");
	assert.ok(contextPanelSource.indexOf("<ContextEditableTitle />") < contextPanelSource.indexOf("<AiPlannerScope"));
	assert.ok(contextPanelSource.indexOf("<AiPlannerScope") < contextPanelSource.indexOf("<AiPlannerPanel />"));
	assert.ok(contextPanelSource.indexOf("<AiPlannerPanel />") < contextPanelSource.indexOf("<ContextResources outputs={outputs} />"));
	assert.ok(contextPanelSource.indexOf("<ContextResources outputs={outputs} />") < contextPanelSource.indexOf("<ContextEditableDescription />"));
	assert.match(contextResourcesSource, /outputs\.length > 0 \? \([\s\S]*items=\{outputs\}[\s\S]*label="Output"/u);
	assert.match(contextPanelSource, /<AiPlannerScope header=\{<AiPlannerPanel \/>\}>/u);
	// The context resources and description sit directly adjacent — no divider rule.
	assert.doesNotMatch(contextPanelSource, /<div aria-hidden className="h-px bg-border" \/>/u);
	assert.doesNotMatch(contextPanelSource, />Details</u);
	assert.match(contextEditableHeaderSource, /placeholder="Press \/ to help improve the work item"/u);
	assert.match(contextEditableHeaderSource, /"agent-instructions-tiptap-editor context-description-tiptap-editor text-text"/u);
	assert.match(contextEditableHeaderSource, /isProcessing && "context-description-tiptap-editor-hug"/u);
	assert.match(contextEditableHeaderSource, /mentionSources=\{EDITOR_PALETTE_MENTION_SOURCES\}/u);
	assert.match(contextEditableHeaderSource, /suggestionVariant="nested"/u);
	assert.match(contextEditableHeaderSource, /toolbarReveal="hover"/u);
	assert.match(contextEditableHeaderSource, /\bpadStuckToolbar\b/u);
	assert.doesNotMatch(contextEditableHeaderSource, /showToolbar=\{false\}|showBubbleMenu=\{false\}/u);
	assert.match(plannerPanelSource, /import \{ TwgTool, type TwgToolSource \} from "@\/components\/ui-custom\/twg-tool";/u);
	assert.match(plannerPanelSource, /import \{ Tile \} from "@\/components\/ui\/tile";/u);
	assert.match(plannerPanelSource, /import \{ TWGLoader \} from "@\/components\/ui-custom\/twg-loader";/u);
	assert.match(plannerPanelSource, /<Tile[\s\S]*className="relative z-10 bg-surface"[\s\S]*hasBorder[\s\S]*label="Teamwork Graph"[\s\S]*size="large"[\s\S]*variant="transparent"[\s\S]*<TWGLoader label="Teamwork Graph" size="small" \/>/u);
	assert.equal((plannerPanelSource.match(/loader=\{<TeamworkGraphLoaderTile \/>\}/gu) ?? []).length, 2);
	assert.equal((plannerPanelSource.match(/title="Teamwork Graph"/gu) ?? []).length, 2);
	assert.doesNotMatch(plannerPanelSource, /title="AI Planner"|aria-label="AI Planner controls"/u);
	assert.match(twgToolSource, /loader\?: ReactNode;/u);
	assert.match(twgToolSource, /loader \?\? \([\s\S]*<TWGLoader label="Teamwork Graph" size="small" \/>/u);
	assert.match(plannerPanelSource, /import \{ FloatingComposer \} from "@\/components\/projects\/shared\/components\/floating-composer";/u);
	assert.match(plannerPanelSource, /import \{ RovoComposerActionButton \} from "@\/components\/projects\/shared\/components\/rovo-composer-send-controls";/u);
	assert.match(plannerPanelSource, /<FloatingComposer[\s\S]*PromptInputTextarea[\s\S]*Tell Rovo what to change…/u);
	assert.match(plannerPanelSource, /planner\.status === "inactive" \|\| planner\.status === "applied"/u);
	assert.doesNotMatch(plannerPanelSource, /Planned by Rovo/u);
	assert.match(plannerPanelSource, /<CrossIcon label="" size="small" \/>[\s\S]*Reject/u);
	assert.match(plannerPanelSource, /<CheckMarkIcon label="" size="small" \/>[\s\S]*Accept suggestions/u);
	assert.match(plannerPanelSource, /<RovoComposerActionButton[\s\S]*experimentalDarkCta/u);
	assert.doesNotMatch(plannerPanelSource, /PromptInputFooter|PromptInputSubmit/u);
	assert.match(plannerPanelSource, /const hasPlanner = planner\.status === "searching" \|\| isReviewing;/u);
	assert.match(plannerPanelSource, /data-ai-planner-scope=\{hasPlanner \? "active" : undefined\}/u);
	assert.match(plannerPanelSource, /import \{ RovoGeneration \} from "@\/components\/ui-custom\/rovo-generation";/u);
	assert.match(plannerPanelSource, /<RovoGeneration\.Highlight active=\{isReviewing\} className="block w-full">/u);
	assert.doesNotMatch(plannerPanelSource, /\{isReviewing \? \(\s*<RovoGeneration\.Highlight/u);
	assert.match(plannerPanelSource, /hasPlanner \? "rounded-xl border border-border bg-bg-input p-1\.5" : null/u);
	assert.match(plannerPanelSource, /hasPlanner \? "px-2 pb-2" : null/u);
	assert.doesNotMatch(plannerPanelSource, /border-border-discovery-subtle/u);
	assert.match(plannerPanelSource, /data-ai-planner-controls="floating"/u);
	assert.match(plannerPanelSource, /className="relative z-20 mt-4"/u);
	assert.doesNotMatch(plannerPanelSource, /className="absolute inset-x-0/u);
	assert.match(plannerPanelSource, /<JiraWorkItemComposerMotion placement="planner">[\s\S]*<FloatingComposer/u);
	assert.equal((plannerPanelSource.match(/size="default"/gu) ?? []).length, 2);
	assert.match(plannerPanelSource, /className="border-0 bg-surface-overlay"/u);
	assert.match(plannerPanelSource, /style=\{\{ boxShadow: token\("elevation\.shadow\.overlay"\) \}\}/u);
	assert.doesNotMatch(plannerPanelSource, /useRovoChat|launchSession/u);
	assert.match(compositionSource, /<LayoutGroup id=\{composerLayoutGroupId\}>/u);
	assert.match(composerMotionSource, /layoutId=\{metadataLayoutAnimating \? undefined : "jira-work-item-composer"\}/u);
	assert.match(composerMotionSource, /<LayoutGroup inherit="id">/u);
	assert.match(composerMotionSource, /layout=\{metadataLayoutAnimating \? false : layout\}/u);
	assert.match(composerMotionSource, /layoutDependency=\{layoutDependency \?\? placement\}/u);
	assert.match(composerMotionSource, /duration: 0\.25,[\s\S]*ease: \[0\.4, 0, 0, 1\]/u);
	assert.match(composerMotionSource, /useReducedMotion\(\)/u);
	assert.match(composerMotionSource, /onLayoutAnimationStart[\s\S]*onLayoutAnimationComplete/u);
	assert.match(layoutSource, /planner\.status === "inactive" \|\| planner\.status === "applied"/u);
	assert.match(layoutSource, /\{showStickyComposer \? \([\s\S]*\{composer\}[\s\S]*\) : null\}/u);
	assert.match(layoutSource, /useHasVerticalOverflow/u);
	assert.match(layoutSource, /buildScrollMaskStyle\(\{ fadeTop: showTopScrollMask, fadeBottom: showBottomScrollMask \}\)/u);
	assert.match(layoutSource, /data-jira-work-item-scroll-region/u);
	assert.match(layoutSource, /data-jira-work-item-composer-dock/u);
	assert.match(layoutSource, /className="[^"]*bg-transparent[^"]*"[\s\S]*data-jira-work-item-composer-dock/u);
	assert.doesNotMatch(layoutSource, /className="[^"]*bg-background[^"]*"[\s\S]*data-jira-work-item-composer-dock/u);
	assert.doesNotMatch(layoutSource, /bg-background\/90|backdrop-blur/u);
	assert.doesNotMatch(layoutSource, /agentlayout:border-t|agentlayout:border-border/u);
	assert.match(activityComposerSource, /<ActivityComposerContextPills[\s\S]*onInvokeAgent=\{handleInvokeAgent\}[\s\S]*onInvokeSkill=\{handleInvokeSkill\}/u);
	assert.match(activityComposerSource, /actions\.invokeAgent\(agent, "context-pill", `@\$\{agent\.name\}`\)/u);
	assert.match(activityComposerSource, /ROVO_AGENT_SELECTOR_AGENTS\.find\(\(agent\) => includesComposerAgentMention\(text, agent\.name\)\)/u);
	assert.match(activityComposerSource, /actions\.invokeAgent\(invokedAgent, "prompt", text\)/u);
	assert.match(activityComposerSource, /\{ id: `skill:\$\{skill\.id\}`, name: "Rovo" \}[\s\S]*`\/\$\{skill\.name\}`,[\s\S]*skill\.name/u);
	assert.match(activityComposerSource, /findSteeredWorkingSession\(state\.sessions, text\)/u);
	assert.doesNotMatch(activityComposerSource, /insertContext|requestAnimationFrame|textareaRef/u);
	assert.doesNotMatch(activityComposerSource, /onStatusChange=/u);
	assert.doesNotMatch(contextPillsSource, /Move to:|StatusPill/u);
	assert.match(activityComposerSource, /import \{ JiraActivityComposer \} from "@\/components\/blocks\/jira-activity";/u);
	assert.match(activityComposerSource, /<JiraWorkItemComposerMotion placement="sticky">[\s\S]*<JiraActivityComposer/u);
	assert.match(activityComposerSource, /onValueChange=\{handlePromptChange\}/u);
	assert.match(activityComposerSource, /const JIRA_WORK_ITEM_MENTION_LABELS = \{ subagent: "Agents" \} as const;/u);
	assert.match(activityComposerSource, /const JIRA_WORK_ITEM_SUGGESTION_VARIANT = \{ command: "flat", mention: "flat" \} as const;/u);
	assert.match(activityComposerSource, /mentionSectionLabels=\{JIRA_WORK_ITEM_MENTION_LABELS\}/u);
	assert.match(activityComposerSource, /suggestionVariant=\{JIRA_WORK_ITEM_SUGGESTION_VARIANT\}/u);
	assert.match(activityComposerSource, /label: "Continue in existing session"/u);
	assert.match(activityComposerSource, /label: "Start a new session"/u);
	assert.match(activityComposerSource, /data-jira-work-item-session-target-menu/u);
	assert.match(activityComposerSource, /<RichTextSuggestionMenu[\s\S]*className="rich-text-command-menu-borderless w-full!"[\s\S]*items=\{SESSION_TARGET_MENU_ITEMS\}/u);
	assert.match(activityComposerSource, /sessionTargetSelection\.choice === "new"/u);
	assert.match(activityComposerSource, /actions\.invokeAgent\([\s\S]*id: mentionedAgentSession\.agentId[\s\S]*"prompt",[\s\S]*text/u);
	assert.match(activityComposerSource, /submitAccessory=\{startsNewSession \? \([\s\S]*<Tag[\s\S]*onRemove=\{\(\) => chooseSessionTarget\("continue"\)\}[\s\S]*New session/u);
	assert.match(jiraActivityComposerSource, /submitAccessory\?: ReactNode;/u);
	// The accessory renders immediately before the shared action rail (dictation
	// mic + disabled-aware submit), not a local submit Button.
	assert.match(
		jiraActivityComposerSource,
		/\{submitAccessory\}[\s\S]*<RovoComposerActionButton[\s\S]*canSubmit=\{canSubmit\}[\s\S]*showSubmitWhenEmpty/u,
	);
	assert.match(activityComposerSource, /value=\{draft\}/u);
	assert.doesNotMatch(activityComposerSource, /import \{ FloatingComposer \}|PromptInputTextarea|RovoComposerActionButton/u);
	assert.doesNotMatch(activityComposerSource, /ActivitySuggestionMenu|TRAILING_TOKEN|buildItems/u);
	assert.doesNotMatch(activityComposerSource, /className="shadow-none"/u);
	assert.doesNotMatch(activityComposerSource, /requestedContext/u);
	assert.match(activityPanelSource, /import \{ JiraActivity \} from "@\/components\/blocks\/jira-activity";/u);
	assert.match(activityPanelSource, /mapActivityEventsToJiraEntries\(meta\.activityEvents\)/u);
	assert.match(activityPanelSource, /<JiraActivity[\s\S]*composer=\{null\}[\s\S]*entries=\{entries\}[\s\S]*onViewSession=/u);
	assert.match(activityPanelSource, /actions\.openSession\(item\.id\)/u);
	assert.match(activityPanelSource, /data-jira-activity-entry-id/u);
	assert.match(activityPanelSource, /target\.scrollIntoView\(\{[\s\S]*behavior: shouldReduceMotion \? "auto" : "smooth",[\s\S]*block: "nearest"/u);
	assert.doesNotMatch(activityPanelSource, /ActivityEventList/u);
	assert.match(contextPillsSource, /<ActivityComposerAgentContextPill onInvokeAgent=\{onInvokeAgent\} \/>/u);
	assert.match(contextPillsSource, /<ActivityComposerSkillContextPill onInvokeSkill=\{onInvokeSkill\} \/>/u);
	assert.match(contextPillsSource, /delayChildren: 0\.25/u);
	assert.match(contextPillsSource, /staggerChildren: 0\.05/u);
	assert.match(contextPillsSource, /initial=\{shouldReduceMotion \? false : "hidden"\}/u);
	assert.match(agentContextPillSource, /import \{ AgentSelector(?:, type AgentSelectorAgent)? \} from "@\/components\/blocks\/agent-selector";/u);
	assert.match(agentContextPillSource, /<DropdownMenuTrigger[\s\S]*<ContextBarPill[\s\S]*Assign agents/u);
	assert.match(agentContextPillSource, /<AgentSelector[\s\S]*agents=\{ROVO_AGENT_SELECTOR_AGENTS\}[\s\S]*selectionMode="single"/u);
	assert.match(agentContextPillSource, /onInvokeAgent\(agent\);[\s\S]*setIsOpen\(false\);/u);
	assert.match(skillContextPillSource, /import \{ SkillSelector \} from "@\/components\/blocks\/skill-selector";/u);
	assert.match(skillContextPillSource, /<DropdownMenuTrigger[\s\S]*<ContextBarPill[\s\S]*Use skills/u);
	assert.match(skillContextPillSource, /<SkillSelector[\s\S]*onSkillToggle=\{handleSkillToggle\}[\s\S]*selectionMode="single"/u);
	assert.match(skillContextPillSource, /const skill = WORK_ITEM_SKILLS\.find[\s\S]*onInvokeSkill\(skill\);[\s\S]*setIsOpen\(false\);/u);
	assert.match(contextResourcesSource, /import \{ Icon \} from "@\/components\/ui\/icon";/u);
	assert.match(
		contextResourcesSource,
		/flex flex-wrap items-start gap-1 \*:focus-visible:relative \*:focus-visible:z-10/u,
	);
	assert.equal((contextResourcesSource.match(/(?:elemBefore|itemElemBefore)=\{(?:\(\) => \(\s*)?<Icon aria-hidden render=/gu) ?? []).length, 4);
	assert.equal((contextResourcesSource.match(/labelClassName="whitespace-nowrap sm:w-28"/gu) ?? []).length, 4);
	assert.match(agentSummaryRowSource, /labelClassName\?: string;/u);
	assert.match(agentSummaryRowSource, /className=\{cn\("sm:w-20 sm:shrink-0", labelClassName\)\}/u);
	assert.match(detailsSource, /<FloatingField filled=\{hasAgents\} icon=\{AiAgentIcon\} label="Agents">/u);
	assert.match(detailsSource, /\{hasAgents \? agentsField : null\}/u);
	assert.match(detailsSource, /\{!hasAgents \? agentsField : null\}/u);
	for (const source of [contextResourcesSource, detailsSource]) {
		assert.doesNotMatch(source, /PlannerSuggestion|planner\.proposal|isPlannerFieldPending/u);
	}
	assert.equal(fs.existsSync(path.join(BLOCK_DIR, "experimental/components/context-summary.tsx")), false);
	assert.equal(fs.existsSync(path.join(BLOCK_DIR, "experimental/components/planner-suggestion.tsx")), false);
	assert.equal(fs.existsSync(path.join(BLOCK_DIR, "experimental/components/activity-event-list.tsx")), false);
	assert.equal(fs.existsSync(path.join(BLOCK_DIR, "experimental/components/activity-agent-event.tsx")), false);
	assert.equal(fs.existsSync(path.join(BLOCK_DIR, "experimental/components/activity-human-event.tsx")), false);
});

test("the activity skill picker uses work-item skills and space-managed defaults", () => {
	const skillPickerSource = readBlockFile("experimental/components/activity-composer-skill-context-pill.tsx");
	const pickerOptionsSource = readBlockFile("lib/work-item-picker-options.ts");

	for (const label of [
		"Summarize work item",
		"Summarize comments",
		"Improve description",
		"Suggest child work items",
		"Link similar work items",
	]) {
		assert.match(pickerOptionsSource, new RegExp(`name: "${label}"`, "u"));
	}
	assert.match(
		pickerOptionsSource,
		/export const DEFAULT_PINNED_WORK_ITEM_SKILL_IDS = \[\s*"summarize-comments",\s*"improve-description",\s*\] as const;/u,
	);
	assert.match(pickerOptionsSource, /export const WORK_ITEM_PINNED_ITEMS_LABEL = "Pinned by space";/u);
	assert.match(skillPickerSource, /pinnedItemsLabel=\{WORK_ITEM_PINNED_ITEMS_LABEL\}/u);
	assert.match(skillPickerSource, /skills=\{WORK_ITEM_SKILLS\}/u);
});

test("work-item skills use varied Skills Directory collection colors", () => {
	const pickerOptionsSource = readBlockFile("lib/work-item-picker-options.ts");
	const collectionIds = [...pickerOptionsSource.matchAll(/collectionId: "([^"]+)"/gu)]
		.map((match) => match[1]);

	assert.ok(new Set(collectionIds).size >= 4);
	assert.match(pickerOptionsSource, /source: "platform"/u);
});

test("the activity agent picker uses space-managed defaults", () => {
	const agentPickerSource = readBlockFile("experimental/components/activity-composer-agent-context-pill.tsx");
	const pickerOptionsSource = readBlockFile("lib/work-item-picker-options.ts");

	assert.match(
		pickerOptionsSource,
		/export const DEFAULT_PINNED_SPACE_AGENT_IDS = \[\s*"rfp-drafting-agent",\s*"readiness-checker",\s*\] as const;/u,
	);
	assert.match(agentPickerSource, /pinnedItemsLabel=\{WORK_ITEM_PINNED_ITEMS_LABEL\}/u);
});

test("running metronome is gated on the open surface so preset sessions stay pristine until opened (regression)", () => {
	const controllerSource = readBlockFile("experimental/use-jira-work-item-controller.ts");
	const contextSource = readBlockFile("experimental/context-jira-work-item.tsx");
	const compositionSource = readBlockFile("experimental/experimental-jira-work-item.tsx");

	// Controller: the metronome only ticks while the surface is active AND a session
	// is running, while the seeded running demo remains frozen for presentation.
	assert.match(controllerSource, /active = true,?/u);
	assert.match(controllerSource, /const isFrozenRunningDemo = state\.preset === "running";/u);
	assert.match(controllerSource, /if \(!active \|\| !isRunning \|\| isFrozenRunningDemo\) return undefined;/u);
	assert.match(controllerSource, /\[active, isFrozenRunningDemo, isRunning, shouldReduceMotion\]/u);

	// Provider forwards the gate to the controller.
	assert.match(contextSource, /active\?: boolean;/u);
	assert.match(
		contextSource,
		/useJiraWorkItemController\(initialPreset, workItem, active(?:, initialState)?\)/u,
	);
	assert.match(controllerSource, /hasRunningSession\(state\) \|\| isPlannerProcessing\(state\.planner\)/u);

	// Composition drives the gate from the dialog open state.
	assert.match(compositionSource, /<JiraWorkItemProvider[\s\S]*active=\{open\}[\s\S]*>/u);
});

// ── Source shape: preset chooser page ────────────────────────────────────────

test("page.tsx is the variant chooser with the newest fork primary and all variants filled", () => {
	const pageSource = readBlockFile("page.tsx");
	assert.match(pageSource, /const \[activeVariant, setActiveVariant\] = useState<JiraWorkItemVariant \| null>\(null\);/u);
	assert.match(pageSource, /Open standard session/u);
	assert.match(pageSource, /Open experimental session/u);
	assert.match(pageSource, /Open experimental v2 session/u);
	assert.match(pageSource, /Open experimental v3 session/u);
	assert.match(pageSource, /Open experimental v4 session/u);
	assert.match(pageSource, /Open experimental v5 session/u);
	assert.match(pageSource, /Open Team EU26 session/u);
	assert.match(pageSource, /onClick=\{\(\) => setActiveVariant\("default"\)\}/u);
	assert.match(pageSource, /onClick=\{\(\) => setActiveVariant\("experimental"\)\}/u);
	assert.match(pageSource, /onClick=\{\(\) => setActiveVariant\("experimental-v2"\)\}/u);
	assert.match(pageSource, /onClick=\{\(\) => setActiveVariant\("experimental-v3"\)\}/u);
	assert.match(pageSource, /onClick=\{\(\) => setActiveVariant\("experimental-v4"\)\}/u);
	assert.match(pageSource, /onClick=\{\(\) => setActiveVariant\("experimental-v5"\)\}/u);
	assert.match(pageSource, /onClick=\{\(\) => setActiveVariant\("team-eu26"\)\}/u);
	assert.match(
		pageSource,
		/className="flex h-full min-h-screen flex-wrap content-center items-center justify-center gap-3 p-4"/u,
	);
	// Exactly one primary call to action: the newest fork. Every older chooser
	// entry is a neutral outline button.
	assert.equal((pageSource.match(/variant="outline"/gu) ?? []).length, 6);
	assert.match(
		pageSource,
		/<Button type="button" onClick=\{\(\) => setActiveVariant\("team-eu26"\)\}>/u,
	);
	// Remounts deterministically via key; every experimental variant uses the filled preset.
	assert.match(pageSource, /<JiraWorkItem[\s\S]*key=\{activeVariant\}[\s\S]*variant=\{activeVariant\}[\s\S]*initialExperimentalPreset="filled"[\s\S]*\/>/u);
	assert.match(pageSource, /export function JiraWorkItemExperimentalPage/u);
	assert.match(pageSource, /export function JiraWorkItemExperimentalV2Page/u);
	assert.match(pageSource, /export function JiraWorkItemExperimentalV3Page/u);
	assert.match(pageSource, /export function JiraWorkItemExperimentalV4Page/u);
	assert.match(pageSource, /export function JiraWorkItemExperimentalV5Page/u);
	assert.match(pageSource, /export function JiraWorkItemTeamEu26Page/u);
	assert.match(pageSource, /export function JiraWorkItemTeamEu26EmptyPage/u);
});

// ── Registry / details / demo parity (must stay consistent for test:catalog) ──

test("JiraWorkItem keeps the standard + experimental registry, detail, demo, and preview wiring", () => {
	const detailsSource = readDetailCategorySource("blocks");
	const jiraWorkItemDetailsSource = readProjectFile("app/data/details/blocks/jira-work-item.ts");
	const registrySource = readWebsiteRegistrySource();
	const blockVariantRegistrySource = registrySource.slice(registrySource.indexOf("export const BLOCK_VARIANT_DEMOS"));
	const demoSource = readProjectFile("components/website/demos/blocks/jira-work-item-demo.tsx");
	const primaryBlockRegistrySource = readProjectFile("components/website/registry/blocks.ts");
	const previewLayoutSource = readProjectFile("app/preview/blocks/[slug]/layout.tsx");

	assert.match(jiraWorkItemDetailsSource, /title: "Standard"[\s\S]*demoSlug: "jira-work-item-demo-standard"/u);
	assert.match(jiraWorkItemDetailsSource, /title: "Experimental"[\s\S]*demoSlug: "jira-work-item-demo-experimental"/u);
	assert.match(jiraWorkItemDetailsSource, /title: "Experimental v2"[\s\S]*demoSlug: "jira-work-item-demo-experimental-v2"/u);
	assert.match(jiraWorkItemDetailsSource, /title: "Experimental v3"[\s\S]*demoSlug: "jira-work-item-demo-experimental-v3"/u);
	assert.match(jiraWorkItemDetailsSource, /title: "Experimental v4"[\s\S]*demoSlug: "jira-work-item-demo-experimental-v4"/u);
	assert.match(jiraWorkItemDetailsSource, /title: "Experimental v5"[\s\S]*demoSlug: "jira-work-item-demo-experimental-v5"/u);
	assert.match(jiraWorkItemDetailsSource, /title: "Team EU26"[\s\S]*demoSlug: "jira-work-item-demo-team-eu26"/u);
	assert.equal((jiraWorkItemDetailsSource.match(/demoSlug:/gu) ?? []).length, 7);
	assert.doesNotMatch(jiraWorkItemDetailsSource, /title: "[^"]+ · (?:Filled|Empty|Multiple)/u);
	assert.match(detailsSource, /name: "initialIssueOpen"[\s\S]*Opens the Jira work item modal on initial render/u);
	assert.match(detailsSource, /name: "onIssueClose"[\s\S]*Called after the Jira work item modal closes/u);
	assert.match(detailsSource, /name: "initialExperimentalPreset"[\s\S]*empty[\s\S]*filled[\s\S]*running/u);
	assert.match(registrySource, /"jira-work-item-demo-standard": dynamic[\s\S]*default: mod\.JiraWorkItemDemoStandard/u);
	assert.match(registrySource, /"jira-work-item-demo-experimental": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimental/u);
	assert.match(registrySource, /"jira-work-item-demo-experimental-v2": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV2/u);
	assert.match(registrySource, /"jira-work-item-demo-experimental-v3": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV3/u);
	assert.match(registrySource, /"jira-work-item-demo-experimental-v4": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV4/u);
	assert.match(registrySource, /"jira-work-item-demo-experimental-v5": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV5/u);
	assert.match(registrySource, /"jira-work-item-demo-team-eu26": dynamic[\s\S]*default: mod\.JiraWorkItemDemoTeamEu26/u);
	assert.doesNotMatch(primaryBlockRegistrySource, /"jira-work-item-demo-team-eu26-empty": dynamic/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-standard": dynamic[\s\S]*default: mod\.JiraWorkItemDemoStandard/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimental/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-empty": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalEmpty/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-running": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalRunning/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v2": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV2/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v2-empty": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV2Empty/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v2-running": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV2Running/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v3": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV3/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v4": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV4/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v5": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV5/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-team-eu26": dynamic[\s\S]*default: mod\.JiraWorkItemDemoTeamEu26/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-team-eu26-empty": dynamic[\s\S]*default: mod\.JiraWorkItemDemoTeamEu26Empty/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v3-empty": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV3Empty/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v4-empty": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV4Empty/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v5-empty": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV5Empty/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v3-running": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV3Running/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v4-running": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV4Running/u);
	assert.match(blockVariantRegistrySource, /"jira-work-item-demo-experimental-v5-running": dynamic[\s\S]*default: mod\.JiraWorkItemDemoExperimentalV5Running/u);
	assert.match(demoSource, /export function JiraWorkItemDemoStandard/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimental/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalEmpty/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalRunning/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV2/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV2Empty/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV2Running/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV3/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV4/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV5/u);
	assert.match(demoSource, /export function JiraWorkItemDemoTeamEu26/u);
	assert.match(demoSource, /export function JiraWorkItemDemoTeamEu26Empty/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV3Empty/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV4Empty/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV5Empty/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV3Running/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV4Running/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV5Running/u);
	assert.match(demoSource, /<JiraWorkItem variant="default" \/>/u);
	// The hero demo remains the variant chooser page; version examples group their preset states.
	assert.match(demoSource, /import JiraWorkItemPage from "@\/components\/blocks\/jira-work-item\/page";/u);
	assert.match(demoSource, /return <JiraWorkItemPage \/>;/u);
	assert.match(demoSource, /const PRESET_OPTIONS[\s\S]*label: "With content"[\s\S]*label: "Empty state"[\s\S]*label: "Agents running"/u);
	assert.match(demoSource, /function JiraWorkItemPresetDemo\(/u);
	assert.match(demoSource, /const \[activePreset, setActivePreset\] = useState<JiraWorkItemExperimentalPreset \| null>\(null\);/u);
	assert.match(demoSource, /onClick=\{\(\) => setActivePreset\(option\.value\)\}/u);
	assert.match(demoSource, /key=\{`\$\{variant\}-\$\{activePreset\}`\}/u);
	assert.match(demoSource, /initialIssueOpen[\s\S]*onIssueClose=\{\(\) => setActivePreset\(null\)\}/u);
	assert.doesNotMatch(demoSource, /ButtonGroup|aria-current/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimental\(\) \{[\s\S]*<JiraWorkItemPresetDemo variant="experimental"/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV2\(\) \{[\s\S]*<JiraWorkItemPresetDemo variant="experimental-v2"/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV3\(\) \{[\s\S]*<JiraWorkItemPresetDemo variant="experimental-v3"/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV4\(\) \{[\s\S]*<JiraWorkItemPresetDemo variant="experimental-v4"/u);
	assert.match(demoSource, /export function JiraWorkItemDemoExperimentalV5\(\) \{[\s\S]*<JiraWorkItemPresetDemo variant="experimental-v5"/u);
	assert.match(demoSource, /export function JiraWorkItemDemoTeamEu26\(\) \{[\s\S]*presets=\{TEAM_EU26_PRESETS\}[\s\S]*variant="team-eu26"/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental" initialExperimentalPreset="empty" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental" initialExperimentalPreset="running" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v2" initialExperimentalPreset="empty" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v2" initialExperimentalPreset="running" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="team-eu26" initialExperimentalPreset="empty" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v3" initialExperimentalPreset="empty" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v4" initialExperimentalPreset="empty" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v5" initialExperimentalPreset="empty" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v3" initialExperimentalPreset="running" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v4" initialExperimentalPreset="running" \/>/u);
	assert.match(demoSource, /<JiraWorkItem variant="experimental-v5" initialExperimentalPreset="running" \/>/u);
	assert.match(previewLayoutSource, /"jira-work-item-demo-standard"/u);
	assert.match(previewLayoutSource, /"jira-work-item-demo-experimental"/u);
	assert.match(previewLayoutSource, /"jira-work-item-demo-experimental-v2"/u);
	assert.match(previewLayoutSource, /"jira-work-item-demo-experimental-v3"/u);
	assert.match(previewLayoutSource, /"jira-work-item-demo-experimental-v4"/u);
	assert.match(previewLayoutSource, /"jira-work-item-demo-experimental-v5"/u);
	assert.match(previewLayoutSource, /"jira-work-item-demo-team-eu26"/u);
	assert.doesNotMatch(previewLayoutSource, /"jira-work-item-demo-team-eu26-empty"/u);
});
