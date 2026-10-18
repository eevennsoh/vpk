"use client";

import { useState, useRef, useEffect, useMemo } from "react";

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
import styles from "./chat.module.css";
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
	const LATEST_TURN_TOP_INSET_PX = 12;
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollSpacerRef = useRef<HTMLDivElement>(null);
	const hasInitializedScrollRef = useRef(false);
	const previousLatestUserMessageIdRef = useRef<string | null>(null);
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
	const latestUserMessageId = useMemo(
		() => {
			for (let index = messages.length - 1; index >= 0; index--) {
				if (messages[index].type === "user") {
					return messages[index].id;
				}
			}

			return null;
		},
		[messages]
	);

	useEffect(() => {
		return () => abort();
	}, [abort]);

	useEffect(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) {
			return;
		}

		const hasNewUserTurn =
			hasInitializedScrollRef.current &&
			latestUserMessageId !== null &&
			latestUserMessageId !== previousLatestUserMessageIdRef.current;
		const shouldAnchorToLatestTurn = !hasInitializedScrollRef.current || hasNewUserTurn;

		if (shouldAnchorToLatestTurn) {
			const latestTurnElement = scrollElement.querySelector<HTMLElement>(
				"[data-chat-latest-turn='true']"
			);
			const scrollRect = scrollElement.getBoundingClientRect();
			const latestTurnRect = latestTurnElement?.getBoundingClientRect();
			const rawTargetTop =
				latestTurnRect !== undefined
					? scrollElement.scrollTop + (latestTurnRect.top - scrollRect.top)
					: 0;
			const desiredTargetTop = Math.max(0, rawTargetTop - LATEST_TURN_TOP_INSET_PX);
			const availableScrollRange = scrollElement.scrollHeight - scrollElement.clientHeight;
			const currentSpacerHeight = scrollSpacerRef.current?.offsetHeight ?? 0;
			const availableScrollRangeWithoutSpacer = Math.max(
				0,
				availableScrollRange - currentSpacerHeight
			);
			const requiredSpacer =
				latestTurnRect !== undefined
					? Math.max(0, desiredTargetTop - availableScrollRangeWithoutSpacer)
					: 0;

			if (scrollSpacerRef.current) {
				scrollSpacerRef.current.style.height = `${requiredSpacer}px`;
			}

			const maxScrollTopWithPadding = Math.max(
				0,
				scrollElement.scrollHeight - scrollElement.clientHeight
			);
			const targetTop = Math.min(maxScrollTopWithPadding, desiredTargetTop);

			// Deterministic positioning prevents momentum overshoot/bounce.
			scrollElement.scrollTop = targetTop;
		}

		previousLatestUserMessageIdRef.current = latestUserMessageId;
		hasInitializedScrollRef.current = true;
	}, [latestUserMessageId, messages.length]);

	const messagesContainerStyle = {
		...chatStyles.messagesContainer,
		justifyContent: orderedMessageTurns.length === 0 ? "flex-end" : "flex-start",
		flex: orderedMessageTurns.length === 0 ? chatStyles.messagesContainer.flex : "0 0 auto",
		minHeight: orderedMessageTurns.length === 0 ? undefined : "100%",
	};

	return (
		<div style={{ ...chatStyles.chatPanel, maxWidth: "400px", maxHeight: "800px" }}>
			<ChatHeader onClose={onClose} />

			<div ref={scrollRef} style={chatStyles.scrollContainer}>
				<div style={messagesContainerStyle}>
					{orderedMessageTurns.length === 0 ? (
						<div style={chatStyles.emptyState}>
							<ChatGreeting />
						</div>
					) : (
						orderedMessageTurns.map((turn, turnIndex) => (
							<div
								key={`turn-${turnIndex}-${turn[0]?.id ?? "empty"}`}
								className={turnIndex === orderedMessageTurns.length - 1 ? styles.latestTurn : undefined}
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
							</div>
						))
					)}
				</div>
				<div ref={scrollSpacerRef} aria-hidden style={{ height: 0, flexShrink: 0 }} />
			</div>

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
									<PromptInputActionMenuTrigger aria-label="Add" size="icon-sm" variant="ghost">
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
								<PromptInputSubmit aria-label="Submit" disabled={!prompt.trim()} size="icon-sm">
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
