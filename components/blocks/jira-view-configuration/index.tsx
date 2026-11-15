"use client";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import FlagIcon from "@atlaskit/icon/core/flag";
import PersonIcon from "@atlaskit/icon/core/person";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import TagIcon from "@atlaskit/icon/core/tag";
import TaskIcon from "@atlaskit/icon/core/task";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger,
} from "@/components/ui/combobox";
import {
	Panel, PanelActionClose, PanelBody, PanelContent, PanelHeader, PanelTitle,
} from "@/components/ui/panel";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { cn } from "@/lib/utils";

const DONE_OPTIONS = [
	{ value: "never", label: "Never" },
	{ value: "1-day", label: "1 day" },
	{ value: "7-days", label: "7 days" },
	{ value: "14-days", label: "14 days" },
	{ value: "30-days", label: "30 days" },
] as const;

const MUTE_OPTIONS = [
	{ value: "1-day", label: "1 day" },
	{ value: "2-days", label: "2 days" },
	{ value: "3-days", label: "3 days" },
	{ value: "4-days", label: "4 days" },
	{ value: "5-days", label: "5 days" },
	{ value: "6-days", label: "6 days" },
	{ value: "7-days", label: "7 days" },
	{ value: "1-week", label: "1 week" },
	{ value: "2-weeks", label: "2 weeks" },
	{ value: "3-weeks", label: "3 weeks" },
	{ value: "4-weeks", label: "4 weeks" },
] as const;

const FIELDS = [
	{ value: "agent-sessions", label: "Agent sessions", icon: AiAgentIcon },
	{ value: "assignee", label: "Assignee", icon: PersonIcon },
	{ value: "development", label: "Development", icon: AngleBracketsIcon },
	{ value: "due-date", label: "Due date", icon: CalendarIcon },
	{ value: "flagged", label: "Flagged", icon: FlagIcon },
	{ value: "work-type", label: "Work type", icon: TaskIcon },
	{ value: "priority", label: "Priority", icon: PriorityHighestIcon },
	{ value: "status", label: "Status", icon: StatusInformationIcon },
	{ value: "labels", label: "Labels", icon: TagIcon },
] as const;

export type JiraViewConfigurationField = (typeof FIELDS)[number]["value"];
export type JiraViewConfigurationValue = {
	doneAfter: (typeof DONE_OPTIONS)[number]["value"];
	muteAgentSessionsAfter: (typeof MUTE_OPTIONS)[number]["value"];
	columnWidth: "flexible" | "fixed";
	scrollMode: "columns" | "board";
	visibleFieldIds: readonly JiraViewConfigurationField[];
};

export const DEFAULT_JIRA_VIEW_CONFIGURATION: JiraViewConfigurationValue = {
	doneAfter: "14-days",
	muteAgentSessionsAfter: "1-week",
	columnWidth: "flexible",
	scrollMode: "columns",
	visibleFieldIds: ["agent-sessions", "assignee", "development", "due-date", "flagged"],
};

type Option = { readonly value: string; readonly label: string };
const choiceClassName = "font-normal aria-pressed:border-border-accent-blue aria-pressed:bg-bg-accent-blue-subtlest aria-pressed:text-text-accent-blue aria-pressed:hover:bg-bg-accent-blue-subtler";

