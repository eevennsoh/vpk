import PersonIcon from "@atlaskit/icon/core/person";

import { actorInitials } from "@/components/blocks/agent-list/agent-list-actor";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_VISIBLE_TEAMMATES = 4;

export function teammateSessionUsageLabel(count: number) {
	return count === 1 ? "Using agent" : "Using agents";
}

export function getTeammateSessionPeople(items: readonly Pick<AgentSessionItem, "invokedBy">[]) {
	const people = new Map<string, { name: string; avatarSrc: string | undefined }>();
	for (const { invokedBy } of items) {
		const name = invokedBy?.name.trim().replace(/\s+/gu, " ") ?? "";
		const avatarSrc = invokedBy?.avatarSrc?.trim() || undefined;
		// The invoker payload has no account ID. Keep different supplied faces
		// distinct even when names match; missing identities share a neutral face.
		const key = JSON.stringify([name, avatarSrc]);
		if (!people.has(key)) people.set(key, { name, avatarSrc });
	}
	return people;
}

export function TeammateSessionAvatars({ items, onAvatarClick, sizePx = 16 }: Readonly<{ items: readonly Pick<AgentSessionItem, "invokedBy">[]; onAvatarClick?: () => void; sizePx?: 16 | 20 | 24 }>) {
	const people = getTeammateSessionPeople(items);
	const visiblePeople = Array.from(people).slice(0, MAX_VISIBLE_TEAMMATES);
	const overlap = sizePx === 24 ? 8 : 4;
	const maskImage = `radial-gradient(circle at ${overlap - sizePx / 2}px 50%, transparent ${sizePx / 2 + 1.5}px, black ${sizePx / 2 + 2}px)`;
	const cutout = { maskImage, WebkitMaskImage: maskImage };

	return (
		<AvatarGroup aria-hidden="true" as="span" className="*:data-[slot=avatar]:ring-0!" size={sizePx === 24 ? "sm" : "xs"}>
			{visiblePeople.map(([key, { name, avatarSrc }], index) => (
				<Tooltip key={key}>
					<TooltipTrigger data-slot="avatar" render={<Avatar label={name || "Teammate"} size={sizePx === 24 ? "sm" : "xs"} className={sizePx === 20 ? "pointer-events-auto size-5" : "pointer-events-auto"} style={index > 0 ? cutout : undefined} animate={false} onClick={onAvatarClick} />}>
						{avatarSrc ? <AvatarImage alt="" src={avatarSrc} /> : null}
						<AvatarFallback>{name ? actorInitials(name) : <Icon render={<PersonIcon label="" size="small" />} />}</AvatarFallback>
					</TooltipTrigger>
					<TooltipContent role="tooltip">{name || "Teammate"}</TooltipContent>
				</Tooltip>
			))}
			{people.size > MAX_VISIBLE_TEAMMATES ? (
				<AvatarGroupCount as="span" className={sizePx === 20 ? "ring-0 group-has-data-[size=xs]/avatar-group:size-5" : "ring-0"} style={cutout}>+{people.size - MAX_VISIBLE_TEAMMATES}</AvatarGroupCount>
			) : null}
		</AvatarGroup>
	);
}
