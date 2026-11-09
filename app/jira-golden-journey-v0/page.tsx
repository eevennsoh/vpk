"use client";

import { Suspense, createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

function JiraGoldenJourneyV0Content() {
	const Demo = use(loadDemoComponent("jira-golden-journey-v0", "projects"));
	if (!Demo) return null;
	return createElement(Demo);
}

export default function JiraGoldenJourneyV0Page() {
	return (
		<Suspense>
			<JiraGoldenJourneyV0Content />
		</Suspense>
	);
}
