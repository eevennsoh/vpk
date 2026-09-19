"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import RovoFloatingChat from "@/components/projects/rovo-floating-chat/components/rovo-floating-chat";
import type { ChatSubmitInterceptOutcome } from "@/components/projects/sidebar-chat/page";
import FloatingRovoButton from "@/components/projects/shared/components/floating-rovo-button";
import type { FloatingRovoButtonInsightsConfig } from "@/components/projects/shared/components/floating-rovo-button";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import type { RichTextMentionItem } from "@/components/ui-custom/rich-text-editor";

interface JgpRovoOverlayProps {
	chatContextBar?: ChatContextBarDescriptor | null;
	composerPrefillRequest?: { mention: RichTextMentionItem; requestKey: number };
	onComposerPrefillConsumed?: (requestKey: number) => void;
	externalThinkingMessageId?: string | null;
	/**
	 * Hide the viewport floating chat. Work-item and Pulse Insights surfaces
	 * that already embed chat also hide it via `data-jira-work-item-open` /
	 * `data-jira-pulse-open`.
	 */
	chat?: "auto" | "hidden";
	/**
	 * The "N new insights since your last visit" affordance the launcher grows
	 * into. `null` leaves it a plain chat launcher.
	 */
	insights?: FloatingRovoButtonInsightsConfig | null;
	/** Hide the viewport FAB. Embedded chrome also hides it via the same flags. */
	launcher?: "auto" | "hidden";
	onInterceptSubmit?: (text: string) => ChatSubmitInterceptOutcome;
	onLauncherClick?: () => void;
	onQuestionAnswer?: () => void;
}

/** Keeps JGP Rovo surfaces in the viewport stacking context above the Gallery dock. */
export function JgpRovoOverlay({
	chatContextBar,
	composerPrefillRequest,
	onComposerPrefillConsumed,
	externalThinkingMessageId,
	chat = "auto",
	insights = null,
	launcher = "auto",
	onInterceptSubmit,
	onLauncherClick,
	onQuestionAnswer,
}: Readonly<JgpRovoOverlayProps>): React.ReactNode {
	const { chatSurface } = useRovoChatControls();
	const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
	const [isRovoCanvasOpen, setIsRovoCanvasOpen] = useState(false);
	const [isEmbeddedHostOpen, setIsEmbeddedHostOpen] = useState(false);
	const [composerFocusState, setComposerFocusState] = useState({
		surface: chatSurface,
		autoFocus: false,
	});

	useEffect(() => {
		setPortalRoot(document.body);

		const updateChromeFlags = () => {
			setIsRovoCanvasOpen(document.documentElement.dataset.rovoCanvasOpen === "true");
			setIsEmbeddedHostOpen(
				document.documentElement.dataset.jiraWorkItemOpen === "true"
				|| document.documentElement.dataset.jiraPulseOpen === "true",
			);
		};
		updateChromeFlags();

		const observer = new MutationObserver(updateChromeFlags);
		observer.observe(document.documentElement, {
			attributeFilter: ["data-jira-work-item-open", "data-jira-pulse-open", "data-rovo-canvas-open"],
			attributes: true,
		});

		return () => observer.disconnect();
	}, []);

	const handleQuestionAnswer = useCallback(() => ({
		handled: Boolean(onQuestionAnswer),
		assistantReply: onQuestionAnswer ? "Thanks — I’ll continue with that direction." : undefined,
		delayMs: 0,
		onApply: onQuestionAnswer,
	}), [onQuestionAnswer]);

	const showLauncher = launcher === "auto"
		&& chatSurface === null
		&& !isRovoCanvasOpen
		&& !isEmbeddedHostOpen;
	const showFloatingChat = chat === "auto"
		&& chatSurface === "floating"
		&& !isEmbeddedHostOpen;

	// Autofocus belongs to a genuine chat open; host visibility changes must
	// preserve their own focus restoration when floating chat remounts.
	if (composerFocusState.surface !== chatSurface || (composerFocusState.autoFocus && !showFloatingChat)) {
		setComposerFocusState({
			surface: chatSurface,
			autoFocus: composerFocusState.surface === null && showFloatingChat,
		});
	}

	if (!portalRoot) return null;

	return createPortal(
		<>
			{showLauncher ? (
				<FloatingRovoButton
					ariaLabel="Open Rovo chat"
					forceVisible
					insights={insights}
					onButtonClick={onLauncherClick}
					product="home"
				/>
			) : null}
			<AnimatePresence>
				{showFloatingChat ? (
					<RovoFloatingChat
						key="floating-chat"
						autoFocusComposer={composerFocusState.autoFocus}
						chatContextBar={chatContextBar}
						composerPrefillRequest={composerPrefillRequest}
						onComposerPrefillConsumed={onComposerPrefillConsumed}
						externalThinkingMessageId={externalThinkingMessageId}
						hideComposerSourceAndModelControls
						interceptClarificationAnswers={Boolean(onInterceptSubmit || onQuestionAnswer)}
						onInterceptSubmit={onInterceptSubmit ?? (onQuestionAnswer ? handleQuestionAnswer : undefined)}
						showAgentBackButton={false}
						showAgentSelector={false}
						showChatHistory={false}
						showNewChatButton={false}
						suppressCustomAgentTabs
					/>
				) : null}
			</AnimatePresence>
		</>,
		portalRoot,
	);
}
