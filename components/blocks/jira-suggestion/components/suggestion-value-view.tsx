"use client";

import EpicIcon from "@atlaskit/icon/core/epic";
import CalendarIcon from "@atlaskit/icon/core/calendar";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Lozenge } from "@/components/ui/lozenge";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { SuggestionRainbowText } from "@/components/blocks/jira-work-item/project-butter/suggestion-rainbow-text";

import type { SuggestionValue } from "../data/suggestions";

/**
 * Full rendering of a suggested value. Text wraps; nothing is clipped or ellipsised.
 * Variants may compose their own renderers, but must keep the same no-truncation guarantee.
 */
export function SuggestionValueView({ value, className, reveal = false }: Readonly<{ value: SuggestionValue; className?: string; reveal?: boolean }>) {
	const text = (value: string) => reveal ? <SuggestionRainbowText text={value} /> : value;
	switch (value.kind) {
		case "paragraph":
			return <p className={cn("text-sm text-pretty text-text", className)}>{text(value.text)}</p>;
		case "date":
			return (
				<span className={cn("inline-flex items-center gap-2 text-sm text-text", className)}>
					<CalendarIcon label="" size="small" />
					{text(value.display)}
					<span className="text-text-subtlest">{value.relative}</span>
				</span>
			);
		case "person":
			return (
				<span className={cn("inline-flex items-center gap-2 text-sm text-text", className)}>
					<Avatar size="xs"><AvatarImage alt="" src={value.person.avatarUrl} /></Avatar>
					{text(value.person.name)}
				</span>
			);
		case "issue":
			return (
				<span className={cn("flex items-start gap-2 text-sm text-text", className)}>
					<span className="mt-0.5 shrink-0 text-icon-accent-purple"><EpicIcon color="currentColor" label="Epic" size="small" /></span>
					<span className="min-w-0 text-pretty">
						<span className="mr-1.5 font-medium text-text-subtle">{text(value.issue.key)}</span>
						{text(value.issue.summary)}
					</span>
					<Lozenge className="mt-px shrink-0" variant={value.issue.status === "Done" ? "success" : value.issue.status === "In progress" ? "information" : "neutral"}>{value.issue.status}</Lozenge>
				</span>
			);
		case "labels":
			return (
				<span className={cn("flex flex-wrap gap-1", className)}>
					{value.labels.map((label) => <Tag key={label}>{text(label)}</Tag>)}
				</span>
			);
		case "checklist":
			return (
				<ul className={cn("flex list-disc flex-col gap-1 pl-4 text-sm text-pretty text-text marker:text-text-subtlest", className)}>
					{value.items.map((item) => <li key={item}>{text(item)}</li>)}
				</ul>
			);
		default: {
			const unreachable: never = value;
			return unreachable;
		}
	}
}
