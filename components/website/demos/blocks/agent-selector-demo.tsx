"use client";

import AgentSelectorPage from "@/components/blocks/agent-selector/page";
import { ButterAgentSelectorGallery } from "@/components/projects/butter-v1/components/butter-agent-selector-gallery";
import type { ReactElement } from "react";

export default function AgentSelectorDemo(): ReactElement {
	return (
		<div className="flex items-center justify-center p-6">
			<div className="w-full max-w-80">
				<AgentSelectorPage />
			</div>
		</div>
	);
}

export function AgentSelectorDemoIncludeByline(): ReactElement {
	return <div className="flex min-h-[32rem] items-start justify-center p-6 pt-8"><div className="w-full max-w-80"><AgentSelectorPage includeByline presentation="standalone" /></div></div>;
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
	return <div className="flex min-h-[32rem] items-start justify-center p-6 pt-8"><ButterAgentSelectorGallery label="Inline expansion agent selector" presentation="inline" /></div>;
}

export function AgentSelectorDemoProjectButter(): ReactElement {
	return <div className="flex min-h-[32rem] items-start justify-center p-6 pt-8"><ButterAgentSelectorGallery label="Submenu agent selector" presentation="submenu" /></div>;
}

export function AgentSelectorDemoStandalone(): ReactElement {
	return (
		<div className="flex min-h-[32rem] w-full flex-col items-center justify-center gap-4 p-6 md:flex-row md:items-start">
			<AgentSelectorPage presentation="standalone" />
			<AgentSelectorPage presentation="standalone" variant="selected-agent-actions" />
		</div>
	);
}
