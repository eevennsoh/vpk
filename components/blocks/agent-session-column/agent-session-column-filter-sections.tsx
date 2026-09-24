"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
	AvatarUnassigned,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SwitchIndicator } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { cn } from "@/lib/utils";

import {
	AGENT_SESSION_FILTER_AGENT_OPTIONS,
	AGENT_SESSION_FILTER_DAYS_PRESETS,
	AGENT_SESSION_FILTER_OWNER_FACEPILE_MAX,
	EMPTY_AGENT_SESSION_COLUMN_FILTER_DAYS,
	UNASSIGNED_OWNER_ID,
	toLocalIsoDate,
	type AgentSessionColumnFilterDays,
	type AgentSessionFilterAgentId,
	type AgentSessionFilterDaysPreset,
	type AgentSessionFilterOwner,
} from "./agent-session-column-filter";

const DAYS_PRESET_LABELS: Readonly<Record<AgentSessionFilterDaysPreset, string>> = {
	custom: "Custom",
	"last-7-days": "Last 7d",
	"last-30-days": "Last 30d",
	today: "Today",
};

export function FilterSection({
	children,
	title,
}: Readonly<{
	children: ReactNode;
	title: string;
}>): ReactElement {
	return (
		<div className="flex flex-col">
			<div className="rich-text-command-menu-heading" role="presentation">
				{title}
			</div>
			<div className="px-2">
				{children}
			</div>
		</div>
	);
}

export function FilterToggleRow({
	checked,
	label,
	onToggle,
}: Readonly<{
	checked: boolean;
	label: string;
	onToggle: () => void;
}>): ReactElement {
	return (
		<button
			aria-checked={checked}
			className={cn(
				"relative flex h-8 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-sm leading-5 text-text outline-none select-none",
				"hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed",
				"focus-visible:ring-3 focus-visible:ring-ring/50",
				"[&_[data-slot=switch-indicator]_svg]:size-full",
			)}
			onClick={onToggle}
			role="switch"
			type="button"
		>
			<span className="min-w-0 flex-1 truncate text-left">{label}</span>
			<SwitchIndicator checked={checked} size="sm" />
		</button>
	);
}

function FilterChoice({
	ariaLabel,
	label,
	onSelect,
	selected,
}: Readonly<{
	ariaLabel: string;
	label: string;
	onSelect: () => void;
	selected: boolean;
}>): ReactElement {
	return (
		<Button
			aria-label={ariaLabel}
			aria-pressed={selected}
			onClick={onSelect}
			size="compact"
			type="button"
			variant="outline"
		>
			{label}
		</Button>
	);
}

export function SessionOwnerFilterRow({
	onToggle,
	owners,
	selectedOwnerIds,
}: Readonly<{
	onToggle: (ownerId: string) => void;
	owners: readonly AgentSessionFilterOwner[];
	selectedOwnerIds: ReadonlySet<string>;
}>): ReactElement {
	const hasSelection = selectedOwnerIds.size > 0;
	const visibleOwners = owners.slice(0, AGENT_SESSION_FILTER_OWNER_FACEPILE_MAX);
	const hiddenCount = owners.length - visibleOwners.length;

	return (
		<AvatarGroup className="items-center -space-x-1.5" label="Session owners">
			{visibleOwners.map((owner) => {
				const selected = selectedOwnerIds.has(owner.id);
				const muted = hasSelection && !selected;
				const avatar = owner.id === UNASSIGNED_OWNER_ID ? (
					<AvatarUnassigned
						className={cn(
							selected && "ring-2! ring-border-selected!",
							muted && "opacity-(--opacity-disabled)",
						)}
						kind="person"
						label="Unassigned"
						size="sm"
					/>
				) : (
					<Avatar
						className={cn(
							selected && "ring-2! ring-border-selected!",
							muted && "opacity-(--opacity-disabled)",
						)}
						label={owner.name}
						size="sm"
					>
						{owner.avatarSrc === undefined
							? null
							: <AvatarImage alt="" src={owner.avatarSrc} />}
						<AvatarFallback>{owner.name.slice(0, 1)}</AvatarFallback>
					</Avatar>
				);

				return (
					<button
						aria-label={`Filter by ${owner.name}`}
						aria-pressed={selected}
						className="relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						key={owner.id}
						onClick={() => {
							onToggle(owner.id);
						}}
						type="button"
					>
						{avatar}
					</button>
				);
			})}
			{hiddenCount > 0 ? (
				<AvatarGroupCount>+{hiddenCount}</AvatarGroupCount>
			) : null}
		</AvatarGroup>
	);
}

