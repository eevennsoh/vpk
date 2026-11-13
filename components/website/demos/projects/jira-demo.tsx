"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import { RovoChatProvider, useRovoChat } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import { SidebarProvider } from "@/app/contexts/context-sidebar";
import AppLayout from "@/components/projects/page";
import AgentsView from "@/components/projects/jira/page";
import { RfpAgentActivityDetails, RfpAgentTriggerDetails } from "@/components/projects/jira/components/rfp-agent-chat-details";
import { BOARD_AGENTS, type BoardAgentData } from "@/components/projects/jira/data/board-agents";
import { RFP_101_WORK_ITEM, resolveAgentsChatScreenContext } from "@/components/projects/jira/data/rfp-work-items";
import { useAgentsRfpDemoState, type AgentsRfpDemoController } from "@/components/projects/jira/hooks/use-agents-rfp-demo-state";
import {
	formatRfpDemoContext,
	getRfpDemoAgents,
	RFP_DRAFTING_AGENT_CONVERSATION_STARTERS,
	RFP_DRAFTING_AGENT_DESCRIPTION,
	RFP_DRAFTING_AGENT_AVATAR_SRC,
	RFP_DRAFTING_AGENT_ID,
	RFP_DRAFTING_AGENT_NAME,
	type AgentsRfpDemoState,
} from "@/components/projects/jira/lib/rfp-demo-state";
import {
	getRovoAgentProfile,
	ROVO_AGENT_ID,
	type RovoAgentProfile,
} from "@/app/data/directory/agents";
import { mergeRovoContextDescriptions } from "@/lib/rovo-context";
import type { ChatSurfaceSwitchHandler } from "@/components/projects/shared/components/chat-surface-switcher";
import type { ChatPanelCustomAgentTabs } from "@/components/projects/sidebar-chat/page";
import type { FloatingRovoButtonOnboardingConfig } from "@/components/blocks/rovo-button";
import { ROVO_AGENT_RESULT_SELECT_EVENT } from "@/components/projects/sidebar-chat/components/agent-result-card";
import { useAgentsWorkItemPresentation, type AgentsWorkItemPresentationController } from "@/components/projects/jira/hooks/use-agents-work-item-presentation";
import { getMessageAgentResult } from "@/lib/rovo-ui-messages";
import { useProjectDemoEmbedded } from "./use-project-demo-embedded";

const AGENTS_CHAT_PROMPT_OPTIONS: SendPromptOptions = {
	backendPreference: "ai-gateway",
};
const ROVO_BUTTON_AGENT_ONBOARDING_ID = "agents-rfp-drafting-agent-after-report-attach";
const ROVO_BUTTON_AGENT_ONBOARDING_DELAY_MS = 5000;
const RFP_DRAFTING_AGENT_ACCENT_COLOR = "#82B536";
const RFP_AGENT_CREATION_PROMPT = `Create an ${RFP_DRAFTING_AGENT_NAME} for the Drafting column on the Enterprise RFP Response board, including its description and conversation starters.`;

function createAgentsDemoStarter(id: string, label: string): RovoAgentProfile["starters"][number] {
	return {
		id,
		label,
		prompt: label,
		icon: AiChatIcon,
		type: "skill",
	};
}

function getRfpDraftingAgentDescription(state: AgentsRfpDemoState): string {
	return state.agent?.description?.trim() || RFP_DRAFTING_AGENT_DESCRIPTION;
}

function getRfpDraftingAgentStarters(state: AgentsRfpDemoState): RovoAgentProfile["starters"] {
	const starters = state.agent?.conversationStarters?.length
		? state.agent.conversationStarters
		: RFP_DRAFTING_AGENT_CONVERSATION_STARTERS;

	return starters.map((starter, index) => (
		createAgentsDemoStarter(`${RFP_DRAFTING_AGENT_ID}-starter-${index + 1}`, starter)
	));
}

