"use client";

import { Suspense, createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

function JiraGoldenJourneyV4Content() {
	const Demo = use(loadDemoComponent("jira-golden-journey-v4", "projects"));
	if (!Demo) return null;
	return createElement(Demo);
}

export default function JiraGoldenJourneyV4Page() {
	return (
		<Suspense>
			<JiraGoldenJourneyV4Content />
		</Suspense>
	);
}
