"use client";

import ClockIcon from "@atlaskit/icon/core/clock";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { ConfluenceIcon, JiraIcon, LoomIcon, type LogoSize } from "@/components/ui/logo";
import { SlackLogo } from "@/components/ui/logo-third-party";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tile } from "@/components/ui/tile";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import type { SuggestionEvidence, SuggestionEvidenceKind } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

const KIND_LABEL: Readonly<Record<SuggestionEvidenceKind, string>> = {
	confluence: "Confluence page",
	loom: "Loom video",
	jira: "Jira",
	slack: "Slack message",
	history: "Work history",
};

export function evidenceKindLabel(kind: SuggestionEvidenceKind): string {
	return KIND_LABEL[kind];
}

export function EvidenceSourceIcon({ kind, size = "small" }: Readonly<{ kind: SuggestionEvidenceKind; size?: LogoSize }>) {
	switch (kind) {
		case "confluence":
			return <ConfluenceIcon label="Confluence" size={size} />;
		case "loom":
			return <LoomIcon label="Loom" size={size} />;
		case "jira":
			return <JiraIcon label="Jira" size={size} />;
		case "slack":
			return <SlackLogo label="Slack" size={size} />;
		case "history":
			return (
				<Tile className="text-icon-subtle" hasBorder label="Work history" size={size} variant="neutral">
					<ClockIcon color="currentColor" label="" size="small" />
				</Tile>
			);
		default: {
			const unreachable: never = kind;
			return unreachable;
		}
	}
}

function authorOf(evidence: SuggestionEvidence): string {
	return evidence.meta.split(" · ")[0] ?? evidence.meta;
}

/** A Loom-style recording frame: a shared screen, the presenter bubble and the runtime. */
function LoomThumbnail({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<div aria-hidden="true" className="relative aspect-video rounded-t-lg bg-linear-to-br from-bg-accent-purple-subtler via-bg-accent-blue-subtler to-bg-accent-magenta-subtler">
			<div className="absolute inset-x-8 top-5 bottom-8 flex flex-col gap-1.5 rounded-md bg-surface p-2.5 shadow-sm">
				<span className="h-1.5 w-1/2 rounded-full bg-bg-neutral-hovered" />
				<span className="h-1 w-5/6 rounded-full bg-bg-neutral" />
				<span className="h-1 w-2/3 rounded-full bg-bg-neutral" />
				<span className="mt-1 flex gap-1.5">
					<span className="h-6 flex-1 rounded-sm bg-bg-accent-purple-subtler" />
					<span className="h-6 flex-1 rounded-sm bg-bg-accent-blue-subtler" />
					<span className="h-6 flex-1 rounded-sm bg-bg-accent-teal-subtler" />
				</span>
			</div>
			<span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-discovery text-text-inverse shadow-md">
				<VideoPlayIcon color="currentColor" label="" />
			</span>
			<span className="absolute bottom-2 left-2 rounded-full ring-2 ring-surface">
				<Avatar size="default"><AvatarImage alt="" src={projectButterPersonAvatar(authorOf(evidence))} /></Avatar>
			</span>
			{evidence.duration ? (
				<span className="absolute right-2 bottom-2 rounded-sm bg-bg-neutral-bold px-1.5 text-xs leading-5 font-medium text-text-inverse tabular-nums">{evidence.duration}</span>
			) : null}
		</div>
	);
}

function Excerpt({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	if (!evidence.excerpt) return null;
	if (evidence.kind === "slack") {
		return (
			<div className="flex items-start gap-2">
				<Avatar size="sm"><AvatarImage alt="" src={projectButterPersonAvatar(authorOf(evidence))} /></Avatar>
				<p className="flex-1 rounded-lg rounded-tl-sm bg-bg-neutral px-2.5 py-1.5 text-sm text-pretty text-text">{evidence.excerpt}</p>
			</div>
		);
	}
	return (
		<blockquote className="border-l-2 border-border-discovery bg-bg-discovery py-1.5 pr-2 pl-2.5 text-sm text-pretty text-text">
			{evidence.excerpt}
		</blockquote>
	);
}

/** The rich hover/focus/tap preview for one evidence source. */
export function EvidencePreview({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<div className="flex flex-col">
			{evidence.kind === "loom" ? <LoomThumbnail evidence={evidence} /> : null}
			<div className="flex flex-col gap-3 p-3.5">
				<div className="flex items-start gap-2.5">
					<span className="shrink-0 pt-px"><EvidenceSourceIcon kind={evidence.kind} size="xsmall" /></span>
					<div className="flex min-w-0 flex-col gap-0.5">
						<span className="text-xs text-text-subtlest">{evidenceKindLabel(evidence.kind)}{evidence.duration ? ` · ${evidence.duration}` : ""}</span>
						<span className="text-sm leading-5 font-semibold text-pretty text-text">{evidence.title}</span>
						<span className="text-xs text-text-subtle">{evidence.meta}</span>
					</div>
				</div>
				<Excerpt evidence={evidence} />
			</div>
		</div>
	);
}

/**
 * An evidence source on the focus card. Hover, keyboard focus and tap all open the same preview,
 * because the Popover trigger opens on hover and on press.
 */
export function EvidenceCard({ evidence, compact = false }: Readonly<{ evidence: SuggestionEvidence; compact?: boolean }>) {
	return (
		<Popover>
			<PopoverTrigger
				aria-label={`${evidenceKindLabel(evidence.kind)}: ${evidence.title}. Show preview`}
				className={cn(
					"group/evidence flex w-full items-start gap-2.5 rounded-lg bg-surface text-left ring-1 ring-border outline-none ring-inset transition-colors duration-xxshort ease-out-practical hover:bg-surface-hovered focus-visible:ring-2 focus-visible:ring-border-focused data-popup-open:bg-surface-hovered",
					compact ? "p-2" : "p-2.5",
				)}
				closeDelay={120}
				delay={200}
				openOnHover
				type="button"
			>
				<span className="shrink-0"><EvidenceSourceIcon kind={evidence.kind} size="small" /></span>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</span>
					<span className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-subtlest">
						{evidence.meta}
						{evidence.kind === "loom" && evidence.duration ? (
							<span className="inline-flex items-center gap-1 rounded-sm bg-bg-discovery px-1 font-medium text-text-discovery">
								<VideoPlayIcon color="currentColor" label="" size="small" />
								{evidence.duration}
							</span>
						) : null}
					</span>
				</span>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label={`Preview: ${evidence.title}`}
				className="w-[320px] gap-0 p-0"
				side="top"
				sideOffset={8}
				style={{ boxShadow: token("elevation.shadow.overlay") }}
			>
				<EvidencePreview evidence={evidence} />
			</PopoverContent>
		</Popover>
	);
}
