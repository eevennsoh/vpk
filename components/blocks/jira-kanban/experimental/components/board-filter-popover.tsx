"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import Image from "next/image";
import AddIcon from "@atlaskit/icon/core/add";
import EpicIcon from "@atlaskit/icon/core/epic";
import FilterIcon from "@atlaskit/icon/core/filter";
import SearchIcon from "@atlaskit/icon/core/search";
import SprintIcon from "@atlaskit/icon/core/sprint";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import TaskIcon from "@atlaskit/icon/core/task";

import type { JiraKanbanAssigneeData } from "@/components/blocks/jira-kanban/index";
import {
	BOARD_FILTER_DAYS_OPTIONS,
	BOARD_FILTER_FIELD_LABELS,
	BOARD_FILTER_OPTIONS,
	type BoardFilterOption,
	type BoardFilterOptionIcon,
} from "../data/board-filter-options";
import type { BoardFilterActions, BoardFilterModel } from "../hooks/use-board-filter";
import {
	BOARD_FILTER_FIELD_IDS,
	toLocalIsoDate,
	type BoardFilterDaysPreset,
	type BoardFilterFieldId,
} from "../lib/board-filter";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Lozenge } from "@/components/ui/lozenge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tile } from "@/components/ui/tile";
import { ScrollMask } from "@/components/visual/scroll-mask";
import { cn } from "@/lib/utils";

const FILTER_OPTION_ICONS: Readonly<Record<BoardFilterOptionIcon, typeof EpicIcon>> = {
	epic: EpicIcon,
	sprint: SprintIcon,
	"sub-task": SubtasksIcon,
	task: TaskIcon,
};

function isTextEntryTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function FilterOptionLeadingVisual({
	compact,
	option,
}: Readonly<{
	compact?: boolean;
	option: BoardFilterOption;
}>) {
	const OptionIcon = option.icon ? FILTER_OPTION_ICONS[option.icon] : null;

	if (option.avatarSrc) {
		if (option.avatarShape === "square") {
			return (
				<Tile
					aria-hidden
					isInset={false}
					label=""
					size="xxsmall"
					variant="transparent"
				>
					<Image alt="" height={16} src={option.avatarSrc} width={16} />
				</Tile>
			);
		}

		return (
			<Avatar
				label=""
				shape={option.avatarSrc.startsWith("/avatar-agent/") ? "hexagon" : "circle"}
				size={compact ? "xs" : "sm"}
			>
				<AvatarImage alt="" src={option.avatarSrc} />
				<AvatarFallback>{option.label.slice(0, 1)}</AvatarFallback>
			</Avatar>
		);
	}

	return OptionIcon ? (
		<Icon
			aria-hidden
			className={cn("shrink-0", option.iconClassName)}
			render={<OptionIcon color="currentColor" label="" size={compact ? "small" : "medium"} />}
		/>
	) : null;
}

function FilterOptionRow({
	checked,
	onToggle,
	option,
}: Readonly<{
	checked: boolean;
	onToggle: () => void;
	option: BoardFilterOption;
}>) {
	const hasDescription = Boolean(option.description);
	const leadingVisual = <FilterOptionLeadingVisual compact={hasDescription} option={option} />;
	const tightLeading = !hasDescription && (option.avatarShape === "square" || Boolean(option.icon));
	const labelBlock = option.lozenge ? (
		<Lozenge variant={option.lozenge}>{option.label}</Lozenge>
	) : (
		<span className="min-w-0 flex-1">
			<span className="block truncate text-sm">{option.label}</span>
			{option.description ? (
				<span className="flex min-w-0 items-center gap-1">
					{leadingVisual}
					<span className="min-w-0 truncate text-xs text-text-subtle">{option.description}</span>
				</span>
			) : null}
		</span>
	);

	return (
		<label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-neutral-subtle-hovered">
			<Checkbox checked={checked} onCheckedChange={onToggle} />
			{tightLeading ? (
				<span className="flex min-w-0 flex-1 items-center gap-1.5">
					{leadingVisual}
					{labelBlock}
				</span>
			) : (
				<>
					{hasDescription ? null : leadingVisual}
					{labelBlock}
				</>
			)}
		</label>
	);
}

