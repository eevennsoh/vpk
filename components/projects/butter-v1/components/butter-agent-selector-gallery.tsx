"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { ProjectButterCloudAgentPicker } from "@/components/blocks/jira-issue/project-butter-inline-agent-picker";
import { ProjectButterInvocationProvider } from "@/components/blocks/jira-issue/project-butter-invocation";
import { BUTTER_DIRECTORY_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { InlineAgentSelectorDemo } from "@/components/website/demos/blocks/inline-agent-selector-demo";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));

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

export function ButterAgentSelectorGallery({ presentation = "inline", label, cloudOnly = false, showCreateAgent = true }: Readonly<{ presentation?: ButterAgentPresentation; label?: string; cloudOnly?: boolean; showCreateAgent?: boolean }>) {
	const router = useRouter();
	const [selectedAgentIds, setSelectedAgentIds] = useState<readonly string[]>([]);
	const [favoriteAgentIds, setFavoriteAgentIds] = useState<readonly string[]>([]);
	const [cloudStatus, setCloudStatus] = useState("");
	const [directoryOpen, setDirectoryOpen] = useState(false);
	const [pickerKey, setPickerKey] = useState(0);
	const createAgent = () => router.push("/studio");
	const startSession = (agent: (typeof BUTTER_PICKER_AGENTS)[number]) => {
		setSelectedAgentIds([agent.id]);
		setPickerKey((current) => current + 1);
	};
	const useSubmenu = presentation === "submenu";

	return (
		<>
			<div className="pointer-events-auto my-auto flex w-80 max-w-full shrink-0 flex-col items-center gap-4">
				<section aria-label={label ?? "Project Butter agent selector"} className={cn("w-full", useSubmenu && "overflow-hidden rounded-lg bg-popover text-popover-foreground")} style={useSubmenu ? { boxShadow: token("elevation.shadow.overlay") } : undefined}>
					{!useSubmenu ? cloudOnly ? <ProjectButterCloudAgentPicker key={pickerKey} onAssign={(agent) => setCloudStatus(`Start on Cloud · ${agent.name} (preview)`)} onBrowseAgents={() => setCloudStatus("Browse agents (preview)")} status={cloudStatus} /> : <InlineAgentSelectorDemo key={pickerKey} showCreateAgent={showCreateAgent} /> : <ProjectButterInvocationProvider agents={BUTTER_PICKER_AGENTS} enabled>
						<ProjectButterAgentPickerContent
							key={pickerKey}
							favoriteAgentIds={favoriteAgentIds}
							onFavoriteAgentIdsChange={setFavoriteAgentIds}
							onAssign={startSession}
							onBrowseAgents={() => setDirectoryOpen(true)}
							onCreateAgent={showCreateAgent ? createAgent : undefined}
							selectedAgentIds={selectedAgentIds}
							showSubmenuChevron
						/>
					</ProjectButterInvocationProvider>}
				</section>
			</div>
			{directoryOpen ? <AgentsDirectoryDialog agents={BUTTER_DIRECTORY_AGENT_PROFILES} onCreateAgent={createAgent} onOpenChange={setDirectoryOpen} onSelectAgent={() => setDirectoryOpen(false)} open={directoryOpen} variant="standard-v2" /> : null}
		</>
	);
}
