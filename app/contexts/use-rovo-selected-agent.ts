"use client";

import { useRovoChat } from "@/app/contexts/context-rovo-chat";

export function useRovoSelectedAgent() {
	const {
		selectedAgentId,
		selectedAgent,
		selectableAgents,
		isCustomAgentSelected,
		selectAgent,
		registerCreatedAgentFromResult,
		sessionAgentEntries,
		getSessionAgentEntry,
		updateSessionAgentDraft,
		commitSessionAgentPublishReady,
		publishSessionAgent,
		removeSessionAgent,
		resetAgentToRovo,
		deleteAllThreads,
		activateSession,
	} = useRovoChat();

	return {
		selectedAgentId,
		selectedAgent,
		selectableAgents,
		isCustomAgentSelected,
		selectAgent,
		registerCreatedAgentFromResult,
		sessionAgentEntries,
		getSessionAgentEntry,
		updateSessionAgentDraft,
		commitSessionAgentPublishReady,
		publishSessionAgent,
		removeSessionAgent,
		resetAgentToRovo,
		deleteAllThreads,
		activateSession,
	};
}
