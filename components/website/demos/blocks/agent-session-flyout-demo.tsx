"use client";

import { useCallback, useState } from "react";

import {
	AGENT_SESSION_ITEMS,
	AgentSession,
	type AgentSessionItem,
} from "@/components/blocks/agent-session";
import { AGENT_SESSION_FLYOUT_LIST_CLASSNAME } from "@/components/blocks/agent-session-flyout";
import { AGENT_SESSION_FLYOUT_CODING_LIFECYCLE_SESSIONS } from "@/components/blocks/agent-session-flyout/agent-session-flyout-data";
import Page from "@/components/blocks/agent-session-flyout/page";

const AGENT_SESSION_FLYOUT_NO_LINK_ITEM: AgentSessionItem = {
	...AGENT_SESSION_ITEMS[0],
	id: "lw-no-link-demo",
	shortTitle: "No linked work item",
	state: "needs-input",
	title: "This session has no Jira work item yet",
	sessionDetails: {
		...AGENT_SESSION_ITEMS[0].sessionDetails,
		issueKey: "",
		issueSummary: "No Jira work item is available yet",
	},
};

const AGENT_SESSION_FLYOUT_UNTRACKED_WORK_ITEMS: readonly AgentSessionItem[] = [
	AGENT_SESSION_FLYOUT_NO_LINK_ITEM,
	...AGENT_SESSION_ITEMS.map((item) => (
		item.id === "lw-no-pr-session" ? { ...item, state: "running" as const } : item
	)),
];

export default function AgentSessionFlyoutDemo() {
	return <Page />;
}

export function AgentSessionFlyoutDemoDetails() {
	return <Page content="details" />;
}

export function AgentSessionFlyoutDemoComposer() {
	return <Page content="composer" />;
}

export function AgentSessionFlyoutDemoUntrackedWork() {
	const [capturedIds, setCapturedIds] = useState<ReadonlySet<string>>(() => new Set());
	const [archivedIds, setArchivedIds] = useState<ReadonlySet<string>>(() => new Set());
	const handleCapture = useCallback((item: AgentSessionItem) => {
		setCapturedIds((current) => new Set(current).add(item.id));
	}, []);
	const handleArchive = useCallback((item: AgentSessionItem) => {
		setArchivedIds((current) => new Set(current).add(item.id));
	}, []);

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
			<AgentSession
				capturedItemIds={capturedIds}
				className={AGENT_SESSION_FLYOUT_LIST_CLASSNAME}
				items={AGENT_SESSION_FLYOUT_UNTRACKED_WORK_ITEMS.filter((item) => !archivedIds.has(item.id))}
				onArchiveSession={handleArchive}
				onCreateWorkItem={handleCapture}
				onLinkWorkItem={handleCapture}
				onSubtasks={handleCapture}
			/>
		</div>
	);
}

export function AgentSessionFlyoutDemoCodingLifecycle() {
	return <Page sessions={AGENT_SESSION_FLYOUT_CODING_LIFECYCLE_SESSIONS} />;
}
