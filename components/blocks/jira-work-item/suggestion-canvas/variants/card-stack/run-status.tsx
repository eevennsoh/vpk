"use client";

import Image from "next/image";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { Avatar } from "@/components/ui/avatar";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { TWGLoader } from "@/components/ui-custom/twg-loader";

/** True when the most recent re-run came back empty. */
export function lastRunFoundNothing(feed: SuggestionFeed): boolean {
	const lastRun = feed.runs.at(-1);
	return lastRun != null && feed.runs.length > 1 && lastRun.ids.length === 0;
}

function AgentMark() {
	return (
		<Avatar animate={false} shape="hexagon" size="xs">
			<span className="flex size-full items-center justify-center bg-blue-700">
				<Image alt="" className="size-2.5!" height={10} src="/1p/agent-lanyard/glyph-jira-triage.svg" width={10} />
			</span>
		</Avatar>
	);
}

/** Agent byline: who suggested and when it last ran. A re-run in flight is told by the ghost card and the trigger, not here too. */
export function RunByline({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const justNow = feed.runs.at(-1)?.ranAt === "Just now";
	return (
		<p className="flex min-h-4 items-center gap-x-1.5 text-xs leading-4 whitespace-nowrap text-text-subtlest">
			<AgentMark />
			<span className="text-text-subtle">{SUGGESTION_WORK_ITEM.agent.name}</span>
			<span aria-hidden="true">·</span>
			<time dateTime={justNow ? undefined : "PT2M"}>{justNow ? "Just now" : "2m"}</time>
			<span aria-hidden="true">·</span>
			<span className="inline-flex items-center gap-1">
				<TeamworkGraphMark className="size-3" />
				Teamwork Graph
			</span>
		</p>
	);
}

/**
 * Where the ✕ / ✓ row sits while an empty deck waits on the agent: the run's title, in the spot the controls
 * will take once the ghost turns into a card.
 */
export function CheckingLine() {
	return (
		<p className="flex items-center justify-center gap-2 text-sm text-text-subtle">
			<span aria-hidden="true" className="flex"><TWGLoader active label="" size="small" /></span>
			<Shimmer as="span" className="text-sm text-text-subtle">Checking for new suggestions…</Shimmer>
		</p>
	);
}
