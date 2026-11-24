"use client";

import AgentSelectorPage from "@/components/blocks/agent-selector/page";
import { ButterAgentSelectorGallery } from "@/components/projects/butter-v1/components/butter-agent-selector-gallery";
import { Switch } from "@/components/ui/switch";
import { useState, type ReactElement } from "react";

export default function AgentSelectorDemo(): ReactElement {
	const [cardTilt, setCardTilt] = useState(true);
	return (
		<div className="flex flex-col items-center justify-center gap-4 p-6">
			<div className="flex items-center gap-2 text-sm text-text">
				<Switch checked={cardTilt} onCheckedChange={setCardTilt} label="Card tilt" />
				Card tilt
			</div>
			<ButterAgentSelectorGallery cloudOnly cardTilt={cardTilt} />
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
				<AgentSelectorPage initialOpen={false} variant="selected-agent-actions" />
			</div>
		</div>
	);
}

export function AgentSelectorDemoJira(): ReactElement {
	return (
		<div className="flex min-h-[32rem] items-start justify-center p-6 pt-8">
			<div className="w-full max-w-80">
				<AgentSelectorPage initialOpen={false} variant="jira" />
			</div>
		</div>
	);
}

export function AgentSelectorDemoInlineExpansion(): ReactElement {
	return <div className="flex min-h-[32rem] items-start justify-center p-6 pt-8"><ButterAgentSelectorGallery label="Inline expansion agent selector" presentation="inline" /></div>;
}

export function AgentSelectorDemoStandalone(): ReactElement {
	return (
		<div className="flex min-h-[32rem] w-full flex-col items-center justify-center gap-4 p-6 md:flex-row md:items-start">
			<AgentSelectorPage presentation="standalone" />
			<AgentSelectorPage presentation="standalone" variant="selected-agent-actions" />
		</div>
	);
}
