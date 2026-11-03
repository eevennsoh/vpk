"use client";

import { ProjectButterAddAgent } from "@/components/blocks/jira-issue/project-butter-add-agent";
import { ProjectButterInvocationChin } from "@/components/blocks/jira-issue/project-butter-invocation-chin";
import { ProjectButterInvocationProvider, useProjectButterInvocationActions } from "@/components/blocks/jira-issue/project-butter-invocation";
import { JiraListAgentSessionsCell } from "@/components/blocks/jira-list/jira-list-cells";
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
	const invocation = useProjectButterInvocationActions();
	return (
			<div className="group/jira-issue flex min-w-0 items-center gap-1" data-butter-agent-surface>
				<ProjectButterAddAgent alwaysVisible issueKey={row.issueKey} assignment={{
					agents: agentCatalog,
					assignedAgents: sessions.map((agent) => ({ ...agent, byline: agent.byline ?? "" })),
					onAgentAssign: (agent) => { if (!sessions.some((session) => session.id === agent.id)) onAgentAssigned?.(row.issueKey, agent); },
					onAssignedAgentIdsChange: (ids) => onAssignedAgentIdsChange(row.issueKey, ids),
					onBrowseAgents,
					onCreateAgent,
				}} />
				{sessions.length === 0 ? <span className="pointer-events-none shrink-0 text-sm text-text-subtlest">Add agent</span> : null}
				<div className="min-w-0 flex-1">
					<ProjectButterInvocationChin activities={sessions} hasChin={sessions.length > 0}>
						{sessions.length > 0 ? <JiraListAgentSessionsCell
							agentCatalog={agentCatalog}
							agentSessions={sessions}
							onAssignedAgentIdsChange={(ids) => onAssignedAgentIdsChange(row.issueKey, ids)}
							onAssignedAgentSelect={onAssignedAgentSelect ? (agent) => onAssignedAgentSelect(row.issueKey, agent) : undefined}
							onBrowseAgents={onBrowseAgents}
							onCreateAgent={onCreateAgent}
							onRequestAddAgent={() => invocation?.open("footer")}
						/> : null}
					</ProjectButterInvocationChin>
				</div>
			</div>
	);
}
