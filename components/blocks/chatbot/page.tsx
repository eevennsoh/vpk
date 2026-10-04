"use client"

import { useState } from "react"
import {
  BotIcon,
  CopyIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@/components/ui/vpk-icons"

import {
	Conversation,
	ConversationContent,
} from "@/components/ui-custom/conversation"
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageResponse,
} from "@/components/ui-custom/message"
import {
	PromptInput,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	PromptInputButton,
} from "@/components/ui-custom/prompt-input"
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ui-custom/reasoning"
import { Suggestion, Suggestions } from "@/components/ui-custom/suggestion"
import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorLogo,
	ModelSelectorLogoGroup,
	ModelSelectorName,
	ModelSelectorTrigger,
} from "@/components/ui-custom/model-selector"
import { Button } from "@/components/ui/button"
import { MOCK_MESSAGES, MOCK_SUGGESTIONS } from "./data/mock-messages"

export default function AIChatbotBlock() {
	const [messages, setMessages] = useState(MOCK_MESSAGES)
	const [selectedModel, setSelectedModel] = useState("claude-4-sonnet")

	const handleSubmit = ({ text }: { text: string }) => {
		if (!text.trim()) return
		const userMsg = {
			id: String(Date.now()),
			role: "user" as const,
			content: text,
		}
		const assistantMsg = {
			id: String(Date.now() + 1),
			role: "assistant" as const,
			content: "This is a demo response. In a real application, this would be streamed from an AI model.",
		}
		setMessages((prev) => [...prev, userMsg, assistantMsg])
	}

	const handleSuggestion = (suggestion: string) => {
		const userMsg = {
			id: String(Date.now()),
			role: "user" as const,
			content: suggestion,
		}
		const assistantMsg = {
			id: String(Date.now() + 1),
			role: "assistant" as const,
			content: `Great question! Here's what I know about: "${suggestion}"\n\nThis is a demo response showing how suggestions work in the chatbot interface.`,
		}
		setMessages((prev) => [...prev, userMsg, assistantMsg])
	}

	return (
		<div className="flex h-[600px] flex-col bg-background">
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<BotIcon className="size-5 text-muted-foreground" />
					<h2 className="font-semibold text-sm">AI Assistant</h2>
				</div>
				<ModelSelector>
					<ModelSelectorTrigger render={<Button variant="outline" size="default" className="gap-2" />}>
						<ModelSelectorLogoGroup>
							<ModelSelectorLogo provider="anthropic" />
						</ModelSelectorLogoGroup>
						{selectedModel}
					</ModelSelectorTrigger>
					<ModelSelectorContent>
						<ModelSelectorInput placeholder="Search models..." />
						<ModelSelectorList>
							<ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
							<ModelSelectorGroup heading="Anthropic">
								<ModelSelectorItem value="claude-4-sonnet" onSelect={() => setSelectedModel("claude-4-sonnet")}>
									<ModelSelectorLogo provider="anthropic" />
									<ModelSelectorName>Claude 4 Sonnet</ModelSelectorName>
								</ModelSelectorItem>
								<ModelSelectorItem value="claude-4-opus" onSelect={() => setSelectedModel("claude-4-opus")}>
									<ModelSelectorLogo provider="anthropic" />
									<ModelSelectorName>Claude 4 Opus</ModelSelectorName>
								</ModelSelectorItem>
							</ModelSelectorGroup>
							<ModelSelectorGroup heading="OpenAI">
								<ModelSelectorItem value="gpt-4o" onSelect={() => setSelectedModel("gpt-4o")}>
									<ModelSelectorLogo provider="openai" />
									<ModelSelectorName>GPT-4o</ModelSelectorName>
								</ModelSelectorItem>
							</ModelSelectorGroup>
						</ModelSelectorList>
					</ModelSelectorContent>
				</ModelSelector>
			</div>

			<Conversation className="flex-1">
				<ConversationContent>
					{messages.map((msg) => (
						<Message key={msg.id} from={msg.role}>
							<MessageContent>
								{msg.reasoning ? <Reasoning defaultOpen={false} duration={12}>
										<ReasoningTrigger />
										<ReasoningContent>{msg.reasoning}</ReasoningContent>
									</Reasoning> : null}
								<MessageResponse>{msg.content}</MessageResponse>
							</MessageContent>
							{msg.role === "assistant" ? <MessageActions>
									<MessageAction tooltip="Copy" label="Copy response">
										<CopyIcon className="size-4" />
									</MessageAction>
									<MessageAction tooltip="Good response" label="Thumbs up">
										<ThumbsUpIcon className="size-4" />
									</MessageAction>
									<MessageAction tooltip="Bad response" label="Thumbs down">
										<ThumbsDownIcon className="size-4" />
									</MessageAction>
									<MessageAction tooltip="Regenerate" label="Regenerate response">
										<RefreshCwIcon className="size-4" />
									</MessageAction>
								</MessageActions> : null}
						</Message>
					))}
				</ConversationContent>
			</Conversation>

			<div className="border-t p-4">
				<Suggestions className="mb-3">
					{MOCK_SUGGESTIONS.map((s) => (
						<Suggestion key={s} suggestion={s} onClick={handleSuggestion} />
					))}
				</Suggestions>
				<PromptInput
					onSubmit={handleSubmit}
					className="rounded-lg border bg-background shadow-sm"
				>
					<PromptInputTextarea placeholder="Ask me anything..." />
					<PromptInputFooter>
						<PromptInputTools>
							<PromptInputButton tooltip="Attach files">
								<svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
								</svg>
							</PromptInputButton>
						</PromptInputTools>
						<PromptInputSubmit />
					</PromptInputFooter>
				</PromptInput>
			</div>
		</div>
	)
}
