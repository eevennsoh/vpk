"use client";

import { ProjectButterAddAgent } from "@/components/blocks/jira-issue/project-butter-add-agent";
import { ProjectButterInvocationChin } from "@/components/blocks/jira-issue/project-butter-invocation-chin";
import { ProjectButterInvocationProvider } from "@/components/blocks/jira-issue/project-butter-invocation";
import { JiraListAgentSessionsCell } from "@/components/blocks/jira-list/jira-list-cells";
import type { JiraListProps, JiraListRowData } from "@/components/blocks/jira-list";

export function ButterListAgentCell({ agentCatalog, onAssignedAgentIdsChange, onAssignedAgentSelect, onBrowseAgents, onCreateAgent, row }: Readonly<{
	agentCatalog: NonNullable<JiraListProps["agentCatalog"]>;
	onAssignedAgentIdsChange: NonNullable<JiraListProps["onAssignedAgentIdsChange"]>;
	onAssignedAgentSelect?: JiraListProps["onAssignedAgentSelect"];
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	row: JiraListRowData;
}>) {
	const sessions = row.agentSessions ?? [];
	return (
		<ProjectButterInvocationProvider agents={agentCatalog} enabled>
			<div className="group/jira-issue flex min-w-0 items-center gap-1" data-butter-agent-surface>
				<ProjectButterAddAgent alwaysVisible issueKey={row.issueKey} assignment={{
					agents: agentCatalog,
					assignedAgents: sessions.map((agent) => ({ ...agent, byline: agent.byline ?? "" })),
					onAssignedAgentIdsChange: (ids) => onAssignedAgentIdsChange(row.issueKey, ids),
					onBrowseAgents,
					onCreateAgent,
				}} />
				{sessions.length === 0 ? <span className="pointer-events-none shrink-0 text-sm text-text-subtlest">Add agent</span> : null}
				<div className="min-w-0 flex-1">
					<ProjectButterInvocationChin hasChin={sessions.length > 0}>
						{sessions.length > 0 ? <JiraListAgentSessionsCell
							agentCatalog={agentCatalog}
							agentSessions={sessions}
							onAssignedAgentIdsChange={(ids) => onAssignedAgentIdsChange(row.issueKey, ids)}
							onAssignedAgentSelect={onAssignedAgentSelect ? (agent) => onAssignedAgentSelect(row.issueKey, agent) : undefined}
							onBrowseAgents={onBrowseAgents}
							onCreateAgent={onCreateAgent}
						/> : null}
					</ProjectButterInvocationChin>
				</div>
			</div>
		</ProjectButterInvocationProvider>
	);
}
