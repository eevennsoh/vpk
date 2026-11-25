"use client";

import { useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { AGENT_SESSION_CLOUD_ITEMS, AGENT_SESSION_ITEMS, AgentSession, type AgentSessionItem } from "@/components/blocks/agent-session";
import { JIRA_FOR_YOU_TABS } from "@/components/projects/jira-for-you/data";
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

const JIRA_FOR_YOU_SESSIONS: readonly { item: AgentSessionItem; tabs: readonly string[] }[] = [
	{ item: AGENT_SESSION_CLOUD_ITEMS[1], tabs: ["assigned", "viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[1], agent: AGENT_SESSION_ITEMS[1].agent, invokedBy: AGENT_SESSION_ITEMS[1].invokedBy, id: "review-rollout", title: "Confirm the rollout plan for pilot customers", sessionDetails: { host: "cloud" }, timeLabel: "18m", updatedAtMs: undefined }, tabs: ["assigned", "worked-on"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[1], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "review-copy", title: "Review the recovery message for declined payments", sessionDetails: { host: "cloud" }, timeLabel: "1h", updatedAtMs: undefined }, tabs: ["viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[0], sessionDetails: { ...AGENT_SESSION_CLOUD_ITEMS[0].sessionDetails, pullRequestTitle: "Refactor off-road damping" } }, tabs: ["assigned", "worked-on"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[1].agent, invokedBy: AGENT_SESSION_ITEMS[1].invokedBy, id: "working-tests", title: "Add coverage for the onboarding flow", pullRequestChecks: undefined, sessionDetails: { host: "cloud", pullRequestNumber: 1856, pullRequestTitle: "Add onboarding coverage" }, timeLabel: "5m", updatedAtMs: undefined }, tabs: ["assigned", "viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[0], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "working-dashboard", title: "Investigate the payments dashboard regressions", prStatus: undefined, pullRequestChecks: undefined, sessionDetails: { host: "cloud" }, timeLabel: "12m", updatedAtMs: undefined }, tabs: ["worked-on"] },
	{ item: AGENT_SESSION_CLOUD_ITEMS[3], tabs: ["worked-on", "viewed"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[3], agent: AGENT_SESSION_ITEMS[0].agent, invokedBy: AGENT_SESSION_ITEMS[0].invokedBy, id: "finished-quickstart", title: "Prepare the sandbox quickstart", sessionDetails: { host: "cloud" }, timeLabel: "Yesterday", updatedAtMs: undefined }, tabs: ["assigned", "worked-on"] },
	{ item: { ...AGENT_SESSION_CLOUD_ITEMS[3], agent: AGENT_SESSION_ITEMS[2].agent, invokedBy: AGENT_SESSION_ITEMS[2].invokedBy, id: "finished-accessibility", title: "Audit the checkout accessibility fixes", sessionDetails: { host: "cloud" }, timeLabel: "3d", updatedAtMs: undefined }, tabs: ["viewed"] },
];
const JIRA_FOR_YOU_GROUPS = [
	{ label: "Needs input", state: "needs-input" },
	{ label: "Working", state: "running" },
	{ label: "Finished", state: "complete" },
] as const;
const JIRA_FOR_YOU_CHAT_PROFILES = agentSessionDemoProfiles(BUTTER_CHAT_AGENT_PROFILES, JIRA_FOR_YOU_SESSIONS.map(({ item }) => item).filter((item, index, items) => items.findIndex((candidate) => candidate.agent.name === item.agent.name) === index));

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
		&& JIRA_FOR_YOU_SESSIONS.some(({ item }) => item.id === activeSessionId && item.state === "needs-input");
	const openSession = (item: AgentSessionItem) => {
		const needsInput = item.state === "needs-input" && !answeredSessions.has(item.id);
		const scenario = agentSessionDemoScenario(item, JIRA_FOR_YOU_CHAT_PROFILES, needsInput);
		void openAgentChat(needsInput && item.id !== "cloud-suspension-roadmap" ? {
			...scenario,
			intro: `I need your direction before continuing: ${item.title}.`,
			question: { id: `${item.id}-direction`, kind: "single-select", label: "What should I do next?", options: [{ id: "continue", label: "Continue with the proposed approach" }, { id: "pause", label: "Pause for further review" }] },
		} : scenario);
	};
	const sessions = JIRA_FOR_YOU_SESSIONS.filter(({ item, tabs }) =>
		(activeTabId === "all" || tabs.includes(activeTabId))
		&& item.title.toLowerCase().includes(query.trim().toLowerCase()),
	).map(({ item }) => ({ ...item, state: answeredSessions.has(item.id) ? "running" as const : item.state, shortTitle: item.title }));
	return (
		<>
		<div className="h-full min-h-0 w-full overflow-y-auto bg-surface">
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
									<AgentSession animateLayout={false} density="jira-for-you" items={items} localSessionAction="view" onView={openSession} selectedItemId={null} showWorkingSpinner />
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

