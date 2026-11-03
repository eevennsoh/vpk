"use client";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import EpicIcon from "@atlaskit/icon/core/epic";

import type { SuggestionValue } from "@/components/blocks/jira-suggestion/data/suggestions";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Lozenge } from "@/components/ui/lozenge";
import { Tag } from "@/components/ui/tag";

/**
 * The peek pane variant's value renderer. Every value wraps at full width; nothing is clipped,
 * clamped or ellipsised, so a reviewer always judges the whole suggestion.
 */
export function PeekValue({ value }: Readonly<{ value: SuggestionValue }>) {
	switch (value.kind) {
		case "paragraph":
			return <p className="text-sm leading-5 text-pretty text-text">{value.text}</p>;
		case "date":
			return (
				<span className="flex items-center gap-2 text-sm leading-5 text-text">
					<span className="flex size-6 shrink-0 items-center justify-center text-icon-subtle"><CalendarIcon color="currentColor" label="" size="small" /></span>
					<span>{value.display}</span>
					<span className="text-text-subtlest">{value.relative}</span>
				</span>
			);
		case "person":
			return (
				<span className="flex items-center gap-2">
					<Avatar animate={false} size="sm"><AvatarImage alt="" src={value.person.avatarUrl} /></Avatar>
					<span className="flex min-w-0 flex-col">
						<span className="text-sm leading-5 text-text">{value.person.name}</span>
						<span className="text-xs leading-4 text-pretty text-text-subtlest">{value.person.role}</span>
					</span>
				</span>
			);
		case "issue":
			return (
				<span className="flex items-start gap-2 text-sm leading-5 text-text">
					<span className="flex size-6 shrink-0 items-center justify-center text-icon-accent-purple"><EpicIcon color="currentColor" label="Epic" size="small" /></span>
					<span className="min-w-0 pt-0.5 text-pretty">
						<span className="mr-1.5 font-medium text-text-subtle">{value.issue.key}</span>
						{value.issue.summary}
						<Lozenge className="ml-1.5 align-[1px]" variant={value.issue.status === "Done" ? "success" : value.issue.status === "In progress" ? "information" : "neutral"}>{value.issue.status}</Lozenge>
					</span>
				</span>
			);
		case "labels":
			return (
				<span className="flex flex-wrap gap-1">
					{value.labels.map((label) => <Tag key={label}>{label}</Tag>)}
				</span>
			);
		case "checklist":
			return (
				<ul className="flex flex-col gap-1.5">
					{value.items.map((item) => (
						<li className="flex gap-2 text-sm leading-5 text-pretty text-text" key={item}>
							<span className="flex h-5 w-4 shrink-0 items-center justify-center text-icon-subtlest"><CheckMarkIcon color="currentColor" label="" size="small" /></span>
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
