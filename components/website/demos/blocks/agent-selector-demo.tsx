"use client";

import AgentSelectorPage from "@/components/blocks/agent-selector/page";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { ProjectButterInvocationProvider } from "@/components/blocks/jira-issue/project-butter-invocation";
import { useState, type ReactElement } from "react";
import { InlineAgentSelectorDemo } from "./inline-agent-selector-demo";

const BUTTER_DEMO_SESSIONS: readonly AgentSessionItem[] = [
	{ id: "cursor-session", title: "Carry card-artwork metadata into the next wallet epic", state: "running", host: "cloud", agent: { id: "test-agent", name: "Cursor" } },
];

export default function AgentSelectorDemo(): ReactElement {
	return (
		<div className="flex items-center justify-center p-6">
			<div className="w-full max-w-80">
				<AgentSelectorPage />
			</div>
		</div>
	);
}

export function AgentSelectorDemoSelectedAgentActions(): ReactElement {
	return (
		<div className="flex min-h-[32rem] items-start justify-center p-6 pt-8">
			<div className="w-full max-w-80">
				<AgentSelectorPage variant="selected-agent-actions" />
			</div>
		</div>
	);
}

export function AgentSelectorDemoJira(): ReactElement {
	return (
		<div className="flex min-h-[32rem] items-start justify-center p-6 pt-8">
			<div className="w-full max-w-80">
				<AgentSelectorPage variant="jira" />
			</div>
		</div>
	);
}

export function AgentSelectorDemoInlineExpansion(): ReactElement {
	return <div className="flex min-h-[32rem] items-start justify-center p-6 pt-8"><InlineAgentSelectorDemo /></div>;
}

export function AgentSelectorDemoProjectButter(): ReactElement {
	const [selectedAgentIds, setSelectedAgentIds] = useState<readonly string[]>([]);
	const [continuedSession, setContinuedSession] = useState<string | null>(null);

	return (
		<div className="flex min-h-[32rem] items-start justify-center p-6 pt-8">
			<div className="w-80 max-w-full">
				<div className="overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl">
					<ProjectButterInvocationProvider agents={BUTTER_PICKER_AGENTS} enabled>
						<ProjectButterAgentPickerContent
							selectedAgentIds={selectedAgentIds}
							sessions={BUTTER_DEMO_SESSIONS}
							onAssign={(agent) => setSelectedAgentIds([agent.id])}
							onContinueSession={(session) => setContinuedSession(session.title)}
							onBrowseAgents={() => undefined}
							onCreateAgent={() => undefined}
						/>
					</ProjectButterInvocationProvider>
				</div>
				<p aria-live="polite" className="mt-3 text-sm text-text-subtle">{continuedSession ? `Continuing: ${continuedSession}` : null}</p>
			</div>
		</div>
	);
}

export function AgentSelectorDemoStandalone(): ReactElement {
	return (
		<div className="flex min-h-[32rem] w-full flex-col items-center justify-center gap-4 p-6 md:flex-row md:items-start">
			<AgentSelectorPage presentation="standalone" />
			<AgentSelectorPage presentation="standalone" variant="selected-agent-actions" />
		</div>
	);
}
