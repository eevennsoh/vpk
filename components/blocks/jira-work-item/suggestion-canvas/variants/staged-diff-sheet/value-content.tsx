"use client";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import EpicIcon from "@atlaskit/icon/core/epic";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { SuggestionIssue, SuggestionValue } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

const STATUS_TONE: Readonly<Record<SuggestionIssue["status"], string>> = {
	"To do": "border-border bg-bg-neutral text-text-subtle",
	"In progress": "border-border-information-subtle bg-bg-information-subtler text-text-information-bolder",
	Done: "border-border-success-subtle bg-bg-success-subtler text-text-success-bolder",
};

/**
 * The suggested value, rendered in full for the diff's "+" line.
 * Owned locally so every piece wraps: no truncating Tag/Lozenge internals, no clamps, no fixed heights.
 */
export function ValueContent({ value, className }: Readonly<{ value: SuggestionValue; className?: string }>) {
	switch (value.kind) {
		case "paragraph":
			return <p className={cn("text-sm/6 text-pretty text-text", className)}>{value.text}</p>;
		case "person":
			return (
				<span className={cn("flex items-center gap-2.5", className)}>
					<Avatar size="sm"><AvatarImage alt="" src={value.person.avatarUrl} /></Avatar>
					<span className="flex min-w-0 flex-col">
						<span className="text-sm font-medium text-text">{value.person.name}</span>
						<span className="text-xs text-text-subtlest">{value.person.role}</span>
					</span>
				</span>
			);
		case "date":
			return (
				<span className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-text", className)}>
					<span className="flex text-icon-subtle"><CalendarIcon color="currentColor" label="" size="small" /></span>
					<span className="font-medium">{value.display}</span>
					<span className="text-text-subtlest">{value.relative}</span>
				</span>
			);
		case "issue":
			return (
				<span className={cn("flex items-start gap-2 text-sm/5 text-text", className)}>
					<span className="mt-0.5 flex shrink-0 text-icon-accent-purple"><EpicIcon color="currentColor" label="Epic" size="small" /></span>
					<span className="min-w-0 text-pretty">
						<span className="mr-1.5 font-medium text-text-subtle">{value.issue.key}</span>
						{value.issue.summary}
						<span className={cn("ml-2 inline-flex translate-y-[-1px] items-center rounded-sm border px-1 text-xs/4 font-semibold whitespace-nowrap", STATUS_TONE[value.issue.status])}>
							{value.issue.status}
						</span>
					</span>
				</span>
			);
		case "labels":
			return (
				<span className={cn("flex flex-wrap gap-1.5", className)}>
					{value.labels.map((label) => (
						<span className="inline-flex items-center rounded-sm border border-border bg-surface px-1.5 text-xs/5 font-medium text-text" key={label}>{label}</span>
					))}
				</span>
			);
		case "checklist":
			return (
				<ul className={cn("flex flex-col gap-1.5 text-sm/5 text-pretty text-text", className)}>
					{value.items.map((item) => (
						<li className="flex gap-2.5" key={item}>
							<span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-icon-subtlest" />
							<span className="min-w-0">{item}</span>
						</li>
					))}
				</ul>
			);
		default: {
			const unreachable: never = value;
			return unreachable;
		}
	}
}
