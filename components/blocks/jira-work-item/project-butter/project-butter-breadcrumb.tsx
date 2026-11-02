"use client";

import { useEffect, useRef, useState } from "react";
import EpicIcon from "@atlaskit/icon/core/epic";
import LinkIcon from "@atlaskit/icon/core/link";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import StoryIcon from "@atlaskit/icon/core/story";
import TaskIcon from "@atlaskit/icon/core/task";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function WorkItemKeyCopy({ code }: Readonly<{ code: string }>) {
	const [feedback, setFeedback] = useState<"idle" | "copied" | "error">("idle");
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const anchor = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (feedback === "idle") return;
		const timer = window.setTimeout(() => { setFeedback("idle"); setTooltipOpen(false); }, 1800);
		return () => window.clearTimeout(timer);
	}, [feedback]);
	async function copyKey() {
		try {
			await navigator.clipboard.writeText(code);
			setFeedback("copied");
		} catch {
			setFeedback("error");
		}
		setTooltipOpen(true);
	}
	const label = feedback === "copied" ? "Work item key copied" : feedback === "error" ? "Could not copy work item key" : "Copy work item key";
	return <>
		<Tooltip onOpenChange={setTooltipOpen} open={feedback !== "idle" || tooltipOpen}>
			<TooltipTrigger delay={0} render={<button aria-label={label} className="group/key inline-flex shrink-0 cursor-pointer items-center rounded-sm bg-transparent p-0 text-inherit outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-project-butter-key onClick={() => { void copyKey(); }} type="button" />}>
				<span ref={anchor}>{code}</span>
				<span aria-hidden className={cn("inline-flex max-w-0 shrink-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-normal ease-out-practical group-hover/key:max-w-6 group-hover/key:opacity-100 group-focus-visible/key:max-w-6 group-focus-visible/key:opacity-100", feedback !== "idle" && "max-w-6 opacity-100")} data-project-butter-key-copy-icon>
					<span className={cn("ml-1 inline-flex size-4 items-center justify-center", feedback === "copied" ? "text-icon-success" : "text-text-subtle")}>
						{feedback === "copied" ? <StatusSuccessIcon label="" size="small" /> : <LinkIcon label="" size="small" />}
					</span>
				</span>
			</TooltipTrigger>
			<TooltipContent anchor={anchor} positionerClassName="z-[650]" side="top">{label}</TooltipContent>
		</Tooltip>
		<span className="sr-only" role="status">{feedback === "idle" ? "" : label}</span>
	</>;
}

const TRAIL_CLASS_NAME = "min-w-0 opacity-0 transition-opacity duration-normal ease-out-practical group-hover/butter-breadcrumb:opacity-100 group-focus-within/butter-breadcrumb:opacity-100";

export function ProjectButterBreadcrumb({ aligned = false, code, parent, summary }: Readonly<{ aligned?: boolean; code: string; parent?: string; summary: string }>) {
	const parentLabel = parent?.trim();
	return (
		<Breadcrumb className={cn("group/butter-breadcrumb flex h-8 min-w-0 flex-1 items-center overflow-visible", aligned ? null : "mb-1")} size="small">
			<BreadcrumbList className="h-8 min-h-0 gap-2 overflow-visible text-text-subtle">
				<BreadcrumbItem className="shrink-0 gap-2">
					<span className="inline-flex shrink-0 items-center leading-none text-icon-success"><StoryIcon label="Story" size="small" /></span>
					<WorkItemKeyCopy code={code} key={code} />
				</BreadcrumbItem>
				{parentLabel ? <>
					<BreadcrumbItem className={cn("max-w-[240px] shrink gap-1", TRAIL_CLASS_NAME)} data-project-butter-breadcrumb-trail>
						<span aria-hidden className="inline-flex shrink-0 text-icon-accent-purple"><EpicIcon label="" size="small" /></span>
						<span className="truncate">{parentLabel}</span>
					</BreadcrumbItem>
					<BreadcrumbSeparator className={cn("shrink-0 px-0", TRAIL_CLASS_NAME)} data-project-butter-breadcrumb-trail />
				</> : null}
				<BreadcrumbItem className={cn("flex-1 overflow-hidden", TRAIL_CLASS_NAME)} data-project-butter-breadcrumb-trail>
					<BreadcrumbPage className="gap-1 text-text-subtle">
						<span aria-hidden className="inline-flex shrink-0 text-icon-brand"><TaskIcon label="" size="small" /></span>
						<span className="truncate">{summary}</span>
					</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
