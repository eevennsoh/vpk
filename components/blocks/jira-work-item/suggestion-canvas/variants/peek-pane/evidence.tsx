"use client";

import Image from "next/image";
import ClockIcon from "@atlaskit/icon/core/clock";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import type { SuggestionEvidence } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
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
			return <ConfluenceIcon appearance="brand" label={KIND_LABEL.confluence} size="xsmall" />;
		case "loom":
			return <LoomIcon appearance="brand" label={KIND_LABEL.loom} size="xsmall" />;
		case "jira":
			return <JiraIcon appearance="brand" label={KIND_LABEL.jira} size="xsmall" />;
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
		<blockquote className="mt-1.5 border-l-2 border-border pl-2.5 text-xs leading-4.5 text-pretty text-text-subtle">
			&ldquo;{children}&rdquo;
		</blockquote>
	);
}

/** The presenter's name is the part of the meta line before the first separator. */
function presenterOf(meta: string): string {
	return meta.split(" · ")[0] ?? meta;
}

/**
 * A Loom recording preview kept plain, the way Loom frames one: a soft gradient, the presenter's bubble, a play
 * affordance and the length. No faux window chrome.
 */
function LoomThumbnail({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<div aria-hidden="true" className="relative mt-2 h-21 overflow-hidden rounded-md bg-linear-to-br from-purple-200 via-purple-100 to-blue-100">
			<span className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-overlay text-icon" style={{ boxShadow: token("elevation.shadow.overlay") }}>
				<VideoPlayIcon color="currentColor" label="" size="small" />
			</span>
			<Image alt="" className="absolute bottom-2 left-2 size-8 rounded-full object-cover ring-2 ring-surface" height={32} src={projectButterPersonAvatar(presenterOf(evidence.meta))} width={32} />
			<span className="absolute right-2 bottom-2 rounded-sm bg-bg-neutral-bold px-1.5 text-xs leading-4 font-medium text-text-inverse tabular-nums">{evidence.duration}</span>
		</div>
	);
}

/**
 * One source, set as quiet type rather than a boxed card: icon, then title, meta, media and quote on one text column.
 * Only Loom earns a visual, because the recording is the evidence.
 */
export function EvidenceItem({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<div className="flex flex-col">
			<div className="flex gap-2.5">
				<span className="mt-0.5 shrink-0"><EvidenceMark kind={evidence.kind} /></span>
				<div className="min-w-0 flex-1">
					<p className="text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</p>
					<p className="text-xs leading-4 text-pretty text-text-subtlest">{evidence.meta}</p>
					{evidence.kind === "loom" ? <LoomThumbnail evidence={evidence} /> : null}
					{evidence.excerpt ? <Excerpt>{evidence.excerpt}</Excerpt> : null}
				</div>
			</div>
		</div>
	);
}
