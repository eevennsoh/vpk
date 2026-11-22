"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
	lastAssistantMessageIsCompleteWithApprovalResponses,
	type UIDataTypes,
	type UIMessage,
} from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ItemMedia } from "@/components/ui/item";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import {
	CheckIcon,
	CircleCheckIcon,
	LoaderCircleIcon,
	TerminalIcon,
	XIcon,
} from "@/components/ui/vpk-icons";
import {
	Confirmation,
	ConfirmationAccepted,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRejected,
	ConfirmationRequest,
	ConfirmationTitle,
} from "@/components/ui/confirmation";

type ChatMessage = UIMessage<
	unknown,
	UIDataTypes,
	{
		runCommand: {
			input: { command: string };
			output: { stdout: string };
		};
	}
>;

const chat = createChat<ChatMessage>()
	.user("Clean up the build folder.")
	.sleep(600)
	.assistant(({ writer }) => {
		writer.reasoning(
			"The build output lives in dist. Deleting it cannot be undone, so I should ask before I run the command.",
		);
		writer.sleep(400);
		writer.tool("runCommand", {
			input: { command: "rm -rf dist" },
			needsApproval: true,
			output: { stdout: "" },
		});
	})
	.assistant(({ writer, toolCall }) => {
		writer.sleep(600);
		writer.text(
			toolCall?.approved
				? "Removed the dist folder."
				: "Okay, I left the dist folder in place.",
		);
	});

const initialMessages = chat.get(0);
const transport = chat.transport({ delayMs: 20 });

export default function ConfirmationDemo() {
	const { messages, sendMessage, setMessages, status, addToolApprovalResponse } =
		useChat({
			messages: initialMessages,
			transport,
			sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
		});
	const nextMessage = chat.next(messages);
	const busy = status === "submitted" || status === "streaming";

	return (
		<div className="mx-auto flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
			{messages.map((message) => {
				if (message.role === "user") {
					return (
						<Message key={message.id} align="end">
							<MessageContent>
								<Bubble align="end">
									<BubbleContent>{getMessageText(message)}</BubbleContent>
								</Bubble>
							</MessageContent>
						</Message>
					);
				}

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{message.parts.map((part, index) => {
								if (part.type === "text") {
									return <p key={index}>{part.text}</p>;
								}

								if (part.type === "reasoning") {
									return (
										<Trace key={index}>
											<ReasoningRow
												text={part.text}
												running={part.state === "streaming"}
											/>
										</Trace>
									);
								}

								if (part.type !== "tool-runCommand") {
									return null;
								}

								// A pending approval is a prompt, not activity, so it sits outside Trace.
								if (part.state === "approval-requested") {
									return (
										<Confirmation
											key={part.toolCallId}
											approval={part.approval}
											state={part.state}
										>
											<ItemMedia variant="icon" className="text-icon-subtle">
												<TerminalIcon label="" />
											</ItemMedia>
											<ConfirmationTitle>Run {part.input.command}?</ConfirmationTitle>
											<ConfirmationActions>
												<ConfirmationAction
													variant="outline"
													onClick={() =>
														addToolApprovalResponse({
															id: part.approval.id,
															approved: false,
														})
													}
												>
													Deny
												</ConfirmationAction>
												<ConfirmationAction
													onClick={() =>
														addToolApprovalResponse({
															id: part.approval.id,
															approved: true,
														})
													}
												>
													Approve
												</ConfirmationAction>
											</ConfirmationActions>
										</Confirmation>
									);
								}

								const denied =
									part.state === "output-denied" ||
									(part.state === "approval-responded" && !part.approval.approved);

								return (
									<Trace key={part.toolCallId}>
										<TraceLine
											status={
												!denied && part.state !== "output-available"
													? "running"
													: undefined
											}
										>
											<TraceIcon>
												<TerminalIcon label="" />
											</TraceIcon>
											<TraceTitle>
												{denied
													? "Denied"
													: part.state === "output-available"
														? "Ran"
														: "Running"}{" "}
												{part.input?.command}
											</TraceTitle>
										</TraceLine>
									</Trace>
								);
							})}
						</MessageContent>
					</Message>
				);
			})}
			{busy ? null : (
				<Button
					variant="outline"
					className="mt-auto self-start"
					onClick={() =>
						nextMessage ? sendMessage(nextMessage) : setMessages(initialMessages)
					}
				>
					{nextMessage ? "Send message" : "Reset"}
				</Button>
			)}
		</div>
	);
}

function ReasoningRow({ text, running }: Readonly<{ text: string; running: boolean }>) {
	const [open, setOpen] = useState<boolean>();

	return (
		<TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
			<TraceCollapsibleTrigger>
				<TraceLine status={running ? "running" : undefined}>
					<TraceIcon>
						{running ? (
							<LoaderCircleIcon label="" className="animate-spin" />
						) : (
							<CircleCheckIcon label="" />
						)}
					</TraceIcon>
					<TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent className="whitespace-pre-wrap">{text}</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

export function ConfirmationDemoRequest() {
	return (
		<Confirmation approval={{ id: "1" }} state="approval-requested" className="w-full max-w-sm">
			<ItemMedia variant="icon" className="text-icon-subtle">
				<TerminalIcon label="" />
			</ItemMedia>
			<ConfirmationTitle>
				<ConfirmationRequest>Run rm -rf dist?</ConfirmationRequest>
			</ConfirmationTitle>
			<ConfirmationActions>
				<ConfirmationAction variant="outline">Deny</ConfirmationAction>
				<ConfirmationAction>Approve</ConfirmationAction>
			</ConfirmationActions>
		</Confirmation>
	);
}

export function ConfirmationDemoAccepted() {
	return (
		<Confirmation
			approval={{ id: "2", approved: true }}
			state="output-available"
			className="w-full max-w-sm"
		>
			<ItemMedia variant="icon" className="text-icon-success">
				<CheckIcon label="" />
			</ItemMedia>
			<ConfirmationTitle>
				<ConfirmationAccepted>You approved rm -rf dist</ConfirmationAccepted>
			</ConfirmationTitle>
		</Confirmation>
	);
}

export function ConfirmationDemoRejected() {
	return (
		<Confirmation
			approval={{ id: "3", approved: false }}
			state="output-denied"
			className="w-full max-w-sm"
		>
			<ItemMedia variant="icon" className="text-icon-danger">
				<XIcon label="" />
			</ItemMedia>
			<ConfirmationTitle>
				<ConfirmationRejected>You denied rm -rf dist</ConfirmationRejected>
			</ConfirmationTitle>
		</Confirmation>
	);
}
