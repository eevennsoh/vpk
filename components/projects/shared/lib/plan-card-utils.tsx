"use client";

import { useMemo } from "react";

import { PlanSummary, usePlan } from "@/components/ui/plan";
import { MessageResponse } from "@/components/ui-custom/message-markdown";
import { cn } from "@/lib/utils";

function stripLeadingMarkdownRule(value: string): string {
	return value.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*(?:\r?\n)+/, "").trimStart();
}

export interface PlanTabContentProps {
	description: string;
	markdown?: string;
	emptySummaryMessage?: string;
	summaryShowMoreLabel?: string;
	className?: string;
	summaryTabContentClassName?: string;
}

/** The Plan card's markdown summary body: `markdown` (or `description`) rendered in a collapsed PlanSummary. */
export const PlanTabContent = ({
	description,
	markdown = "",
	emptySummaryMessage = "No description provided.",
	summaryShowMoreLabel = "Show more",
	className,
	summaryTabContentClassName,
}: Readonly<PlanTabContentProps>) => {
	const { isStreaming } = usePlan();
	const normalizedSummaryMarkdown = useMemo(() => {
		const rawContent = markdown.trim().length > 0 ? markdown : description;
		const stripped = stripLeadingMarkdownRule(rawContent);
		return stripped && !stripped.endsWith("\n") ? `${stripped}\n` : stripped;
	}, [description, markdown]);
	const content = normalizedSummaryMarkdown.trim().length > 0 ? normalizedSummaryMarkdown : emptySummaryMessage;

	return (
		<div className={cn("gap-4", className)}>
			<div className={cn("px-4 pb-4", summaryTabContentClassName)}>
				<PlanSummary showMoreLabel={summaryShowMoreLabel}>
					<MessageResponse
						className="size-full text-sm leading-5 text-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-7 [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-6 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:leading-5 [&_h3]:font-semibold [&_p]:my-0"
						isAnimating={isStreaming}
					>
						{content}
					</MessageResponse>
				</PlanSummary>
			</div>
		</div>
	);
};