function createAgentsDemoAgentContext(agent: BoardAgentData, description?: string): string | undefined {
	if (agent.id === ROVO_AGENT_ID) {
		return undefined;
	}

	return [
		"[Selected custom agent]",
		`Agent: ${agent.name}`,
		`Byline: ${agent.byline}`,
		description ? `Description: ${description}` : null,
		"Answer as this selected agent while using the existing Rovo chat capabilities and available /jira RFP demo context.",
		"[End selected custom agent]",
	]
		.filter((line): line is string => Boolean(line))
		.join("\n");
}

function createAgentsDemoAgentProfile(agent: BoardAgentData, state: AgentsRfpDemoState): RovoAgentProfile {
	const existingProfile = getRovoAgentProfile(agent.id);

	if (existingProfile.id === agent.id) {
		return {
			...existingProfile,
			name: agent.name,
			byline: agent.byline,
			avatarSrc: agent.avatarSrc,
		};
	}

	const description = agent.id === RFP_DRAFTING_AGENT_ID
		? getRfpDraftingAgentDescription(state)
		: undefined;
	const starters = agent.id === RFP_DRAFTING_AGENT_ID
		? getRfpDraftingAgentStarters(state)
		: [];

	return {
		id: agent.id,
		name: agent.name,
		byline: agent.byline,
		avatarSrc: agent.avatarSrc,
		description,
		contextDescription: createAgentsDemoAgentContext(agent, description),
		starters,
	};
}

function getAgentsDemoAgentProfiles(state: AgentsRfpDemoState): readonly RovoAgentProfile[] {
	return getRfpDemoAgents(state, BOARD_AGENTS).map((agent) => createAgentsDemoAgentProfile(agent, state));
}

interface JiraDemoContentProps {
	embedded: boolean;
	rfpDemo: AgentsRfpDemoController;
	workItemPresentation: AgentsWorkItemPresentationController;
	agentsChatScreenContext: ReturnType<typeof resolveAgentsChatScreenContext>;
}

