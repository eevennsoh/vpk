import type { CSSProperties } from "react";
import { chatStyles } from "../data/styles";
import type { ChatPanelGreetingProps, ChatPanelProps } from "./chat-panel-types";

const COMPACT_CHAT_WIDTH_MAX = 520;
const REGULAR_CHAT_WIDTH_MAX = 900;

/**
 * Footprint of a single-line chat context bar (the "Edit:" pill above the
 * sidebar composer): the pill's `py-2` + small-icon line height (~36px) plus
 * its `mb-3` bottom margin (12px). The bottom-aligned Test greeting reserves
 * this much space below its last starter so it lines up with the sibling Ask
 * Rovo greeting, whose composer carries that context bar. Keep in sync with
 * `ContextBar` in components/ui-custom/context-bar/context-bar.tsx.
 */
const CONTEXT_BAR_RESERVED_SPACE_PX = 48;
/**
 * Vertical gap the Test layout inserts between the conversation track and the
 * composer (the `gap-3` on the empty-state wrapper below). The sibling Ask Rovo
 * composer has no such gap, so the bottom-aligned Test greeting subtracts it
 * from its reserved space to keep its last starter level with the Ask Rovo one.
 * Keep in sync with the `gap-3` on the agent-test empty-state wrapper.
 */
const AGENT_TEST_COMPOSER_GAP_PX = 12;

export type SmartWidthClass = "compact" | "regular" | "wide";

export function getSmartWidthClass(widthPx: number): SmartWidthClass {
	if (widthPx <= COMPACT_CHAT_WIDTH_MAX) return "compact";
	if (widthPx <= REGULAR_CHAT_WIDTH_MAX) return "regular";
	return "wide";
}

export interface ChatPanelLayoutInput {
	composerReservesContextBarSpace: boolean;
	containerStyle?: CSSProperties;
	emptyGreetingPlacement: NonNullable<ChatPanelProps["emptyGreetingPlacement"]>;
	greeting?: ChatPanelGreetingProps;
	hasMessages: boolean;
	/** True while a collapsible "Edit:" context bar is collapsed, which hides the greeting. */
	isEditContextBarCollapsed: boolean;
	showAgentTestControls: boolean;
}

export interface ChatPanelLayout {
	isAgentTestEmptyState: boolean;
	messagesContainerStyle: CSSProperties;
	resolvedContainerStyle?: CSSProperties;
	resolvedGreeting?: ChatPanelGreetingProps;
}

export function resolveChatPanelLayout({
	composerReservesContextBarSpace,
	containerStyle,
	emptyGreetingPlacement,
	greeting,
	hasMessages,
	isEditContextBarCollapsed,
	showAgentTestControls,
}: Readonly<ChatPanelLayoutInput>): ChatPanelLayout {
	const resolvedGreeting = isEditContextBarCollapsed ? undefined : greeting;
	const isAgentTestEmptyState = showAgentTestControls && !hasMessages;
	// Bottom-align the Test greeting so its last conversation starter lines up
	// with the Ask Rovo greeting's last prompt. Only fall back to vertical
	// centering when the custom agent has no conversation starters to anchor.
	const hasTestGreetingSuggestions = (resolvedGreeting?.suggestions?.length ?? 0) > 0;
	const shouldBottomAlignAgentTestEmptyState = isAgentTestEmptyState && hasTestGreetingSuggestions;
	const shouldCenterAgentTestEmptyState = isAgentTestEmptyState && !hasTestGreetingSuggestions;
	const shouldCenterEmptyGreeting = emptyGreetingPlacement === "centered" && !hasMessages;
	const shouldHugEmptyGreeting = !hasMessages && greeting?.showHero === false;
	const shouldUseNaturalEmptyGreeting = shouldHugEmptyGreeting || isAgentTestEmptyState;
	const shouldUseAutoMessageTrack = shouldUseNaturalEmptyGreeting && containerStyle?.display === "grid";
	const resolvedContainerStyle = shouldUseAutoMessageTrack
		? { ...containerStyle, gridTemplateRows: "auto auto" }
		: containerStyle;

	const messagesContainerStyle: CSSProperties = {
		display: chatStyles.messagesContainer.display,
		flexDirection: chatStyles.messagesContainer.flexDirection,
		// Test empty state: grow to full height, then bottom-align the greeting
		// (so its last starter lines up with the Ask Rovo greeting) — or center it
		// when the agent has no starters. (Inline values win over Tailwind classes,
		// so the alignment must live here rather than only on the className.)
		justifyContent: shouldBottomAlignAgentTestEmptyState
			? "flex-end"
			: shouldCenterAgentTestEmptyState || shouldCenterEmptyGreeting
				? "center"
				: hasMessages || shouldUseNaturalEmptyGreeting
					? "flex-start"
					: "flex-end",
		flex: isAgentTestEmptyState ? "1 1 auto" : hasMessages || shouldUseNaturalEmptyGreeting ? "0 0 auto" : chatStyles.messagesContainer.flex,
		minHeight: isAgentTestEmptyState ? "100%" : shouldUseNaturalEmptyGreeting ? "auto" : "100%",
		// When bottom-aligning the Test greeting, reserve the sibling Ask Rovo
		// composer's context-bar footprint below the last starter, minus the
		// `gap-3` the Test layout already inserts above its composer, so both
		// greetings share a baseline. (Base 24px from the content track's `py-6`.)
		...(shouldBottomAlignAgentTestEmptyState && composerReservesContextBarSpace
			? { paddingBottom: `${24 + CONTEXT_BAR_RESERVED_SPACE_PX - AGENT_TEST_COMPOSER_GAP_PX}px` }
			: {}),
	};

	return {
		isAgentTestEmptyState,
		messagesContainerStyle,
		resolvedContainerStyle,
		resolvedGreeting,
	};
}

export function isCustomAgentTabsProfile(agent: { byline?: string }): boolean {
	return /\bcustom agent\b/iu.test(agent.byline ?? "");
}
