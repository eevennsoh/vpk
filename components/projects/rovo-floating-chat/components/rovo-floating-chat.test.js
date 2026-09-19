const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const SOURCE_FILE = path.join(__dirname, "rovo-floating-chat.tsx");
const ROVO_FLOATING_CHAT_SOURCE = fs.readFileSync(SOURCE_FILE, "utf8");
const FLOATING_CHAT_HEADER_SOURCE = fs.readFileSync(path.join(__dirname, "floating-chat-header.tsx"), "utf8");
const CHAT_PANEL_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/projects/sidebar-chat/page.tsx"), "utf8");
const STREAMING_THINKING_INDICATOR_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/projects/shared/components/streaming-thinking-indicator.tsx"), "utf8");
const CHAIN_OF_THOUGHT_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/ui-custom/chain-of-thought.tsx"), "utf8");
const REASONING_LABELS_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/projects/shared/lib/reasoning-labels.ts"), "utf8");

async function loadRovoFloatingChatHarness() {
	const mockModules = new Map([
		[
			"react",
			`
				import * as ReactActual from "react";
				export * from "react";
				export default ReactActual;

				export const ViewTransition = ReactActual.ViewTransition ?? function ViewTransition(props) {
					return ReactActual.createElement(ReactActual.Fragment, null, props.children);
				};
			`,
		],
		[
			"motion/react",
			`
				import React from "react";

				 export const motion = {
					div({ initial, animate, exit, transition, ...props }) {
						return React.createElement("div", {
							...props,
							"data-motion": "div",
						});
					},
				 };

				export function useReducedMotion() {
					return false;
				}
			`,
		],
		[
			"@/app/contexts",
			`
				export function useRovoChat() {
					return {
						closeChat() {},
						isHistoryOpen: false,
						resetChat() {},
						switchSurface() {
							throw new Error("RovoFloatingChat should not switch surfaces while rendering.");
						},
						toggleHistory() {},
						uiMessages: [
							{
								id: "message-1",
								role: "user",
								parts: [{ type: "text", text: "Existing message" }],
							},
						],
					};
				}
			`,
		],
		[
			"@/components/projects/sidebar-chat/components/chat-history-drawer",
			`
				import React from "react";

				export function ChatHistoryDrawer() {
					return React.createElement("div", {
						"data-testid": "floating-history-drawer",
					});
				}
			`,
		],
		[
			"@/lib/tokens",
			`
				export function token() {
					return "token-value";
				}
			`,
		],
		[
			"@/components/projects/sidebar-chat/page",
			`
				import React from "react";

				export default function ChatPanel(props) {
					return React.createElement(
						"section",
						{
							"data-testid": "shared-chat-panel",
							"data-hide-header": String(props.hideHeader),
							"data-abort-on-unmount": String(props.abortOnUnmount),
							"data-auto-focus-composer": String(props.autoFocusComposer),
							"data-context-label": props.chatContextBar?.label ?? "",
							"data-context-icon": props.chatContextBar?.iconName ?? "",
							"data-greeting-labels": props.greeting?.suggestions?.map((suggestion) => suggestion.label).join("|") ?? "",
							"data-greeting-hero": String(props.greeting?.showHero),
							"data-hide-composer-controls": String(props.hideComposerSourceAndModelControls),
							"data-send-context": props.sendPromptOptions?.contextDescription ?? "",
							"data-has-custom-agent-tabs": String(Boolean(props.customAgentTabs)),
							"data-has-artifact-dialog-open": String(typeof props.onArtifactDialogOpen === "function"),
							"data-has-intercept-submit": String(typeof props.onInterceptSubmit === "function"),
							"data-preserve-artifact-dialog": String(props.preserveFloatingSurfaceOnArtifactDialogOpen),
							"data-suppress-custom-agent-tabs": String(props.suppressCustomAgentTabs),
							"data-start-realtime-key": String(props.startRealtimeVoiceRequestKey),
							"data-external-thinking-message-id": props.externalThinkingMessageId ?? "",
							className: props.containerClassName,
						},
						"Shared chat panel",
					);
				}
			`,
		],
		[
			"./floating-chat-header",
			`
				import React from "react";

				export default function FloatingChatHeader(props) {
					return React.createElement("header", {
						"data-testid": "floating-chat-header",
						"data-has-new-chat": String(typeof props.onNewChat === "function"),
						"data-show-agent-back-button": String(props.showAgentBackButton),
						"data-show-agent-selector": String(props.showAgentSelector),
						"data-show-chat-history": String(props.showChatHistory),
						"data-show-more-button": String(props.showMoreButton),
						"data-show-new-chat-button": String(props.showNewChatButton),
					});
				}
			`,
		],
	]);

	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToStaticMarkup } from "react-dom/server";
				import RovoFloatingChat from "./components/projects/rovo-floating-chat/components/rovo-floating-chat.tsx";

				export function renderFloatingChat() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat));
				}

				export function renderEmbeddedChat() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						placement: "embedded",
					}));
				}

				export function renderFloatingChatWithContext() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						chatContextBar: {
							label: "RFP-101: Prepare for bid recommendation for ESM RFP",
							iconName: "work-item",
							signature: "agents-work-item:RFP-101",
						},
					}));
				}

				export function renderFloatingChatWithAutoFocus() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						autoFocusComposer: true,
					}));
				}

				export function renderFloatingChatWithHiddenComposerControls() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						hideComposerSourceAndModelControls: true,
					}));
				}

				export function renderFloatingChatWithSendPromptOptions() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						sendPromptOptions: {
							contextDescription: "Studio agent edit context",
						},
					}));
				}

				export function renderFloatingChatWithArtifactLifecycle() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						onArtifactDialogOpen() {},
						preserveFloatingSurfaceOnArtifactDialogOpen: true,
					}));
				}

				export function renderFloatingChatWithIntercept() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						onInterceptSubmit() {
							return { handled: true, assistantReply: "Done" };
						},
					}));
				}

				export function renderFloatingChatWithRealtimeStartRequest() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						startRealtimeVoiceRequestKey: 3,
					}));
				}

				export function renderFloatingChatWithExternalThinkingMessageId() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						externalThinkingMessageId: "asx-thinking-message",
					}));
				}

				export function renderFloatingChatWithoutAgentBackButton() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						showAgentBackButton: false,
					}));
				}

				export function renderFloatingChatWithRestrictedAgentHeader() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						showAgentBackButton: false,
						showAgentSelector: false,
						showChatHistory: false,
						showNewChatButton: false,
					}));
				}

				export function renderFloatingChatWithGreeting() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						greeting: {
							showHero: true,
							suggestions: [
								{
									id: "translate-text",
									label: "Find related RFPs",
									type: "skill",
								},
							],
						},
					}));
				}

				export function renderFloatingChatWithCustomAgentTabs() {
					return renderToStaticMarkup(React.createElement(RovoFloatingChat, {
						customAgentTabs: {
							trigger: React.createElement("div", null, "Trigger content"),
							activity: React.createElement("div", null, "Activity content"),
						},
					}));
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "rovo-floating-chat-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "rovo-floating-chat-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (args.namespace === "rovo-floating-chat-test-mock") {
							return undefined;
						}

						if (!mockModules.has(args.path)) {
							return undefined;
						}

						return {
							path: args.path,
							namespace: "rovo-floating-chat-test-mock",
						};
					});

					build.onLoad(
						{ filter: /.*/, namespace: "rovo-floating-chat-test-mock" },
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

test("RovoFloatingChat renders the shared chat panel inside the floating shell", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChat();

	assert.match(markup, /data-testid="floating-chat-header"/);
	assert.match(markup, /data-has-new-chat="true"/);
	assert.match(markup, /data-show-agent-back-button="true"/);
	assert.match(markup, /data-show-agent-selector="true"/);
	assert.match(markup, /data-show-chat-history="true"/);
	assert.match(markup, /data-show-more-button="true"/);
	assert.match(markup, /data-show-new-chat-button="true"/);
	assert.match(markup, /data-testid="floating-history-drawer"/);
	assert.match(markup, /data-testid="shared-chat-panel"/);
	assert.match(markup, /data-hide-header="true"/);
	assert.match(markup, /data-abort-on-unmount="false"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /z-\[560\]/u);
});

