"use client";

import { JIRA_INSIGHT_DEMO_SNAPSHOT } from "@/components/blocks/jira-insight/data";
import { JiraInsight } from "@/components/blocks/jira-insight";

export default function JiraInsightPage() {
	return (
		<div className="flex min-h-screen w-full justify-center bg-surface-overlay p-6">
			<JiraInsight className="w-full max-w-3xl" snapshot={JIRA_INSIGHT_DEMO_SNAPSHOT} />
		</div>
	);
}
