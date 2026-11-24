"use client";

import dynamic from "next/dynamic";

const JiraForYouWorkspacePreview = dynamic(() => import("@/components/projects/jira-for-you/page").then((module) => module.JiraForYouWorkspacePreview), { ssr: false });

export default function JiraForYouWorkspacePreviewPage() {
	return <JiraForYouWorkspacePreview />;
}
