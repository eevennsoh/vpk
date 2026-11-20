"use client";

import dynamic from "next/dynamic";
import { AGENT_SESSION_ITEMS } from "@/components/blocks/agent-session";
import { AgentSessionShowcase, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";
import { BUTTER_CHAT_AGENT_PROFILES, resolveButterChatAgentId } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { BUTTER_PAY_113_RELATED_PULL_REQUESTS } from "@/components/projects/butter-v1/data/presentation-pull-requests";
import { cn } from "@/lib/utils";
import type { ButterBoardCardState } from "./butter-board-card-controls";

export { ButterSessionPermissionControls, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";

const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));
const BOARD_CARD_CHAT_AGENTS = { profiles: BUTTER_CHAT_AGENT_PROFILES, resolveId: resolveButterChatAgentId };

const LOCAL_SESSIONS = AGENT_SESSION_ITEMS.map((item) => item.id === "lw-night-suite-session" ? { ...item, pullRequests: BUTTER_PAY_113_RELATED_PULL_REQUESTS } : item);

export function ButterGalleryAgentSessions({ active, permission }: Readonly<{ active: boolean; galleryOpen: boolean; permission: ButterSessionPermission }>) {
	return <AgentSessionShowcase active={active} className="pointer-events-none absolute inset-x-0 top-12 bottom-56 [&>div]:pointer-events-auto" localItems={LOCAL_SESSIONS} permission={permission} profiles={BUTTER_CHAT_AGENT_PROFILES} />;
}

export function ButterGalleryBoardCard({ galleryOpen, state }: Readonly<{ galleryOpen: boolean; state: ButterBoardCardState }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex justify-center overflow-y-auto px-4", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto my-auto flex w-full max-w-3xl justify-center">
				<h1 className="sr-only">Board card</h1>
				<JiraIssuePage boardCardState={state} chatAgents={BOARD_CARD_CHAT_AGENTS} variant="project-butter" />
			</div>
		</div>
	);
}
