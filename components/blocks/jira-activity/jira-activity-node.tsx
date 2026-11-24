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
import type { ReactNode } from "react";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
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
	decorative = false,
	sizePx,
}: Readonly<{
	actor: JiraActivityActor;
	/** `false` skips the avatar's enter scale/fade for high-frequency surfaces such as a scrubber. */
	animate?: boolean;
	decorative?: boolean;
	sizePx: 16 | 24 | 32;
}>) {
	if (actor.kind === "person") {
		// Card leads are named in the adjacent header copy; event glyphs keep an accessible label.
		return sizePx === 32 ? (
			<Avatar animate={animate} aria-hidden size="default">
				{actor.avatarSrc ? <AvatarImage alt="" src={actor.avatarSrc} /> : null}
				<AvatarFallback>{initialsOf(actor.name)}</AvatarFallback>
			</Avatar>
		) : (
			<Avatar animate={animate} aria-hidden={decorative || undefined} label={decorative ? undefined : actor.name} size={sizePx === 24 ? "sm" : "xs"}>
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
export function JiraActivityEntryGlyph({ actor, animate, icon, sizePx = 16 }: Readonly<{ actor: JiraActivityActor; animate?: boolean; icon?: JiraActivityEventIcon; sizePx?: 16 | 24 }>) {
	return icon !== undefined ? <EventGlyph icon={icon} /> : <ActorGlyph actor={actor} animate={animate} sizePx={sizePx} />;
}

/**
 * Leading timeline cell: event glyph or card-sized actor avatar above a `w-px`
 * connector. Card entries use a 32px track; a 24px identity is centered in it,
 * while a 32px identity adds a 4px gap before the spine. Both match event glyphs.
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
	renderAvatar,
	attributedBy,
	icon,
	isLast,
	size = "event",
	tone = "timeline",
	actorAvatarSize = 32,
	compactConnector = false,
}: Readonly<{
	actor: JiraActivityActor;
	renderAvatar?: (avatar: ReactNode) => ReactNode;
	attributedBy?: { name: string; avatarSrc?: string };
	icon?: JiraActivityEventIcon;
	isLast: boolean;
	/** `thread` paints the stem in the opaque thread-line color, so it reads as one line where it meets a thread's own connector. */
	tone?: "timeline" | "thread";
	/** `card` uses a 32px avatar track; `event` centers a 16px glyph in h-6. */
	size?: "event" | "card";
	actorAvatarSize?: 24 | 32;
	/** Allow adjacent compact events to retain their existing row spacing. */
	compactConnector?: boolean;
}>) {
	const isCard = size === "card";
	const avatarSize = actor.kind === "agent" || actor.kind === "person" ? actorAvatarSize : 32;
	const cardAvatar = actor.kind === "agent" && attributedBy
		? <HumanAgentAvatar agent={{ name: actor.name, appearance: actor.appearance, avatarSrc: actor.avatarSrc, brandName: actor.brandName, vpkLogo: activityActorVpkLogo(actor), fallbackText: initialsOf(actor.name) }} human={attributedBy} sizePx={avatarSize} />
		: <ActorGlyph actor={actor} decorative sizePx={avatarSize} />;

	return (
		<div className="flex w-8 shrink-0 flex-col items-center">
			<div
				className={cn(
					"flex shrink-0 items-center justify-center",
					isCard ? "h-8" : "h-6",
				)}
			>
				{/*
				 * Event rows: prefer the semantic EventGlyph whenever `icon` is set
				 * (commit / pull-request / app / …). ActorGlyph (incl. hexagon
				 * AgentAvatarVisual) is only the fallback when no icon is provided.
				 * Card rows always use the actor avatar in the larger track.
				 */}
				{isCard ? (
					renderAvatar ? renderAvatar(cardAvatar) : cardAvatar
				) : (
					<JiraActivityEntryGlyph actor={actor} icon={icon} />
				)}
			</div>
			{isLast ? null : <div className={cn("w-px flex-1", compactConnector ? "min-h-0" : "min-h-4", isCard && avatarSize === 32 ? "mt-1" : null, tone === "thread" ? "bg-bg-accent-gray-subtler" : "bg-border")} data-jira-activity-timeline-stem />}
		</div>
	);
}
