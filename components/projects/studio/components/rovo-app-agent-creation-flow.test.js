const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SHELL_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-app-shell.tsx"),
	"utf8",
);
const HOME_STARTER_BENTO_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-app-home-starter-bento.tsx"),
	"utf8",
);
const HOME_STARTER_TEMPLATES_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "data", "home-starter-templates.ts"),
	"utf8",
);
const REGION_OVERLAY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/screen-assistant/screen-assistant-region-overlay.tsx"),
	"utf8",
);
const MESSAGES_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-app-messages.tsx"),
	"utf8",
);
const CORE_MESSAGES_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-messages.tsx"),
	"utf8",
);
const EMPTY_STATE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-empty-state.tsx"),
	"utf8",
);
const AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE = fs.readFileSync(
	path.join(__dirname, "studio-automation-artifact-list-widget.tsx"),
	"utf8",
);
const AUTOMATION_ARTIFACT_LIST_LIB_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-automation-artifact-list.ts"),
	"utf8",
);
const STUDIO_LAYOUT_CONSTANTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-layout-constants.ts"),
	"utf8",
);
const STUDIO_TEMPLATE_PROMPTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-template-prompts.ts"),
	"utf8",
);
const STUDIO_AGENT_RESULT_NORMALIZATION_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-agent-result-normalization.ts"),
	"utf8",
);
const AGENT_CONFIG_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-app-agent-config-panel.tsx"),
	"utf8",
);
const AGENT_INSIGHTS_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "..", "blocks", "agent-insights", "components", "agent-insights.tsx"),
	"utf8",
);
const AGENT_TEST_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../blocks/agent-test/components/agent-test.tsx"),
	"utf8",
);
const CUSTOM_AGENTS_TABLE_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-app-custom-agents-table.tsx"),
	"utf8",
);
const CHAT_PANEL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/sidebar-chat/page.tsx"),
	"utf8",
);
const STUDIO_CHAT_HELPERS_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-chat-helpers.ts"),
	"utf8",
);
const STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "lib", "studio-agent-onboarding-guide.ts"),
	"utf8",
);
const STUDIO_DEMO_RESET_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "hooks", "use-studio-demo-reset.ts"),
	"utf8",
);
const STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "hooks", "use-studio-agent-result-registration.ts"),
	"utf8",
);
const MESSAGE_BUBBLE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/sidebar-chat/components/message-bubble.tsx"),
	"utf8",
);
const THREAD_MESSAGE_ROOT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/shared/thread-message/thread-message-root.tsx"),
	"utf8",
);
const CHAT_GREETING_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/sidebar-chat/components/chat-greeting.tsx"),
	"utf8",
);
const ROVO_CONTEXT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/contexts/context-rovo-chat.tsx"),
	"utf8",
);
const SESSION_AGENT_ENTRY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/lib/agent-records/session-agent-entry.ts"),
	"utf8",
);
const ROVO_SUGGESTIONS_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "lib/rovo-suggestions.ts"),
	"utf8",
);
const AGENT_BLOCK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent.tsx"),
	"utf8",
);
const AGENT_COMPACT_HEADER_NAV_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent-compact-header-nav.tsx"),
	"utf8",
);
const AGENT_COMPACT_CONFIG_NAV_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent-compact-config-nav.tsx"),
	"utf8",
);
const AGENT_COMPACT_CONFIG_PANEL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent-compact-config-panel.tsx"),
	"utf8",
);
const AGENT_CONFIG_PROFILE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent-config-profile.tsx"),
	"utf8",
);
const AGENT_FILLED_CONFIG_SUMMARY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent-filled-config-summary.tsx"),
	"utf8",
);
const AGENT_PROFILE_COVER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent-profile-cover.tsx"),
	"utf8",
);
const AGENT_INSTRUCTIONS_COMPOSER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/components/agent-instructions-composer.tsx"),
	"utf8",
);
const AGENT_CONFIG_MODEL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent/lib/agent-config-model.ts"),
	"utf8",
);
const NAV_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/top-navigation/hooks/use-top-navigation.ts"),
	"utf8",
);
const LEFT_NAVIGATION_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/top-navigation/components/left-navigation.tsx"),
	"utf8",
);
const COMPOSER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/shared/components/composer-floating-body.tsx"),
	"utf8",
);
const COMPOSER_BODY_SHARED_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/shared/components/composer-body-shared.ts"),
	"utf8",
);
const COMPOSER_REVEAL_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/shared/hooks/use-rovo-app-composer-reveal.ts"),
	"utf8",
);
const SUBAGENTS_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "hooks", "use-agent-config-subagents.ts"),
	"utf8",
);
const SUBAGENTS_NAVIGATOR_TOP_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "hooks", "use-subagents-navigator-top.ts"),
	"utf8",
);
const SUBAGENT_PROMPTS_LIB_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/subagents/lib/subagent-prompts.ts"),
	"utf8",
);
const ROVO_UI_MESSAGES_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "lib/rovo-ui-messages.ts"),
	"utf8",
);
const REALTIME_VOICE_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-realtime-voice.ts"),
	"utf8",
);
const REALTIME_FUNCTION_CALL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/lib/rovo-realtime-function-call.ts"),
	"utf8",
);
const CLICKY_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-clicky.ts"),
	"utf8",
);
const CLICKY_VOICE_CORE_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-clicky-voice.ts"),
	"utf8",
);
const CLICKY_OVERLAY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/clicky/clicky-overlay.tsx"),
	"utf8",
);
const CLICKY_RESPONSE_OVERLAY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/clicky/clicky-response-overlay.tsx"),
	"utf8",
);
const CLICKY_SPEECH_BUBBLE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/clicky/clicky-speech-bubble.tsx"),
	"utf8",
);
const CLICKY_CURSOR_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/components/clicky/clicky-cursor.tsx"),
	"utf8",
);
const ROVO_CURSOR_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/rovo-cursor.tsx"),
	"utf8",
);
const ROVO_CURSOR_ONBOARDING_TOUR_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-cursor-onboarding-tour.tsx"),
	"utf8",
);
const AGENT_ONBOARDING_TOUR_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "data", "agent-onboarding-tour.ts"),
	"utf8",
);
const AGENT_ONBOARDING_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "hooks", "use-agent-onboarding-tour.ts"),
	"utf8",
);

function sourceBetween(source, startNeedle, endNeedle) {
	const start = source.indexOf(startNeedle);
	const end = source.indexOf(endNeedle, start);

	assert.notEqual(start, -1, `Missing source marker: ${startNeedle}`);
	assert.notEqual(end, -1, `Missing source marker: ${endNeedle}`);
	return source.slice(start, end);
}

test("RovoAppShell starts Studio agent creation only from the default-agent home composer", () => {
	assert.match(SHELL_SOURCE, /const DEFAULT_COMPOSER_PLACEHOLDER = "Describe the agent you want to build";/u);
	// The creation-context builders moved to a testable lib (their prompt copy is
	// asserted in studio-agent-creation-context.test.js). The shell imports them
	// and calls the initial builder with the brief plus any template provenance.
	assert.match(SHELL_SOURCE, /buildStudioAgentCreationContext,/u);
	assert.match(SHELL_SOURCE, /from "@\/components\/projects\/rovo-core\/lib\/agent-records\/agent-creation-context";/u);
	assert.match(SHELL_SOURCE, /buildStudioAgentCreationContext\(text, creationTemplate\)/u);
	assert.match(SHELL_SOURCE, /const isDefaultAgentHomeState = showHomeState && !isCustomAgentSelected && !shouldShowAgentConfigPane;/u);
	assert.match(SHELL_SOURCE, /const shouldStartStudioAgentCreation =[\s\S]*isDefaultAgentHomeStateRef\.current &&[\s\S]*!isRealtimeActive &&[\s\S]*!isAutomationDiscoveryDemoPrompt;/u);
	assert.match(SHELL_SOURCE, /\.\.\.\(shouldStartStudioAgentCreation \? \{ creationMode: "agent" as const \} : \{\}\)/u);
	assert.ok((SHELL_SOURCE.match(/creationMode: "agent"/gu) ?? []).length >= 1);
	assert.match(SHELL_SOURCE, /New-agent prompts fall through to the normal[\s\S]*model-backed creation flow/u);
	assert.doesNotMatch(SHELL_SOURCE, /buildPlan\.createResult/u);
});

