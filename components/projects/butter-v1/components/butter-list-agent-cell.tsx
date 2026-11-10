"use client";

import { ProjectButterAddAgent } from "@/components/blocks/jira-issue/project-butter-add-agent";
import { ProjectButterInvocationChin } from "@/components/blocks/jira-issue/project-butter-invocation-chin";
import { ProjectButterInvocationProvider, useProjectButterInvocationPhase } from "@/components/blocks/jira-issue/project-butter-invocation";
import { ProjectButterCrew } from "@/components/blocks/jira-work-item/project-butter/project-butter-crew";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraListProps, JiraListRowData } from "@/components/blocks/jira-list";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";

export function ButterListAgentCell({ agentCatalog, onAgentAssigned, onAssignedAgentIdsChange, onAssignedAgentSelect, onBrowseAgents, onCreateAgent, row }: Readonly<{
	agentCatalog: NonNullable<JiraListProps["agentCatalog"]>;
	onAgentAssigned?: (issueKey: string, agent: AgentSelectorAgent) => void;
	onAssignedAgentIdsChange: NonNullable<JiraListProps["onAssignedAgentIdsChange"]>;
	onAssignedAgentSelect?: JiraListProps["onAssignedAgentSelect"];
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	row: JiraListRowData;
}>) {
	return (
		<ProjectButterInvocationProvider agents={agentCatalog} enabled>
			<ButterListAgentCellContent agentCatalog={agentCatalog} onAgentAssigned={onAgentAssigned} onAssignedAgentIdsChange={onAssignedAgentIdsChange} onAssignedAgentSelect={onAssignedAgentSelect} onBrowseAgents={onBrowseAgents} onCreateAgent={onCreateAgent} row={row} />
		</ProjectButterInvocationProvider>
	);
}

function ButterListAgentCellContent({ agentCatalog, onAgentAssigned, onAssignedAgentIdsChange, onAssignedAgentSelect, onBrowseAgents, onCreateAgent, row }: Parameters<typeof ButterListAgentCell>[0]) {
	const sessions = row.agentSessions ?? [];
	const phase = useProjectButterInvocationPhase();
	const crewSessions: AgentSessionItem[] = sessions.map((session) => ({
		id: session.id,
		title: session.sessionTitle ?? row.summary,
		state: session.statusKind === "needs-input" ? "needs-input" : session.statusKind === "finished" ? "complete" : "running",
		agent: { id: agentCatalog.find((agent) => agent.name === session.name)?.id ?? session.id, kind: "agent", name: session.name, avatarSrc: session.avatarSrc, brandName: session.brandName },
		host: session.host,
		invokedBy: session.invokedBy,
		role: session.role,
	}));
	return (
			<div className="group/jira-issue flex min-w-0 items-center gap-1" data-butter-agent-surface>
				<ProjectButterAddAgent alwaysVisible side="left" issueKey={row.issueKey} assignment={{
					agents: agentCatalog,
					assignedAgents: sessions.map((agent) => ({ ...agent, byline: agent.byline ?? "" })),
					onAgentAssign: (agent) => onAgentAssigned?.(row.issueKey, agent),
					onAssignedAgentIdsChange: (ids) => onAssignedAgentIdsChange(row.issueKey, ids),
					onBrowseAgents,
					onCreateAgent,
				}} />
				{sessions.length === 0 && phase !== "choosing" && phase !== "handoff" ? <span className="pointer-events-none shrink-0 text-sm text-text-subtlest">Add agent</span> : null}
				<div className="min-w-0 flex-1 pt-1">
					<ProjectButterInvocationChin activities={sessions} hasChin={sessions.length > 0} flushPreview>
						{sessions.length > 0 ? <ProjectButterCrew
							field
							cloudAgentSelector
							showFieldLabel={false}
							sessions={crewSessions}
							onOpenSession={(session) => { const selected = sessions.find((candidate) => candidate.id === session.id); if (selected) onAssignedAgentSelect?.(row.issueKey, selected); }}
							onStartAgent={(agent) => { const selected = agentCatalog.find((candidate) => candidate.id === agent.id); if (selected) { onAgentAssigned?.(row.issueKey, selected); onAssignedAgentIdsChange(row.issueKey, [...sessions.map((session) => session.id), selected.id]); } }}
							onBrowseAgents={onBrowseAgents}
							onCreateAgent={onCreateAgent}
						/> : null}
					</ProjectButterInvocationChin>
				</div>
			</div>
	);
}
