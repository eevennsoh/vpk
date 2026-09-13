"use client";

import { useState } from "react";

import ReturnIcon from "@atlaskit/icon-lab/core/return";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import { IssueTypeGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import type { JiraListIssueType } from "@/components/blocks/jira-list/jira-list-types";
import { Button } from "@/components/ui/button";
import {
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchIcon } from "@/components/ui/vpk-icons";

import type {
	AgentSessionWorkItemDraft,
	AgentSessionWorkItemOption,
} from "./agent-session-types";

/** Copy for the menu row and its submenu, shared with the disabled fallback. */
export const AGENT_SESSION_LINK_WORK_ITEM_LABEL = "Link work item";

const ISSUE_TYPE_OPTIONS: readonly JiraListIssueType[] = [
	"task",
	"epic",
	"story",
	"bug",
	"subtask",
];

/** Title Case for the type menu; the option values stay the lowercase board union. */
function issueTypeLabel(issueType: JiraListIssueType): string {
	return `${issueType.charAt(0).toUpperCase()}${issueType.slice(1)}`;
}

/**
 * Issue-type picker that sits inside the name field as a glyph + chevron.
 *
 * This is another Base UI submenu, not an independent root menu. That keeps the
 * parent action menu open while the shared portal positions the type choices in
 * viewport coordinates instead of inheriting the transformed field panel.
 */
function IssueTypePicker({
	onChange,
	value,
}: Readonly<{
	onChange: (issueType: JiraListIssueType) => void;
	value: JiraListIssueType;
}>) {
	const [open, setOpen] = useState(false);

	return (
		<DropdownMenuSub onOpenChange={setOpen} open={open}>
			<DropdownMenuSubTrigger
				className="h-6 w-auto gap-1 rounded-md px-2"
				nativeButton
				render={(
					<Button
						aria-label={`Work item type: ${issueTypeLabel(value)}`}
						className="shrink-0 gap-1 px-2"
						size="compact"
						type="button"
						variant="ghost"
					/>
				)}
				showChevron={false}
			>
				<IssueTypeGlyph issueType={value} />
				<Icon
					className="text-icon-subtle"
					render={<ChevronDownIcon label="" size="small" />}
				/>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent
				align="start"
				alignOffset={0}
				className="min-w-40"
				side="bottom"
				sideOffset={4}
			>
				<DropdownMenuRadioGroup
					aria-label="Work item type"
					onValueChange={(next) => onChange(next as JiraListIssueType)}
					value={value}
				>
					{ISSUE_TYPE_OPTIONS.map((issueType) => (
						<DropdownMenuRadioItem
							className="gap-2"
							indicatorPlacement="end"
							key={issueType}
							onClick={() => setOpen(false)}
							value={issueType}
						>
							<IssueTypeGlyph issueType={issueType} />
							{issueTypeLabel(issueType)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

/**
 * Name field with the type picker as a prefix and a return chip as a suffix.
 *
 * The chip is a real submit button: a decorative return glyph would promise the
 * pointer path an action only the keyboard path actually has.
 */
function CreateWorkItemField({
	issueType,
	onIssueTypeChange,
	onSubmit,
	onSummaryChange,
	summary,
}: Readonly<{
	issueType: JiraListIssueType;
	onIssueTypeChange: (issueType: JiraListIssueType) => void;
	onSubmit: () => void;
	onSummaryChange: (summary: string) => void;
	summary: string;
}>) {
	const canSubmit = summary.trim().length > 0;

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (canSubmit) {
					onSubmit();
				}
			}}
		>
			<InputGroup>
				<InputGroupAddon>
					<IssueTypePicker onChange={onIssueTypeChange} value={issueType} />
				</InputGroupAddon>
				<InputGroupInput
					aria-label="Name this work item"
					name="summary"
					onChange={(event) => onSummaryChange(event.target.value)}
					placeholder="Name this work item"
					type="text"
					value={summary}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						aria-label="Create work item"
						disabled={!canSubmit}
						size="icon-xs"
						type="submit"
						variant="secondary"
					>
						<ReturnIcon label="" size="small" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</form>
	);
}

/**
 * The session menu's work-item picker, as a submenu of the `…` menu.
 *
 * Two tabs because linking and creating are the same intent reached from
 * different starting points — the viewer either already knows which work item
 * this session belongs to, or is about to name one. A tab whose capability the
 * host did not supply renders disabled rather than absent, so the menu keeps one
 * shape and the missing half is legible instead of silently gone.
 *
 * Row clicks close the whole menu, not just this panel, which is why the parent
 * hands down `onRequestClose`: the rows are plain buttons, not menu items, so
 * Base UI's own close-on-select does not apply to them.
 */
export function AgentSessionLinkWorkItemSubmenu({
	onCreateWorkItem,
	onLinkWorkItem,
	onRequestClose,
	workItemOptions,
}: Readonly<{
	onCreateWorkItem?: (draft: AgentSessionWorkItemDraft) => void;
	onLinkWorkItem?: (workItemKey: string) => void;
	onRequestClose: () => void;
	workItemOptions: readonly AgentSessionWorkItemOption[];
}>) {
	const [query, setQuery] = useState("");
	const [summary, setSummary] = useState("");
	const [issueType, setIssueType] = useState<JiraListIssueType>("task");

	const canLink = onLinkWorkItem !== undefined;
	const canCreate = onCreateWorkItem !== undefined;
	const trimmedQuery = query.trim().toLowerCase();
	const matches = trimmedQuery.length === 0
		? workItemOptions
		: workItemOptions.filter((option) => (
			`${option.key} ${option.summary}`.toLowerCase().includes(trimmedQuery)
		));

	function reset() {
		setQuery("");
		setSummary("");
		setIssueType("task");
	}

	function handleLink(workItemKey: string) {
		onRequestClose();
		reset();
		onLinkWorkItem?.(workItemKey);
	}

	function handleCreate() {
		const trimmedSummary = summary.trim();
		if (trimmedSummary.length === 0) {
			return;
		}
		onRequestClose();
		reset();
		onCreateWorkItem?.({ issueType, summary: trimmedSummary });
	}

	return (
		<DropdownMenuSub
			onOpenChange={(open) => {
				if (!open) {
					reset();
				}
			}}
		>
			<DropdownMenuSubTrigger>{AGENT_SESSION_LINK_WORK_ITEM_LABEL}</DropdownMenuSubTrigger>
			{/*
			 * Keep the panel content-sized across tabs. The existing-items list owns
			 * its bounded scroll while Create new keeps the InputGroup focus ring clear.
			 */}
			<DropdownMenuSubContent
				className="max-h-none w-[22rem] p-0"
				onClick={(event) => event.stopPropagation()}
			>
				<Tabs className="gap-0" defaultValue={canLink ? "existing" : "create"}>
					<TabsList className="mx-2.5 mt-2.5 w-[calc(100%-1.25rem)]">
						<TabsTrigger disabled={!canLink} value="existing">Link to existing</TabsTrigger>
						<TabsTrigger disabled={!canCreate} value="create">Create new</TabsTrigger>
					</TabsList>

					<TabsContent className="flex flex-col gap-2.5 p-2.5" value="existing">
						<InputGroup className="h-8">
							<InputGroupAddon>
								<SearchIcon />
							</InputGroupAddon>
							<InputGroupInput
								aria-label="Search work items"
								className="text-sm"
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search..."
								type="text"
								value={query}
							/>
						</InputGroup>
						{matches.length > 0 ? (
							<DropdownMenuGroup className="flex max-h-[16rem] flex-col gap-0.5 overflow-y-auto">
								<DropdownMenuLabel>
									{trimmedQuery.length > 0 ? "Results" : "Recently viewed"}
								</DropdownMenuLabel>
								{matches.map((option) => (
									<button
										className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-text transition-colors duration-fast ease-out-practical hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
										key={option.key}
										onClick={() => handleLink(option.key)}
										type="button"
									>
										<IssueTypeGlyph issueType={option.issueType ?? "task"} />
										<span className="min-w-0 flex-1 truncate">
											{option.key} {option.summary}
										</span>
									</button>
								))}
							</DropdownMenuGroup>
						) : (
							<p className="px-2 py-2 text-sm text-text-subtlest">No matching work items.</p>
						)}
					</TabsContent>

					<TabsContent className="flex flex-col gap-2.5 p-2.5" value="create">
						<CreateWorkItemField
							issueType={issueType}
							onIssueTypeChange={setIssueType}
							onSubmit={handleCreate}
							onSummaryChange={setSummary}
							summary={summary}
						/>
					</TabsContent>
				</Tabs>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
