"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import { InlineAgentSelector } from "@/components/blocks/agent-selector";
import { isLocalAgentListItem } from "@/components/blocks/agent-list";
import { Icon } from "@/components/ui/icon";
import { AgentSessionsMenu } from "@/components/blocks/agent-assignment/components/assigned-agents-session-menu";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import { AgentAvatarVisual, type AgentAvatarVisualProps } from "@/components/ui-custom/agent-avatar-visual";
import { AgentLoading, type AgentLoadingAgent } from "@/components/ui-custom/agent-loading";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/icon-tile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { JiraIssueAgentRowLabel } from "@/components/blocks/jira-issue/agent-activity-row-presentation";
import { ProjectButterAgentPreviewBoundary, ProjectButterCloudAgentPicker } from "@/components/blocks/jira-issue/project-butter-inline-agent-picker";
import { JiraIssueAgentHandoffLabel, ProjectButterInvocationPreview } from "@/components/blocks/jira-issue/project-butter-invocation-chin";
import { ProjectButterInvocationProvider, useProjectButterInvocationActions, useProjectButterInvocationPhase, useProjectButterInvocationPreview } from "@/components/blocks/jira-issue/project-butter-invocation";
import { matchesInvocationAgent } from "@/components/blocks/jira-issue/project-butter-invocation-model";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { cn } from "@/lib/utils";

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

type ProjectButterCrewProps = Readonly<{
	assignee?: WorkItemPerson;
	cloudAgentSelector?: boolean;
	currentUser?: WorkItemPerson;
	field?: boolean;
	fieldSessionMenu?: boolean;
	showFieldLabel?: boolean;
	showSessionStatus?: boolean;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onOpenSession: (session: AgentSessionItem) => void;
	onPreviewSession?: (sessionId: string | null) => void;
	onStartAgent?: (agent: AgentSessionItem["agent"]) => void;
	sessions: readonly AgentSessionItem[];
	useReferenceCrew?: boolean;
}>;

export function ProjectButterCrew(props: ProjectButterCrewProps) {
	return props.field && !props.fieldSessionMenu ? <ProjectButterInvocationProvider enabled><ProjectButterCrewContent {...props} /></ProjectButterInvocationProvider> : <ProjectButterCrewContent {...props} />;
}

