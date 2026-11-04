"use client";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import EpicIcon from "@atlaskit/icon/core/epic";
import { useLayoutEffect, useRef, useState } from "react";

import type { SuggestionValue } from "@/components/blocks/jira-suggestion/data/suggestions";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Lozenge } from "@/components/ui/lozenge";
import { Tag } from "@/components/ui/tag";

function ParagraphValue({ text }: Readonly<{ text: string }>) {
	const ref = useRef<HTMLParagraphElement>(null);
	const [scrollable, setScrollable] = useState(false);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return undefined;
		const measure = () => setScrollable(element.scrollHeight > element.clientHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [text]);
	return <p aria-label={scrollable ? "Suggested value" : undefined} className="scrollbar-thin max-h-50 overflow-y-auto overscroll-contain text-sm leading-5 text-pretty whitespace-pre-wrap text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" data-suggestion-value-scroll={scrollable ? "" : undefined} ref={ref} role={scrollable ? "region" : undefined} tabIndex={scrollable ? 0 : undefined}>{text}</p>;
}

/** Values wrap without truncation; longer paragraphs scroll within the card. */
export function CardValue({ value }: Readonly<{ value: SuggestionValue }>) {
	switch (value.kind) {
		case "paragraph":
			return <ParagraphValue text={value.text} />;
		case "date":
			return (
				<span className="flex items-center gap-2 text-sm leading-5 text-text">
					<span className="text-icon-subtle"><CalendarIcon color="currentColor" label="" size="small" /></span>
					<span>{value.display}</span>
					<span className="text-text-subtlest">{value.relative}</span>
				</span>
			);
		case "person":
			return (
				<span className="flex items-center gap-2.5">
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
					<span className="mt-0.5 shrink-0 text-icon-accent-purple"><EpicIcon color="currentColor" label="Epic" size="small" /></span>
					<span className="min-w-0 text-pretty">
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
							<span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-icon-subtlest" />
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
