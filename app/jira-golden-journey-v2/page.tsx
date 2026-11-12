"use client";

import { Suspense, createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

function JiraGoldenJourneyV2Content() {
	const Demo = use(loadDemoComponent("jira-golden-journey-v2", "projects"));
	if (!Demo) return null;
	return createElement(Demo);
}

export default function JiraGoldenJourneyV2Page() {
	return (
		<Suspense>
			<JiraGoldenJourneyV2Content />
		</Suspense>
	);
}
