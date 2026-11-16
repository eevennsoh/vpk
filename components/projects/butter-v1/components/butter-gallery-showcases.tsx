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

/** Working, Needs input, Finished — the three lifecycle states every row shows. */
const SESSION_STATES = ["running", "needs-input", "complete"] as const satisfies readonly AgentSessionItem["state"][];
const withLifecycleStates = (items: readonly AgentSessionItem[]) => SESSION_STATES.map((state, index) => ({ ...items[index % items.length], state }));

const LOCAL_SESSIONS = withLifecycleStates(AGENT_SESSION_ITEMS);
const CLOUD_SESSIONS = withLifecycleStates(AGENT_SESSION_CLOUD_ITEMS);

/** Local and Cloud are the viewer's own sessions; Team sessions belong to teammates. */
const BUTTER_AGENT_SESSION_ROWS: readonly Readonly<{ title: string; lists: readonly SessionList[] }>[] = [
	{ title: "Local", lists: [{ density: "short", items: LOCAL_SESSIONS }, { density: "long", items: LOCAL_SESSIONS }] },
	{ title: "Cloud", lists: [{ density: "short", items: CLOUD_SESSIONS }, { density: "long", items: CLOUD_SESSIONS }] },
	{ title: "Team", lists: [{ density: "short", items: asTeam(CLOUD_SESSIONS) }, { density: "long", items: asTeam(CLOUD_SESSIONS) }] },
];

/** Short and long rows sit at the widths the Agent Session catalog demos them at. */
const SESSION_LIST_WIDTH: Readonly<Record<AgentSessionDensity, string>> = { unlinked: "w-80", short: "w-80", long: "w-[520px]" };

export function ButterGalleryAgentSessions({ galleryOpen }: Readonly<{ galleryOpen: boolean }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex flex-col overflow-auto px-6", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto m-auto flex flex-col gap-6 py-6">
				<h1 className="sr-only">Agent sessions</h1>
				{BUTTER_AGENT_SESSION_ROWS.map((row) => (
					<section aria-label={`${row.title} sessions`} className="flex flex-col gap-1.5" key={row.title}>
						<h2 className="text-xs font-semibold text-text-subtle">{row.title}</h2>
						<div className="flex items-start gap-6">
							{row.lists.map((list) => (
								<div className="flex shrink-0 flex-col gap-1.5" key={list.density}>
									<span className="text-xs text-text-subtlest">{list.density === "short" ? "Short" : "Long"}</span>
									<AgentSession className={cn("relative max-w-full rounded-lg border border-border bg-surface", SESSION_LIST_WIDTH[list.density])} density={list.density} items={list.items} variant="large" />
								</div>
							))}
						</div>
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
