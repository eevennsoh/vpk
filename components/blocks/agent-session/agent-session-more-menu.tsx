"use client";

import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import { AgentSessionLinkWorkItemSubmenu } from "./agent-session-link-work-item-submenu";
import type {
	AgentSessionItem,
	AgentSessionWorkItemDraft,
	AgentSessionWorkItemOption,
} from "./agent-session-types";

/**
 * Session capabilities shared by the row's separate continuation and record menus.
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

export function AgentSessionMoreMenu({
	actions,
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
	 * Copy for the shared bottom row. "Dismiss" in an active list; the archived
	 * view passes "Unarchive", where the same capability restores rather than hides.
	 */
	dismissLabel?: string;
	/** Cloud sessions also get Rename and Delete. */
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
	const isExpired = item.role === "expired";
	const deleteItem = (
		<DropdownMenuItem
			disabled={isExpired && actions.onDelete === undefined}
			elemBefore={<DeleteIcon label="" size="small" />}
			onSelect={() => actions.onDelete?.()}
			variant="destructive"
		>
			Delete
		</DropdownMenuItem>
	);

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
				finalFocus={(closeType) => {
					// Pointer dismissal returns to rest; keyboard dismissal retains
					// the trigger focus unless a sibling menu has just opened.
					return closeType === "keyboard" && !document.querySelector('[role="menu"][data-open]');
				}}
				portalled={portalled}
				positionerClassName={positionerClassName}
			>
				{isExpired ? deleteItem : (
					<>
						{isCloud ? (
							<>
								<DropdownMenuItem
									elemBefore={<EditIcon label="" size="small" />}
									onSelect={() => actions.onRename?.()}
								>
									Rename
								</DropdownMenuItem>
								{deleteItem}
							</>
						) : null}
						{isCloud ? <DropdownMenuSeparator /> : null}
						{isCloud && showLinkWorkItemMenuItem && canPickWorkItem ? (
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
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
