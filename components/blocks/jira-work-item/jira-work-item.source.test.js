const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const BLOCK_DIR = __dirname;

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

test("the experimental metadata control is a neutral disclosure with Queue Details motion", () => {
	const actionsSource = readBlockFile("experimental/components/experimental-breadcrumb-actions.tsx");
	const dialogSource = readBlockFile("experimental/components/experimental-work-item-dialog.tsx");
	const modalHeaderSource = readProjectFile("components/blocks/jira-work-item/components/work-item-modal/modal-header.tsx");
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
	assert.match(layoutSource, /duration: 0\.25, ease: motionEase\.out\b/u);
	assert.match(layoutSource, /duration: 0\.2, ease: motionEase\.in\b/u);
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
	assert.match(titleBarSource, /duration: ACTIONS_EXIT_DURATION_MS \/ 1000,[\s\S]*ease: motionEase\.in\b/u);
	assert.match(titleBarSource, /duration: 0\.1,[\s\S]*ease: motionEase\.outPractical/u);
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
	assert.match(plannerPanelSource, /<RovoComposerActionButton/u);
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
	assert.match(composerMotionSource, /duration: 0\.25,[\s\S]*ease: motionEase\.inOut/u);
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

test("work-item skills use varied Skill Directory collection colors", () => {
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