test("deterministic trigger edits stage a thinking trace before updating the draft", () => {
	assert.match(SHELL_SOURCE, /buildDeterministicTriggerThinkingParts/u);
	assert.match(SHELL_SOURCE, /DETERMINISTIC_TRIGGER_TRACE_INITIAL_DELAY_MS/u);
	assert.match(SHELL_SOURCE, /DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS/u);
	assert.doesNotMatch(SHELL_SOURCE, /DETERMINISTIC_TRIGGER_TRACE_DELAY_MS/u);
	assert.match(SHELL_SOURCE, /const triggerTraceStates = \["thinking", "review", "schedule", "delivery", "save", "complete"\] as const/u);
	assert.match(SHELL_SOURCE, /const triggerTraceDelays = \[[\s\S]*DETERMINISTIC_TRIGGER_TRACE_INITIAL_DELAY_MS,[\s\S]*\.\.\.DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS,[\s\S]*\] as const/u);
	assert.match(SHELL_SOURCE, /for \(let index = 0; index < triggerTraceDelays\.length; index \+= 1\) \{[\s\S]*await waitForDeterministicTrace\(triggerTraceDelays\[index\]\);[\s\S]*state: stagedTraceState/u);
	assert.match(SHELL_SOURCE, /state: "thinking"[\s\S]*assistantPartStages: \[/u);
	assert.match(SHELL_SOURCE, /state: "schedule"[\s\S]*state: "delivery"[\s\S]*state: "save"[\s\S]*state: "complete"/u);
	assert.match(SHELL_SOURCE, /onApply: applyBuildPlan/u);
	assert.match(SHELL_SOURCE, /getPendingAssistantParts: \(\{ startedAt \}: \{ startedAt: Date \}\) => buildDeterministicTriggerThinkingParts\(\{[\s\S]*state: "thinking"/u);
	assert.match(SHELL_SOURCE, /delayMs: DETERMINISTIC_TRIGGER_TRACE_INITIAL_DELAY_MS[\s\S]*state: "review"/u);
	assert.match(SHELL_SOURCE, /delayMs: DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS\[0\][\s\S]*delayMs: DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS\[3\]/u);
});

test("RovoAppShell seeds the published RFP Drafter into the default Studio landing", () => {
	const rfpSeedSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const hasSeededStudioRfpDemoAgentRef"),
		SHELL_SOURCE.indexOf("const handleStudioAgentResultSelect"),
	);

	assert.match(SHELL_SOURCE, /STUDIO_RFP_DEMO_AGENT_RESULT/u);
	assert.match(SHELL_SOURCE, /STUDIO_RFP_DEMO_AGENT_SOURCE_KEY/u);
	assert.match(SHELL_SOURCE, /readSessionAgentRecords/u);
	assert.match(rfpSeedSource, /hasSeededStudioRfpDemoAgentRef/u);
	assert.match(rfpSeedSource, /new URLSearchParams\(window\.location\.search\)\.has\("agent"\)/u);
	assert.match(rfpSeedSource, /readSessionAgentRecords\(\)\.find\(\s*\(record\) => record\.profileId === STUDIO_RFP_DEMO_AGENT_PROFILE_ID,?\s*\)/u);
	// A persisted/hydrated record whose resultKey predates the current seed version
	// is treated as stale, so returning users get the new lozenge-rich body instead
	// of keeping their old localStorage copy.
	assert.match(rfpSeedSource, /const seedVersionPrefix = `\$\{STUDIO_RFP_DEMO_AGENT_SOURCE_KEY\}:`;/u);
	assert.match(rfpSeedSource, /!persistedResultKey\.startsWith\(seedVersionPrefix\)/u);
	// Up-to-date persisted record not yet hydrated: leave it for rehydration.
	assert.match(rfpSeedSource, /if \(!existingEntry && persistedRecord && !hasStaleSeed\) \{\s*return;/u);
	// A stale hydrated entry is removed before re-registering so no duplicate
	// profileId entry is created.
	assert.match(rfpSeedSource, /if \(hasStaleSeed && existingEntry\) \{\s*studioAgentRegistry\.removeSessionAgent\?\.\(STUDIO_RFP_DEMO_AGENT_PROFILE_ID\);/u);
	assert.match(
		rfpSeedSource,
		/studioAgentRegistry\.registerCreatedAgentFromResult\(STUDIO_RFP_DEMO_AGENT_RESULT,[\s\S]*select: false,[\s\S]*sourceKey: STUDIO_RFP_DEMO_AGENT_SOURCE_KEY/u,
	);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const explicitId = getPayloadString\(payload, \["agentId", "id"\]\);/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const staticReservedProfiles = explicitId[\s\S]*params\.staticAgentProfiles\.filter\(\(profile\) => profile\.id !== baseId\)/u);
	assert.match(rfpSeedSource, /studioAgentRegistry\.commitSessionAgentPublishReady\?\.\(profileId\);/u);
	assert.match(rfpSeedSource, /studioAgentRegistry\.publishSessionAgent\?\.\(profileId\);/u);
	assert.match(SHELL_SOURCE, /const shouldShowStudioAgentsSection = isDefaultAgentHomeState && shouldShowDefaultLandingContent;/u);
	assert.match(SHELL_SOURCE, /<StudioAgentsSection[\s\S]*entries=\{studioAgentRegistry\.sessionAgentEntries\}[\s\S]*onEditAgent=\{handleStudioSidebarAgentSelect\}/u);
	assert.doesNotMatch(rfpSeedSource, /setActiveAgentConfigState|setActiveAgentConfigView/u);
});

test("RovoAppShell settings reset clears Studio state and restores the fresh RFP Drafter", () => {
	const resetSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const resetStudioDemoLocalState"),
		SHELL_SOURCE.indexOf("const studioSettingsMenuItems"),
	);

	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /const STUDIO_RFP_DEMO_RESET_ENDPOINT = "\/api\/agents\/rfp-demo\/reset";/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /async function resetStudioRfpDemoBackendState/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /await resetStudioRfpDemoBackendState\(\);/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /await chat\.deleteAllThreads\(\);/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /await studioAgentRegistry\.deleteAllThreads\(\);/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /onResetLocalState\(\);/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /studioAgentRegistry\.resetAgentToRovo\(\{ preserveCurrentThread: true \}\);/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /const seededEntry = resetSessionAgentsToStudioRfpDemoAgent\(\);/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /writeSessionAgentRecords\(\[toPersistedRecord\(seededEntry\)\]\);/u);
	assert.match(STUDIO_DEMO_RESET_HOOK_SOURCE, /window\.history\.pushState\(null, "", ROVO_APP_ROOT_PATH\);/u);
	assert.match(resetSource, /creationTemplateRef\.current = null;/u);
	assert.match(resetSource, /creationTemplateByThreadRef\.current = \{\};/u);
	assert.match(resetSource, /setActiveAgentConfigState\(null\);/u);
	assert.match(resetSource, /setActiveAgentConfigView\("configure"\);/u);
	assert.match(resetSource, /studioAgentCreationThreadKeysRef\.current\.clear\(\);/u);
	assert.match(resetSource, /setStudioAgentCreationThreadIds\(new Set<string>\(\)\);/u);
	assert.match(SHELL_SOURCE, /const \{ isResettingStudioDemo, resetStudioDemo \} = useStudioDemoReset\(\{[\s\S]*chat,[\s\S]*embedded,[\s\S]*onResetLocalState: resetStudioDemoLocalState,[\s\S]*resetSessionAgentsToStudioRfpDemoAgent,[\s\S]*studioAgentRegistry,/u);
	assert.match(SHELL_SOURCE, /settingsMenuItems=\{studioSettingsMenuItems\}/u);
	assert.match(SHELL_SOURCE, /id: "reset-studio-demo"[\s\S]*label: isResettingStudioDemo \? "Resetting demo\.\.\." : "Reset demo"/u);
	assert.match(SHELL_SOURCE, /for \(const entry of studioAgentRegistry\.sessionAgentEntries\) \{[\s\S]*studioAgentRegistry\.removeSessionAgent\(entry\.profile\.id\);[\s\S]*registerCreatedAgentFromResult\?\.\(STUDIO_RFP_DEMO_AGENT_RESULT/u);
	assert.match(ROVO_CONTEXT_SOURCE, /deleteAllThreads,[\s\S]*hydrateThreadSnapshot,/u);
	assert.doesNotMatch(ROVO_CONTEXT_SOURCE, /adoptThreadMessages/u);
});


test("Studio landing empty state is title-only by default", () => {
	assert.match(MESSAGES_SOURCE, /const STUDIO_EMPTY_STATE = \{/u);
	assert.match(MESSAGES_SOURCE, /default: \{[\s\S]*heading: "Move work forward with agents"[\s\S]*id: "default"[\s\S]*\}/u);
	assert.match(MESSAGES_SOURCE, /emptyStateConfig=\{STUDIO_EMPTY_STATE\}/u);
	const defaultEmptyStateSource = MESSAGES_SOURCE.slice(
		MESSAGES_SOURCE.indexOf("default: {"),
		MESSAGES_SOURCE.indexOf("max: {"),
	);
	assert.doesNotMatch(defaultEmptyStateSource, /illustrationClassName/u);
	assert.doesNotMatch(defaultEmptyStateSource, /lightIllustrationSrc/u);
	assert.doesNotMatch(defaultEmptyStateSource, /darkIllustrationSrc/u);
	assert.match(EMPTY_STATE_SOURCE, /function hasRovoAppEmptyStateIllustration\(emptyState: RovoAppEmptyState\): emptyState is RovoAppIllustratedEmptyState \{[\s\S]*return "illustrationClassName" in emptyState;/u);
	assert.match(EMPTY_STATE_SOURCE, /\{hasRovoAppEmptyStateIllustration\(emptyState\) \? \([\s\S]*<motion\.div className=\{cn\(emptyState\.illustrationClassName, "relative"\)/u);
});

test("Studio default landing prompt growth pushes below the initial home position", () => {
	assert.match(SHELL_SOURCE, /const defaultHomeTopSpacerRef = useRef<HTMLDivElement \| null>\(null\);/u);
	assert.match(SHELL_SOURCE, /const \[defaultHomeTopSpacerMeasurement, setDefaultHomeTopSpacerMeasurement\] = useState<\{ key: string; height: number \} \| null>\(null\);/u);
	assert.match(SHELL_SOURCE, /const defaultHomeTopSpacerMeasurementKey = isDefaultAgentHomeState && landingMotionReady \? `\$\{shellSize\.width\}:\$\{shellSize\.height\}` : null;/u);
	assert.match(SHELL_SOURCE, /const defaultHomeTopSpacerHeight = defaultHomeTopSpacerMeasurement\?\.key === defaultHomeTopSpacerMeasurementKey/u);
	assert.match(SHELL_SOURCE, /useLayoutEffect\(\(\) => \{[\s\S]*!landingMotionReady \|\| !defaultHomeTopSpacerMeasurementKey[\s\S]*spacerElement\.getBoundingClientRect\(\)\.height[\s\S]*setDefaultHomeTopSpacerMeasurement\(\{[\s\S]*key: defaultHomeTopSpacerMeasurementKey,[\s\S]*height: spacerHeight,[\s\S]*\}\);[\s\S]*\}, \[defaultHomeTopSpacerHeight, defaultHomeTopSpacerMeasurementKey, isDefaultAgentHomeState, landingMotionReady/u);
	assert.match(SHELL_SOURCE, /ref=\{isDefaultAgentHomeState \? defaultHomeTopSpacerRef : undefined\}/u);
	assert.match(SHELL_SOURCE, /isDefaultAgentHomeState && defaultHomeTopSpacerHeight !== null \? "shrink-0" : "flex-1 shrink"/u);
	assert.match(SHELL_SOURCE, /style=\{isDefaultAgentHomeState && defaultHomeTopSpacerHeight !== null \? \{ flexBasis: defaultHomeTopSpacerHeight \} : undefined\}/u);
});

test("Studio default landing shows the agents card section below the composer", () => {
	assert.match(SHELL_SOURCE, /import \{ StudioAgentsSection \} from "@\/components\/projects\/studio\/components\/rovo-app-custom-agents-table";/u);
	assert.match(SHELL_SOURCE, /const shouldShowStudioAgentsSection = isDefaultAgentHomeState && shouldShowDefaultLandingContent;/u);
	assert.doesNotMatch(SHELL_SOURCE, /shouldShowStudioCustomAgentsTable|isDefaultAgentHomeState && studioAgentRegistry\.sessionAgentEntries\.length > 0/u);
	assert.match(SHELL_SOURCE, /const handleDeleteStudioAgent = useCallback\([\s\S]*studioAgentRegistry\.removeSessionAgent\(agentId\);[\s\S]*\},[\s\S]*\[activeAgentConfig\?\.profileId, setActiveAgentConfigState, studioAgentRegistry\]/u);
	assert.match(SHELL_SOURCE, /<motion\.div[\s\S]*animate=\{studioLandingMotionVisible\}[\s\S]*<StudioAgentsSection[\s\S]*directoryAgents=\{ROVO_DIRECTORY_AGENT_PROFILES\}[\s\S]*entries=\{studioAgentRegistry\.sessionAgentEntries\}/u);
	assert.match(SHELL_SOURCE, /<StudioAgentsSection[\s\S]*onBrowseTemplates=\{\(\) => handleBrowseAgentTemplates\(\)\}/u);
	assert.match(SHELL_SOURCE, /<StudioAgentsSection[\s\S]*onCreateAgent=\{handleFocusStudioComposer\}/u);
	assert.match(SHELL_SOURCE, /<StudioAgentsSection[\s\S]*onEditAgent=\{handleStudioSidebarAgentSelect\}/u);
	assert.match(SHELL_SOURCE, /<StudioAgentsSection[\s\S]*onSelectDirectoryAgent=\{handleSidebarBrowseAgentSelect\}/u);
	assert.match(SHELL_SOURCE, /<RovoAppSidebar[\s\S]*onDeleteAgent=\{handleDeleteStudioAgent\}/u);
	assert.match(SHELL_SOURCE, /const \[composerFocusRequestKey, setComposerFocusRequestKey\] = useState\(0\);/u);
	assert.match(SHELL_SOURCE, /const handleFocusStudioComposer = useCallback\(\(\) => \{[\s\S]*setComposerFocusRequestKey\(\(currentKey\) => currentKey \+ 1\);[\s\S]*\}, \[\]\);/u);
	assert.match(SHELL_SOURCE, /<RovoAppComposer[\s\S]*focusRequestKey=\{composerFocusRequestKey\}/u);
	assert.match(SHELL_SOURCE, /<RovoAppComposer[\s\S]*fillWidth=\{!showHomeState && !\(isArtifactOpen \|\| shouldShowAgentConfigPane\)\}/u);
	assert.match(SHELL_SOURCE, /<AgentTemplatesDialog[\s\S]*open=\{agentTemplatesDialogOpen\}[\s\S]*onSelectAgent=\{handleTemplateAgentSelect\}/u);

	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /DropdownMenu/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /aria-label=\{`More actions for \$\{agentName\}`\}/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /export function StudioAgentsSection/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /className="mx-auto mt-12 flex w-\[90%\] max-w-\[800px\] flex-col gap-6 pb-12"/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /ButtonGroup aria-label="Agent views"/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /id: "my-agents", label: "My agents"/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /id: "by-teams", label: "By teams"/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /id: "by-companies", label: "By companies"/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /grid grid-cols-1 gap-3 sm:grid-cols-2/u);
	// My agents renders through the shared List primitive; directory tabs (teams/companies) keep the card grid.
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /import \{ List, type ListColumn \} from "@\/components\/ui-custom\/list";/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /<List\.Root aria-label="My agents">/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /<List\.Table columns=\{STUDIO_MY_AGENTS_LIST_COLUMNS\}>/u);
	assert.doesNotMatch(CUSTOM_AGENTS_TABLE_SOURCE, /from "@\/components\/ui\/table"|<Table|TableCell|TableRow|TableBody/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /import \{ Button \} from "@\/components\/ui\/button";/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /import \{ ButtonGroup \} from "@\/components\/ui\/button-group";/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /import \{ Icon \} from "@\/components\/ui\/icon";/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /import \{ Lozenge \} from "@\/components\/ui\/lozenge";/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /import \{ Avatar, AvatarFallback, AvatarImage \} from "@\/components\/ui\/avatar";/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /EntityCardAgentCard/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /DEFAULT_AGENTS_DIRECTORY_SIDEBAR_GROUPS/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /STUDIO_AGENTS_COMPANY_GROUP_TITLE = "By companies"/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /function isTeamDirectoryAgent/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /No agents yet/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /Browse templates/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /<Button onClick=\{onCreateAgent\} type="button">\s*Create\s*<\/Button>/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /entry\.publishedVersion > 0 \|\| entry\.publishedResult \? `V\$\{entry\.publishedVersion \|\| 1\}` : "Draft"/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /formatRelativeModifiedTime\(entry\.lastTouchedAt\)/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /STUDIO_PINNED_AGENTS_STORAGE_KEY/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /onClick=\{\(\) => onEditAgent\(entry\.profile\.id\)\}/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /aria-label=\{`Edit \$\{agentName\}`\}/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /aria-label=\{`\$\{isPinned \? "Unpin" : "Pin"\} \$\{agentName\}`\}/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /onClick=\{\(\) => onTogglePinned\(entry\.profile\.id\)\}/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /aria-pressed=\{isPinned\}[\s\S]*render=\{isPinned \? <PinFilledIcon label="" size="small" \/> : <PinIcon label="" size="small" \/>\}/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /<div className="flex justify-end gap-\[4px\]">/u);
	assert.doesNotMatch(CUSTOM_AGENTS_TABLE_SOURCE, /stopNestedCardAction|onClick=\{stopNestedCardAction\}|onKeyDown=\{stopNestedCardAction\}/u);
	assert.match(CUSTOM_AGENTS_TABLE_SOURCE, /aria-pressed:border-transparent! aria-pressed:bg-transparent! aria-pressed:text-text-subtle! aria-pressed:\[&_svg\]:text-icon-subtle!/u);
	assert.doesNotMatch(CUSTOM_AGENTS_TABLE_SOURCE, /text-icon-selected/u);
	assert.doesNotMatch(CUSTOM_AGENTS_TABLE_SOURCE, /isFirstRow|isLastRow|rounded-tl-\[12px\]|rounded-br-\[12px\]/u);
	assert.match(COMPOSER_BODY_SHARED_SOURCE, /focusRequestKey: number \| undefined;/u);
	assert.match(COMPOSER_SOURCE, /if \(typeof focusRequestKey !== "number" \|\| focusRequestKey <= 0\)/u);
	assert.match(COMPOSER_SOURCE, /textareaRef\.current\?\.focus\(\);/u);
});

test("Studio landing motion gates first paint and removes bento instantly after prompt submit", () => {
	assert.match(SHELL_SOURCE, /import \{ motion, useReducedMotion \} from "motion\/react";/u);
	assert.match(SHELL_SOURCE, /const STUDIO_LANDING_ENTER_TRANSITION = \{[\s\S]*visualDuration: 0\.32,[\s\S]*bounce: 0,[\s\S]*\} as const;/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const STUDIO_HOME_BENTO_INSTANT_EXIT = \{[\s\S]*height: 0,[\s\S]*marginBottom: 0,[\s\S]*opacity: 0,[\s\S]*transition: \{ duration: 0 \},[\s\S]*\} as const;/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const STUDIO_HOME_BENTO_VARIANTS = \{[\s\S]*exit: \(\{ instant, reduceMotion \}: StudioHomeBentoExitContext\) =>[\s\S]*instant \|\| reduceMotion \? STUDIO_HOME_BENTO_INSTANT_EXIT : STUDIO_HOME_BENTO_COLLAPSE_EXIT/u);
	assert.match(SHELL_SOURCE, /const \[landingMotionReady, setLandingMotionReady\] = useState\(false\);/u);
	assert.match(SHELL_SOURCE, /const shouldGateDefaultLandingContent = isDefaultAgentHomeState && !landingMotionReady;/u);
	assert.match(SHELL_SOURCE, /const shouldShowDefaultLandingContent = !shouldGateDefaultLandingContent;/u);
	assert.match(SHELL_SOURCE, /showEmptyState=\{showHomeState && shouldShowDefaultLandingContent\}/u);
	assert.match(SHELL_SOURCE, /if \(landingMotionReady \|\| shellSize\.width <= 0 \|\| shellSize\.height <= 0\) \{[\s\S]*requestAnimationFrame\(\(\) => setLandingMotionReady\(true\)\)/u);
	assert.match(SHELL_SOURCE, /const \[isDefaultHomeSubmitTransition, setIsDefaultHomeSubmitTransition\] = useState\(false\);/u);
	assert.match(SHELL_SOURCE, /if \(isDefaultAgentHomeStateRef\.current\) \{[\s\S]*setIsDefaultHomeSubmitTransition\(true\);[\s\S]*\}[\s\S]*setOptimisticUserMessage/u);
	assert.match(SHELL_SOURCE, /<RovoAppHomeStarterBento[\s\S]*instantExit=\{isDefaultHomeSubmitTransition\}[\s\S]*isVisible=\{shouldShowHomeStarterBento\}[\s\S]*reduceMotion=\{shouldReduceStudioLandingMotion\}/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const homeStarterBentoPresence = \{[\s\S]*instant: instantExit,[\s\S]*reduceMotion,[\s\S]*\};/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /<AnimatePresence custom=\{homeStarterBentoPresence\} initial=\{false\}>[\s\S]*<motion\.div[\s\S]*custom=\{homeStarterBentoPresence\}[\s\S]*exit="exit"[\s\S]*variants=\{STUDIO_HOME_BENTO_VARIANTS\}/u);
});

test("Studio start-from-scratch scribble replays on each composer hover reveal", () => {
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /const \[scratchScribbleReplayKey, setScratchScribbleReplayKey\] = useState\(0\);/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /const \[templateSweepReplayKey, setTemplateSweepReplayKey\] = useState\(0\);/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /setTemplateSweepReplayKey\(\(currentKey\) => currentKey \+ 1\);[\s\S]*scratchScribbleDelayTimeoutRef\.current = setTimeout/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /setIsScratchScribblePlaying\(true\);[\s\S]*setScratchScribbleReplayKey\(\(currentKey\) => currentKey \+ 1\);/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /SCRATCH_SCRIBBLE_DELAY_MS = 480/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /const showScratchScribble = isRevealVisible && isScratchScribblePlaying;/u);
	assert.match(COMPOSER_SOURCE, /SVG_TRACE_SCRATCH_UNDERLINE_PRESET/u);
	assert.match(COMPOSER_SOURCE, /shape=\{SVG_TRACE_SCRATCH_UNDERLINE_PRESET\}[\s\S]*config=\{SCRATCH_SCRIBBLE_CONFIG\}[\s\S]*resetKey=\{scratchScribbleReplayKey\}/u);
	assert.match(COMPOSER_SOURCE, /resetKey=\{scratchScribbleReplayKey\}/u);
	assert.doesNotMatch(COMPOSER_SOURCE, /scribbleConsumed/u);
});

test("Studio template browse reveal uses a single-path svg tracing sweep", () => {
	assert.match(COMPOSER_SOURCE, /SVG_TRACE_TEMPLATES_LOOP_PRESET/u);
	assert.match(COMPOSER_SOURCE, /shape=\{SVG_TRACE_TEMPLATES_LOOP_PRESET\}[\s\S]*config=\{TEMPLATES_SWEEP_CONFIG\}[\s\S]*resetKey=\{templateSweepReplayKey\}/u);
	assert.match(COMPOSER_SOURCE, /className="pointer-events-none absolute top-full left-1\/2 w-11 -translate-x-1\/2 pt-px"/u);
	assert.doesNotMatch(COMPOSER_SOURCE, /fill="#101214"/u);
});

test("Studio composer clears shell-owned prefill sources only after submit succeeds", () => {
	assert.match(
		SHELL_SOURCE,
		/const clearPrefillSources = useCallback\(\(\) => \{\s*setPrefillText\(null\);\s*setVoiceTranscript\(null\);\s*composerTextRef\.current = "";\s*prefillTextRef\.current = null;\s*\}, \[\]\);/u,
	);
	assert.doesNotMatch(
		SHELL_SOURCE,
		/const latestUserMessageIdBeforeSubmit = getLatestUserMessageId\(chat\.messages\);\s*clearPrefillSources\(\);\s*if \(isRealtimeActive\)/u,
	);
	assert.match(
		SHELL_SOURCE,
		/await realtimeChat\.submitRealtimeText\(\{[\s\S]*?\}\);\s*clearPrefillSources\(\);/u,
	);
	assert.match(
		SHELL_SOURCE,
		/await realtimeVoice\.sendTextInput\(\{[\s\S]*?\}\);\s*\} catch \(error\) \{[\s\S]*?\}\s*clearPrefillSources\(\);\s*return;/u,
	);
	assert.match(
		SHELL_SOURCE,
		/clearPrefillSources\(\);\s*return;/u,
	);
	assert.match(
		SHELL_SOURCE,
		/await submitPrompt\(\{[\s\S]*?\}\);\s*clearPrefillSources\(\);/u,
	);
	assert.match(SHELL_SOURCE, /clearPrefillSources,/u);
});

test("Studio composer wires dictation separately from realtime live voice", () => {
	assert.doesNotMatch(SHELL_SOURCE, /useLiveVoice/u);
	assert.match(SHELL_SOURCE, /const dictationCommittedTextRef = useRef<string \| null>\(null\);/u);
	assert.match(SHELL_SOURCE, /appendDictationTranscript\(dictationCommittedTextRef\.current \?\? dictationBaselineRef\.current \?\? "", text\)/u);
	assert.match(SHELL_SOURCE, /appendDictationTranscript\(dictationCommittedTextRef\.current \?\? dictationBaselineRef\.current \?\? "", transcript\)/u);
	assert.match(SHELL_SOURCE, /dictationCommittedTextRef\.current = nextText;/u);
	assert.match(SHELL_SOURCE, /setVoiceTranscript\(nextText\)/u);
	assert.doesNotMatch(SHELL_SOURCE, /setVoiceTranscript\(text\)/u);
	assert.doesNotMatch(SHELL_SOURCE, /setVoiceTranscript\(transcript\)/u);
	assert.doesNotMatch(SHELL_SOURCE, /setVoiceTranscript\(""\)/u);
	assert.doesNotMatch(SHELL_SOURCE, /transcriptToPreserve/u);
	assert.match(SHELL_SOURCE, /resolveComposerDictationState\(\{[\s\S]*active: isDictationActive,[\s\S]*voiceState: realtime\.voiceState,[\s\S]*\}\)/u);
	assert.match(SHELL_SOURCE, /dictationState=\{dictationState\}/u);
	assert.match(SHELL_SOURCE, /dictationTranscriptPreview=\{dictationTranscriptPreview\}/u);
	assert.match(SHELL_SOURCE, /onStartDictation=\{handleStartDictation\}/u);
	assert.match(SHELL_SOURCE, /onStopDictation=\{handleStopDictation\}/u);
	assert.match(SHELL_SOURCE, /const handleStopDictation = useCallback/u);
	assert.match(SHELL_SOURCE, /const handleStopDictation = useCallback\(\(\) => \{[\s\S]*manualVoiceStopRef\.current = true;/u);
	assert.match(SHELL_SOURCE, /onTextChange=\{handleComposerTextChange\}/u);
	assert.match(SHELL_SOURCE, /if \(isDictationActiveRef\.current\) \{[\s\S]*return;[\s\S]*\}[\s\S]*const c = chatRef\.current/u);
	assert.match(SHELL_SOURCE, /realtime\.connect\(\{ transcriptionOnly: true \}\);/u);
});

test("Studio realtime voice streams browser interim dictation until server deltas arrive", () => {
	const browserResultHandler = sourceBetween(
		REALTIME_VOICE_HOOK_SOURCE,
		"recognition.onresult = (event: SpeechRecognitionEvent) => {",
		"recognition.onerror = (event: SpeechRecognitionErrorEvent) => {",
	);

	assert.match(browserResultHandler, /if \(!hasReceivedServerDeltaRef\.current\) \{[\s\S]*onSpeechTranscriptDeltaRef\.current\?\.\(\{ text: trimmed \}\);/u);
	assert.doesNotMatch(browserResultHandler, /!serverTranscriptionActiveRef\.current\s*&&\s*!hasReceivedServerDeltaRef\.current/u);
});

test("Studio cursor activation starts live voice while cursor deactivation leaves live voice running", () => {
	const realtimeToggleSource = sourceBetween(SHELL_SOURCE, "const handleToggleRealtimeVoice", "const handleToggleClicky");
	const clickyToggleSource = sourceBetween(SHELL_SOURCE, "const handleToggleClicky", "// Keyboard shortcuts for Rovo");
	const keyboardShortcutSource = sourceBetween(SHELL_SOURCE, "// Keyboard shortcuts for Rovo", "const handleStartDictation");
	const endVoiceSessionSource = sourceBetween(REALTIME_VOICE_HOOK_SOURCE, 'if (message.name === "end_voice_session")', '} else if (message.name === "delegate_to_rovo")');
	const shellEndVoiceSessionSource = sourceBetween(SHELL_SOURCE, "onEndVoiceSession: useCallback", "onToolCall: useCallback");

	assert.match(SHELL_SOURCE, /activate: activateClicky,/u);
	assert.match(SHELL_SOURCE, /const startRealtimeVoice = useCallback\(\(\) => \{[\s\S]*manualVoiceStopRef\.current = false;[\s\S]*activateClicky\(\);[\s\S]*realtime\.connect\(\);[\s\S]*\}, \[activateClicky, realtime\]\);/u);

	assert.match(clickyToggleSource, /if \(isClickyActive\) \{[\s\S]*deactivateClicky\(\);[\s\S]*return;[\s\S]*\}/u);
	assert.match(clickyToggleSource, /activateClicky\(\);[\s\S]*if \(realtime\.voiceState === "idle"\) \{[\s\S]*startRealtimeVoice\(\);[\s\S]*\}/u);
	assert.doesNotMatch(clickyToggleSource, /realtime\.disconnect\(\)/u);

	assert.match(realtimeToggleSource, /if \(realtime\.voiceState === "idle"\) \{[\s\S]*startRealtimeVoice\(\);[\s\S]*return;[\s\S]*\}/u);
	assert.match(realtimeToggleSource, /realtime\.disconnect\(\);[\s\S]*deactivateClicky\(\);/u);

	assert.match(keyboardShortcutSource, /if \(e\.key === "K" && e\.shiftKey && \(e\.metaKey \|\| e\.ctrlKey\)\) \{[\s\S]*handleToggleClicky\(\);/u);
	assert.match(keyboardShortcutSource, /if \(e\.key === "Escape" && isClickyActive\) \{[\s\S]*deactivateClicky\(\);/u);
	assert.doesNotMatch(SHELL_SOURCE, /toggleClicky/u);
	assert.match(CLICKY_VOICE_CORE_HOOK_SOURCE, /if \(!isRealtimeConnected\) \{[\s\S]*connectRealtime\(\);[\s\S]*\} else \{[\s\S]*connectedForClickyRef\.current = false;/u);
	assert.match(CLICKY_VOICE_CORE_HOOK_SOURCE, /isClickyActive &&[\s\S]*isRealtimeConnected &&[\s\S]*!hasInjectedPromptRef\.current/u);
	assert.doesNotMatch(CLICKY_VOICE_CORE_HOOK_SOURCE, /connectedForClickyRef\.current &&[\s\S]*!hasInjectedPromptRef\.current/u);
	assert.match(REALTIME_VOICE_HOOK_SOURCE, /onEndVoiceSession\?: \(\) => void;/u);
	assert.match(endVoiceSessionSource, /onEndVoiceSessionRef\.current\?\.\(\);[\s\S]*setTimeout\(\(\) => \{[\s\S]*disconnectRef\.current\(\);/u);
	assert.match(shellEndVoiceSessionSource, /manualVoiceStopRef\.current = true;[\s\S]*setVoiceTranscript\(null\);/u);
	assert.doesNotMatch(shellEndVoiceSessionSource, /deactivateClicky\(\)/u);
});

test("Studio home starters frame agent building instead of generic one-off tasks", () => {
	assert.match(HOME_STARTER_TEMPLATES_SOURCE, /export type HomeStarterCategory = "analyze" \| "brainstorm" \| "review" \| "summarize" \| "create";/u);
	assert.match(HOME_STARTER_TEMPLATES_SOURCE, /export const HOME_STARTER_VIEWS: Readonly<Record<HomeStarterCategory, ReadonlyArray<HomeStarterTemplate>>>/u);
	const homeStarterViewsSource = HOME_STARTER_TEMPLATES_SOURCE.slice(
		HOME_STARTER_TEMPLATES_SOURCE.indexOf("export const HOME_STARTER_VIEWS"),
	);
	const starterTitles = [...homeStarterViewsSource.matchAll(/\btitle: "([^"]+)"/gu)].map((match) => match[1]);

	assert.equal(starterTitles.length, 36);
	for (const title of starterTitles) {
		assert.doesNotMatch(title, /agent/iu);
	}

	for (const title of [
		"Product Requirements Guide",
		"Release Notes Drafter",
		"Brand Voice Crafter",
		"Social Media Writer",
		"Global Translator",
		"Meeting Insights",
		"Decision Director",
		"OKR Generator",
		"Work Item Planner",
		"Progress Tracker",
		"Work Item Organizer",
		"Blocker Checker",
		"Bug Report Assistant",
		"Readiness Checker",
		"Rovo Ops",
		"Service Request Helper",
		"Service Triage",
		"Jira Theme Analyzer",
		"Transcript Insights Reporter",
		"Customer Insights",
		"User Manual Writer",
		"Rovo Expert",
	]) {
		assert.ok(starterTitles.includes(title), `${title} should be available as a Studio starter`);
	}

	assert.match(HOME_STARTER_TEMPLATES_SOURCE, /prompt: "Build a Rovo agent named Product Requirements Guide/u);
	assert.match(HOME_STARTER_TEMPLATES_SOURCE, /prompt: "Build a Rovo agent named Rovo Expert/u);
	assert.doesNotMatch(homeStarterViewsSource, /Build a Studio agent/u);
	assert.doesNotMatch(HOME_STARTER_TEMPLATES_SOURCE, /title: "Analyze a workstream"/u);
	assert.doesNotMatch(homeStarterViewsSource, /\btitle: "Build .* agent"/iu);
	assert.doesNotMatch(HOME_STARTER_TEMPLATES_SOURCE, /prompt: "Summarize this into key points/u);
});

test("Studio home bento applies card glow pointer flow to starter tiles", () => {
	assert.match(HOME_STARTER_BENTO_SOURCE, /const HOME_STARTER_CARD_GLOW_EFFECT_STYLE/u);
	// The hover stroke color is the tile's own agent-avatar color, derived from
	// the avatar group in `iconSrc` (each /avatar-agent/<group>/ family shares one
	// brand color) — not an index-cycled palette that drifts out of sync.
	assert.match(HOME_STARTER_BENTO_SOURCE, /const HOME_STARTER_AVATAR_GROUP_ACCENTS: Readonly<Record<string, string>>/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /"teamwork-agents": "#1868DB"/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /function getHomeStarterCardGlowAccent\(iconSrc: string\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /getHomeStarterCardGlowAccent\(template\.iconSrc\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /function HomeStarterCardGlowLayers/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const tileRefs = useRef<Array<HTMLButtonElement \| null>>\(\[\]\);/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /onPointerMove=\{handleBentoPointerMove\}/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /onPointerLeave=\{resetBentoPointer\}/u);
	const pointerMoveStart = HOME_STARTER_BENTO_SOURCE.indexOf("const handleBentoPointerMove");
	const pointerMoveSource = HOME_STARTER_BENTO_SOURCE.slice(
		pointerMoveStart,
		HOME_STARTER_BENTO_SOURCE.indexOf("const resetBentoPointer", pointerMoveStart),
	);
	const pointerReadIndex = pointerMoveSource.indexOf("const rect = tile.getBoundingClientRect();");
	const pointerBatchIndex = pointerMoveSource.indexOf("pointerUpdates.push({");
	const pointerWriteLoopIndex = pointerMoveSource.indexOf("for (const { tile, x, y } of pointerUpdates)");
	const pointerWriteIndex = pointerMoveSource.indexOf("tile.style.setProperty");
	assert.notEqual(pointerMoveStart, -1);
	assert.ok(pointerReadIndex !== -1 && pointerReadIndex < pointerBatchIndex, "pointer tracking should read tile geometry before batching pointer updates");
	assert.ok(pointerBatchIndex !== -1 && pointerBatchIndex < pointerWriteLoopIndex, "pointer tracking should batch every tile update before writing styles");
	assert.ok(pointerWriteLoopIndex !== -1 && pointerWriteLoopIndex < pointerWriteIndex, "pointer tracking should write CSS variables from a separate loop");
	assert.equal(pointerMoveSource.slice(0, pointerWriteLoopIndex).includes("style.setProperty"), false);
	assert.match(HOME_STARTER_BENTO_SOURCE, /x: normalizedX\.toFixed\(3\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /y: normalizedY\.toFixed\(3\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /--card-glow-pointer-x", x/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /--card-glow-pointer-y", y/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /"--card-glow-tile-accent": accentColor/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /"--card-glow-border-core": 36/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /"--card-glow-border-spread": 120/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /<HomeStarterCardGlowLayers iconSrc=\{template\.iconSrc\} \/>/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const HOME_STARTER_CARD_BASE_BORDER_STYLE: CSSProperties/u);
	// Resting stroke uses the subtle `color.border` token (matches the tiles'
	// pre-glow default), not the heavier `color.border.bold`.
	assert.match(HOME_STARTER_BENTO_SOURCE, /boxShadow: `inset 0 0 0 calc\(var\(--card-glow-border-width\) \* 1px\) \$\{token\("color\.border"\)\}`/u);
	assert.doesNotMatch(HOME_STARTER_BENTO_SOURCE, /token\("color\.border\.bold"\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /borderWidth: "calc\(var\(--card-glow-border-width\) \* 1px\)"/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /transparent calc\(var\(--card-glow-border-spread\) \* 1px\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /data-home-starter-card-base-border/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /data-home-starter-card-glow-border/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /absolute inset-0 z-\[1\] rounded-\[inherit\]/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /style=\{HOME_STARTER_CARD_BASE_BORDER_STYLE\}/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /absolute inset-0 z-\[2\] overflow-hidden rounded-\[inherit\] border border-transparent/u);
	// Regression: the glow ring must coexist with the always-on grey base stroke.
	// Two invariants enforce the desired behavior:
	// 1. No backdrop-filter on the ring — an always-on filter recolors the whole
	//    ring (even where the gradient is transparent) and crushes the grey stroke.
	// 2. No per-tile hover/focus opacity gate on the ring — the glow is driven by
	//    the container-level pointer tracking so edges still light up when the
	//    cursor is in the GAPS between tiles, not only over the hovered tile.
	assert.doesNotMatch(HOME_STARTER_BENTO_SOURCE, /backdropFilter/u);
	assert.doesNotMatch(HOME_STARTER_BENTO_SOURCE, /z-\[2\][^"]*group-hover\/home-starter-card:opacity-100/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /onPointerMove=\{handleBentoPointerMove\}/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /rounded-lg bg-background/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /transition-\[background-color,box-shadow\]/u);
	assert.doesNotMatch(HOME_STARTER_BENTO_SOURCE, /hover:border-border-bold/u);
	assert.doesNotMatch(HOME_STARTER_BENTO_SOURCE, /color-mix\(in srgb, var\(--card-glow-tile-accent\) 92%, white\)/u);
	assert.doesNotMatch(HOME_STARTER_BENTO_SOURCE, /rounded-lg border border-border bg-background/u);
});

test("Studio content surfaces keep their intended max widths", () => {
	assert.match(STUDIO_LAYOUT_CONSTANTS_SOURCE, /export const ROVO_APP_STUDIO_COMPOSER_MAX_WIDTH_CLASS = "max-w-\[600px\]";/u);
	assert.match(STUDIO_LAYOUT_CONSTANTS_SOURCE, /export const ROVO_APP_STUDIO_COMPOSER_SESSION_MAX_WIDTH_CLASS = "max-w-\[800px\]";/u);
	assert.match(STUDIO_LAYOUT_CONSTANTS_SOURCE, /export const ROVO_APP_STUDIO_CONTENT_MAX_WIDTH_CLASS = "max-w-\[1280px\]";/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /ROVO_APP_STUDIO_CONTENT_MAX_WIDTH_CLASS/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /className=\{cn\(BENTO_CAROUSEL_CONTAINER_CLASS, ROVO_APP_STUDIO_CONTENT_MAX_WIDTH_CLASS\)\}/u);
	assert.match(CORE_MESSAGES_SOURCE, /compact \? "max-w-none" : "max-w-\[800px\]"/u);
	assert.match(COMPOSER_SOURCE, /FLOATING_COMPOSER_MAX_WIDTH_CLASS = "max-w-\[600px\]"/u);
	assert.match(COMPOSER_SOURCE, /className=\{cn\("relative z-10 mx-auto", fillWidth \? FLOATING_COMPOSER_SESSION_MAX_WIDTH_CLASS : FLOATING_COMPOSER_MAX_WIDTH_CLASS\)\}/u);
});

test("Studio home bento keeps tab auto-cycle active without manual category tabs", () => {
	const homeBentoSource = HOME_STARTER_BENTO_SOURCE.slice(
		HOME_STARTER_BENTO_SOURCE.indexOf("function HomeStarterBento"),
	);

	assert.match(HOME_STARTER_BENTO_SOURCE, /const cycleRunning = !shouldReduceMotion && !templatesDialogOpen;/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /templatesDialogOpen: boolean;/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const bentoInteractingRef = useRef\(false\);/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const updateBentoInteracting = useCallback\(\(interacting: boolean\) => \{[\s\S]*bentoInteractingRef\.current = interacting;[\s\S]*setBentoInteracting\(interacting\);[\s\S]*\}, \[\]\);/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /const nextIndex = \(currentIndex \+ 1\) % HOME_STARTER_CATEGORIES\.length;/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /return HOME_STARTER_CATEGORIES\[nextIndex\]\.id;/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /if \(bentoInteractingRef\.current\) \{[\s\S]*controls\.pause\(\);[\s\S]*\}[\s\S]*cycleControlsRef\.current = controls;/u);
	assert.match(homeBentoSource, /Bridge the visual 8px gap[\s\S]*className="pointer-events-auto absolute left-full top-0 h-7 w-2"[\s\S]*aria-label="Dismiss prompt starters"/u);
	assert.doesNotMatch(homeBentoSource, /className="flex flex-wrap justify-center gap-2"/u);
	assert.doesNotMatch(homeBentoSource, /aria-pressed=\{isActive\}/u);
	assert.doesNotMatch(homeBentoSource, /selectHomeStarterCategory/u);
	assert.doesNotMatch(HOME_STARTER_BENTO_SOURCE, /setCycleEnabled\(false\)/u);
});

test("Studio chat header is hidden until a chat is active", () => {
	assert.match(SHELL_SOURCE, /const shouldShowChatHeader = !shouldShowAgentConfigPane && \(visibleMessages\.length > 0 \|\| hasActiveThreadRun \|\| chat\.isStreaming\);/u);
	assert.match(SHELL_SOURCE, /\{shouldShowChatHeader \? \(\s*<RovoAppHeader/u);
	assert.doesNotMatch(SHELL_SOURCE, /\n\t\t\t\t<RovoAppHeader/u);
});

test("Studio agent results use guarded session-agent registration with preserve-thread selection", () => {
	const resultRegistrationCallSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("useStudioAgentResultRegistration({"),
		SHELL_SOURCE.indexOf("const timelineItems"),
	);

	assert.match(SHELL_SOURCE, /type StudioAgentRegistryContext = ReturnType<typeof useRovoSelectedAgent> & \{/u);
	assert.match(SHELL_SOURCE, /registerCreatedAgentFromResult\?:/u);
	assert.match(SHELL_SOURCE, /registerAgentResult\?:/u);
	assert.match(SHELL_SOURCE, /registerSessionAgent\?:/u);
	assert.match(SHELL_SOURCE, /from "@\/components\/projects\/studio\/lib\/studio-agent-result-normalization";/u);
	assert.match(SHELL_SOURCE, /normalizeStudioAgentResult\(agentResult\)/u);
	assert.match(STUDIO_AGENT_RESULT_NORMALIZATION_SOURCE, /export function normalizeStudioAgentResult/u);
	assert.match(STUDIO_AGENT_RESULT_NORMALIZATION_SOURCE, /export function resolveRegisteredStudioAgentId/u);
	assert.match(SHELL_SOURCE, /studioAgentRegistry\.registerCreatedAgentFromResult\(agentResult, \{[\s\S]*preserveCurrentThread: true,[\s\S]*select: true,[\s\S]*sourceKey,/u);
	assert.match(SHELL_SOURCE, /if \(!didRegisterAgent\) \{[\s\S]*return false;[\s\S]*\}/u);
	assert.match(SHELL_SOURCE, /studioAgentRegistry\.selectAgent\(agentId, \{ preserveCurrentThread: true \}\);/u);
	assert.match(SHELL_SOURCE, /import \{ isGeneratedAgentResult \} from "@\/components\/projects\/sidebar-chat\/components\/agent-result-card";/u);
	assert.match(SHELL_SOURCE, /import \{ useStudioAgentResultRegistration \} from "@\/components\/projects\/studio\/hooks\/use-studio-agent-result-registration";/u);
	assert.match(resultRegistrationCallSource, /activeThreadId: chat\.activeThreadId,[\s\S]*handledAgentResultKeysRef,[\s\S]*markStudioAgentCreationThread,[\s\S]*messages: chat\.messages,[\s\S]*onAgentResultSelect: handleStudioAgentResultSelect,[\s\S]*runtimeThreadId: chat\.runtimeThreadId,[\s\S]*studioAgentCreationThreadKeysRef,[\s\S]*studioAgentRegistry,[\s\S]*unmarkStudioAgentCreationThread,/u);
	assert.doesNotMatch(resultRegistrationCallSource, /for \(const message/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /getMessageAgentResult\(message\)/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /for \(const message of messages\.toReversed\(\)\) \{/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /if \(!isGeneratedAgentResult\(agentResult\) \|\| !hasTurnCompleteSignal\(message\)\) \{[\s\S]*continue;[\s\S]*\}/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /if \(onAgentResultSelect\(agentResult, \{ sourceMessageId: message\.id \}\)\) \{[\s\S]*handledAgentResultKeys\.add\(agentResultKey\);/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /handledAgentResultKeys\.add\(agentResultKey\);[\s\S]*unmarkStudioAgentCreationThread\(runtimeThreadId\);[\s\S]*unmarkStudioAgentCreationThread\(activeThreadId \?\? null\);[\s\S]*return true;/u);
	assert.match(SHELL_SOURCE, /const unmarkStudioAgentCreationThread = useCallback[\s\S]*studioAgentCreationThreadKeysRef\.current\.delete\(threadId\);/u);
	assert.doesNotMatch(SHELL_SOURCE, /!studioAgentCreationThreadKeysRef\.current\.has\(chat\.runtimeThreadId\) &&[\s\S]*return;[\s\S]*for \(const message of chat\.messages/u);
	assert.match(SHELL_SOURCE, /import \{ AgentsDirectoryDialog, type AgentsDirectoryTemplateBuildOptions \} from "@\/components\/blocks\/agent-directory";/u);
	assert.match(SHELL_SOURCE, /sessionAgentEntries=\{studioAgentRegistry\.sessionAgentEntries\}/u);
	assert.match(SHELL_SOURCE, /sessionAgents=\{studioAgentRegistry\.sessionAgentEntries\.map\(\(entry\) => entry\.profile\)\}/u);
	assert.match(SHELL_SOURCE, /agents=\{ROVO_DIRECTORY_AGENT_PROFILES\}/u);
	assert.match(SHELL_SOURCE, /selectedAgentId=\{activeSessionAgentEntry\?\.profile\.id \?\? studioAgentRegistry\.selectedAgentId\}/u);
	assert.match(SHELL_SOURCE, /onSelectAgent=\{handleStudioSidebarAgentSelect\}/u);
	assert.match(SHELL_SOURCE, /onViewAllAgents=\{handleReturnToAgentsHome\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /rovo-app-agent-directory/u);
});

test("Studio automation artifact-list agents persist in the sidebar without auto-selection", () => {
	assert.doesNotMatch(SHELL_SOURCE, /import \{ getAllDataParts, getLatestDataPart/u);
	assert.match(SHELL_SOURCE, /import \{[\s\S]*parseStudioAutomationArtifactListPayload,[\s\S]*STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE,[\s\S]*\} from "@\/components\/projects\/studio\/lib\/studio-automation-artifact-list";/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /import \{ getStudioAutomationArtifactListAgents \} from "@\/components\/projects\/studio\/lib\/studio-automation-artifact-list";/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /export function getStudioAutomationArtifactListAgents\(\s*message: Pick<RovoRenderableUIMessage, "parts">,[\s\S]*\): RovoDataParts\["agent-result"\]\[\] \{/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /const widgetParts = getAllDataParts\(message, "data-widget-data"\);/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /if \(widget\.type !== STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE\) \{[\s\S]*continue;[\s\S]*\}/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /const payload = parseStudioAutomationArtifactListPayload\(widget\.payload\);/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /return payload\.agents\.map\(\(agent\) => agent\.agentResult\);/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /const artifactListAgentResults = getStudioAutomationArtifactListAgents\(message\);/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /source: "artifact-list",/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /const sourceKey = buildStudioAgentResultSourceKey\(\{[\s\S]*activeThreadId,[\s\S]*agentId: agentResult\.agentId,[\s\S]*messageId: message\.id,[\s\S]*runtimeThreadId,[\s\S]*\}\);/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /studioAgentRegistry\.registerCreatedAgentFromResult\(agentResult, \{[\s\S]*preserveCurrentThread: true,[\s\S]*select: false,[\s\S]*sourceKey,[\s\S]*\}\);/u);
	assert.match(STUDIO_AGENT_RESULT_REGISTRATION_HOOK_SOURCE, /if \(didRegisterAgent\) \{[\s\S]*unmarkStudioAgentCreationThread\(runtimeThreadId\);[\s\S]*unmarkStudioAgentCreationThread\(activeThreadId \?\? null\);[\s\S]*return true;[\s\S]*\}/u);
});

test("Studio custom agent config is not treated as the agents landing", () => {
	assert.match(
		SHELL_SOURCE,
		/const isDefaultAgentHomeState = showHomeState && !isCustomAgentSelected && !shouldShowAgentConfigPane;/u,
	);
	assert.match(
		SHELL_SOURCE,
		/selectedAgentId=\{activeSessionAgentEntry\?\.profile\.id \?\? studioAgentRegistry\.selectedAgentId\}/u,
	);
});

test("Studio agent edit surfaces share the session-agent display name", () => {
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /getStudioSessionAgentDisplayName/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const agentName = getStudioSessionAgentDisplayName\(entry\);/u);
	assert.match(SHELL_SOURCE, /getStudioSessionAgentDisplayName/u);
	assert.match(SHELL_SOURCE, /const agentName = getStudioSessionAgentDisplayName\(activeSessionAgentEntry\);/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /draft\.name\?\.trim\(\) \|\| entry\.profile\.name/u);
	assert.doesNotMatch(SHELL_SOURCE, /draftResult\?\.name\?\.trim\(\) \|\| profile\.name/u);
});

test("Studio lands generated agents in the Test tab and opens Ask Rovo", () => {
	// The navigation hook still exposes deterministic chat controls for the
	// separate Ask Rovo surface, and generated-agent testing opens it by default.
	assert.match(NAV_HOOK_SOURCE, /const \{ toggleChat, openChat, chatSurface \} = useRovoChat\(\);/u);
	assert.match(NAV_HOOK_SOURCE, /\n\t\topenChat,\n/u);

	// The agent-result handler selects the Test tab for both registration paths
	// and opens the right-side edit chat without toggling it closed if already open.
	assert.ok(
		(SHELL_SOURCE.match(/setActiveAgentConfigView\("test"\);/gu) ?? []).length >= 2,
		"both registration success paths should land in the Test tab",
	);
	assert.match(SHELL_SOURCE, /const openAgentCreationAskRovoChat = useCallback\(\(\) => \{[\s\S]*studioAgentRegistry\.resetAgentToRovo\(\{ preserveCurrentThread: true \}\);[\s\S]*adoptStudioGenerationTranscript\(\{[\s\S]*chat: chatRef\.current,[\s\S]*registry: studioAgentRegistry,[\s\S]*\}\);[\s\S]*nav\.openChat\("sidebar"\);[\s\S]*\}, \[nav, studioAgentRegistry\]\);/u);
	const agentResultSelectSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const handleStudioAgentResultSelect = useCallback"),
		SHELL_SOURCE.indexOf("// \"Start from scratch\""),
	);
	assert.match(agentResultSelectSource, /setActiveAgentConfigView\("test"\);[\s\S]*openAgentCreationAskRovoChat\(\);[\s\S]*return true;[\s\S]*setActiveAgentConfigView\("test"\);[\s\S]*openAgentCreationAskRovoChat\(\);[\s\S]*return true;/u);
	assert.doesNotMatch(agentResultSelectSource, /nav\.toggleChat/u);
	assert.match(SHELL_SOURCE, /\[chat\.activeThreadId, chat\.runtimeThreadId, openAgentCreationAskRovoChat, setActiveAgentConfigState, studioAgentRegistry\]/u);
	assert.match(SHELL_SOURCE, /const activeAgentConfigRef = useRef\(activeAgentConfig\);/u);
	assert.match(SHELL_SOURCE, /const generatedAgentTestViewKeysRef = useLazyRef<Set<string>>\(\(\) => new Set\(\)\);/u);
	assert.match(SHELL_SOURCE, /const setActiveAgentConfigState = useCallback\(\(nextAgentConfig: typeof activeAgentConfig\) => \{[\s\S]*activeAgentConfigRef\.current = nextAgentConfig;[\s\S]*setActiveAgentConfig\(nextAgentConfig\);[\s\S]*\}, \[\]\);/u);
	assert.match(SHELL_SOURCE, /const handleAgentRestoredFromUrl = useCallback\(\(agentId: string \| null\) => \{[\s\S]*if \(activeAgentConfigRef\.current\?\.profileId !== agentId\) \{[\s\S]*setActiveAgentConfigView\("configure"\);[\s\S]*\}[\s\S]*setActiveAgentConfigState\(agentId \? \{ profileId: agentId, sourceMessageId: null \} : null\);/u);
	assert.match(SHELL_SOURCE, /if \(activeAgentConfig && !activeSessionAgentEntry\) \{[\s\S]*if \(studioAgentRegistry\.getSessionAgentEntry\?\.\(activeAgentConfig\.profileId\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setActiveAgentConfigState\(null\);[\s\S]*setActiveAgentConfigView\("configure"\);/u);
	// The auto-test effect must NOT short-circuit while already in the Test view:
	// it has to keep scanning so it can record the completed result's key. The
	// guard is only the two presence checks.
	assert.match(SHELL_SOURCE, /if \(!activeAgentConfig \|\| !activeSessionAgentEntry\) \{\n\t\t\treturn;\n\t\t\}\n\n\t\tfor \(const message of chat\.messages\.toReversed\(\)\) \{/u);
	assert.doesNotMatch(SHELL_SOURCE, /!activeAgentConfig \|\|[\s\S]{0,80}!activeSessionAgentEntry \|\|[\s\S]{0,80}activeAgentConfigView === "test"/u);
	assert.match(SHELL_SOURCE, /const isActiveGeneratedAgent =[\s\S]*message\.id === activeAgentConfig\.sourceMessageId \|\|[\s\S]*agentResult\.agentId === activeSessionAgentEntry\.sourceResult\.agentId \|\|[\s\S]*agentResult\.agentId === activeSessionAgentEntry\.draftResult\.agentId \|\|[\s\S]*agentResult\.agentId === activeSessionAgentEntry\.publishReadyResult\.agentId;/u);
	// The key is recorded unconditionally (so leaving Test never bounces back),
	// while the actual view-switch + Ask Rovo open is gated on not already being
	// in the Test view.
	assert.match(SHELL_SOURCE, /const agentResultKey = `\$\{chat\.runtimeThreadId\}:\$\{message\.id\}:\$\{agentResult\.agentId\}:\$\{agentResult\.action\}`;[\s\S]*if \(generatedAgentTestViewKeysRef\.current\.has\(agentResultKey\)\) \{[\s\S]*break;[\s\S]*\}[\s\S]*generatedAgentTestViewKeysRef\.current\.add\(agentResultKey\);[\s\S]*if \(activeAgentConfigView !== "test"\) \{[\s\S]*setActiveAgentConfigView\("test"\);[\s\S]*openAgentCreationAskRovoChat\(\);[\s\S]*\}/u);
});

test("Studio agent config floating chat and voice preserve the generation conversation", () => {
	// Opening Ask Rovo from the agent config/test screen must keep the agent's
	// generation transcript visible instead of resetting to the "Improve your
	// agent?" greeting, so both floating entry points pass preserveCurrentThread.
	assert.match(
		AGENT_CONFIG_PANEL_SOURCE,
		/const handleOpenFloatingRovoChat = useCallback\(\(\) => \{[\s\S]*resetAgentToRovo\(\{ preserveCurrentThread: true \}\);[\s\S]*openChat\("floating"\);/u,
	);
	assert.match(
		AGENT_CONFIG_PANEL_SOURCE,
		/const handleStartFloatingRovoVoice = useCallback\(\(\) => \{[\s\S]*resetAgentToRovo\(\{ preserveCurrentThread: true \}\);[\s\S]*openChat\("floating"\);/u,
	);
	// A bare resetAgentToRovo() here would call resetChat() and wipe the
	// conversation, so guard against regressing to it in this panel.
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /resetAgentToRovo\(\);/u);
});

test("Studio bridges the generation transcript into the Ask Rovo sidebar store", () => {
	// Opening the sidebar must bridge the generation chat store into the shared
	// provider through a Studio helper, keeping the provider API generic.
	assert.match(
		SHELL_SOURCE,
		/const openAgentCreationAskRovoChat = useCallback\(\(\) => \{[\s\S]*adoptStudioGenerationTranscript\(\{[\s\S]*chat: chatRef\.current,[\s\S]*registry: studioAgentRegistry,[\s\S]*\}\);[\s\S]*nav\.openChat\("sidebar"\);/u,
	);
	assert.match(
		STUDIO_CHAT_HELPERS_SOURCE,
		/export function adoptStudioGenerationTranscript\([\s\S]*registry\.hydrateThreadSnapshot\(\{[\s\S]*markPersisted: true,[\s\S]*messages: generationMessages,[\s\S]*threadId: generationThreadId,/u,
	);
	// hydrateThreadSnapshot must be generic and pre-seed the persist key when
	// callers adopt an already-owned transcript.
	assert.match(
		ROVO_CONTEXT_SOURCE,
		/const hydrateThreadSnapshot = useCallback\([\s\S]*\{ markPersisted = true, messages, threadId \}: RovoThreadSnapshot[\s\S]*setActiveThreadId\(threadId\);[\s\S]*if \(markPersisted\) \{[\s\S]*lastPersistedThreadKeyRef\.current = buildCompactThreadPersistKey\(threadId, sanitized\);[\s\S]*setMessages\(sanitized\);/u,
	);
	// The adopted transcript can include Studio-only data-widget parts. The
	// generic Ask Rovo sidebar must receive a Studio render hook so the generated
	// agents artifact list survives after clicking into an agent config.
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /export const STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE = "studio-automation-artifact-list";/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_LIB_SOURCE, /export function parseStudioAutomationArtifactListPayload/u);
	assert.match(AUTOMATION_ARTIFACT_LIST_WIDGET_SOURCE, /export function StudioAutomationArtifactListWidget/u);
	assert.match(MESSAGES_SOURCE, /from "@\/components\/projects\/studio\/components\/studio-automation-artifact-list-widget";/u);
	assert.match(CHAT_PANEL_SOURCE, /renderWidget\?: \([\s\S]*widget: \{ type: string; data: unknown \},[\s\S]*message: RovoRenderableUIMessage/u);
	assert.match(MESSAGE_BUBBLE_SOURCE, /const customWidget = renderCustomWidget\?\.\(widget, widgetMessage\);[\s\S]*if \(customWidget !== null && customWidget !== undefined\) \{[\s\S]*return customWidget;/u);
	assert.match(THREAD_MESSAGE_ROOT_SOURCE, /getWidgetPosition\?: \(widgetType: string\) => "before-content" \| "after-content" \| undefined;/u);
	assert.match(SHELL_SOURCE, /const renderStudioAskRovoWidget = useCallback\([\s\S]*widget\.type !== STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE[\s\S]*parseStudioAutomationArtifactListPayload\(widget\.data\)[\s\S]*<StudioAutomationArtifactListWidget[\s\S]*onAgentResultSelect=\{handleStudioAgentResultSelect\}/u);
	assert.match(SHELL_SOURCE, /const getStudioAskRovoWidgetPosition = useCallback\([\s\S]*widgetType === STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE[\s\S]*\? "before-content" as const/u);
	assert.match(SHELL_SOURCE, /<ChatPanel[\s\S]*renderWidget=\{renderStudioAskRovoWidget\}[\s\S]*getWidgetPosition=\{getStudioAskRovoWidgetPosition\}/u);
});

test("RovoAppMessages renders the block agent result card after generation completes", () => {
	assert.match(MESSAGES_SOURCE, /getMessageAgentResult/u);
	assert.match(MESSAGES_SOURCE, /hasTurnCompleteSignal/u);
	assert.match(MESSAGES_SOURCE, /type RovoDataParts/u);
	assert.match(MESSAGES_SOURCE, /import \{ AgentResultCard, isGeneratedAgentResult \} from "@\/components\/projects\/sidebar-chat\/components\/agent-result-card";/u);
	assert.match(MESSAGES_SOURCE, /function getCompletedGeneratedAgentResult\(message: RovoUIMessage\): RovoDataParts\["agent-result"\] \| null/u);
	assert.match(MESSAGES_SOURCE, /const agentResult = getMessageAgentResult\(message\);/u);
	assert.match(MESSAGES_SOURCE, /return isGeneratedAgentResult\(agentResult\) && hasTurnCompleteSignal\(message\)[\s\S]*\? agentResult[\s\S]*: null;/u);
	assert.match(MESSAGES_SOURCE, /renderAfterAssistantMessage=\{\(\{ message \}\) => \{[\s\S]*const completedAgentResult = getCompletedGeneratedAgentResult\(message\);[\s\S]*<AgentResultCard[\s\S]*agent=\{completedAgentResult\}[\s\S]*sourceMessageId: message\.id/u);
	assert.match(MESSAGES_SOURCE, /shouldSuppressArtifactCard=\{\(\{ message \}\) => getCompletedGeneratedAgentResult\(message\) !== null\}/u);
	assert.match(CORE_MESSAGES_SOURCE, /const resolvedArtifactDisplayForMessage =[\s\S]*shouldSuppressArtifactCard\?\.\(\{ message \}\) \? null : renderModel\.artifactDisplay;/u);
	assert.match(CORE_MESSAGES_SOURCE, /resolvedArtifactDisplayForMessage \? \([\s\S]*<ArtifactCard/u);
	assert.match(CORE_MESSAGES_SOURCE, /renderAfterAssistantMessage\?: \(context: RovoAppMessageRenderContext\) => ReactNode;/u);
	assert.doesNotMatch(MESSAGES_SOURCE, /function StudioAgentResultCard/u);
	assert.match(ROVO_UI_MESSAGES_SOURCE, /import type \{ AgentAutomationRule \} from "@\/components\/blocks\/triggers\/data\/trigger-catalog";/u);
	assert.match(ROVO_UI_MESSAGES_SOURCE, /triggers\?: string\[\];/u);
	assert.match(ROVO_UI_MESSAGES_SOURCE, /automationRules\?: AgentAutomationRule\[\];/u);
});

test("Studio agent insights panel frames agent performance and improvement opportunities", () => {
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Review your agent&apos;s performance and gather insights\./u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Understand adoption, answer quality, failure patterns, and the next improvements/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Total conversations/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Active users/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Successful answer rate/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Escalation rate/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Feedback score/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Adoption trend/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Answer quality/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Conversation outcomes/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Top topics/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Feedback mix/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Recommended improvements/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Improve billing answers/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /Next review focus/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /<ChartContainer/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /AGENT_INSIGHTS_TREND_DATA/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /AGENT_INSIGHTS_TOPIC_DATA/u);
	assert.match(AGENT_INSIGHTS_PANEL_SOURCE, /AGENT_INSIGHTS_RECOMMENDATIONS/u);
	assert.doesNotMatch(AGENT_INSIGHTS_PANEL_SOURCE, /bg-\[var\(--ds-/u);
	assert.doesNotMatch(AGENT_INSIGHTS_PANEL_SOURCE, /text-\[var\(--ds-/u);
});

test("Studio agent config moves Details into compact nav and removes the config toggle group", () => {
	assert.match(AGENT_BLOCK_SOURCE, /from "@\/components\/blocks\/agent\/components\/agent-compact-header-nav";/u);
	assert.match(AGENT_COMPACT_HEADER_NAV_SOURCE, /import \{ LayoutDashboardIcon, MoreHorizontalIcon \} from "@\/components\/ui\/vpk-icons";/u);
	assert.match(AGENT_COMPACT_HEADER_NAV_SOURCE, /AGENT_COMPACT_HEADER_NAV_ITEMS = \[[\s\S]*<LayoutDashboardIcon size="small" \/>[\s\S]*label: "Details"[\s\S]*label: "Insights"/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const lastCompactSectionRef = useRef<AgentCompactHeaderSection>\("details"\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const activeHeaderSection: AgentCompactHeaderSection \| null =[\s\S]*activeView === "insights"[\s\S]*activeView === "configure"[\s\S]*activeCompactSection \?\? "details"[\s\S]*: null;/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const restoreCompactSection = useCallback\([\s\S]*if \(section === "details"\) \{[\s\S]*setActiveCompactSection\(null\);[\s\S]*return;[\s\S]*\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleCompactSectionChange = useCallback\([\s\S]*lastCompactSectionRef\.current = section;[\s\S]*restoreCompactSection\(section\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleTestPressedChange = useCallback\([\s\S]*if \(pressed\) \{[\s\S]*lastCompactSectionRef\.current = activeHeaderSection;[\s\S]*handleTest\(\);[\s\S]*return;[\s\S]*\}[\s\S]*restoreCompactSection\(lastCompactSectionRef\.current \?\? "details"\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<AgentCompactHeaderNav[\s\S]*activeSection=\{activeHeaderSection\}[\s\S]*onSectionChange=\{handleCompactSectionChange\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<Toggle[\s\S]*aria-label="Toggle agent test view"[\s\S]*className="rounded-\[6px\] text-text-subtle hover:border-border data-pressed:hover:border-border-selected"[\s\S]*data-testid="agent-config-test"[\s\S]*onPressedChange=\{handleTestPressedChange\}[\s\S]*pressed=\{activeView === "test"\}[\s\S]*Test[\s\S]*<\/Toggle>/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /aria-label="Agent config views"|<ToggleGroup|<ToggleGroupItem|data-testid="agent-config-configure"|>Configure<\/ToggleGroupItem>/u);
});

test("Studio agent config panel renders the shared block agent config fields", () => {
	assert.match(AGENT_BLOCK_SOURCE, /export const AgentConfigFields = memo/u);
	assert.match(AGENT_BLOCK_SOURCE, /import \{ AGENT_AVATAR_SRC \} from "@\/components\/blocks\/agent\/components\/agent-profile-cover";/u);
	assert.match(AGENT_CONFIG_PROFILE_SOURCE, /import \{ AgentProfileCover \} from "@\/components\/blocks\/agent\/components\/agent-profile-cover";/u);
	assert.match(AGENT_PROFILE_COVER_SOURCE, /const AGENT_AVATAR_PROFILE_COVER_COLORS: Record<string, string>/u);
	assert.match(AGENT_PROFILE_COVER_SOURCE, /"product-agents": "#BF63F3"/u);
	assert.match(AGENT_PROFILE_COVER_SOURCE, /function getAgentProfileCoverBackgroundColor\(avatarSrc: string \| undefined\): string/u);
	assert.match(AGENT_PROFILE_COVER_SOURCE, /style=\{\{[\s\S]*backgroundColor: coverBackgroundColor,[\s\S]*backgroundImage: `url\("\$\{bannerSrc\}"\)`,[\s\S]*\}\}/u);
	assert.match(AGENT_COMPACT_CONFIG_NAV_SOURCE, /Add flows for when this agent runs/u);
	assert.match(AGENT_COMPACT_CONFIG_NAV_SOURCE, /Add prompts to help people start/u);
	assert.match(AGENT_COMPACT_CONFIG_NAV_SOURCE, /knowledgeMode: KnowledgeModeValue;/u);
	assert.match(AGENT_COMPACT_CONFIG_PANEL_SOURCE, /onKnowledgeModeChange=\{setKnowledgeMode\}/u);
	assert.match(AGENT_INSTRUCTIONS_COMPOSER_SOURCE, /Press \/ to help me create the agent/u);
	// The data-flow diagram tab is hidden for now: the agent config no longer
	// passes dataFlowConfig, so the Rich Text editor's showDataFlowMode stays false.
	assert.doesNotMatch(AGENT_BLOCK_SOURCE, /dataFlowConfig=\{config\}/u);
	assert.doesNotMatch(AGENT_BLOCK_SOURCE, /layout\?: "default" \| "compact";/u);
	assert.match(AGENT_CONFIG_MODEL_SOURCE, /automationRules\?: readonly AgentAutomationRule\[\];/u);
	assert.match(AGENT_BLOCK_SOURCE, /onAutomationRulesChange\?: \(automationRules: readonly AgentAutomationRule\[\]\) => void;/u);
	assert.match(AGENT_CONFIG_PROFILE_SOURCE, /readViewClassName="relative h-auto overflow-visible border-2 bg-transparent px-0 py-1 text-2xl leading-7 font-semibold hover:bg-transparent active:bg-transparent focus:border-border-focused focus-visible:border-border-focused focus-visible:bg-transparent"/u);
	assert.match(AGENT_CONFIG_PROFILE_SOURCE, /inputProps=\{\{ className: "h-auto border-2 px-1\.5 py-1 text-2xl leading-7 font-semibold focus:border-ring md:text-2xl" \}\}/u);
	assert.match(AGENT_CONFIG_PROFILE_SOURCE, /textareaProps=\{\{ rows: 1, className: "min-h-10 border-2 bg-bg-neutral-subtle px-1\.5 focus:border-ring focus-visible:border-ring focus-visible:ring-0 focus-visible:ring-offset-0 data-\[variant=default\]:border-transparent data-\[variant=default\]:focus:border-ring data-\[variant=default\]:focus-visible:border-ring" \}\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /AgentConfigFields/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /AgentSurfaces/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /type AgentCompactHeaderSection/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /config=\{activeConfig\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onTextChange=\{handleConfigTextChange\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onAddListValues=\{appendListValues\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onAppendListItem=\{appendListItem\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onConnectTrigger=\{handleConnectTrigger\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onAutomationRulesChange=\{handleAutomationRulesChange\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onOpenDirectory=\{handleOpenDirectory\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ KnowledgeDirectoryDialog, type KnowledgeDirectoryAddPayload \} from "@\/components\/blocks\/knowledge-directory";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ Memory \} from "@\/components\/blocks\/memory";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ DEFAULT_KNOWLEDGE_APPS \} from "@\/app\/data\/directory\/knowledge";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ SkillsDirectoryDialog, type SkillsDirectorySkill \} from "@\/components\/blocks\/skills-directory";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ DEFAULT_SKILLS \} from "@\/app\/data\/directory\/skills";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ getAgentConfigListLookupValue, getSkillConfigLabel \} from "@\/components\/blocks\/agent\/lib\/agent-config-model";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ ToolsDirectoryDialog \} from "@\/components\/blocks\/tools-directory";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ DEMO_SESSION_TOOLS, DEMO_TOOLS \} from "@\/app\/data\/directory\/tools";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ AgentInsights \} from "@\/components\/blocks\/agent-insights";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const \[activeDirectory, setActiveDirectory\] = useState<AgentDirectoryKind \| null>\(null\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const \[activeCompactSection, setActiveCompactSection\] = useState<AgentCompactHeaderSection \| null>\(null\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleAutomationRulesChange = useCallback\([\s\S]*automationRules: readonly AgentAutomationRule\[\][\s\S]*automationRules,[\s\S]*\},[\s\S]*\[updateActiveConfig\]/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleConnectTrigger = useCallback\([\s\S]*const automationRules = \(config\.automationRules \?\? \[\]\)\.map\(\(rule\) => \(\{[\s\S]*triggers: rule\.triggers\.map\(\(trigger\) =>[\s\S]*connectionState: "connecting" as const/u);
	// The connect flow resolves (fake): provider-level, session-scoped, connecting -> connected.
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleConnectTrigger = useCallback\([\s\S]*trigger\.providerId === providerId[\s\S]*setTimeout\([\s\S]*markSessionProviderConnected\(providerId\)[\s\S]*connectionState: "connected" as const/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /setConnectingProvider\(\{ providerId, trigger: targetTrigger \}\)/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /Authorizing \{getTriggerProvider\(connectingProvider\.providerId\)\?\.label/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleOpenDirectory = useCallback\(\(directory: AgentDirectoryKind, selectedItem\?: string\) => \{[\s\S]*setDirectorySelectedToolId\(matchedTool\?\.id \?\? null\);[\s\S]*setActiveDirectory\(directory\);[\s\S]*\}, \[\]\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleAddKnowledge = useCallback\([\s\S]*payload: KnowledgeDirectoryAddPayload[\s\S]*DEFAULT_KNOWLEDGE_APPS\.find[\s\S]*appendListValues\("knowledge"/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleDirectoryToolIdsChange = useCallback\([\s\S]*const toolsById = new Map\(\[\.\.\.DEMO_TOOLS, \.\.\.DEMO_SESSION_TOOLS\][\s\S]*appendListValues\(\s*"tools"/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /slugifySkillName/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /function getSkillConfigLabel\(value: string\): string/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const existing = new Set\(current\.map\(\(value\) => getAgentConfigListLookupValue\(field, value\)\)\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const additions = nextValues\.filter\(\(value\) => !existing\.has\(getAgentConfigListLookupValue\(field, value\)\)\);/u);
	assert.match(AGENT_CONFIG_MODEL_SOURCE, /import \{ slugifySkillName \} from "@\/app\/data\/directory\/skills";/u);
	assert.match(AGENT_CONFIG_MODEL_SOURCE, /export function getSkillConfigLabel\(value: string\): string \{[\s\S]*return slugifySkillName\(value\);/u);
	assert.match(AGENT_CONFIG_MODEL_SOURCE, /export function getAgentConfigListLookupValue\(field: AgentConfigListFieldName, value: string\): string \{[\s\S]*return field === "skills" \? getSkillConfigLabel\(value\) : getNormalizedAgentReferenceValue\(value\);/u);
	assert.match(AGENT_CONFIG_MODEL_SOURCE, /export function getSkillConfigItems\(items: readonly string\[\] \| undefined\): readonly string\[\] \{[\s\S]*\.map\(getSkillConfigLabel\)/u);
	assert.match(AGENT_COMPACT_CONFIG_NAV_SOURCE, /getSkillConfigItems,[\s\S]*getSkillConfigLabel,/u);
	assert.match(AGENT_FILLED_CONFIG_SUMMARY_SOURCE, /const skillItems = getSkillConfigItems\(config\.skills\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<KnowledgeDirectoryDialog[\s\S]*open=\{activeDirectory === "knowledge"\}[\s\S]*onAddKnowledge=\{handleAddKnowledge\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<ToolsDirectoryDialog[\s\S]*addedToolIds=\{addedToolIds\}[\s\S]*open=\{activeDirectory === "tools"\}[\s\S]*onAddedToolIdsChange=\{handleDirectoryToolIdsChange\}[\s\S]*sessionTools=\{DEMO_SESSION_TOOLS\}[\s\S]*tools=\{DEMO_TOOLS\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<SkillsDirectoryDialog[\s\S]*onAddSkills=\{handleAddSkills\}[\s\S]*setDirectorySkillIds\(\[\]\);[\s\S]*selectionExperience="studio-bulk-add"[\s\S]*open=\{activeDirectory === "skills"\}[\s\S]*selectedSkillIds=\{directorySkillIds\}[\s\S]*skills=\{DEFAULT_SKILLS\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<Memory[\s\S]*open=\{activeDirectory === "memory"\}[\s\S]*showTrigger=\{false\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /AgentCompactHeaderNav,/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /import \{ Lozenge \} from "@\/components\/ui\/lozenge";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ Tabs, TabsContent \} from "@\/components\/ui\/tabs";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ Toggle \} from "@\/components\/ui\/toggle";/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /import \{ ToggleGroup, ToggleGroupItem \} from "@\/components\/ui\/toggle-group";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ Badge \} from "@\/components\/ui\/badge";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /export type AgentConfigView = "configure" \| "insights" \| "test";/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /function getPublishLabel/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const restoreCompactSection = useCallback\([\s\S]*if \(section === "insights"\) \{[\s\S]*setActiveCompactSection\(null\);[\s\S]*onViewChange\("insights"\);[\s\S]*return;[\s\S]*\}[\s\S]*onViewChange\("configure"\);[\s\S]*if \(section === "details"\) \{[\s\S]*setActiveCompactSection\(null\);[\s\S]*return;[\s\S]*\}[\s\S]*setActiveCompactSection\(\s*section === "surfaces" \|\|[\s\S]*section === "access" \|\|[\s\S]*section === "users" \|\|[\s\S]*section === "evaluation"[\s\S]*\? section[\s\S]*: null,/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /if \(value === "test"\) \{[\s\S]*lastCompactSectionRef\.current = activeHeaderSection;[\s\S]*handleTest\(\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const compactHeaderNavItems = useMemo\([\s\S]*hasPublishedVersion[\s\S]*\? \[AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM, \.\.\.AGENT_COMPACT_HEADER_DEFAULT_NAV_ITEMS\][\s\S]*: \[AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM\]/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<AgentCompactHeaderNav[\s\S]*activeSection=\{activeHeaderSection\}[\s\S]*avatarSrc=\{agentAvatarSrc\}[\s\S]*items=\{compactHeaderNavItems\}[\s\S]*onSectionChange=\{handleCompactSectionChange\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /activeCompactSection === "surfaces" \? \([\s\S]*<AgentSurfaces className="-mr-4 pr-4" \/>[\s\S]*\) : \([\s\S]*<AgentConfigFields/u);
	// Clicking the "Evaluation" compact-nav tab renders the full-bleed Evaluation screen.
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ AgentEvaluation \} from "@\/components\/blocks\/agent-evaluation";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /activeCompactSection === "evaluation" \? \([\s\S]*<AgentEvaluation \/>[\s\S]*\) : \(/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /function AgentConfigActionButton/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /function AgentConfigToggleItem/u);
	// The Test action is a single controlled Toggle; Details owns the configure
	// view through AgentCompactHeaderNav instead of a Configure/Test segmented control.
	assert.ok(!AGENT_CONFIG_PANEL_SOURCE.includes('TooltipTrigger render={<span className="inline-flex" />}'));
	// The Update button is removed from the studio header; only Test and Publish
	// remain in the action area.
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /disabledTooltip="Make a change to the agent before updating the testing version\."/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /data-testid="agent-config-update"/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /hasAgentInstructions/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<Tabs[\s\S]*onValueChange=\{handleViewChange\}[\s\S]*value=\{activeView\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<Toggle[\s\S]*className="rounded-\[6px\] text-text-subtle hover:border-border data-pressed:hover:border-border-selected"[\s\S]*data-testid="agent-config-test"[\s\S]*onPressedChange=\{handleTestPressedChange\}[\s\S]*pressed=\{activeView === "test"\}[\s\S]*variant="outline"[\s\S]*Test[\s\S]*<\/Toggle>/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /aria-label="Agent config views"|<ToggleGroup|<ToggleGroupItem|data-testid="agent-config-configure"|>Configure<\/ToggleGroupItem>/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /disabled=\{!hasAgentInstructions\}/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /aria-label="Agent config views"[\s\S]{0,160}size="sm"/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /<TabsList>|<TabsTrigger/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<TabsContent[\s\S]*value="configure"[\s\S]*<AgentConfigFields/u);
	// The config scroll region fills the full panel width (wheel works anywhere),
	// with the 800px reading-width cap centered on each scroll child instead of
	// the wrapper.
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /compactScrollAreaClassName="-ml-1\.5 -mr-4 pr-4[^"]*\[&>\*\]:mx-auto \[&>\*\]:w-full \[&>\*\]:max-w-\[800px\]/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<TabsContent value="test"[\s\S]*\{testPanel\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<TabsContent value="insights"[\s\S]*<AgentInsights \/>/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /Generation looks partial/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /variant="outline"[\s\S]*onClick=\{handleTest\}[\s\S]*disabled=\{!hasAgentInstructions\}/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /disabledTooltip="Add agent instructions before testing this agent\."/u);
	assert.match(SHELL_SOURCE, /const \[activeAgentConfigView, setActiveAgentConfigView\] = useState<AgentConfigView>\("configure"\);/u);
	assert.match(SHELL_SOURCE, /const handleTestAgent = useCallback/u);
	const handleTestAgentSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const handleTestAgent = useCallback"),
		SHELL_SOURCE.indexOf("const handleAgentConfigViewChange = useCallback"),
	);
	assert.doesNotMatch(handleTestAgentSource, /draftResult\.instructions|return;/u);
	assert.match(handleTestAgentSource, /studioAgentRegistry\.commitSessionAgentPublishReady\?\.\(profileId\);[\s\S]*setActiveAgentConfigView\("test"\);/u);
	assert.doesNotMatch(handleTestAgentSource, /nav\.openChat\("sidebar"\)|nav\.toggleChat/u);
	const handleAgentConfigViewChangeSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const handleAgentConfigViewChange = useCallback"),
		SHELL_SOURCE.indexOf("const handlePublishAgent = useCallback"),
	);
	assert.match(handleAgentConfigViewChangeSource, /setActiveAgentConfigView\(view\);/u);
	assert.doesNotMatch(handleAgentConfigViewChangeSource, /nav\.openChat|nav\.toggleChat/u);
	assert.match(SHELL_SOURCE, /const AgentTestPanel = dynamic\([\s\S]*import\("@\/components\/blocks\/agent-test"\)[\s\S]*\{ ssr: true \}/u);
	assert.doesNotMatch(SHELL_SOURCE, /import \{ AgentTestPanel \} from "@\/components\/blocks\/agent-test";/u);
	assert.match(SHELL_SOURCE, /const RovoAppAgentConfigPanel = dynamic\([\s\S]*import\("@\/components\/projects\/studio\/components\/rovo-app-agent-config-panel"\)[\s\S]*\{ ssr: true \}/u);
	assert.doesNotMatch(SHELL_SOURCE, /import \{ RovoAppAgentConfigPanel,/u);
	assert.match(SHELL_SOURCE, /const agentConfigTestPanel = activeSessionAgentEntry \? \([\s\S]*<AgentTestPanel entry=\{activeSessionAgentEntry\} \/>/u);
	assert.match(SHELL_SOURCE, /testPanel=\{agentConfigTestPanel\}/u);
	assert.match(SHELL_SOURCE, /onTest=\{handleTestAgent\}/u);
	assert.match(SHELL_SOURCE, /<RovoAppAgentConfigPanel[\s\S]*testPanel=\{agentConfigTestPanel\}[\s\S]*chatContextBar=\{agentEditContextBar\}[\s\S]*chatGreeting=\{agentEditGreeting\}[\s\S]*onChatInterceptSubmit=\{handleAgentEditInterceptSubmit\}[\s\S]*onUpdateDraft=\{handleUpdateAgentDraft\}[\s\S]*\/>/u);
	// "Browse all" (and the "start with a template" link) open the Agent Directory
	// on the first template tab (AGENT_TEMPLATES_CATEGORIES[0].id) via the config
	// panel, regardless of the bento's auto-cycling category.
	assert.match(SHELL_SOURCE, /import \{ AGENT_TEMPLATES_CATEGORIES,[\s\S]*\} from "@\/components\/blocks\/agent-templates";/u);
	assert.match(SHELL_SOURCE, /const handleBrowseAgentsDirectory = useCallback\(\(\) => \{[\s\S]*setSidebarAgentBrowserInitialCategory\(AGENT_TEMPLATES_CATEGORIES\[0\]\.id\);[\s\S]*\}, \[\]\);/u);
	assert.match(SHELL_SOURCE, /const handleStartAgentWithTemplate = handleBrowseAgentsDirectory;/u);
	assert.match(SHELL_SOURCE, /<RovoAppAgentConfigPanel[\s\S]*onStartWithTemplate=\{handleStartAgentWithTemplate\}[\s\S]*\/>/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onStartWithTemplate=\{onStartWithTemplate\}/u);
	assert.match(SHELL_SOURCE, /isChatOpen=\{nav\.isSidebarChatOpen\}[\s\S]*onToggleChat=\{handleToggleAskRovoChat\}/u);
	assert.match(SHELL_SOURCE, /const isStudioAskRovoChatActive = !embedded && shouldShowAgentConfigPane && nav\.isSidebarChatOpen;/u);
	// "Ask Rovo" must open the default Rovo agent, not the custom agent being
	// edited: opening the chat resets the selected agent back to Rovo.
	const handleToggleAskRovoChatSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const handleToggleAskRovoChat = useCallback"),
		SHELL_SOURCE.indexOf("// When the active agent disappears"),
	);
	assert.match(handleToggleAskRovoChatSource, /if \(!nav\.isSidebarChatOpen\) \{[\s\S]*studioAgentRegistry\.resetAgentToRovo\(\{ preserveCurrentThread: true \}\);[\s\S]*\}[\s\S]*nav\.toggleChat\(\);/u);
	const agentEditContextBarSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const agentEditContextBar = useMemo"),
		SHELL_SOURCE.indexOf("// When the \"Edit agent\" context bar is active"),
	);
	assert.match(agentEditContextBarSource, /if \(!activeSessionAgentEntry\) \{[\s\S]*return null;[\s\S]*\}/u);
	assert.doesNotMatch(agentEditContextBarSource, /isCustomAgentSelected/u);
	assert.match(SHELL_SOURCE, /<ChatPanel[\s\S]*onClose=\{nav\.toggleChat\}[\s\S]*abortOnUnmount=\{false\}[\s\S]*chatContextBar=\{agentEditContextBar\}[\s\S]*greeting=\{agentEditGreeting\}[\s\S]*containerStyle=\{\{ borderRadius: 0, borderWidth: 0 \}\}[\s\S]*\/>/u);
	// The Ask Rovo edit panel always chats with the default Rovo agent (it's a
	// build/improve helper), so it must render as a plain default-Rovo chat:
	// no custom-agent Chat / Trigger / Activity tab header and no Test-mode-only
	// controls. Those tabs belong to the left-hand Test panel instead.
	const askRovoChatPanelSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("<ChatPanel\n"),
		SHELL_SOURCE.indexOf("<SidebarResizeHandle"),
	);
	assert.doesNotMatch(askRovoChatPanelSource, /customAgentTabs/u);
	assert.doesNotMatch(askRovoChatPanelSource, /showAgentTestControls/u);
	// The Ask Rovo tab memo is gone entirely now that the helper is plain chat.
	assert.doesNotMatch(SHELL_SOURCE, /askRovoCustomAgentTabs/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /restoreSessionAgentVersion,[\s\S]*sessionAgentSaveStatus,[\s\S]*sessionAgentSavedAt,[\s\S]*\} = useRovoChat\(\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const \[floatingLiveChatRequestKey, setFloatingLiveChatRequestKey\] = useState\(0\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleOpenFloatingRovoChat = useCallback\(\(\) => \{[\s\S]*resetAgentToRovo\(\{ preserveCurrentThread: true \}\);[\s\S]*openChat\("floating"\);[\s\S]*\}, \[openChat, resetAgentToRovo\]\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleStartFloatingRovoVoice = useCallback\(\(\) => \{[\s\S]*resetAgentToRovo\(\{ preserveCurrentThread: true \}\);[\s\S]*setFloatingLiveChatRequestKey\(\(currentKey\) => currentKey \+ 1\);[\s\S]*openChat\("floating"\);[\s\S]*\}, \[openChat, resetAgentToRovo\]\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /useEffect\(\(\) => \{[\s\S]*if \(chatSurface !== "floating"\) \{[\s\S]*setFloatingLiveChatRequestKey\(0\);[\s\S]*\}[\s\S]*\}, \[chatSurface\]\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<FloatingRovoButton[\s\S]*ariaLabel="Open Rovo chat"[\s\S]*product="home"[\s\S]*onButtonClick=\{handleOpenFloatingRovoChat\}[\s\S]*persistentBar=\{rovoButtonPersistentBar\}[\s\S]*\/>/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /agent-config-rovo-bar-cursor/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /Point and select/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /id: "agent-config-rovo-bar-voice"/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /tooltipLabel: "Live chat"/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /chatGreeting\?: ChatPanelGreetingProps;/u);
	assert.match(SHELL_SOURCE, /<RovoAppAgentConfigPanel[\s\S]*chatSendPromptOptions=\{agentEditSendPromptOptions\}[\s\S]*onChatInterceptSubmit=\{handleAgentEditInterceptSubmit\}[\s\S]*\/>/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /chatSendPromptOptions\?: SendPromptOptions;/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<RovoFloatingChat[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*greeting=\{chatGreeting\}[\s\S]*hideComposerSourceAndModelControls=\{Boolean\(chatContextBar\)\}[\s\S]*sendPromptOptions=\{chatSendPromptOptions\}[\s\S]*onInterceptSubmit=\{onChatInterceptSubmit\}[\s\S]*startRealtimeVoiceRequestKey=\{floatingLiveChatRequestKey\}[\s\S]*\/>/u);
	assert.match(SHELL_SOURCE, /<SidebarResizeHandle[\s\S]*side="left"[\s\S]*askRovoChatResize\.onResizeHandlePointerDown/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /export function AgentTestPanel/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /aria-label="Agent test"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /data-testid="agent-test-panel"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /className=\{cn\("h-full min-h-0 px-4", className\)\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /function getAgentTestVersionOptions\(entry: StudioSessionAgentEntry\)/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /id: "latest"[\s\S]*result: entry\.draftResult/u);
	// Draft is always neutral gray and there is no separate "published" summary
	// option (it duplicated the version-history entry for the same publish).
	assert.match(AGENT_TEST_PANEL_SOURCE, /id: "latest",\s*\n\s*label: "Draft",\s*\n\s*variant: "neutral",/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /id: "published"/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /Published \$\{publishedVersionLabel\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /id: `history:\$\{version\.id\}`[\s\S]*result: version\.snapshot/u);
	// Version options are labelled just "V{n}" (no "- Agent published" suffix)
	// and the live published version is flagged current.
	assert.match(AGENT_TEST_PANEL_SOURCE, /label: `V\$\{version\.version\}`/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /label: `V\$\{version\.version\} - \$\{version\.label\}`/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /isCurrent: version\.version === entry\.publishedVersion/u);
	assert.match(CHAT_PANEL_SOURCE, /export interface ChatPanelAgentVersionOption/u);
	assert.match(CHAT_PANEL_SOURCE, /agentVersionOptions\?: readonly ChatPanelAgentVersionOption\[\];/u);
	assert.match(CHAT_PANEL_SOURCE, /selectedAgentVersionId\?: string;/u);
	assert.match(CHAT_PANEL_SOURCE, /onAgentVersionChange\?: \(versionId: string\) => void;/u);
	assert.match(CHAT_PANEL_SOURCE, /aria-label="Switch version"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /<AgentTestHeader[\s\S]*onSelectVersion=\{setSelectedVersionId\}[\s\S]*selectedVersionId=\{selectedVersionId\}[\s\S]*versionOptions=\{versionOptions\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /<AgentTestVersionSelect[\s\S]*onSelectVersion=\{onSelectVersion\}[\s\S]*selectedVersionId=\{selectedVersionId\}[\s\S]*versionOptions=\{versionOptions\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /buildAgentTestProfile\(entry, selectedResult, selectedOption\.label\)/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /<AgentTestChatPanel[\s\S]*automationRules=\{automationRules\}[\s\S]*testAgentProfile=\{testAgentProfile\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /containerClassName="h-full min-h-0 w-full overflow-visible"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /composerContainerClassName="px-0 \[&_\.chat-composer-surface\]:max-w-\[600px\]"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /conversationContentClassName="px-0 max-w-\[600px\]"/u);
	assert.doesNotMatch(AGENT_TEST_PANEL_SOURCE, /containerClassName="mx-auto h-full min-h-0 w-full max-w-\[800px\] overflow-visible"/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /containerStyle=\{\{ borderRadius: 0, borderWidth: 0, overflow: "visible" \}\}/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /greetingSelectedAgent=\{testAgentProfile\}/u);
	assert.match(CHAT_PANEL_SOURCE, /greetingSelectedAgent\?: RovoAgentProfile \| null;/u);
	assert.match(CHAT_PANEL_SOURCE, /selectedAgent=\{greetingSelectedAgent \?\? selectedAgent\}/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /<Label htmlFor=\{`agent-\$\{profileId\}-name`\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /conversationStarterIcons: Array\.isArray\(config\.conversationStarterIcons\)[\s\S]*config\.conversationStarterIcons\.filter\(\(_, itemIndex\) => itemIndex !== index\)/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /saveLabel=\{conversationStarterDialogValue\.length > 0 \? "Save" : "Add"\}/u);
});

test("Studio skills directory add keeps the Browse Skills dialog open", () => {
	const handleAddSkillsSource = AGENT_CONFIG_PANEL_SOURCE.match(/const handleAddSkills = useCallback\([\s\S]*?\n\t\);/u)?.[0] ?? "";
	assert.match(handleAddSkillsSource, /skills: readonly SkillsDirectorySkill\[\]/u);
	assert.match(handleAddSkillsSource, /appendListValues\("skills", skills\.map\(\(skill\) => getSkillConfigLabel\(skill\.name\)\)\);/u);
	assert.match(handleAddSkillsSource, /setDirectorySkillIds\(\[\]\);/u);
	assert.doesNotMatch(handleAddSkillsSource, /setActiveDirectory\(null\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<SkillsDirectoryDialog[\s\S]*onAddSkills=\{handleAddSkills\}[\s\S]*selectionExperience="studio-bulk-add"[\s\S]*open=\{activeDirectory === "skills"\}/u);
});

test("Studio publish dropdown separates draft changes from version history", () => {
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /type PublishDropdownView = "summary" \| "draftChanges" \| "history" \| "versionDetail";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /function getDraftChangeCountLabel\(changeSummary: StudioAgentChangeSummary\): string/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /function getDraftChangePreviewLabel\(changeSummary: StudioAgentChangeSummary, publishedVersionLabel: string\): string/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /setView\("draftChanges"\)/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<div className="min-w-0 flex-1 truncate text-sm font-semibold text-text">Unpublished changes<\/div>/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<AgentPublishChangeList changeSummary=\{changeSummary\} \/>/u);

	const historyViewSource = AGENT_CONFIG_PANEL_SOURCE.slice(
		AGENT_CONFIG_PANEL_SOURCE.indexOf('{view === "history" ? ('),
		AGENT_CONFIG_PANEL_SOURCE.indexOf('{view === "versionDetail"'),
	);
	assert.match(historyViewSource, /Version history/u);
	assert.match(historyViewSource, /publishedVersions\.map/u);
	assert.doesNotMatch(historyViewSource, /entry\.versionHistory\.map/u);
	assert.doesNotMatch(historyViewSource, /<span>\{publishedVersionLabel\}<\/span>/u);
	// Version label renders as the same success Badge used in the Test dropdown.
	assert.match(historyViewSource, /<Badge variant="success">\{`V\$\{version\.version\}`\}<\/Badge>/u);
	assert.match(historyViewSource, /\{version\.label\} · \{formatRelativeTime\(version\.createdAt\)\}/u);
	assert.doesNotMatch(historyViewSource, /Latest/u);
	assert.doesNotMatch(historyViewSource, /Same as/u);
	assert.doesNotMatch(historyViewSource, /No unpublished changes since/u);
	assert.doesNotMatch(historyViewSource, /getDraftChangeCountLabel|getDraftChangePreviewLabel/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const publishedVersions = entry\.versionHistory\.filter\(\(version\) => version\.kind === "publish" \|\| version\.kind === "update"\);/u);
});

test("Studio publish profile link targets Studio agent deep links", () => {
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const STUDIO_AGENT_PROFILE_BASE_PATH = "\/studio";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /return `\$\{STUDIO_AGENT_PROFILE_BASE_PATH\}\?agent=\$\{encodeURIComponent\(profileId\)\}`;/u);
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /const STUDIO_AGENT_PROFILE_BASE_PATH = "\/agents";/u);
});

test("Studio agent config panel persists base avatar edits through the draft", () => {
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleBaseAvatarChange = useCallback\([\s\S]*avatarSrc: string[\s\S]*updateDraft\(\{ avatarSrc \}\);[\s\S]*\[updateDraft\]/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<AgentConfigFields[\s\S]*avatarSrc=\{agentAvatarSrc\}[\s\S]*profileAvatarSrc=\{agentAvatarSrc\}[\s\S]*onProfileAvatarChange=\{handleBaseAvatarChange\}/u);
});

test("Studio agent config panel wires the subagents experience into AgentConfigFields", () => {
	// Panel consumes the subagents hook and routes edits through the active config
	// (base agent or selected subagent) rather than the raw draft.
	assert.match(
		AGENT_CONFIG_PANEL_SOURCE,
		/import \{ useAgentConfigSubagents \} from "@\/components\/projects\/studio\/hooks\/use-agent-config-subagents";/u,
	);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /useAgentConfigSubagents\(\{ draft, updateDraft \}\)/u);
	// Subagent switcher + per-subagent editing props are passed to the shared
	// AgentConfigFields (in-panel nav button for managing the subagents list).
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /profileConfig=\{baseConfig\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onProfileTextChange=\{handleBaseTextChange\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onManageSubagents=\{\(\) => setIsManageSubagentsOpen\(true\)\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onSelectListItem=\{handleSelectListItem\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /selectedListItemIndexByField=\{\{ subagents: selectedSubagentIndex \}\}/u);
	// The subagent name + trigger condition are edited in the profile header now
	// (the old lower SubagentPromptFields rows were removed to avoid duplication).
	assert.doesNotMatch(AGENT_CONFIG_PANEL_SOURCE, /SubagentPromptFields/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /subagentName=\{activePrompt\?\.triggerName\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onSubagentNameChange=\{handleTriggerNameChange\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /subagentCondition=\{activePrompt\?\.condition\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onSubagentConditionChange=\{handleConditionChange\}/u);
	// The floating SubagentsNavigator is also rendered so users can quickly swap
	// between the base agent and its subagents (self-hides when there are none).
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /import \{ SubagentsNavigator \} from "@\/components\/blocks\/subagents\/subagents-navigator";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const \[instructionsViewMode, setInstructionsViewMode\] = useState<EditorToolbarViewMode>\("rendered"\);/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const shouldShowSubagentsNavigator =[\s\S]*activeView === "configure" &&[\s\S]*activeCompactSection === null &&[\s\S]*instructionsViewMode !== "data-flow";/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /\{shouldShowSubagentsNavigator \? \([\s\S]*<SubagentsNavigator/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /<SubagentsNavigator[\s\S]*activeSubagentId=\{activeSubagentId\}[\s\S]*baseAgent=\{navigatorBaseAgent\}[\s\S]*onSelectBaseAgent=\{selectBaseAgent\}[\s\S]*onSelectSubagent=\{selectSubagent\}[\s\S]*subagents=\{subagentPrompts\}/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /onInstructionsViewModeChange=\{setInstructionsViewMode\}/u);
	assert.match(SUBAGENTS_NAVIGATOR_TOP_HOOK_SOURCE, /\[data-rich-text-markdown-source\]/u);
	// Base name/description always edit the base agent, even while a subagent is selected.
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /const handleBaseTextChange = useCallback\([\s\S]*updateDraft\(\{ description: value, summary: value \}\)/u);
});

test("Subagents hook persists prompts on the draft and derives the subagents chip list", () => {
	// Prompts live on the draft (persisted), not in throwaway local state.
	assert.match(SUBAGENTS_HOOK_SOURCE, /draft\.subagentPrompts \?\? \[\]/u);
	assert.match(SUBAGENTS_HOOK_SOURCE, /subagentPrompts: nextPrompts as unknown as RovoAgentSubagentPrompt\[\]/u);
	// The base `subagents` chip list is always derived from prompt trigger names.
	assert.match(SUBAGENTS_HOOK_SOURCE, /subagents: getDerivedSubagentNames\(nextPrompts\)/u);
	assert.match(SUBAGENTS_HOOK_SOURCE, /getBaseConfigWithSubagents\(draft as unknown as AgentConfigFormValue, subagentPrompts\)/u);
	// Removing the active subagent resets the selection back to the base agent.
	assert.match(SUBAGENTS_HOOK_SOURCE, /if \(promptToRemove\.id === activeSubagentId\)\s*\{\s*startTransition\(\(\) => setActiveSubagentId\(null\)\);/u);
	// Removal uses the same derived-index -> prompt-id mapping as selection, so
	// duplicate trigger names do not delete the wrong prompt.
	assert.match(SUBAGENTS_HOOK_SOURCE, /const promptToRemove = derivedSubagentPrompts\[index\];[\s\S]*subagentPrompts\.filter\(\(prompt\) => prompt\.id !== promptToRemove\.id\)/u);
	assert.doesNotMatch(SUBAGENTS_HOOK_SOURCE, /const triggerName = getDerivedSubagentNames\(subagentPrompts\)\[index\]/u);
	// Reuses the shared helpers extracted from the demo block.
	assert.match(
		SUBAGENTS_HOOK_SOURCE,
		/from "@\/components\/blocks\/subagents\/lib\/subagent-prompts"/u,
	);
	// Shared draft shape declares the persisted prompts.
	assert.match(ROVO_UI_MESSAGES_SOURCE, /export interface RovoAgentSubagentPrompt/u);
	assert.match(ROVO_UI_MESSAGES_SOURCE, /subagentPrompts\?: RovoAgentSubagentPrompt\[\]/u);
	// Extracted helper creates an empty, draft prompt copy.
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /export function createDraftSubagentPrompt/u);
	assert.match(SUBAGENT_PROMPTS_LIB_SOURCE, /export function getDerivedSubagentNames/u);
});

test("Studio agent test conversation starters use contextual visual identity tiles", () => {
	assert.match(ROVO_SUGGESTIONS_SOURCE, /export function resolveConversationStarterVisualIdentity/u);
	assert.match(ROVO_SUGGESTIONS_SOURCE, /resolveGenerativeCardIdentity\(\{[\s\S]*contentType: hint\.contentType[\s\S]*iconHint: hint\.iconHint[\s\S]*title: input\.label[\s\S]*\}\)/u);
	assert.match(ROVO_SUGGESTIONS_SOURCE, /automation-ready\|markdown\|yaml\|sql/u);
	assert.match(ROVO_SUGGESTIONS_SOURCE, /jira\|jsm\|request\|ticket\|issue\|incident\|priority\|sla\|routing\|triage/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /from "@\/components\/blocks\/conversation-starters";/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /resolveConversationStarterVisualIdentity/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /const starterIcons = getPayloadStringArray\(payload, \["conversationStarterIcons", "starterIcons", "suggestionIcons"\]\);/u);
	assert.match(AGENT_TEST_PANEL_SOURCE, /icon: getStarterIcon\(\(iconKey as StarterIconKey \| undefined\) \?\? DEFAULT_STARTER_ICON\)/u);
	assert.match(STUDIO_AGENT_RESULT_NORMALIZATION_SOURCE, /from "@\/components\/blocks\/conversation-starters";/u);
	assert.match(STUDIO_AGENT_RESULT_NORMALIZATION_SOURCE, /const conversationStarterIcons = Array\.isArray\(agentResult\.conversationStarterIcons\)[\s\S]*agentResult\.conversationStarterIcons/u);
	assert.match(STUDIO_AGENT_RESULT_NORMALIZATION_SOURCE, /icon: getStarterIcon\(\(conversationStarterIcons\[index\] as StarterIconKey \| undefined\) \?\? DEFAULT_STARTER_ICON\)/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /resolveConversationStarterVisualIdentity/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /from "@\/components\/blocks\/conversation-starters";/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /function getAgentResultStarterIconKeys\(payload: AgentResultPayload\): string\[\] \{[\s\S]*"conversationStarterIcons", "starterIcons", "suggestionIcons"/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /starterIcons: getAgentResultStarterIconKeys\(payload\)/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /icon: getStarterIcon\(\(iconKey as StarterIconKey \| undefined\) \?\? DEFAULT_STARTER_ICON\)/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /visualIdentity: resolveConversationStarterVisualIdentity\(\{[\s\S]*agentName: context\.agentName[\s\S]*label,[\s\S]*\}\)/u);
});

test("Chat greeting custom-agent starters prefer explicit icons and fall back to AI chat", () => {
	// Managed conversation starters pass explicit icon components from the
	// config panel. Older/iconless starters keep the neutral "ai-chat" fallback.
	assert.match(CHAT_GREETING_SOURCE, /icon=\{suggestion\.icon\}/u);
	assert.match(CHAT_GREETING_SOURCE, /iconColor=\{token\("color\.icon\.subtle"\)\}/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /resolveConversationStarterVisualIdentity/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CardIdentityTile/u);
	assert.match(
		CHAT_GREETING_SOURCE,
		/<IconTile[\s\S]*className="border border-border bg-surface"[\s\S]*icon=\{<AiChatIcon color=\{token\("color\.icon\.subtle"\)\} label=\{suggestion\.label\} \/>\}[\s\S]*size="medium"/u,
	);
});

test("Studio screen assistant applies draft patches without publishing agents", () => {
	assert.match(SHELL_SOURCE, /onToolCall: useCallback/u);
	assert.match(SHELL_SOURCE, /handleScreenAssistantToolCall\(\{ args, callId, name \}, respond\);/u);
	assert.match(REALTIME_FUNCTION_CALL_SOURCE, /"activate_screen_target"/u);
	assert.match(SHELL_SOURCE, /prepareStudioAgentDraftPatch\(\{[\s\S]*currentDraft: activeSessionAgentEntry\.draftResult,[\s\S]*rawPatch: args\.patch,/u);
	assert.match(SHELL_SOURCE, /ScreenAssistantRegionOverlay/u);
	assert.match(SHELL_SOURCE, /activeRegion: screenAssistantRegion/u);
	assert.match(SHELL_SOURCE, /const \[screenAssistantRegionPainting, setScreenAssistantRegionPainting\] = useState\(false\);/u);
	assert.match(SHELL_SOURCE, /<ClickyOverlay[\s\S]*paintingActive=\{screenAssistantRegionPainting\}/u);
	assert.match(SHELL_SOURCE, /<ScreenAssistantRegionOverlay[\s\S]*onPaintingChange=\{setScreenAssistantRegionPainting\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /onStartScreenAssistantRegionPaint|screenAssistantRegionActive|isScreenAssistantRegionPaintMode/u);
	assert.doesNotMatch(SHELL_SOURCE, /onPaintModeChange|paintMode=/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /paintingActive\?: boolean;/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /paintingActive=\{paintingActive\}/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /responseText\?: string \| null;/u);
	assert.doesNotMatch(CLICKY_OVERLAY_SOURCE, /history\?: ReadonlyArray<ClickyExchange>;/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /const showResponseOverlay = Boolean\(responseText\) && isActive;/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /<ClickyResponseOverlay[\s\S]*text=\{responseText\}/u);
	assert.match(SHELL_SOURCE, /responseText=\{clicky\.responseText\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /history=\{clicky\.history\}/u);
	assert.match(CLICKY_CURSOR_SOURCE, /paintingActive \? "painting" : toRovoCursorState\(state\)/u);
	assert.match(ROVO_CURSOR_SOURCE, /export type RovoCursorState = "cursor" \| "painting"/u);
	assert.match(ROVO_CURSOR_SOURCE, /<AnimatePresence initial=\{false\} mode="popLayout">/u);
	assert.match(ROVO_CURSOR_SOURCE, /data-rovo-cursor-mode-transition/u);
	assert.match(ROVO_CURSOR_SOURCE, /state === "painting" \? \([\s\S]*<PaintingCursor/u);
	assert.match(ROVO_CURSOR_SOURCE, /data-rovo-cursor-rainbow-fill/u);
	assert.doesNotMatch(ROVO_CURSOR_SOURCE, /data-rovo-cursor-rainbow-halo/u);
	assert.match(REGION_OVERLAY_SOURCE, /function getShortcutKeyStateFromEvent\(event: KeyboardEvent\): ShortcutKeyState/u);
	assert.match(REGION_OVERLAY_SOURCE, /function isShortcutChordPressed\(state: ShortcutKeyState\): boolean/u);
	assert.match(REGION_OVERLAY_SOURCE, /function shouldToggleShortcutPaint\([\s\S]*shortcutState: ShortcutKeyState,[\s\S]*shortcutArmed: boolean/u);
	assert.match(REGION_OVERLAY_SOURCE, /onPaintingChange\?: \(painting: boolean\) => void;/u);
	assert.match(REGION_OVERLAY_SOURCE, /onPaintingChange\?\.\(true\);/u);
	assert.match(REGION_OVERLAY_SOURCE, /onPaintingChange\?\.\(false\);/u);
	assert.match(REGION_OVERLAY_SOURCE, /const pressedShortcutKeysRef = useRef<ShortcutKeyState>\(\{ ctrl: false, shift: false \}\);/u);
	assert.match(REGION_OVERLAY_SOURCE, /const shortcutArmedRef = useRef\(false\);/u);
	assert.match(REGION_OVERLAY_SOURCE, /isShortcutChordPressed\(shortcutState\) &&[\s\S]*!event\.altKey &&[\s\S]*!event\.metaKey &&[\s\S]*!shortcutArmed &&[\s\S]*!event\.defaultPrevented/u);
	assert.match(REGION_OVERLAY_SOURCE, /pressedShortcutKeysRef\.current = getShortcutKeyStateFromEvent\(event\);[\s\S]*shouldToggleShortcutPaint\(event, pressedShortcutKeysRef\.current, shortcutArmedRef\.current\)/u);
	assert.match(REGION_OVERLAY_SOURCE, /shortcutArmedRef\.current = true;[\s\S]*if \(paintingRef\.current\) \{[\s\S]*finishPaint\(\);[\s\S]*\} else \{[\s\S]*beginPaint\(\);/u);
	assert.match(REGION_OVERLAY_SOURCE, /const handleKeyUp = \(event: KeyboardEvent\) => \{[\s\S]*if \(!isShortcutChordPressed\(pressedShortcutKeysRef\.current\)\) \{[\s\S]*shortcutArmedRef\.current = false;/u);
	assert.match(REGION_OVERLAY_SOURCE, /window\.addEventListener\("keyup", handleKeyUp, \{ capture: true \}\);/u);
	assert.match(REGION_OVERLAY_SOURCE, /const handlePointerMove = \(event: PointerEvent\) => \{[\s\S]*latestPointerRef\.current = point;[\s\S]*if \(!paintingRef\.current\) \{/u);
	assert.match(REGION_OVERLAY_SOURCE, /if \(!paintingRef\.current && !region\) \{/u);
	assert.doesNotMatch(REGION_OVERLAY_SOURCE, /shouldStartShortcutPaint|beginPaint\(event\)|event\.button === 0|isRegionPaintArmedRef|regionPaintArmed|setRegionPaintArmedState/u);
	assert.doesNotMatch(REGION_OVERLAY_SOURCE, /data-screen-assistant-region-paint-cue|Paint region|Paint off|REGION_PAINT_CUE/u);
	assert.doesNotMatch(REGION_OVERLAY_SOURCE, /aria-label=\{`Paint screen area|data-screen-assistant-region-paint-target|paintMode/u);
	assert.match(REGION_OVERLAY_SOURCE, /import \{ token \} from "@\/lib\/tokens";/u);
	assert.match(REGION_OVERLAY_SOURCE, /const TIPTOUR_BRUSH_COLOR = token\("color\.border\.accent\.blue"\);/u);
	assert.doesNotMatch(REGION_OVERLAY_SOURCE, /#4F8EF7/u);
	assert.match(REGION_OVERLAY_SOURCE, /const TIPTOUR_BRUSH_POINT_LIMIT = 220;/u);
	assert.match(REGION_OVERLAY_SOURCE, /const TIPTOUR_BRUSH_BAND_COUNT = 28;/u);
	assert.match(REGION_OVERLAY_SOURCE, /const TIPTOUR_BRUSH_FADE_EXPONENT = 1\.8;/u);
	assert.match(REGION_OVERLAY_SOURCE, /\{ key: "halo", lineWidth: 54, maxStrokeOpacity: 0\.11, postBlurRadius: 30 \}/u);
	assert.match(REGION_OVERLAY_SOURCE, /\{ key: "bloom", lineWidth: 32, maxStrokeOpacity: 0\.26, postBlurRadius: 12 \}/u);
	assert.match(REGION_OVERLAY_SOURCE, /\{ key: "core", lineWidth: 18, maxStrokeOpacity: 0\.72, postBlurRadius: 0 \}/u);
	assert.match(REGION_OVERLAY_SOURCE, /function buildContinuousSmoothTrailPath/u);
	assert.match(REGION_OVERLAY_SOURCE, /strokeLinecap="butt"/u);
	assert.match(REGION_OVERLAY_SOURCE, /pathLength=\{1\}/u);
	assert.doesNotMatch(REGION_OVERLAY_SOURCE, /fillPathData|rgb\(87 157 255|strokeLinecap="round"[\s\S]*strokeWidth=\{4\}/u);
	assert.match(SHELL_SOURCE, /studioAgentRegistry\.updateSessionAgentDraft/u);
	assert.match(LEFT_NAVIGATION_SOURCE, /data-screen-assistant-target=\{`top-navigation:\$\{product\}-logo`\}/u);
	const pointAtTargetIndex = SHELL_SOURCE.indexOf('case "point_at_target":');
	assert.notEqual(pointAtTargetIndex, -1);
	const pointAtTargetSource = SHELL_SOURCE.slice(
		pointAtTargetIndex,
		SHELL_SOURCE.indexOf('case "set_composer_text":', pointAtTargetIndex),
	);
	assert.match(pointAtTargetSource, /const grounded = groundStudioScreenAssistantTarget/u);
	assert.match(pointAtTargetSource, /activeRegion: snapshot\.activeRegion \?\? null/u);
	assert.match(pointAtTargetSource, /const point = getViewportPointFromScreenAssistantTarget\(grounded\);/u);
	assert.match(pointAtTargetSource, /let pointingStarted = false;/u);
	assert.match(pointAtTargetSource, /if \(point\) \{[\s\S]*if \(!isClickyActive\) \{[\s\S]*activateClicky\(\);[\s\S]*\}[\s\S]*clickyStartPointing\(point, label\);[\s\S]*pointingStarted = true;/u);
	assert.match(pointAtTargetSource, /ok: pointingStarted/u);
	assert.doesNotMatch(pointAtTargetSource, /ok: Boolean\(point\)/u);
	const activateTargetIndex = SHELL_SOURCE.indexOf('case "activate_screen_target":');
	assert.notEqual(activateTargetIndex, -1);
	const activateTargetSource = SHELL_SOURCE.slice(
		activateTargetIndex,
		SHELL_SOURCE.indexOf('case "set_composer_text":', activateTargetIndex),
	);
	assert.match(activateTargetSource, /activateStudioScreenAssistantTarget\(\{/u);
	assert.match(activateTargetSource, /id: typeof args\.targetId === "string" \? args\.targetId : undefined/u);
	assert.match(activateTargetSource, /visibleTargets: snapshot\.visibleTargets/u);
	assert.match(SHELL_SOURCE, /if \(!testWindow\.__VPK_E2E_SCREEN_ASSISTANT__\) \{/u);
	assert.match(SHELL_SOURCE, /testWindow\.__vpkStudioScreenAssistantTest = \{/u);
	assert.match(SHELL_SOURCE, /callTool: async \(\{ args = \{\}, name \}\) =>/u);
	assert.match(CLICKY_HOOK_SOURCE, /stateRef\.current = nextState;[\s\S]*setState\(nextState\);[\s\S]*return true;/u);
	assert.match(CLICKY_HOOK_SOURCE, /const startSpeaking = useCallback\(\(text: string\) => \{[\s\S]*if \(stateRef\.current === "off"\) \{[\s\S]*return;[\s\S]*setResponseText\(text\);[\s\S]*if \(stateRef\.current !== "pointing"\) \{[\s\S]*transition\("speaking"\);/u);
	assert.match(CLICKY_HOOK_SOURCE, /const startPointing = useCallback\(\(target: ClickyPointTarget, text: string\) => \{[\s\S]*if \(stateRef\.current !== "off"\) \{[\s\S]*transition\("pointing"\);/u);
	const applyAgentDraftPatchIndex = SHELL_SOURCE.indexOf('case "apply_agent_draft_patch":');
	assert.notEqual(applyAgentDraftPatchIndex, -1);
	const screenAssistantHandlerSource = SHELL_SOURCE.slice(
		applyAgentDraftPatchIndex,
		SHELL_SOURCE.indexOf("default:", applyAgentDraftPatchIndex),
	);
	assert.match(screenAssistantHandlerSource, /case "apply_agent_draft_patch"/u);
	assert.match(screenAssistantHandlerSource, /activeSessionAgentEntry\.profile\.id/u);
	assert.match(screenAssistantHandlerSource, /Object\.keys\(patch\)/u);
	assert.match(screenAssistantHandlerSource, /streamClickyAssistantText\([\s\S]*Updated the instructions\./u);
	assert.match(screenAssistantHandlerSource, /respond\(\{ appliedFields, ok \}\);/u);
	assert.doesNotMatch(screenAssistantHandlerSource, /publishSessionAgent/u);
	assert.match(AGENT_CONFIG_PANEL_SOURCE, /data-screen-assistant-target="studio-agent-config-panel"/u);
	assert.match(AGENT_BLOCK_SOURCE, /screenAssistantTargetPrefix/u);
	assert.match(AGENT_BLOCK_SOURCE, /screenAssistantTargetPrefix=\{screenAssistantTargetPrefix\}/u);
	assert.match(AGENT_PROFILE_COVER_SOURCE, /data-screen-assistant-target=\{screenAssistantTargetPrefix \? `\$\{screenAssistantTargetPrefix\}:avatar` : undefined\}/u);
	assert.match(AGENT_PROFILE_COVER_SOURCE, /getAgentAvatarOptionTargetId\(screenAssistantTargetPrefix, group\.id, option\.src\)/u);
	assert.match(AGENT_INSTRUCTIONS_COMPOSER_SOURCE, /data-agent-field="instructions"/u);
});

test("Studio cursor overlay streams assistant text only through the cursor tooltip", () => {
	const assistantDeltaSource = sourceBetween(SHELL_SOURCE, "const handleRealtimeAssistantTextDelta", "const handleRealtimeAssistantTextCompleted");
	const realtimeTextDeltaPayloads = REALTIME_VOICE_HOOK_SOURCE.match(/text: result\.state\.transcript/g) ?? [];

	assert.doesNotMatch(CLICKY_OVERLAY_SOURCE, /ClickyHistoryPanel/u);
	assert.doesNotMatch(CLICKY_OVERLAY_SOURCE, /history=\{history\}/u);
	assert.doesNotMatch(CLICKY_OVERLAY_SOURCE, /responseText=\{responseText\}[\s\S]*ClickyHistoryPanel/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /const WELCOME_MESSAGE = "Yo, let's cook";/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /const shouldShowWelcome = showWelcome && !showResponseOverlay && !isSpeaking;/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /const showStandaloneNavBubble = showNavBubble && !showResponseOverlay;/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /showStandaloneNavBubble \? <ClickySpeechBubble text=\{navPhrase\} opacity=\{bubbleOpacity\} \/> : null/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /<ClickySpeechBubble[\s\S]*placement="above"[\s\S]*text=\{WELCOME_MESSAGE\}/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /<ClickySpeechBubble[\s\S]*text=\{WELCOME_MESSAGE\}/u);
	assert.match(CLICKY_SPEECH_BUBBLE_SOURCE, /above: \{ left: 18, top: -44, transformOrigin: "left bottom" \}/u);
	assert.match(CLICKY_SPEECH_BUBBLE_SOURCE, /data-clicky-speech-bubble-placement=\{placement\}/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /ClickyResponseOverlay/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /showResponseOverlay/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /seedCursorPosition\(\);/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /latest streamed response text has had time to settle/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /\[isSpeaking, responseText, onReturnToIdle\]/u);
	assert.match(SHELL_SOURCE, /responseText=\{clicky\.responseText\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /history=\{clicky\.history\}/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /NAV_PHRASES|right here|showNavBubble/u);
	assert.match(CLICKY_OVERLAY_SOURCE, /<ClickyResponseOverlay[\s\S]*label=\{showNavBubble \? navPhrase : null\}[\s\S]*text=\{responseText\}/u);
	assert.equal(realtimeTextDeltaPayloads.length, 2);
	assert.match(REALTIME_VOICE_HOOK_SOURCE, /replace: result\.shouldReplaceTranscript/u);
	assert.match(REALTIME_VOICE_HOOK_SOURCE, /displayOnly: true/u);
	assert.match(REALTIME_VOICE_HOOK_SOURCE, /source: "audio_transcript"/u);
	assert.match(assistantDeltaSource, /const text = typeof payload === "string" \? payload : \(payload\.text \?\? ""\);/u);
	assert.match(assistantDeltaSource, /const replace = typeof payload === "string" \? false : payload\.replace === true;/u);
	assert.match(assistantDeltaSource, /if \(text\) \{[\s\S]*streamClickyAssistantText\(text\);[\s\S]*\}[\s\S]*const messageId = typeof payload === "string" \? await ensureRealtimeAssistantMessage\(\)/u);
	assert.match(assistantDeltaSource, /payload\.displayOnly === true[\s\S]*return;/u);
	assert.match(assistantDeltaSource, /await updateRealtimeMessage\(messageId, replace \? text : delta, replace \? \{ replace: true \} : undefined\);/u);
	assert.doesNotMatch(assistantDeltaSource, /isClickyActive && text/u);
	assert.match(assistantDeltaSource, /\[ensureRealtimeAssistantMessage, streamClickyAssistantText, updateRealtimeMessage\]/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /label\?: string \| null;/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /const trimmedLabel = label\?\.trim\(\);/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /data-clicky-response-overlay-label/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /\{trimmedLabel\}/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /const displayedText = useTypewriterText\(text\);/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /\{displayedText\}[\s\S]*<\/div>/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /window\.setInterval/u);
});

test("Studio post-create onboarding uses a local Rovo Cursor tour instead of Spotlight", () => {
	assert.match(SHELL_SOURCE, /import \{ RovoCursorOnboardingTour \} from "@\/components\/projects\/studio\/components\/rovo-cursor-onboarding-tour";/u);
	assert.doesNotMatch(SHELL_SOURCE, /SpotlightTarget|SpotlightCard|SpotlightPrimaryAction|SpotlightSecondaryAction/u);
	assert.match(SHELL_SOURCE, /const STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES = \[[\s\S]*root: "right",[\s\S]*"\[data-screen-assistant-target='sidebar-composer:voice'\]"[\s\S]*"\[data-screen-assistant-target='sidebar-composer'\] button\[aria-label='Stop live voice'\]"[\s\S]*"\[data-screen-assistant-target='sidebar-composer'\] button\[aria-label='Start live voice'\]"[\s\S]*root: "document"[\s\S]*\] as const;/u);
	assert.doesNotMatch(SHELL_SOURCE, /root: "center"[\s\S]*STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES/u);
	assert.doesNotMatch(SHELL_SOURCE, /STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES = \[[\s\S]*Rovo quick actions/u);
	assert.match(SHELL_SOURCE, /const STUDIO_LIVE_CHAT_ANCHOR_RESOLVE_FRAMES = 180;/u);
	assert.match(SHELL_SOURCE, /const STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_PARAM = "onboarding";/u);
	assert.match(SHELL_SOURCE, /const STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_VALUE = "rovo-cursor";/u);
	assert.match(SHELL_SOURCE, /from "@\/components\/projects\/studio\/lib\/studio-agent-onboarding-guide";/u);
	assert.match(SHELL_SOURCE, /resolveStudioAgentOnboardingGuideCommand,/u);
	assert.match(SHELL_SOURCE, /getStudioAgentOnboardingGuideGreeting,/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /export const STUDIO_AGENT_ONBOARDING_GUIDE_SUPPORTED_COMMANDS = "\\"next\\", \\"go back\\", or \\"done\\"";/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /export function resolveStudioAgentOnboardingGuideCommand\(text: string\): StudioAgentOnboardingGuideCommand/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /Congrats - \$\{subject\}\. This is step 1 of 4: the agent card is your home base/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /export function getStudioAgentOnboardingGuideStepNarration\(step: AgentOnboardingTourStep \| null\): string/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /This side chat is for fast refinements/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /These starter prompts are quick test cases/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /This is the activation checkpoint/u);
	assert.match(SHELL_SOURCE, /return respond\(getStudioAgentOnboardingGuideStepNarration\(getStudioAgentOnboardingGuideStepByIndex\(nextStepIndex\)\)\);/u);
	assert.match(SHELL_SOURCE, /return respond\(`Try \$\{STUDIO_AGENT_ONBOARDING_GUIDE_SUPPORTED_COMMANDS\} to control the tour\.`\);/u);
	assert.doesNotMatch(SHELL_SOURCE, /Moving to step \$\{nextStepNumber\} of \$\{agentOnboardingTour\.total\}\. Say/u);
	assert.doesNotMatch(SHELL_SOURCE, /getStudioAgentOnboardingGuideNextMessage/u);
	assert.match(SHELL_SOURCE, /getStudioAgentOnboardingGuideGreeting\(activeSessionAgentEntry\?\.profile\.name \?\? null\)/u);
	assert.match(SHELL_SOURCE, /const respond = \(assistantText: string\) => \{[\s\S]*appendAgentOnboardingGuideExchange\(text, assistantText\);[\s\S]*voiceText: assistantText/u);
	assert.match(SHELL_SOURCE, /createStudioAgentOnboardingLocalConversation\(\{[\s\S]*initialAgentName: activeSessionAgentEntry\?\.profile\.name \?\? null,[\s\S]*initialVoiceKey: activeSessionAgentEntry\?\.profile\.id \?\? null,[\s\S]*resolveInitialVoiceText: getStudioAgentOnboardingGuideGreeting,/u);
	assert.match(SHELL_SOURCE, /localConversation=\{agentOnboardingLocalConversation\}/u);
	// The Ask Rovo "Edit agent" cards must gate the generated-agent result card to a
	// fresh generation, but that replay policy belongs to a Studio helper. ChatPanel
	// only accepts a generic generated-agent render predicate.
	assert.match(SHELL_SOURCE, /const agentEditCards = useMemo\(\(\) => \{[\s\S]*return createStudioAgentEditCards\(\{[\s\S]*entry: activeSessionAgentEntry,[\s\S]*sourceMessageId: activeAgentConfig\?\.sourceMessageId \?\? null,[\s\S]*\}\);[\s\S]*\}, \[activeSessionAgentEntry, activeAgentConfig\?\.sourceMessageId\]\);/u);
	assert.match(STUDIO_CHAT_HELPERS_SOURCE, /generatedAgentResult: freshGenerationMessageId \? entry\.sourceResult : null,[\s\S]*shouldRenderGeneratedAgentResult: \(\{ message \}\) => message\.id === freshGenerationMessageId/u);
	assert.match(CHAT_PANEL_SOURCE, /shouldRenderGeneratedAgentResult\?: \(input: ChatPanelGeneratedAgentResultRenderInput\) => boolean;/u);
	assert.match(CHAT_PANEL_SOURCE, /const shouldRenderGeneratedAgentResult = cards\?\.shouldRenderGeneratedAgentResult;[\s\S]*const generatedAgentResult =[\s\S]*isGeneratedAgentResult\(agentResult\) &&[\s\S]*hasTurnCompleteSignal\(message\) &&[\s\S]*\(shouldRenderGeneratedAgentResult\?\.\(\{ agent: agentResult, message \}\) \?\? true\)/u);
	assert.match(SHELL_SOURCE, /<ChatPanel[\s\S]*cards=\{agentEditCards\}[\s\S]*localConversation=\{agentOnboardingLocalConversation\}/u);
	assert.match(SHELL_SOURCE, /const \[agentOnboardingLiveVoiceRequestKey, setAgentOnboardingLiveVoiceRequestKey\] = useState\(0\);/u);
	assert.match(SHELL_SOURCE, /setAgentOnboardingLiveVoiceRequestKey\(0\);[\s\S]*setAgentOnboardingLiveVoiceRequestKey\(\(currentKey\) => currentKey \+ 1\);/u);
	assert.match(SHELL_SOURCE, /startRealtimeVoiceRequestKey=\{agentOnboardingLiveVoiceRequestKey\}/u);
	assert.match(SHELL_SOURCE, /setAgentOnboardingTourFinishRequestKey\(\(currentKey\) => currentKey \+ 1\);/u);
	assert.match(SHELL_SOURCE, /const hasQueuedAgentOnboardingTourPreviewRef = useRef\(false\);/u);
	assert.match(SHELL_SOURCE, /liveChatAnchorElement=\{liveChatAnchorElement\}/u);
	assert.match(SHELL_SOURCE, /const getCandidateRoot = \(root: typeof STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES\[number\]\["root"\]\) => \{[\s\S]*root === "right"[\s\S]*askRovoPanelRef\.current[\s\S]*return document;/u);
	assert.match(SHELL_SOURCE, /for \(const candidate of STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES\) \{[\s\S]*for \(const selector of candidate\.selectors\) \{[\s\S]*root\.querySelector<HTMLElement>\(selector\)/u);
	assert.doesNotMatch(SHELL_SOURCE, /STUDIO_LIVE_CHAT_ANCHOR_SELECTORS[\s\S]*\.flatMap/u);
	assert.match(SHELL_SOURCE, /<RovoCursorOnboardingTour[\s\S]*isActive=\{agentOnboardingTour\.isActive && Boolean\(agentOnboardingTour\.anchorElement\) && Boolean\(liveChatAnchorElement\)\}[\s\S]*finishRequestKey=\{agentOnboardingTourFinishRequestKey\}[\s\S]*onBack=\{backAgentOnboardingTourStep\}[\s\S]*onNext=\{handleAgentOnboardingTourNext\}[\s\S]*onDismiss=\{dismissAgentOnboardingTour\}/u);
	assert.match(SHELL_SOURCE, /process\.env\.NODE_ENV === "production"[\s\S]*hasStartedAgentOnboardingTourPreviewRef\.current[\s\S]*params\.get\(STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_PARAM\) !== STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_VALUE/u);
	assert.match(SHELL_SOURCE, /hasQueuedAgentOnboardingTourPreviewRef\.current = true;[\s\S]*setActiveAgentConfigView\("test"\);[\s\S]*openAgentCreationAskRovoChat\(\);[\s\S]*const startPreviewTour = \(\) => \{[\s\S]*frame < 4[\s\S]*hasStartedAgentOnboardingTourPreviewRef\.current = true;[\s\S]*hasQueuedAgentOnboardingTourPreviewRef\.current = false;[\s\S]*startAgentOnboardingTour\(\);/u);
	assert.match(SHELL_SOURCE, /if \(!hasStartedAgentOnboardingTourPreviewRef\.current\) \{[\s\S]*hasQueuedAgentOnboardingTourPreviewRef\.current = false;/u);

	assert.doesNotMatch(AGENT_ONBOARDING_TOUR_SOURCE, /SpotlightPlacement|placement:/u);
	assert.match(AGENT_ONBOARDING_TOUR_SOURCE, /"agent-result-card"[\s\S]*"ask-rovo-composer"[\s\S]*"chat-starters"[\s\S]*"activate-button"/u);
	assert.match(AGENT_ONBOARDING_HOOK_SOURCE, /setAnchorElement\(null\);[\s\S]*const \{ container, selector \} = ANCHOR_SELECTORS\[step\.anchorKey\];/u);
	assert.match(AGENT_ONBOARDING_HOOK_SOURCE, /const root = container === "right" \? rightPanelRef\.current : centerRef\.current;[\s\S]*const element = root\?\.querySelector<HTMLElement>\(selector\) \?\? null;/u);
	assert.doesNotMatch(AGENT_ONBOARDING_HOOK_SOURCE, /document\.querySelector<HTMLElement>\(selector\)/u);
	assert.match(AGENT_ONBOARDING_HOOK_SOURCE, /element\.scrollIntoView\(\{ block: "center", inline: "nearest" \}\);/u);
	assert.match(AGENT_ONBOARDING_HOOK_SOURCE, /Missing anchors must not advance the tour; only an explicit next,/u);
	assert.match(AGENT_ONBOARDING_HOOK_SOURCE, /rafId = requestAnimationFrame\(resolve\);[\s\S]*return \(\) => \{[\s\S]*cancelAnimationFrame\(rafId\);/u);
	assert.doesNotMatch(AGENT_ONBOARDING_HOOK_SOURCE, /MAX_RESOLVE_FRAMES/u);
	assert.doesNotMatch(AGENT_ONBOARDING_HOOK_SOURCE, /setStepIndex\(\(prev\) => \{[\s\S]*return prev \+ 1;/u);
	assert.doesNotMatch(AGENT_ONBOARDING_HOOK_SOURCE, /spotlight-anchor-glow|classList|GLOW_CLASS/u);

	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /import \{ AnimatePresence, arc, motion, useReducedMotion, type Transition \} from "motion\/react";/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /FOCUSABLE_SELECTOR/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /areRectsEqual\(previousRects\.anchorRect, nextRects\.anchorRect\)/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /function doRectsOverlap\(a: ViewportRect, b: ViewportRect\): boolean/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /function expandRect\(rect: ViewportRect, amount: number\): ViewportRect/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /avoidRect: phase === "tour" \? liveChatRect : null/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /doRectsOverlap\(panelRect, expandRect\(avoidRect, PANEL_GAP\)\)/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /import \{ RovoCursor \} from "@\/components\/ui-custom\/rovo-cursor";/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /createPortal\([\s\S]*document\.body/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /useMemo\(\(\) => arc\(\{ strength: 0\.28, peak: 0\.42, direction: "cw", rotate: 0\.12 \}\), \[\]\)/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /useMemo\(\(\) => arc\(\{ strength: 0\.44, peak: 0\.48, direction: "ccw", rotate: 0\.18 \}\), \[\]\)/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /path: phase === "returning" \? finalPath : cursorPath/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /const FINAL_MESSAGE = "If you need help, you can always find me here\.";/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /const TOUR_PANEL_REVEAL_DELAY_MS = CURSOR_TOUR_TRANSITION_MS \+ PANEL_REVEAL_BUFFER_MS;/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /const FINAL_MESSAGE_DELAY_MS = CURSOR_RETURN_TRANSITION_MS \+ PANEL_REVEAL_BUFFER_MS;/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /const TYPEWRITER_INTERVAL_MS = 22;/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /setDisplayedText\(text\.slice\(0, index\)\);/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /finishRequestKey\?: number;/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /lastFinishRequestKeyRef\.current === finishRequestKey[\s\S]*startReturningPhase\(\);/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /const \[showTourPanel, setShowTourPanel\] = useState\(false\);/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /const showPanel = \(phase === "tour" && showTourPanel\) \|\| \(phase === "returning" && showFinalMessage\);/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /window\.setTimeout\(\(\) => setShowTourPanel\(true\), reducedMotion \? 0 : TOUR_PANEL_REVEAL_DELAY_MS\)/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /aria-describedby=\{bodyId\}[\s\S]*aria-labelledby=\{titleId\}/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /left: panelPosition\.x,[\s\S]*top: panelPosition\.y,/u);
	assert.doesNotMatch(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /animate=\{\{ opacity: 1, scale: 1, x: panelPosition\.x, y: panelPosition\.y \}\}/u);
	assert.equal((ROVO_CURSOR_ONBOARDING_TOUR_SOURCE.match(/\{stepIndex \+ 1\} of \{total\}/gu) ?? []).length, 1);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /<RovoCursor state="speaking" size=\{16\} \/>[\s\S]*\{stepIndex \+ 1\} of \{total\}/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /panelRef\.current\?\.focus\(\{ preventScroll: true \}\);/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /event\.key === "Escape"[\s\S]*onDismiss\(\);/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /event\.key !== "Tab"[\s\S]*focusableElements/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /aria-label="Dismiss onboarding"/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /\{isFirst \? null : \([\s\S]*data-rovo-cursor-onboarding-back[\s\S]*onClick=\{onBack\}/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /data-rovo-cursor-onboarding-next[\s\S]*onClick=\{handlePrimaryAction\}[\s\S]*\{isLast \? "Finish" : "Next"\}/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /window\.setTimeout\(onDismiss, \(reducedMotion \? 0 : FINAL_MESSAGE_DELAY_MS\) \+ FINAL_DISMISS_MS\)/u);
	assert.match(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /reducedMotion\s*\?\s*\{ duration: 0 \}/u);
	assert.doesNotMatch(ROVO_CURSOR_ONBOARDING_TOUR_SOURCE, /useClicky|useClickyVoice|useRealtimeVoice|submitPrompt|createRovoAppUserMessage|appendDictationTranscript/u);

	assert.match(CHAT_PANEL_SOURCE, /export interface ChatPanelLocalConversation \{[\s\S]*buildVoiceInput\?: \(voiceText: string\) => string;[\s\S]*initialVoiceKey\?: string \| null;[\s\S]*initialVoiceText\?: string \| null;[\s\S]*messages: ReadonlyArray<RovoUIMessage>;[\s\S]*onSubmit: \(text: string\) => Promise<ChatPanelLocalConversationSubmitResult> \| ChatPanelLocalConversationSubmitResult;/u);
	assert.match(CHAT_PANEL_SOURCE, /export interface ChatPanelLocalConversationSubmitDetails \{[\s\S]*handled\?: boolean;[\s\S]*voiceText\?: string \| null;/u);
	assert.match(CHAT_PANEL_SOURCE, /function getLocalConversationVoiceText\(result: ChatPanelLocalConversationSubmitResult\): string/u);
	assert.match(CHAT_PANEL_SOURCE, /const LOCAL_CONVERSATION_VOICE_SUPPRESSION_MIN_MS = 2200;/u);
	assert.match(CHAT_PANEL_SOURCE, /function getLocalConversationVoiceSuppressionMs\(text: string\): number/u);
	assert.match(CHAT_PANEL_SOURCE, /const realtimeVoiceStateRef = useRef<UseRealtimeVoiceResult\["voiceState"\]>\("idle"\);/u);
	assert.match(CHAT_PANEL_SOURCE, /const speakLocalConversationVoiceText = useCallback\(\(result: ChatPanelLocalConversationSubmitResult\) => \{[\s\S]*text: localConversation\?\.buildVoiceInput\?\.\(voiceText\) \?\? voiceText/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /buildVoiceInput: buildStudioAgentOnboardingVoiceInput/u);
	assert.match(STUDIO_AGENT_ONBOARDING_GUIDE_SOURCE, /Speak much quicker than normal/u);
	assert.match(CHAT_PANEL_SOURCE, /localConversationVoiceSuppressedUntilRef\.current = Math\.max\([\s\S]*Date\.now\(\) \+ getLocalConversationVoiceSuppressionMs\(voiceText\)/u);
	assert.match(CHAT_PANEL_SOURCE, /const lastLocalInitialVoiceKeyRef = useRef<string \| null>\(null\);[\s\S]*const initialVoiceText = localConversation\.initialVoiceText\?\.trim\(\) \?\? "";[\s\S]*speakLocalConversationVoiceText\(\{ voiceText: initialVoiceText \}\);/u);
	assert.match(CHAT_PANEL_SOURCE, /localConversationVoiceSuppressedUntilRef\.current = 0;/u);
	assert.match(CHAT_PANEL_SOURCE, /const isLocalConversationActive = localConversation !== null;/u);
	assert.match(CHAT_PANEL_SOURCE, /if \(!localConversation\) \{[\s\S]*await handleSubmit\(\{ files, text \}\);/u);
	assert.match(CHAT_PANEL_SOURCE, /const result = await localConversation\.onSubmit\(promptText\);[\s\S]*if \(!isLocalConversationSubmitHandled\(result\)\) \{[\s\S]*await handleSubmit\(\{ files, text: promptText \}\);[\s\S]*setPrompt\(""\);[\s\S]*speakLocalConversationVoiceText\(result\);/u);
	assert.match(CHAT_PANEL_SOURCE, /const realMessages = uiMessages\.filter\(isRenderableRovoUIMessage\);[\s\S]*const localMessages = localConversation\?\.messages\.filter\(isRenderableRovoUIMessage\) \?\? \[\];[\s\S]*return \[\.\.\.realMessages, \.\.\.localMessages\];/u);
	assert.match(CHAT_PANEL_SOURCE, /if \(!localConversation\) \{[\s\S]*sendRealtimePrompt\(\);[\s\S]*return;[\s\S]*\}[\s\S]*localConversation\.onSubmit\(promptText\)[\s\S]*if \(!isLocalConversationSubmitHandled\(result\)\) \{[\s\S]*sendRealtimePrompt\(\);[\s\S]*return;[\s\S]*\}[\s\S]*speakLocalConversationVoiceText\(result\);/u);
	assert.match(CHAT_PANEL_SOURCE, /realtime\.connect\(isLocalConversationActive \? \{ explicitResponseOnly: true \} : undefined\);/u);
	assert.match(CHAT_PANEL_SOURCE, /realtimeVoiceStateRef\.current = realtime\.voiceState;/u);
	assert.match(sourceBetween(CHAT_PANEL_SOURCE, "const handleRealtimeTranscript = useCallback", "const handleRealtimeTranscriptCompleted"), /Date\.now\(\) < localConversationVoiceSuppressedUntilRef\.current \|\| realtimeVoiceStateRef\.current === "speaking"[\s\S]*realtimeTranscriptRef\.current = "";[\s\S]*return;/u);
	assert.match(sourceBetween(CHAT_PANEL_SOURCE, "const handleRealtimeTranscriptCompleted", "const getScreenAssistantSnapshot"), /if \(isClickyActive\) \{[\s\S]*clickyAddExchange\(\{ role: "user", content: transcriptText \}\);[\s\S]*return;[\s\S]*\}[\s\S]*if \(localConversation\) \{[\s\S]*speakLocalConversationVoiceText\(result\);[\s\S]*return;[\s\S]*handleSubmit\(\{ files: \[\], text: transcriptText \}\);/u);
	assert.match(sourceBetween(CHAT_PANEL_SOURCE, "const handleRealtimeTranscriptCompleted", "const getScreenAssistantSnapshot"), /Date\.now\(\) < localConversationVoiceSuppressedUntilRef\.current \|\| realtimeVoiceStateRef\.current === "speaking"[\s\S]*realtimeTranscriptRef\.current = "";[\s\S]*return;[\s\S]*if \(isClickyActive\)/u);
	assert.match(CHAT_PANEL_SOURCE, /if \(localConversation\) \{[\s\S]*return;[\s\S]*\}[\s\S]*streamClickyAssistantText\(text\);/u);
	assert.match(CHAT_PANEL_SOURCE, /isLocalConversationActive \? null : getLatestQuestionCardPayload\(rawUiMessages\)/u);
	assert.match(CHAT_PANEL_SOURCE, /hideAiCursor=\{hideAiCursor\}/u);
	assert.match(CHAT_PANEL_SOURCE, /clickyActive=\{!hideAiCursor && \(isClickyActive \|\| isLocalConversationActive\)\}/u);
	assert.match(CHAT_PANEL_SOURCE, /onStartDictation=\{handleStartDictation\}/u);
	assert.match(CHAT_PANEL_SOURCE, /onToggleRealtimeVoice=\{handleToggleRealtimeVoice\}/u);
	assert.doesNotMatch(CHAT_PANEL_SOURCE, /hideAiCursor=\{hideAiCursor \|\| isLocalConversationActive\}/u);
});

test("Studio clarification answers keep agent creation mode active", () => {
	// Continuation context builder now lives in the lib; the shell looks up the
	// per-thread template provenance and passes it (plus the domain-scoped category
	// ids) into the continuation context.
	assert.match(SHELL_SOURCE, /buildStudioAgentCreationContinuationContext\(studioCreationTemplate, \{/u);
	assert.match(SHELL_SOURCE, /const getStudioAgentCreationClarificationOptions = useCallback/u);
	assert.match(SHELL_SOURCE, /activeQuestionCard\?\.creationMode === "agent" \|\|[\s\S]*studioAgentCreationThreadKeysRef\.current\.has\(chat\.runtimeThreadId\)/u);
	assert.match(SHELL_SOURCE, /hasPersistedAgentCreationPrompt/u);
	assert.match(SHELL_SOURCE, /message\.metadata\?\.creationMode === "agent"/u);
	assert.match(SHELL_SOURCE, /creationMode: "agent" as const/u);
	assert.match(SHELL_SOURCE, /submitClarification\([\s\S]*activeQuestionCard,[\s\S]*omitDomainScopeAnswer\(answers\),[\s\S]*\.\.\.getStudioAgentCreationClarificationOptions\(categoryIds\),[\s\S]*onSubmitted: hideQuestionCard/u);
	assert.match(SHELL_SOURCE, /setSubmittingQuestionCardKey\(questionCardKey\);/u);
	assert.match(SHELL_SOURCE, /onDismissQuestionCard: handleCancelClarificationQuestionSet/u);
});

test("Studio hides resolved question-card trace after rendering answer summary", () => {
	assert.match(MESSAGES_SOURCE, /shouldSuppressResolvedQuestionTrace/u);
	assert.match(CORE_MESSAGES_SOURCE, /const shouldSuppressTraceForResolvedQuestion =[\s\S]*shouldSuppressResolvedQuestionTrace &&[\s\S]*shouldHideResolvedQuestionCard[\s\S]*hasAnsweredQuestionToolCalls[\s\S]*visibleThinkingToolCalls\.length === 0[\s\S]*!isResponseInFlight;/u);
	assert.match(CORE_MESSAGES_SOURCE, /const thinkingActive = thinkingTraceState\.thinkingActive && !shouldSuppressTraceForResolvedQuestion;/u);
});

test("Studio threads template provenance into agent creation contexts", () => {
	// Browse-all dialog and bento starters both carry distilled template
	// provenance into the gallery select handler.
	assert.match(SHELL_SOURCE, /buildCreationTemplateContextFromAgent\(agent\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /onSelect\(template\.prompt, buildCreationTemplateContextFromStarter\(template\)\)/u);
	assert.match(HOME_STARTER_BENTO_SOURCE, /onSelect: \(prompt: string, template\?: StudioCreationTemplateContext\) => void;/u);
	assert.match(SHELL_SOURCE, /from "@\/components\/projects\/studio\/lib\/studio-template-prompts";/u);
	assert.match(STUDIO_TEMPLATE_PROMPTS_SOURCE, /Use the \$\{agent\.name\} template to create a Rovo agent/u);
	assert.doesNotMatch(SHELL_SOURCE, /Use the \$\{agent\.name\} template to create a Rovo agent/u);
	assert.doesNotMatch(SHELL_SOURCE, /Use the \$\{agent\.name\} template to create a Studio agent/u);
	assert.doesNotMatch(STUDIO_TEMPLATE_PROMPTS_SOURCE, /Use the \$\{agent\.name\} template to create a Studio agent/u);
	// The pending selection is held in a ref and consumed on submit; the active
	// creation thread keeps its template for the clarification continuation.
	assert.match(SHELL_SOURCE, /const creationTemplateRef = useRef<StudioCreationTemplateContext \| null>\(null\);/u);
	assert.match(SHELL_SOURCE, /const creationTemplateByThreadRef = useRef<Record<string, StudioCreationTemplateContext>>\(\{\}\);/u);
	assert.match(SHELL_SOURCE, /creationTemplateRef\.current = template \?\? null;/u);
	assert.match(SHELL_SOURCE, /setAgentTemplatesDialogOpen\(false\);[\s\S]*setIsSidebarAgentBrowserOpen\(false\);/u);
	assert.match(SHELL_SOURCE, /creationTemplateByThreadRef\.current\[chat\.runtimeThreadId\] = creationTemplate;/u);
	assert.match(SHELL_SOURCE, /creationTemplateRef\.current = null;/u);
});

test("Studio Agent Directory template setup builds a local draft before opening config", () => {
	assert.match(SHELL_SOURCE, /buildTemplateAgentResultFromAgent/u);
	assert.match(SHELL_SOURCE, /const handleBuildTemplateAgent = useCallback\(\(agent: AgentTemplatesAgent, options: AgentsDirectoryTemplateBuildOptions\) => \{/u);
	assert.match(SHELL_SOURCE, /buildTemplateAgentResultFromAgent\(agent, \{[\s\S]*appIds: options\.connectApps \? options\.appIds : \[\],[\s\S]*\}\);/u);
	assert.match(SHELL_SOURCE, /studioAgentRegistry\.registerCreatedAgentFromResult\(agentResult, \{[\s\S]*preserveCurrentThread: true,[\s\S]*select: true,[\s\S]*sourceKey: `studio-template-setup:\$\{agent\.id\}:\$\{Date\.now\(\)\}`/u);
	assert.match(SHELL_SOURCE, /return registered[\s\S]*\? \{[\s\S]*profileId: registered\.id,[\s\S]*onCancel: \(\) => studioAgentRegistry\.removeSessionAgent\(registered\.id\),[\s\S]*\}[\s\S]*: null;/u);
	assert.match(SHELL_SOURCE, /const handleOpenBuiltTemplateAgentConfig = useCallback\(\(profileId: string\) => \{[\s\S]*setActiveAgentConfigState\(\{[\s\S]*profileId,[\s\S]*sourceMessageId: null,[\s\S]*\}\);[\s\S]*setActiveAgentConfigView\("configure"\);[\s\S]*setIsSidebarAgentBrowserOpen\(false\);/u);
	assert.match(SHELL_SOURCE, /onBuildTemplateAgent=\{handleBuildTemplateAgent\}/u);
	assert.match(SHELL_SOURCE, /onOpenBuiltTemplateAgentConfig=\{handleOpenBuiltTemplateAgentConfig\}/u);
	assert.match(SHELL_SOURCE, /const handleTemplateAgentSelect = useCallback\(\(agent: AgentTemplatesAgent\) => \{[\s\S]*handleGallerySelect\(/u);
});

test("Studio composer reveals 'Start from scratch' on hover, focus, or prompt value and lands on a blank untitled agent config", () => {
	// Composer reveals the affordance underneath the prompt input on hover,
	// deliberate focus, or once the prompt has content; autofocus alone should
	// not show the micro label.
	assert.match(COMPOSER_SOURCE, /onStartFromScratch\?: \(\) => void;/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /const \[isComposerHoverActive, setIsComposerHoverActive\] = useState\(false\);/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /const \[isInputFocused, setIsInputFocused\] = useState\(false\);/u);
	assert.match(COMPOSER_SOURCE, /const hasPromptValue = textValue\.trim\(\)\.length > 0;/u);
	assert.match(COMPOSER_SOURCE, /const shouldSuppressInitialAutoFocusRevealRef = useRef\(autoFocus\);/u);
	assert.match(COMPOSER_SOURCE, /useRovoAppComposerReveal\(\{ hasPromptValue \}\)/u);
	assert.match(COMPOSER_SOURCE, /onBlur=\{\(\) => setInputFocused\(false\)\}/u);
	assert.match(COMPOSER_SOURCE, /onFocus=\{\(\) => \{[\s\S]*shouldSuppressInitialAutoFocusRevealRef\.current = false;[\s\S]*setInputFocused\(true\);[\s\S]*replayRevealTraces\(\);[\s\S]*\}\}/u);
	assert.match(COMPOSER_REVEAL_HOOK_SOURCE, /const isRevealVisible = hasPromptValue \|\| isComposerHoverActive \|\| isInputFocused;/u);
	assert.match(COMPOSER_SOURCE, /\{onStartFromScratch \? \([\s\S]*\{isRevealVisible \?/u);
	// Reveal copy: default is "Or start from scratch"; when onBrowseTemplates is
	// provided (bento dismissed) it becomes "Browse template or start from scratch".
	assert.match(COMPOSER_SOURCE, /onClick=\{onBrowseTemplates\}[\s\S]*Browse\{" "\}[\s\S]*templates/u);
	assert.match(COMPOSER_SOURCE, /onClick=\{onStartFromScratch\}[\s\S]*start from\{" "\}[\s\S]*scratch/u);
	// Reveal is taken out of layout flow so it never reflows/recenters siblings.
	assert.match(COMPOSER_SOURCE, /className="absolute inset-x-0 top-full/u);
	// Footer-style copy: subtle text size + color.
	assert.match(COMPOSER_SOURCE, /text-xs text-text-subtlest/u);
	// Click must survive the textarea blur so the reveal isn't unmounted first.
	assert.match(COMPOSER_SOURCE, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/u);

	// Shell wires the affordance to a from-scratch agent registration that opens the config pane.
	assert.match(SHELL_SOURCE, /const handleStartAgentFromScratch = useCallback\(\(\) => \{/u);
	// New agents (from-scratch and AI-generated) pick a random avatar from the
	// shared full avatar set, which also randomizes the accent color since each
	// avatar family shares one brand color.
	assert.match(SHELL_SOURCE, /import \{ getRandomAgentAvatarSrc \} from "@\/lib\/agent-avatars";/u);
	assert.match(SHELL_SOURCE, /action: "create",\s*\n\s*agentId: `untitled-agent-\$\{uniqueSuffix\}`,\s*\n\s*avatarSrc: getRandomAgentAvatarSrc\(\)/u);
	assert.match(SHELL_SOURCE, /studioAgentRegistry\.registerCreatedAgentFromResult\(blankAgentResult/u);
	// The reveal is a from-scratch agent-creation CTA, so it is wired only on the
	// default agents landing (isDefaultAgentHomeState). On thread/custom-agent/
	// artifact views the prop is undefined, so the composer renders no reveal even
	// on hover/focus.
	assert.match(SHELL_SOURCE, /onStartFromScratch=\{isDefaultAgentHomeState \? handleStartAgentFromScratch : undefined\}/u);
	assert.match(SHELL_SOURCE, /<RovoAppSidebar[\s\S]*onCreateAgent=\{handleStartAgentFromScratch\}[\s\S]*onNewChat=\{handleReturnToAgentsHome\}/u);
	// The from-scratch handler opens the same config pane the AI-result flow uses.
	const fromScratchHandlerSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const handleStartAgentFromScratch = useCallback"),
		SHELL_SOURCE.indexOf("const handleStudioSidebarAgentSelect = useCallback"),
	);
	assert.match(fromScratchHandlerSource, /setActiveAgentConfigState\(\{\s*\n\s*profileId: registered\.id/u);
	assert.match(fromScratchHandlerSource, /setActiveAgentConfigView\("configure"\);[\s\S]*openAgentCreationAskRovoChat\(\);/u);
});

// Regression: re-opening a custom agent (sidebar row / "Edit") must NOT point
// chat at the custom agent. It opens the config pane only and leaves the Ask Rovo
// build helper on the default Rovo agent, exactly like create-from-scratch — so
// the panel no longer "swaps" onto the custom agent on the second click.
test("Studio re-selecting a custom agent edits it without selecting it for chat", () => {
	const sidebarSelectSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const handleStudioSidebarAgentSelect = useCallback"),
		SHELL_SOURCE.indexOf("const handleDeleteStudioAgent = useCallback"),
	);
	// Opens the config pane on the agent...
	assert.match(sidebarSelectSource, /setActiveAgentConfigState\(\{\s*\n\s*profileId: agentId,/u);
	assert.match(sidebarSelectSource, /setActiveAgentConfigView\("configure"\);/u);
	// ...but never selects it for chat.
	assert.doesNotMatch(sidebarSelectSource, /selectAgent/u);

	// The browse picker only selects-for-chat on the non-editable branch (a
	// genuine "chat with this built-in agent"); editable custom agents open the
	// config pane and keep the Ask Rovo helper.
	const browseSelectSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("const handleSidebarBrowseAgentSelect = useCallback"),
		SHELL_SOURCE.indexOf("const handleUpdateAgentDraft = useCallback"),
	);
	assert.match(
		browseSelectSource,
		/if \(studioAgentRegistry\.getSessionAgentEntry\?\.\(agent\.id\)\) \{[\s\S]*setActiveAgentConfigState\(\{[\s\S]*\} else \{[\s\S]*studioAgentRegistry\.selectAgent\(agent\.id, \{ preserveCurrentThread: true \}\);/u,
	);
});

test("Studio composer opts into experimental dark composer CTAs", () => {
	assert.match(COMPOSER_SOURCE, /screenAssistantTargetPrefix = "studio-composer"/u);
	assert.match(COMPOSER_SOURCE, /data-screen-assistant-target=\{screenAssistantTargetPrefix\}/u);
	assert.match(COMPOSER_SOURCE, /className=\{cn\("relative z-10 mx-auto", fillWidth \? FLOATING_COMPOSER_SESSION_MAX_WIDTH_CLASS : FLOATING_COMPOSER_MAX_WIDTH_CLASS\)\}/u);
	assert.match(COMPOSER_SOURCE, /experimentalDarkCta/u);
	assert.doesNotMatch(COMPOSER_SOURCE, /voiceStartButtonClassName="bg-bg-neutral-bold text-text-inverse hover:bg-bg-neutral-bold-hovered active:bg-bg-neutral-bold-pressed"/u);
	assert.doesNotMatch(COMPOSER_SOURCE, /submitButtonClassName="bg-bg-neutral-bold text-text-inverse hover:bg-bg-neutral-bold-hovered active:bg-bg-neutral-bold-pressed"/u);
});

test("deleting a thread also unmarks any in-progress agent-creation tracking", () => {
	// Regression: deleting an in-progress agent left the thread in
	// studioAgentCreationThreadIds after chat.threads dropped it, so the memo
	// re-rendered it as a ghost "Agent creation" row that lingered forever.
	const onDeleteThreadSource = SHELL_SOURCE.slice(
		SHELL_SOURCE.indexOf("onDeleteThread={async (threadId) => {"),
		SHELL_SOURCE.indexOf("onNewChat={handleReturnToAgentsHome}"),
	);
	assert.match(onDeleteThreadSource, /unmarkStudioAgentCreationThread\(threadId\);/u);
	assert.match(onDeleteThreadSource, /void chat\.deleteThread\(threadId\);/u);
});