function ProjectButterCrewContent({ assignee, cloudAgentSelector = false, currentUser, field = false, fieldSessionMenu = false, showFieldLabel = true, showSessionStatus = false, onBrowseAgents, onCreateAgent, onOpenSession, onPreviewSession, onStartAgent, sessions, useReferenceCrew = true }: ProjectButterCrewProps) {
	const [open, setOpen] = useState(false);
	const reduceMotion = useReducedMotion();
	const invocation = useProjectButterInvocationActions();
	const phase = useProjectButterInvocationPhase();
	const preview = useProjectButterInvocationPreview();
	const [view, setView] = useState<"sessions" | "picker">("sessions");
	const orderedSessions = [...sessions].sort((left, right) => SESSION_URGENCY[left.state] - SESSION_URGENCY[right.state]);
	const agentNames = new Set<string>();
	const agentSessions = (showSessionStatus ? orderedSessions : sessions).filter(({ agent }) => {
		const name = agent.name.toLowerCase();
		if (agentNames.has(name)) return false;
		agentNames.add(name);
		return true;
	});
	const pickerAgents = [...BUTTER_PICKER_AGENTS];
	for (const { agent } of sessions) {
		const id = agent.id ?? agent.name;
		if (!pickerAgents.some((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase())) pickerAgents.push({ ...agent, id: pickerAgents.some((candidate) => candidate.id === id) ? `session-agent:${id}` : id, byline: "On this work item" });
	}
	const fieldPickerAgents = pickerAgents.filter((agent) => agent.id !== "github-copilot" && agent.id !== "rovo-cli");
	const members: readonly CrewMember[] = useReferenceCrew ? referenceCrew(orderedSessions) : [
		...(assignee && assignee.name !== "Automatic" && assignee.name !== "Unassigned" ? [{ name: assignee.name, kind: "person" as const, state: "Working" as const, avatarSrc: assignee.avatarUrl }] : []),
		...sessions.map((session): CrewMember => ({ name: session.agent.name, kind: "agent", state: session.state === "complete" ? "Completed" : session.state === "needs-input" || session.state === "attention" ? "Needs input" : "Working", visual: { avatarSrc: session.agent.avatarSrc, brandName: session.agent.brandName, vpkLogo: session.agent.vpkLogo } })),
	];
	const crew: readonly CrewMember[] = members.length ? members : [{ name: currentUser?.name ?? "Annie Cook", avatarSrc: currentUser?.avatarUrl, kind: "person", state: "Currently viewing" }];
	const picking = (field && !fieldSessionMenu) || view === "picker" || sessions.length === 0;
	const label = `${members.length ? "Working on this work item. " : ""}${crew.map((member) => `${member.name}, ${member.state}`).join(". ")}. Add agent`;
	const firstSession = agentSessions[0];
	const fieldState = firstSession ? SESSION_STATE[firstSession.state] === "Completed" ? "Finished" : SESSION_STATE[firstSession.state] : "";
	const fieldLabel = firstSession ? showSessionStatus ? `${agentSessions.length === 1 ? firstSession.agent.name : `${agentSessions.length} agents`}: ${fieldState}` : `${agentSessions.length} ${agentSessions.length === 1 ? "agent" : "agents"}` : "Add agent";
	const selectedAgent = phase === "handoff" || phase === "attached" ? preview.agent : null;
	const selectedSession = selectedAgent ? agentSessions.find(({ id, agent }) => matchesInvocationAgent({ id, name: agent.name }, selectedAgent)) : undefined;
	const loadingSessions = selectedSession ? [selectedSession, ...agentSessions.filter((session) => session !== selectedSession)] : agentSessions;
	const puzzleHandoff = phase === "handoff" && loadingSessions.length > 1 ? selectedSession : undefined;
	const agentAvatars = loadingSessions.map(({ id, agent, state }) => {
		const catalogAgent = fieldPickerAgents.find((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase());
		const visual = catalogAgent ?? agent;
		return {
			id,
			name: agent.name,
			status: state === "complete" ? "finished" as const : "working" as const,
			avatar: { animate: false, appearance: "coding" as const, avatarSrc: visual.avatarSrc, brandName: visual.brandName, vpkLogo: visual.vpkLogo, logoName: catalogAgent?.logoName, fallbackText: agent.name.slice(0, 2).toUpperCase() },
		};
	});
	function startFieldAgent(agent: AgentSessionItem["agent"]) {
		onStartAgent?.(agent);
	}
	function changeOpen(next: boolean) {
		setOpen(next);
		if (field && !fieldSessionMenu) { if (next) invocation?.open("footer"); else invocation?.close(); }
		if (!next) { setView("sessions"); onPreviewSession?.(null); }
	}
	return (
		<Popover onOpenChange={changeOpen} open={open}>
			{field ? <div aria-label="Agents field" className="min-w-0" role="group">
				{showFieldLabel && sessions.length > 0 ? <div className="mb-0.5 min-w-0 text-xs leading-4 text-text-subtle">Agents</div> : null}
				<div className="relative min-w-0">
					<PopoverTrigger render={<button aria-label={fieldLabel} className="absolute inset-0 -inset-x-2 z-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!onStartAgent && sessions.length === 0} type="button" />} />
					<div aria-hidden className="pointer-events-none relative z-10 flex min-h-8 items-center gap-2">
						{open && !fieldSessionMenu ? <ProjectButterInvocationPreview className="px-0" /> : firstSession && showSessionStatus ? <><span className={cn("flex shrink-0", phase === "handoff" && !puzzleHandoff && !reduceMotion ? "opacity-0" : null)} data-slot="jira-issue-agent-avatar-handoff">{agentAvatars.length > 1 ? <AgentLoading agents={agentAvatars satisfies AgentLoadingAgent[]} announce={false} key={selectedAgent?.id ?? "default"} variant="vertical" /> : <span className="grid size-6 shrink-0 place-items-center"><AgentAvatarVisual {...agentAvatars[0].avatar} label="" sizePx={24} /></span>}</span>{phase === "handoff" && selectedAgent && fieldState === "Working" && !reduceMotion ? <JiraIssueAgentHandoffLabel name={selectedAgent.name}><JiraIssueAgentRowLabel isAwaitingInput={false} isWorking rowLabel={fieldState} /></JiraIssueAgentHandoffLabel> : <JiraIssueAgentRowLabel isAwaitingInput={fieldState === "Needs input"} isWorking={fieldState === "Working"} rowLabel={fieldState} />}</> : agentAvatars.length ? <AvatarGroup className="shrink-0 -space-x-1.5">{agentAvatars.map(({ id, name, avatar }) => <span data-agent-id={id} key={id}><AgentAvatarVisual {...avatar} label={name} sizePx={24} /></span>)}</AvatarGroup> : <><IconTile aria-hidden as="span" className="text-icon-subtle" icon={<AiAgentIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" /><span className="text-sm text-text-subtle">Add agent</span></>}
					</div>
				</div>
			</div> : <PopoverTrigger render={<button aria-label={label} className="group/crew inline-flex shrink-0 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!onStartAgent && sessions.length === 0} type="button" />}>
				<AvatarGroup className="-space-x-1.5" label="People and agents working on this item">
					{crew.map((member, index) => member.kind === "person" ? <Avatar className="size-7.5" key={`${member.name}-${index}`} label={`${member.name}, ${member.state}`} size="default" title={`${member.name}, ${member.state}`}><AvatarImage src={member.avatarSrc ?? projectButterPersonAvatar(member.name)} /><AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback></Avatar> : <span className="relative shrink-0" key={`${member.name}-${index}`} title={`${member.name}, ${member.state}`}><AgentAvatarVisual {...member.visual} appearance="coding" label={`${member.name}, ${member.state}`} sizePx={30} status={member.state === "Completed" ? "finished" : member.state === "Needs input" ? "needs-input" : undefined} />{member.state === "Working" ? <span className="absolute -right-0.5 -top-0.5 z-10 grid size-3.5 place-items-center rounded-full bg-surface"><Spinner className="size-2.5" label="Working" size="xs" variant="bloom" /></span> : null}</span>)}
					<Avatar animate={false} borderTone={open ? "selected" : "default"} className="size-7.5" label="Add agent" shape="hexagon" size="default"><AvatarFallback className="bg-transparent text-icon-subtle group-hover/crew:bg-bg-neutral-subtle-hovered"><AddIcon label="" size="small" /></AvatarFallback></Avatar>
				</AvatarGroup>
			</PopoverTrigger>}
			<PopoverContent align={field ? "start" : "end"} aria-label={fieldSessionMenu ? "Agent assignment" : picking ? "Add agent" : "Agent sessions"} className={cn(field && !fieldSessionMenu ? "w-80 max-w-(--available-width) gap-0 overflow-visible bg-transparent p-0 shadow-none" : picking ? "w-[360px] gap-0 overflow-hidden p-0 shadow-2xl" : "w-[280px] gap-0 overflow-hidden p-0", fieldSessionMenu && "shadow-[0_8px_12px_rgba(30,31,33,0.15)]")} onKeyDownCapture={(event) => { if (field && event.key === "Escape" && event.target instanceof HTMLInputElement) { event.stopPropagation(); changeOpen(false); } }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (field) changeOpen(false); } }} positionerClassName="z-[650]" side={fieldSessionMenu ? "bottom" : undefined} sideOffset={field ? 8 : undefined}>
				{fieldSessionMenu ? <AgentSessionsMenu addAgentLabel="Add agent" items={orderedSessions} onSelectSession={(session) => { onOpenSession(session); changeOpen(false); }} /> : field && onStartAgent && cloudAgentSelector ? <ProjectButterCloudAgentPicker onAssign={(agent) => { startFieldAgent({ id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }); changeOpen(false); }} onBrowseAgents={onBrowseAgents ? () => { changeOpen(false); onBrowseAgents(); } : undefined} /> : field && onStartAgent ? <ProjectButterAgentPreviewBoundary agents={fieldPickerAgents}><InlineAgentSelector
					agents={fieldPickerAgents}
					softwareAgentIds={["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent"]}
					initialSoftwareLimit={5}
					getActions={(agent) => [
						...orderedSessions.filter((session) => !isLocalAgentListItem(session) && session.agent.name.toLowerCase() === agent.name.toLowerCase()).map((session) => ({ id: session.id, label: session.title, icon: <Icon render={<AiChatIcon label="" size="small" />} />, onSelect: () => { onOpenSession(session); changeOpen(false); } })),
						{ id: "start", label: "Start a new session", icon: <Icon render={<CloudIcon label="" />} />, onSelect: () => { startFieldAgent({ id: agent.id.startsWith("session-agent:") ? agent.id.slice("session-agent:".length) : agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }); changeOpen(false); } },
					]}
					onBrowseAgents={onBrowseAgents ? () => { changeOpen(false); onBrowseAgents(); } : undefined}
					onCreateAgent={onCreateAgent ? () => { changeOpen(false); onCreateAgent(); } : undefined}
				/></ProjectButterAgentPreviewBoundary> : picking && onStartAgent ? <ProjectButterInvocationProvider agents={pickerAgents} enabled><ProjectButterAgentPickerContent sessions={sessions} onContinueSession={(session) => { onOpenSession(session); changeOpen(false); }} onPreviewSession={onPreviewSession} submenuPositionerClassName="z-[700]" workspacePositionerClassName="z-[701]" onBrowseAgents={onBrowseAgents ? () => { changeOpen(false); onBrowseAgents(); } : undefined} onCreateAgent={onCreateAgent ? () => { changeOpen(false); onCreateAgent(); } : undefined} onAssign={(agent) => { onStartAgent({ id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }); changeOpen(false); }} /></ProjectButterInvocationProvider> : <AgentSessionsMenu addAgentLabel="Add agent" items={orderedSessions} overlayPositionerClassName="z-[700]" onAddAgent={onStartAgent ? () => setView("picker") : undefined} onSelectSession={(session) => { onOpenSession(session); changeOpen(false); }} />}
			</PopoverContent>
		</Popover>
	);
}
