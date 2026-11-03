"use client";

import EpicIcon from "@atlaskit/icon/core/epic";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { SuggestionValue } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { KeepKeys } from "./keep-keys";

/**
 * The quiet menu's value renderer: text first, almost no boxes. Every value wraps at full width;
 * nothing is clipped, clamped or ellipsised, so the reviewer always judges the whole suggestion.
 */
export function QuietValue({ value, className }: Readonly<{ value: SuggestionValue; className?: string }>) {
	switch (value.kind) {
		case "paragraph":
			return <p className={cn("text-sm leading-5 text-pretty text-text", className)}><KeepKeys text={value.text} /></p>;
		case "date":
			return (
				<p className={cn("text-sm leading-5 text-text", className)}>
					{value.display}
					<span className="ml-1.5 text-text-subtlest">{value.relative}</span>
				</p>
			);
		case "person":
			return (
				<p className={cn("flex items-start gap-2 text-sm leading-5 text-text", className)}>
					<Avatar animate={false} className="mt-0.5" size="xs"><AvatarImage alt="" src={value.person.avatarUrl} /></Avatar>
					<span className="flex min-w-0 flex-col">
						{value.person.name}
						<span className="text-xs leading-4 text-pretty text-text-subtlest">{value.person.role}</span>
					</span>
				</p>
			);
		case "issue":
			return (
				<p className={cn("flex items-start gap-2 text-sm leading-5 text-text", className)}>
					<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-icon-accent-purple"><EpicIcon color="currentColor" label="Epic" size="small" /></span>
					<span className="min-w-0 text-pretty">
						<span className="mr-1.5 whitespace-nowrap text-text-subtle tabular-nums">{value.issue.key}</span>
						{value.issue.summary}
						<span className="ml-1.5 text-text-subtlest">{value.issue.status}</span>
					</span>
				</p>
			);
		case "labels":
			return (
				<ul className={cn("flex flex-wrap gap-1", className)}>
					{value.labels.map((label) => (
						<li className="rounded-sm bg-bg-neutral px-1.5 text-xs leading-5 text-text-subtle" key={label}>{label}</li>
					))}
				</ul>
			);
		case "checklist":
			return (
				<ol className={cn("flex flex-col gap-1", className)}>
					{value.items.map((item, index) => (
						<li className="flex gap-2 text-sm leading-5 text-pretty text-text" key={item}>
							<span aria-hidden="true" className="w-2.5 shrink-0 text-right text-xs leading-5 text-text-subtlest tabular-nums">{index + 1}</span>
							<span className="min-w-0"><KeepKeys text={item} /></span>
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
