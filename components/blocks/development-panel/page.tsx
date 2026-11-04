"use client";

import { useState } from "react";
import { DevelopmentPanel } from "@/components/blocks/development-panel/development-panel";
import { DEMO_PULL_REQUESTS } from "@/components/blocks/pull-request/data/demo-pull-requests";
import { pullRequestChecksScenario } from "@/components/blocks/pull-request/data/demo-pull-request-checks";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PANEL_PULL_REQUESTS = DEMO_PULL_REQUESTS.map((request) => request.number === 1306 ? { ...request, checks: pullRequestChecksScenario("in-progress") } : request);

export default function DevelopmentPanelPage() {
	const [state, setState] = useState("empty");
	return (
		<div className="flex min-h-[360px] w-full flex-col items-center justify-center gap-6 bg-surface p-6">
			<ToggleGroup aria-label="Development panel state" onValueChange={(values) => { if (values[0]) setState(values[0]); }} value={[state]} variant="outline">
				<ToggleGroupItem value="empty">Before setup</ToggleGroupItem>
				<ToggleGroupItem value="pull-requests">Pull requests created</ToggleGroupItem>
			</ToggleGroup>
			<div className="w-full max-w-sm"><DevelopmentPanel pullRequests={state === "pull-requests" ? PANEL_PULL_REQUESTS : []} workItem={{ code: "PAY-999", summary: "Improve merchant onboarding for Payments SDK v2", description: "" }} /></div>
		</div>
	);
}