export function AgentFilterRow({
	onToggle,
	selectedAgentIds,
}: Readonly<{
	onToggle: (agentId: AgentSessionFilterAgentId) => void;
	selectedAgentIds: ReadonlySet<string>;
}>): ReactElement {
	const hasSelection = selectedAgentIds.size > 0;

	return (
		<div className="flex items-center gap-1.5" role="group" aria-label="Agents">
			{AGENT_SESSION_FILTER_AGENT_OPTIONS.map((agent) => {
				const selected = selectedAgentIds.has(agent.id);
				return (
					<button
						aria-label={`Filter by ${agent.name}`}
						aria-pressed={selected}
						className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						key={agent.id}
						onClick={() => {
							onToggle(agent.id);
						}}
						type="button"
					>
						<AgentAvatarVisual
							avatarClassName={cn(
								selected && "[&>svg]:text-border-selected!",
								hasSelection && !selected && "opacity-(--opacity-disabled)",
							)}
							brandName={agent.brandName}
							label={agent.name}
							sizePx={24}
						/>
					</button>
				);
			})}
		</div>
	);
}

export function DaysFilterSection({
	days,
	onCalendarOpenChange,
	onChange,
}: Readonly<{
	days: AgentSessionColumnFilterDays;
	onCalendarOpenChange?: (open: boolean) => void;
	onChange: (days: AgentSessionColumnFilterDays) => void;
}>): ReactElement {
	const [calendarOpen, setCalendarOpen] = useState(false);
	const customRange: DateRange | undefined = days.customStart && days.customEnd
		? {
			from: new Date(`${days.customStart}T00:00:00`),
			to: new Date(`${days.customEnd}T00:00:00`),
		}
		: days.customStart
			? { from: new Date(`${days.customStart}T00:00:00`), to: undefined }
			: undefined;
	const customSelected = days.preset === "custom";

	return (
		<FilterSection title="Date/time range">
			<div className="flex flex-wrap gap-1.5 pb-2 min-[22rem]:flex-nowrap">
				{AGENT_SESSION_FILTER_DAYS_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
					<FilterChoice
						ariaLabel={`Date/time range: ${DAYS_PRESET_LABELS[preset]}`}
						key={preset}
						label={DAYS_PRESET_LABELS[preset]}
						onSelect={() => {
							setCalendarOpen(false);
							onCalendarOpenChange?.(false);
							onChange(
								days.preset === preset
									? EMPTY_AGENT_SESSION_COLUMN_FILTER_DAYS
									: {
										...days,
										preset,
									},
							);
						}}
						selected={days.preset === preset}
					/>
				))}
				<Popover
					onOpenChange={(nextOpen) => {
						setCalendarOpen(nextOpen);
						onCalendarOpenChange?.(nextOpen);
						if (nextOpen && days.preset !== "custom") {
							onChange({
								...days,
								preset: "custom",
							});
						}
					}}
					open={customSelected && calendarOpen}
				>
					<PopoverTrigger
						render={
							<Button
								aria-label="Date/time range: Custom"
								aria-pressed={customSelected}
								size="compact"
								type="button"
								variant="outline"
							/>
						}
					>
						Custom
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-fit max-w-[calc(100vw-32px)] p-2"
						positionerClassName="isolate z-[210]"
						side="bottom"
					>
						<PopoverTitle className="sr-only">Custom date range</PopoverTitle>
						<Calendar
							mode="range"
							numberOfMonths={2}
							onSelect={(range: DateRange | undefined) => {
								onChange({
									...days,
									customEnd: range?.to ? toLocalIsoDate(range.to) : undefined,
									customStart: range?.from ? toLocalIsoDate(range.from) : undefined,
									preset: "custom",
								});
							}}
							selected={customRange}
						/>
						<div className="flex flex-wrap items-center gap-2 px-1 pb-1">
							<TimePicker
								contentPositionerClassName="isolate z-[220]"
								onChange={(startTime) => {
									onChange({ ...days, preset: "custom", startTime });
								}}
								placeholder="Start time"
								value={days.startTime}
							/>
							<TimePicker
								contentPositionerClassName="isolate z-[220]"
								onChange={(endTime) => {
									onChange({ ...days, preset: "custom", endTime });
								}}
								placeholder="End time"
								value={days.endTime}
							/>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</FilterSection>
	);
}

