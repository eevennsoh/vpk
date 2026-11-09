"use client";

import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRovoChat } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import {
	getMessageText,
	getMessageToolParts,
	getThinkingToolCallSummaries,
	isRenderableRovoUIMessage,
	isMessageTextStreaming,
	type RovoRenderableUIMessage,
	type RovoToolPart,
	type ThinkingToolCallSummary,
} from "@/lib/rovo-ui-messages";
import { getToolDisplayInfo, renderResolvedToolIcon, resolveToolIcon } from "@/components/projects/shared/lib/tool-icon-resolver";
import { Lozenge } from "@/components/ui/lozenge";
import { Spinner } from "@/components/ui/spinner";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const TOOL_PROMPT_OPTIONS: SendPromptOptions = {
	contextDescription: [
		"The user is testing a tool invocation demo. You have access to tools via MCP servers.",
		"When the user asks you to do something, use available tools to accomplish the task.",
		"Show the user how tool calling works by invoking real tools when appropriate.",
	].join(" "),
};

const SUGGESTIONS = [
	"What tools do you have access to?",
	"Search for recent Jira issues",
	"What can you help me with?",
];

/* -------------------------------------------------------------------------- */
/*  Inline styles (ported from teamwork-agent RovoDev.css + components)       */
/* -------------------------------------------------------------------------- */

const viewStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	height: "calc(100dvh - 1px)",
	overflow: "hidden",
};

const chatContainerStyle: CSSProperties = {
	flex: 1,
	overflowY: "auto",
	padding: 16,
	display: "flex",
	flexDirection: "column",
	gap: 4,
};

const userBubbleStyle: CSSProperties = {
	background: "var(--ds-background-brand-bold, #0c66e4)",
	color: "var(--ds-text-inverse, #ffffff)",
	padding: "10px 14px",
	borderRadius: "12px 12px 4px 12px",
	maxWidth: "85%",
	alignSelf: "flex-end",
	wordBreak: "break-word",
	lineHeight: 1.5,
	fontSize: 14,
};

const agentBubbleStyle: CSSProperties = {
	background: "var(--color-surface-raised, var(--ds-surface-raised, #22272b))",
	color: "var(--color-text, var(--ds-text, #b6c2cf))",
	padding: "10px 14px",
	borderRadius: "12px 12px 12px 4px",
	maxWidth: "85%",
	alignSelf: "flex-start",
	wordBreak: "break-word",
	lineHeight: 1.5,
	fontSize: 14,
	border: "1px solid var(--color-border, var(--ds-border, #a6c5e229))",
};

const msgContainerStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	marginBottom: 8,
};

const toolCardStyle: CSSProperties = {
	border: "1px solid var(--color-border, var(--ds-border, #dfe1e6))",
	borderRadius: 8,
	padding: "8px 12px",
	backgroundColor: "var(--color-surface-raised, var(--ds-surface-raised, #fff))",
	marginBottom: 8,
};

const toolNameBadgeStyle: CSSProperties = {
	display: "inline-block",
	padding: "2px 8px",
	borderRadius: 4,
	fontSize: 12,
	fontWeight: 600,
	fontFamily: "monospace",
	backgroundColor: "var(--color-bg-neutral, var(--ds-background-neutral, #f4f5f7))",
	color: "var(--color-text, var(--ds-text, #172b4d))",
};

const serverBadgeStyle: CSSProperties = {
	display: "inline-block",
	padding: "2px 8px",
	borderRadius: 4,
	fontSize: 11,
	fontWeight: 500,
	backgroundColor: "var(--ds-background-discovery, #e9e0f5)",
	color: "var(--ds-text-discovery, #403294)",
};

const expandButtonStyle: CSSProperties = {
	marginLeft: "auto",
	background: "none",
	border: "none",
	fontSize: 12,
	color: "var(--color-text-subtlest, var(--ds-text-subtlest, #6b778c))",
	padding: "2px 6px",
};

const preBlockStyle: CSSProperties = {
	marginTop: 8,
	padding: 8,
	borderRadius: 4,
	backgroundColor: "var(--color-bg-neutral, var(--ds-background-neutral, #f4f5f7))",
	color: "var(--color-text, var(--ds-text, #172b4d))",
	fontSize: 12,
	fontFamily: "monospace",
	overflowX: "auto",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	maxHeight: 400,
	overflowY: "auto",
	margin: 0,
};

