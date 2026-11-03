"use client";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import EpicIcon from "@atlaskit/icon/core/epic";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { SuggestionValue } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

/**
 * Full rendering of a suggested value for the inline ghost fill. Nothing truncates, clamps or clips:
 * labels are plain wrapping chips (the shared Tag truncates at 180px), and every text run wraps.
 * `provisional` softens ink so the value reads as a proposal until it is accepted.
 */
export function GhostValueView({ value, provisional }: Readonly<{ value: SuggestionValue; provisional: boolean }>) {
	const ink = cn("transition-colors duration-medium ease-out-practical", provisional ? "text-text-subtle" : "text-text");
	switch (value.kind) {
		case "paragraph":
			return <p className={cn("text-sm/6 text-pretty", ink)}>{value.text}</p>;
		case "date":
			return (
				<span className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm", ink)}>
					<span className="flex items-center gap-2">
						<span className="text-icon-subtle"><CalendarIcon color="currentColor" label="" size="small" /></span>
						{value.display}
					</span>
					<span className="text-xs text-text-subtlest">{value.relative}</span>
				</span>
			);
		case "person":
			return (
				<span className={cn("flex items-center gap-2 text-sm", ink)}>
					<Avatar size="xs"><AvatarImage alt="" src={value.person.avatarUrl} /></Avatar>
					{value.person.name}
				</span>
			);
		case "issue":
			return (
				<span className={cn("flex items-start gap-2 text-sm", ink)}>
					<span className="mt-0.5 shrink-0 text-icon-accent-purple"><EpicIcon color="currentColor" label="Epic" size="small" /></span>
					<span className="min-w-0 text-pretty">
						<span className="mr-1.5 font-medium text-text-subtle">{value.issue.key}</span>
						{value.issue.summary}
						<span className="ml-2 inline-flex translate-y-[-1px] items-center rounded-sm bg-bg-information-subtler px-1 align-middle text-[11px]/4 font-semibold text-text-information-bolder uppercase">
							{value.issue.status}
						</span>
					</span>
				</span>
			);
		case "labels":
			return (
				<span className="flex flex-wrap gap-1">
					{value.labels.map((label) => (
						<span
							className={cn(
								"inline-flex items-center rounded-sm border px-1.5 text-xs/5 transition-colors duration-medium ease-out-practical",
								provisional ? "border-border bg-surface text-text-subtle" : "border-transparent bg-bg-neutral text-text",
							)}
							key={label}
						>
							{label}
						</span>
					))}
				</span>
			);
		case "checklist":
			return (
				<ul className={cn("flex flex-col gap-1.5 text-sm/5 text-pretty", ink)}>
					{value.items.map((item) => (
						<li className="flex gap-2" key={item}>
							<span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-border-bold" />
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
