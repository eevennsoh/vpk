"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useChat } from "@ai-sdk/react";
import { Streamdown, useIsCodeFenceIncomplete, type ExtraProps } from "streamdown";

import { createChat, getMessageText } from "@/lib/ai";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockLine,
	CodeBlockTitle,
} from "@/components/ui/code-block";
import { Message, MessageContent } from "@/components/ui/message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import { FileCodeIcon, RotateCcwIcon, TerminalIcon } from "@/components/ui/vpk-icons";

const nodeOutput = `$ node --version
v24.18.0`;

const devError = `$ pnpm dev
Error: listen EADDRINUSE: address already in use :::3000
    at Server.setupListenHandle [as _listen2] (node:net:1908:16)`;

export function CodeBlockTrace() {
	return (
		<div className="w-full max-w-md">
			<Trace>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<TerminalIcon label="" />
							</TraceIcon>
							<TraceTitle>Ran node --version</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<CodeBlock size="sm">
							<CodeBlockContent wrap className="max-h-64">
								{nodeOutput}
							</CodeBlockContent>
						</CodeBlock>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine status="error">
							<TraceIcon>
								<TerminalIcon label="" />
							</TraceIcon>
							<TraceTitle>Failed to run pnpm dev</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<CodeBlock size="sm" variant="destructive">
							<CodeBlockContent wrap className="max-h-64">
								{devError}
							</CodeBlockContent>
						</CodeBlock>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
		</div>
	);
}

const files = [
	{
		id: "route",
		title: "app/api/chat/route.ts",
		language: "ts",
		code: `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()
  const result = streamText({ model: "anthropic/claude-sonnet-4.5", messages })

  return result.toUIMessageStreamResponse()
}`,
	},
	{
		id: "chat",
		title: "components/chat.tsx",
		language: "tsx",
		code: `"use client"

import { useChat } from "@ai-sdk/react"

export function Chat() {
  const { messages } = useChat()

  return <MessageList messages={messages} />
}`,
	},
	{
		id: "env",
		title: ".env.local",
		language: "bash",
		code: "AI_GATEWAY_API_KEY=your-api-key",
	},
];

function FileCode({ code, language }: Readonly<{ code: string; language: string }>) {
	const lines = useHighlightedCode(code, language);

	return (
		<CodeBlockContent lineNumbers>
			{lines.map((line, index) => (
				<CodeBlockLine key={index}>{line}</CodeBlockLine>
			))}
		</CodeBlockContent>
	);
}

export function CodeBlockTabs() {
	return (
		<Tabs defaultValue="route" className="w-full max-w-md">
			<TabsList>
				{files.map((file) => (
					<TabsTrigger key={file.id} value={file.id}>
						{file.title.split("/").at(-1)}
					</TabsTrigger>
				))}
			</TabsList>
			{files.map((file) => (
				<TabsContent key={file.id} value={file.id}>
					<CodeBlock>
						<CodeBlockHeader>
							<CodeBlockTitle>{file.title}</CodeBlockTitle>
							<CodeBlockActions>
								<CodeBlockCopyButton value={file.code} />
							</CodeBlockActions>
						</CodeBlockHeader>
						<FileCode code={file.code} language={file.language} />
					</CodeBlock>
				</TabsContent>
			))}
		</Tabs>
	);
}

const routeCode = `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    messages,
  })

  return result.toUIMessageStreamResponse()
}`;

export function CodeBlockChat() {
	const lines = useHighlightedCode(routeCode, "ts");

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Message align="end">
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>How do I stream a response?</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent className="gap-3">
					<p>Create a route handler that returns the stream:</p>
					<CodeBlock>
						<CodeBlockHeader>
							<CodeBlockTitle>app/api/chat/route.ts</CodeBlockTitle>
							<CodeBlockActions>
								<CodeBlockCopyButton value={routeCode} />
							</CodeBlockActions>
						</CodeBlockHeader>
						<CodeBlockContent>
							{lines.map((line, index) => (
								<CodeBlockLine key={index}>{line}</CodeBlockLine>
							))}
						</CodeBlockContent>
					</CodeBlock>
					<p>The client reads it with useChat.</p>
				</MessageContent>
			</Message>
		</div>
	);
}

const shortRouteCode = `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()
  const result = streamText({ model: "anthropic/claude-sonnet-4.5", messages })

  return result.toUIMessageStreamResponse()
}`;

