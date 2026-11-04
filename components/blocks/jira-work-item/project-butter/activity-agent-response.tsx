"use client";

import type { ReactElement } from "react";
import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import type { JiraActivityReply } from "@/components/blocks/jira-activity";
import { isLocalAgentListItem, toAgentListResumeCommand } from "@/components/blocks/agent-list";
import { getAgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import { AgentSessionContinueMenu } from "@/components/blocks/agent-session/agent-session-continue-menu";
import { useAgentSessionMenu } from "@/components/blocks/agent-session/use-agent-session-menu";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
import { Shimmer } from "@/components/ui-custom/shimmer";

function LocalSessionResponse({ session, trigger }: Readonly<{ session: ProjectButterSessionItem; trigger: ReactElement }>) {
	const resumeCommand = toAgentListResumeCommand(session);
	const menu = useAgentSessionMenu({ canResume: resumeCommand.length > 0, isCloud: false, item: session, resumeCommand });
	return <AgentSessionContinueMenu actions={menu.actions} copied={menu.copied} item={session} onOpenChange={menu.setIsContinueOpen} open={menu.isContinueOpen} positionerClassName="z-[700]" trigger={trigger} />;
}

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
	const local = isLocalAgentListItem(session);
	const trigger = (
		<Button aria-label={local ? `Continue ${session.agent.name} session` : working ? `Open ${session.agent.name} chat` : `${status}, open ${session.agent.name} chat`} className="h-6 justify-start gap-2 px-0 font-normal hover:bg-transparent hover:underline" disabled={getAgentSessionRole(session) !== "owner"} onClick={local ? undefined : () => onOpen(session.id)} size="compact" type="button" variant="ghost">
			{working ? <Shimmer as="span" className="text-text">Working</Shimmer> : <span>{status}</span>}
			{complete ? <span className="inline-flex text-icon-success"><StatusSuccessIcon label="" size="small" /></span> : working ? <Spinner label="" size="default" variant="bloom" /> : <span aria-hidden className="mx-1 size-2 rounded-full bg-bg-information-bold" />}
			{working ? null : <ArrowRightIcon label="" size="small" />}
		</Button>
	);
	return (
		<div className="flex min-w-0 items-center gap-2" data-project-butter-agent-response={session.id}>
			<HumanAgentAvatar agent={session.agent} human={{ name: invoker, avatarSrc: session.invokedBy?.avatarSrc ?? projectButterPersonAvatar(invoker) }} sizePx={24} />
			{local && getAgentSessionRole(session) === "owner" ? <LocalSessionResponse session={session} trigger={trigger} /> : trigger}
		</div>
	);
}
