"use client";

import { useState, useEffect, useMemo } from "react";

import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerViewport } from "@/components/ui/message-scroller";

import ChatHeader from "./components/chat-header";
import ChatGreeting from "./components/chat-greeting";
import MessageBubble from "./components/message-bubble";
import CustomizeMenu from "@/components/projects/shared/components/chat-configuration/customize-menu";
import { DEFAULT_REASONING_OPTION_ID } from "@/components/projects/shared/components/chat-configuration/customize-menu-data";
import {
	PromptInput,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuItem,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputFooter,
	PromptInputMicrophone,
	PromptInputPreferencesButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ui-custom/prompt-input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
	composerUpwardShadow,
	composerPromptInputClassName,
	composerTextareaClassName,
	textareaCSS,
} from "@/components/projects/shared/components/rovo-composer-styles";
import { Footer } from "@/components/ui-custom/footer";
import { chatStyles } from "./data/styles";
import { useChatSubmit } from "./hooks/use-chat-submit";
import { turnEnterClassName } from "@/components/projects/shared/message-turns";
import { ChatScrollerItem } from "@/components/projects/shared/components/chat-scroller-item";
import AddIcon from "@atlaskit/icon/core/add";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";

import LinkIcon from "@atlaskit/icon/core/link";
import MentionIcon from "@atlaskit/icon/core/mention";
import PageIcon from "@atlaskit/icon/core/page";
import UploadIcon from "@atlaskit/icon/core/upload";

interface ChatPanelProps {
	onClose: () => void;
}

export default function ChatPanel({ onClose }: Readonly<ChatPanelProps>): React.ReactElement {
	const [selectedReasoning, setSelectedReasoning] = useState(DEFAULT_REASONING_OPTION_ID);
	const [webResultsEnabled, setWebResultsEnabled] = useState(false);
	const [companyKnowledgeEnabled, setCompanyKnowledgeEnabled] = useState(true);
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false);
	const { prompt, setPrompt, handleSubmit, abort, messages } = useChatSubmit();

	const orderedMessageTurns = useMemo(
		() => {
			const turns = messages.reduce<(typeof messages)[]>((prev, message) => {
				if (message.type === "user") {
					prev.push([message]);
					return prev;
				}

				if (prev.length === 0) {
					prev.push([message]);
					return prev;
				}

				prev[prev.length - 1].push(message);
				return prev;
			}, []);

			return turns;
		},
		[messages]
	);
	useEffect(() => {
		return () => abort();
	}, [abort]);

	const messagesContainerStyle = {
		...chatStyles.messagesContainer,
		justifyContent: orderedMessageTurns.length === 0 ? "flex-end" : "flex-start",
		flex: orderedMessageTurns.length === 0 ? chatStyles.messagesContainer.flex : "0 0 auto",
		minHeight: orderedMessageTurns.length === 0 ? undefined : "100%",
	};

	return (
		<div style={{ ...chatStyles.chatPanel, maxWidth: "400px", maxHeight: "800px" }}>
			<ChatHeader onClose={onClose} />

			<MessageScroller autoScroll defaultScrollPosition="last-anchor" scrollPreviousItemPeek={0} className="flex-1">
				<MessageScrollerViewport>
					<MessageScrollerContent className="gap-0" style={messagesContainerStyle}>
						{orderedMessageTurns.length === 0 ? (
						<ChatScrollerItem style={chatStyles.emptyState}>
								<ChatGreeting />
						</ChatScrollerItem>
						) : (
							orderedMessageTurns.map((turn, turnIndex) => (
								<MessageScrollerItem
									key={`turn-${turnIndex}-${turn[0]?.id ?? "empty"}`}
									messageId={turn[0]?.id}
									scrollAnchor={turn[0]?.type === "user"}
									className={turnIndex === orderedMessageTurns.length - 1 ? turnEnterClassName : undefined}
									data-chat-latest-turn={turnIndex === orderedMessageTurns.length - 1 ? "true" : undefined}
								>
									{turn.map((message, messageIndex) => (
										<div
											key={`turn-${turnIndex}-message-${messageIndex}-${message.id}`}
											style={{
												marginTop:
													message.type === "assistant" &&
													messageIndex > 0 &&
													turn[messageIndex - 1]?.type === "user"
														? "12px"
														: "0",
											}}
										>
											<MessageBubble message={message} />
										</div>
									))}
								</MessageScrollerItem>
							))
						)}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton />
			</MessageScroller>

			<div className="px-1">
				<div
					className="rounded-xl border border-border bg-surface px-4 pb-3 pt-4"
					style={{ boxShadow: composerUpwardShadow }}
				>
					<PromptInput
						onSubmit={() => {
							handleSubmit();
						}}
						className={composerPromptInputClassName}
					>
						<PromptInputBody>
							<PromptInputTextarea
								value={prompt}
								onChange={(event) => setPrompt(event.currentTarget.value)}
								placeholder="Ask, @mention, or / for skills"
								aria-label="Chat message input"
								rows={1}
								className={composerTextareaClassName}
							/>
						</PromptInputBody>

						<PromptInputFooter className="mt-3 justify-between px-0 pb-0">
							<PromptInputTools>
								<PromptInputActionMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
									<PromptInputActionMenuTrigger aria-label="Add" className="rounded-md" size="icon-sm" variant="ghost">
										<AddIcon label="" />
									</PromptInputActionMenuTrigger>
									<PromptInputActionMenuContent className="w-auto min-w-[200px] p-1">
										<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)}>
											<UploadIcon label="Upload file" />
											<span>Upload file</span>
										</PromptInputActionMenuItem>
										<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)}>
											<LinkIcon label="Add link" />
											<span>Add a link</span>
										</PromptInputActionMenuItem>
										<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)}>
											<MentionIcon label="Mention someone" />
											<span>Mention someone</span>
										</PromptInputActionMenuItem>
										<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)}>
											<AddIcon label="More formatting" />
											<span>More formatting</span>
										</PromptInputActionMenuItem>
										<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)}>
											<PageIcon label="Add current page as context" />
											<span>Add current page as context</span>
										</PromptInputActionMenuItem>
									</PromptInputActionMenuContent>
								</PromptInputActionMenu>

								<Popover open={isCustomizeMenuOpen} onOpenChange={setIsCustomizeMenuOpen}>
									<PopoverTrigger
										render={<PromptInputPreferencesButton aria-label="Customize" />}
									/>
									<PopoverContent side="top" align="start" sideOffset={8} className="w-auto p-1">
									<PopoverTitle className="sr-only">Customize sources</PopoverTitle>
										<CustomizeMenu
											selectedReasoning={selectedReasoning}
											onReasoningChange={setSelectedReasoning}
											showReasoning={false}
											webResultsEnabled={webResultsEnabled}
											onWebResultsChange={setWebResultsEnabled}
											companyKnowledgeEnabled={companyKnowledgeEnabled}
											onCompanyKnowledgeChange={setCompanyKnowledgeEnabled}
											onClose={() => setIsCustomizeMenuOpen(false)}
										/>
									</PopoverContent>
								</Popover>
							</PromptInputTools>

							<div className="flex items-center gap-0.5">
								<PromptInputMicrophone />
								<PromptInputSubmit aria-label="Submit" disabled={!prompt.trim()} className="rounded-md" size="icon-sm">
									<ArrowUpIcon label="" />
								</PromptInputSubmit>
							</div>
						</PromptInputFooter>
					</PromptInput>

					<style>{textareaCSS}</style>
				</div>

				<Footer />
			</div>
		</div>
	);
}
