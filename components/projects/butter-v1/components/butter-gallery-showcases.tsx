"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

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
const BUTTER_AGENT_SESSION_ROWS: readonly Readonly<{ title: string; items: readonly AgentSessionItem[]; teamShareable: boolean }>[] = [
	// Local sessions run on one person's machine, so they have no team view.
	{ title: "Local", items: withLifecycleStates(AGENT_SESSION_ITEMS), teamShareable: false },
	{ title: "Cloud", items: withLifecycleStates(AGENT_SESSION_CLOUD_ITEMS), teamShareable: true },
];
/**
 * Card sizes that show how a session row responds to its container. Large is
 * the long row with room for its full metadata line, Medium the same row in a
 * narrower panel where clauses truncate, and Small the short row.
 */
const SESSION_SIZES = [
	{ value: "large", label: "Large", density: "long", width: "w-[560px]", showLifecycleLabel: true },
	{ value: "medium", label: "Medium", density: "long", width: "w-[420px]", showLifecycleLabel: false },
	{ value: "small", label: "Small", density: "short", width: "w-80", showLifecycleLabel: false },
] as const satisfies readonly Readonly<{ value: string; label: string; density: AgentSessionDensity; width: string; showLifecycleLabel: boolean }>[];
type SessionSize = (typeof SESSION_SIZES)[number];

export function ButterGalleryAgentSessions({ galleryOpen, permission }: Readonly<{ galleryOpen: boolean; permission: ButterSessionPermission }>) {
	const [size, setSize] = useState<SessionSize>(SESSION_SIZES[0]);
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex flex-col overflow-auto px-6", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto m-auto flex flex-col items-center gap-6 py-6">
				<h1 className="sr-only">Agent sessions</h1>
				<ToggleGroup aria-label="Session card size" onValueChange={(values) => { const next = SESSION_SIZES.find((option) => option.value === values[0]); if (next) setSize(next); }} size="sm" value={[size.value]} variant="outline">
					{SESSION_SIZES.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
				</ToggleGroup>
				<div className="grid grid-cols-[3rem_auto] gap-x-4 gap-y-6">
					{BUTTER_AGENT_SESSION_ROWS.filter((row) => permission !== "team" || row.teamShareable).map((row) => (
						<section aria-label={`${row.title} sessions`} className="col-span-2 grid grid-cols-subgrid items-start" key={row.title}>
							<h2 className="pt-3 text-xs font-semibold text-text-subtle">{row.title}</h2>
							<div className="flex flex-col gap-1.5">
								{row.items.map((item) => (
									// Width, not scale: the row's truncation is what this toggle demonstrates,
									// so the frame resizes in place and the content reflows with it.
									<AgentSession className={cn("relative max-w-full rounded-lg border border-border bg-surface transition-[width] duration-medium ease-in-out", size.width)} density={size.density} items={[withPermission(item, permission)]} key={item.state} showLifecycleLabel={size.showLifecycleLabel} showWorkingSpinner variant="large" />
								))}
							</div>
						</section>
					))}
				</div>
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
