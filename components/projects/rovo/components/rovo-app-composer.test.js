const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const WRAPPER_SOURCE = fs.readFileSync(path.join(__dirname, "rovo-app-composer.tsx"), "utf8");
const SHELL_SOURCE = fs.readFileSync(path.join(__dirname, "rovo-app-shell.tsx"), "utf8");
const CLICKY_VOICE_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-default-clicky-voice.ts"),
	"utf8",
);
const CLICKY_VOICE_CORE_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-clicky-voice.ts"),
	"utf8",
);
const REALTIME_VOICE_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-realtime-voice.ts"),
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
const REGION_OVERLAY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/screen-assistant/screen-assistant-region-overlay.tsx"),
	"utf8",
);
const ROVO_CURSOR_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/rovo-cursor.tsx"),
	"utf8",
);

function sourceBetween(source, startNeedle, endNeedle) {
	const start = source.indexOf(startNeedle);
	const end = source.indexOf(endNeedle, start);

	assert.notEqual(start, -1, `Missing source marker: ${startNeedle}`);
	assert.notEqual(end, -1, `Missing source marker: ${endNeedle}`);
	return source.slice(start, end);
}

test("Rovo RovoAppComposer wrapper renders the shared composer with card chrome", () => {
	assert.match(WRAPPER_SOURCE, /from "@\/components\/projects\/shared\/components\/rovo-app-composer"/u);
	assert.match(WRAPPER_SOURCE, /chrome="card"/u);
});

test("RovoAppShell adds side gutter for the compact artifact composer", () => {
	assert.match(SHELL_SOURCE, /isArtifactOpen \? "max-w-none px-3" : "max-w-\[800px\]"/u);
});

test("RovoAppShell caps directory autocomplete to eight for the fullscreen two-column grid", () => {
	assert.match(SHELL_SOURCE, /const ROVO_APP_DIRECTORY_AUTOCOMPLETE_LIMIT = 8;/u);
	assert.match(SHELL_SOURCE, /directoryAutocompleteLimit=\{ROVO_APP_DIRECTORY_AUTOCOMPLETE_LIMIT\}/u);
});

test("RovoAppShell wires dictation separately from realtime live voice", () => {
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

test("RovoAppShell imports screen-assistant helpers from rovo-core", () => {
	assert.match(SHELL_SOURCE, /from "@\/components\/projects\/rovo-core\/lib\/screen-assistant"/u);
	assert.doesNotMatch(SHELL_SOURCE, /from "@\/components\/projects\/studio\/lib\/studio-screen-assistant"/u);
});

test("Rovo cursor activation starts live voice while cursor deactivation leaves live voice running", () => {
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
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /Cursor deactivation must not tear down/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /useClickyVoiceCore/u);
	assert.match(CLICKY_VOICE_CORE_HOOK_SOURCE, /isClickyActive &&[\s\S]*isRealtimeConnected &&[\s\S]*!hasInjectedPromptRef\.current/u);
	assert.doesNotMatch(CLICKY_VOICE_CORE_HOOK_SOURCE, /connectedForCursorRef\.current &&[\s\S]*!hasInjectedPromptRef\.current/u);
	assert.doesNotMatch(CLICKY_VOICE_HOOK_SOURCE, /disconnectRealtime\(\)/u);
	assert.match(REALTIME_VOICE_HOOK_SOURCE, /onEndVoiceSession\?: \(\) => void;/u);
	assert.match(endVoiceSessionSource, /onEndVoiceSessionRef\.current\?\.\(\);[\s\S]*setTimeout\(\(\) => \{[\s\S]*disconnectRef\.current\(\);/u);
	assert.match(shellEndVoiceSessionSource, /manualVoiceStopRef\.current = true;[\s\S]*setVoiceTranscript\(null\);/u);
	assert.doesNotMatch(shellEndVoiceSessionSource, /deactivateClicky\(\)/u);
});

test("Rovo cursor voice uses structured screen tools instead of screenshot POINT parsing", () => {
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /get_screen_state/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /point_at_target/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /activate_screen_target/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /activeRegion/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /targetHints inside activeRegion/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /activeRegion\.targetHints contains the Studio agent instructions field/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /call apply_agent_draft_patch with patch\.instructions/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /Treat patch\.instructions as a complete replacement body/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /Do not use set_composer_text for painted instructions updates/u);
	assert.match(CLICKY_VOICE_HOOK_SOURCE, /You CANNOT see images or screenshots/u);
	assert.doesNotMatch(CLICKY_VOICE_HOOK_SOURCE, /sendImageInput|captureViewport|\[POINT/u);
	assert.match(SHELL_SOURCE, /createStudioScreenAssistantSnapshot/u);
	assert.match(SHELL_SOURCE, /ScreenAssistantRegionOverlay/u);
	assert.match(SHELL_SOURCE, /activeRegion: screenAssistantRegion/u);
	assert.match(SHELL_SOURCE, /activeRegion: snapshot\.activeRegion \?\? null/u);
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
	assert.match(SHELL_SOURCE, /handleScreenAssistantToolCall/u);
	assert.match(SHELL_SOURCE, /onToolCall: useCallback/u);
	assert.match(SHELL_SOURCE, /sendFunctionCallOutputRef\.current = realtime\.sendFunctionCallOutput/u);
	assert.match(SHELL_SOURCE, /activateStudioScreenAssistantTarget\(\{/u);
	assert.match(SHELL_SOURCE, /screenAssistantTargetPrefix="rovo-composer"/u);
	assert.match(SHELL_SOURCE, /case "apply_agent_draft_patch": \{[\s\S]*respond\(\{ ok: false, error: "unsupported_surface" \}\);/u);
	assert.doesNotMatch(SHELL_SOURCE, /parseClickyResponse|sendImageInput|clickyScreenshotDimensions/u);
	assert.doesNotMatch(CLICKY_OVERLAY_SOURCE, /screenshotDimensions/u);
});

test("Rovo cursor overlay streams assistant text only through the cursor tooltip", () => {
	const assistantDeltaSource = sourceBetween(SHELL_SOURCE, "onAssistantTextDelta: useCallback", "onAssistantTextCompleted: useCallback");
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
	assert.match(assistantDeltaSource, /\[ensureRealtimeAssistantMessage, updateRealtimeMessage, streamClickyAssistantText\]/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /label\?: string \| null;/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /const trimmedLabel = label\?\.trim\(\);/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /data-clicky-response-overlay-label/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /\{trimmedLabel\}/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /const displayedText = useTypewriterText\(text\);/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /\{displayedText\}[\s\S]*<\/div>/u);
	assert.match(CLICKY_RESPONSE_OVERLAY_SOURCE, /window\.setInterval/u);
});

test("RovoAppShell clears shell-owned prefill sources only after submit succeeds", () => {
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
		/await realtimeChat\.submitPrompt\(\{[\s\S]*?\}\);\s*clearPrefillSources\(\);/u,
	);
});