export function CodeBlockTypeset() {
	const lines = useHighlightedCode(shortRouteCode, "ts");

	return (
		<div className="typeset w-full max-w-md">
			<h3>Stream a response</h3>
			<p>
				Create a route handler that calls <code>streamText</code> and returns the stream to the client.
			</p>
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<FileCodeIcon label="" />
						app/api/chat/route.ts
					</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={shortRouteCode} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent lineNumbers>
					{lines.map((line, index) => (
						<CodeBlockLine key={index}>{line}</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
			<p>
				The <code>useChat</code> hook reads the stream on the client and renders the answer while it is written.
			</p>
		</div>
	);
}

// shadcn's docs pick the language with a site-level useTranslation hook; VPK
// has none, so the demo renders the Arabic copy that hook defaults to.
const translations = {
	en: {
		dir: "ltr",
		values: {
			description: "Install the packages, then start the dev server.",
			title: "Terminal",
		},
	},
	ar: {
		dir: "rtl",
		values: {
			description: "ثبّت الحزم، ثم شغّل خادم التطوير.",
			title: "الطرفية",
		},
	},
	he: {
		dir: "rtl",
		values: {
			description: "התקן את החבילות, ואז הפעל את שרת הפיתוח.",
			title: "מסוף",
		},
	},
} as const;

const rtlCode = `pnpm add ai @ai-sdk/react zod
pnpm dev`;

export function CodeBlockRtl() {
	const { dir, values: t } = translations.ar;
	const lines = useHighlightedCode(rtlCode, "bash");

	return (
		<div className="flex w-full max-w-md flex-col gap-3 text-sm" dir={dir}>
			<p>{t.description}</p>
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<TerminalIcon label="" />
						{t.title}
					</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={rtlCode} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent lineNumbers>
					{lines.map((line, index) => (
						<CodeBlockLine key={index}>{line}</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const weatherJson = `{
  "location": "San Francisco",
  "temperature": 18,
  "unit": "celsius",
  "conditions": ["fog", "wind"]
}`;

export function CodeBlockHighlighting() {
	const lines = useHighlightedCode(weatherJson, "json");

	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>getWeather output</CodeBlockTitle>
				</CodeBlockHeader>
				<CodeBlockContent>
					{lines.map((line, index) => (
						<CodeBlockLine key={index}>{line}</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const samples = [
	{
		language: "css",
		title: "app/globals.css",
		code: `@import "tailwindcss";

:root {
  --radius: 0.625rem;
}`,
	},
	{
		language: "python",
		title: "main.py",
		code: `def greet(name: str) -> str:
    return f"Hello, {name}!"`,
	},
	{
		language: "text",
		title: "notes.txt",
		code: "A language that is not in the list renders as plain text.",
	},
];

function Sample({ code, language }: Readonly<{ code: string; language: string }>) {
	const lines = useHighlightedCode(code, language);

	return (
		<CodeBlockContent>
			{lines.map((line, index) => (
				<CodeBlockLine key={index}>{line}</CodeBlockLine>
			))}
		</CodeBlockContent>
	);
}

export function CodeBlockLanguages() {
	return (
		<div className="flex w-full max-w-md flex-col gap-4">
			{samples.map((sample) => (
				<CodeBlock key={sample.language}>
					<CodeBlockHeader>
						<CodeBlockTitle>{sample.title}</CodeBlockTitle>
					</CodeBlockHeader>
					<Sample code={sample.code} language={sample.language} />
				</CodeBlock>
			))}
		</div>
	);
}

const testOutput = `$ pnpm test
\x1b[32m✓\x1b[39m src/format.test.ts \x1b[2m(4 tests)\x1b[22m
\x1b[32m✓\x1b[39m src/parse.test.ts \x1b[2m(7 tests)\x1b[22m
\x1b[31m✗\x1b[39m src/stream.test.ts \x1b[2m(3 tests | 1 failed)\x1b[22m

\x1b[31mAssertionError: expected 'hello' to be 'hello world'\x1b[39m

Tests  \x1b[31m1 failed\x1b[39m | \x1b[32m13 passed\x1b[39m (14)`;

const ansiPattern = /\x1b\[[\d;]*m/g;

export function CodeBlockAnsi() {
	const lines = useHighlightedCode(testOutput, "ansi");

	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<TerminalIcon label="" />
						Terminal
					</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={testOutput.replace(ansiPattern, "")} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent wrap>
					{lines.map((line, index) => (
						<CodeBlockLine key={index}>{line}</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const blocks: {
	title?: string;
	language: string;
	code: string;
	lineNumbers?: boolean;
	highlight?: number[];
	diff?: boolean;
}[] = [
	{
		title: "hooks/use-debounce.ts",
		language: "ts",
		lineNumbers: true,
		code: `export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}`,
	},
	{
		language: "bash",
		code: "pnpm dlx shadcn@latest add code-block",
	},
	{
		title: "components/search.tsx",
		language: "tsx",
		lineNumbers: true,
		diff: true,
		code: ` export function Search() {
   const [query, setQuery] = React.useState("")
-  const results = useSearch(query)
+  const debounced = useDebounce(query, 300)
+  const results = useSearch(debounced)

   return <SearchResults results={results} />
 }`,
	},
	{
		title: "app/api/chat/route.ts",
		language: "ts",
		lineNumbers: true,
		highlight: [5, 6, 7, 8],
		code: `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    messages,
  })

  return result.toUIMessageStreamResponse()
}`,
	},
	{
		title: ".env.local",
		language: "bash",
		code: "AI_GATEWAY_API_KEY=your-api-key",
	},
];

// Where each block starts in the stream.
const offsets = blocks.map((_, index) =>
	blocks.slice(0, index).reduce((total, block) => total + block.code.length, 0),
);
const total = blocks.reduce((sum, block) => sum + block.code.length, 0);

function getStreamingVariant(block: (typeof blocks)[number], row: string | undefined, index: number) {
	if (block.diff) {
		if (row?.startsWith("+")) {
			return "added";
		}

		return row?.startsWith("-") ? "removed" : "default";
	}

	return block.highlight?.includes(index) ? "highlighted" : "default";
}

function StreamingBlock({ block, code }: Readonly<{ block: (typeof blocks)[number]; code: string }>) {
	const rows = code.split("\n");
	// A diff row starts with +, - or a space. The marker is not part of the code.
	const source = block.diff ? rows.map((row) => row.slice(1)).join("\n") : code;
	const lines = useHighlightedCode(source, block.language);

	return (
		<CodeBlock>
			{block.title ? (
				<CodeBlockHeader>
					<CodeBlockTitle>{block.title}</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={source} disabled={code.length < block.code.length} />
					</CodeBlockActions>
				</CodeBlockHeader>
			) : null}
			<CodeBlockContent lineNumbers={block.lineNumbers}>
				{lines.map((line, index) => (
					<CodeBlockLine key={index} variant={getStreamingVariant(block, rows[index], index)}>
						{line}
					</CodeBlockLine>
				))}
			</CodeBlockContent>
		</CodeBlock>
	);
}

export function CodeBlockStreaming() {
	const [length, setLength] = useState(total);

	useEffect(() => {
		if (length >= total) {
			return;
		}

		const timeout = setTimeout(() => setLength((prev) => prev + 3), 16);
		return () => clearTimeout(timeout);
	}, [length]);

	return (
		<div className="flex w-full max-w-md flex-col gap-4">
			{blocks.map((block, index) =>
				length > offsets[index] ? (
					<StreamingBlock key={block.code} block={block} code={block.code.slice(0, length - offsets[index])} />
				) : null,
			)}
			<Button variant="outline" className="self-start" disabled={length < total} onClick={() => setLength(0)}>
				<RotateCcwIcon label="" />
				Replay
			</Button>
		</div>
	);
}

const response = `Wrap the value in a \`useDebounce\` hook. It returns the latest value once it stops changing for \`delay\` milliseconds.

\`\`\`tsx
export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}
\`\`\`

Pass the debounced value to your fetch instead of the raw input.`;

const chat = createChat()
	.user("How do I debounce a search input in React?")
	.assistant(({ writer }) => {
		writer.text(response);
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 30 });

function MarkdownCodeBlock({ code, language }: Readonly<{ code: string; language: string }>) {
	// True while the closing fence has not arrived yet.
	const incomplete = useIsCodeFenceIncomplete();
	const lines = useHighlightedCode(code, language);

	return (
		<CodeBlock>
			<CodeBlockHeader>
				<CodeBlockTitle>{language || "text"}</CodeBlockTitle>
				<CodeBlockActions>
					<CodeBlockCopyButton value={code} disabled={incomplete} />
				</CodeBlockActions>
			</CodeBlockHeader>
			<CodeBlockContent>
				{lines.map((line, index) => (
					<CodeBlockLine key={index}>{line}</CodeBlockLine>
				))}
			</CodeBlockContent>
		</CodeBlock>
	);
}

function MarkdownCode({ node: _node, className, children, ...props }: ComponentProps<"code"> & ExtraProps) {
	// Streamdown marks fenced code with data-block. Everything else is inline.
	if (!("data-block" in props)) {
		return (
			<code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]" {...props}>
				{children}
			</code>
		);
	}

	return (
		<MarkdownCodeBlock
			code={typeof children === "string" ? children : ""}
			language={/language-(\S+)/.exec(className ?? "")?.[1] ?? ""}
		/>
	);
}

const components = { code: MarkdownCode };

export function CodeBlockMarkdown() {
	const { messages, sendMessage, setMessages, status } = useChat({
		messages: transcript,
		transport,
	});
	const busy = status === "submitted" || status === "streaming";

	return (
		<div className="flex min-h-112 w-full max-w-md flex-col gap-4 py-6 text-sm">
			{messages.map((message) =>
				message.role === "user" ? (
					<Message key={message.id} align="end">
						<MessageContent>
							<Bubble align="end">
								<BubbleContent>{getMessageText(message)}</BubbleContent>
							</Bubble>
						</MessageContent>
					</Message>
				) : (
					<Message key={message.id}>
						<MessageContent>
							<Streamdown
								controls={false}
								components={components}
								isAnimating={busy && message === messages.at(-1)}
							>
								{getMessageText(message)}
							</Streamdown>
						</MessageContent>
					</Message>
				),
			)}
			{busy ? null : (
				<Button
					variant="outline"
					className="mt-auto self-start"
					onClick={() => {
						setMessages([]);
						void sendMessage(question);
					}}
				>
					Replay
				</Button>
			)}
		</div>
	);
}
