"use client";

import { useRef, useState } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import FlagIcon from "@atlaskit/icon/core/flag";
import LinkIcon from "@atlaskit/icon/core/link";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
	JiraIssueAgentAndSkillSubmenus,
	type JiraIssueGenerativeActionConfig,
	type JiraIssueGenerativeActionIssue,
} from "./generative-action-menu";
import { ProjectButterMenuAgentSubmenu } from "./project-butter-add-agent";
import { useProjectButterInvocationActions } from "./project-butter-invocation";
import type { JiraIssueAgentAssignment } from "./index";

export type JiraIssueMoreAction =
	| "edit-summary"
	| "move-work-item"
	| "change-status"
	| "copy-link"
	| "copy-key"
	| "add-agent"
	| "link-confluence-item"
	| "link-work-item"
	| "change-parent"
	| "select-cover"
	| "edit-labels"
	| "add-flag";

/** Present when the board can reorder the card; a missing direction means the card is already at that end. */
export interface JiraIssueReorderActions {
	readonly onMoveUp?: () => void;
	readonly onMoveDown?: () => void;
}

export interface JiraIssueMoreMenuActions {
	readonly onArchive?: () => void;
	readonly onSelect?: () => void;
	readonly onDelete?: () => void;
	/** Keyboard alternative to dragging the card within its column. */
	readonly reorder?: JiraIssueReorderActions;
}

interface JiraIssueMoreMenuProps {
	appearance?: "default" | "project-butter";
	availableActions?: readonly JiraIssueMoreAction[];
	flagged?: boolean;
	issueKey: string;
	selected?: boolean;
	showUnavailableAsEnabled?: boolean;
	moreMenuActions?: JiraIssueMoreMenuActions;
	onSelectionToggle?: () => void;
	onActionSelect?: (action: JiraIssueMoreAction) => void;
	onEditSummary?: () => void;
	onOpenChange?: (open: boolean) => void;
	generativeAction?: JiraIssueGenerativeActionConfig;
	generativeActionIssue?: JiraIssueGenerativeActionIssue;
	butterAssignment?: JiraIssueAgentAssignment;
}

const CHEVRON = <ChevronRightIcon label="" size="small" color="currentColor" />;
const butterMenuColor = "[&_[data-slot=dropdown-menu-item]:not([data-disabled])]:text-icon-subtle [&_[data-slot=dropdown-menu-sub-trigger]:not([data-disabled])]:text-icon-subtle";

function JiraIssueReorderItems({ reorder }: Readonly<{ reorder: JiraIssueReorderActions | undefined }>) {
	return reorder ? (
		<>
			<DropdownMenuItem disabled={!reorder.onMoveUp} onSelect={reorder.onMoveUp}>Move up</DropdownMenuItem>
			<DropdownMenuItem disabled={!reorder.onMoveDown} onSelect={reorder.onMoveDown}>Move down</DropdownMenuItem>
		</>
	) : null;
}

/** Any card-action set shows Select / Archive / Delete, except one that only reorders. */
function hasCardActions(actions: JiraIssueMoreMenuActions | undefined): actions is JiraIssueMoreMenuActions {
	return actions !== undefined && (actions.reorder === undefined || Object.keys(actions).some((key) => key !== "reorder"));
}

function JiraIssueMoreMenu(props: Readonly<JiraIssueMoreMenuProps>) {
	return props.onSelectionToggle ? (
		<div className="flex size-full items-center justify-center">
			<Checkbox
				aria-label={`Select ${props.issueKey}`}
				checked={props.selected ?? false}
				className="motion-reduce:transition-none"
				data-jira-issue-selection-control=""
				nativeButton
				onCheckedChange={props.onSelectionToggle}
				onClick={(event) => event.stopPropagation()}
				onMouseDown={(event) => {
					// Keep the draggable card's native pickup off this selection gesture.
					event.preventDefault();
					event.currentTarget.focus({ preventScroll: true });
				}}
				render={<button type="button" />}
			/>
		</div>
	) : <JiraIssueMoreDropdown {...props} />;
}

