"use client";

import { useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import { AgentSessionsMenu } from "@/components/blocks/agent-assignment/components/assigned-agents-session-menu";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import { AgentAvatarVisual, type AgentAvatarVisualProps } from "@/components/ui-custom/agent-avatar-visual";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { ProjectButterInvocationProvider } from "@/components/blocks/jira-issue/project-butter-invocation";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

type CrewMember = { name: string; kind: "person"; state: "Working" | "Currently viewing"; avatarSrc?: string } | { id?: string; name: string; kind: "agent"; state: "Working" | "Needs input" | "Completed"; visual: Pick<AgentAvatarVisualProps, "avatarSrc" | "brandName" | "vpkLogo"> };
type AgentCrewMember = Extract<CrewMember, { kind: "agent" }>;
const CREW: readonly CrewMember[] = [
	{ name: "Sarah Lim", kind: "person", state: "Working" },
	{ name: "Claude", kind: "agent", state: "Needs input", visual: { brandName: "claude" } },
	{ name: "Marcus Kim", kind: "person", state: "Working" },
	{ name: "Codex", kind: "agent", state: "Working", visual: { brandName: "openai-codex" } },
	{ name: "Cursor", kind: "agent", state: "Completed", visual: { brandName: "cursor" } },
	{ name: "Figma", kind: "agent", state: "Completed", visual: { brandName: "figma" } },
	{ name: "Rovo", kind: "agent", state: "Completed", visual: { vpkLogo: "rovo" } },
];
const SESSION_URGENCY: Readonly<Record<AgentSessionItem["state"], number>> = { "needs-input": 0, attention: 0, running: 1, complete: 2 };
const SESSION_STATE: Readonly<Record<AgentSessionItem["state"], AgentCrewMember["state"]>> = { "needs-input": "Needs input", attention: "Needs input", running: "Working", complete: "Completed" };

function sameCrewAgent(member: AgentCrewMember, agent: AgentSessionItem["agent"]) {
	return Boolean(member.id && member.id === agent.id)
		|| member.name.toLowerCase() === agent.name.toLowerCase()
		|| Boolean(member.visual.brandName && member.visual.brandName === agent.brandName)
		|| Boolean(member.visual.vpkLogo && member.visual.vpkLogo === agent.vpkLogo);
}

function referenceCrew(sessionsByUrgency: readonly AgentSessionItem[]): readonly CrewMember[] {
	const members: CrewMember[] = CREW.map((member) => {
		if (member.kind === "person") return member;
		const session = sessionsByUrgency.find((candidate) => sameCrewAgent(member, candidate.agent));
		return session ? { ...member, state: SESSION_STATE[session.state] } : member;
	});
	for (const session of sessionsByUrgency) {
		if (session.id === "butter-coding" || session.id === "butter-scoping" || members.some((member) => member.kind === "agent" && sameCrewAgent(member, session.agent))) continue;
		members.push({ id: session.agent.id, name: session.agent.name, kind: "agent", state: SESSION_STATE[session.state], visual: { avatarSrc: session.agent.avatarSrc, brandName: session.agent.brandName, vpkLogo: session.agent.vpkLogo } });
	}
	return members;
}

export function ProjectButterCrew({ assignee, currentUser, onBrowseAgents, onCreateAgent, onOpenSession, onPreviewSession, onStartAgent, sessions, useReferenceCrew = true }: Readonly<{
	assignee?: WorkItemPerson;
	currentUser?: WorkItemPerson;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onOpenSession: (session: AgentSessionItem) => void;
	onPreviewSession?: (sessionId: string | null) => void;
	onStartAgent?: (agent: AgentSessionItem["agent"]) => void;
	sessions: readonly AgentSessionItem[];
	useReferenceCrew?: boolean;
}>) {
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<"sessions" | "picker">("sessions");
	const orderedSessions = [...sessions].sort((left, right) => SESSION_URGENCY[left.state] - SESSION_URGENCY[right.state]);
	const pickerAgents = [...BUTTER_PICKER_AGENTS];
	for (const { agent } of sessions) {
		const id = agent.id ?? agent.name;
		if (!pickerAgents.some((candidate) => candidate.id === id)) pickerAgents.push({ ...agent, id, byline: "On this work item" });
	}
	const members: readonly CrewMember[] = useReferenceCrew ? referenceCrew(orderedSessions) : [
		...(assignee && assignee.name !== "Automatic" && assignee.name !== "Unassigned" ? [{ name: assignee.name, kind: "person" as const, state: "Working" as const, avatarSrc: assignee.avatarUrl }] : []),
		...sessions.map((session): CrewMember => ({ name: session.agent.name, kind: "agent", state: session.state === "complete" ? "Completed" : session.state === "needs-input" || session.state === "attention" ? "Needs input" : "Working", visual: { avatarSrc: session.agent.avatarSrc, brandName: session.agent.brandName, vpkLogo: session.agent.vpkLogo } })),
	];
	const crew: readonly CrewMember[] = members.length ? members : [{ name: currentUser?.name ?? "Annie Cook", avatarSrc: currentUser?.avatarUrl, kind: "person", state: "Currently viewing" }];
	const picking = view === "picker" || sessions.length === 0;
	const label = `${members.length ? "Working on this work item. " : ""}${crew.map((member) => `${member.name}, ${member.state}`).join(". ")}. Add agent`;
	function changeOpen(next: boolean) {
		setOpen(next);
		if (!next) { setView("sessions"); onPreviewSession?.(null); }
	}
	return (
		<Popover onOpenChange={changeOpen} open={open}>
			<PopoverTrigger render={<button aria-label={label} className="group/crew inline-flex shrink-0 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!onStartAgent && sessions.length === 0} type="button" />}>
				<AvatarGroup className="-space-x-1.5" label="People and agents working on this item">
					{crew.map((member, index) => member.kind === "person" ? <Avatar className="size-7.5" key={`${member.name}-${index}`} label={`${member.name}, ${member.state}`} size="default" title={`${member.name}, ${member.state}`}><AvatarImage src={member.avatarSrc ?? projectButterPersonAvatar(member.name)} /><AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback></Avatar> : <span className="relative shrink-0" key={`${member.name}-${index}`} title={`${member.name}, ${member.state}`}><AgentAvatarVisual {...member.visual} appearance="coding" label={`${member.name}, ${member.state}`} sizePx={30} status={member.state === "Completed" ? "finished" : member.state === "Needs input" ? "needs-input" : undefined} />{member.state === "Working" ? <span className="absolute -right-0.5 -top-0.5 z-10 grid size-3.5 place-items-center rounded-full bg-surface"><Spinner className="size-2.5" label="Working" size="xs" variant="bloom" /></span> : null}</span>)}
					<Avatar animate={false} borderTone={open ? "selected" : "default"} className="size-7.5" label="Add agent" shape="hexagon" size="default"><AvatarFallback className="bg-transparent text-icon-subtle group-hover/crew:bg-bg-neutral-subtle-hovered"><AddIcon label="" size="small" /></AvatarFallback></Avatar>
				</AvatarGroup>
			</PopoverTrigger>
			<PopoverContent align="end" aria-label={picking ? "Add agent" : "Agent sessions"} className={picking ? "w-[360px] gap-0 overflow-hidden p-0" : "w-[280px] gap-0 overflow-hidden p-0"} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">
				{picking && onStartAgent ? <ProjectButterInvocationProvider agents={pickerAgents} enabled><ProjectButterAgentPickerContent sessions={sessions} onContinueSession={(session) => { onOpenSession(session); changeOpen(false); }} onPreviewSession={onPreviewSession} submenuPositionerClassName="z-[700]" workspacePositionerClassName="z-[701]" onBrowseAgents={onBrowseAgents ? () => { changeOpen(false); onBrowseAgents(); } : undefined} onCreateAgent={onCreateAgent ? () => { changeOpen(false); onCreateAgent(); } : undefined} onAssign={(agent) => { onStartAgent({ id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }); changeOpen(false); }} /></ProjectButterInvocationProvider> : <AgentSessionsMenu addAgentLabel="Add agent" items={orderedSessions} overlayPositionerClassName="z-[700]" onAddAgent={onStartAgent ? () => setView("picker") : undefined} onSelectSession={(session) => { onOpenSession(session); changeOpen(false); }} />}
			</PopoverContent>
		</Popover>
	);
}
