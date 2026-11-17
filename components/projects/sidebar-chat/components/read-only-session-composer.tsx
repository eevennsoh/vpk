"use client";

import ChatContextBar from "@/components/projects/shared/components/chat-context-bar";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import PersonIcon from "@atlaskit/icon/core/person";
import { actorInitials } from "@/components/blocks/agent-list/agent-list-actor";
import type { AgentListInvoker, AgentListState } from "@/components/blocks/agent-list";
import { AgentSessionShortLifecycleIcon } from "@/components/blocks/agent-session/agent-session-lifecycle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Footer } from "@/components/ui-custom/footer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ReadOnlySessionComposer({ context, hideAiDisclaimer, onContextBarOpenChange, owner, state = "running" }: Readonly<{
	context?: ChatContextBarDescriptor | null;
	hideAiDisclaimer?: boolean;
	onContextBarOpenChange?: (open: boolean) => void;
	owner?: AgentListInvoker;
	state?: AgentListState;
}>) {
	const name = owner?.name.trim();
	const explanation = name ? `Only ${name}, the session owner, can steer this session. You can unblock it and review the outcome.` : "Only the session owner can steer this session. You can unblock it and review the outcome.";
	return (
		<div className="min-w-0 px-3">
			<ChatContextBar context={context} onOpenChange={onContextBarOpenChange} />
			<Tooltip>
				<TooltipTrigger closeOnClick={false} render={<div aria-label="Session owner and status" className="flex h-8 min-w-0 cursor-default select-none items-center gap-2 rounded-lg border border-border px-3 text-text-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring" role="group" tabIndex={0} />}>
					<Avatar aria-hidden="true" animate={false} size="xs">
						{owner?.avatarSrc ? <AvatarImage alt="" src={owner.avatarSrc} /> : null}
						<AvatarFallback>{name ? actorInitials(name) : <Icon render={<PersonIcon label="" size="small" />} />}</AvatarFallback>
					</Avatar>
					<span className="min-w-0 flex-1 truncate text-xs font-medium">{name ? `Session from ${name}` : "Session from a teammate"}</span>
					<AgentSessionShortLifecycleIcon showAllStates state={state} uncontained />
				</TooltipTrigger>
				<TooltipContent positionerClassName="z-[650]" role="tooltip" side="top">{explanation}</TooltipContent>
			</Tooltip>
			{hideAiDisclaimer ? null : <Footer />}
		</div>
	);
}
