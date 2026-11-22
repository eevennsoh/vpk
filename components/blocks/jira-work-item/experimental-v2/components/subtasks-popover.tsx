"use client";

import { useState, type ReactElement } from "react";

import SearchIcon from "@atlaskit/icon/core/search";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	CONTEXT_POPOVER_ROW_CLASS,
	CONTEXT_POPOVER_SECTION_HEADING_CLASS,
	CONTEXT_POPOVER_TABS_LIST_CLASS,
	PopoverOptionPicker,
	PopoverSubmitField,
	SuggestionPanel,
	WorkItemTypeIcon,
} from "@/components/blocks/jira-work-item/experimental-v2/components/context-popover-parts";
import { useJiraWorkItemActions } from "@/components/blocks/jira-work-item/experimental-v2/context-jira-work-item";
import {
	createSubtaskFromName,
	createSubtaskFromSuggestion,
	SUBTASK_AI_SUGGESTIONS,
	SUBTASK_EXISTING,
	SUBTASK_TYPES,
} from "@/components/blocks/jira-work-item/data/context-fixtures";
import type { WorkItemChildItem } from "@/app/contexts/context-work-item-modal";

interface SubtasksPopoverProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	tooltip?: string;
	trigger: ReactElement;
}

export function SubtasksPopover({
	open: controlledOpen,
	onOpenChange,
	tooltip,
	trigger,
}: Readonly<SubtasksPopoverProps>) {
	const actions = useJiraWorkItemActions();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const [type, setType] = useState<string>("Subtask");
	const [name, setName] = useState("");
	const [query, setQuery] = useState("");
	const [selectedSuggestions, setSelectedSuggestions] = useState<readonly string[]>([]);

	const closeWithReset = () => {
		setName("");
		setQuery("");
		setSelectedSuggestions([]);
		setOpen(false);
	};

	const add = (item: WorkItemChildItem) => {
		actions.addContextResource("subtask", item);
		closeWithReset();
	};

	const createFromName = () => {
		if (!name.trim()) return;
		add(createSubtaskFromName(name, type));
	};

	/**
	 * Checked suggestions are committed together by the Create button rather than
	 * on each toggle, so the checkbox stays a reversible draft until confirmed.
	 */
	const createSelectedSuggestions = () => {
		const chosen = SUBTASK_AI_SUGGESTIONS.filter((suggestion) => selectedSuggestions.includes(suggestion.id));
		if (chosen.length === 0) return;
		for (const suggestion of chosen) {
			actions.addContextResource("subtask", createSubtaskFromSuggestion(suggestion));
		}
		closeWithReset();
	};

	const trimmedQuery = query.trim().toLowerCase();
	const existing = trimmedQuery
		? SUBTASK_EXISTING.filter((item) => `${item.key} ${item.summary}`.toLowerCase().includes(trimmedQuery))
		: SUBTASK_EXISTING;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{tooltip ? (
				<Tooltip>
					<TooltipTrigger render={<span className="inline-flex" />}>
						<PopoverTrigger render={trigger} />
					</TooltipTrigger>
					<TooltipContent positionerClassName="z-[502]">{tooltip}</TooltipContent>
				</Tooltip>
			) : (
				<PopoverTrigger render={trigger} />
			)}
			<PopoverContent align="start" className="w-[24rem] p-0" positionerClassName="z-[502]">
				<Tabs defaultValue="create" className="gap-0">
					<TabsList className={CONTEXT_POPOVER_TABS_LIST_CLASS}>
						<TabsTrigger value="create">Create new</TabsTrigger>
						<TabsTrigger value="existing">Add existing</TabsTrigger>
					</TabsList>

					<TabsContent value="create" className="flex max-h-[24rem] flex-col gap-2.5 overflow-y-auto p-2.5">
						<PopoverSubmitField
							ariaLabel="Subtask name"
							leading={
								<PopoverOptionPicker
									ariaLabel="Subtask type"
									leading={<WorkItemTypeIcon type={type} />}
									onChange={setType}
									options={SUBTASK_TYPES}
									value={type}
									variant="inline"
								/>
							}
							onChange={setName}
							onSubmit={createFromName}
							placeholder={`Name this ${type}`}
							submitLabel="Create subtask"
							value={name}
						/>

						<SuggestionPanel
							action={
								<Button
									disabled={selectedSuggestions.length === 0}
									onClick={createSelectedSuggestions}
									size="compact"
									type="button"
									variant="secondary"
								>
									Create
								</Button>
							}
							title={`${SUBTASK_AI_SUGGESTIONS.length} suggested ${SUBTASK_AI_SUGGESTIONS.length === 1 ? "subtask" : "subtasks"}`}
						>
							{SUBTASK_AI_SUGGESTIONS.map((suggestion) => {
								const checked = selectedSuggestions.includes(suggestion.id);
								return (
									<label
										key={suggestion.id}
										className={CONTEXT_POPOVER_ROW_CLASS}
									>
										<Checkbox
											checked={checked}
											onCheckedChange={(next) =>
												setSelectedSuggestions((current) =>
													next
														? [...current, suggestion.id]
														: current.filter((id) => id !== suggestion.id),
												)
											}
										/>
										<WorkItemTypeIcon type={suggestion.type} />
										<span className="min-w-0 flex-1">{suggestion.summary}</span>
									</label>
								);
							})}
						</SuggestionPanel>
					</TabsContent>

					<TabsContent value="existing" className="flex max-h-[24rem] flex-col gap-2.5 overflow-y-auto p-2.5">
						<PopoverSubmitField
							ariaLabel="Search existing work items"
							leading={
								<span className="shrink-0 pl-1 text-icon-subtlest">
									<SearchIcon label="" color="currentColor" />
								</span>
							}
							onChange={setQuery}
							onSubmit={() => {
								const [first] = existing;
								if (first) add({ ...first });
							}}
							placeholder="Search existing work items"
							submitLabel="Add first matching work item"
							value={query}
						/>

						<section className="flex flex-col gap-0.5">
							<h3 className={CONTEXT_POPOVER_SECTION_HEADING_CLASS}>{trimmedQuery ? "Results" : "Recent issues"}</h3>
							{existing.length > 0 ? (
								existing.map((item) => (
									<button
										key={item.key}
										type="button"
										onClick={() => add({ ...item })}
										className={CONTEXT_POPOVER_ROW_CLASS}
									>
										<WorkItemTypeIcon type={item.type} />
										<span className="min-w-0 flex-1 truncate">
											{item.key} {item.summary}
										</span>
									</button>
								))
							) : (
								<p className="px-2 py-2 text-sm text-text-subtlest">No matching work items.</p>
							)}
						</section>
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
}