function JiraIssueMoreDropdown({ appearance = "default", availableActions, butterAssignment, flagged, generativeAction, generativeActionIssue, issueKey, moreMenuActions, onActionSelect, onEditSummary, onOpenChange, showUnavailableAsEnabled = false }: Readonly<JiraIssueMoreMenuProps>) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const invocation = useProjectButterInvocationActions();

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
	}

	function select(action: JiraIssueMoreAction) {
		return () => { if (!unavailable(action)) onActionSelect?.(action); };
	}
	function unavailable(action: JiraIssueMoreAction) {
		return availableActions !== undefined && (!onActionSelect || !availableActions.includes(action));
	}
	function actionDisabled(action: JiraIssueMoreAction) {
		return !showUnavailableAsEnabled && unavailable(action);
	}
	function handlerDisabled(handler: (() => void) | undefined) {
		return !showUnavailableAsEnabled && !handler;
	}
	function butterActionDisabled(action: JiraIssueMoreAction) {
		return !onActionSelect || (availableActions !== undefined && !availableActions.includes(action));
	}

	function selectCard() {
		if (!moreMenuActions?.onSelect) return;
		const cardControl = triggerRef.current?.closest('[data-slot="jira-issue-card"]')?.querySelector<HTMLElement>('[data-jira-issue-activation-control]');
		handleOpenChange(false);
		moreMenuActions.onSelect();
		queueMicrotask(() => { if (cardControl?.isConnected) cardControl.focus({ preventScroll: true }); });
	}

	function copy(value: string, action: "copy-link" | "copy-key") {
		if (onActionSelect && !butterActionDisabled(action)) {
			onActionSelect(action);
		} else {
			void navigator.clipboard?.writeText(value);
		}
	}

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						ref={triggerRef}
						aria-label={`More actions for ${issueKey}`}
						className="pointer-events-none size-6 opacity-0 transition-opacity duration-fast ease-out-practical motion-reduce:transition-none group-[&:hover:not(:has([data-slot=jira-issue-subtask-card]:hover))]/jira-issue:pointer-events-auto group-[&:hover:not(:has([data-slot=jira-issue-subtask-card]:hover))]/jira-issue:opacity-100 group-has-[:focus-visible]/jira-issue:pointer-events-auto group-has-[:focus-visible]/jira-issue:opacity-100 data-popup-open:pointer-events-auto data-popup-open:opacity-100"
						onClick={(event) => event.stopPropagation()}
						size="icon-compact"
						type="button"
						variant="ghost"
					/>
				}
			>
				<Icon render={<ShowMoreHorizontalIcon label="" size="small" color="currentColor" />} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className={cn("max-h-none w-[280px]", appearance === "project-butter" ? butterMenuColor : null)} side="right" sideOffset={8}>
				{appearance === "project-butter" ? <>
					<DropdownMenuGroup>
						<DropdownMenuItem elemBefore={<AlignTextLeftIcon label="" size="small" />} elemBeforeSize={16} onSelect={onEditSummary ?? select("edit-summary")}>Edit summary</DropdownMenuItem>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger elemBefore={<LinkIcon label="" size="small" />} elemBeforeSize={16}>Link</DropdownMenuSubTrigger>
							<DropdownMenuSubContent className={butterMenuColor}>
								<DropdownMenuItem onSelect={select("link-work-item")}>Work item</DropdownMenuItem>
								<DropdownMenuItem onSelect={select("link-confluence-item")}>Confluence item</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuItem elemBefore={<EditIcon label="" size="small" />} elemBeforeSize={16} elemAfter={CHEVRON} onSelect={select("edit-labels")}>Edit labels</DropdownMenuItem>
						<DropdownMenuItem elemBefore={<FlagIcon label="" size="small" />} elemBeforeSize={16} onSelect={select("add-flag")}>{flagged ? "Remove flag" : "Add flag"}</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<JiraIssueReorderItems reorder={moreMenuActions?.reorder} />
						<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("move-work-item")}>Move work item</DropdownMenuItem>
						<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("change-status")}>Change status</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={() => copy(window.location.href, "copy-link")}>Copy link</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => copy(issueKey, "copy-key")}>Copy key</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					{moreMenuActions?.onSelect ? <><DropdownMenuItem elemAfter={<DropdownMenuShortcut aria-hidden="true">Cmd + Click</DropdownMenuShortcut>} onSelect={selectCard}>Select</DropdownMenuItem><DropdownMenuSeparator /></> : null}
					<DropdownMenuItem elemBefore={<DeleteIcon label="" size="small" />} elemBeforeSize={16} onSelect={moreMenuActions?.onDelete}>Delete</DropdownMenuItem>
				</> : <>
				{butterAssignment && invocation ? <ProjectButterMenuAgentSubmenu assignment={butterAssignment} triggerRef={triggerRef} onRequestClose={() => handleOpenChange(false)} /> : null}
				{generativeAction && generativeActionIssue ? (
					<>
						<JiraIssueAgentAndSkillSubmenus
							action={generativeAction}
							issue={generativeActionIssue}
							onRequestClose={() => handleOpenChange(false)}
							showAgent={!butterAssignment}
						/>
						<DropdownMenuSeparator />
					</>
				) : null}
				<DropdownMenuGroup>
					{onEditSummary ? <DropdownMenuItem elemBefore={<AlignTextLeftIcon label="" size="small" />} onSelect={onEditSummary}>Edit summary</DropdownMenuItem> : null}
					<JiraIssueReorderItems reorder={moreMenuActions?.reorder} />
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("move-work-item")} onSelect={select("move-work-item")}>Move work item</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("change-status")} onSelect={select("change-status")}>Change status</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem disabled={actionDisabled("copy-link")} onSelect={select("copy-link")}>Copy link</DropdownMenuItem>
					<DropdownMenuItem disabled={actionDisabled("copy-key")} onSelect={select("copy-key")}>Copy key</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{generativeAction || butterAssignment ? null : <DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("add-agent")} onSelect={select("add-agent")}>Add agent</DropdownMenuItem>}
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("link-confluence-item")} onSelect={select("link-confluence-item")}>Link Confluence item</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("link-work-item")} onSelect={select("link-work-item")}>Link work item</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("change-parent")} onSelect={select("change-parent")}>Change parent</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("select-cover")} onSelect={select("select-cover")}>Select cover</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("edit-labels")} onSelect={select("edit-labels")}>Edit labels</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} disabled={actionDisabled("add-flag")} onSelect={select("add-flag")}>{flagged ? "Remove flag" : "Add flag"}</DropdownMenuItem>
				</DropdownMenuGroup>
				{hasCardActions(moreMenuActions) ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem aria-label="Select" aria-description="Command plus click" disabled={handlerDisabled(moreMenuActions.onSelect)} elemAfter={<DropdownMenuShortcut aria-hidden="true">Cmd + Click</DropdownMenuShortcut>} onSelect={selectCard}>Select</DropdownMenuItem>
							<DropdownMenuItem disabled={handlerDisabled(moreMenuActions.onArchive)} onSelect={moreMenuActions.onArchive}>Archive</DropdownMenuItem>
							<DropdownMenuItem disabled={handlerDisabled(moreMenuActions.onDelete)} onSelect={moreMenuActions.onDelete}>Delete</DropdownMenuItem>
						</DropdownMenuGroup>
					</>
				) : null}
				</>}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { JiraIssueMoreMenu };
