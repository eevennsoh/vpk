"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AgentTemplateDialog } from "@/components/blocks/agent-template";
import {
	DEMO_AGENT_TEMPLATES,
	DEMO_AGENT_TEMPLATES_SESSION,
} from "@/components/blocks/agent-template/data/demo-template-agents";

export default function AgentTemplatePage() {
	const [open, setOpen] = useState(false);

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Button onClick={() => setOpen(true)}>Open agent templates</Button>
			<AgentTemplateDialog
				open={open}
				onOpenChange={setOpen}
				agents={DEMO_AGENT_TEMPLATES}
				sessionAgents={DEMO_AGENT_TEMPLATES_SESSION}
			/>
		</div>
	);
}
