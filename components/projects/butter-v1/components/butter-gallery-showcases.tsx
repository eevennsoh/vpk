"use client";

import dynamic from "next/dynamic";
import { AgentSessionShowcase, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";
import { BUTTER_CHAT_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { cn } from "@/lib/utils";

export { ButterSessionPermissionControls, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";

const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));

export function ButterGalleryAgentSessions({ active, permission }: Readonly<{ active: boolean; galleryOpen: boolean; permission: ButterSessionPermission }>) {
	return <AgentSessionShowcase active={active} className="pointer-events-none absolute inset-x-0 top-12 bottom-56 [&>div]:pointer-events-auto" permission={permission} profiles={BUTTER_CHAT_AGENT_PROFILES} />;
}

export function ButterGalleryBoardCard({ galleryOpen }: Readonly<{ galleryOpen: boolean }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex justify-center overflow-y-auto px-4", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto my-auto flex w-full max-w-3xl justify-center">
				<h1 className="sr-only">Board card</h1>
				<JiraIssuePage variant="project-butter" />
			</div>
		</div>
	);
}
