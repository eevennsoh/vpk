"use client";

import { useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { AGENT_SESSION_CLOUD_ITEMS, AGENT_SESSION_ITEMS, AgentSession, type AgentSessionItem } from "@/components/blocks/agent-session";
import { AGENT_SESSION_DEMO_CHECKS } from "@/components/blocks/agent-session/data";
import type { JiraIssuePullRequestItem } from "@/components/blocks/jira-issue/types";
import { JiraForYouHeader } from "@/components/projects/jira-for-you/jira-for-you-header";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { agentSessionDemoProfiles, agentSessionDemoScenario } from "@/components/projects/shared/lib/agent-session-demo-chat";
import { renderAgentSessionDemoArtifacts } from "@/components/projects/shared/components/agent-session-demo-artifacts";
import { BUTTER_CHAT_AGENT_PROFILES } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { useButterScriptedCreation } from "@/components/projects/butter-v1/components/butter-scripted-creation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { token } from "@/lib/tokens";

const READY_FOR_REVIEW_CHECKS = AGENT_SESSION_DEMO_CHECKS.passed;
const CHECKOUT_ACCESSIBILITY_PULL_REQUESTS = [
	{ number: 1861, status: "open", preview: { title: "Fix focus order in the checkout form", repository: "acme/storefront", branch: "fix/checkout-focus-order", targetBranch: "main", additions: 48, deletions: 17, filesChanged: 3, checks: READY_FOR_REVIEW_CHECKS } },
	{ number: 1862, status: "open", preview: { title: "Announce declined payments to screen readers", repository: "acme/storefront", branch: "fix/checkout-payment-announcements", targetBranch: "main", additions: 63, deletions: 9, filesChanged: 4, checks: READY_FOR_REVIEW_CHECKS } },
] as const satisfies readonly JiraIssuePullRequestItem[];

/** The demo viewer, Venn, who started some of these sessions. */
const VIEWER = { avatarSrc: "/avatar-user/venn/venn.png", name: "Venn" } as const;
const JIRA_FOR_YOU_SESSION_TABS = [
	{ id: "all", label: "All" },
	{ id: "mine", label: "My sessions" },
] as const;

const JIRA_FOR_YOU_SESSIONS: readonly AgentSessionItem[] = [
	AGENT_SESSION_CLOUD_ITEMS[1],
	{ ...AGENT_SESSION_CLOUD_ITEMS[1], agent: AGENT_SESSION_ITEMS[1].agent, invokedBy: VIEWER, id: "review-rollout", title: "Confirm the rollout plan for pilot customers", sessionDetails: { host: "cloud" }, timeLabel: "18m", updatedAtMs: undefined },
	{ ...AGENT_SESSION_CLOUD_ITEMS[0], invokedBy: VIEWER, state: "ready-for-review", pullRequestChecks: READY_FOR_REVIEW_CHECKS, sessionDetails: { ...AGENT_SESSION_CLOUD_ITEMS[0].sessionDetails, pullRequestTitle: "Refactor off-road damping" } },
	{ ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "review-accessibility", state: "ready-for-review", title: "Audit the checkout accessibility fixes", pullRequests: CHECKOUT_ACCESSIBILITY_PULL_REQUESTS, pullRequestChecks: undefined, sessionDetails: { host: "cloud" }, timeLabel: "45m", updatedAtMs: undefined },
	{ ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[1].agent, invokedBy: VIEWER, id: "review-copy", state: "ready-for-review", title: "Rewrite the recovery message for declined payments", pullRequestChecks: READY_FOR_REVIEW_CHECKS, sessionDetails: { ...AGENT_SESSION_CLOUD_ITEMS[0].sessionDetails, additions: 22, branch: "copy/declined-payment-recovery", deletions: 14, files: 2, issueKey: "PAY-211", issueSummary: "Rewrite the recovery message for declined payments", pullRequestNumber: 1868, pullRequestTitle: "Clarify declined payment recovery copy", pullRequestUrl: "https://github.com/acme/storefront/pull/1868" }, timeLabel: "1h", updatedAtMs: undefined },
	{ ...AGENT_SESSION_CLOUD_ITEMS[3], state: "ready-for-review", timeLabel: "3h", updatedAtMs: undefined },
	{ ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[1].agent, invokedBy: VIEWER, id: "working-tests", title: "Add coverage for the onboarding flow", prStatus: undefined, pullRequestChecks: undefined, sessionDetails: { host: "cloud" }, timeLabel: "5m", updatedAtMs: undefined },
	{ ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "working-dashboard", title: "Investigate the payments dashboard regressions", prStatus: undefined, pullRequestChecks: undefined, sessionDetails: { host: "cloud" }, timeLabel: "12m", updatedAtMs: undefined },
	{ ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[0].agent, invokedBy: AGENT_SESSION_ITEMS[0].invokedBy, id: "working-quickstart", title: "Prepare the sandbox quickstart", prStatus: undefined, pullRequestChecks: undefined, sessionDetails: { host: "cloud" }, timeLabel: "25m", updatedAtMs: undefined },
	{ ...AGENT_SESSION_ITEMS[0], invokedBy: VIEWER, id: "local-onboarding-checklist", machineName: "Venn’s MacBook Pro", prStatus: undefined, pullRequests: undefined, pullRequestChecks: undefined, sessionDetails: { host: "local" }, shortTitle: undefined, state: "running", timeLabel: "3m", title: "Spike the merchant onboarding checklist", updatedAtMs: undefined },
	{ ...AGENT_SESSION_ITEMS[1], invokedBy: VIEWER, id: "local-sandbox-keys", machineName: "Venn’s MacBook Pro", prStatus: undefined, pullRequests: undefined, pullRequestChecks: undefined, sessionDetails: { host: "local" }, shortTitle: undefined, state: "ready-for-review", timeLabel: "2h", title: "Draft the sandbox key rotation script", updatedAtMs: undefined },
	{ ...AGENT_SESSION_ITEMS[0], id: "local-checkout-validation", prStatus: undefined, pullRequests: undefined, pullRequestChecks: undefined, sessionDetails: { host: "local" }, shortTitle: undefined, state: "running", timeLabel: "4h", title: "Explore checkout validation errors", updatedAtMs: undefined },
];
const JIRA_FOR_YOU_GROUPS = [
	{ label: "Needs input", state: "needs-input" },
	{ label: "Ready for review", state: "ready-for-review" },
	{ label: "Working", state: "running" },
	{ label: "Local sessions", state: "local" },
] as const;
const JIRA_FOR_YOU_CHAT_PROFILES = agentSessionDemoProfiles(BUTTER_CHAT_AGENT_PROFILES, JIRA_FOR_YOU_SESSIONS.filter((item, index, items) => items.findIndex((candidate) => candidate.agent.name === item.agent.name) === index));

export function JiraForYouProjectButter() {
	const scriptedCreation = useButterScriptedCreation();
	return <RovoChatProvider agentProfiles={scriptedCreation?.agents.length ? [...JIRA_FOR_YOU_CHAT_PROFILES, ...scriptedCreation.agents] : JIRA_FOR_YOU_CHAT_PROFILES}><JiraForYouProjectButterContent /></RovoChatProvider>;
}

function JiraForYouProjectButterContent() {
	const [activeTabId, setActiveTabId] = useState("all");
	const [query, setQuery] = useState("");
	const [answeredSessions, setAnsweredSessions] = useState<ReadonlySet<string>>(new Set());
	const { activeSessionId, chatContextBar, externalThinkingMessageId, isSwitchingSession, openAgentChat } = useJgpAgentChatDemo();
	const awaitingAnswer = activeSessionId !== null && !answeredSessions.has(activeSessionId)
		&& JIRA_FOR_YOU_SESSIONS.some((item) => item.id === activeSessionId && item.state === "needs-input");
	const openSession = (item: AgentSessionItem) => {
		const needsInput = item.state === "needs-input" && !answeredSessions.has(item.id);
		const scenario = agentSessionDemoScenario(item, JIRA_FOR_YOU_CHAT_PROFILES, needsInput);
		void openAgentChat(needsInput && item.id !== "cloud-suspension-roadmap" ? {
			...scenario,
			intro: `I need your direction before continuing: ${item.title}.`,
			question: { id: `${item.id}-direction`, kind: "single-select", label: "What should I do next?", options: [{ id: "continue", label: "Continue with the proposed approach" }, { id: "pause", label: "Pause for further review" }] },
		} : scenario);
	};
	const sessions = JIRA_FOR_YOU_SESSIONS.filter((item) =>
		(activeTabId === "all" || item.invokedBy?.name === VIEWER.name)
		&& item.title.toLowerCase().includes(query.trim().toLowerCase()),
	).map((item) => ({ ...item, state: answeredSessions.has(item.id) ? "running" as const : item.state, shortTitle: item.title }));
	return (
		<>
		<div className="h-full min-h-0 w-full overflow-y-auto bg-surface">
			<section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4 md:px-5 md:py-5 [--feed-stack-top:1rem] md:[--feed-stack-top:1.25rem]">
				<JiraForYouHeader onQueryChange={setQuery} query={query} tabNavigation={{ activeTabId, onTabChange: setActiveTabId, tabs: JIRA_FOR_YOU_SESSION_TABS }} />
				<div className="flex flex-col gap-3">
					{JIRA_FOR_YOU_GROUPS.map(({ label, state }) => {
						const items = sessions.filter((item) => state === "local" ? item.host === "local" : item.host !== "local" && item.state === state);
						if (items.length === 0) return null;
						return (
							<Collapsible className="flex flex-col" defaultOpen key={state}>
								<CollapsibleTrigger render={<button className="group flex h-8 w-fit items-center gap-1 rounded-xs text-text-subtlest outline-none focus-visible:ring-3 focus-visible:ring-ring/50" type="button" />}>
									<span style={{ font: token("font.heading.xxsmall") }}>{label}</span>
									<Icon aria-hidden className="text-icon-subtle transition-transform duration-normal ease-out-practical group-aria-[expanded=false]:-rotate-90 motion-reduce:transition-none" render={<ChevronDownIcon label="" size="small" />} />
								</CollapsibleTrigger>
								<CollapsibleContent>
									<AgentSession animateLayout={false} density="jira-for-you" items={items} localSessionAction="view" onView={openSession} selectedItemId={null} showLifecycle={state !== "local"} showWorkingSpinner />
								</CollapsibleContent>
							</Collapsible>
						);
					})}
				</div>
				{sessions.length === 0 ? <p className="py-8 text-center text-sm text-text-subtlest">{query.trim() ? `No sessions match “${query.trim()}”.` : "No sessions in this view."}</p> : null}
			</section>
		</div>
		<JgpRovoOverlay chatContextBar={chatContextBar} externalThinkingMessageId={externalThinkingMessageId} isSwitchingSession={isSwitchingSession} onQuestionAnswer={awaitingAnswer ? () => setAnsweredSessions((current) => new Set(current).add(activeSessionId)) : undefined} renderWidget={renderAgentSessionDemoArtifacts} />
		</>
	);
}

