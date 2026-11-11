"use client";

import { useState } from "react";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { ProjectButterAgentPicker } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { ProjectButterInvocationPreview } from "@/components/blocks/jira-issue/project-butter-invocation-chin";
import { ProjectButterInvocationProvider, useProjectButterInvocationActions, useProjectButterInvocationPhase } from "@/components/blocks/jira-issue/project-butter-invocation";
import { AgentAdd } from "@/components/ui-custom/agent-add";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";

function AgentAddExample() {
	const phase = useProjectButterInvocationPhase();
	const actions = useProjectButterInvocationActions();
	const [selected, setSelected] = useState<AgentSelectorAgent | null>(null);
	if (!actions) return null;
	const open = phase === "choosing";
	return (
		<div className="w-64 rounded-md bg-bg-neutral p-3">
			<div className="flex items-center justify-between gap-4">
				<span className="text-sm text-text-subtle">Add an agent</span>
				<div className="group/butter-add-agent" data-open={open || undefined}>
					<AgentAdd label="Add agent to this work item" open={open} onOpenChange={(nextOpen) => nextOpen ? actions.open("footer") : actions.close()}>
						<ProjectButterAgentPicker onAssign={(agent) => { setSelected(agent); actions.close(); }} />
					</AgentAdd>
				</div>
			</div>
			{open ? <ProjectButterInvocationPreview flush /> : selected ? (
				<div className="flex h-8 items-center">
					<span className="flex size-6 items-center justify-center"><AgentAvatarVisual appearance="coding" avatarSrc={selected.avatarSrc} brandName={selected.brandName} logoName={selected.logoName} vpkLogo={selected.vpkLogo} label={`${selected.name} selected`} sizePx={24} animate={false} /></span>
				</div>
			) : null}
		</div>
	);
}

export default function AgentAddDemo() {
	return <ProjectButterInvocationProvider enabled><AgentAddExample /></ProjectButterInvocationProvider>;
}