test("RovoFloatingChat can render a fixed single-thread agent header", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithRestrictedAgentHeader();

	assert.match(markup, /data-show-agent-back-button="false"/);
	assert.match(markup, /data-show-agent-selector="false"/);
	assert.match(markup, /data-show-chat-history="false"/);
	assert.match(markup, /data-show-new-chat-button="false"/);
	assert.doesNotMatch(markup, /data-testid="floating-history-drawer"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /showAgentSelector\?: boolean;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /showChatHistory\?: boolean;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /showNewChatButton\?: boolean;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /compactHeader\?: boolean;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /compact=\{compactHeader\}/u);
	assert.match(FLOATING_CHAT_HEADER_SOURCE, /<RovoAppBrand[\s\S]*enableAgentSelector=\{showAgentSelector\}/u);
	assert.match(FLOATING_CHAT_HEADER_SOURCE, /const iconSize = compact \? "icon-compact" : "icon"/u);
	assert.match(FLOATING_CHAT_HEADER_SOURCE, /showChatHistory \? \([\s\S]*<ChatHistoryButton/u);
	assert.match(FLOATING_CHAT_HEADER_SOURCE, /showNewChatButton \? \(/u);
});

test("RovoFloatingChat can fill an embedded owner instead of using viewport positioning", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderEmbeddedChat();

	assert.match(markup, /class="absolute inset-0 z-10 flex min-h-0 w-full flex-col overflow-visible border-l border-border/);
	assert.match(markup, /aria-label="Agent chat"/);
	assert.match(markup, /data-rovo-chat-placement="embedded"/);
	assert.match(markup, /data-show-more-button="false"/);
	assert.match(markup, /role="region"/);
	assert.doesNotMatch(markup, /fixed right-6 bottom-6/);
	assert.match(markup, /class="h-full min-h-0 min-w-0 overflow-visible"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /height: embedded \? "100%" : "auto"/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /maxHeight: embedded \? "none"/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /initial=\{embedded \|\| shouldReduceMotion \? false/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /transition=\{embedded \|\| shouldReduceMotion \? \{ duration: 0 \}/u);
	assert.match(FLOATING_CHAT_HEADER_SOURCE, /showMoreButton \? \([\s\S]*<DropdownMenu/u);
});

test("RovoFloatingChat can suppress the custom-agent back button", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithoutAgentBackButton();

	assert.match(markup, /data-show-agent-back-button="false"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /showAgentBackButton\?: boolean;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /showAgentBackButton=\{showAgentBackButton\}/u);
	assert.match(FLOATING_CHAT_HEADER_SOURCE, /showAgentBackButton \? <RovoAgentBackButton \/> : null/u);
});

test("RovoFloatingChat bounds the shared chat panel inside an overflow-hidden scroll frame", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChat();

	assert.match(markup, /class="min-h-0 min-w-0 overflow-hidden"/);
	assert.match(markup, /data-testid="shared-chat-panel"[^>]+class="min-h-0 min-w-0"/);
});

test("RovoFloatingChat forwards context bar descriptor to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithContext();

	assert.match(markup, /data-context-label="RFP-101: Prepare for bid recommendation for ESM RFP"/);
	assert.match(markup, /data-context-icon="work-item"/);
});

test("RovoFloatingChat forwards opt-in composer autofocus to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const defaultMarkup = harness.renderFloatingChat();
	const autoFocusMarkup = harness.renderFloatingChatWithAutoFocus();

	assert.match(defaultMarkup, /data-auto-focus-composer="false"/u);
	assert.match(autoFocusMarkup, /data-auto-focus-composer="true"/u);
});

