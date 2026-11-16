"use client";

import dynamic from "next/dynamic";

import {
	AGENT_SESSION_CLOUD_ITEMS,
	AGENT_SESSION_ITEMS,
	AgentSession,
	type AgentSessionDensity,
	type AgentSessionItem,
} from "@/components/blocks/agent-session";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));

/** Who can act on a session: mine, mine but private to me, or a teammate's. */
export type ButterSessionPermission = "mine" | "private" | "team";

const SESSION_PERMISSIONS: readonly Readonly<{ value: ButterSessionPermission; label: string }>[] = [
	{ value: "mine", label: "My session" },
	{ value: "private", label: "Private session" },
	{ value: "team", label: "Team session" },
];

export function ButterSessionPermissionControls({ permission, onPermissionChange }: Readonly<{
	permission: ButterSessionPermission;
	onPermissionChange: (permission: ButterSessionPermission) => void;
}>) {
	return (
		<ToggleGroup aria-label="Session permission" onValueChange={(values) => { const next = SESSION_PERMISSIONS.find((option) => option.value === values[0]); if (next) onPermissionChange(next.value); }} size="sm" value={[permission]} variant="outline">
			{SESSION_PERMISSIONS.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
		</ToggleGroup>
	);
}

function withPermission(item: AgentSessionItem, permission: ButterSessionPermission): AgentSessionItem {
	switch (permission) {
		case "mine":
			return { ...item, role: "owner" };
		case "private":
			return { ...item, role: "owner", privateTo: item.invokedBy?.name ?? "you" };
		case "team":
			return { ...item, role: "viewer" };
		default: {
			const exhaustive: never = permission;
			return exhaustive;
		}
	}
}

/** Working, Needs input, Finished — the three lifecycle states every row shows. */
const SESSION_STATES = ["running", "needs-input", "complete"] as const satisfies readonly AgentSessionItem["state"][];
const withLifecycleStates = (items: readonly AgentSessionItem[]) => SESSION_STATES.map((state, index) => ({ ...items[index % items.length], state }));

/** Two session types; the header's permission toggle decides who can act on them. */
const BUTTER_AGENT_SESSION_ROWS: readonly Readonly<{ title: string; items: readonly AgentSessionItem[] }>[] = [
	{ title: "Local", items: withLifecycleStates(AGENT_SESSION_ITEMS) },
	{ title: "Cloud", items: withLifecycleStates(AGENT_SESSION_CLOUD_ITEMS) },
];
const SESSION_DENSITIES = ["short", "long"] as const satisfies readonly AgentSessionDensity[];

/** Short sits at its catalog width; long gets 560px so the fuller metadata line has room. */
const SESSION_LIST_WIDTH: Readonly<Record<AgentSessionDensity, string>> = { unlinked: "w-80", short: "w-80", long: "w-[560px]" };

export function ButterGalleryAgentSessions({ galleryOpen, permission }: Readonly<{ galleryOpen: boolean; permission: ButterSessionPermission }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex flex-col overflow-auto px-6", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto m-auto flex flex-col gap-6 py-6">
				<h1 className="sr-only">Agent sessions</h1>
				{BUTTER_AGENT_SESSION_ROWS.map((row) => (
					<section aria-label={`${row.title} sessions`} className="flex flex-col gap-1.5" key={row.title}>
						<h2 className="text-xs font-semibold text-text-subtle">{row.title}</h2>
						<div className="flex items-start gap-6">
							{SESSION_DENSITIES.map((density) => (
								<div className="flex shrink-0 flex-col gap-1.5" key={density}>
									<span className="text-xs text-text-subtlest">{density === "short" ? "Short" : "Long"}</span>
									{row.items.map((item) => (
										<AgentSession className={cn("relative max-w-full rounded-lg border border-border bg-surface", SESSION_LIST_WIDTH[density])} density={density} items={[withPermission(item, permission)]} key={item.state} variant="large" />
									))}
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
