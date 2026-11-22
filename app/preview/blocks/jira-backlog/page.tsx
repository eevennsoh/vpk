import dynamic from "next/dynamic";

const JiraBacklogDemo = dynamic(() => import("@/components/website/demos/blocks/jira-backlog-demo"));

export default function JiraBacklogPreviewPage() {
	return <JiraBacklogDemo />;
}
