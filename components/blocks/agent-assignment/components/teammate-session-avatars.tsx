import PersonIcon from "@atlaskit/icon/core/person";

import { actorInitials } from "@/components/blocks/agent-list/agent-list-actor";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";

const MAX_VISIBLE_TEAMMATES = 4;

export function TeammateSessionAvatars({ items }: Readonly<{ items: readonly AgentSessionItem[] }>) {
	const people = new Map<string, { name: string; avatarSrc: string | undefined }>();
	for (const { invokedBy } of items) {
		const name = invokedBy?.name.trim().replace(/\s+/gu, " ") ?? "";
		const avatarSrc = invokedBy?.avatarSrc?.trim() || undefined;
		// The invoker payload has no account ID. Keep different supplied faces
		// distinct even when names match; missing identities share a neutral face.
		const key = JSON.stringify([name, avatarSrc]);
		if (!people.has(key)) people.set(key, { name, avatarSrc });
	}
	const visiblePeople = Array.from(people).slice(0, MAX_VISIBLE_TEAMMATES);

	return (
		<AvatarGroup aria-hidden="true" as="span" size="xs">
			{visiblePeople.map(([key, { name, avatarSrc }]) => (
				<Avatar key={key} size="xs" animate={false} title={name || "Teammate"}>
					{avatarSrc ? <AvatarImage alt="" src={avatarSrc} /> : null}
					<AvatarFallback>{name ? actorInitials(name) : <Icon render={<PersonIcon label="" size="small" />} />}</AvatarFallback>
				</Avatar>
			))}
			{people.size > MAX_VISIBLE_TEAMMATES ? (
				<AvatarGroupCount as="span">+{people.size - MAX_VISIBLE_TEAMMATES}</AvatarGroupCount>
			) : null}
		</AvatarGroup>
	);
}
