import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import AppIcon from "@atlaskit/icon/core/app";
import BranchIcon from "@atlaskit/icon/core/branch";
import CommitIcon from "@atlaskit/icon/core/commit";
import EditIcon from "@atlaskit/icon/core/edit";
import ProjectStatusIcon from "@atlaskit/icon/core/project-status";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import StopwatchIcon from "@atlaskit/icon/core/stopwatch";
import TagIcon from "@atlaskit/icon/core/tag";
import PersonAssigneeIcon from "@atlaskit/icon-lab/core/person-assignee";
import TeamworkGraphIcon from "@atlaskit/icon-lab/core/teamwork-graph";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { activityActorVpkLogo } from "./jira-activity-actor-mention";
import type { JiraActivityActor, JiraActivityEventIcon } from "./jira-activity-types";

// All ADS core icons share one signature, so `typeof AddIcon` types the whole map.
const EVENT_ICON: Record<JiraActivityEventIcon, typeof AddIcon> = {
	created: AddIcon,
	assigned: PersonAssigneeIcon,
	label: TagIcon,
	sla: StopwatchIcon,
	status: ProjectStatusIcon,
	delegated: AiAgentIcon,
	"in-progress": ProjectStatusIcon,
	linked: BranchIcon,
	description: AlignTextLeftIcon,
	edit: EditIcon,
	"teamwork-graph": TeamworkGraphIcon,
	commit: CommitIcon,
	"pull-request": PullRequestIcon,
	app: AppIcon,
};

function initialsOf(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase())
			.join("") || "?"
	);
}

function ActorGlyph({
	actor,
	animate,
	sizePx,
}: Readonly<{
	actor: JiraActivityActor;
	/** `false` skips the avatar's enter scale/fade for high-frequency surfaces such as a scrubber. */
	animate?: boolean;
	sizePx: 16 | 32;
}>) {
	if (actor.kind === "person") {
		// Card leads are named in the adjacent header copy; event glyphs keep an accessible label.
		return sizePx === 32 ? (
			<Avatar animate={animate} aria-hidden size="default">
				{actor.avatarSrc ? <AvatarImage alt="" src={actor.avatarSrc} /> : null}
				<AvatarFallback>{initialsOf(actor.name)}</AvatarFallback>
			</Avatar>
		) : (
			<Avatar animate={animate} label={actor.name} size="xs">
				{actor.avatarSrc ? <AvatarImage alt="" src={actor.avatarSrc} /> : null}
				<AvatarFallback>{initialsOf(actor.name)}</AvatarFallback>
			</Avatar>
		);
	}

	// Agents render as hexagon art; apps render their third-party brand mark.
	return (
		<AgentAvatarVisual
			animate={animate}
			appearance={actor.appearance}
			avatarSrc={actor.avatarSrc}
			brandName={actor.brandName}
			fallbackText={initialsOf(actor.name)}
			label={actor.name}
			sizePx={sizePx}
			vpkLogo={activityActorVpkLogo(actor)}
		/>
	);
}

function EventGlyph({ icon }: Readonly<{ icon: JiraActivityEventIcon }>) {
	const IconComponent = EVENT_ICON[icon];
	return (
		<Icon
			aria-hidden
			className="text-icon-subtle"
			render={<IconComponent color="currentColor" label="" size="small" />}
		/>
	);
}

/** The 16px glyph an event row leads with: its semantic icon when set, else the actor avatar. */
export function JiraActivityEntryGlyph({ actor, animate, icon }: Readonly<{ actor: JiraActivityActor; animate?: boolean; icon?: JiraActivityEventIcon }>) {
	return icon !== undefined ? <EventGlyph icon={icon} /> : <ActorGlyph actor={actor} animate={animate} sizePx={16} />;
}

/**
 * Leading timeline cell: event glyph or card-sized actor avatar above a `w-px`
 * connector. Card entries place their size-8 identity in an `h-10` track (4px
 * clearance above/below, matching event glyphs in `h-6`) so the spine — a
 * sibling that only starts after the track — never sits flush on the icon.
 * That structural break is the timeline gap; opaque spine covers must not
 * stack on top of it. Event copy beside this track uses `min-h-6` so mention
 * chips can grow past 24px without changing this icon track. The avatar
 * optically centers with the stacked name/timestamp header. Content stays in
 * the un-offset text column; the in-thread reply composer pulls back across
 * this slot to share the avatar edge. Spine lifted from
 * `components/ui/progress-tracker.tsx`.
 */
export function JiraActivityNode({
	actor,
	icon,
	isLast,
	size = "event",
	tone = "timeline",
}: Readonly<{
	actor: JiraActivityActor;
	icon?: JiraActivityEventIcon;
	isLast: boolean;
	/** `thread` paints the stem in the opaque thread-line color, so it reads as one line where it meets a thread's own connector. */
	tone?: "timeline" | "thread";
	/** `card` centers a size-8 avatar in h-10; `event` centers a 16px glyph in h-6. */
	size?: "event" | "card";
}>) {
	const isCard = size === "card";

	return (
		<div className="flex w-8 shrink-0 flex-col items-center">
			<div
				className={cn(
					"flex shrink-0 items-center justify-center",
					// Card: 32px avatar in 40px → 4px spine gap. Event: 16px in 24px → 4px.
					isCard ? "h-10" : "h-6",
				)}
			>
				{/*
				 * Event rows: prefer the semantic EventGlyph whenever `icon` is set
				 * (commit / pull-request / app / …). ActorGlyph (incl. hexagon
				 * AgentAvatarVisual) is only the fallback when no icon is provided.
				 * Card rows always use the actor avatar in the larger track.
				 */}
				{isCard ? (
					<ActorGlyph actor={actor} sizePx={32} />
				) : (
					<JiraActivityEntryGlyph actor={actor} icon={icon} />
				)}
			</div>
			{isLast ? null : <div className={cn("min-h-4 w-px flex-1", tone === "thread" ? "bg-bg-accent-gray-subtler" : "bg-border")} data-jira-activity-timeline-stem />}
		</div>
	);
}
