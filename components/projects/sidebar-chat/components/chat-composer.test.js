const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

const CLICKY_VOICE_HOOK_SOURCE = readProjectFile("components/projects/rovo-core/hooks/use-default-clicky-voice.ts");
const REALTIME_VOICE_HOOK_SOURCE = readProjectFile("components/projects/rovo-core/hooks/use-realtime-voice.ts");
const SESSION_AGENT_TYPES_SOURCE = readProjectFile("components/projects/rovo-core/lib/agent-records/types.ts");
const SESSION_AGENT_ENTRY_SOURCE = readProjectFile("components/projects/rovo-core/lib/agent-records/session-agent-entry.ts");
const SESSION_AGENT_REGISTRY_SOURCE = readProjectFile("components/projects/rovo-core/lib/agent-records/session-agent-registry.ts");
const LIVE_WAVEFORM_SOURCE = readProjectFile("components/ui-audio/live-waveform.tsx");
const PROMPT_INPUT_DICTATION_SOURCE = readProjectFile("components/ui-custom/prompt-input-dictation.tsx");
const ROVO_CURSOR_SOURCE = readProjectFile("components/ui-custom/rovo-cursor.tsx");
const ROVO_CHAT_HELPERS_SOURCE = readProjectFile("app/contexts/rovo-chat-helpers.ts");

function sourceBetween(source, startNeedle, endNeedle) {
	const start = source.indexOf(startNeedle);
	const end = source.indexOf(endNeedle, start);

	assert.notEqual(start, -1, `Missing source marker: ${startNeedle}`);
	assert.notEqual(end, -1, `Missing source marker: ${endNeedle}`);
	return source.slice(start, end);
}

test("compact chat sources selector opens a reasoning-free customize popover", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const popoverIndex = source.indexOf("<Popover open={isCustomizeMenuOpen} onOpenChange={handleCustomizeMenuOpenChange}>");
	const preferencesTriggerIndex = source.indexOf("<PopoverTrigger render={<PromptInputPreferencesButton aria-label=\"Customize\" />} />", popoverIndex);
	const customizeMenuIndex = source.indexOf("<CustomizeMenu", preferencesTriggerIndex);
	const showReasoningFalseIndex = source.indexOf("showReasoning={false}", customizeMenuIndex);
	const sendControlsIndex = source.indexOf("<ChatComposerSendControls", showReasoningFalseIndex);

	assert.notEqual(popoverIndex, -1);
	assert.ok(preferencesTriggerIndex > popoverIndex);
	assert.ok(customizeMenuIndex > preferencesTriggerIndex);
	assert.ok(showReasoningFalseIndex > customizeMenuIndex);
	assert.ok(sendControlsIndex > showReasoningFalseIndex);
	assert.match(source, /<RovoComposerSendControls/u);
	assert.doesNotMatch(source.slice(customizeMenuIndex, sendControlsIndex), /showSources=\{false\}/u);
});

test("compact chat composer surface restores the shared prompt input backdrop shadow", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const surfaceSource = sourceBetween(source, "chat-composer-surface", "<PromptInput");

	assert.match(source, /import \{[^}]*composerUpwardShadow[^}]*\} from "@\/components\/projects\/shared\/components\/rovo-composer-styles";/u);
	assert.match(surfaceSource, /style=\{\{ boxShadow: composerUpwardShadow \}\}/u);
});

test("compact chat animates sources and model selectors when edit-agent context toggles", () => {
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const sharedSendControls = readProjectFile("components/projects/shared/components/rovo-composer-send-controls.tsx");

	assert.match(sidebarComposer, /import \{ AnimatePresence, motion \} from "motion\/react";/u);
	assert.match(sidebarComposer, /setIsCustomizeMenuOpen\(false\);[\s\S]*setIsAutoMenuOpen\(false\);/u);
	assert.match(sidebarComposer, /<AnimatePresence initial=\{false\} mode="popLayout">[\s\S]*key="sources-selector"[\s\S]*initial=\{\{ opacity: 0, transform: "scale\(0\.8\)" \}\}[\s\S]*animate=\{\{ opacity: 1, transform: "scale\(1\)" \}\}[\s\S]*exit=\{\{ opacity: 0, transform: "scale\(0\.8\)" \}\}[\s\S]*<Popover open=\{isCustomizeMenuOpen\}/u);
	assert.match(sharedSendControls, /if \(hideReasoningSelector && open\) \{[\s\S]*onOpenChange\?\.\(false\);[\s\S]*\}/u);
	assert.match(sharedSendControls, /<AnimatePresence initial=\{false\} mode="popLayout">[\s\S]*key="reasoning-selector"[\s\S]*initial=\{\{ opacity: 0, transform: "scale\(0\.8\)" \}\}[\s\S]*animate=\{\{ opacity: 1, transform: "scale\(1\)" \}\}[\s\S]*exit=\{\{ opacity: 0, transform: "scale\(0\.8\)" \}\}[\s\S]*<RovoComposerReasoningSelector/u);
	assert.match(sharedSendControls, /style=\{\{ willChange: "transform, opacity" \}\}/u);
});

test("compact chat can hide the AI cursor control without changing the default", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(sidebarPanel, /hideAiCursor\?: boolean;/u);
	assert.match(sidebarPanel, /hideAiCursor = false/u);
	assert.match(sidebarPanel, /hideAiCursor=\{hideAiCursor\}/u);
	assert.match(sidebarPanel, /clickyActive=\{!hideAiCursor && \(isClickyActive \|\| isLocalConversationActive\)\}/u);
	assert.match(sidebarPanel, /\{hideAiCursor \? null : \([\s\S]*<ClickyOverlay/u);
	assert.match(sidebarPanel, /<ClickyOverlay[\s\S]*paintingActive=\{screenAssistantRegionPainting\}/u);
	assert.match(sidebarPanel, /<ClickyOverlay[\s\S]*responseText=\{clicky\.responseText\}/u);
	assert.match(sidebarPanel, /<ScreenAssistantRegionOverlay[\s\S]*active=\{!hideAiCursor && isClickyActive\}[\s\S]*onPaintingChange=\{setScreenAssistantRegionPainting\}[\s\S]*onRegionChange=\{setScreenAssistantRegion\}/u);
	assert.match(sidebarComposer, /hideAiCursor\?: boolean;/u);
	assert.match(sidebarComposer, /hideAiCursor = false/u);
	assert.match(sidebarComposer, /clickyActive=\{!hideAiCursor && clickyActive\}/u);
	assert.match(sidebarComposer, /onToggleClicky=\{hideAiCursor \? undefined : onToggleClicky\}/u);
	assert.doesNotMatch(sidebarComposer, /<PromptInputButton[\s\S]*aria-label="Rovo cursor"/u);
});

test("shared chat composer disables live voice by default while keeping dictation available", () => {
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const sendControls = readProjectFile("components/projects/shared/components/rovo-composer-send-controls.tsx");

	assert.match(sidebarComposer, /liveVoiceEnabled\?: boolean;/u);
	assert.match(sidebarComposer, /liveVoiceEnabled = false/u);
	assert.match(sidebarComposer, /liveVoiceEnabled: boolean;/u);
	assert.equal((sidebarComposer.match(/liveVoiceEnabled=\{liveVoiceEnabled\}/gu) ?? []).length, 2);
	assert.match(sendControls, /liveVoiceEnabled\?: boolean;/u);
	assert.equal((sendControls.match(/liveVoiceEnabled = false/gu) ?? []).length, 2);
	assert.match(sendControls, /const resolvedRealtimeVoiceActive = realtimeVoiceActive;/u);
	assert.match(sendControls, /canStartDictation: Boolean\(onStartDictation\)/u);
	assert.match(sendControls, /canStartRealtimeVoice: liveVoiceEnabled && Boolean\(onToggleRealtimeVoice\)/u);
	assert.match(sendControls, /const shouldShowDictationStart = Boolean\(onStartDictation\) && !resolvedComposerBusy && !resolvedRealtimeVoiceActive && !submitDisabled;/u);
	assert.match(sendControls, /const shouldShowRealtimeVoiceStart = liveVoiceEnabled && idleAction === "voice-start"/u);
	assert.match(sendControls, /const shouldShowRealtimeVoiceRail = resolvedRealtimeVoiceActive && Boolean\(onToggleClicky\);/u);
	assert.match(sendControls, /\) : resolvedRealtimeVoiceActive \? \(/u);
	assert.match(sendControls, /if \(\(!liveVoiceEnabled && !realtimeVoiceActive\) \|\| !onToggleRealtimeVoice\) \{/u);
	assert.match(sendControls, /<PromptInputDictationControl/u);
});

test("compact chat can hide the AI disclaimer without changing the default", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(sidebarPanel, /hideAiDisclaimer\?: boolean;/u);
	assert.match(sidebarPanel, /hideAiDisclaimer = false/u);
	assert.match(sidebarPanel, /hideAiDisclaimer=\{hideAiDisclaimer\}/u);
	assert.match(sidebarComposer, /hideAiDisclaimer\?: boolean;/u);
	assert.match(sidebarComposer, /hideAiDisclaimer = false/u);
	assert.match(sidebarComposer, /\{hideAiDisclaimer \? null : <Footer \/>\}/u);
});

test("chat surfaces explicitly place empty greetings near the composer by default", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");

	assert.match(sidebarPanel, /emptyGreetingPlacement\?: "centered" \| "near-composer";/u);
	assert.match(sidebarPanel, /emptyGreetingPlacement = "near-composer"/u);
	assert.match(sidebarPanel, /const shouldCenterEmptyGreeting = emptyGreetingPlacement === "centered" && !hasMessages;/u);
	assert.match(sidebarPanel, /shouldCenterAgentTestEmptyState \|\| shouldCenterEmptyGreeting/u);
});

