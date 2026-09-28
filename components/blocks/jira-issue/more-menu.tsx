"use client";

import { useRef, useState } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
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
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
	JiraIssueAgentAndSkillSubmenus,
	type JiraIssueGenerativeActionConfig,
	type JiraIssueGenerativeActionIssue,
} from "./generative-action-menu";

export type JiraIssueMoreAction =
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

export interface JiraIssueMoreMenuActions {
	readonly onArchive?: () => void;
	readonly onSelect?: () => void;
	readonly onDelete?: () => void;
}

interface JiraIssueMoreMenuProps {
	issueKey: string;
	selected?: boolean;
	moreMenuActions?: JiraIssueMoreMenuActions;
	onSelectionToggle?: () => void;
	onActionSelect?: (action: JiraIssueMoreAction) => void;
	onOpenChange?: (open: boolean) => void;
	generativeAction?: JiraIssueGenerativeActionConfig;
	generativeActionIssue?: JiraIssueGenerativeActionIssue;
}

const CHEVRON = <ChevronRightIcon label="" size="small" color="currentColor" />;

function JiraIssueMoreMenu(props: Readonly<JiraIssueMoreMenuProps>) {
	return props.onSelectionToggle ? (
		<div className="flex size-full items-center justify-center">
			<Checkbox
				aria-label={`Select ${props.issueKey}`}
				checked={props.selected ?? false}
				className="motion-reduce:transition-none"
				data-jira-issue-selection-control=""
				onCheckedChange={props.onSelectionToggle}
				onClick={(event) => event.stopPropagation()}
			/>
		</div>
	) : <JiraIssueMoreDropdown {...props} />;
}

function JiraIssueMoreDropdown({ generativeAction, generativeActionIssue, issueKey, moreMenuActions, onActionSelect, onOpenChange }: Readonly<JiraIssueMoreMenuProps>) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement | null>(null);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
	}

	function select(action: JiraIssueMoreAction) {
		return () => onActionSelect?.(action);
	}

	function selectCard() {
		if (!moreMenuActions?.onSelect) return;
		const cardControl = triggerRef.current?.closest('[data-slot="jira-issue-card"]')?.querySelector<HTMLElement>('[data-jira-issue-activation-control]');
		handleOpenChange(false);
		moreMenuActions.onSelect();
		queueMicrotask(() => { if (cardControl?.isConnected) cardControl.focus({ preventScroll: true }); });
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
			<DropdownMenuContent align="start" className="max-h-none w-[280px]" side="right" sideOffset={8}>
				{generativeAction && generativeActionIssue ? (
					<>
						<JiraIssueAgentAndSkillSubmenus
							action={generativeAction}
							issue={generativeActionIssue}
							onRequestClose={() => handleOpenChange(false)}
						/>
						<DropdownMenuSeparator />
					</>
				) : null}
				<DropdownMenuGroup>
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("move-work-item")}>Move work item</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("change-status")}>Change status</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={select("copy-link")}>Copy link</DropdownMenuItem>
					<DropdownMenuItem onSelect={select("copy-key")}>Copy key</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{generativeAction ? null : <DropdownMenuItem elemAfter={CHEVRON} onSelect={select("add-agent")}>Add agent</DropdownMenuItem>}
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("link-confluence-item")}>Link Confluence item</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("link-work-item")}>Link work item</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("change-parent")}>Change parent</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("select-cover")}>Select cover</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("edit-labels")}>Edit labels</DropdownMenuItem>
					<DropdownMenuItem elemAfter={CHEVRON} onSelect={select("add-flag")}>Add flag</DropdownMenuItem>
				</DropdownMenuGroup>
				{moreMenuActions ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem aria-label="Select" aria-description="Shift plus click" disabled={!moreMenuActions.onSelect} elemAfter={<DropdownMenuShortcut aria-hidden="true">Shift + Click</DropdownMenuShortcut>} onSelect={selectCard}>Select</DropdownMenuItem>
							<DropdownMenuItem disabled={!moreMenuActions.onArchive} onSelect={moreMenuActions.onArchive}>Archive</DropdownMenuItem>
							<DropdownMenuItem disabled={!moreMenuActions.onDelete} onSelect={moreMenuActions.onDelete}>Delete</DropdownMenuItem>
						</DropdownMenuGroup>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { JiraIssueMoreMenu };
