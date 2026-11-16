"use client";

import dynamic from "next/dynamic";

import {
	AGENT_SESSION_CLOUD_ITEMS,
	AGENT_SESSION_ITEMS,
	AgentSession,
	type AgentSessionDensity,
	type AgentSessionItem,
} from "@/components/blocks/agent-session";
import { cn } from "@/lib/utils";

const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));

type SessionList = Readonly<{ density: AgentSessionDensity; items: readonly AgentSessionItem[] }>;

const asTeam = (items: readonly AgentSessionItem[]) => items.map((item) => ({ ...item, role: "viewer" as const }));

/** Local and Cloud are the viewer's own sessions; Team sessions belong to teammates. */
const BUTTER_AGENT_SESSION_COLUMNS: readonly Readonly<{ title: string; lists: readonly SessionList[] }>[] = [
	{ title: "Local", lists: [{ density: "short", items: AGENT_SESSION_ITEMS.slice(0, 1) }, { density: "long", items: AGENT_SESSION_ITEMS.slice(0, 3) }] },
	{ title: "Cloud", lists: [{ density: "short", items: AGENT_SESSION_CLOUD_ITEMS.slice(0, 1) }, { density: "long", items: AGENT_SESSION_CLOUD_ITEMS }] },
	{ title: "Team", lists: [{ density: "short", items: asTeam(AGENT_SESSION_CLOUD_ITEMS.slice(0, 1)) }, { density: "long", items: asTeam(AGENT_SESSION_CLOUD_ITEMS) }] },
];

export function ButterGalleryAgentSessions({ galleryOpen }: Readonly<{ galleryOpen: boolean }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex flex-col overflow-y-auto px-6", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto mx-auto my-auto grid w-full max-w-7xl grid-cols-1 gap-6 py-6 lg:grid-cols-3">
				<h1 className="sr-only">Agent sessions</h1>
				{BUTTER_AGENT_SESSION_COLUMNS.map((column) => (
					<section aria-label={`${column.title} sessions`} className="flex min-w-0 flex-col gap-4" key={column.title}>
						<h2 className="text-center text-xs font-semibold text-text-subtle">{column.title}</h2>
						{column.lists.map((list) => (
							<div className="flex min-w-0 flex-col gap-1.5" key={list.density}>
								<span className="text-xs text-text-subtlest">{list.density === "short" ? "Short" : "Long"}</span>
								<AgentSession className="relative rounded-lg border border-border bg-surface" density={list.density} items={list.items} variant="large" />
							</div>
						))}
					</section>
				))}
			</div>
		</div>
	);
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
