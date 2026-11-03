"use client";

import Image from "next/image";
import ClockIcon from "@atlaskit/icon/core/clock";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import type { SuggestionEvidence } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { ConfluenceIcon, JiraIcon, LoomIcon } from "@/components/ui/logo";
import { SlackLogo } from "@/components/ui/logo-third-party";
import { Tile } from "@/components/ui/tile";
import { token } from "@/lib/tokens";

const KIND_LABEL: Readonly<Record<SuggestionEvidence["kind"], string>> = {
	confluence: "Confluence page",
	loom: "Loom video",
	jira: "Jira",
	slack: "Slack message",
	history: "Work history",
};

function EvidenceMark({ kind }: Readonly<{ kind: SuggestionEvidence["kind"] }>) {
	switch (kind) {
		case "confluence":
			return <ConfluenceIcon label={KIND_LABEL.confluence} size="xsmall" />;
		case "loom":
			return <LoomIcon label={KIND_LABEL.loom} size="xsmall" />;
		case "jira":
			return <JiraIcon label={KIND_LABEL.jira} size="xsmall" />;
		case "slack":
			return <SlackLogo label={KIND_LABEL.slack} size="xsmall" />;
		case "history":
			return (
				<Tile className="text-icon-subtle" label={KIND_LABEL.history} size="xsmall" variant="neutral">
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
		<blockquote className="mt-2 border-l-2 border-border-bold pl-2.5 text-xs leading-[18px] text-pretty text-text-subtle">
			&ldquo;{children}&rdquo;
		</blockquote>
	);
}

/** The presenter's name is the part of the meta line before the first separator. */
function presenterOf(meta: string): string {
	return meta.split(" · ")[0] ?? meta;
}

/** A Loom recording preview: a faux screen-share frame, the presenter bubble, a play affordance and the length. */
function LoomEvidenceCard({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	const presenter = presenterOf(evidence.meta);
	return (
		<div className="rounded-lg bg-surface-raised" style={{ boxShadow: token("elevation.shadow.raised") }}>
			<div aria-hidden="true" className="relative m-1 mb-0 h-[100px] rounded-md bg-linear-to-br from-purple-100 via-blue-100 to-teal-100">
				<div className="absolute inset-x-5 top-3 bottom-0 flex flex-col gap-1.5 rounded-t-md bg-surface/85 px-3 pt-2.5">
					<span className="flex gap-1">
						<span className="size-1.5 rounded-full bg-red-400" />
						<span className="size-1.5 rounded-full bg-yellow-400" />
						<span className="size-1.5 rounded-full bg-lime-400" />
					</span>
					<span className="h-1.5 w-2/5 rounded-full bg-bg-neutral-bold/25" />
					<span className="h-1 w-4/5 rounded-full bg-bg-neutral" />
					<span className="h-1 w-3/5 rounded-full bg-bg-neutral" />
					<span className="h-1 w-2/3 rounded-full bg-bg-neutral" />
				</div>
				<span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-overlay text-icon" style={{ boxShadow: token("elevation.shadow.overlay") }}>
					<VideoPlayIcon color="currentColor" label="" size="small" />
				</span>
				<Image
					alt=""
					className="absolute bottom-2 left-2 size-9 rounded-full object-cover ring-2 ring-surface"
					height={36}
					src={projectButterPersonAvatar(presenter)}
					width={36}
				/>
				<span className="absolute right-2 bottom-2 rounded-sm bg-bg-neutral-bold px-1.5 py-0.5 text-[11px] leading-3.5 font-medium text-text-inverse tabular-nums">{evidence.duration}</span>
			</div>
			<div className="flex gap-2.5 px-3 pt-2.5 pb-3">
				<span className="mt-px shrink-0"><EvidenceMark kind="loom" /></span>
				<div className="min-w-0 flex-1">
					<p className="text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</p>
					<p className="text-xs leading-4 text-text-subtle">{evidence.meta}</p>
					{evidence.excerpt ? <Excerpt>{evidence.excerpt}</Excerpt> : null}
				</div>
			</div>
		</div>
	);
}

function DocumentEvidenceCard({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<div className="flex gap-2.5 rounded-lg bg-surface-raised px-3 py-2.5" style={{ boxShadow: token("elevation.shadow.raised") }}>
			<span className="mt-px shrink-0"><EvidenceMark kind={evidence.kind} /></span>
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</p>
				<p className="text-xs leading-4 text-text-subtle">{evidence.meta}</p>
				{evidence.excerpt ? <Excerpt>{evidence.excerpt}</Excerpt> : null}
			</div>
		</div>
	);
}

export function EvidenceCard({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return evidence.kind === "loom" ? <LoomEvidenceCard evidence={evidence} /> : <DocumentEvidenceCard evidence={evidence} />;
}