export function BoardFilterPopover({
	actions,
	assignees,
	compact = false,
	model,
	surfaceLabel = "board",
}: Readonly<{
	actions: BoardFilterActions;
	assignees: readonly JiraKanbanAssigneeData[];
	compact?: boolean;
	model: BoardFilterModel;
	surfaceLabel?: string;
}>) {
	const [query, setQuery] = useState("");
	const selectedField = model.selectedFieldId;
	const fieldLabel = BOARD_FILTER_FIELD_LABELS[selectedField];
	const hasSelection = model.selectedCount > 0;
	const { setOpen } = actions;

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.key !== "f" && event.key !== "F") || !event.shiftKey) {
				return;
			}
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			if (isTextEntryTarget(event.target)) {
				return;
			}
			event.preventDefault();
			setOpen(!model.open);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [model.open, setOpen]);

	useEffect(() => {
		setQuery("");
	}, [selectedField]);

	const valueOptions = useMemo((): readonly BoardFilterOption[] => {
		if (selectedField === "days" || selectedField === "assignee") {
			return [];
		}
		return BOARD_FILTER_OPTIONS[selectedField];
	}, [selectedField]);

	const assigneeOptions = useMemo(
		(): readonly BoardFilterOption[] => assignees.map((assignee) => ({
			avatarSrc: assignee.avatarSrc,
			id: assignee.id,
			label: assignee.name,
		})),
		[assignees],
	);

	const visibleValueOptions = useMemo(() => {
		const options = selectedField === "assignee" ? assigneeOptions : valueOptions;
		const normalizedQuery = query.trim().toLocaleLowerCase();
		return normalizedQuery
			? options.filter((option) => {
				const haystack = `${option.label} ${option.description ?? ""}`.toLocaleLowerCase();
				return haystack.includes(normalizedQuery);
			})
			: options;
	}, [assigneeOptions, query, selectedField, valueOptions]);

	const selectedValueIds = selectedField === "days" || selectedField === "assignee"
		? model.selectedValueIdsByField.assignee
		: model.selectedValueIdsByField[selectedField];
	const visibleSelectedCount = selectedField === "days"
		? (model.days.preset ? 1 : 0)
		: visibleValueOptions.filter((option) => selectedValueIds.includes(option.id)).length;

	const customRange: DateRange | undefined = model.days.customStart && model.days.customEnd
		? {
			from: new Date(`${model.days.customStart}T00:00:00`),
			to: new Date(`${model.days.customEnd}T00:00:00`),
		}
		: model.days.customStart
			? { from: new Date(`${model.days.customStart}T00:00:00`), to: undefined }
			: undefined;

	const handleOpenChange = (nextOpen: boolean) => {
		actions.setOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	};

	const handleSelectField = (fieldId: BoardFilterFieldId) => {
		actions.setSelectedFieldId(fieldId);
	};

	const handleToggleValue = (valueId: string) => {
		if (selectedField === "days") {
			return;
		}
		actions.toggleValue(selectedField, valueId);
	};

	const handleSelectDays = (preset: BoardFilterDaysPreset) => {
		actions.setDays(
			preset === model.days.preset && preset !== "custom"
				? { preset: null }
				: {
					customEnd: preset === "custom" ? model.days.customEnd : undefined,
					customStart: preset === "custom" ? model.days.customStart : undefined,
					preset,
				},
		);
	};

	const handleCustomRangeChange = (range: DateRange | undefined) => {
		actions.setDays({
			customEnd: range?.to ? toLocalIsoDate(range.to) : undefined,
			customStart: range?.from ? toLocalIsoDate(range.from) : undefined,
			preset: "custom",
		});
	};

	const searchPlaceholder = `Search ${fieldLabel.toLocaleLowerCase()}`;
	const showSearch = selectedField !== "days";
	const filterLabel = hasSelection
		? `Filter ${surfaceLabel}, ${model.selectedCount} selected`
		: `Filter ${surfaceLabel}`;

	return (
		<Popover onOpenChange={handleOpenChange} open={model.open}>
			<PopoverTrigger
				render={
					<Button
						aria-expanded={model.open}
						aria-label={filterLabel}
						aria-pressed={hasSelection || model.open}
						size={compact ? "icon" : undefined}
						variant="outline"
					/>
				}
			>
				<Icon render={<FilterIcon label="" />} />
				{compact ? null : "Filter"}
				{hasSelection && !compact ? <Badge variant="information">{model.selectedCount}</Badge> : null}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[640px] max-w-[calc(100vw-32px)] gap-0 overflow-hidden p-0">
				<div className="grid h-[380px] grid-cols-[220px_minmax(0,1fr)]">
					<div className="flex min-h-0 flex-col border-r border-border p-3">
						<div className="flex min-h-0 flex-1 flex-col gap-1">
							{BOARD_FILTER_FIELD_IDS.map((fieldId) => {
								const selected = fieldId === selectedField;
								return (
									<Button
										aria-current={selected ? "page" : undefined}
										className="w-full justify-start"
										key={fieldId}
										onClick={() => handleSelectField(fieldId)}
										variant={selected ? "secondary" : "ghost"}
									>
										{BOARD_FILTER_FIELD_LABELS[fieldId]}
									</Button>
								);
							})}
							{/* Prototype chrome: reads as a live control but has no handler.
							    `aria-disabled` keeps the row at full contrast and in the tab
							    order — native `disabled` would dim it to the disabled opacity
							    and drop it from keyboard reach — while still telling assistive
							    tech the action is unavailable. */}
							<Button aria-disabled className="mt-1 w-full justify-start" variant="ghost">
								<Icon data-icon="inline-start" render={<AddIcon label="" size="small" />} />
								Add field
							</Button>
						</div>
						<Button
							className="mt-2 self-start"
							disabled={!hasSelection}
							onClick={actions.clearAll}
							size="compact"
							variant="ghost"
						>
							Clear all
						</Button>
					</div>

					<div className="flex min-h-0 min-w-0 flex-col p-3">
						{showSearch ? (
							<InputGroup>
								<InputGroupAddon>
									<Icon render={<SearchIcon label="" size="small" />} />
								</InputGroupAddon>
								<InputGroupInput
									aria-label={searchPlaceholder}
									onChange={(event) => setQuery(event.target.value)}
									placeholder={searchPlaceholder}
									value={query}
								/>
							</InputGroup>
						) : null}

						<ScrollMask
							className={cn("min-h-0 flex-1 rounded-none border-0 bg-transparent", showSearch ? "mt-2" : null)}
							footer={
								<div className="flex items-center justify-between gap-3">
									<Button
										disabled={selectedField === "days" ? !model.days.preset : selectedValueIds.length === 0}
										onClick={() => actions.clearField(selectedField)}
										size="compact"
										variant="ghost"
									>
										Clear
									</Button>
									<p className="text-xs text-text-subtle">
										{selectedField === "days"
											? `${visibleSelectedCount} selected`
											: `${visibleSelectedCount} of ${visibleValueOptions.length}`}
									</p>
								</div>
							}
							footerClassName="bg-popover px-0 pb-0 pt-3"
							viewportClassName="[scrollbar-gutter:auto]"
						>
							{selectedField === "days" ? (
								<div className="flex flex-col gap-1">
									{BOARD_FILTER_DAYS_OPTIONS.map((option) => {
										const selected = model.days.preset === option.id;
										return (
											<label
												className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-neutral-subtle-hovered"
												key={option.id}
											>
												<Checkbox
													checked={selected}
													onCheckedChange={() => handleSelectDays(option.id)}
												/>
												<span className="min-w-0 truncate text-sm">{option.label}</span>
											</label>
										);
									})}
									{model.days.preset === "custom" ? (
										<div className="px-1 pt-2">
											<Calendar
												mode="range"
												onSelect={handleCustomRangeChange}
												selected={customRange}
											/>
										</div>
									) : null}
								</div>
							) : visibleValueOptions.length === 0 ? (
								<p className="px-2 py-6 text-center text-sm text-text-subtle">
									{selectedField === "assignee" ? "No assignees found" : `No ${fieldLabel.toLocaleLowerCase()} found`}
								</p>
							) : (
								visibleValueOptions.map((option) => (
									<FilterOptionRow
										checked={selectedValueIds.includes(option.id)}
										key={option.id}
										onToggle={() => handleToggleValue(option.id)}
										option={option}
									/>
								))
							)}
						</ScrollMask>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
