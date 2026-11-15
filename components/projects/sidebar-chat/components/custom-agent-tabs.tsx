"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- Tab panels take host-owned slot nodes and an empty-state node.

import type { ReactNode } from "react";
import type { useRovoChat } from "@/app/contexts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EditIcon from "@atlaskit/icon/core/edit";
import { cn } from "@/lib/utils";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { AgentVersionSelection } from "../hooks/use-agent-version-selection";
import type { ChatPanelAgentVersionOption, ChatPanelCustomAgentTabs } from "../lib/chat-panel-types";
import { AgentActivityTimeline } from "./agent-activity-timeline";
import { AgentVersionMenu } from "./agent-version-menu";

type RovoChat = ReturnType<typeof useRovoChat>;

function CustomAgentTabEmptyState({
	description,
	title,
}: Readonly<{
	description: string;
	title: string;
}>): React.ReactElement {
	return (
		<div className="flex min-h-[220px] items-center justify-center p-6 text-center">
			<div className="max-w-[280px] space-y-2">
				<h3 className="text-sm font-semibold text-text">{title}</h3>
				<p className="text-sm leading-6 text-text-subtle">{description}</p>
			</div>
		</div>
	);
}

interface CustomAgentTabsProps {
	agentVersion: AgentVersionSelection;
	agentVersionOptions: readonly ChatPanelAgentVersionOption[];
	chatComposerBody: ReactNode;
	chatConversationBody: ReactNode;
	customAgentTabs?: ChatPanelCustomAgentTabs;
	isAgentTestEmptyState: boolean;
	getSessionAgentEntry: RovoChat["getSessionAgentEntry"];
	onResetChat: () => void;
	rawUiMessages: ReadonlyArray<RovoUIMessage>;
	selectedAgent: RovoChat["selectedAgent"];
	showAgentTestControls: boolean;
}

/**
 * Chat / Trigger / Activity tabs for a custom agent. In agent Test mode the
 * tab row also carries the version picker and a new-chat button.
 */
export function CustomAgentTabs({
	agentVersion,
	agentVersionOptions,
	chatComposerBody,
	chatConversationBody,
	customAgentTabs,
	isAgentTestEmptyState,
	getSessionAgentEntry,
	onResetChat,
	rawUiMessages,
	selectedAgent,
	showAgentTestControls,
}: Readonly<CustomAgentTabsProps>): React.ReactElement {
	return (
		<>
			<Tabs
				defaultValue="chat"
				aria-label="Custom agent views"
				className={cn(
					"min-h-0 min-w-0 flex-1",
					isAgentTestEmptyState && "flex flex-col",
				)}
			>
				<div
					className={cn(
						"flex shrink-0 items-center gap-2 pt-3 pb-3",
						// In Test mode the surrounding panel already supplies the
						// header-matching horizontal inset (px-6), so the row drops
						// its own padding to keep the version dropdown and edit
						// button aligned with the header controls above. Other
						// surfaces keep the px-3 inset.
						showAgentTestControls ? null : "px-3",
						// Match the Test-mode control bar height on every surface so
						// the Chat/Trigger/Activity pill lands at the same vertical
						// position as the Test-mode tab bar. The Test row is sized by
						// its flanking controls (version dropdown + edit button), so
						// reserve the same row height when those controls are absent.
						showAgentTestControls ? null : "min-h-[56px]",
					)}
				>
					{showAgentTestControls ? (
						<AgentVersionMenu
							agentVersionOptions={agentVersionOptions}
							onSelectVersion={agentVersion.selectAgentVersion}
							selectedAgentVersion={agentVersion.selectedAgentVersion}
						/>
					) : null}
					<div className={cn("flex flex-1", showAgentTestControls ? "justify-center" : null)}>
						<TabsList
							className={cn(
								showAgentTestControls
									? "w-full max-w-[376px]"
									: "w-full",
							)}
						>
							<TabsTrigger value="chat">Chat</TabsTrigger>
							<TabsTrigger value="trigger">Trigger</TabsTrigger>
							<TabsTrigger value="activity">Activity</TabsTrigger>
						</TabsList>
					</div>
					{showAgentTestControls ? (
						<Button aria-label="New chat" size="icon" variant="ghost" onClick={onResetChat}>
							<EditIcon label="" />
						</Button>
					) : null}
				</div>
				<TabsContent
					value="chat"
					keepMounted
					className="min-h-0 flex flex-1 flex-col data-[hidden]:hidden"
				>
					{isAgentTestEmptyState ? (
						// Fill the full tab height and pin the composer to the
						// bottom (conversation grows to take the slack) so the Test
						// composer aligns with the bottom-anchored sidebar composer
						// instead of floating mid-height.
						<div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-3">
							{chatConversationBody}
							{chatComposerBody}
						</div>
					) : (
						chatConversationBody
					)}
				</TabsContent>
				<TabsContent value="trigger" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 data-[hidden]:hidden">
					{customAgentTabs?.trigger ?? (
						<CustomAgentTabEmptyState
							title="No trigger configured"
							description={`${selectedAgent.name} does not have trigger details in this view yet.`}
						/>
					)}
				</TabsContent>
				<TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 data-[hidden]:hidden">
					{customAgentTabs?.activity ?? (
						<AgentActivityTimeline
							entry={getSessionAgentEntry(selectedAgent.id)}
							messages={rawUiMessages}
							emptyState={
								<CustomAgentTabEmptyState
									title="No activity yet"
									description={`${selectedAgent.name} has not recorded activity in this view yet.`}
								/>
							}
						/>
					)}
				</TabsContent>
			</Tabs>
			{isAgentTestEmptyState ? null : chatComposerBody}
		</>
	);
}