function JiraDemoContent({
	embedded,
	rfpDemo,
	workItemPresentation,
	agentsChatScreenContext,
}: Readonly<JiraDemoContentProps>) {
	const [isRovoButtonOnboardingOpen, setIsRovoButtonOnboardingOpen] = useState(false);
	const [dismissedRovoButtonOnboardingId, setDismissedRovoButtonOnboardingId] = useState<string | null>(null);
	const appliedAgentResultMessageIdsRef = useRef<Set<string>>(new Set());
	const { isOpen: isChatOpen, openChat, sendPrompt, uiMessages } = useRovoChat();
	const { backToBoard, closeModal, promoteModalToInline } = workItemPresentation;
	const { applyAgent } = rfpDemo.actions;
	const hasAppliedRfpDraftingAgent = rfpDemo.state.agent?.id === RFP_DRAFTING_AGENT_ID;
	const isWorkItemModalOpen = workItemPresentation.state.mode === "modal";
	const isRfp101Presented = (
		(workItemPresentation.state.mode === "modal" || workItemPresentation.state.mode === "inline") &&
		workItemPresentation.state.workItem?.code === RFP_101_WORK_ITEM.code
	);
	const handleChatSurfaceSwitch = useCallback<ChatSurfaceSwitchHandler>(
		(surface) => {
			if (surface !== "sidebar") return;
			promoteModalToInline();
		},
		[promoteModalToInline],
	);
	const handleArtifactDialogOpen = useCallback(() => {
		if (!isWorkItemModalOpen) return;
		closeModal();
	}, [closeModal, isWorkItemModalOpen]);
	const handleCreateRfpDraftingAgent = useCallback(() => {
		setDismissedRovoButtonOnboardingId(ROVO_BUTTON_AGENT_ONBOARDING_ID);
		setIsRovoButtonOnboardingOpen(false);
		backToBoard();
		openChat("floating");
		void sendPrompt(RFP_AGENT_CREATION_PROMPT, {
			creationMode: "agent",
			contextDescription: [
				"[Agents RFP Drafter Creation Request]",
				"Source: /jira RFP agent onboarding.",
				"Board: Enterprise RFP Response.",
				"Column: Drafting.",
				"Trigger: On event: ticket enters Drafting.",
				`Description: ${RFP_DRAFTING_AGENT_DESCRIPTION}`,
				"Conversation starters:",
				...RFP_DRAFTING_AGENT_CONVERSATION_STARTERS.map((starter) => `- ${starter}`),
				"Expected output: create the agent, add it to this Jira project, then process Drafting tickets through the backend event flow.",
				"[End Agents RFP Drafter Creation Request]",
			].join("\n"),
		});
	}, [backToBoard, openChat, sendPrompt]);

	useEffect(() => {
		for (const message of uiMessages) {
			const agentResult = getMessageAgentResult(message);
			if (agentResult?.agentId !== RFP_DRAFTING_AGENT_ID) {
				continue;
			}
			if (appliedAgentResultMessageIdsRef.current.has(message.id)) {
				continue;
			}
			appliedAgentResultMessageIdsRef.current.add(message.id);
			if (hasAppliedRfpDraftingAgent) {
				continue;
			}
			setDismissedRovoButtonOnboardingId(ROVO_BUTTON_AGENT_ONBOARDING_ID);
			setIsRovoButtonOnboardingOpen(false);
			applyAgent();
		}
	}, [applyAgent, hasAppliedRfpDraftingAgent, uiMessages]);

	useEffect(() => {
		const handleSelectAgentResult = (event: Event) => {
			const { detail } = event as CustomEvent<{ agentId?: string }>;
			if (detail?.agentId !== RFP_DRAFTING_AGENT_ID) {
				return;
			}

			if (!hasAppliedRfpDraftingAgent) {
				applyAgent();
			}
			setDismissedRovoButtonOnboardingId(ROVO_BUTTON_AGENT_ONBOARDING_ID);
			setIsRovoButtonOnboardingOpen(false);
		};

		window.addEventListener(ROVO_AGENT_RESULT_SELECT_EVENT, handleSelectAgentResult);
		return () => window.removeEventListener(ROVO_AGENT_RESULT_SELECT_EVENT, handleSelectAgentResult);
	}, [applyAgent, hasAppliedRfpDraftingAgent]);

	useEffect(() => {
		if (rfpDemo.state.report.stage !== "attached" || rfpDemo.state.agent) {
			setDismissedRovoButtonOnboardingId(null);
			setIsRovoButtonOnboardingOpen(false);
		}
	}, [rfpDemo.state.agent, rfpDemo.state.report.stage]);

	const shouldOfferRovoButtonOnboarding = (
		rfpDemo.state.report.stage === "attached" &&
		!rfpDemo.state.agent &&
		isRfp101Presented &&
		!rfpDemo.state.canvas.open &&
		!isChatOpen &&
		dismissedRovoButtonOnboardingId !== ROVO_BUTTON_AGENT_ONBOARDING_ID
	);
	const handleRovoButtonOnboardingOpenChange = useCallback((open: boolean) => {
		setIsRovoButtonOnboardingOpen(open);
		if (!open) {
			setDismissedRovoButtonOnboardingId(ROVO_BUTTON_AGENT_ONBOARDING_ID);
		}
	}, []);
	const handleDismissRovoButtonOnboarding = useCallback(() => {
		setDismissedRovoButtonOnboardingId(ROVO_BUTTON_AGENT_ONBOARDING_ID);
		setIsRovoButtonOnboardingOpen(false);
	}, []);

	useEffect(() => {
		if (!shouldOfferRovoButtonOnboarding) {
			setIsRovoButtonOnboardingOpen(false);
			return;
		}

		const onboardingTimer = window.setTimeout(() => {
			setIsRovoButtonOnboardingOpen(true);
		}, ROVO_BUTTON_AGENT_ONBOARDING_DELAY_MS);

		return () => window.clearTimeout(onboardingTimer);
	}, [shouldOfferRovoButtonOnboarding]);

	const rovoButtonOnboarding = useMemo<FloatingRovoButtonOnboardingConfig | null>(
		() => shouldOfferRovoButtonOnboarding
			? {
					id: ROVO_BUTTON_AGENT_ONBOARDING_ID,
					title: "Create a new agent",
					agentName: RFP_DRAFTING_AGENT_NAME,
					byline: "By you",
					description: RFP_DRAFTING_AGENT_DESCRIPTION,
					prompt: "Make an agent that handles similar RFP response workflows.",
					primaryActionLabel: "Create",
					secondaryActionLabel: "Not now",
					avatarSrc: RFP_DRAFTING_AGENT_AVATAR_SRC,
					coverSrc: RFP_DRAFTING_AGENT_AVATAR_SRC,
					coverBackgroundColor: RFP_DRAFTING_AGENT_ACCENT_COLOR,
					avatarAlt: "",
					closeLabel: "Dismiss RFP agent onboarding",
					open: isRovoButtonOnboardingOpen,
					openOnButtonClick: true,
					onOpenChange: handleRovoButtonOnboardingOpenChange,
					onPrimaryAction: handleCreateRfpDraftingAgent,
					onSecondaryAction: handleDismissRovoButtonOnboarding,
				}
			: null,
		[
			handleCreateRfpDraftingAgent,
			handleDismissRovoButtonOnboarding,
			handleRovoButtonOnboardingOpenChange,
			isRovoButtonOnboardingOpen,
			shouldOfferRovoButtonOnboarding,
		],
	);
	const customAgentTabs = useMemo<ChatPanelCustomAgentTabs | undefined>(
		() => rfpDemo.state.agent
			? {
					trigger: (
						<RfpAgentTriggerDetails
							state={rfpDemo.state}
							onClearTrigger={rfpDemo.actions.clearAgentTrigger}
						/>
					),
					activity: <RfpAgentActivityDetails state={rfpDemo.state} />,
				}
			: undefined,
		[rfpDemo.actions.clearAgentTrigger, rfpDemo.state],
	);

	return (
		<AppLayout
			product="jira"
			embedded={embedded}
			chatPanelFlush
			hideRovoAction={rfpDemo.state.canvas.open}
			onChatSurfaceSwitch={handleChatSurfaceSwitch}
			chatContextBar={agentsChatScreenContext.chatContextBar}
			chatGreeting={agentsChatScreenContext.greeting}
			customAgentTabs={customAgentTabs}
			rovoButtonOnboarding={rovoButtonOnboarding}
			onArtifactDialogOpen={handleArtifactDialogOpen}
			preserveFloatingSurfaceOnArtifactDialogOpen={isWorkItemModalOpen}
		>
			<AgentsView
				workItemPresentation={workItemPresentation}
				rfpDemo={rfpDemo}
				onCreateRfpDraftingAgent={handleCreateRfpDraftingAgent}
				chatContextBar={agentsChatScreenContext.chatContextBar}
				chatGreeting={agentsChatScreenContext.greeting}
				customAgentTabs={customAgentTabs}
			/>
		</AppLayout>
	);
}

