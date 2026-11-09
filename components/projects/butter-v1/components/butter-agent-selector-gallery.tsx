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
import { InlineAgentSelectorDemo } from "@/components/website/demos/blocks/inline-agent-selector-demo";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));

const EXISTING_SESSIONS: readonly AgentSessionItem[] = [
	{ id: "demo-onboarding-guide", title: "Review the onboarding quickstart", agent: { id: "claude-code", name: "Claude", brandName: "claude" }, host: "cloud", state: "running", timeLabel: "2m ago", invokedBy: BUTTER_PAY_CURRENT_USER },
	{ id: "demo-onboarding-tests", title: "Check the onboarding tests", agent: { id: "claude-code", name: "Claude", brandName: "claude" }, host: "cloud", state: "needs-input", timeLabel: "10m ago", invokedBy: BUTTER_PAY_CURRENT_USER },
];

export type ButterAgentPresentation = "submenu" | "inline";

export function ButterAgentSelectorControls({ presentation, onPresentationChange }: Readonly<{
	presentation: ButterAgentPresentation;
	onPresentationChange: (presentation: ButterAgentPresentation) => void;
}>) {
	return <ToggleGroup aria-label="Agent actions presentation" onValueChange={(values) => { if (values[0] === "submenu" || values[0] === "inline") onPresentationChange(values[0]); }} size="sm" value={[presentation]} variant="outline">
		<ToggleGroupItem value="inline">Inline expand</ToggleGroupItem>
		<ToggleGroupItem value="submenu">Submenu</ToggleGroupItem>
	</ToggleGroup>;
}

export function ButterAgentSelectorGallery({ variant = "default", presentation = "inline", label }: Readonly<{ variant?: "default" | "duplicative-sessions"; presentation?: ButterAgentPresentation; label?: string }>) {
	const router = useRouter();
	const [selectedAgentIds, setSelectedAgentIds] = useState<readonly string[]>([]);
	const [sessions, setSessions] = useState(EXISTING_SESSIONS);
	const [favoriteAgentIds, setFavoriteAgentIds] = useState<readonly string[]>([]);
	const [sessionStatus, setSessionStatus] = useState("");
	const [directoryOpen, setDirectoryOpen] = useState(false);
	const [pickerKey, setPickerKey] = useState(0);
	const createAgent = () => router.push("/studio");
	const startSession = (agent: (typeof BUTTER_PICKER_AGENTS)[number]) => {
		if (variant === "duplicative-sessions") {
			setSessions((current) => [...current, { id: `demo-new-session-${pickerKey}`, title: "Review onboarding changes", agent: { id: agent.id, name: agent.name, brandName: agent.brandName, avatarSrc: agent.avatarSrc }, host: "cloud", state: "running", timeLabel: "Just now", invokedBy: BUTTER_PAY_CURRENT_USER }]);
			setSessionStatus(`Started a new ${agent.name} session`);
		}
		setSelectedAgentIds([agent.id]);
		setPickerKey((current) => current + 1);
	};
	const continueSession = (session: AgentSessionItem) => {
		setSessionStatus(`Selected session: ${session.title}`);
		setSelectedAgentIds(session.agent.id ? [session.agent.id] : []);
		setPickerKey((current) => current + 1);
	};
	const inlineSessionProps = variant === "duplicative-sessions" ? {
		sessions, status: sessionStatus, favoriteAgentIds, onFavoriteAgentIdsChange: setFavoriteAgentIds, includeRovoCli: true, initialSoftwareLimit: 3,
		onContinueSession: continueSession, onStartSession: startSession,
		onBrowseAgents: () => setDirectoryOpen(true), onCreateAgent: createAgent,
	} : {};

	return (
		<>
			<div className="pointer-events-auto my-auto flex w-80 max-w-full shrink-0 flex-col items-center gap-4">
				<section aria-label={label ?? (variant === "duplicative-sessions" ? "Duplicative sessions agent selector" : "Project Butter agent selector")} className={cn("w-full", presentation === "submenu" && "overflow-hidden rounded-xl bg-popover text-popover-foreground")} style={presentation === "submenu" ? { boxShadow: token("elevation.shadow.overlay") } : undefined}>
					{variant === "duplicative-sessions" ? <h1 className="sr-only">Duplicative sessions</h1> : null}
					{presentation === "inline" ? <InlineAgentSelectorDemo key={pickerKey} {...inlineSessionProps} /> : <ProjectButterInvocationProvider agents={BUTTER_PICKER_AGENTS} enabled>
						<ProjectButterAgentPickerContent
							key={pickerKey}
							onAssign={startSession}
							onBrowseAgents={() => setDirectoryOpen(true)}
							onContinueSession={variant === "duplicative-sessions" ? continueSession : undefined}
							onCreateAgent={createAgent}
							sessions={variant === "duplicative-sessions" ? sessions : undefined}
							selectedAgentIds={selectedAgentIds}
						/>
					</ProjectButterInvocationProvider>}
					{presentation === "submenu" ? <p role="status" className="sr-only">{sessionStatus}</p> : null}
				</section>
			</div>
			{directoryOpen ? <AgentsDirectoryDialog agents={BUTTER_DIRECTORY_AGENT_PROFILES} onCreateAgent={createAgent} onOpenChange={setDirectoryOpen} onSelectAgent={() => setDirectoryOpen(false)} open={directoryOpen} variant="standard-v2" /> : null}
		</>
	);
}
