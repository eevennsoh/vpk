"use client";

import type { ComponentType } from "react";
import type { NewCoreIconProps } from "@atlaskit/icon/types";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import EpicIcon from "@atlaskit/icon/core/epic";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import PersonIcon from "@atlaskit/icon/core/person";
import TagIcon from "@atlaskit/icon/core/tag";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { SuggestionConfidence, SuggestionFieldId, SuggestionValue, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

type IconComponent = ComponentType<NewCoreIconProps>;

export const FIELD_ICONS: Readonly<Record<SuggestionFieldId, IconComponent>> = {
	description: AlignTextLeftIcon,
	assignee: PersonIcon,
	dueDate: CalendarIcon,
	parent: EpicIcon,
	labels: TagIcon,
	acceptanceCriteria: ListChecklistIcon,
};

/** "Why we suggested Robi Lopez", phrased around the value when it is short enough to name. */
export function whyTitle(suggestion: WorkItemSuggestion): string {
	const { value } = suggestion;
	switch (value.kind) {
		case "person":
			return `Why we suggested ${value.person.name}`;
		case "date":
			return `Why we suggested ${value.display}`;
		case "issue":
			return `Why we suggested ${value.issue.key}`;
		case "labels":
			return "Why we suggested these labels";
		default:
			return `Why we suggested this ${suggestion.label.toLowerCase()}`;
	}
}

const CONFIDENCE_COPY: Readonly<Record<SuggestionConfidence, { label: string; filled: number; bar: string; text: string }>> = {
	high: { label: "High confidence", filled: 3, bar: "bg-icon-success", text: "text-text-success" },
	medium: { label: "Medium confidence", filled: 2, bar: "bg-icon-warning", text: "text-text-warning" },
};

/** Three ascending bars plus a label. The label carries the meaning; the bars are decoration. */
export function ConfidenceMeter({ confidence, className }: Readonly<{ confidence: SuggestionConfidence; className?: string }>) {
	const copy = CONFIDENCE_COPY[confidence];
	return (
		<span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap", copy.text, className)}>
			<span aria-hidden="true" className="flex h-3 items-end gap-0.5">
				{[0, 1, 2].map((index) => (
					<span
						className={cn("w-[3px] rounded-full", index < copy.filled ? copy.bar : "bg-bg-neutral-hovered")}
						key={index}
						style={{ height: `${6 + index * 3}px` }}
					/>
				))}
			</span>
			{copy.label}
		</span>
	);
}

function MiniCalendar({ iso }: Readonly<{ iso: string }>) {
	const date = new Date(`${iso}T12:00:00`);
	const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
	return (
		<span aria-hidden="true" className="flex w-11 shrink-0 flex-col rounded-lg bg-surface text-center ring-1 ring-border ring-inset">
			<span className="rounded-t-lg bg-destructive py-px text-[10px] leading-4 font-semibold tracking-wide text-text-inverse uppercase">{month}</span>
			<span className="py-0.5 text-lg leading-6 font-semibold text-text tabular-nums">{date.getDate()}</span>
		</span>
	);
}

/**
 * The suggested value at reading size. Every branch wraps: no truncation, clamping or clipping.
 * `size="compact"` is used inside popovers where the value is a reminder, not the focus.
 */
export function DeckValue({ value, muted = false, size = "large" }: Readonly<{ value: SuggestionValue; muted?: boolean; size?: "large" | "compact" }>) {
	const tone = muted ? "text-text-subtle" : "text-text";
	const body = size === "large" ? "text-base leading-6" : "text-sm leading-5";
	switch (value.kind) {
		case "paragraph":
			return <p className={cn("text-pretty", body, tone)}>{value.text}</p>;
		case "date":
			return (
				<span className={cn("flex items-center gap-3", tone)}>
					{size === "large" ? <MiniCalendar iso={value.iso} /> : <CalendarIcon label="" size="small" />}
					<span className="flex flex-col">
						<span className={cn("font-medium", body)}>{value.display}</span>
						<span className="text-xs text-text-subtlest">Due {value.relative}</span>
					</span>
				</span>
			);
		case "person":
			return (
				<span className={cn("flex items-center gap-3", tone)}>
					<Avatar size={size === "large" ? "lg" : "sm"}><AvatarImage alt="" src={value.person.avatarUrl} /></Avatar>
					<span className="flex min-w-0 flex-col">
						<span className={cn("font-medium", body)}>{value.person.name}</span>
						<span className="text-xs text-pretty text-text-subtlest">{value.person.role}</span>
					</span>
				</span>
			);
		case "issue":
			return (
				<span className={cn("flex items-start gap-3", tone)}>
					<span className={cn("flex shrink-0 items-center justify-center rounded-md bg-bg-accent-purple-subtler text-icon-accent-purple", size === "large" ? "size-8" : "size-6")}>
						<EpicIcon color="currentColor" label="Epic" size="small" />
					</span>
					<span className="flex min-w-0 flex-col gap-1">
						<span className={cn("text-pretty", body)}>{value.issue.summary}</span>
						<span className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
							<span className="font-medium">{value.issue.key}</span>
							<span className="rounded-sm bg-bg-information px-1 leading-4 font-semibold whitespace-nowrap text-text-information">{value.issue.status}</span>
						</span>
					</span>
				</span>
			);
		case "labels":
			return (
				<span className="flex flex-wrap gap-1.5">
					{value.labels.map((label) => (
						<span
							className={cn("inline-flex items-center rounded-md bg-bg-neutral px-2 break-words", size === "large" ? "py-1 text-sm" : "py-0.5 text-xs", tone)}
							key={label}
						>
							{label}
						</span>
					))}
				</span>
			);
		case "checklist":
			return (
				<ol className={cn("flex flex-col", size === "large" ? "gap-2.5" : "gap-1.5")}>
					{value.items.map((item, index) => (
						<li className={cn("flex items-start gap-2.5 text-pretty", body, tone)} key={item}>
							<span aria-hidden="true" className={cn("mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-bg-neutral text-xs font-semibold text-text-subtle tabular-nums", size === "large" ? "size-5" : "size-4 text-[10px]")}>
								{index + 1}
							</span>
							{item}
						</li>
					))}
				</ol>
			);
		default: {
			const unreachable: never = value;
			return unreachable;
		}
	}
}