export default function JiraDemo() {
	const embedded = useProjectDemoEmbedded();
	const workItemPresentation = useAgentsWorkItemPresentation();
	const rfpDemo = useAgentsRfpDemoState();
	const agentsChatScreenContext = useMemo(
		() => resolveAgentsChatScreenContext(workItemPresentation.state.workItem),
		[workItemPresentation.state.workItem],
	);
	const rfpDemoContext = useMemo(
		() => formatRfpDemoContext(rfpDemo.state),
		[rfpDemo.state],
	);
	const chatAgentProfiles = useMemo(
		() => getAgentsDemoAgentProfiles(rfpDemo.state),
		[rfpDemo.state],
	);
	const chatPromptOptions = useMemo(
		() => ({
			...AGENTS_CHAT_PROMPT_OPTIONS,
			contextDescription: mergeRovoContextDescriptions(
				AGENTS_CHAT_PROMPT_OPTIONS.contextDescription,
				agentsChatScreenContext.contextDescription,
				rfpDemoContext,
			),
		}) satisfies SendPromptOptions,
		[agentsChatScreenContext.contextDescription, rfpDemoContext],
	);

	return (
		<SidebarProvider>
			<RovoChatProvider
				agentProfiles={chatAgentProfiles}
				defaultPromptOptions={chatPromptOptions}
			>
				<JiraDemoContent
					embedded={embedded}
					rfpDemo={rfpDemo}
					workItemPresentation={workItemPresentation}
					agentsChatScreenContext={agentsChatScreenContext}
				/>
			</RovoChatProvider>
		</SidebarProvider>
	);
}