test("RovoFloatingChat forwards composer source and model control visibility to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const defaultMarkup = harness.renderFloatingChat();
	const hiddenControlsMarkup = harness.renderFloatingChatWithHiddenComposerControls();

	assert.match(defaultMarkup, /data-hide-composer-controls="false"/);
	assert.match(hiddenControlsMarkup, /data-hide-composer-controls="true"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /hideComposerSourceAndModelControls\?: boolean;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /hideComposerSourceAndModelControls=\{hideComposerSourceAndModelControls\}/u);
});

test("RovoFloatingChat forwards send prompt options to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithSendPromptOptions();

	assert.match(markup, /data-send-context="Studio agent edit context"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /sendPromptOptions\?: SendPromptOptions;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /sendPromptOptions=\{sendPromptOptions\}/u);
});

test("RovoFloatingChat forwards composer input context to the shared chat panel", () => {
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /composerInputContext\?: ComposerInputContext;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /composerInputContext=\{composerInputContext\}/u);
});

test("RovoFloatingChat forwards composer tools after Add to the shared chat panel", () => {
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /composerToolsAfterAdd\?: ReactNode;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /composerToolsAfterAdd=\{composerToolsAfterAdd\}/u);
});

test("RovoFloatingChat forwards deterministic submit interception to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithIntercept();

	assert.match(markup, /data-has-intercept-submit="true"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /onInterceptSubmit\?: \(text: string\) => ChatSubmitInterceptOutcome;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /onInterceptSubmit=\{onInterceptSubmit\}/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /interceptClarificationAnswers=\{interceptClarificationAnswers\}/u);
});

