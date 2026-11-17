"use client";

import { useId, useState } from "react";

import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { Button } from "@/components/ui/button";
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockFooter,
	CodeBlockHeader,
	CodeBlockLine,
	CodeBlockTitle,
} from "@/components/ui/code-block";
import {
	ChevronDownIcon,
	DownloadIcon,
	FileCodeIcon,
	TerminalIcon,
	WrapTextIcon,
} from "@/components/ui/vpk-icons";

const mainCode = `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    system: "You are a helpful assistant. Answer in one short paragraph.",
    messages,
  })

  return result.toUIMessageStreamResponse()
}`;

function download(value: string, filename: string) {
	const url = URL.createObjectURL(new Blob([value], { type: "text/plain" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export default function CodeBlockDemo() {
	const [wrap, setWrap] = useState(false);
	const lines = useHighlightedCode(mainCode, "ts");

	return (
		<div className="w-full max-w-lg">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<FileCodeIcon label="" />
						app/api/chat/route.ts
					</CodeBlockTitle>
					<CodeBlockActions>
						<Button
							variant="ghost"
							size="icon-compact"
							aria-label="Wrap lines"
							aria-pressed={wrap}
							className="aria-pressed:text-foreground"
							onClick={() => setWrap((prev) => !prev)}
						>
							<WrapTextIcon label="" />
						</Button>
						<Button
							variant="ghost"
							size="icon-compact"
							aria-label="Download"
							onClick={() => download(mainCode, "route.ts")}
						>
							<DownloadIcon label="" />
						</Button>
						<CodeBlockCopyButton value={mainCode} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent wrap={wrap} lineNumbers>
					{lines.map((line, index) => (
						<CodeBlockLine key={index} variant={index >= 5 && index <= 9 ? "highlighted" : "default"}>
							{line}
						</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const buildOutput = `$ pnpm build
> next build

 ✓ Compiled successfully in 4.2s
 ✓ Generating static pages (12/12)

Route (app)                Size  First Load JS
┌ ○ /                    1.9 kB         112 kB
├ ○ /_not-found           993 B         103 kB
└ ƒ /api/chat             141 B         102 kB`;

export function CodeBlockBasic() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockContent>{buildOutput}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const installCommand = "pnpm add ai @ai-sdk/react zod";

const installOutput = `$ ${installCommand}
Packages: +14
Progress: resolved 412, reused 398, downloaded 14, added 14, done
Done in 2.8s using pnpm v10.18.0`;

export function CodeBlockHeaderExample() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<TerminalIcon label="" />
						Terminal
					</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={installCommand} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent>{installOutput}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const lintOutput = `$ pnpm lint
apps/web/components/message-list.tsx
  18:22  error  'messages' is possibly 'undefined'. Add a guard before calling map  @typescript-eslint/no-unsafe-call
  42:7   warning  React Hook React.useEffect has a missing dependency: 'scrollToBottom'  react-hooks/exhaustive-deps

✖ 2 problems (1 error, 1 warning)`;

export function CodeBlockActionsExample() {
	const [wrap, setWrap] = useState(true);

	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<TerminalIcon label="" />
						Terminal
					</CodeBlockTitle>
					<CodeBlockActions>
						<Button
							variant="ghost"
							size="icon-compact"
							aria-label="Wrap lines"
							aria-pressed={wrap}
							className="aria-pressed:text-foreground"
							onClick={() => setWrap((prev) => !prev)}
						>
							<WrapTextIcon label="" />
						</Button>
						<Button
							variant="ghost"
							size="icon-compact"
							aria-label="Download"
							onClick={() => download(lintOutput, "lint.log")}
						>
							<DownloadIcon label="" />
						</Button>
						<CodeBlockCopyButton value={lintOutput} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent wrap={wrap}>{lintOutput}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const addOutput = `$ pnpm add ai @ai-sdk/react zod
Progress: resolved 412, reused 398, downloaded 14, added 14, done
dependencies:
+ @ai-sdk/react 3.0.12
+ ai 6.0.12
+ zod 4.1.12
Done in 2.8s using pnpm v10.18.0`;

export function CodeBlockFloatingActions() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockActions>
					<CodeBlockCopyButton value={addOutput} />
				</CodeBlockActions>
				<CodeBlockContent>{addOutput}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const packageJson = `{
  "name": "chat",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  }
}`;

export function CodeBlockLineNumbers() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockContent lineNumbers>{packageJson}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const dashboardCode = `  if (!session) {
    redirect("/login")
  }

  const projects = await db.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
  })

  return <ProjectList projects={projects} />
}`;

export function CodeBlockStartLine() {
	const lines = useHighlightedCode(dashboardCode, "tsx");

	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>app/dashboard/page.tsx</CodeBlockTitle>
				</CodeBlockHeader>
				<CodeBlockContent lineNumbers startLine={995}>
					{lines.map((line, index) => (
						<CodeBlockLine key={index}>{line}</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const errorOutput = `Error: The model "anthropic/claude-sonnet-4.5" returned an error: Request too large. The prompt is 212,431 tokens and the context window is 200,000 tokens. Remove some messages or summarize the conversation and try again.`;

export function CodeBlockWrap() {
	return (
		<div className="flex w-full max-w-md flex-col gap-4">
			<CodeBlock>
				<CodeBlockContent>{errorOutput}</CodeBlockContent>
			</CodeBlock>
			<CodeBlock>
				<CodeBlockContent wrap>{errorOutput}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const configCode = `export {
  experimental: {
    reactCompiler: true,
    viewTransition: true,
  },
  images: {
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
}`;

const highlighted = [2, 3];

export function CodeBlockHighlightedLines() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockContent lineNumbers>
					{configCode.split("\n").map((line, index) => (
						<CodeBlockLine key={index} variant={highlighted.includes(index) ? "highlighted" : "default"}>
							{line}
						</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const patch = ` export function Greeting({ name }: { name: string }) {
-  return <p>Hello, {name}</p>
+  return <p className="text-sm text-muted-foreground">
+    Hello, {name}!
+  </p>
 }`;

function getVariant(line: string) {
	if (line.startsWith("+")) {
		return "added";
	}

	if (line.startsWith("-")) {
		return "removed";
	}

	return "default";
}

export function CodeBlockDiff() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>components/greeting.tsx</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={patch} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent>
					{patch.split("\n").map((line, index) => (
						<CodeBlockLine key={index} variant={getVariant(line)}>
							{line.slice(1)}
						</CodeBlockLine>
					))}
				</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const logs = Array.from(
	{ length: 40 },
	(_, index) => `[${String(index + 1).padStart(2, "0")}] GET /api/chat 200 in ${12 + ((index * 7) % 40)}ms`,
).join("\n");

export function CodeBlockHeight() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>Logs</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={logs} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent className="max-h-48 scroll-fade-y">{logs}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const chatCode = `"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Chat() {
  const [input, setInput] = React.useState("")
  const { messages, sendMessage, status } = useChat()

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, index) =>
            part.type === "text" ? <p key={index}>{part.text}</p> : null
          )}
        </div>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage({ text: input })
          setInput("")
        }}
      >
        <Input value={input} onChange={(event) => setInput(event.target.value)} />
        <Button disabled={status !== "ready"}>Send</Button>
      </form>
    </div>
  )
}`;

function ShowMoreBlock({
	expandedClassName,
}: Readonly<{ expandedClassName: string | undefined }>) {
	const [expanded, setExpanded] = useState(false);
	const lines = useHighlightedCode(chatCode, "tsx");
	const id = useId();

	return (
		<div className="w-full max-w-md">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>components/chat.tsx</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={chatCode} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent
					id={id}
					lineNumbers
					className={expanded ? expandedClassName : "max-h-64 scroll-fade-y overflow-y-hidden"}
				>
					{lines.map((line, index) => (
						<CodeBlockLine key={index}>{line}</CodeBlockLine>
					))}
				</CodeBlockContent>
				<CodeBlockFooter className="justify-center">
					<Button
						variant="ghost"
						size="compact"
						className="hover:bg-transparent hover:text-text active:bg-transparent aria-expanded:bg-transparent aria-expanded:hover:bg-transparent"
						aria-expanded={expanded}
						aria-controls={id}
						onClick={() => setExpanded((prev) => !prev)}
					>
						<ChevronDownIcon label="" className="transition-transform in-aria-expanded:rotate-180" />
						{expanded ? "Show less" : "Show more"}
					</Button>
				</CodeBlockFooter>
			</CodeBlock>
		</div>
	);
}

export function CodeBlockShowMore() {
	return <ShowMoreBlock expandedClassName={undefined} />;
}

export function CodeBlockShowMoreScroll() {
	return <ShowMoreBlock expandedClassName="max-h-96 scroll-fade-y" />;
}

const shortInstallOutput = `$ pnpm add ai @ai-sdk/react zod
Progress: resolved 412, reused 398, downloaded 14, added 14, done
Done in 2.8s using pnpm v10.18.0`;

export function CodeBlockSize() {
	return (
		<div className="flex w-full max-w-md flex-col gap-4">
			<CodeBlock>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<TerminalIcon label="" />
						Terminal
					</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={shortInstallOutput} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent wrap>{shortInstallOutput}</CodeBlockContent>
			</CodeBlock>
			<CodeBlock size="sm">
				<CodeBlockHeader>
					<CodeBlockTitle>
						<TerminalIcon label="" />
						Terminal
					</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={shortInstallOutput} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent wrap>{shortInstallOutput}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}

const stackTrace = `TypeError: Cannot read properties of undefined (reading 'map')
    at MessageList (components/message-list.tsx:18:22)
    at renderWithHooks (react-dom.development.js:16305:18)`;

export function CodeBlockDestructive() {
	return (
		<div className="w-full max-w-md">
			<CodeBlock variant="destructive">
				<CodeBlockHeader>
					<CodeBlockTitle>Error</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton value={stackTrace} />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent wrap>{stackTrace}</CodeBlockContent>
			</CodeBlock>
		</div>
	);
}
