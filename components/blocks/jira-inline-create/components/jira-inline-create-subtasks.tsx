"use client";

import { useState, type ReactElement } from "react";

import type { JiraIssueSubtask } from "@/components/blocks/jira-issue";
import { ProjectButterSubtaskRowContent } from "@/components/blocks/jira-issue/project-butter-subtasks";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSearchField, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCommandMenuScrollMask } from "@/components/ui-custom/rich-text-editor/command-menu-scroll-mask";

export function JiraInlineCreateSubtasks({ options, selected, onSelect, trigger }: Readonly<{
	options: readonly JiraIssueSubtask[];
	selected: readonly string[];
	onSelect: (key: string) => void;
	trigger: ReactElement;
}>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const { listProps, listRef, menuProps } = useCommandMenuScrollMask();
	const normalizedQuery = query.trim().toLowerCase();
	const visible = options.filter((option) => `${option.issueKey} ${option.summary}`.toLowerCase().includes(normalizedQuery));
	return (
		<DropdownMenu modal={false} open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(""); }}>
			<DropdownMenuTrigger aria-haspopup="dialog" render={trigger} />
			<DropdownMenuContent
				align="start"
				aria-label="Choose subtasks"
				className="flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden [--rich-text-command-menu-scroll-mask-fade-size:6rem] [--rich-text-command-menu-scrollbar-width:10px]"
				onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
				positionerClassName="z-[700]"
				role="dialog"
				sideOffset={8}
				{...menuProps}
			>
				<div className="-mx-1.5 -mt-1.5 shrink-0">
					<DropdownMenuSearchField
						autoFocus
						iconContainerSize={16}
						label="Search subtasks"
						onClear={() => setQuery("")}
						onEscape={() => { setOpen(false); setQuery(""); }}
						onKeyDown={(event) => {
							if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
							event.preventDefault();
							const rows = listRef.current?.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]');
							const row = event.key === "ArrowDown" ? rows?.[0] : rows?.[rows.length - 1];
							row?.focus();
						}}
						onSubmit={() => { if (visible[0]) onSelect(visible[0].issueKey); }}
						onValueChange={setQuery}
						value={query}
					/>
				</div>
				<div aria-label={visible.length ? "Subtasks" : undefined} className="menu-row-spacing -mx-1.5 -mb-1.5 mt-1.5 min-h-0 overflow-y-auto px-1.5 pb-1.5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring" role={visible.length ? "menu" : undefined} tabIndex={visible.length ? 0 : undefined} {...listProps}>
					{visible.length ? visible.map((option) => (
						<DropdownMenuCheckboxItem
							aria-label={`${option.issueKey} ${option.summary}`}
							checked={selected.includes(option.issueKey)}
							className="gap-2"
							closeOnClick={false}
							indicatorPlacement="end"
							key={option.issueKey}
							onCheckedChange={() => onSelect(option.issueKey)}
						>
							<ProjectButterSubtaskRowContent subtask={option} />
						</DropdownMenuCheckboxItem>
					)) : <p className="px-2 py-1.5 text-sm text-text-subtlest" role="status">No subtasks match</p>}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
