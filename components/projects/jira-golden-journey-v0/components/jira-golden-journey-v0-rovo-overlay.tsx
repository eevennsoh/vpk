"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useRovoChatControls } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import RovoFloatingChat from "@/components/projects/rovo-floating-chat/components/rovo-floating-chat";
import type {
	ChatSubmitInterceptOutcome,
	ComposerInputContext,
} from "@/components/projects/sidebar-chat/page";
import FloatingRovoButton from "@/components/projects/shared/components/floating-rovo-button";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";

interface AsxRovoOverlayProps {
	chatContextBar?: ChatContextBarDescriptor | null;
	externalThinkingMessageId?: string | null;
	/**
	 * Opt-in host element for the embedded launcher. When supplied the launcher
	 * portals into that element and positions against it instead of the
	 * viewport, so hosts that own a dialog surface can keep the button inside
	 * their own bounds. Defaults to `document.body` (viewport-fixed).
	 */
	launcherContainer?: HTMLElement | null;
	/** Right/bottom inset for the embedded launcher within `launcherContainer`. */
	launcherPlacement?: { right: string; bottom: string };
	composerInputContext?: ComposerInputContext;
	/** Optional host-owned controls rendered immediately after the Add menu trigger. */
	composerToolsAfterAdd?: ReactNode;
	sendPromptOptions?: SendPromptOptions;
	onInterceptSubmit?: (text: string) => ChatSubmitInterceptOutcome;
	onLauncherClick?: () => void;
	onQuestionAnswer?: () => void;
	placement?: "embedded" | "floating";
	launcher?: "auto" | "hidden";
}

function useGenuineFloatingChatAutoFocus(
	chatSurface: ReturnType<typeof useRovoChatControls>["chatSurface"],
): boolean {
	const [focusState, setFocusState] = useState({
		surface: chatSurface,
		autoFocus: false,
	});

	// Autofocus belongs to a genuine chat open; remounting a temporarily hidden
	// floating surface must preserve the focus owned by its host.
	if (focusState.surface !== chatSurface) {
		setFocusState({
			surface: chatSurface,
			autoFocus: focusState.surface === null && chatSurface === "floating",
		});
	}

	return focusState.autoFocus;
}

/** Keeps ASX Rovo surfaces in their requested viewport or embedded stacking context. */
export function AsxRovoOverlay({
	chatContextBar,
	externalThinkingMessageId,
	launcherContainer,
	launcherPlacement,
	composerInputContext,
	composerToolsAfterAdd,
	sendPromptOptions,
	onInterceptSubmit,
	onLauncherClick,
	onQuestionAnswer,
	placement = "floating",
	launcher = "auto",
}: Readonly<AsxRovoOverlayProps>): React.ReactNode {
	const { chatSurface } = useRovoChatControls();
	const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
	const autoFocusComposer = useGenuineFloatingChatAutoFocus(chatSurface);
	const showClosedLauncher = launcher === "auto" && chatSurface === null;

	useEffect(() => {
		setPortalRoot(document.body);
	}, []);

	const handleQuestionAnswer = useCallback(() => ({
		handled: Boolean(onQuestionAnswer),
		assistantReply: onQuestionAnswer ? "Thanks — I’ll continue with that direction." : undefined,
		delayMs: 0,
		onApply: onQuestionAnswer,
	}), [onQuestionAnswer]);

	const content = (
		<>
			{showClosedLauncher && placement === "floating" ? (
				<FloatingRovoButton
					ariaLabel="Open Rovo chat"
					forceVisible
					onButtonClick={onLauncherClick}
					product="home"
				/>
			) : null}
			<AnimatePresence>
				{chatSurface === "floating" ? (
					<RovoFloatingChat
						key="floating-chat"
						autoFocusComposer={autoFocusComposer}
						chatContextBar={chatContextBar}
						composerInputContext={composerInputContext}
						composerToolsAfterAdd={composerToolsAfterAdd}
						externalThinkingMessageId={externalThinkingMessageId}
						hideComposerSourceAndModelControls
						interceptClarificationAnswers={Boolean(onInterceptSubmit || onQuestionAnswer)}
						markAnsweredQuestionTraces
						onInterceptSubmit={onInterceptSubmit ?? (onQuestionAnswer ? handleQuestionAnswer : undefined)}
						sendPromptOptions={sendPromptOptions}
						showAgentBackButton={false}
						showAgentSelector={false}
						showChatHistory={false}
						showNewChatButton={false}
						suppressCustomAgentTabs
						placement={placement}
					/>
				) : null}
			</AnimatePresence>
		</>
	);

	if (placement === "embedded") {
		const launcherHost = launcherContainer ?? portalRoot;
		return (
			<>
				{launcherHost && showClosedLauncher ? createPortal(
					<FloatingRovoButton
						ariaLabel="Open Rovo chat"
						forceVisible
						onButtonClick={onLauncherClick}
						placement={launcherContainer ? launcherPlacement : undefined}
						positioning={launcherContainer ? "container" : "viewport"}
						product="home"
					/>,
					launcherHost,
				) : null}
				{content}
			</>
		);
	}

	return portalRoot ? createPortal(content, portalRoot) : null;
}
