"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { ProjectButterInvocationProvider } from "@/components/blocks/jira-issue/project-butter-invocation";
import { BUTTER_DIRECTORY_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { BUTTER_PAY_CURRENT_USER } from "@/components/projects/butter-v1/data/current-user";
import { token } from "@/lib/tokens";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));

const EXISTING_SESSIONS: readonly AgentSessionItem[] = [
	{ id: "demo-onboarding-guide", title: "Review the onboarding quickstart", agent: { id: "claude-code", name: "Claude", brandName: "claude" }, host: "cloud", state: "running", timeLabel: "2m ago", invokedBy: BUTTER_PAY_CURRENT_USER },
	{ id: "demo-onboarding-tests", title: "Check the onboarding tests", agent: { id: "claude-code", name: "Claude", brandName: "claude" }, host: "cloud", state: "needs-input", timeLabel: "10m ago", invokedBy: BUTTER_PAY_CURRENT_USER },
];

export function ButterAgentSelectorGallery({ variant = "default" }: Readonly<{ variant?: "default" | "duplicative-sessions" }>) {
	const router = useRouter();
	const [selectedAgentIds, setSelectedAgentIds] = useState<readonly string[]>([]);
	const [sessions, setSessions] = useState(EXISTING_SESSIONS);
	const [sessionStatus, setSessionStatus] = useState("");
	const [directoryOpen, setDirectoryOpen] = useState(false);
	const [pickerKey, setPickerKey] = useState(0);
	const createAgent = () => router.push("/studio");

	return (
		<>
			<section aria-label={variant === "duplicative-sessions" ? "Duplicative sessions agent selector" : "Project Butter agent selector"} className="pointer-events-auto my-auto w-[360px] max-w-full shrink-0 overflow-hidden rounded-xl bg-popover text-popover-foreground" style={{ boxShadow: token("elevation.shadow.overlay") }}>
				{variant === "duplicative-sessions" ? <h1 className="sr-only">Duplicative sessions</h1> : null}
				<ProjectButterInvocationProvider agents={BUTTER_PICKER_AGENTS} enabled>
					<ProjectButterAgentPickerContent
						key={pickerKey}
						onAssign={(agent) => {
							if (variant === "duplicative-sessions") {
								setSessions((current) => [...current, { id: `demo-new-session-${pickerKey}`, title: "Review onboarding changes", agent: { id: agent.id, name: agent.name, brandName: agent.brandName, avatarSrc: agent.avatarSrc }, host: "cloud", state: "running", timeLabel: "Just now", invokedBy: BUTTER_PAY_CURRENT_USER }]);
								setSessionStatus(`Started a new ${agent.name} session`);
							}
							setSelectedAgentIds([agent.id]);
							setPickerKey((current) => current + 1);
						}}
						onBrowseAgents={() => setDirectoryOpen(true)}
						onContinueSession={variant === "duplicative-sessions" ? (session) => { setSessionStatus(`Selected session: ${session.title}`); setSelectedAgentIds(session.agent.id ? [session.agent.id] : []); setPickerKey((current) => current + 1); } : undefined}
						onCreateAgent={createAgent}
						sessions={variant === "duplicative-sessions" ? sessions : undefined}
						selectedAgentIds={selectedAgentIds}
					/>
				</ProjectButterInvocationProvider>
				{sessionStatus ? <p role="status" className="border-t border-border px-3 py-2 text-sm text-text-subtle">{sessionStatus}</p> : null}
			</section>
			{directoryOpen ? <AgentsDirectoryDialog agents={BUTTER_DIRECTORY_AGENT_PROFILES} onCreateAgent={createAgent} onOpenChange={setDirectoryOpen} onSelectAgent={() => setDirectoryOpen(false)} open={directoryOpen} variant="standard-v2" /> : null}
		</>
	);
}
