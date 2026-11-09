"use client";

import Subagent from "@/components/blocks/subagent/page";
import { DEFAULT_SUBAGENT_BASE_AGENT } from "@/components/blocks/subagent/data/demo-agents";

export default function SubagentDemo() {
	return <Subagent />;
}

export function SubagentDemoEmpty() {
	return (
		<Subagent
			initialBaseAgent={DEFAULT_SUBAGENT_BASE_AGENT}
			initialSubagents={[]}
		/>
	);
}
