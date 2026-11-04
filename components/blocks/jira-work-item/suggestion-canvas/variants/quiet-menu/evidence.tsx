"use client";

import ClockIcon from "@atlaskit/icon/core/clock";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { ConfluenceIcon, JiraIcon, LoomIcon } from "@/components/ui/logo";
import { SlackLogo } from "@/components/ui/logo-third-party";
import { Tile } from "@/components/ui/tile";

import type { SuggestionEvidence } from "@/components/blocks/jira-suggestion/data/suggestions";
import { KeepKeys } from "./keep-keys";

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

/** One source line: product mark, title, meta, and the quoted passage. No card chrome. */
export function EvidenceItem({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	/** Some meta lines already carry the Loom length ("Andrew Park · 30 min"); show it once, as the play chip. */
	const meta = evidence.duration ? evidence.meta.split(" · ").filter((part) => part !== evidence.duration).join(" · ") : evidence.meta;
	return (
		<li className="flex gap-2.5">
			<span className="mt-0.5 shrink-0"><EvidenceMark kind={evidence.kind} /></span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-sm leading-5 text-pretty text-text"><KeepKeys text={evidence.title} /></p>
				<p className="flex flex-wrap items-center gap-x-1.5 text-xs leading-4 text-text-subtlest">
					{meta ? <span><KeepKeys text={meta} /></span> : null}
					{evidence.duration ? (
						<span className="inline-flex items-center gap-0.5 text-text-subtle tabular-nums">
							<VideoPlayIcon color="currentColor" label="" size="small" />
							{evidence.duration}
						</span>
					) : null}
				</p>
				{evidence.excerpt ? (
					<blockquote className="mt-1 border-l-2 border-border pl-2.5 text-xs leading-5 text-pretty text-text-subtle">
						&ldquo;<KeepKeys text={evidence.excerpt} />&rdquo;
					</blockquote>
				) : null}
			</div>
		</li>
	);
}
