"use client";

import dynamic from "next/dynamic";
import { AGENT_SESSION_ITEMS, type AgentSessionItem } from "@/components/blocks/agent-session";
import { AGENT_SESSION_DEMO_CHECKS } from "@/components/blocks/agent-session/data";
import { AgentSessionShowcase, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";
import { BUTTER_CHAT_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { cn } from "@/lib/utils";
import type { ButterBoardCardState } from "./butter-board-card-controls";

export { ButterSessionPermissionControls, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";

const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));

const MULTIPLE_SESSION_PULL_REQUESTS = [
	{ number: 1853, status: "open", preview: { title: "Add 3-D Secure contract coverage", repository: "acme/storefront", branch: "fix/pay-113-contract-coverage", targetBranch: "main", additions: 86, deletions: 12, filesChanged: 4, checks: AGENT_SESSION_DEMO_CHECKS.running } },
	{ number: 1852, status: "merged", preview: { title: "Stabilize the 3-D Secure contract suite", repository: "acme/storefront", branch: "fix/pay-113-3ds-contract-suite", targetBranch: "main", additions: 214, deletions: 48, filesChanged: 9, checks: AGENT_SESSION_DEMO_CHECKS.passed } },
] as const satisfies NonNullable<AgentSessionItem["pullRequests"]>;
const LOCAL_SESSIONS = AGENT_SESSION_ITEMS.map((item) => item.id === "lw-night-suite-session" ? { ...item, pullRequests: MULTIPLE_SESSION_PULL_REQUESTS } : item);

export function ButterGalleryAgentSessions({ active, permission }: Readonly<{ active: boolean; galleryOpen: boolean; permission: ButterSessionPermission }>) {
	return <AgentSessionShowcase active={active} className="pointer-events-none absolute inset-x-0 top-12 bottom-56 [&>div]:pointer-events-auto" localItems={LOCAL_SESSIONS} permission={permission} profiles={BUTTER_CHAT_AGENT_PROFILES} />;
}

export function ButterGalleryBoardCard({ galleryOpen, state }: Readonly<{ galleryOpen: boolean; state: ButterBoardCardState }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex justify-center overflow-y-auto px-4", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto my-auto flex w-full max-w-3xl justify-center">
				<h1 className="sr-only">Board card</h1>
				<JiraIssuePage boardCardState={state} variant="project-butter" />
			</div>
		</div>
	);
}