const thinkingStyle: CSSProperties = {
	padding: "12px 16px",
	fontSize: 13,
	color: "var(--color-text-subtlest, var(--ds-text-subtlest, #8c9bab))",
	display: "flex",
	alignItems: "center",
	gap: 10,
};

const inputContainerStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 8,
	padding: "12px 16px",
	borderTop: "1px solid var(--color-border, var(--ds-border, #a6c5e229))",
};

const textareaStyle: CSSProperties = {
	width: "100%",
	minHeight: 44,
	maxHeight: 200,
	padding: "10px 12px",
	background: "var(--color-surface-raised, var(--ds-surface-raised, #22272b))",
	color: "var(--color-text, var(--ds-text, #b6c2cf))",
	border: "1px solid var(--color-border, var(--ds-border, #a6c5e229))",
	borderRadius: 8,
	fontSize: 14,
	lineHeight: 1.5,
	resize: "vertical" as const,
	outline: "none",
	fontFamily: "inherit",
	boxSizing: "border-box" as const,
};

const sendButtonStyle: CSSProperties = {
	padding: "6px 16px",
	borderRadius: 6,
	border: "none",
	background: "var(--ds-background-brand-bold, #0c66e4)",
	color: "var(--ds-text-inverse, #ffffff)",
	fontSize: 13,
	fontWeight: 600,
};

const cancelButtonStyle: CSSProperties = {
	padding: "6px 16px",
	borderRadius: 6,
	border: "1px solid var(--color-border, var(--ds-border, #a6c5e229))",
	background: "var(--color-surface-raised, var(--ds-surface-raised, #22272b))",
	color: "var(--color-text, var(--ds-text, #b6c2cf))",
	fontSize: 13,
	fontWeight: 600,
};

const landingStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	height: "100%",
	gap: 16,
	textAlign: "center",
	padding: 32,
};

/* -------------------------------------------------------------------------- */
/*  CSS keyframe injection (spinner animation from RovoDev.css)               */
/* -------------------------------------------------------------------------- */

const SPINNER_STYLE_ID = "tool-invocation-spinner-style";

function ensureSpinnerStyle() {
	if (typeof document === "undefined") return;
	if (document.getElementById(SPINNER_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = SPINNER_STYLE_ID;
	style.textContent = `
		@keyframes tools-demo-spin {
			from { transform: rotate(0deg); }
			to { transform: rotate(360deg); }
		}
	`;
	document.head.appendChild(style);
}

/* -------------------------------------------------------------------------- */
/*  Simple markdown renderer (from teamwork-agent ChatMessageItem)            */
/* -------------------------------------------------------------------------- */

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdown(raw: string): string {
	let text = escapeHtml(raw.replace(/^\n+/, ""));

	text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
		return `<pre style="background:var(--color-bg-neutral,#1b2638);padding:12px;border-radius:6px;overflow-x:auto;font-size:13px;line-height:1.5"><code>${code}</code></pre>`;
	});

	text = text.replace(/`([^`\n]+?)`/g, (_match, code) => {
		return `<code style="background:var(--color-bg-neutral,#1b2638);padding:2px 5px;border-radius:3px;font-size:0.9em">${code}</code>`;
	});

	text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

	text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_match, label, url) => {
		const safeUrl = escapeHtml(url);
		return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--ds-link,#579dff)">${label}</a>`;
	});

	text = text.replace(/\n/g, "<br/>");

	return text;
}

/* -------------------------------------------------------------------------- */
/*  ChatMessageBubble — user/agent message bubble (from teamwork-agent)       */
/* -------------------------------------------------------------------------- */

