"use client";

import Image from "next/image";
import ClockIcon from "@atlaskit/icon/core/clock";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import type { SuggestionEvidence } from "@/components/blocks/jira-suggestion/data/suggestions";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { ConfluenceIcon, JiraIcon, LoomIcon } from "@/components/ui/logo";
import { SlackLogo } from "@/components/ui/logo-third-party";
import { Tile } from "@/components/ui/tile";
import { token } from "@/lib/tokens";

export const EVIDENCE_KIND_LABEL: Readonly<Record<SuggestionEvidence["kind"], string>> = {
	confluence: "Confluence page",
	loom: "Loom video",
	jira: "Jira",
	slack: "Slack message",
	history: "Work history",
};

/** Product logo for a source; work history has no product, so it gets a neutral clock tile. */
export function EvidenceMark({ kind, decorative = false }: Readonly<{ kind: SuggestionEvidence["kind"]; decorative?: boolean }>) {
	const label = decorative ? "" : EVIDENCE_KIND_LABEL[kind];
	switch (kind) {
		case "confluence":
			return <ConfluenceIcon label={label} size="xxsmall" />;
		case "loom":
			return <LoomIcon label={label} size="xxsmall" />;
		case "jira":
			return <JiraIcon label={label} size="xxsmall" />;
		case "slack":
			return <SlackLogo label={label} size="xxsmall" />;
		case "history":
			return (
				<Tile className="text-icon-subtle" label={label} size="xxsmall" variant="neutral">
					<ClockIcon color="currentColor" label="" size="small" />
				</Tile>
			);
		default: {
			const unreachable: never = kind;
			return unreachable;
		}
	}
}

function Excerpt({ children }: Readonly<{ children: string }>) {
	return (
		<blockquote className="mt-1.5 border-l-2 border-border pl-2.5 text-xs leading-[18px] text-pretty text-text-subtle">
			&ldquo;{children}&rdquo;
		</blockquote>
	);
}

/** The presenter's name is the part of the meta line before the first separator. */
function presenterOf(meta: string): string {
	return meta.split(" · ")[0] ?? meta;
}

/** A Loom source: a small recording thumbnail with the presenter bubble and length beside its title, then the quote. */
function LoomSource({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	const presenter = presenterOf(evidence.meta);
	return (
		<div className="flex flex-col">
			<div className="flex items-start gap-2.5">
				<div aria-hidden="true" className="relative h-[48px] w-[78px] shrink-0 overflow-hidden rounded-md bg-linear-to-br from-purple-100 via-blue-100 to-teal-100" style={{ boxShadow: token("elevation.shadow.raised") }}>
					<div className="absolute inset-x-2 top-1.5 bottom-0 flex flex-col gap-1 rounded-t-sm bg-surface/85 px-1.5 pt-1.5">
						<span className="h-1 w-2/5 rounded-full bg-bg-neutral-bold/25" />
						<span className="h-0.5 w-4/5 rounded-full bg-bg-neutral" />
						<span className="h-0.5 w-3/5 rounded-full bg-bg-neutral" />
					</div>
					<span className="absolute top-1/2 left-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-overlay text-icon" style={{ boxShadow: token("elevation.shadow.overlay") }}>
						<VideoPlayIcon color="currentColor" label="" size="small" />
					</span>
					<Image alt="" className="absolute bottom-1 left-1 size-4 rounded-full object-cover ring-1 ring-surface" height={16} src={projectButterPersonAvatar(presenter)} width={16} />
					<span className="absolute right-1 bottom-1 rounded-xs bg-bg-neutral-bold px-1 text-[10px] leading-3.5 font-medium text-text-inverse tabular-nums">{evidence.duration}</span>
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</p>
					<div className="flex items-start gap-1 text-xs leading-4 text-text-subtlest">
						<span className="flex h-4 shrink-0 items-center"><EvidenceMark kind={evidence.kind} /></span>
						<span className="min-w-0">{evidence.meta}</span>
					</div>
				</div>
			</div>
			{evidence.excerpt ? <Excerpt>{evidence.excerpt}</Excerpt> : null}
		</div>
	);
}

function SourceText({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<div className="min-w-0 flex-1">
			<p className="flex items-start gap-1.5 text-sm leading-5 font-medium text-pretty text-text">
				<span className="mt-0.5 shrink-0"><EvidenceMark kind={evidence.kind} /></span>
				<span className="min-w-0">{evidence.title}</span>
			</p>
			<p className="text-xs leading-4 text-text-subtlest">{evidence.meta}</p>
			{evidence.excerpt ? <Excerpt>{evidence.excerpt}</Excerpt> : null}
		</div>
	);
}

/** One source inside the why card. Hairline-free: spacing alone separates sources. */
export function EvidenceSource({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return evidence.kind === "loom" ? <LoomSource evidence={evidence} /> : <SourceText evidence={evidence} />;
}
