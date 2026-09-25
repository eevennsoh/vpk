"use client";

import PulseIcon from "@atlaskit/icon/core/pulse";

import { formatInsightsToggleAriaLabel } from "@/components/blocks/jira-kanban/experimental/lib/board-insights-nudge";
import type { PulseMember } from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
	JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME,
	JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS,
} from "../../header-facepile";

/**
 * The two Pulse controls that live in the board header.
 *
 * Pulse is a lens over the board rather than a sibling view, so it is a
 * pressed toggle sitting with Filter and Group — not a tab. Keeping the board's
 * control row visible is what lets the facepile below double as the Pulse
 * roster: one filter affordance, in one place, whichever surface is showing.
 */

export type ExperimentalJiraKanbanMode = "board" | "pulse";

export function PulseModeToggle({
	active,
	onToggle,
	unreadCount = 0,
}: Readonly<{
	active: boolean;
	onToggle: () => void;
	unreadCount?: number;
}>) {
	// The pill's number and this label are the same fact said twice, so both
	// strings live in one helper — see `board-insights-nudge`.
	const label = formatInsightsToggleAriaLabel(unreadCount);

	return (
		<Button
			aria-label={label}
			aria-pressed={active}
			className={cn(active ? "border-border-selected text-text-selected! [&_svg]:text-icon-selected!" : null)}
			onClick={onToggle}
			size="default"
			variant="outline"
		>
			<Icon
				className={cn(active ? "text-icon-selected" : null)}
				render={<PulseIcon label="" />}
			/>
			Insights
			{unreadCount > 0 ? <Badge variant="information">{unreadCount}</Badge> : null}
		</Button>
	);
}

/**
 * The Pulse roster, as the board header's facepile.
 *
 * Single-select, because the story column can only narrate one member at a
 * time — clicking the pressed face clears it. Agents keep the hexagon they
 * carry everywhere else in the board, so the human/agent mix is legible without
 * a legend.
 */
export function PulseRosterFacepile({
	members,
	onSelectedMemberIdChange,
	selectedMemberId,
}: Readonly<{
	members: readonly PulseMember[];
	onSelectedMemberIdChange: (memberId: string | null) => void;
	selectedMemberId: string | null;
}>) {
	return (
		<AvatarGroup
			label="Filter by person or agent"
			// Leftmost-on-top, matching the board's own facepile: DOM order stays
			// the tab order and the stacking is done with z-index. The shared
			// group also gives hexagon avatars their shape-aware separator.
			className={JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME}
		>
			{members.slice(0, JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS).map((member) => {
				const isSelected = member.id === selectedMemberId;
				return (
					<button
						aria-label={isSelected
							? `Clear filter: ${member.name}`
							: `Show only ${member.name}, ${member.role}`}
						aria-pressed={isSelected}
						className="focus-visible:ring-ring/50 flex size-6 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3"
						key={member.id}
						onClick={() => onSelectedMemberIdChange(isSelected ? null : member.id)}
						title={`${member.name} · ${member.role}`}
						type="button"
					>
						<Avatar
							className={cn(
								"duration-normal ease-out-practical transition-opacity motion-reduce:transition-none",
								member.kind === "human" ? "ring-2 ring-surface" : null,
								member.kind === "human" && isSelected ? "ring-border-selected!" : null,
								member.kind === "agent" && isSelected ? "[&_[data-slot=avatar-hexagon-border]]:text-border-selected!" : null,
								selectedMemberId !== null && !isSelected ? "opacity-(--opacity-disabled)" : null,
							)}
							label={member.name}
							shape={member.kind === "agent" ? "hexagon" : "circle"}
							size="sm"
						>
							<AvatarImage alt="" src={member.avatarSrc} />
							<AvatarFallback>
								{member.name.split(" ").map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					</button>
				);
			})}
		</AvatarGroup>
	);
}