function ChatMessageBubble({
	content,
	isUser,
	isStreaming,
}: {
	content: string;
	isUser: boolean;
	isStreaming?: boolean;
}) {
	const html = useMemo(() => renderMarkdown(content), [content]);
	const displayHtml = isStreaming
		? html + '<span style="opacity:0.7">▍</span>'
		: html;

	return (
		<div
			style={{
				...msgContainerStyle,
				alignItems: isUser ? "flex-end" : "flex-start",
			}}
		>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: simple markdown rendering */}
			<div
				style={isUser ? userBubbleStyle : agentBubbleStyle}
				dangerouslySetInnerHTML={{ __html: displayHtml }}
			/>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*  Tool name parsing — extract server & display name from MCP tool names     */
/*  Ported from teamwork-agent ToolCallItem.tsx                               */
/* -------------------------------------------------------------------------- */

function getRawToolName(toolPart: RovoToolPart): string {
	if (toolPart.type === "dynamic-tool") return toolPart.toolName;
	// AI SDK v5: tool name is encoded in type as `tool-${toolName}`
	return toolPart.type.replace(/^tool-/, "");
}

function getToolInput(toolPart: RovoToolPart): unknown {
	return toolPart.input;
}

function getToolOutput(toolPart: RovoToolPart): unknown {
	return toolPart.output;
}

function getToolError(toolPart: RovoToolPart): string | undefined {
	return toolPart.errorText;
}

function ToolIcon(options: Readonly<{
	toolName?: string | null;
	title?: string | null;
	input?: unknown;
	mcpServer?: string | null;
}>): ReactElement {
	return (
		<span style={{ display: "inline-flex", width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
			{renderResolvedToolIcon(resolveToolIcon(options), { className: "size-4" })}
		</span>
	);
}

/* -------------------------------------------------------------------------- */
/*  Permission + status lozenges (from teamwork-agent ToolCallItem)           */
/* -------------------------------------------------------------------------- */

/**
 * Permission badge — shows the real permission scenario from the backend.
 *
 * In teamwork-agent, the `on_call_tools_start` event carries a `permissions` map
 * where each tool_call_id maps to ASK | ALLOWED | DENIED. This data is now
 * forwarded through the VPK backend pipeline via ThinkingEventUpdate.mcpServer
 * and ThinkingEventUpdate.permissionScenario.
 *
 * Only renders when real permission data is available — no inferred badges.
 */
function PermissionBadge({ permissionScenario }: { permissionScenario?: string }) {
	if (!permissionScenario) return null;
	if (permissionScenario === "ASK") return null; // awaiting user decision
	if (permissionScenario === "DENIED") {
		return <Lozenge variant="danger">Auto-denied</Lozenge>;
	}
	if (permissionScenario === "ALLOWED") {
		return <Lozenge variant="success">Auto-allowed</Lozenge>;
	}
	return null;
}

/** Execution status indicator shown alongside the permission badge. */
function ToolStatusLozenge({ state }: { state: string }) {
	if (state === "output-available") return null; // permission badge is enough
	if (state === "output-error") {
		return <Lozenge variant="danger">Error</Lozenge>;
	}
	if (state === "approval-requested") {
		return <Lozenge variant="warning">Awaiting approval</Lozenge>;
	}
	if (state === "input-streaming" || state === "input-available") {
		return (
			<Lozenge
				variant="information"
				icon={<Spinner size="xs" label="Running" className="text-current" />}
			>
				Running
			</Lozenge>
		);
	}
	return null;
}

/* -------------------------------------------------------------------------- */
/*  InlineToolCard — merged ToolCallItem + ToolReturnItem from teamwork-agent  */
/* -------------------------------------------------------------------------- */

function InlineToolCard({ toolPart }: { toolPart: RovoToolPart }) {
	const [argsExpanded, setArgsExpanded] = useState(false);
	const [resultExpanded, setResultExpanded] = useState(false);

	const rawToolName = getRawToolName(toolPart);
	const input = getToolInput(toolPart);
	const output = getToolOutput(toolPart);
	const errorText = getToolError(toolPart);
	const displayInfo = getToolDisplayInfo(rawToolName, input);
	const displayName = displayInfo.displayName;
	const serverName = displayInfo.server;

	const formattedInput =
		input !== undefined && input !== null
			? typeof input === "string"
				? input
				: JSON.stringify(input, null, 2)
			: null;

	const formattedOutput =
		output !== undefined && output !== null
			? typeof output === "string"
				? output
				: JSON.stringify(output, null, 2)
			: null;

	const hasOutput =
		toolPart.state === "output-available" ||
		toolPart.state === "output-denied" ||
		toolPart.state === "output-error";

	return (
		<>
			{/* Tool call card */}
			<div style={toolCardStyle}>
				{/* Header row */}
				<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
					<span style={{ ...toolNameBadgeStyle, display: "inline-flex", alignItems: "center", gap: 6 }}>
					<ToolIcon toolName={rawToolName} input={input} />
					<span>{displayName}</span>
				</span>
					{serverName ? <span style={serverBadgeStyle}>{serverName}</span> : null}
					<ToolStatusLozenge state={toolPart.state} />
					{formattedInput ? (
						<button
							type="button"
							onClick={() => setArgsExpanded((v) => !v)}
							style={expandButtonStyle}
						>
							{argsExpanded ? "▾ Hide args" : "▸ Show args"}
						</button>
					) : null}
				</div>

				{/* Expandable args */}
				{argsExpanded && formattedInput ? (
					<pre style={preBlockStyle}>
						<code>{formattedInput}</code>
					</pre>
				) : null}

				{/* Error text */}
				{errorText ? (
					<div
						style={{
							marginTop: 8,
							padding: "8px 12px",
							borderRadius: 6,
							background: "var(--ds-background-danger, #42221f)",
							border: "1px solid var(--ds-border-danger, #ae2e24)",
							color: "var(--ds-text-danger, #fd9891)",
							fontSize: 13,
						}}
					>
						<pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
							{errorText}
						</pre>
					</div>
				) : null}
			</div>

			{/* Separate result card (matches teamwork-agent layout) */}
			{hasOutput && formattedOutput ? (
				<div style={toolCardStyle}>
					<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
						<span
							style={{
								fontSize: 12,
								fontWeight: 600,
								fontFamily: "monospace",
								color: "var(--color-text-subtlest, var(--ds-text-subtlest, #6b778c))",
							}}
						>
							↵
						</span>
						<span style={toolNameBadgeStyle}>{rawToolName}</span>
						<button
							type="button"
							onClick={() => setResultExpanded((v) => !v)}
							style={expandButtonStyle}
						>
							{resultExpanded ? "▾ Hide result" : "▸ Show result"}
						</button>
					</div>
					{resultExpanded ? (
						<pre style={preBlockStyle}>
							<code>{formattedOutput}</code>
						</pre>
					) : null}
				</div>
			) : null}
		</>
	);
}

/* -------------------------------------------------------------------------- */
/*  ThinkingToolCard — for thinking-event tool calls                          */
/* -------------------------------------------------------------------------- */

function thinkingStateToDisplayState(state: ThinkingToolCallSummary["state"]): string {
	if (state === "awaiting-input") return "input-streaming";
	if (state === "running") return "input-available";
	if (state === "error") return "output-error";
	return "output-available";
}

function ThinkingToolCard({ toolCall }: { toolCall: ThinkingToolCallSummary }) {
	const [argsExpanded, setArgsExpanded] = useState(false);
	const [resultExpanded, setResultExpanded] = useState(false);

	const displayInfo = getToolDisplayInfo(toolCall.toolName, toolCall.input, toolCall.mcpServer);
	const displayName = displayInfo.displayName;
	const serverName = displayInfo.server;
	const displayState = thinkingStateToDisplayState(toolCall.state);

	const formattedInput =
		toolCall.input !== undefined && toolCall.input !== null
			? typeof toolCall.input === "string"
				? toolCall.input
				: JSON.stringify(toolCall.input, null, 2)
			: null;

	const formattedOutput =
		toolCall.output !== undefined && toolCall.output !== null
			? typeof toolCall.output === "string"
				? toolCall.output
				: JSON.stringify(toolCall.output, null, 2)
			: null;

	const hasOutput = toolCall.state === "completed" || toolCall.state === "error";

	return (
		<>
			{/* Tool call card */}
			<div style={toolCardStyle}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
					<span style={{ ...toolNameBadgeStyle, display: "inline-flex", alignItems: "center", gap: 6 }}>
					<ToolIcon toolName={toolCall.toolName} input={toolCall.input} mcpServer={toolCall.mcpServer} />
					<span>{displayName}</span>
				</span>
					{serverName ? <span style={serverBadgeStyle}>{serverName}</span> : null}
					<PermissionBadge permissionScenario={toolCall.permissionScenario} />
					<ToolStatusLozenge state={displayState} />
					{formattedInput ? (
						<button
							type="button"
							onClick={() => setArgsExpanded((v) => !v)}
							style={expandButtonStyle}
						>
							{argsExpanded ? "▾ Hide args" : "▸ Show args"}
						</button>
					) : null}
				</div>

				{argsExpanded && formattedInput ? (
					<pre style={preBlockStyle}>
						<code>{formattedInput}</code>
					</pre>
				) : null}

				{toolCall.errorText ? (
					<div
						style={{
							marginTop: 8,
							padding: "8px 12px",
							borderRadius: 6,
							background: "var(--ds-background-danger, #42221f)",
							border: "1px solid var(--ds-border-danger, #ae2e24)",
							color: "var(--ds-text-danger, #fd9891)",
							fontSize: 13,
						}}
					>
						<pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
							{toolCall.errorText}
						</pre>
					</div>
				) : null}
			</div>

			{/* Separate result card (matches teamwork-agent layout) */}
			{hasOutput && formattedOutput ? (
				<div style={toolCardStyle}>
					<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
						<span
							style={{
								fontSize: 12,
								fontWeight: 600,
								fontFamily: "monospace",
								color: "var(--color-text-subtlest, var(--ds-text-subtlest, #6b778c))",
							}}
						>
							↵
						</span>
						<span style={toolNameBadgeStyle}>{toolCall.toolName}</span>
						<button
							type="button"
							onClick={() => setResultExpanded((v) => !v)}
							style={expandButtonStyle}
						>
							{resultExpanded ? "▾ Hide result" : "▸ Show result"}
						</button>
					</div>
					{resultExpanded ? (
						<pre style={preBlockStyle}>
							<code>{formattedOutput}</code>
						</pre>
					) : null}
				</div>
			) : null}
		</>
	);
}

/* -------------------------------------------------------------------------- */
/*  RenderedMessage                                                           */
/* -------------------------------------------------------------------------- */

function RenderedMessage({
	message,
	isStreaming,
}: {
	message: RovoRenderableUIMessage;
	isStreaming: boolean;
}) {
	const text = getMessageText(message);
	const toolParts = getMessageToolParts(message);
	const thinkingToolCalls = getThinkingToolCallSummaries(message);
	const isTextStreaming = isStreaming && isMessageTextStreaming(message);

	if (message.role === "user") {
		return <ChatMessageBubble content={text} isUser />;
	}

	return (
		<>
			{text ? (
				<ChatMessageBubble content={text} isUser={false} isStreaming={isTextStreaming} />
			) : null}
			{thinkingToolCalls.length > 0
				? thinkingToolCalls.map((toolCall, index) => (
						<ThinkingToolCard
							key={`${message.id}-thinking-${toolCall.id}-${index}`}
							toolCall={toolCall}
						/>
					))
				: null}
			{toolParts.length > 0
				? toolParts.map((toolPart, index) => (
						<InlineToolCard
							key={`${message.id}-tool-${toolPart.toolCallId}-${index}`}
							toolPart={toolPart}
						/>
					))
				: null}
		</>
	);
}

/* -------------------------------------------------------------------------- */
/*  Prompt input (from teamwork-agent PromptInput, simplified)                */
/* -------------------------------------------------------------------------- */

function DemoPromptInput({
	onSend,
	onCancel,
	isStreaming,
}: {
	onSend: (message: string) => void;
	onCancel: () => void;
	isStreaming: boolean;
}) {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleKeyDown = useCallback(
		(e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (!isStreaming && value.trim()) {
					onSend(value.trim());
					setValue("");
				}
			}
		},
		[value, isStreaming, onSend],
	);

	const handleSend = useCallback(() => {
		if (!isStreaming && value.trim()) {
			onSend(value.trim());
			setValue("");
		}
	}, [value, isStreaming, onSend]);

	const canSend = !isStreaming && value.trim().length > 0;

	return (
		<div style={inputContainerStyle}>
			<textarea
				ref={textareaRef}
				style={textareaStyle}
				placeholder="Ask something that triggers tool use..."
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				disabled={isStreaming}
				rows={2}
			/>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
				{isStreaming ? (
					<button type="button" style={cancelButtonStyle} onClick={onCancel}>
						Cancel
					</button>
				) : null}
				<button
					type="button"
					style={canSend ? sendButtonStyle : { ...sendButtonStyle, opacity: 0.5, cursor: "not-allowed" }}
					onClick={handleSend}
					disabled={!canSend}
				>
					Send
				</button>
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*  Main demo                                                                 */
/* -------------------------------------------------------------------------- */

export default function ToolInvocationDemo(): ReactElement {
	const {
		uiMessages: rawUiMessages,
		sendPrompt,
		stopStreaming,
		resetChat,
		isStreaming,
		isSubmitPending,
	} = useRovoChat();

	const scrollRef = useRef<HTMLDivElement>(null);
	const isSubmittingRef = useRef(false);

	const isActive = isStreaming || isSubmitPending;

	const messages = useMemo(
		() => rawUiMessages.filter(isRenderableRovoUIMessage),
		[rawUiMessages],
	);

	const lastAssistantId = useMemo(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "assistant") return messages[i].id;
		}
		return null;
	}, [messages]);

	/* Inject spinner animation */
	useEffect(() => {
		ensureSpinnerStyle();
	}, []);

	/* Auto-scroll */
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages]);

	/* Submit */
	const submitPrompt = useCallback(
		async (text: string) => {
			const trimmed = text.trim();
			if (!trimmed || isSubmittingRef.current) return;

			isSubmittingRef.current = true;

			try {
				await sendPrompt(trimmed, TOOL_PROMPT_OPTIONS);
			} finally {
				isSubmittingRef.current = false;
			}
		},
		[sendPrompt],
	);

	const handleSend = useCallback(
		(text: string) => void submitPrompt(text),
		[submitPrompt],
	);

	const handleCancel = useCallback(() => {
		void stopStreaming();
	}, [stopStreaming]);

	/* Cleanup */
	useEffect(() => {
		return () => {
			void stopStreaming();
		};
	}, [stopStreaming]);

	const hasMessages = messages.length > 0;

	return (
		<div style={viewStyle}>
			{/* Header with New Chat button */}
			{hasMessages ? (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "8px 16px",
						borderBottom: "1px solid var(--color-border, var(--ds-border, #a6c5e229))",
					}}
				>
					<span
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--color-text, var(--ds-text, #b6c2cf))",
						}}
					>
						Tool Invocation
					</span>
					<button
						type="button"
						onClick={resetChat}
						disabled={isActive}
						style={{
							padding: "4px 12px",
							borderRadius: 6,
							border: "1px solid var(--color-border, var(--ds-border, #a6c5e229))",
							background: "var(--color-surface-raised, var(--ds-surface-raised, #22272b))",
							color: "var(--color-text, var(--ds-text, #b6c2cf))",
							fontSize: 12,
							cursor: isActive ? "not-allowed" : "pointer",
							opacity: isActive ? 0.5 : 1,
						}}
					>
						New chat
					</button>
				</div>
			) : null}

			{/* Chat stream */}
			<div ref={scrollRef} style={chatContainerStyle}>
				{!hasMessages ? (
					<div style={landingStyle}>
						<div>
							<p
								style={{
									fontSize: 18,
									fontWeight: 600,
									color: "var(--color-text, var(--ds-text, #b6c2cf))",
									marginBottom: 4,
								}}
							>
								Tool Invocation Demo
							</p>
							<p
								style={{
									fontSize: 14,
									color: "var(--color-text-subtlest, var(--ds-text-subtlest, #8c9bab))",
									maxWidth: 400,
								}}
							>
								Send a message to see real-time tool calling in action. The AI will
								use available MCP tools to respond, showing expandable parameters and
								results for each invocation.
							</p>
						</div>
						<div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
							{SUGGESTIONS.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => handleSend(s)}
									style={{
										padding: "6px 14px",
										borderRadius: 6,
										border: "1px solid var(--color-border, var(--ds-border, #a6c5e229))",
										background: "var(--color-surface-raised, var(--ds-surface-raised, #22272b))",
										color: "var(--color-text, var(--ds-text, #b6c2cf))",
										fontSize: 13,
									}}
								>
									{s}
								</button>
							))}
						</div>
					</div>
				) : (
					<>
						{messages.map((message) => (
							<RenderedMessage
								key={message.id}
								message={message}
								isStreaming={isActive && message.id === lastAssistantId}
							/>
						))}

						{/* Thinking indicator */}
						{isActive &&
						!messages.some(
							(m) =>
								m.role === "assistant" &&
								m.id === lastAssistantId &&
								(isMessageTextStreaming(m) ||
									getMessageToolParts(m).length > 0),
						) ? (
							<div style={thinkingStyle}>
								<span
									style={{
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										width: 20,
										height: 20,
									}}
								>
									<svg
										style={{
											width: 18,
											height: 18,
											animation: "tools-demo-spin 0.8s linear infinite",
										}}
										viewBox="0 0 24 24"
										fill="none"
									>
										<circle
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="3"
											strokeLinecap="round"
											strokeDasharray="50 20"
										/>
									</svg>
								</span>
								Rovo Dev is working…
							</div>
						) : null}
					</>
				)}
			</div>

			{/* Prompt input */}
			<DemoPromptInput
				onSend={handleSend}
				onCancel={handleCancel}
				isStreaming={isActive}
			/>
		</div>
	);
}