test("compact chat can lock a selected agent identity", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const chatHeader = readProjectFile("components/projects/sidebar-chat/components/chat-header.tsx");

	assert.match(sidebarPanel, /showAgentBackButton\?: boolean;/u);
	assert.match(sidebarPanel, /showAgentSelector\?: boolean;/u);
	assert.match(sidebarPanel, /showAgentBackButton=\{showAgentBackButton\}/u);
	assert.match(sidebarPanel, /showAgentSelector=\{showAgentSelector\}/u);
	assert.match(chatHeader, /showAgentBackButton \? <RovoAgentBackButton onBack=\{onBackToRovo\} \/> : null/u);
	assert.match(chatHeader, /<RovoAppBrand enableAgentSelector=\{showAgentSelector\} \/>/u);
});

test("compact chat cursor activation starts live voice while cursor deactivation leaves live voice running", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const realtimeToggleSource = sourceBetween(sidebarPanel, "const handleToggleRealtimeVoice", "const handleToggleClicky");
	const realtimeRequestSource = sourceBetween(sidebarPanel, "const lastStartRealtimeVoiceRequestKeyRef", "const handleToggleRealtimeVoice");
	const clickyToggleSource = sourceBetween(sidebarPanel, "const handleToggleClicky", "// Cmd+Shift+K");
	const keyboardShortcutSource = sourceBetween(sidebarPanel, "// Cmd+Shift+K", "const isStreamingLifecycleActive");
	const endVoiceSessionSource = sourceBetween(REALTIME_VOICE_HOOK_SOURCE, 'if (message.name === "end_voice_session")', '} else if (message.name === "delegate_to_rovo")');
	const panelEndVoiceSessionSource = sourceBetween(sidebarPanel, "onEndVoiceSession: useCallback", "onToolCall: useCallback");

	assert.match(sidebarPanel, /activate: activateClicky,/u);
	assert.match(sidebarPanel, /const startRealtimeVoice = useCallback\(\(\) => \{[\s\S]*realtimeTranscriptRef\.current = "";[\s\S]*realtime\.connect\(isLocalConversationActive \? \{ explicitResponseOnly: true \} : undefined\);[\s\S]*\}, \[isLocalConversationActive, realtime\]\);/u);

	assert.match(clickyToggleSource, /if \(isClickyActive\) \{[\s\S]*deactivateClicky\(\);[\s\S]*return;[\s\S]*\}/u);
	assert.match(clickyToggleSource, /activateClicky\(\);[\s\S]*if \(realtime\.voiceState === "idle"\) \{[\s\S]*startRealtimeVoice\(\);[\s\S]*\}/u);
	assert.doesNotMatch(clickyToggleSource, /realtime\.disconnect\(\)/u);

	assert.match(realtimeToggleSource, /if \(realtime\.voiceState === "idle"\) \{[\s\S]*startRealtimeVoice\(\);[\s\S]*return;[\s\S]*\}/u);
	assert.match(realtimeToggleSource, /realtime\.disconnect\(\);[\s\S]*deactivateClicky\(\);/u);
	assert.match(realtimeToggleSource, /clearDeferredStartRealtimeVoice\(\);[\s\S]*if \(realtime\.voiceState === "idle"\)/u);
	assert.match(realtimeRequestSource, /const cleanupDeferredStartRealtimeVoiceRef = useRef<\(\(\) => void\) \| null>\(null\);/u);
	assert.match(realtimeRequestSource, /return !navigator\.userActivation\.hasBeenActive;/u);
	assert.match(realtimeRequestSource, /window\.addEventListener\("pointerdown", handleUserActivation, listenerOptions\);/u);
	assert.match(realtimeRequestSource, /window\.addEventListener\("keydown", handleUserActivation, listenerOptions\);/u);
	assert.match(realtimeRequestSource, /if \(!event\.isTrusted\) \{[\s\S]*return;[\s\S]*\}/u);
	assert.doesNotMatch(realtimeRequestSource, /once: true/u);
	assert.match(realtimeRequestSource, /if \(startRealtimeVoiceRequestKey <= 0\) \{[\s\S]*lastStartRealtimeVoiceRequestKeyRef\.current = 0;[\s\S]*clearDeferredStartRealtimeVoice\(\);/u);
	assert.match(realtimeRequestSource, /if \(realtime\.voiceState !== "idle"\) \{[\s\S]*return;[\s\S]*\}/u);
	assert.doesNotMatch(realtimeRequestSource, /if \(isLocalConversationActive\) \{[\s\S]*startRealtimeVoice\(\);/u);
	assert.match(realtimeRequestSource, /if \(shouldDeferRealtimeVoiceStartForUserActivation\(\)\) \{[\s\S]*startRealtimeVoiceAfterUserActivation\(\);[\s\S]*return;/u);
	assert.doesNotMatch(sidebarPanel, /connectRealtimeForClicky/u);
	assert.match(sidebarPanel, /connectRealtime: realtime\.connect/u);
	assert.match(sidebarPanel, /from "@\/components\/projects\/rovo-core\/hooks\/use-realtime-voice";/u);
	assert.match(sidebarPanel, /from "@\/components\/projects\/rovo-core\/hooks\/use-default-clicky-voice";/u);
	assert.match(sidebarPanel, /sessionPolicyMode: "auto"/u);
	assert.doesNotMatch(sidebarPanel, /@\/components\/projects\/rovo\/hooks\/use-realtime-voice/u);
	assert.doesNotMatch(sidebarPanel, /@\/components\/projects\/rovo\/hooks\/use-clicky-voice/u);
	assert.doesNotMatch(REALTIME_VOICE_HOOK_SOURCE, /applyRealtimeConnectionOptions|createRealtimeSessionUpdateConfig/u);
	assert.match(REALTIME_VOICE_HOOK_SOURCE, /if \(activeRef\.current\) \{[\s\S]*return;[\s\S]*\}/u);

	assert.match(keyboardShortcutSource, /if \(e\.key === "K" && e\.shiftKey && \(e\.metaKey \|\| e\.ctrlKey\)\) \{[\s\S]*handleToggleClicky\(\);/u);
	assert.match(keyboardShortcutSource, /if \(e\.key === "Escape" && isClickyActive\) \{[\s\S]*deactivateClicky\(\);/u);
	assert.match(sidebarPanel, /onToggleClicky=\{handleToggleClicky\}/u);
	assert.doesNotMatch(sidebarPanel, /toggleClicky/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /Cursor deactivation must not tear down/u);
	assert.doesNotMatch(CLICKY_VOICE_HOOK_SOURCE, /disconnectRealtime\(\)/u);
	assert.match(REALTIME_VOICE_HOOK_SOURCE, /onEndVoiceSession\?: \(\) => void;/u);
	assert.match(endVoiceSessionSource, /onEndVoiceSessionRef\.current\?\.\(\);[\s\S]*setTimeout\(\(\) => \{[\s\S]*disconnectRef\.current\(\);/u);
	assert.match(panelEndVoiceSessionSource, /realtimeTranscriptRef\.current = "";[\s\S]*deactivateClicky\(\);/u);
});

test("compact chat can keep a generated agent result card visible when the transcript is scripted", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");

	assert.match(sidebarPanel, /interface ChatPanelCardsProps \{[\s\S]*generatedAgentResult\?: RovoDataParts\["agent-result"\] \| null;/u);
	assert.match(sidebarPanel, /const shouldRenderGeneratedAgentFallbackCard = useMemo\(\(\) => \{[\s\S]*const cardAgentId = cards\.generatedAgentResult\.agentId;[\s\S]*const cardAction = cards\.generatedAgentResult\.action;[\s\S]*const messageAgentResult = getMessageAgentResult\(message\);[\s\S]*messageAgentResult\.agentId === cardAgentId[\s\S]*messageAgentResult\.action === cardAction/u);
	assert.match(sidebarPanel, /\{shouldRenderGeneratedAgentFallbackCard && cards\?\.generatedAgentResult \? \([\s\S]*data-testid="rovo-generated-result-group"[\s\S]*<AgentResultCard[\s\S]*agent=\{cards\.generatedAgentResult\}[\s\S]*onSelectAgent=\{handleAgentResultSelect\}/u);
});

test("compact chat streams realtime assistant text into the Clicky response panel", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const assistantDeltaSource = sourceBetween(sidebarPanel, "const handleRealtimeAssistantTextDelta", "const handleRealtimeAssistantTextCompleted");
	const assistantCompletedSource = sourceBetween(sidebarPanel, "const handleRealtimeAssistantTextCompleted", "const handleRealtimeDelegateToRovo");

	assert.match(sidebarPanel, /type RealtimeAssistantTextPayload/u);
	assert.match(sidebarPanel, /const streamClickyAssistantText = useCallback/u);
	assert.match(sidebarPanel, /if \(!isClickyActive\) \{[\s\S]*activateClicky\(\);[\s\S]*\}[\s\S]*clickyStartSpeaking\(text\);/u);
	assert.match(assistantDeltaSource, /streamClickyAssistantText\(text\);/u);
	assert.doesNotMatch(assistantDeltaSource, /if \(!isClickyActive\)/u);
	assert.match(assistantCompletedSource, /const promptText = realtimeTranscriptRef\.current\.trim\(\);/u);
	assert.match(assistantCompletedSource, /const didStreamToClicky = streamClickyAssistantText\(text\);/u);
	assert.match(assistantCompletedSource, /void recordLocalAssistantTurn\(\{[\s\S]*assistantParts: \[\{ type: "text", text, state: "done" \}\],[\s\S]*promptText,[\s\S]*\}\);/u);
	assert.match(assistantCompletedSource, /if \(didStreamToClicky\) \{[\s\S]*clickyAddExchange\(\{ role: "assistant", content: text \}\);/u);
	assert.match(sidebarPanel, /onAssistantTextDelta: handleRealtimeAssistantTextDelta/u);
	assert.match(sidebarPanel, /onAssistantTextCompleted: handleRealtimeAssistantTextCompleted/u);
});

test("compact chat cursor voice uses structured screen tools instead of screenshot POINT parsing", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(CLICKY_VOICE_HOOK_SOURCE, /get_screen_state/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /point_at_target/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /activate_screen_target/u);
	assert.doesNotMatch(CLICKY_VOICE_HOOK_SOURCE, /sendImageInput|captureViewport|\[POINT/u);
	assert.match(sidebarPanel, /createStudioScreenAssistantSnapshot/u);
	assert.match(sidebarPanel, /from "@\/components\/projects\/rovo-core\/lib\/screen-assistant";/u);
	assert.doesNotMatch(sidebarPanel, /@\/components\/projects\/studio\/lib\/studio-screen-assistant/u);
	assert.match(sidebarPanel, /activeRegion: screenAssistantRegion/u);
	assert.match(sidebarPanel, /activeRegion: snapshot\.activeRegion \?\? null/u);
	assert.match(sidebarPanel, /handleScreenAssistantToolCall/u);
	assert.match(sidebarPanel, /onToolCall: useCallback/u);
	assert.match(sidebarPanel, /sendFunctionCallOutputRef\.current = realtime\.sendFunctionCallOutput/u);
	assert.match(sidebarPanel, /activateStudioScreenAssistantTarget\(\{/u);
	assert.match(sidebarPanel, /screenAssistantTargetPrefix="sidebar-composer"/u);
	assert.match(sidebarComposer, /screenAssistantTargetPrefix\?: string;/u);
	assert.match(sidebarComposer, /data-screen-assistant-target=\{screenAssistantTargetPrefix\}/u);
	assert.doesNotMatch(sidebarPanel, /parseClickyResponse|sendImageInput|clickyScreenshotDimensions/u);
});

test("compact chat composer padding can be overridden by opt-in surfaces", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(sidebarPanel, /composerContainerClassName\?: string;/u);
	assert.match(sidebarPanel, /containerClassName=\{composerContainerClassName\}/u);
	assert.match(sidebarComposer, /containerClassName\?: string;/u);
	assert.match(sidebarComposer, /className=\{cn\("relative min-w-0 px-3", containerClassName\)\}/u);
	assert.match(sidebarComposer, /border border-border bg-surface px-3 pb-3 pt-4/u);
});

test("compact chat composer supports an opt-in attached surface header", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(sidebarPanel, /composerSurfaceHeader\?: ReactNode;/u);
	assert.match(sidebarPanel, /composerSurfaceHeader=\{composerSurfaceHeader\}/u);
	assert.match(sidebarComposer, /composerSurfaceHeader\?: ReactNode;/u);
	assert.match(sidebarComposer, /composerSurfaceHeader \? \([\s\S]*rounded-t-xl border border-b-0/u);
	assert.match(sidebarComposer, /composerSurfaceHeader \? "rounded-b-xl border-t-0" : "rounded-xl"/u);
});

test("compact chat composer supports an opt-in left-side surface header tooltip", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const codeReviewRail = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-right-rail.tsx",
	);

	assert.match(sidebarPanel, /composerSurfaceHeaderTooltip\?: ReactNode;/u);
	assert.match(sidebarPanel, /composerSurfaceHeaderTooltip=\{composerSurfaceHeaderTooltip\}/u);
	assert.match(sidebarComposer, /composerSurfaceHeaderTooltip\?: ReactNode;/u);
	assert.match(sidebarComposer, /<TooltipTrigger render=\{surface\} \/>/u);
	assert.match(sidebarComposer, /<TooltipContent side="left">\{content\}<\/TooltipContent>/u);
	assert.match(
		sidebarComposer,
		/composerSurfaceHeader \? \([\s\S]*withComposerSurfaceHeaderTooltip\([\s\S]*composerSurfaceHeaderTooltip/u,
	);
	assert.match(
		codeReviewRail,
		/composerSurfaceHeaderTooltip=\{variantConfig\.supportsLocalSession[\s\S]*Sends your prompt to your local agent\./u,
	);
	assert.doesNotMatch(codeReviewRail, /third-party agent running in the cloud\./u);
});

test("compact chat composer supports opt-in first-render autofocus", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(sidebarPanel, /autoFocusComposer\?: boolean;/u);
	assert.match(sidebarPanel, /autoFocusComposer = false/u);
	assert.match(sidebarPanel, /autoFocus=\{autoFocusComposer\}/u);
	assert.match(sidebarComposer, /autoFocus\?: boolean;/u);
	assert.match(sidebarComposer, /autoFocus = false/u);
	assert.match(sidebarComposer, /<PromptInputTextarea[\s\S]*autoFocus=\{autoFocus\}/u);
});

test("compact chat opts its Rovo composer textarea into visual trace auto-tagging", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const promptInput = readProjectFile("components/ui-custom/prompt-input.tsx");

	assert.match(promptInput, /enableVisualTraceAutoTagging\?: boolean;/u);
	assert.match(promptInput, /prefillMentionRequest\?: \{ mention: RichTextMentionItem; requestKey: number \};/u);
	assert.match(promptInput, /onPrefillMentionConsumed\?: \(requestKey: number\) => void;/u);
	assert.match(promptInput, /onPrefillMentionConsumed\?\.\(requestKey\);/u);
	assert.match(promptInput, /enableVisualTraceAutoTagging = false/u);
	assert.match(sidebarPanel, /composerPrefillRequest\?: \{ mention\?: RichTextMentionItem; text\?: string; requestKey: number \};/u);
	assert.match(sidebarPanel, /if \(!composerPrefillRequest\?\.mention\) \{[\s\S]*setPrompt\(composerPrefillRequest\?\.text \?\? ""\);[\s\S]*\}/u);
	assert.match(sidebarPanel, /onPrefillMentionConsumed=\{onComposerPrefillConsumed\}/u);
	assert.match(sidebarPanel, /prefillMentionRequest=\{[\s\S]*composerPrefillRequest\?\.mention[\s\S]*mention: composerPrefillRequest\.mention,[\s\S]*requestKey: composerPrefillRequest\.requestKey/u);
	assert.match(sidebarComposer, /prefillMentionRequest\?: \{ mention: RichTextMentionItem; requestKey: number \};/u);
	assert.match(sidebarComposer, /onPrefillMentionConsumed\?: \(requestKey: number\) => void;/u);
	assert.match(sidebarComposer, /<PromptInputTextarea[\s\S]*directoryAutocompleteListVisible=\{directoryAutocompleteListVisible\}[\s\S]*enableVisualTraceAutoTagging[\s\S]*onChange=\{\(event\) => onPromptChange\(event\.currentTarget\.value\)\}/u);
	assert.match(sidebarComposer, /<PromptInputTextarea[\s\S]*onPrefillMentionConsumed=\{onPrefillMentionConsumed\}[\s\S]*prefillMentionRequest=\{prefillMentionRequest\}/u);
});

test("Rovo app sources selector opens a reasoning-free customize popover", () => {
	const source = readProjectFile("components/projects/shared/components/composer-card-body.tsx");
	const popoverIndex = source.indexOf("<Popover open={isCustomizeMenuOpen} onOpenChange={handleCustomizeMenuOpenChange}>");
	const preferencesTriggerIndex = source.indexOf("<PopoverTrigger render={<PromptInputPreferencesButton aria-label=\"Customize\" />} />", popoverIndex);
	const customizeMenuIndex = source.indexOf("<CustomizeMenu", preferencesTriggerIndex);
	const showReasoningFalseIndex = source.indexOf("showReasoning={false}", customizeMenuIndex);
	const sendControlsIndex = source.indexOf("<RovoComposerSendControls", showReasoningFalseIndex);

	assert.notEqual(popoverIndex, -1);
	assert.ok(preferencesTriggerIndex > popoverIndex);
	assert.ok(customizeMenuIndex > preferencesTriggerIndex);
	assert.ok(showReasoningFalseIndex > customizeMenuIndex);
	assert.ok(sendControlsIndex > showReasoningFalseIndex);
	assert.match(source, /PromptInputPreferencesButton/u);
	assert.doesNotMatch(source.slice(popoverIndex, customizeMenuIndex), /CustomizeIcon/u);
	assert.doesNotMatch(source.slice(customizeMenuIndex, sendControlsIndex), /showSources=\{false\}/u);
});

test("shared composer auto reasoning button opens a sources-free customize popover", () => {
	const source = readProjectFile("components/projects/shared/components/rovo-composer-send-controls.tsx");
	const popoverIndex = source.indexOf("<Popover open={open} onOpenChange={onOpenChange}>");
	const autoButtonIndex = source.indexOf("<PromptInputAutoButton", popoverIndex);
	const popoverContentIndex = source.indexOf("<PopoverContent", autoButtonIndex);
	const customizeMenuIndex = source.indexOf("<CustomizeMenu", popoverContentIndex);
	const showSourcesFalseIndex = source.indexOf("showSources={false}", customizeMenuIndex);

	assert.notEqual(popoverIndex, -1);
	assert.ok(autoButtonIndex > popoverIndex);
	assert.ok(popoverContentIndex > autoButtonIndex);
	assert.ok(customizeMenuIndex > popoverContentIndex);
	assert.ok(showSourcesFalseIndex > customizeMenuIndex);
	assert.match(source, /const selectedReasoningOption = REASONING_OPTIONS\.find\(\(option\) => option\.id === selectedReasoning\) \?\? REASONING_OPTIONS\[0\]/u);
	assert.match(source, /const selectedReasoningButtonLabel = getReasoningButtonLabel\(selectedReasoningOption\)/u);
	assert.match(source, /aria-label=\{`Reasoning: \$\{selectedReasoningOption\.label\}`\}/u);
	assert.match(source, /\{cloneElement\(selectedReasoningOption\.icon, \{ label: "" \}\)\}/u);
	assert.match(source, /<span>\{selectedReasoningButtonLabel\}<\/span>/u);
	assert.doesNotMatch(source, /onClick=\{\(\) => onReasoningChange\("let-rovo-decide"\)\}/u);
	assert.doesNotMatch(source, /aria-pressed=\{selectedReasoning === "let-rovo-decide"\}/u);
	assert.match(source, /const autoReasoningButtonClassName = \[/u);
	assert.match(source, /className=\{autoReasoningButtonClassName\}/u);
	assert.match(source, /\[&\[aria-expanded=true\]\]:bg-transparent/u);
	assert.match(source, /PromptInputDictationControl/u);
	assert.match(PROMPT_INPUT_DICTATION_SOURCE, /aria-label="Start dictation"/u);
	assert.match(source, /aria-label="Start live voice"/u);
	assert.match(source, /aria-label="Stop live voice"/u);
	assert.match(PROMPT_INPUT_DICTATION_SOURCE, /aria-label="Stop dictation"/u);
	assert.doesNotMatch(PROMPT_INPUT_DICTATION_SOURCE, /aria-label="Accept dictation"/u);
	assert.match(source, /aria-label="Submit"/u);
});

test("shared composer uses one stop control for active dictation", () => {
	const source = readProjectFile("components/projects/shared/components/rovo-composer-send-controls.tsx");

	assert.match(source, /const handleStopDictation = useCallback/u);
	assert.match(source, /<PromptInputDictationControl[\s\S]*onStop=\{handleStopDictation\}/u);
	assert.match(PROMPT_INPUT_DICTATION_SOURCE, /aria-label="Stop dictation"[\s\S]*onClick=\{onStop\}/u);
	assert.doesNotMatch(PROMPT_INPUT_DICTATION_SOURCE, /CheckMarkIcon/u);
	assert.doesNotMatch(PROMPT_INPUT_DICTATION_SOURCE, /onAcceptDictation/u);
});

test("shared composer waveform uses live stream while listening and processing animation otherwise", () => {
	const source = readProjectFile("components/projects/shared/components/rovo-composer-send-controls.tsx");

	assert.match(source, /const isDictationRecording = dictationState === "recording" && micStream !== null;/u);
	assert.match(source, /state=\{isDictationRecording \? "listening" : "processing"\}/u);
	assert.match(PROMPT_INPUT_DICTATION_SOURCE, /const isListening = state === "listening" && mediaStream !== null;/u);
	assert.match(PROMPT_INPUT_DICTATION_SOURCE, /active=\{isListening\}/u);
	assert.match(PROMPT_INPUT_DICTATION_SOURCE, /mediaStream=\{isListening \? mediaStream : null\}/u);
	assert.doesNotMatch(PROMPT_INPUT_DICTATION_SOURCE, /mode=\{isListening \? "scrolling" : "static"\}/u);
	assert.match(source, /const isRealtimeMicWaveformActive = realtimeVoiceState === "listening" && realtimeWaveformState\.active;/u);
	assert.match(source, /const isRealtimeWaveformProcessing = !isRealtimeMicWaveformActive && resolvedRealtimeVoiceActive;/u);
	assert.match(source, /active=\{isRealtimeMicWaveformActive\}/u);
	assert.match(source, /mediaStream=\{isRealtimeMicWaveformActive \? micStream : null\}/u);
	assert.doesNotMatch(source, /mode=\{isRealtimeMicWaveformActive \? "scrolling" : "static"\}/u);
	assert.equal((source.match(/^\s*<ComposerVoiceWaveform\b/gmu) ?? []).length, 2);
	assert.equal((source.match(/mode="static"/gu) ?? []).length, 1);
	assert.equal((PROMPT_INPUT_DICTATION_SOURCE.match(/sensitivity=\{2\.4\}/gu) ?? []).length, 1);
	assert.equal((PROMPT_INPUT_DICTATION_SOURCE.match(/smoothingTimeConstant=\{0\.35\}/gu) ?? []).length, 1);
	assert.equal((PROMPT_INPUT_DICTATION_SOURCE.match(/fftSize=\{512\}/gu) ?? []).length, 1);
	assert.match(source, /const shouldShowRealtimeVoiceRail = resolvedRealtimeVoiceActive && Boolean\(onToggleClicky\);/u);
	assert.match(source, /key="live-voice-active"/u);
	assert.doesNotMatch(source, /live-voice-cursor-active/u);
	assert.match(source, /const ACTION_FRAME_CLASS_NAME = "flex h-9 shrink-0 items-center justify-center";/u);
	assert.match(source, /function ComposerActionFrame/u);
	assert.doesNotMatch(source, /shouldShowRegionPaintControl/u);
	assert.match(source, /"relative flex h-9 w-\[68px\] items-center justify-center overflow-hidden rounded-\[8px\]"/u);
	assert.match(source, /<span aria-hidden="true" className="absolute inset-0 rounded-\[8px\] bg-bg-neutral" \/>/u);
	assert.match(source, /"absolute top-0\.5 right-0\.5 bottom-0\.5 rounded-md bg-bg-neutral-bold shadow-sm transition-\[width\] duration-medium ease-in-out motion-reduce:transition-none"[\s\S]*clickyActive \? "w-16" : "w-8"/u);
	assert.match(source, /<div className="relative z-10 flex h-8 w-16 items-center gap-0">/u);
	assert.doesNotMatch(source, /aria-label="Paint screen area"/u);
	assert.match(source, /<div className="flex h-9 items-center gap-1">[\s\S]*<PromptInputButton[\s\S]*aria-label="Start live voice"[\s\S]*data-screen-assistant-target=\{screenAssistantTargetPrefix \? `\$\{screenAssistantTargetPrefix\}:voice` : undefined\}/u);
	assert.match(source, /className=\{cn\("flex h-9 min-w-0 shrink-0 items-center justify-end gap-1", className\)\}/u);
	assert.doesNotMatch(source, /className="flex h-8 w-16 overflow-hidden rounded-md bg-bg-neutral-bold text-text-inverse shadow-sm"/u);
	assert.doesNotMatch(source, /import \{ RovoCursor \} from "@\/components\/ui-custom\/rovo-cursor";/u);
	assert.match(source, /aria-label="Rovo cursor"[\s\S]*aria-pressed=\{clickyActive\}[\s\S]*"group\/rovo-cursor-button flex size-8 shrink-0 items-center justify-center rounded-md/u);
	assert.match(source, /clickyActive \? \([\s\S]*<RovoCursorTrackingIcon active \/>[\s\S]*\) : \(/u);
	assert.match(source, /clickyActive \? \([\s\S]*<RovoCursorTrackingIcon active \/>[\s\S]*\) : \([\s\S]*<RovoCursorTrackingIcon active=\{false\} \/>[\s\S]*\)/u);
	assert.match(source, /<motion\.button[\s\S]*aria-label="Rovo cursor"/u);
	assert.match(source, /whileHover="hover"/u);
	assert.match(source, /whileTap="tap"/u);
	assert.match(source, /variants=\{shouldReduceMotion \? ROVO_CURSOR_BUTTON_REDUCED_VARIANTS : ROVO_CURSOR_BUTTON_VARIANTS\}/u);
	assert.match(source, /const ROVO_CURSOR_BUTTON_TRANSITION = \{ type: "spring", bounce: 0\.18, visualDuration: 0\.22 \} as const;/u);
	assert.doesNotMatch(source, /ROVO_CURSOR_IDLE_ICON_VARIANTS|ROVO_CURSOR_PREVIEW_ICON_VARIANTS|ROVO_CURSOR_PREVIEW_ICON_REDUCED_VARIANTS/u);
	assert.doesNotMatch(source, /<RovoCursor state="cursor" size=\{16\} \/>/u);
	const cursorButtonStart = source.indexOf('aria-label="Rovo cursor"');
	const cursorButtonSource = source.slice(cursorButtonStart, source.indexOf("</motion.button>", cursorButtonStart));
	assert.doesNotMatch(cursorButtonSource, /hover:bg-bg-neutral/u);
	assert.doesNotMatch(cursorButtonSource, /active:bg-bg-neutral/u);
	assert.doesNotMatch(cursorButtonSource, /group-hover\/rovo-cursor-button/u);
	assert.doesNotMatch(cursorButtonSource, /RovoCursor state="cursor"|data-rovo-cursor/u);
	assert.match(ROVO_CURSOR_SOURCE, /const ARROW_STROKE_OUTSET_PX = 2;/u);
	assert.match(ROVO_CURSOR_SOURCE, /const ARROW_STROKE_WIDTH = ARROW_STROKE_OUTSET_PX \* 2 \* \(ARROW_VIEWBOX \/ 16\);/u);
	assert.match(ROVO_CURSOR_SOURCE, /import \{ token \} from "@\/lib\/tokens";/u);
	assert.match(ROVO_CURSOR_SOURCE, /token\("color\.icon\.accent\.orange"\)[\s\S]*token\("color\.icon\.accent\.lime"\)[\s\S]*token\("color\.icon\.accent\.blue"\)[\s\S]*token\("color\.icon\.accent\.purple"\)/u);
	assert.match(ROVO_CURSOR_SOURCE, /data-rovo-cursor-rainbow-stroke/u);
	assert.match(ROVO_CURSOR_SOURCE, /data-rovo-cursor-body/u);
	assert.match(ROVO_CURSOR_SOURCE, /className="bg-icon"/u);
	assert.match(ROVO_CURSOR_SOURCE, /export type RovoCursorState = "cursor" \| "painting"/u);
	assert.match(ROVO_CURSOR_SOURCE, /<AnimatePresence initial=\{false\} mode="popLayout">/u);
	assert.match(ROVO_CURSOR_SOURCE, /data-rovo-cursor-mode-transition/u);
	assert.match(ROVO_CURSOR_SOURCE, /state === "painting" \? \([\s\S]*<PaintingCursor/u);
	assert.match(ROVO_CURSOR_SOURCE, /data-rovo-cursor-rainbow-fill/u);
	assert.doesNotMatch(ROVO_CURSOR_SOURCE, /data-rovo-cursor-rainbow-halo/u);
	assert.doesNotMatch(ROVO_CURSOR_SOURCE, /borderRadius: barWidth \/ 2/u);
	assert.match(source, /aria-label="Stop live voice"[\s\S]*className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md p-0 text-text-inverse outline-none transition-colors hover:bg-bg-neutral-bold-hovered/u);
	assert.match(source, /function ComposerVoiceWaveform/u);
	assert.match(source, /barCount\?: 4 \| 8;/u);
	assert.match(source, /barCount = 8/u);
	assert.match(source, /className=\{cn\("flex h-full shrink-0 items-center", barCount === 4 \? "w-4" : "w-8"\)\}/u);
	assert.match(source, /barCount=\{barCount\}/u);
	assert.equal((source.match(/barCount=\{4\}/gu) ?? []).length, 2);
	assert.match(LIVE_WAVEFORM_SOURCE, /barCount\?: number/u);
	assert.match(LIVE_WAVEFORM_SOURCE, /barCount: fixedBarCount/u);
	assert.equal((LIVE_WAVEFORM_SOURCE.match(/const barCount = getBarCount\(/gu) ?? []).length, 3);
	assert.match(source, /height="100%"/u);
	assert.doesNotMatch(source, /className="flex size-4 min-w-0 items-center justify-center overflow-hidden"/u);
	assert.doesNotMatch(source, /height="16px"/u);
	assert.doesNotMatch(source, /aria-label="Stop live voice"[\s\S]*CrossIcon/u);
});

test("shared composer keeps dictation beside typed submit and live voice empty-only", () => {
	const source = readProjectFile("components/projects/shared/components/rovo-composer-send-controls.tsx");

	assert.match(source, /const shouldShowDictationStart = Boolean\(onStartDictation\) && !resolvedComposerBusy && !resolvedRealtimeVoiceActive && !submitDisabled;/u);
	assert.match(source, /const shouldShowRealtimeVoiceStart = liveVoiceEnabled && idleAction === "voice-start" && !canSubmit && Boolean\(onToggleRealtimeVoice\);/u);
	assert.match(source, /idleAction === "submit" \|\| idleAction === "voice-start"/u);
	assert.match(source, /\{shouldShowDictationStart \? \([\s\S]*<PromptInputDictationControl[\s\S]*\) : null\}/u);
	assert.match(source, /\{idleAction === "submit" \? \([\s\S]*aria-label="Submit"[\s\S]*\) : null\}/u);
	assert.match(source, /\{shouldShowRealtimeVoiceStart \? \([\s\S]*aria-label="Start live voice"[\s\S]*\) : null\}/u);
});

test("shared composer live chat CTA defaults to brand blue with opt-in dark styling", () => {
	const source = readProjectFile("components/projects/shared/components/rovo-composer-send-controls.tsx");
	const neutralBoldClass = "bg-bg-neutral-bold text-text-inverse hover:bg-bg-neutral-bold-hovered active:bg-bg-neutral-bold-pressed";
	const brandClass = "bg-primary text-primary-foreground [&_svg]:text-primary-foreground hover:bg-primary-hovered active:bg-primary-pressed";
	const submitIndex = source.indexOf('<PromptInputSubmit aria-label="Submit"');
	const dictationStartIndex = PROMPT_INPUT_DICTATION_SOURCE.indexOf('aria-label="Start dictation"');
	const voiceStartIndex = source.indexOf('aria-label="Start live voice"');

	assert.match(source, /experimentalDarkCta\?: boolean/u);
	assert.match(source, /experimentalDarkCta = false/u);
	assert.ok(source.includes(`const EXPERIMENTAL_DARK_CTA_CLASS_NAME = "${neutralBoldClass}"`));
	assert.ok(source.includes(`const BRAND_CTA_CLASS_NAME = "${brandClass}"`));
	// Live chat CTA defaults to the brand-blue primary style; dark styling is opt-in via experimentalDarkCta.
	assert.match(source, /const liveVoiceCtaClassName = experimentalDarkCtaClassName \?\? BRAND_CTA_CLASS_NAME;/u);
	assert.doesNotMatch(source, /LIVE_VOICE_CTA_CLASS_NAME/u);
	assert.doesNotMatch(source, /<TooltipProvider delay=\{0\}>[\s\S]*aria-label="Start live voice"/u);
	assert.match(source, /<PromptInputButton[\s\S]*aria-label="Start live voice"[\s\S]*tooltip=\{\{ content: "Live chat", delay: 0 \}\}/u);
	assert.notEqual(submitIndex, -1);
	assert.notEqual(dictationStartIndex, -1);
	assert.notEqual(voiceStartIndex, -1);
	// Submit dark styling stays opt-in (brand blue by default via the button's default variant).
	assert.match(source.slice(submitIndex, source.indexOf("</PromptInputSubmit>", submitIndex)), /experimentalDarkCtaClassName/u);
	const dictationButtonStartIndex = PROMPT_INPUT_DICTATION_SOURCE.lastIndexOf("<PromptInputButton", dictationStartIndex);
	const dictationButtonSource = PROMPT_INPUT_DICTATION_SOURCE.slice(
		dictationButtonStartIndex,
		PROMPT_INPUT_DICTATION_SOURCE.indexOf("</PromptInputButton>", dictationStartIndex),
	);
	assert.match(dictationButtonSource, /variant="ghost"/u);
	assert.doesNotMatch(dictationButtonSource, /experimentalDarkCtaClassName/u);
	const voiceStartButtonStartIndex = source.lastIndexOf("<PromptInputButton", voiceStartIndex);
	const voiceStartButtonSource = source.slice(voiceStartButtonStartIndex, source.indexOf("</PromptInputButton>", voiceStartIndex));
	assert.doesNotMatch(voiceStartButtonSource, /shadow-sm/u);
	assert.match(voiceStartButtonSource, /liveVoiceCtaClassName/u);
});

test("Rovo composers default reasoning to Auto", () => {
	const sharedMenuData = readProjectFile("components/projects/shared/components/chat-configuration/customize-menu-data.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const rovoComposer = readProjectFile("components/projects/shared/components/composer-card-body.tsx");

	assert.match(sharedMenuData, /export const DEFAULT_REASONING_OPTION_ID = "let-rovo-decide"/u);
	assert.match(sidebarComposer, /useState\(DEFAULT_REASONING_OPTION_ID\)/u);
	assert.match(rovoComposer, /useState\(DEFAULT_REASONING_OPTION_ID\)/u);
	assert.match(rovoComposer, /if \(isPlanMode && selectedReasoning !== "max"\) \{[\s\S]*setSelectedReasoning\("max"\);[\s\S]*\} else if \(!isPlanMode && selectedReasoning === "max"\) \{[\s\S]*setSelectedReasoning\(DEFAULT_REASONING_OPTION_ID\);/u);
	assert.doesNotMatch(sidebarComposer, /useState\("deep-research"\)/u);
	assert.doesNotMatch(rovoComposer, /useState\("deep-research"\)/u);
});

test("sidebar chat shares Max reasoning with the empty-state greeting", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(sidebarPanel, /useState\(DEFAULT_REASONING_OPTION_ID\)/u);
	assert.match(sidebarPanel, /isMaxMode=\{selectedReasoning === "max"\}/u);
	assert.match(sidebarPanel, /onReasoningChange=\{setSelectedReasoning\}/u);
	assert.match(sidebarPanel, /selectedReasoning=\{selectedReasoning\}/u);
	assert.match(sidebarComposer, /selectedReasoning: controlledSelectedReasoning/u);
	assert.match(sidebarComposer, /const selectedReasoning = controlledSelectedReasoning \?\? localSelectedReasoning/u);
	assert.match(sidebarComposer, /const handleReasoningChange = \(value: string\) => \{/u);
	assert.match(sidebarComposer, /onReasoningChange\?\.\(value\)/u);
});

test("sidebar chat and Rovo app composers use the shared Auto plus CTA controls", () => {
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const rovoComposer = readProjectFile("components/projects/shared/components/composer-card-body.tsx");
	const rovoComposerProps = readProjectFile("components/projects/shared/components/rovo-app-composer.tsx");
	const rovoShell = readProjectFile("components/projects/rovo/components/rovo-app-shell.tsx");

	for (const source of [sidebarComposer, rovoComposer]) {
		assert.match(source, /RovoComposerSendControls/u);
		assert.match(source, /dictationState=\{dictationState\}/u);
		assert.match(source, /dictationTranscriptPreview=\{dictationTranscriptPreview\}/u);
		assert.match(source, /onStartDictation=\{onStartDictation\}/u);
		assert.match(source, /onStopDictation=\{onStopDictation\}/u);
		assert.match(source, /onToggleRealtimeVoice=\{onToggleRealtimeVoice\}/u);
		assert.match(source, /experimentalDarkCta=\{experimentalDarkCta\}/u);
		assert.doesNotMatch(source, /<PromptInputSendControls/u);
	}

	// experimentalDarkCta is opt-in (defaults false) — the sidebar owns its own
	// default; the Rovo app default lives on the shared composer's prop surface.
	assert.match(sidebarComposer, /experimentalDarkCta = false/u);
	assert.match(rovoComposerProps, /experimentalDarkCta = false/u);

	assert.match(sidebarPanel, /useRealtimeVoice/u);
	assert.doesNotMatch(sidebarPanel, /useLiveVoice/u);
	assert.match(sidebarPanel, /const dictationCommittedTextRef = useRef<string \| null>\(null\);/u);
	assert.match(sidebarPanel, /appendDictationTranscript\(dictationCommittedTextRef\.current \?\? dictationBaselineRef\.current \?\? "", transcriptText\)/u);
	assert.match(sidebarPanel, /dictationCommittedTextRef\.current = nextText;/u);
	assert.doesNotMatch(sidebarPanel, /setPrompt\(transcriptText\)/u);
	assert.doesNotMatch(sidebarPanel, /transcriptToPreserve/u);
	assert.match(sidebarPanel, /realtime\.connect\(\{ transcriptionOnly: true \}\);/u);
	assert.match(sidebarPanel, /experimentalDarkCta/u);
	assert.match(rovoShell, /experimentalDarkCta/u);
	assert.match(rovoShell, /appendDictationTranscript\(dictationCommittedTextRef\.current \?\? dictationBaselineRef\.current \?\? "", transcript\)/u);
	assert.doesNotMatch(rovoShell, /setVoiceTranscript\(text\)/u);
	assert.doesNotMatch(rovoShell, /setVoiceTranscript\(transcript\)/u);
	assert.doesNotMatch(rovoShell, /transcriptToPreserve/u);
	assert.match(sidebarPanel, /micStream=\{realtime\.micStream\}/u);
	assert.match(sidebarPanel, /dictationState=\{dictationState\}/u);
	assert.match(sidebarPanel, /onStartDictation=\{handleStartDictation\}/u);
	assert.match(sidebarPanel, /realtimeVoiceActive=\{isRealtimeVoiceActive\}/u);
});

test("Rovo app Max reasoning owns plan mode without a separate Task button", () => {
	const rovoComposer = readProjectFile("components/projects/shared/components/composer-card-body.tsx");

	assert.match(rovoComposer, /const handleReasoningChange = useCallback\(\(reasoning: string\) => \{/u);
	assert.match(rovoComposer, /const shouldEnablePlanMode = reasoning === "max"/u);
	assert.match(rovoComposer, /shouldEnablePlanMode !== isPlanMode/u);
	assert.match(rovoComposer, /onReasoningChange=\{handleReasoningChange\}/u);
	assert.match(rovoComposer, /setSelectedReasoning\("max"\)/u);
	assert.doesNotMatch(rovoComposer, /aria-label="Task mode"/u);
	assert.doesNotMatch(rovoComposer, /ScorecardIcon/u);
	assert.doesNotMatch(rovoComposer, /⌥ Tab/u);
});

test("compact chat plus menu reuses the Rovo app attachment actions", () => {
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");
	const rovoAddMenu = readProjectFile("components/projects/shared/components/rovo-app-composer-add-menu.tsx");
	const customItemsIndex = rovoAddMenu.indexOf("{itemsBefore}");
	const uploadItemIndex = rovoAddMenu.indexOf("<PromptInputActionAddAttachments");

	assert.match(sidebarComposer, /addMenuItemsBefore\?: ReactNode;/u);
	assert.match(sidebarComposer, /composerToolsAfterAdd\?: ReactNode;/u);
	assert.match(sidebarComposer, /RovoAppComposerAddMenu/u);
	assert.match(sidebarComposer, /itemsBefore=\{addMenuItemsBefore\}/u);
	assert.match(
		sidebarComposer,
		/<PromptInputActionMenuTrigger aria-label="Add"[\s\S]*<\/PromptInputActionMenu>[\s\S]*\{composerToolsAfterAdd\}/u,
	);
	assert.match(sidebarComposer, /PendingAttachments/u);
	assert.match(sidebarComposer, /usePromptInputAttachments/u);
	assert.match(rovoAddMenu, /itemsBefore\?: ReactNode;/u);
	assert.match(rovoAddMenu, /PromptInputActionAddAttachments/u);
	assert.match(rovoAddMenu, /PromptInputActionAddScreenshot/u);
	assert.ok(customItemsIndex > -1);
	assert.ok(uploadItemIndex > customItemsIndex);
	assert.doesNotMatch(sidebarComposer, /UploadIcon/u);
	assert.doesNotMatch(sidebarComposer, /EyeOpenIcon|Private to you|Visible to space/u);
});

test("compact chat submits add-menu files through the shared Rovo thread queue", () => {
	const submitHook = readProjectFile("components/projects/sidebar-chat/hooks/use-chat-submit.ts");
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const sendChatMessageIndex = context.indexOf("const sendChatMessage = useCallback(");
	const sendPromptIndex = context.indexOf("const sendPrompt = useCallback(");

	assert.match(submitHook, /handleSubmit: \(message: \{ text: string; files: FileUIPart\[\] \}\) => Promise<void>/u);
	assert.match(submitHook, /recordLocalAssistantTurn: \(params: \{[\s\S]*assistantParts: RovoUIMessage\["parts"\];[\s\S]*promptText: string;[\s\S]*\}\) => Promise<void>/u);
	assert.match(submitHook, /await sendPrompt\(promptText, defaultPromptOptions, files\)/u);
	assert.match(context, /files: FileUIPart\[\];/u);
	assert.match(context, /sendPrompt: \(prompt: string, options\?: SendPromptOptions, files\?: ReadonlyArray<FileUIPart>\) => Promise<void>/u);
	assert.ok(sendChatMessageIndex > -1);
	assert.ok(sendPromptIndex > sendChatMessageIndex);
	assert.match(context.slice(sendChatMessageIndex, sendPromptIndex), /files: promptItem\.files/u);
	assert.match(context.slice(sendPromptIndex), /files: promptFiles/u);
});

test("compact chat accepts host-owned input context inside the prompt surface", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarComposer = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(sidebarPanel, /export interface ComposerInputContext \{[\s\S]*content: ReactNode;[\s\S]*submitText: string;[\s\S]*onSubmitStart\?: \(\) => void;[\s\S]*onSubmitted\?: \(\) => void;/u);
	assert.match(sidebarPanel, /composerInputContext\?\.onSubmitStart\?\.\(\);[\s\S]*await handleSubmit\(\{ files, text: promptText \}\);/u);
	assert.match(sidebarPanel, /composerInputContext\?: ComposerInputContext;/u);
	assert.match(sidebarPanel, /const promptText = \(text \|\| prompt\)\.trim\(\) \|\| composerInputContext\?\.submitText\.trim\(\) \|\| "";/u);
	assert.match(sidebarPanel, /await handleSubmit\(\{ files, text: promptText \}\);[\s\S]*composerInputContext\?\.onSubmitted\?\.\(\);/u);
	assert.match(sidebarPanel, /composerInputContext=\{composerInputContext\?\.content\}/u);
	assert.match(sidebarPanel, /hasComposerInputContext=\{composerInputContext !== undefined\}/u);
	assert.match(sidebarComposer, /PromptInputHeader/u);
	assert.match(sidebarComposer, /<PromptInputHeader className="px-2 pb-3 pt-0">[\s\S]*\{composerInputContext\}[\s\S]*<\/PromptInputHeader>/u);
	assert.match(sidebarComposer, /prompt\.trim\(\)\.length > 0 \|\| attachments\.files\.length > 0 \|\| hasComposerInputContext/u);
});

test("compact chat edit context blocks unmatched prompts from normal Rovo chat", () => {
	const sidebarPanel = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const submitHook = readProjectFile("components/projects/sidebar-chat/hooks/use-chat-submit.ts");
	const requireInterceptIndex = submitHook.indexOf("if (requireIntercept) {");
	const sendPromptIndex = submitHook.indexOf("await sendPrompt(promptText, defaultPromptOptions, files)");

	assert.match(sidebarPanel, /requireIntercept: isCollapsibleEditContextBar && isContextBarOpen/u);
	assert.match(sidebarPanel, /isStreamingLifecycleActive \|\| message\.id === localThinkingAssistantMessageId/u);
	assert.match(submitHook, /requiredInterceptReply = DEFAULT_REQUIRED_INTERCEPT_REPLY/u);
	assert.match(submitHook, /localThinkingAssistantMessageId: string \| null/u);
	assert.match(submitHook, /setLocalThinkingAssistantMessageId\(activeAssistantMessageId\);[\s\S]*await waitForInterceptDelay\(delayMs\);/u);
	assert.match(submitHook, /await injectLocalAssistantTurn\(\{[\s\S]*requiredInterceptReply[\s\S]*\}\);[\s\S]*return;/u);
	assert.ok(requireInterceptIndex > -1);
	assert.ok(sendPromptIndex > requireInterceptIndex);
});

test("compact chat local intercept turns ensure a persisted thread before transcript injection", () => {
	const submitHook = readProjectFile("components/projects/sidebar-chat/hooks/use-chat-submit.ts");
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const localTurnIndex = submitHook.indexOf("const injectLocalAssistantTurn = useCallback(");
	const replaceMessagesIndex = submitHook.indexOf("replaceMessages([...baseMessages, userMessage");
	const ensureThreadIndex = submitHook.indexOf("await ensureThreadForLocalTurn(promptText || files[0]?.filename || \"New chat\")");

	assert.match(context, /ensureThreadForLocalTurn: \(seedPrompt: string\) => Promise<string>;/u);
	assert.match(context, /const ensureThreadForLocalTurn = useCallback\([\s\S]*await ensureCompactThread\(seedPrompt\);[\s\S]*void refreshThreads\(\);/u);
	assert.match(submitHook, /ensureThreadForLocalTurn,\s*\} = useRovoChat\(\);/u);
	assert.ok(localTurnIndex > -1);
	assert.ok(ensureThreadIndex > localTurnIndex);
	assert.ok(replaceMessagesIndex > ensureThreadIndex);
});

test("compact chat merges selected custom agent context before queueing prompts", () => {
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const sendPromptIndex = context.indexOf("const sendPrompt = useCallback(");

	assert.match(context, /selectedAgentId: string;/u);
	assert.match(context, /selectedAgent: RovoAgentProfile;/u);
	assert.match(context, /selectableAgents: readonly AgentSelectorAgent\[\];/u);
	assert.match(context, /autoSelectAgentId\?: string;/u);
	assert.match(context, /const autoSelectedAgentIdRef = useRef<string \| null>\(null\);/u);
	assert.match(context, /const selectableAgents = useMemo\(\s*\(\) => buildSelectableAgents\(/u);
	assert.match(context, /selectAgent: \(agentId: string, options\?: SelectAgentOptions\) => void;/u);
	assert.match(context, /resetAgentToRovo: \(options\?: \{ preserveCurrentThread\?: boolean \}\) => void;/u);
	assert.match(context, /const nextAgent = agentProfileById\.get\(autoSelectAgentId\);/u);
	assert.match(context, /mergeSelectedAgentPromptOptions,[\s\S]*\} from "@\/app\/contexts\/rovo-chat-helpers";/u);
	assert.match(ROVO_CHAT_HELPERS_SOURCE, /export function mergeSelectedAgentPromptOptions/u);
	assert.match(ROVO_CHAT_HELPERS_SOURCE, /getRovoAgentPromptContext\(selectedAgent\)/u);
	assert.ok(sendPromptIndex > -1);
	assert.match(
		context.slice(sendPromptIndex),
		/mergeSendPromptOptions\(\s*defaultPromptOptions,\s*mergeSelectedAgentPromptOptions\(options, selectedAgent\)\s*\)/u,
	);
});

test("compact chat registers session-created agents from agent result payloads", () => {
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");

	assert.match(context, /registerSessionAgentFromResult,[\s\S]*type SessionAgentEntry,[\s\S]*\} from "@\/components\/projects\/rovo-core\/lib\/agent-records\/session-agent-registry";/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /createSessionAgentEntryFromResult/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /export function registerSessionAgentFromResult/u);
	assert.match(SESSION_AGENT_TYPES_SOURCE, /interface StudioSessionAgentEntry \{[\s\S]*profile: RovoAgentProfile;[\s\S]*resultKey: string;[\s\S]*\}/u);
	assert.match(context, /const \[sessionAgentEntries, setSessionAgentEntries\] = useState<SessionAgentEntry\[\]>\(\[\]\);/u);
	assert.match(context, /const sessionAgentEntriesRef = useRef<SessionAgentEntry\[\]>\(\[\]\);/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /export function createSessionAgentEntryFromResult\(params: \{[\s\S]*agentResult: RovoDataParts\["agent-result"\];[\s\S]*lastTouchedAt: number;[\s\S]*\}\): StudioSessionAgentEntry \| null/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /sourceKey\?: string;/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const payloadResultKey = getCreatedAgentResultKey\(payload\);/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const resultKey = params\.sourceKey[\s\S]*\? `\$\{params\.sourceKey\}:\$\{payloadResultKey\}`[\s\S]*: payloadResultKey;/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /params\.sessionAgentEntries\.find\(\s*\(entry\) => entry\.resultKey === resultKey\s*\)/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /const existingEntry = entries\.find\(\(item\) => item\.resultKey === entry\.resultKey\);/u);
	assert.match(context, /\.\.\.staticAgentProfiles,[\s\S]*\.\.\.normalizedSessionAgentEntries\.map\(\(entry\) => entry\.profile\)/u);
	assert.match(context, /buildSelectableAgents\(\s*agentProfiles \?\? ROVO_AGENT_SELECTOR_AGENTS,\s*normalizedSessionAgentEntries,\s*\)/u);
	assert.match(ROVO_CHAT_HELPERS_SOURCE, /export function buildSelectableAgents\([\s\S]*sessionEntries\.map\(\(entry\) => \[[\s\S]*toAgentSelectorAgent\(entry\.profile\)/u);
	assert.match(context, /registerCreatedAgentFromResult: \([\s\S]*agentResult: RovoDataParts\["agent-result"\],[\s\S]*options\?: RegisterCreatedAgentOptions[\s\S]*\) => RovoAgentProfile \| null;/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /lastTouchedAt = Date\.now\(\)/u);
	assert.match(context, /const result = registerSessionAgentFromResult\(\{[\s\S]*agentResult,[\s\S]*entries: sessionAgentEntriesRef\.current,[\s\S]*sourceKey: options\?\.sourceKey,[\s\S]*staticAgentProfiles,[\s\S]*\}\);/u);
	assert.match(context, /applySessionAgentMutation\(result,[\s\S]*silentSave: result\.created && options\?\.silentSave,/u);
	assert.match(context, /sourceKey: options\?\.sourceKey,/u);
});

test("compact chat exposes normalized Untitled agent names for session-created agents", () => {
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const contextsIndex = readProjectFile("app/contexts/index.ts");

	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const SESSION_AGENT_DEFAULT_NAME = "Untitled agent";/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const SESSION_AGENT_LEGACY_DEFAULT_NAME = "New agent";/u);
	assert.match(
		SESSION_AGENT_ENTRY_SOURCE,
		/const name = getNonEmptyString\(result\.name\) === SESSION_AGENT_LEGACY_DEFAULT_NAME[\s\S]*\? ""[\s\S]*: result\.name;/u,
	);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /export function getStudioSessionAgentDisplayName/u);
	assert.match(contextsIndex, /getStudioSessionAgentDisplayName,[\s\S]*\} from "@\/components\/projects\/rovo-core\/lib\/agent-records\/session-agent-entry";/u);
	assert.match(context, /const normalizedSessionAgentEntries = useMemo\(/u);
	assert.match(context, /\.\.\.normalizedSessionAgentEntries\.map\(\(entry\) => entry\.profile\)/u);
	assert.match(context, /buildSelectableAgents\([\s\S]*normalizedSessionAgentEntries/u);
	assert.match(context, /sessionAgentEntriesRef\.current = normalizedSessionAgentEntries;/u);
	assert.match(context, /persistSessionAgentEntries\(sessionAgentEntriesRef\.current\.map\(normalizeSessionAgentEntry\)\);/u);
	assert.match(context, /sessionAgentEntries: normalizedSessionAgentEntries,/u);
	assert.match(contextsIndex, /getStudioSessionAgentDisplayName,/u);
});

test("compact chat suffixes duplicate session-created agent ids and names", () => {
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /function getSuffixedSessionAgentId\([\s\S]*reservedIds: ReadonlySet<string>[\s\S]*\): string \{[\s\S]*let suffix = 2;[\s\S]*while \(reservedIds\.has\(`\$\{baseId\}-\$\{suffix\}`\)\) \{[\s\S]*return `\$\{baseId\}-\$\{suffix\}`;/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /function getSuffixedSessionAgentName\([\s\S]*reservedNames: ReadonlySet<string>[\s\S]*\): string \{[\s\S]*let suffix = 2;[\s\S]*while \(reservedNames\.has\(`\$\{baseName\} \$\{suffix\}`\.toLowerCase\(\)\)\) \{[\s\S]*return `\$\{baseName\} \$\{suffix\}`;/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const id = getSuffixedSessionAgentId\(baseId, reservedIds\);/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const explicitName = getPayloadString\(payload, \["name", "agentName", "title"\]\);/u);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const name = explicitName[\s\S]*\? getSuffixedSessionAgentName\(baseName, reservedNames\)[\s\S]*: SESSION_AGENT_DEFAULT_NAME;/u);
});

test("created agents without an explicit avatar get a deterministic one stamped at creation", () => {
	// Regression: every newly created agent (from-scratch or AI-generated) used
	// to fall back to a single fixed avatar, so they all looked identical. The
	// avatar is now stamped once at creation from the shared full set when none
	// is supplied, and persisted onto the result so it stays stable across edits.
	// Generated session entries derive it from identity so streamed result cards
	// and persisted profiles agree without sharing mutable state.
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /import \{ getDeterministicAgentAvatarSrc \} from "@\/lib\/agent-avatars";/u);
	assert.match(
		SESSION_AGENT_ENTRY_SOURCE,
		/const hasExplicitAvatar = Boolean\([\s\S]*getPayloadString\(normalizedResult as AgentResultPayload, \["avatarSrc", "avatarUrl", "iconSrc"\]\)[\s\S]*\);/u,
	);
	assert.match(SESSION_AGENT_ENTRY_SOURCE, /const avatarSeed = getPayloadString\(normalizedResult as AgentResultPayload, \["agentId", "id", "name"\]\);/u);
	assert.match(
		SESSION_AGENT_ENTRY_SOURCE,
		/const agentResult: RovoDataParts\["agent-result"\] = hasExplicitAvatar[\s\S]*\? normalizedResult[\s\S]*: \{ \.\.\.normalizedResult, avatarSrc: getDeterministicAgentAvatarSrc\(avatarSeed\) \};/u,
	);
});

test("compact chat resets the visible conversation when switching agents", () => {
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const resetChatIndex = context.indexOf("const resetChat = useCallback(");
	const selectAgentIndex = context.indexOf("const selectAgent = useCallback(", resetChatIndex);
	const resetAgentToRovoIndex = context.indexOf("const resetAgentToRovo = useCallback(", selectAgentIndex);

	assert.ok(resetChatIndex > -1);
	assert.ok(selectAgentIndex > resetChatIndex);
	assert.ok(resetAgentToRovoIndex > selectAgentIndex);
	assert.match(
		context,
		/const selectedAgentIdRef = useRef\(ROVO_AGENT_ID\);[\s\S]*const setSelectedAgentIdState = useCallback\(\(nextAgentId: string\) => \{[\s\S]*selectedAgentIdRef\.current = nextAgentId;[\s\S]*setSelectedAgentId\(nextAgentId\);[\s\S]*\}, \[\]\);/u,
	);
	assert.match(
		context.slice(selectAgentIndex, resetAgentToRovoIndex),
		/if \(nextAgent\.id === selectedAgentIdRef\.current\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setSelectedAgentIdState\(nextAgent\.id\);[\s\S]*if \(!options\?\.preserveCurrentThread\) \{[\s\S]*resetChat\(\);[\s\S]*\}/u,
	);
	assert.match(
		context.slice(resetAgentToRovoIndex),
		/if \(selectedAgentIdRef\.current === ROVO_AGENT_ID\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setSelectedAgentIdState\(ROVO_AGENT_ID\);[\s\S]*resetChat\(\);/u,
	);
});

test("compact chat can select a created agent while preserving the current thread", () => {
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const registerIndex = context.indexOf("const registerCreatedAgentFromResult = useCallback(");
	const resetAgentToRovoIndex = context.indexOf("const resetAgentToRovo = useCallback(", registerIndex);

	assert.ok(registerIndex > -1);
	assert.ok(resetAgentToRovoIndex > registerIndex);
	assert.match(
		context.slice(registerIndex, resetAgentToRovoIndex),
		/if \(options\?\.select && entry\.profile\.id !== selectedAgentIdRef\.current\) \{[\s\S]*setSelectedAgentIdState\(entry\.profile\.id\);[\s\S]*if \(!options\.preserveCurrentThread\) \{[\s\S]*resetChat\(\);[\s\S]*\}/u,
	);
});

test("compact chat resolves pending clarification tools before queueing clarification answers", () => {
	const context = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const sendPromptIndex = context.indexOf("const sendPrompt = useCallback(");

	assert.match(context, /isClarificationResolutionPrompt,[\s\S]*markPendingClarificationResolvedInMessages,[\s\S]*\} from "@\/app\/contexts\/rovo-chat-helpers";/u);
	assert.match(ROVO_CHAT_HELPERS_SOURCE, /markClarificationToolResolved/u);
	assert.match(ROVO_CHAT_HELPERS_SOURCE, /appendTurnCompleteToLastAssistantMessage/u);
	assert.match(ROVO_CHAT_HELPERS_SOURCE, /export function isClarificationResolutionPrompt\(options: SendPromptOptions \| undefined\): boolean/u);
	assert.match(ROVO_CHAT_HELPERS_SOURCE, /options\?\.messageMetadata\?\.source === "clarification-submit"/u);
	assert.ok(sendPromptIndex > -1);
	assert.match(
		context.slice(sendPromptIndex),
		/if \(isClarificationResolutionPrompt\(resolvedOptions\)\) \{[\s\S]*setMessages\(\(prev\) =>[\s\S]*markPendingClarificationResolvedInMessages\(prev, resolvedOptions\)/u,
	);
});
