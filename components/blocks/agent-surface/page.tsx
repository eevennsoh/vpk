"use client";

import { AgentSurface } from "@/components/blocks/agent-surface";

export default function AgentSurfacePage() {
	return (
		<div className="flex min-h-screen w-full justify-center bg-surface-sunken p-6">
			<div className="flex w-full max-w-4xl">
				<AgentSurface />
			</div>
		</div>
	);
}
