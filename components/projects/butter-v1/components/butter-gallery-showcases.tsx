"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { AGENT_SESSION_CLOUD_ITEMS, AGENT_SESSION_ITEMS, AgentSession, type AgentSessionItem } from "@/components/blocks/agent-session";
import { JIRA_FOR_YOU_TABS } from "@/components/projects/jira-for-you/data";
import { JiraForYouHeader } from "@/components/projects/jira-for-you/jira-for-you-header";
import { AgentSessionShowcase, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";
import { BUTTER_CHAT_AGENT_PROFILES, resolveButterChatAgentId } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { BUTTER_PAY_113_RELATED_PULL_REQUESTS } from "@/components/projects/butter-v1/data/presentation-pull-requests";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { ButterBoardCardState } from "./butter-board-card-controls";

export { ButterSessionPermissionControls, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";

const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));
const BOARD_CARD_CHAT_AGENTS = { profiles: BUTTER_CHAT_AGENT_PROFILES, resolveId: resolveButterChatAgentId };

const LOCAL_SESSIONS = AGENT_SESSION_ITEMS.map((item) => item.id === "lw-night-suite-session" ? { ...item, pullRequests: BUTTER_PAY_113_RELATED_PULL_REQUESTS } : item);
const JIRA_FOR_YOU_SESSIONS: readonly { item: AgentSessionItem; tabs: readonly string[] }[] = [
	{ item: AGENT_SESSION_CLOUD_ITEMS[1], tabs: ["assigned", "viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[1], agent: AGENT_SESSION_ITEMS[1].agent, invokedBy: AGENT_SESSION_ITEMS[1].invokedBy, id: "review-rollout", title: "Confirm the rollout plan for pilot customers", sessionDetails: { host: "cloud" }, timeLabel: "18m", updatedAtMs: undefined }, tabs: ["assigned", "worked-on"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[1], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "review-copy", title: "Review the recovery message for declined payments", sessionDetails: { host: "cloud" }, timeLabel: "1h", updatedAtMs: undefined }, tabs: ["viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[0], sessionDetails: { ...AGENT_SESSION_CLOUD_ITEMS[0].sessionDetails, pullRequestTitle: "Refactor off-road damping" } }, tabs: ["assigned", "worked-on"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[1].agent, invokedBy: AGENT_SESSION_ITEMS[1].invokedBy, id: "working-tests", title: "Add coverage for the onboarding flow", pullRequestChecks: undefined, sessionDetails: { host: "cloud", pullRequestNumber: 1856, pullRequestTitle: "Add onboarding coverage" }, timeLabel: "5m", updatedAtMs: undefined }, tabs: ["assigned", "viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "working-dashboard", title: "Investigate the payments dashboard regressions", prStatus: undefined, pullRequestChecks: undefined, sessionDetails: { host: "cloud" }, timeLabel: "12m", updatedAtMs: undefined }, tabs: ["worked-on"] },
	{ item: AGENT_SESSION_CLOUD_ITEMS[2], tabs: ["worked-on", "viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[2], agent: AGENT_SESSION_ITEMS[0].agent, invokedBy: AGENT_SESSION_ITEMS[0].invokedBy, id: "finished-quickstart", title: "Prepare the sandbox quickstart", sessionDetails: { host: "cloud" }, timeLabel: "Yesterday", updatedAtMs: undefined }, tabs: ["assigned", "worked-on"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[2], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "finished-accessibility", title: "Audit the checkout accessibility fixes", sessionDetails: { host: "cloud" }, timeLabel: "3d", updatedAtMs: undefined }, tabs: ["viewed"] },
];
const JIRA_FOR_YOU_GROUPS = [
	{ label: "Needs input", state: "needs-input" },
	{ label: "Working", state: "running" },
	{ label: "Finished", state: "complete" },
] as const;

export function ButterGalleryJiraForYou() {
	const [activeTabId, setActiveTabId] = useState("all");
	const [query, setQuery] = useState("");
	const sessions = JIRA_FOR_YOU_SESSIONS.filter(({ item, tabs }) =>
		(activeTabId === "all" || tabs.includes(activeTabId))
		&& item.title.toLowerCase().includes(query.trim().toLowerCase()),
	).map(({ item }) => ({ ...item, shortTitle: item.title }));
	return (
		<div className="absolute inset-x-0 top-12 bottom-0 overflow-y-auto">
			<section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4 md:px-5 md:py-5 [--feed-stack-top:1rem] md:[--feed-stack-top:1.25rem]">
				<JiraForYouHeader activeTabId={activeTabId} onQueryChange={setQuery} onTabChange={setActiveTabId} query={query} tabs={JIRA_FOR_YOU_TABS} />
				<div className="flex flex-col gap-3">
					{JIRA_FOR_YOU_GROUPS.map(({ label, state }) => {
						const items = sessions.filter((item) => item.state === state);
						if (items.length === 0) return null;
						return (
							<Collapsible className="flex flex-col" defaultOpen key={state}>
								<CollapsibleTrigger render={<button className="group flex h-8 w-fit items-center gap-1 rounded-xs text-text-subtlest outline-none focus-visible:ring-3 focus-visible:ring-ring/50" type="button" />}>
									<span style={{ font: token("font.heading.xxsmall") }}>{label}</span>
									<Icon aria-hidden className="text-icon-subtle transition-transform duration-normal ease-out-practical group-aria-[expanded=false]:-rotate-90 motion-reduce:transition-none" render={<ChevronDownIcon label="" size="small" />} />
								</CollapsibleTrigger>
								<CollapsibleContent>
									<AgentSession animateLayout={false} density="jira-for-you" items={items} localSessionAction="view" />
								</CollapsibleContent>
							</Collapsible>
						);
					})}
				</div>
				{sessions.length === 0 ? <p className="py-8 text-center text-sm text-text-subtlest">{query.trim() ? `No sessions match “${query.trim()}”.` : "No sessions in this view."}</p> : null}
			</section>
		</div>
	);
}

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
