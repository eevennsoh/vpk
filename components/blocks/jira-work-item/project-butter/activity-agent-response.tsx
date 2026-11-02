"use client";

import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import type { JiraActivityReply } from "@/components/blocks/jira-activity";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
import { Shimmer } from "@/components/ui-custom/shimmer";

export function ProjectButterAgentResponse({ reply, sessions, onOpen }: Readonly<{
	reply: JiraActivityReply;
	sessions: readonly ProjectButterSessionItem[];
	onOpen: (id: string) => void;
}>) {
	const session = sessions.find((item) => `response-${item.id}` === reply.id);
	if (!session) return null;
	const working = session.state === "running";
	const complete = session.state === "complete";
	const status = working ? "Working" : complete ? "Finished" : "Needs input";
	const invoker = session.invokedBy?.name ?? "Annie Cook";
	return (
		<div className="flex min-w-0 items-center gap-2" data-project-butter-agent-response={session.id}>
			<HumanAgentAvatar agent={session.agent} human={{ name: invoker, avatarSrc: session.invokedBy?.avatarSrc ?? projectButterPersonAvatar(invoker) }} sizePx={24} />
			<Button aria-label={working ? `Open ${session.agent.name} chat` : `${status}, open ${session.agent.name} chat`} className="h-6 justify-start gap-2 px-0 font-normal hover:bg-transparent hover:underline" onClick={() => onOpen(session.id)} size="compact" type="button" variant="ghost">
				{working ? <Shimmer as="span" className="text-text">Working</Shimmer> : <span>{status}</span>}
				{complete ? <span className="inline-flex text-icon-success"><StatusSuccessIcon label="" size="small" /></span> : working ? <Spinner label="" size="default" variant="bloom" /> : <span aria-hidden className="mx-1 size-2 rounded-full bg-bg-information-bold" />}
				{working ? null : <ArrowRightIcon label="" size="small" />}
			</Button>
		</div>
	);
}
