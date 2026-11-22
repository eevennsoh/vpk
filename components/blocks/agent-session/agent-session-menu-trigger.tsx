import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import type { AgentSessionItem } from "./agent-session-types";

export function agentSessionMoreTrigger(item: AgentSessionItem) {
	return (
		<Button
			aria-label={`More actions for ${item.title}`}
			className="size-6 shadow-none focus-visible:ring-0"
			data-session-drag-ignore=""
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<Icon render={<ShowMoreHorizontalIcon color="currentColor" label="" size="small" />} />
		</Button>
	);
}
