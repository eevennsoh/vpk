"use client";

import { Suspense, createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

function JiraGoldenJourneyV1Content() {
	const Demo = use(loadDemoComponent("jira-golden-journey-v1", "projects"));
	if (!Demo) return null;
	return createElement(Demo);
}

export default function JiraGoldenJourneyV1Page() {
	return (
		<Suspense>
			<JiraGoldenJourneyV1Content />
		</Suspense>
	);
}