test("RovoFloatingChat forwards live voice start requests to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithRealtimeStartRequest();

	assert.match(markup, /data-start-realtime-key="3"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /startRealtimeVoiceRequestKey\?: number;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /startRealtimeVoiceRequestKey = 0/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /startRealtimeVoiceRequestKey=\{startRealtimeVoiceRequestKey\}/u);
	assert.match(CHAT_PANEL_SOURCE, /startRealtimeVoiceRequestKey\?: number;/u);
	assert.match(CHAT_PANEL_SOURCE, /startRealtimeVoiceRequestKey = 0/u);
	assert.match(CHAT_PANEL_SOURCE, /const lastStartRealtimeVoiceRequestKeyRef = useRef\(0\);/u);
	assert.match(CHAT_PANEL_SOURCE, /lastStartRealtimeVoiceRequestKeyRef\.current = startRealtimeVoiceRequestKey;[\s\S]*realtime\.voiceState !== "idle"[\s\S]*startRealtimeVoice\(\);/u);
});

test("RovoFloatingChat forwards an external thinking message id to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithExternalThinkingMessageId();

	assert.match(markup, /data-external-thinking-message-id="asx-thinking-message"/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /externalThinkingMessageId\?: string \| null;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /externalThinkingMessageId=\{externalThinkingMessageId\}/u);
});

test("RovoFloatingChat forwards custom agent tab content to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithCustomAgentTabs();

	assert.match(markup, /data-has-custom-agent-tabs="true"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /customAgentTabs\?: ChatPanelCustomAgentTabs;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /customAgentTabs=\{customAgentTabs\}/u);
});

test("RovoFloatingChat can suppress the automatic custom agent tab bar", () => {
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /suppressCustomAgentTabs\?: boolean;/u);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /suppressCustomAgentTabs=\{suppressCustomAgentTabs\}/u);
});

test("RovoFloatingChat forwards artifact dialog lifecycle to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithArtifactLifecycle();

	assert.match(markup, /data-has-artifact-dialog-open="true"/);
	assert.match(markup, /data-preserve-artifact-dialog="true"/);
});

test("RovoFloatingChat forwards greeting unchanged to the shared chat panel", async () => {
	const harness = await loadRovoFloatingChatHarness();
	const markup = harness.renderFloatingChatWithGreeting();

	assert.match(markup, /data-greeting-labels="Find related RFPs"/);
	assert.match(markup, /data-greeting-hero="true"/);
});

test("Floating chat shell hugs content until it reaches the viewport-bounded max-height", () => {
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /max-h-\[min\(720px,calc\(100dvh-96px\)\)\]/);
	assert.doesNotMatch(ROVO_FLOATING_CHAT_SOURCE, /\sh-\[min\(720px,calc\(100dvh-96px\)\)\]/);
});

test("Floating chat panel receives a bounded max-height without forcing empty-state height", () => {
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /: "min-h-0 min-w-0 overflow-hidden"}[\s\S]*<ChatPanel/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /: "min-h-0 min-w-0"}/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /display: "flex"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /flexDirection: "column"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /height: embedded \? "100%" : "auto"/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /maxHeight: embedded \? "none" : "calc\(min\(720px, calc\(100dvh - 96px\)\) - 56px\)"/);
	assert.doesNotMatch(ROVO_FLOATING_CHAT_SOURCE, /gridTemplateRows: "minmax\(0, 1fr\) auto"/);
});

