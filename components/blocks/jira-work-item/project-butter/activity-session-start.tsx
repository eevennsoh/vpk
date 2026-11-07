"use client";

import type { ReactElement } from "react";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import { isLocalAgentListItem, toAgentListResumeCommand } from "@/components/blocks/agent-list";
import { getAgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import { AgentSessionContinueMenu } from "@/components/blocks/agent-session/agent-session-continue-menu";
import { useAgentSessionMenu } from "@/components/blocks/agent-session/use-agent-session-menu";
import { projectButterSessionFollowUp } from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { Spinner } from "@/components/ui/spinner";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";

function LocalSessionMenu({ session, trigger }: Readonly<{ session: ProjectButterSessionItem; trigger: ReactElement }>) {
	const resumeCommand = toAgentListResumeCommand(session);
	const menu = useAgentSessionMenu({ canResume: resumeCommand.length > 0, isCloud: false, item: session, resumeCommand });
	return <AgentSessionContinueMenu actions={menu.actions} copied={menu.copied} item={session} onOpenChange={menu.setIsContinueOpen} open={menu.isContinueOpen} positionerClassName="z-[700]" trigger={trigger} />;
}

/** Inline session link: agent and invoker faces, the session title, then live status. */
function SessionChip({ session, onOpen }: Readonly<{ session: ProjectButterSessionItem; onOpen: (id: string) => void }>) {
	const working = session.state === "running";
	const complete = session.state === "complete";
	const status = working ? "Working" : complete ? "Finished" : "Needs input";
	const invoker = session.invokedBy?.name ?? "Annie Cook";
	const local = isLocalAgentListItem(session);
	const owner = getAgentSessionRole(session) === "owner";
	const chip = (
		<button
			aria-label={local ? `Continue ${session.agent.name} session` : working ? `Open ${session.agent.name} chat` : `${status}, open ${session.agent.name} chat`}
			className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 align-middle text-sm text-text outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-border-focused disabled:cursor-not-allowed disabled:opacity-60"
			data-project-butter-agent-response={session.id}
			disabled={!owner}
			onClick={local ? undefined : () => onOpen(session.id)}
			type="button"
		>
			{/* The pair overhangs its 16px core by 6px each side; centring that core in w-7 keeps both faces inside the box. */}
			<span className="inline-flex w-7 shrink-0 justify-center"><HumanAgentAvatar agent={session.agent} composition="horizontal-group" human={{ name: invoker, avatarSrc: session.invokedBy?.avatarSrc ?? projectButterPersonAvatar(invoker) }} sizePx={16} /></span>
			<span className="min-w-0 truncate">{session.title}</span>
			{complete ? (
				<span className="inline-flex shrink-0 text-icon-success"><StatusSuccessIcon label="" size="small" /></span>
			) : working ? (
				<Spinner label="" size="default" variant="bloom" />
			) : (
				<span aria-hidden className="size-2 shrink-0 rounded-full bg-current text-icon-information" />
			)}
		</button>
	);
	return local && owner ? <LocalSessionMenu session={session} trigger={chip} /> : chip;
}

/** Explore WIP: the agent opens its own thread when a session starts. */
export function ProjectButterSessionStart({ session, onOpen }: Readonly<{ session: ProjectButterSessionItem; onOpen: (id: string) => void }>) {
	return (
		<p className="text-sm leading-6 text-text" data-project-butter-session-start={session.id}>
			I started a session{" "}<SessionChip onOpen={onOpen} session={session} />{" "}and I am looking into it. {projectButterSessionFollowUp(session)}
		</p>
	);
}
