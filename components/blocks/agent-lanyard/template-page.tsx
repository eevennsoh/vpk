"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { AgentLanyard } from "./agent-lanyard";
import { AGENT_LANYARD_TEMPLATES } from "./template-data";

export default function AgentLanyardTemplatePage() {
	const [perspectiveTilt, setPerspectiveTilt] = useState(true);
	return (
		<div className="w-full bg-surface p-6" data-slot="agent-lanyard-template-demo">
			<div className="mx-auto flex max-w-[1000px] flex-col gap-6">
				<div className="flex items-center gap-2 text-sm text-text">
					<Switch checked={perspectiveTilt} onCheckedChange={setPerspectiveTilt} label="Template perspective tilt" />
					Perspective tilt
				</div>
				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
					{AGENT_LANYARD_TEMPLATES.map((template) => (
						<AgentLanyard key={template.id} variant="template" template={template} perspectiveTilt={perspectiveTilt} className="w-full" />
					))}
				</div>
			</div>
		</div>
	);
}
