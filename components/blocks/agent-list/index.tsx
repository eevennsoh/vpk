"use client";

import { useCallback, useState } from "react";

import { useOptionalRovoChat } from "@/app/contexts";
import {
	JiraSessionFlyoutSurface,
	createJiraSessionFlyoutHandle,
} from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { AGENT_LIST_ITEMS } from "./data";
import { AgentListCard } from "./agent-list-card";
import { isCodingAgentListItem } from "./agent-list-session";
import type {
	AgentListItem,
	AgentListProps,
} from "./agent-list-types";

export function AgentList({
	className,
	chrome = "stroke",
	composerChatSurface = "sidebar",
	flyout = "session",
	items = AGENT_LIST_ITEMS,
	variant = "default",
	canViewItem,
	onArchive,
	onSubmitPrompt,
	onView,
	renderFlyout,
	selectedItemId,
}: Readonly<AgentListProps>) {
	// Optional read, strict requirement: only the composer flyout sends
	// prompts, so a read-only list of comments and @mentions renders fine with no
	// chat runtime. The default session-details flyout has nothing to submit. A
	// composer needs a real destination — its Agent State card clears the reply
	// as soon as it submits, so a swallowed prompt would look like a successful
	// send — and fails here, at render, not after the viewer has typed one.
	const chat = useOptionalRovoChat();
	if (flyout === "composer" && onSubmitPrompt === undefined && chat === null) {
		throw new Error(
			'AgentList flyout="composer" needs a chat destination: render it inside a RovoChatProvider or pass onSubmitPrompt.',
		);
	}
	const handleFlyoutSubmit = useCallback((item: AgentListItem, prompt: string) => {
		if (onSubmitPrompt) {
			void onSubmitPrompt(item, prompt);
			return;
		}

		chat?.openChat(composerChatSurface);
		void chat?.sendPrompt(prompt);
	}, [chat, composerChatSurface, onSubmitPrompt]);
	const handleCodingView = useCallback((item: AgentListItem) => {
		onView?.(item);
	}, [onView]);
	// One payload-aware flyout for the whole list: the popup stays mounted and
	// follows the hovered row, so sliding down the list crossfades instead of
	// tearing down and remounting a card per row. Unused by the composer variant,
	// whose Agent State card owns local state and must stay per-row.
	const [flyoutHandle] = useState(createJiraSessionFlyoutHandle);

	return (
		<>
			<ul
				className={cn(
					"divide-y divide-border overflow-hidden rounded-lg",
					chrome === "raised"
						? "bg-surface-raised"
						: "border border-border bg-surface",
					className,
				)}
				style={chrome === "raised"
					? { boxShadow: token("elevation.shadow.raised") }
					: undefined}
			>
				{items.map((item: AgentListItem) => (
					<AgentListCard
						flyout={flyout}
						flyoutHandle={flyoutHandle}
						isSelected={item.id === selectedItemId}
						item={item}
						key={item.id}
						onArchive={onArchive}
						onView={
							isCodingAgentListItem(item)
								? handleCodingView
								: onView === undefined || (canViewItem !== undefined && !canViewItem(item))
									? undefined
									: onView
						}
						onFlyoutSubmit={(prompt) => handleFlyoutSubmit(item, prompt)}
						renderFlyout={renderFlyout}
						variant={variant}
					/>
				))}
			</ul>
			{flyout === "session" ? (
				<JiraSessionFlyoutSurface handle={flyoutHandle} />
			) : null}
		</>
	);
}

export { AGENT_LIST_ITEMS } from "./data";
export { AgentListActivityHeader } from "./agent-list-card";
export {
	deriveIssueKeyFromBranch,
	getAgentListHost,
	isCodingAgentListItem,
	isLocalAgentListItem,
	toAgentListResumeCommand,
	toAgentSessionFlyoutItem,
	toAgentSessionStatus,
} from "./agent-list-session";
export type {
	AgentListActorKind,
	AgentListAgent,
	AgentListChrome,
	AgentListCustomFlyoutActions,
	AgentListFlyout,
	AgentListHost,
	AgentListInvoker,
	AgentListItem,
	AgentListPrStatus,
	AgentListProps,
	AgentListSessionDetails,
	AgentListState,
	AgentListVariant,
} from "./agent-list-types";
