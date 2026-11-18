"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import {
	AGENT_SESSION_CLOUD_ITEMS,
	AGENT_SESSION_ITEMS,
	AgentSession,
	type AgentSessionDensity,
	type AgentSessionItem,
} from "@/components/blocks/agent-session";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { BUTTER_CHAT_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { agentSessionDemoProfiles, agentSessionDemoScenario } from "@/components/projects/shared/lib/agent-session-demo-chat";
import { renderAgentSessionDemoArtifacts } from "@/components/projects/shared/components/agent-session-demo-artifacts";

const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));

/** Who can act on a session: mine, private to a teammate, or shared by a teammate. */
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
			return { ...item, role: "viewer", privateTo: item.invokedBy?.name ?? "its owner" };
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

const LOCAL_SESSIONS = withLifecycleStates(AGENT_SESSION_ITEMS);
const CLOUD_SESSIONS = withLifecycleStates(AGENT_SESSION_CLOUD_ITEMS);
/**
 * Card sizes that show how a session row responds to its container. Large is
 * the long row with room for its full metadata line, Medium the same row in a
 * narrower panel where clauses truncate, and Small the short row.
 */
const SESSION_SIZES = [
	{ value: "large", label: "Large", density: "long", width: "w-[720px]", showLifecycleLabel: true },
	{ value: "medium", label: "Medium", density: "long", width: "w-[420px]", showLifecycleLabel: false },
	{ value: "small", label: "Small", density: "short", width: "w-80", showLifecycleLabel: false },
] as const satisfies readonly Readonly<{ value: string; label: string; density: AgentSessionDensity; width: string; showLifecycleLabel: boolean }>[];
type SessionSize = (typeof SESSION_SIZES)[number];

const SESSION_CHAT_PROFILES = agentSessionDemoProfiles(BUTTER_CHAT_AGENT_PROFILES, AGENT_SESSION_CLOUD_ITEMS);

export function ButterGalleryAgentSessions(props: Readonly<{ active: boolean; galleryOpen: boolean; permission: ButterSessionPermission }>) {
	return <RovoChatProvider agentProfiles={SESSION_CHAT_PROFILES}><ButterGalleryAgentSessionsContent {...props} /></RovoChatProvider>;
}

function ButterGalleryAgentSessionsContent({ active, permission }: Readonly<{ active: boolean; galleryOpen: boolean; permission: ButterSessionPermission }>) {
	const [size, setSize] = useState<SessionSize>(SESSION_SIZES[0]);
	const [answeredSessions, setAnsweredSessions] = useState<ReadonlySet<string>>(new Set());
	const [viewerChatOwner, setViewerChatOwner] = useState<NonNullable<AgentSessionItem["invokedBy"]> | null>(null);
	const { activeSessionId, chatContextBar, externalThinkingMessageId, isSwitchingSession, openAgentChat } = useJgpAgentChatDemo();
	const awaitingAnswer = activeSessionId !== null && !answeredSessions.has(activeSessionId)
		&& CLOUD_SESSIONS.some((item) => item.id === activeSessionId && item.state === "needs-input");
	const activeSessionState = answeredSessions.has(activeSessionId ?? "") ? "running" : CLOUD_SESSIONS.find((item) => item.id === activeSessionId)?.state;
	const rows = permission === "team"
		? [{ title: "Cloud (Owner)", items: CLOUD_SESSIONS, role: "owner" as const }, { title: "Cloud (Viewer)", items: CLOUD_SESSIONS, role: "viewer" as const }]
		: [{ title: "Local", items: LOCAL_SESSIONS, role: permission === "mine" ? "owner" as const : "viewer" as const }, { title: "Cloud", items: CLOUD_SESSIONS, role: permission === "mine" ? "owner" as const : "viewer" as const }];
	return (
		<>
		<div className="pointer-events-none absolute inset-x-0 top-12 bottom-56 flex flex-col overflow-auto px-6">
			<div className={cn("pointer-events-auto m-auto grid gap-x-4 gap-y-6 py-6", permission === "team" ? "grid-cols-[6rem_auto]" : "grid-cols-[3rem_auto]")}>
				<h1 className="sr-only">Agent sessions</h1>
				<ToggleGroup aria-label="Session card size" className="col-start-2 justify-self-center" onValueChange={(values) => { const next = SESSION_SIZES.find((option) => option.value === values[0]); if (next) setSize(next); }} size="sm" value={[size.value]} variant="outline">
					{SESSION_SIZES.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
				</ToggleGroup>
				{rows.map((row) => (
					<section aria-label={`${row.title} sessions`} className="col-span-2 grid grid-cols-subgrid items-start" key={row.title}>
						<h2 className="pt-3 text-xs font-semibold text-text-subtle">{row.title}</h2>
						<div className="flex flex-col gap-1.5">
							{row.items.map((item) => (
								// Width, not scale: the row's truncation is what this toggle demonstrates,
								// so the frame resizes in place and the content reflows with it.
								<AgentSession allowViewerView={permission === "team" && row.role === "viewer"} className={cn("relative max-w-full rounded-lg border border-border bg-surface transition-[width] duration-medium ease-in-out", size.width)} density={size.density} items={[permission === "team" ? { ...item, state: answeredSessions.has(item.id) ? "running" : item.state, role: row.role, sharedWithTeam: true } : withPermission(answeredSessions.has(item.id) ? { ...item, state: "running" } : item, permission)]} key={item.state} lifecycleLabelPlacement={size.value === "medium" ? "metadata" : "trailing"} moreMenuVariant={row.role === "owner" ? "owner" : "default"} onView={row.title.startsWith("Cloud") ? (session) => { setViewerChatOwner(permission === "team" && row.role === "viewer" ? session.invokedBy ?? { name: "" } : null); void openAgentChat(agentSessionDemoScenario(session, SESSION_CHAT_PROFILES, item.state === "needs-input")); } : undefined} selectedItemId={null} showAgentName={size.value === "large" ? true : undefined} showLifecycleLabel={size.showLifecycleLabel} showWorkingSpinner variant="large" />
							))}
						</div>
					</section>
				))}
			</div>
		</div>
		{active ? <JgpRovoOverlay chatContextBar={chatContextBar} externalThinkingMessageId={externalThinkingMessageId} isSwitchingSession={isSwitchingSession} onQuestionAnswer={awaitingAnswer ? () => { if (activeSessionId) setAnsweredSessions((current) => new Set(current).add(activeSessionId)); } : undefined} readOnly={viewerChatOwner !== null} readOnlyOwner={viewerChatOwner ?? undefined} readOnlySessionState={activeSessionState} renderWidget={renderAgentSessionDemoArtifacts} /> : null}
		</>
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