test("Floating chat keeps chrome and composer outside the scrollable message viewport", () => {
	assert.match(
		FLOATING_CHAT_HEADER_SOURCE,
		/className=\{cn\("relative z-10 flex shrink-0 items-center justify-between px-3 py-3", className\)\}/,
	);
	assert.match(CHAT_PANEL_SOURCE, /<Conversation\s+className="min-h-0 min-w-0 flex-1"/);
	assert.match(CHAT_PANEL_SOURCE, /<div className="min-w-0 shrink-0">[\s\S]*<ChatComposer/);
	assert.match(CHAT_PANEL_SOURCE, /<div className="shrink-0">[\s\S]*<ChatHeader/);
});

test("Embedded chat lets the composer glow paint past the shell", () => {
	assert.match(
		ROVO_FLOATING_CHAT_SOURCE,
		/\? "absolute inset-0 z-10 flex min-h-0 w-full flex-col overflow-visible/,
	);
	assert.match(
		ROVO_FLOATING_CHAT_SOURCE,
		/embedded \? "min-h-0 min-w-0 flex-1 overflow-visible"/,
	);
	assert.match(
		ROVO_FLOATING_CHAT_SOURCE,
		/embedded \? "h-full min-h-0 min-w-0 overflow-visible"/,
	);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /\.\.\.\(embedded \? \{ overflow: "visible" as const \} : \{\}\)/);
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /: "min-h-0 min-w-0 overflow-hidden"}/);
});

test("Floating chat header does not force an always-on scroll fade", () => {
	// Conversation owns the top/bottom scroll masks and only reveals them when
	// the thread overflows and the user has scrolled away from an edge.
	assert.doesNotMatch(FLOATING_CHAT_HEADER_SOURCE, /StickyRowScrollFade/u);
	assert.doesNotMatch(FLOATING_CHAT_HEADER_SOURCE, /floating-chat-header-scroll-fade/u);
});

test("Shared ChatPanel renders the Rovo-style conversation body and scroll button", () => {
	assert.match(CHAT_PANEL_SOURCE, /ConversationScrollButton/);
	assert.match(CHAT_PANEL_SOURCE, /scrollFollowMode/);
	assert.match(CHAT_PANEL_SOURCE, /isGenerationActive: isStreamingLifecycleActive/);
	assert.match(CHAT_PANEL_SOURCE, /followMode=\{scrollFollowMode\}/);
	assert.match(CHAT_PANEL_SOURCE, /enableTargetFollow: chatSurface !== "floating"/);
	assert.match(CHAT_PANEL_SOURCE, /resize=\{isStreamingLifecycleActive \? "instant" : "smooth"\}/);
	assert.match(CHAT_PANEL_SOURCE, /resizeTarget=\{isStreamingLifecycleActive \? "bottom" : "follow"\}/);
	assert.match(
		CHAT_PANEL_SOURCE,
		/className=\{cn\(\s*"mx-auto flex min-w-0 max-w-\[800px\] flex-col gap-4 px-4 py-6 md:gap-6",\s*conversationContentClassName\s*\)\}/,
	);
	assert.match(
		CHAT_PANEL_SOURCE,
		/<ConversationScrollButton className="z-10 transition-all" \/>/,
	);
});

test("Shared ChatPanel renders an optimistic user bubble before the SDK echoes a submitted compact prompt", () => {
	assert.match(CHAT_PANEL_SOURCE, /appendOptimisticCompactUserMessage/u);
	assert.match(CHAT_PANEL_SOURCE, /activePrompt/u);
	assert.match(CHAT_PANEL_SOURCE, /const optimisticPrompt = activePrompt \?\? \(isSubmitPending \? queuedPrompts\[0\] \?\? null : null\);/u);
	assert.match(CHAT_PANEL_SOURCE, /uiMessages: messages/u);
});

