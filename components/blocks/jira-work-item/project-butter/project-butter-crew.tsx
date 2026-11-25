"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import { InlineAgentSelector } from "@/components/blocks/agent-selector";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { isLocalAgentListItem } from "@/components/blocks/agent-list";
import { Icon } from "@/components/ui/icon";
import { AgentSessionsMenu } from "@/components/blocks/agent-assignment/components/assigned-agents-session-menu";
import { renderSessionIdentity, TeammateSessionAvatarCycle } from "@/components/blocks/agent-assignment/components/teammate-session-avatar-cycle";
import { getTeammateSessionPeople, teammateSessionUsageLabel } from "@/components/blocks/agent-assignment/components/teammate-session-avatars";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import { AgentAddVisual } from "@/components/ui-custom/agent-add";
import { AgentAvatarVisual, type AgentAvatarVisualProps } from "@/components/ui-custom/agent-avatar-visual";
import { AgentLoading, type AgentLoadingAgent } from "@/components/ui-custom/agent-loading";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dropdownStyles, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { buildHorizontalScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { JiraIssueAgentRowLabel } from "@/components/blocks/jira-issue/agent-activity-row-presentation";
import { ProjectButterAgentPreviewBoundary, ProjectButterCloudAgentPicker } from "@/components/blocks/jira-issue/project-butter-inline-agent-picker";
import { JiraIssueAgentHandoffLabel, ProjectButterInvocationPreview } from "@/components/blocks/jira-issue/project-butter-invocation-chin";
import { ProjectButterInvocationProvider, useProjectButterInvocationActions, useProjectButterInvocationPhase, useProjectButterInvocationPreview } from "@/components/blocks/jira-issue/project-butter-invocation";
import { matchesInvocationAgent } from "@/components/blocks/jira-issue/project-butter-invocation-model";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { cn } from "@/lib/utils";
import { motionDuration, motionEase } from "@/lib/motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { AgentAvatarLanyard, AgentAvatarLanyards } from "@/components/blocks/jira-work-item/project-butter/agent-avatar-lanyard";
import { SESSION_URGENCY, sessionStatusPresentation } from "@/components/blocks/jira-work-item/project-butter/session-status-presentation";

type CrewMember = { name: string; kind: "person"; state: "Working" | "Currently viewing"; avatarSrc?: string } | { id?: string; name: string; kind: "agent"; state: "Working" | "Needs input" | "Ready for review" | "Completed"; visual: Pick<AgentAvatarVisualProps, "avatarSrc" | "brandName" | "vpkLogo"> };
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
const SESSION_STATE: Readonly<Record<AgentSessionItem["state"], AgentCrewMember["state"]>> = { "needs-input": "Needs input", "ready-for-review": "Ready for review", attention: "Needs input", running: "Working", complete: "Completed" };

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
	extraAgents?: readonly AgentSelectorAgent[];
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

function ProjectButterCrewContent({ assignee, extraAgents = [], cloudAgentSelector = false, currentUser, field = false, fieldSessionMenu = false, showFieldLabel = true, showSessionStatus = false, onBrowseAgents, onCreateAgent, onOpenSession, onPreviewSession, onStartAgent, sessions, useReferenceCrew = true }: ProjectButterCrewProps) {
	const teammateNamesId = useId();
	const [open, setOpen] = useState(false);
	const [enteringAgent, setEnteringAgent] = useState<{ name: string; isNew: boolean } | null>(null);
	const [scrollEdges, setScrollEdges] = useState({ start: false, end: false });
	const fieldScrollRef = useRef<HTMLDivElement>(null);
	const fieldRef = useRef<HTMLDivElement>(null);
	const pickerTriggerRef = useRef<HTMLButtonElement>(null);
	const pendingScrollAgent = useRef<string | null>(null);
	const selectedAgentRef = useRef(false);
	const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	const invocation = useProjectButterInvocationActions();
	const phase = useProjectButterInvocationPhase();
	const preview = useProjectButterInvocationPreview();
	const [view, setView] = useState<"sessions" | "picker">("sessions");
	const orderedSessions = [...sessions].sort((left, right) => SESSION_URGENCY[left.state] - SESSION_URGENCY[right.state]);
	const statusPresentation = sessionStatusPresentation(orderedSessions);
	const viewerOnly = showSessionStatus && sessions.length > 0 && statusPresentation.cohort.length === 0;
	const agentNames = new Set<string>();
	const distinctAgentSessions = sessions.filter(({ agent }) => {
		const name = agent.name.toLowerCase();
		if (agentNames.has(name)) return false;
		agentNames.add(name);
		return true;
	});
	const agentSessions = showSessionStatus ? statusPresentation.cohort : distinctAgentSessions;
	const pickerAgents = [...BUTTER_PICKER_AGENTS, ...extraAgents];
	for (const { agent } of sessions) {
		const id = agent.id ?? agent.name;
		if (!pickerAgents.some((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase())) pickerAgents.push({ ...agent, id: pickerAgents.some((candidate) => candidate.id === id) ? `session-agent:${id}` : id, byline: "On this work item" });
	}
	const fieldPickerAgents = pickerAgents.filter((agent) => agent.id !== "github-copilot" && agent.id !== "rovo-cli");
	const members: readonly CrewMember[] = useReferenceCrew ? referenceCrew(orderedSessions) : [
		...(assignee && assignee.name !== "Automatic" && assignee.name !== "Unassigned" ? [{ name: assignee.name, kind: "person" as const, state: "Working" as const, avatarSrc: assignee.avatarUrl }] : []),
		...sessions.map((session): CrewMember => ({ name: session.agent.name, kind: "agent", state: SESSION_STATE[session.state], visual: { avatarSrc: session.agent.avatarSrc, brandName: session.agent.brandName, vpkLogo: session.agent.vpkLogo } })),
	];
	const crew: readonly CrewMember[] = members.length ? members : [{ name: currentUser?.name ?? "Annie Cook", avatarSrc: currentUser?.avatarUrl, kind: "person", state: "Currently viewing" }];
	const picking = Boolean(onStartAgent) && ((field && !fieldSessionMenu) || view === "picker" || sessions.length === 0);
	const label = `${members.length ? "Working on this work item. " : ""}${crew.map((member) => `${member.name}, ${member.state}`).join(". ")}. ${onStartAgent ? "Add agent" : "View agent sessions"}`;
	const firstSession = agentSessions[0];
	const fieldState = firstSession ? SESSION_STATE[firstSession.state] === "Completed" ? "Finished" : SESSION_STATE[firstSession.state] : "";
	const fieldLabel = viewerOnly ? teammateSessionUsageLabel(sessions.length) : firstSession ? showSessionStatus ? `${agentSessions.length === 1 ? firstSession.agent.name : `${agentSessions.length} agents`}: ${fieldState}` : agentSessions.length === 1 ? firstSession.agent.name : `${agentSessions.length} agents` : onStartAgent ? "Add agent" : "No agent sessions";
	const selectedAgent = phase === "handoff" || phase === "attached" ? preview.agent : null;
	const selectedSession = selectedAgent ? agentSessions.find(({ id, agent }) => matchesInvocationAgent({ id, name: agent.name }, selectedAgent)) : undefined;
	const loadingSessions = selectedSession ? [selectedSession, ...agentSessions.filter((session) => session !== selectedSession)] : agentSessions;
	const puzzleHandoff = phase === "handoff" && statusPresentation.shouldCycle ? selectedSession : undefined;
	const agentAvatars = loadingSessions.map(({ id, agent, invokedBy, state }) => {
		const catalogAgent = fieldPickerAgents.find((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase());
		const visual = catalogAgent ?? agent;
		return {
			id,
			invokedBy,
			name: agent.name,
			identity: { id: catalogAgent?.id ?? agent.id ?? agent.name, name: agent.name, byline: catalogAgent?.byline ?? "", avatarSrc: visual.avatarSrc, brandName: visual.brandName, vpkLogo: visual.vpkLogo, logoName: catalogAgent?.logoName },
			status: state === "complete" ? "finished" as const : "working" as const,
			avatar: { animate: false, appearance: "coding" as const, avatarSrc: visual.avatarSrc, brandName: visual.brandName, vpkLogo: visual.vpkLogo, logoName: catalogAgent?.logoName, fallbackText: agent.name.slice(0, 2).toUpperCase() },
		};
	});
	useLayoutEffect(() => {
		if (!open && pendingScrollAgent.current && sessions.some(({ agent }) => agent.name.toLowerCase() === pendingScrollAgent.current)) {
			const scroller = fieldScrollRef.current;
			const avatar = [...(scroller?.querySelectorAll<HTMLElement>("[data-agent-name]") ?? [])].find((element) => element.dataset.agentName === pendingScrollAgent.current);
			if (scroller && avatar) {
				const bounds = avatar.getBoundingClientRect();
				const viewport = scroller.getBoundingClientRect();
				if (bounds.left < viewport.left) scroller.scrollLeft += bounds.left - viewport.left;
				else if (bounds.right + 16 > viewport.right) scroller.scrollLeft += bounds.right + 16 - viewport.right;
			}
			pendingScrollAgent.current = null;
		}
	}, [open, sessions]);
	useEffect(() => {
		const scroller = fieldScrollRef.current;
		if (!scroller) return;
		function updateEdges() {
			if (!scroller) return;
			const start = scroller.scrollLeft > 1;
			const end = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
			setScrollEdges((current) => current.start === start && current.end === end ? current : { start, end });
		}
		const observer = new ResizeObserver(updateEdges);
		observer.observe(scroller);
		if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
		scroller.addEventListener("scroll", updateEdges, { passive: true });
		updateEdges();
		return () => { observer.disconnect(); scroller.removeEventListener("scroll", updateEdges); };
	}, [field, fieldSessionMenu, open]);
	function startFieldAgent(agent: AgentSessionItem["agent"]) {
		const name = agent.name.toLowerCase();
		pendingScrollAgent.current = name;
		selectedAgentRef.current = true;
		const onlyAgent = agentNames.size === 0 || (agentNames.size === 1 && agentNames.has(name));
		setEnteringAgent(reduceMotion || onlyAgent ? null : { name, isNew: !agentNames.has(name) });
		onStartAgent?.(agent);
	}
	function changeOpen(next: boolean) {
		setOpen(next);
		if (next) selectedAgentRef.current = false;
		if (next) setView(onStartAgent && !field ? "picker" : "sessions");
		if (field && !fieldSessionMenu) { if (next) invocation?.open("footer"); else invocation?.close(); }
		if (!next) { setView("sessions"); onPreviewSession?.(null); }
	}
	const emptyFieldIcon = <AgentAddVisual selected={open} />;
	const teammateIdentity = viewerOnly ? (
		<>
			<TeammateSessionAvatarCycle sizePx={24} sessions={sessions.map(({ agent, id, invokedBy, state }) => ({
				id,
				invokedBy,
				name: agent.name,
				status: state === "complete" ? "finished" : "working",
				avatar: { appearance: "coding", avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo, fallbackText: agent.name.trim()[0]?.toUpperCase() ?? "A" },
			}))} />
			<span className="min-w-0" data-teammate-session-label>
				<JiraIssueAgentRowLabel isAwaitingInput={false} isWorking={false} rowLabel={fieldLabel} />
			</span>
		</>
	) : null;
	const fieldControl = (
				<div className={cn("relative", fieldSessionMenu ? "min-w-0" : "min-w-full w-max", enteringAgent?.isNew && !fieldSessionMenu && "pr-4")}>
					<PopoverTrigger render={<button aria-label={fieldLabel} aria-describedby={viewerOnly ? teammateNamesId : undefined} ref={pickerTriggerRef} className={cn("absolute inset-0 z-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", fieldSessionMenu ? "-inset-x-2" : "focus-visible:ring-inset")} onKeyDown={(event) => { if (!fieldSessionMenu && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); fieldScrollRef.current?.scrollBy({ left: event.key === "ArrowRight" ? 48 : -48 }); } }} disabled={!onStartAgent && sessions.length === 0} type="button" />} />
					{viewerOnly ? <span className="sr-only" id={teammateNamesId}>{Array.from(getTeammateSessionPeople(sessions).values(), ({ name }) => name || "Teammate").join(", ")}</span> : null}
					<div aria-hidden={fieldSessionMenu || showSessionStatus ? true : undefined} className={cn("pointer-events-none relative z-10 flex items-center gap-2", fieldSessionMenu ? "min-h-8" : "min-h-6")}>
						{open && !fieldSessionMenu ? <ProjectButterInvocationPreview avatarSizePx={24} className="h-6 py-0" defaultIcon={emptyFieldIcon} flush /> : viewerOnly ? teammateIdentity : firstSession && showSessionStatus ? <><span className={cn("flex shrink-0", phase === "handoff" && !puzzleHandoff && !reduceMotion ? "opacity-0" : null)} data-slot="jira-issue-agent-avatar-handoff">{statusPresentation.shouldCycle ? <AgentLoading agents={agentAvatars satisfies AgentLoadingAgent[]} announce={false} key={selectedAgent?.id ?? "default"} renderVerticalAvatar={(agent, size) => renderSessionIdentity({ ...agent, invokedBy: agentAvatars.find((entry) => entry.id === agent.id)?.invokedBy }, size)} variant="vertical" /> : <span className="grid size-6 shrink-0 place-items-center">{renderSessionIdentity(agentAvatars[0], 24)}</span>}</span>{phase === "handoff" && selectedAgent && fieldState === "Working" && !reduceMotion ? <JiraIssueAgentHandoffLabel name={selectedAgent.name}><JiraIssueAgentRowLabel isAwaitingInput={false} isWorking rowLabel={fieldState} /></JiraIssueAgentHandoffLabel> : <JiraIssueAgentRowLabel isAwaitingInput={fieldState === "Needs input" || fieldState === "Ready for review"} isWorking={fieldState === "Working"} rowLabel={fieldState} />}</> : agentAvatars.length ? <AvatarGroup className={cn("shrink-0", fieldSessionMenu && "-space-x-1.5")}>{agentAvatars.map(({ id, name, avatar, identity }) => {
							const entering = enteringAgent?.name === name.toLowerCase() ? enteringAgent : null;
							return <motion.span
								animate={entering ? entering.isNew ? { opacity: [0, 1, 1, 1], transform: ["translateX(12px) scale(0.6)", "translateX(12px) scale(1.15)", "translateX(12px) scale(1.15)", "translateX(0px) scale(1)"] } : { opacity: 1, transform: ["scale(0.8)", "scale(1.12)", "scale(1)"] } : { opacity: 1, transform: "scale(1)" }}
								className={cn("flex shrink-0 justify-center", entering && "relative z-20")}
								data-agent-id={id}
								data-agent-name={name.toLowerCase()}
								initial={entering ? entering.isNew ? { opacity: 0, transform: "translateX(12px) scale(0.6)" } : { opacity: 1, transform: "scale(0.8)" } : false}
								key={id}
								onAnimationComplete={() => { if (entering) setEnteringAgent(null); }}
								transition={entering?.isNew ? { duration: motionDuration.slowest, ease: motionEase.outPractical, times: [0, 0.4, 0.55, 1] } : { duration: motionDuration.slowest * 2, ease: motionEase.inOut }}
							><AgentAvatarLanyard agent={identity} onOpenPicker={() => pickerTriggerRef.current?.click()}><AgentAvatarVisual {...avatar} label="" sizePx={24} /></AgentAvatarLanyard></motion.span>;
						})}</AvatarGroup> : <>{emptyFieldIcon}<span className="text-sm text-text-subtlest">{onStartAgent ? "Add agent" : "No agent sessions"}</span></>}
						{!open && !showSessionStatus && agentAvatars.length === 1 ? <span aria-hidden="true" className="text-sm text-text">{agentAvatars[0].name}</span> : null}
					</div>
				</div>
	);
	return (
		<Popover onOpenChange={changeOpen} open={open}>
			{field ? <div aria-label="Agents field" className="min-w-0" ref={fieldRef} role="group">
				<AgentAvatarLanyards anchorRef={fieldRef}>
				{showFieldLabel && sessions.length > 0 ? <div className="mb-0.5 min-w-0 text-xs leading-4 text-text-subtle">Agents</div> : null}
				{fieldSessionMenu ? fieldControl : <div className="scrollbar-none -mx-1 -my-1 min-w-0 overflow-x-auto px-1 py-1" data-slot="scroll-fade" ref={fieldScrollRef} style={scrollEdges.start || scrollEdges.end ? buildHorizontalScrollMaskStyle({ edge: scrollEdges.start && scrollEdges.end ? "both" : scrollEdges.start ? "start" : "end", fadeSize: "3rem" }) : undefined}>{fieldControl}</div>}
				</AgentAvatarLanyards>
			</div> : <PopoverTrigger render={<button aria-label={label} className="group/crew inline-flex shrink-0 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!onStartAgent && sessions.length === 0} type="button" />}>
				<AvatarGroup className="-space-x-1.5" label="People and agents working on this item">
					{crew.map((member, index) => member.kind === "person" ? <Avatar className="size-7.5" key={`${member.name}-${index}`} label={`${member.name}, ${member.state}`} size="default" title={`${member.name}, ${member.state}`}><AvatarImage src={member.avatarSrc ?? projectButterPersonAvatar(member.name)} /><AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback></Avatar> : <span className="relative shrink-0" key={`${member.name}-${index}`} title={`${member.name}, ${member.state}`}><AgentAvatarVisual {...member.visual} appearance="coding" label={`${member.name}, ${member.state}`} sizePx={30} status={member.state === "Completed" ? "finished" : member.state === "Needs input" || member.state === "Ready for review" ? "needs-input" : undefined} />{member.state === "Working" ? <span className="absolute -right-0.5 -top-0.5 z-10 grid size-3.5 place-items-center rounded-full bg-surface"><Spinner className="size-2.5" label="Working" size="xs" variant="bloom" /></span> : null}</span>)}
					{onStartAgent ? <Avatar animate={false} borderTone={open ? "selected" : "default"} className="size-7.5" label="Add agent" shape="hexagon" size="default"><AvatarFallback className="bg-transparent text-icon-subtle group-hover/crew:bg-bg-neutral-subtle-hovered"><AddIcon label="" size="small" /></AvatarFallback></Avatar> : null}
				</AvatarGroup>
			</PopoverTrigger>}
			<PopoverContent align={field ? "start" : "end"} aria-label={fieldSessionMenu ? "Agent assignment" : picking ? "Add agent" : "Agent sessions"} className={cn(field && !fieldSessionMenu ? "w-80 max-w-(--available-width) gap-0 overflow-visible bg-transparent p-0 shadow-none" : picking ? "w-[360px] gap-0 overflow-hidden p-0" : "w-[280px] gap-0 overflow-hidden p-0", !(field && !fieldSessionMenu) && dropdownStyles.surface)} finalFocus={() => !selectedAgentRef.current} onKeyDownCapture={(event) => { if (field && event.key === "Escape" && event.target instanceof HTMLInputElement) { event.stopPropagation(); changeOpen(false); } }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (field) changeOpen(false); } }} positionerClassName="z-[650]" side={fieldSessionMenu ? "bottom" : undefined} sideOffset={field ? 8 : undefined}>
				{fieldSessionMenu ? <AgentSessionsMenu items={orderedSessions} teammateSessionsPresentation={viewerOnly ? "count" : "expanded"} onSelectSession={(session) => { onOpenSession(session); changeOpen(false); }} /> : field && onStartAgent && cloudAgentSelector ? <ProjectButterCloudAgentPicker extraAgents={extraAgents} onAssign={(agent) => { startFieldAgent({ id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }); changeOpen(false); }} onBrowseAgents={onBrowseAgents ? () => { changeOpen(false); onBrowseAgents(); } : undefined} onCreateAgent={onCreateAgent ? () => { changeOpen(false); onCreateAgent(); } : undefined} /> : field && onStartAgent ? <ProjectButterAgentPreviewBoundary agents={fieldPickerAgents}><InlineAgentSelector
					agents={fieldPickerAgents}
					softwareAgentIds={["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent"]}
					initialSoftwareLimit={5}
					getActions={(agent) => [
						...orderedSessions.filter((session) => !isLocalAgentListItem(session) && session.agent.name.toLowerCase() === agent.name.toLowerCase()).map((session) => ({ id: session.id, label: session.title, icon: <Icon render={<AiChatIcon label="" size="small" />} />, onSelect: () => { onOpenSession(session); changeOpen(false); } })),
						{ id: "start", label: "Start a new session", icon: <Icon render={<CloudIcon label="" />} />, onSelect: () => { startFieldAgent({ id: agent.id.startsWith("session-agent:") ? agent.id.slice("session-agent:".length) : agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }); changeOpen(false); } },
					]}
					onBrowseAgents={onBrowseAgents ? () => { changeOpen(false); onBrowseAgents(); } : undefined}
					onCreateAgent={onCreateAgent ? () => { changeOpen(false); onCreateAgent(); } : undefined}
				/></ProjectButterAgentPreviewBoundary> : picking && onStartAgent ? <ProjectButterInvocationProvider agents={pickerAgents} enabled><ProjectButterAgentPickerContent sessions={sessions} onContinueSession={(session) => { onOpenSession(session); changeOpen(false); }} onPreviewSession={onPreviewSession} submenuPositionerClassName="z-[700]" workspacePositionerClassName="z-[701]" onBrowseAgents={onBrowseAgents ? () => { changeOpen(false); onBrowseAgents(); } : undefined} onCreateAgent={onCreateAgent ? () => { changeOpen(false); onCreateAgent(); } : undefined} onAssign={(agent) => { onStartAgent({ id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo }); changeOpen(false); }} />{sessions.length > 0 ? <div className={dropdownStyles.padding}><DropdownMenuSeparator /><Button className="w-full justify-start" onClick={() => setView("sessions")} type="button" variant="ghost">View agent sessions</Button></div> : null}</ProjectButterInvocationProvider> : <AgentSessionsMenu items={orderedSessions} overlayPositionerClassName="z-[700]" onSelectSession={(session) => { onOpenSession(session); changeOpen(false); }} />}
			</PopoverContent>
		</Popover>
	);
}
