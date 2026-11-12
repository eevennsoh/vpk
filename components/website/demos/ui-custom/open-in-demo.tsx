"use client";

import { JiraLocalAgentSplitButton } from "@/components/blocks/jira-local-agent";

export default function OpenInDemo() {
	return <JiraLocalAgentSplitButton workItem={{ code: "PAY-999", summary: "Improve merchant onboarding", description: "" }} />;
}