test("Floating chat thinking status uses ChainOfThought dots without literal ellipsis labels", () => {
	assert.match(CHAT_PANEL_SOURCE, /<StreamingThinkingIndicator/);
	assert.match(STREAMING_THINKING_INDICATOR_SOURCE, /ChainOfThoughtHeader/);
	assert.match(STREAMING_THINKING_INDICATOR_SOURCE, /ChainOfThoughtStep/);
	assert.match(STREAMING_THINKING_INDICATOR_SOURCE, /defaultOpen=\{false\}/);
	assert.doesNotMatch(STREAMING_THINKING_INDICATOR_SOURCE, /phaseProps\.defaultOpen \?\? hasDetails/);
	assert.doesNotMatch(STREAMING_THINKING_INDICATOR_SOURCE, /AdsReasoningTrigger/);
	assert.doesNotMatch(STREAMING_THINKING_INDICATOR_SOURCE, /<Reasoning/);
	assert.match(
		CHAIN_OF_THOUGHT_SOURCE,
		/const shouldShowAnimatedDots =\s*resolvedState === "preload" \|\| resolvedState === "thinking";/
	);
	assert.match(CHAIN_OF_THOUGHT_SOURCE, /shouldShowAnimatedDots && typeof text === "string"[\s\S]*stripTrailingDots\(text\)/);
	assert.match(REASONING_LABELS_SOURCE, /preloadShimmer: "Thinking"/);
	assert.doesNotMatch(REASONING_LABELS_SOURCE, /Rovo is cooking/);
});

test("Floating chat compact empty greeting does not force a full-height message area", () => {
	assert.match(CHAT_PANEL_SOURCE, /const shouldHugEmptyGreeting = !hasMessages && greeting\?\.showHero === false/);
	assert.match(CHAT_PANEL_SOURCE, /const shouldUseNaturalEmptyGreeting = shouldHugEmptyGreeting \|\| isAgentTestEmptyState/);
	assert.match(CHAT_PANEL_SOURCE, /const shouldUseAutoMessageTrack = shouldUseNaturalEmptyGreeting && containerStyle\?\.display === "grid"/);
	assert.match(CHAT_PANEL_SOURCE, /gridTemplateRows: "auto auto"/);
	assert.match(CHAT_PANEL_SOURCE, /: hasMessages \|\| shouldUseNaturalEmptyGreeting\s*\? "flex-start"\s*: "flex-end"/u);
	assert.match(CHAT_PANEL_SOURCE, /minHeight: isAgentTestEmptyState \? "100%" : shouldUseNaturalEmptyGreeting \? "auto" : "100%"/u);
	assert.match(CHAT_PANEL_SOURCE, /<div className="w-full" style=\{chatStyles\.emptyState\}>/);
	assert.doesNotMatch(CHAT_PANEL_SOURCE, /<div className="w-\[90%\]" style=\{chatStyles\.emptyState\}>/);
});

test("ChatPanel keeps floating chat mounted while an artifact dialog replaces a work item modal", () => {
	assert.match(CHAT_PANEL_SOURCE, /const ARTIFACT_DIALOG_FLOATING_PIN_REASON = "sidebar-chat-artifact-dialog"/);
	assert.match(CHAT_PANEL_SOURCE, /preserveFloatingSurfaceOnArtifactDialogOpen &&\s*chatSurface === "floating"/);
	assert.match(CHAT_PANEL_SOURCE, /pinFloating\(ARTIFACT_DIALOG_FLOATING_PIN_REASON\)/);
	assert.match(CHAT_PANEL_SOURCE, /unpinFloating\(ARTIFACT_DIALOG_FLOATING_PIN_REASON\)/);
	assert.match(CHAT_PANEL_SOURCE, /onArtifactDialogOpen\?\.\(artifact\)/);
	assert.match(CHAT_PANEL_SOURCE, /onDialogClose=\{releaseArtifactDialogFloatingPin\}/);
});

test("RovoFloatingChat does not auto-promote submitted or existing messages to the sidebar", () => {
	assert.match(ROVO_FLOATING_CHAT_SOURCE, /<ChatPanel/);
	assert.doesNotMatch(ROVO_FLOATING_CHAT_SOURCE, /switchSurface\("sidebar"\)/);
	assert.doesNotMatch(ROVO_FLOATING_CHAT_SOURCE, /uiMessages/);
	assert.doesNotMatch(ROVO_FLOATING_CHAT_SOURCE, /useChatSubmit/);
	assert.doesNotMatch(ROVO_FLOATING_CHAT_SOURCE, /ChatGreeting/);
	assert.doesNotMatch(ROVO_FLOATING_CHAT_SOURCE, /ChatComposer/);
});
