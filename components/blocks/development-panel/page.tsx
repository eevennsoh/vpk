"use client";

import { useEffect, useState } from "react";
import { DevelopmentPanel } from "@/components/blocks/development-panel/development-panel";
import { pullRequestChecksScenario } from "@/components/blocks/pull-request/data/demo-pull-request-checks";
import { DEVELOPMENT_PANEL_PULL_REQUESTS } from "@/components/blocks/pull-request/data/demo-pull-requests";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type CheckPhase = "running" | "failed" | "fixing" | "passed" | "merged";

export default function DevelopmentPanelPage() {
	const [state, setState] = useState("empty");
	const [phase, setPhase] = useState<CheckPhase>("running");
	const [autoFix, setAutoFix] = useState(true);
	const [mergeWhenReady, setMergeWhenReady] = useState(true);
	useEffect(() => {
		if (state !== "pull-requests") return;
		const next = phase === "running" ? "failed" : phase === "failed" && autoFix ? "fixing" : phase === "fixing" ? "passed" : phase === "passed" && mergeWhenReady ? "merged" : null;
		if (!next) return;
		const timer = window.setTimeout(() => setPhase(next), 5000);
		return () => window.clearTimeout(timer);
	}, [autoFix, mergeWhenReady, phase, state]);
	const checks = phase === "running" ? pullRequestChecksScenario("in-progress") : phase === "failed" ? pullRequestChecksScenario("failed") : phase === "fixing" ? pullRequestChecksScenario("failed").map((check) => check.status === "failed" ? { ...check, status: "running" as const, details: "Rerunning after fix" } : check) : pullRequestChecksScenario("passed");
	const pullRequests = DEVELOPMENT_PANEL_PULL_REQUESTS.map((request) => request.number === 1306 ? { ...request, checks, status: phase === "merged" ? "Merged" as const : "Open" as const, onFix: () => setPhase("fixing") } : request);
	return (
		<div className="flex min-h-[360px] w-full flex-col items-center justify-center gap-6 bg-surface p-6">
			<ToggleGroup aria-label="Development panel state" onValueChange={(values) => { if (values[0]) { setState(values[0]); if (values[0] === "empty") setPhase("running"); } }} value={[state]} variant="outline">
				<ToggleGroupItem value="empty">Before setup</ToggleGroupItem>
				<ToggleGroupItem value="pull-requests">Pull requests created</ToggleGroupItem>
			</ToggleGroup>
			<div className="w-full max-w-sm"><DevelopmentPanel footerExtra={phase === "passed" && state === "pull-requests" ? <Button className="mt-2 w-full" onClick={() => setPhase("merged")} size="compact" type="button" variant="outline">Merge pull request</Button> : null} pullRequests={state === "pull-requests" ? pullRequests : []} pullRequestSettings={{ autoFix, mergeWhenReady, onAutoFixChange: setAutoFix, onMergeWhenReadyChange: setMergeWhenReady }} workItem={{ code: "PAY-999", summary: "Improve merchant onboarding for Payments SDK v2", description: "" }} /></div>
		</div>
	);
}
