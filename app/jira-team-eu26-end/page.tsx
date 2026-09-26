"use client";

import { Suspense, createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

function JiraTeamEu26EndContent() {
	const Demo = use(loadDemoComponent("jira-team-eu26-end", "projects"));
	if (!Demo) return null;
	return createElement(Demo);
}

export default function JiraTeamEu26EndPage() {
	return (
		<Suspense>
			<JiraTeamEu26EndContent />
		</Suspense>
	);
}
