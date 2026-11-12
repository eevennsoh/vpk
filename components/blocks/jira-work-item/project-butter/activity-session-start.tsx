"use client";

import { AgentSession } from "@/components/blocks/agent-session";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";

export function ProjectButterSessionStart({ session, onOpen }: Readonly<{ session: ProjectButterSessionItem; onOpen: (id: string) => void }>) {
	return (
		<div className="relative rounded-lg border border-border bg-surface" data-project-butter-session-start={session.id}>
			<AgentSession animateLayout={false} density="long" items={[session]} onView={(item) => onOpen(item.id)} selectedItemId={null} showLinkWorkItemMenuItem={false} variant="large" />
		</div>
	);
}
