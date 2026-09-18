"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { token } from "@/lib/tokens";
import { useRovoChat } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import type { ChatSurfaceSwitchHandler } from "@/components/projects/shared/components/chat-surface-switcher";
import type { RichTextMentionItem } from "@/components/ui-custom/rich-text-editor";
import ChatPanel from "@/components/projects/sidebar-chat/page";
import type {
	ChatPanelCustomAgentTabs,
	ChatPanelGreetingProps,
	ChatSubmitInterceptOutcome,
	ComposerInputContext,
} from "@/components/projects/sidebar-chat/page";
import { ChatHistoryDrawer } from "@/components/projects/sidebar-chat/components/chat-history-drawer";
import FloatingChatHeader from "./floating-chat-header";

interface RovoFloatingChatProps {
	placement?: "embedded" | "floating";
	onSurfaceSwitch?: ChatSurfaceSwitchHandler;
	autoFocusComposer?: boolean;
	chatContextBar?: ChatContextBarDescriptor | null;
	composerPrefillRequest?: { mention: RichTextMentionItem; requestKey: number };
	onComposerPrefillConsumed?: (requestKey: number) => void;
	greeting?: ChatPanelGreetingProps;
	customAgentTabs?: ChatPanelCustomAgentTabs;
	hideComposerSourceAndModelControls?: boolean;
	sendPromptOptions?: SendPromptOptions;
	/** One-turn composer pill context (Code Review / Activity comments). */
	composerInputContext?: ComposerInputContext;
	/** Optional host-owned controls rendered immediately after the Add menu trigger. */
	composerToolsAfterAdd?: ReactNode;
	onInterceptSubmit?: (text: string) => ChatSubmitInterceptOutcome;
	onArtifactDialogOpen?: () => void;
	preserveFloatingSurfaceOnArtifactDialogOpen?: boolean;
	startRealtimeVoiceRequestKey?: number;
	externalThinkingMessageId?: string | null;
	interceptClarificationAnswers?: boolean;
	markAnsweredQuestionTraces?: boolean;
	showAgentBackButton?: boolean;
	showAgentSelector?: boolean;
	showChatHistory?: boolean;
	showNewChatButton?: boolean;
	suppressCustomAgentTabs?: boolean;
	/** Optional classes for the chrome row so a host can align it to adjacent page chrome. */
	headerClassName?: string;
	/** 24px chrome — Pulse matches the insight eyebrow row. */
	compactHeader?: boolean;
}

export default function RovoFloatingChat({
	placement = "floating",
	onSurfaceSwitch,
	autoFocusComposer = false,
	chatContextBar,
	composerPrefillRequest,
	onComposerPrefillConsumed,
	greeting,
	customAgentTabs,
	hideComposerSourceAndModelControls = false,
	sendPromptOptions,
	composerInputContext,
	composerToolsAfterAdd,
	onInterceptSubmit,
	onArtifactDialogOpen,
	preserveFloatingSurfaceOnArtifactDialogOpen = false,
	startRealtimeVoiceRequestKey = 0,
	externalThinkingMessageId,
	interceptClarificationAnswers = false,
	markAnsweredQuestionTraces = false,
	showAgentBackButton = true,
	showAgentSelector = true,
	showChatHistory = true,
	showNewChatButton = true,
	suppressCustomAgentTabs = false,
	headerClassName,
	compactHeader = false,
}: Readonly<RovoFloatingChatProps>) {
	const { closeChat, isHistoryOpen, resetChat, toggleHistory } = useRovoChat();
	const shouldReduceMotion = useReducedMotion() ?? false;
	const embedded = placement === "embedded";

	return (
		<motion.div
			aria-label={embedded ? "Agent chat" : undefined}
			initial={embedded || shouldReduceMotion ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={embedded ? { opacity: 1, y: 0 } : { opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
			transition={embedded || shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0, 0.4, 0, 1] }}
			className={embedded
				? "absolute inset-0 z-10 flex min-h-0 w-full flex-col overflow-visible border-l border-border bg-surface-overlay"
				: "fixed right-6 bottom-6 z-[560] flex max-h-[min(720px,calc(100dvh-96px))] w-[400px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl bg-surface-overlay"}
			data-rovo-chat-placement={placement}
			role={embedded ? "region" : undefined}
			style={embedded
				? { boxShadow: "none" }
				: { boxShadow: token("elevation.shadow.overlay"), willChange: "transform, opacity" }}
		>
			<FloatingChatHeader
				className={headerClassName}
				compact={compactHeader}
				isHistoryOpen={isHistoryOpen}
				onClose={closeChat}
				onHistoryToggle={toggleHistory}
				onNewChat={resetChat}
				onSurfaceSwitch={onSurfaceSwitch}
				showAgentBackButton={showAgentBackButton}
				showAgentSelector={showAgentSelector}
				showChatHistory={showChatHistory}
				showMoreButton={!embedded}
				showNewChatButton={showNewChatButton}
			/>
			<div className={embedded ? "min-h-0 min-w-0 flex-1 overflow-visible" : "min-h-0 min-w-0 overflow-hidden"}>
				<ChatPanel
					onClose={closeChat}
					autoFocusComposer={autoFocusComposer}
					hideHeader
					abortOnUnmount={false}
					containerClassName={embedded ? "h-full min-h-0 min-w-0 overflow-visible" : "min-h-0 min-w-0"}
					containerStyle={{
						backgroundColor: "transparent",
						borderRadius: 0,
						borderWidth: 0,
						display: "flex",
						flexDirection: "column",
						height: embedded ? "100%" : "auto",
						maxHeight: embedded ? "none" : "calc(min(720px, calc(100dvh - 96px)) - 56px)",
						...(embedded ? { overflow: "visible" as const } : {}),
					}}
					greeting={greeting}
					customAgentTabs={customAgentTabs}
					hideComposerSourceAndModelControls={hideComposerSourceAndModelControls}
					sendPromptOptions={sendPromptOptions}
					composerInputContext={composerInputContext}
					composerToolsAfterAdd={composerToolsAfterAdd}
					onInterceptSubmit={onInterceptSubmit}
					onSurfaceSwitch={onSurfaceSwitch}
					chatContextBar={chatContextBar}
					composerPrefillRequest={composerPrefillRequest}
					onComposerPrefillConsumed={onComposerPrefillConsumed}
					onArtifactDialogOpen={onArtifactDialogOpen}
					preserveFloatingSurfaceOnArtifactDialogOpen={preserveFloatingSurfaceOnArtifactDialogOpen}
					startRealtimeVoiceRequestKey={startRealtimeVoiceRequestKey}
					externalThinkingMessageId={externalThinkingMessageId}
					interceptClarificationAnswers={interceptClarificationAnswers}
					markAnsweredQuestionTraces={markAnsweredQuestionTraces}
					suppressCustomAgentTabs={suppressCustomAgentTabs}
				/>
			</div>
			{showChatHistory ? <ChatHistoryDrawer /> : null}
		</motion.div>
	);
}
