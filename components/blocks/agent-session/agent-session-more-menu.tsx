"use client";

import type { ReactNode } from "react";

import TerminalIcon from "@atlaskit/icon-lab/core/terminal";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { LogoThirdParty } from "@/components/ui/logo-third-party";

import { AgentSessionLinkWorkItemSubmenu } from "./agent-session-link-work-item-submenu";
import type {
	AgentSessionItem,
	AgentSessionWorkItemDraft,
	AgentSessionWorkItemOption,
} from "./agent-session-types";

/**
 * The one action a session row offers, by host.
 *
 * A local session lives on the viewer's machine, so its actions are about
 * getting back into it — reopen the agent, or take the prompt to a terminal. A
 * cloud session lives on the server, where the row is a handle on a remote
 * record, so its actions are about the record: rename it, delete it. Link work
 * item is offered only when the host supplies linking actions (the session
 * column). Dismiss is common to both menu variants.
 *
 * Prototype rows stay interactive when a callback is not yet implemented.
 * Optional callbacks make those selections safe no-ops.
 */
export interface AgentSessionMoreMenuActions {
	/** Reopen the session in its own agent. Labeled with the agent's name. */
	onContinueInAgent?: () => void;
	/** Copy the resume prompt for a terminal. Local only. */
	onCopyPrompt?: () => void;
	/** Create a work item from the submenu's Create new tab, titled by the viewer. */
	onCreateWorkItem?: (draft: AgentSessionWorkItemDraft) => void;
	/** Remove the row from this list. Wired to the host's archive/hide capability. */
	onDismiss?: () => void;
	/** Attach the session to an existing work item chosen in the submenu. */
	onLinkWorkItem?: (workItemKey: string) => void;
	/** Rename the session. Cloud only. */
	onRename?: () => void;
	/** Delete the session record. Cloud only. */
	onDelete?: () => void;
}

/** The agent's own mark for the "Continue in" row: brand tile, else its avatar. */
function AgentMenuGlyph({ agent }: Readonly<{ agent: AgentSessionItem["agent"] }>): ReactNode {
	if (agent.brandName) {
		return <LogoThirdParty borderless name={agent.brandName} size="xxsmall" />;
	}

	return <AgentAvatarVisual avatarSrc={agent.avatarSrc} label="" sizePx={16} vpkLogo={agent.vpkLogo} />;
}

export function AgentSessionMoreMenu({
	actions,
	copied = false,
	dismissLabel = "Dismiss",
	isCloud,
	item,
	onOpenChange,
	open,
	positionerClassName,
	portalled,
	showLinkWorkItemMenuItem = true,
	workItemOptions = [],
}: Readonly<{
	actions: AgentSessionMoreMenuActions;
	/**
	 * Show the copy confirmation as a check on the Terminal menu row.
	 *
	 * The `...` trigger stays a more-actions button. Selecting Terminal prevents
	 * the menu from closing so the row's own trailing check is visible.
	 */
	copied?: boolean;
	/**
	 * Copy for the shared bottom row. "Dismiss" in an active list; the archived
	 * view passes "Unarchive", where the same capability restores rather than hides.
	 */
	dismissLabel?: string;
	/** Cloud sessions get the record actions; local sessions get the continue-in group. */
	isCloud: boolean;
	item: AgentSessionItem;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	/**
	 * Overlay stacking for the portalled menu. Defaults to the shared
	 * dropdown tier; assignment's picker sits at `z-[502]`, so that surface
	 * passes a higher value or the menu opens behind the picker.
	 */
	positionerClassName?: string;
	/**
	 * Portal the menu to the document. Nested clipped overlays can pass
	 * `false`; assignment uses the default portal and keeps the picker open.
	 */
	portalled?: boolean;
	/** Shows the manual Link work item row when the host also supplies a capability. */
	showLinkWorkItemMenuItem?: boolean;
	/** Work items the Link work item submenu offers on its Link to existing tab. */
	workItemOptions?: readonly AgentSessionWorkItemOption[];
}>) {
	const canPickWorkItem = actions.onLinkWorkItem !== undefined
		|| actions.onCreateWorkItem !== undefined;

	return (
		<DropdownMenu onOpenChange={onOpenChange} open={open}>
			<DropdownMenuTrigger
				render={(
					<Button
						aria-label={`More actions for ${item.title}`}
						className="size-6 shadow-none focus-visible:ring-0"
						data-session-drag-ignore=""
						// Nested in the row article: stop click so "..." opens the menu
						// without activating onView, and pointerdown so it is not a drag handle.
						onClick={(event) => event.stopPropagation()}
						onPointerDown={(event) => event.stopPropagation()}
						size="icon-compact"
						type="button"
						variant="ghost"
					/>
				)}
			>
				<Icon
					render={<ShowMoreHorizontalIcon color="currentColor" label="" size="small" />}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="min-w-44"
				portalled={portalled}
				positionerClassName={positionerClassName}
			>
				{isCloud ? (
					<>
						<DropdownMenuItem
							elemBefore={<EditIcon label="" size="small" />}
							onSelect={() => actions.onRename?.()}
						>
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem
							elemBefore={<DeleteIcon label="" size="small" />}
							onSelect={() => actions.onDelete?.()}
							variant="destructive"
						>
							Delete
						</DropdownMenuItem>
					</>
				) : (
					// Base UI requires a Group around a GroupLabel — "Continue in" heads
					// these two rows, so they are a group in the accessibility tree too,
					// not just visually.
					<DropdownMenuGroup>
						<DropdownMenuLabel>Continue in</DropdownMenuLabel>
						<DropdownMenuItem
							elemBefore={<AgentMenuGlyph agent={item.agent} />}
							onSelect={() => actions.onContinueInAgent?.()}
						>
							{item.agent.name}
						</DropdownMenuItem>
						<DropdownMenuItem
							description="Copy prompt"
							elemBefore={<TerminalIcon label="" size="small" />}
							onSelect={(event) => {
								event.preventDefault();
								actions.onCopyPrompt?.();
							}}
							selected={copied}
						>
							Terminal
						</DropdownMenuItem>
					</DropdownMenuGroup>
				)}
				<DropdownMenuSeparator />
				{showLinkWorkItemMenuItem && canPickWorkItem ? (
					<AgentSessionLinkWorkItemSubmenu
						onCreateWorkItem={actions.onCreateWorkItem}
						onLinkWorkItem={actions.onLinkWorkItem}
						onRequestClose={() => onOpenChange(false)}
						workItemOptions={workItemOptions}
					/>
				) : null}
				<DropdownMenuItem
					onSelect={() => actions.onDismiss?.()}
				>
					{dismissLabel}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
