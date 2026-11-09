"use client";

import { Suspense, createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

function JiraGoldenJourneyV3Content() {
	const Demo = use(loadDemoComponent("jira-golden-journey-v3", "projects"));
	if (!Demo) return null;
	return createElement(Demo);
}

export default function JiraGoldenJourneyV3Page() {
	return (
		<Suspense>
			<JiraGoldenJourneyV3Content />
		</Suspense>
	);
}
