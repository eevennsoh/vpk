"use client";

import CrossIcon from "@atlaskit/icon/core/cross";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { token } from "@/lib/tokens";

const AGENT_GLYPH = "url(/1p/agent-lanyard/glyph-jira-triage.svg)";

const ICON_BUTTON = "flex size-7 items-center justify-center rounded-md text-icon-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default aria-disabled:text-icon-disabled aria-disabled:hover:bg-transparent aria-disabled:hover:text-icon-disabled aria-disabled:active:bg-transparent";

/**
 * The agent's hexagon on the brand-bold surface, with its glyph painted in the inverse icon colour through a mask,
 * so both the plate and the mark are tokens and hold their contrast in light and dark.
 */
function AgentMark() {
	return (
		<Avatar animate={false} shape="hexagon" size="xs">
			<span className="flex size-full items-center justify-center bg-primary">
				<span aria-hidden="true" className="size-2.5 bg-icon-inverse" style={{ maskImage: AGENT_GLYPH, maskPosition: "center", maskRepeat: "no-repeat", maskSize: "contain" }} />
			</span>
		</Avatar>
	);
}

/** Title, an icon-only re-run, close, and who did the work. Time lives only on the run lines below. */
export function TimelineHeader({ feed, titleId, onClose }: Readonly<{ feed: SuggestionFeed; titleId: string; onClose: () => void }>) {
	const running = feed.status === "running";
	return (
		<header className="flex flex-col gap-0.5 px-5 pt-3.5 pb-2">
			<div className="flex items-center gap-2">
				<h2 className="min-w-0 flex-1 text-text" id={titleId} style={{ font: token("font.heading.xsmall") }}>Work item suggestions</h2>
				<div className="-mr-1 flex items-center gap-px">
					<Tooltip>
						{/* aria-disabled, not disabled: a disabled button drops keyboard focus to the page mid-run. */}
						<TooltipTrigger render={<button aria-disabled={running} aria-label="Run again" className={ICON_BUTTON} onClick={() => (running ? undefined : feed.rerun())} type="button" />}>
							<RefreshIcon color="currentColor" label="" size="small" />
						</TooltipTrigger>
						<TooltipContent>{running ? "Checking for new suggestions…" : "Run again"}</TooltipContent>
					</Tooltip>
					<button aria-label="Close suggestions" className={ICON_BUTTON} onClick={onClose} type="button">
						<CrossIcon color="currentColor" label="" size="small" />
					</button>
				</div>
			</div>
			<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-4 text-text-subtlest">
				<AgentMark />
				<span className="text-text-subtle">{SUGGESTION_WORK_ITEM.agent.name}</span>
				<span aria-hidden="true">·</span>
				<span className="inline-flex items-center gap-1">
					<TeamworkGraphMark className="size-3" />
					Teamwork Graph
				</span>
			</p>
		</header>
	);
}
