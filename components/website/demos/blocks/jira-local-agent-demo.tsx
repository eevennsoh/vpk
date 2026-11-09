"use client";

import { JiraLocalAgent } from "@/components/blocks/jira-local-agent";
import { ButterAgentSelectorControls, type ButterAgentPresentation } from "@/components/projects/butter-v1/components/butter-agent-selector-gallery";
import { useState } from "react";

export default function JiraLocalAgentDemo() {
	const [presentation, setPresentation] = useState<ButterAgentPresentation>("submenu");
	return <div className="flex h-full min-h-64 flex-col items-center justify-center gap-6 p-6"><ButterAgentSelectorControls presentation={presentation} onPresentationChange={setPresentation} /><JiraLocalAgent presentation={presentation} workItem={{ code: "PAY-999", summary: "Improve merchant onboarding for Payments SDK v2", description: "" }} /></div>;
}
