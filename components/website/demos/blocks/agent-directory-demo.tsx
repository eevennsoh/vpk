import AgentsDirectoryPage, { AgentsDirectoryExperimentalPage, AgentsDirectoryStandardV1Page } from "@/components/blocks/agent-directory/page";

export default function AgentsDirectoryDemo(): React.ReactElement {
	return <AgentsDirectoryPage />;
}

export function AgentsDirectoryDemoStandard(): React.ReactElement {
	return <AgentsDirectoryStandardV1Page />;
}

export function AgentsDirectoryDemoStandardV2(): React.ReactElement {
	return <AgentsDirectoryPage />;
}

export function AgentsDirectoryDemoExperimental(): React.ReactElement {
	return <AgentsDirectoryExperimentalPage />;
}