function TimingPicker<T extends Option>({
	id, label, options, selected, onChange,
}: Readonly<{
	id: string;
	label: string;
	options: readonly T[];
	selected: T;
	onChange: (option: T) => void;
}>) {
	return (
		<div className="space-y-2">
			<label htmlFor={id} className="block text-xs text-text">{label}</label>
			<Combobox items={options} value={selected} onValueChange={(option) => {
				if (option) onChange(option);
			}}>
				<ComboboxInput id={id} className="w-full" showTrigger={false}>
					<ComboboxTrigger aria-label={`Show ${label} options`} className="mr-2 flex size-6 items-center justify-center" />
				</ComboboxInput>
				<ComboboxContent>
					<ComboboxEmpty>No options found</ComboboxEmpty>
					<ComboboxList>
						{(option: T) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</div>
	);
}

export interface JiraViewConfigurationProps {
	value: JiraViewConfigurationValue;
	onChange: (value: JiraViewConfigurationValue) => void;
	onClose: () => void;
	className?: string;
}

export function JiraViewConfiguration({ value, onChange, onClose, className }: Readonly<JiraViewConfigurationProps>) {
	const id = useId();
	const [previewWidth, setPreviewWidth] = useState<JiraViewConfigurationValue["columnWidth"] | null>(null);
	const width = previewWidth ?? value.columnWidth;
	const selectedDone = DONE_OPTIONS.find((option) => option.value === value.doneAfter) ?? DONE_OPTIONS[3];
	const selectedMute = MUTE_OPTIONS.find((option) => option.value === value.muteAgentSessionsAfter) ?? MUTE_OPTIONS[7];

	return (
		<Panel
			aria-label="View settings"
			className={cn("w-full", className)}
			onKeyDown={(event) => {
				if (event.key === "Escape" && !event.defaultPrevented) {
					event.stopPropagation();
					onClose();
				}
			}}
		>
			<PanelHeader className="px-6">
				<PanelTitle>View settings</PanelTitle>
				<PanelActionClose label="Close view settings" onClick={onClose} />
			</PanelHeader>
			<ScrollFade render={<PanelContent />} size={6}>
				<PanelBody className="space-y-6 pb-6 pt-3">
					<TimingPicker id={`${id}-done`} label="Hide done work items after" options={DONE_OPTIONS} selected={selectedDone}
						onChange={(option) => onChange({ ...value, doneAfter: option.value })} />
					<TimingPicker id={`${id}-mute`} label="Mute agent sessions after" options={MUTE_OPTIONS} selected={selectedMute}
						onChange={(option) => onChange({ ...value, muteAgentSessionsAfter: option.value })} />
					<section aria-labelledby={`${id}-columns`}>
						<h3 id={`${id}-columns`} className="text-xs font-normal">Columns</h3>
						<p className="mt-0.5 text-xs text-text-subtlest">Choose whether columns keep a fixed width or flexible to fill space.</p>
						<div aria-hidden="true" data-column-width-preview={width} className={cn(
							"mt-3 grid h-20 gap-1.5 overflow-hidden rounded-lg border border-border p-2 pb-0 transition-[grid-template-columns] duration-slow ease-in-out",
							width === "fixed" ? "grid-cols-[repeat(4,3rem)]" : "grid-cols-[repeat(4,4rem)]",
						)}>
							{[0, 1, 2, 3].map((cell) => <div key={cell} className="rounded-t-sm bg-linear-to-b from-bg-neutral from-90% to-transparent" />)}
						</div>
						<div role="group" aria-label="Column width" className="mt-3 grid grid-cols-2 gap-3">
							{(["flexible", "fixed"] as const).map((choice) => (
								<Button key={choice} variant="outline" className={choiceClassName} aria-pressed={value.columnWidth === choice}
									onMouseEnter={() => setPreviewWidth(choice)} onMouseLeave={() => setPreviewWidth(null)}
									onFocus={() => setPreviewWidth(choice)} onBlur={() => setPreviewWidth(null)}
									onClick={() => onChange({ ...value, columnWidth: choice })}>
									{choice === "flexible" ? "Flexible" : "Fixed"}
								</Button>
							))}
						</div>
					</section>
					<section aria-labelledby={`${id}-scrolling`}>
						<h3 id={`${id}-scrolling`} className="text-xs font-normal">Scrolling</h3>
						<p className="mt-0.5 text-xs text-text-subtlest">Set scrolling to individual columns or across the whole board.</p>
						<div role="group" aria-label="Board scrolling" className="mt-3 grid grid-cols-2 gap-3">
							<Button variant="outline" className={choiceClassName} aria-pressed={value.scrollMode === "columns"} onClick={() => onChange({ ...value, scrollMode: "columns" })}>Within columns</Button>
							<Button variant="outline" className={choiceClassName} aria-pressed={value.scrollMode === "board"} onClick={() => onChange({ ...value, scrollMode: "board" })}>Whole board</Button>
						</div>
					</section>
					<div>
						<label htmlFor={`${id}-fields`} className="mb-2 block text-xs">Fields</label>
						<Combobox<(typeof FIELDS)[number]> items={FIELDS} value={null} onValueChange={(field) => {
							if (field && !value.visibleFieldIds.includes(field.value)) {
								onChange({ ...value, visibleFieldIds: [...value.visibleFieldIds, field.value] });
							}
						}}>
							<ComboboxInput id={`${id}-fields`} placeholder="Add fields" className="w-full" showTrigger={false}>
								<ComboboxTrigger aria-label="Show field options" className="mr-2 flex size-6 items-center justify-center" />
							</ComboboxInput>
							<ComboboxContent>
								<ComboboxEmpty>No fields found</ComboboxEmpty>
								<ComboboxList>
									{(field: (typeof FIELDS)[number]) => (
										<ComboboxItem key={field.value} value={field} aria-selected={value.visibleFieldIds.includes(field.value)}>
											{field.label}
											{value.visibleFieldIds.includes(field.value) ? <span className="ml-auto" aria-hidden="true"><CheckMarkIcon label="" size="small" /></span> : null}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						<ul className="pt-3">
							{FIELDS.filter((field) => value.visibleFieldIds.includes(field.value)).map((field) => (
								<li key={field.value} className="group flex h-10 items-center gap-2 rounded-md px-2 hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
									<span className="flex shrink-0 text-icon-subtle"><field.icon label="" /></span>
									<span className="min-w-0 flex-1 text-sm">{field.label}</span>
									<Button variant="ghost" size="icon-compact" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" aria-label={`Remove ${field.label}`}
										onClick={() => onChange({ ...value, visibleFieldIds: value.visibleFieldIds.filter((fieldId) => fieldId !== field.value) })}>
										<CrossIcon label="" size="small" />
									</Button>
								</li>
							))}
						</ul>
					</div>
				</PanelBody>
			</ScrollFade>
		</Panel>
	);
}
