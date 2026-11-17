"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@/components/ui/code-block";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import {
	ArrowUpRightIcon,
	BrainIcon,
	ChevronRightIcon,
	CircleAlertIcon,
	CircleCheckIcon,
	CircleIcon,
	FilePenIcon,
	FilePlusIcon,
	FileTextIcon,
	FolderSearchIcon,
	GitBranchIcon,
	GitCommitIcon,
	GlobeIcon,
	LoaderCircleIcon,
	SearchIcon,
	TerminalIcon,
} from "@/components/ui/vpk-icons";

export { default } from "./trace-demo-chat";

export function TraceStatic() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<GitBranchIcon label="" />
				</TraceIcon>
				<TraceTitle>Created branch fix/frozen-lockfile</TraceTitle>
			</TraceLine>
		</Trace>
	);
}

export function TraceStatus() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<CircleCheckIcon label="" />
				</TraceIcon>
				<TraceTitle>Ran pnpm install</TraceTitle>
			</TraceLine>
			<TraceLine status="error">
				<TraceIcon>
					<CircleAlertIcon label="" />
				</TraceIcon>
				<TraceTitle>Failed to run pnpm lint</TraceTitle>
			</TraceLine>
			<TraceLine status="running">
				<TraceIcon>
					<LoaderCircleIcon label="" className="animate-spin" />
				</TraceIcon>
				<TraceTitle>Running pnpm build</TraceTitle>
			</TraceLine>
			<TraceLine status="pending">
				<TraceIcon>
					<CircleIcon label="" />
				</TraceIcon>
				<TraceTitle>Run pnpm test</TraceTitle>
			</TraceLine>
		</Trace>
	);
}

export function TraceDescriptionDemo() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<FilePenIcon label="" />
				</TraceIcon>
				<TraceTitle>Edited components/settings/notification-preferences-form.tsx</TraceTitle>
				<TraceDescription className="font-mono">+48 −12</TraceDescription>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<TerminalIcon label="" />
				</TraceIcon>
				<TraceTitle>Ran pnpm test</TraceTitle>
				<TraceDescription>14s</TraceDescription>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<SearchIcon label="" />
				</TraceIcon>
				<TraceTitle>Searched for useChat</TraceTitle>
				<TraceDescription>8 results</TraceDescription>
			</TraceLine>
		</Trace>
	);
}

export function TraceCollapsibleDemo() {
	return (
		<div className="w-full max-w-sm">
			<TraceCollapsible>
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
							{"$ node --version\nv24.18.0"}
						</CodeBlockContent>
					</CodeBlock>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</div>
	);
}

export function TraceOpen() {
	const [open, setOpen] = useState(false);

	return (
		<div className="flex w-full max-w-sm flex-col items-start gap-4">
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
							{"$ node --version\nv24.18.0"}
						</CodeBlockContent>
					</CodeBlock>
				</TraceCollapsibleContent>
			</TraceCollapsible>
			<TraceCollapsible open={open} onOpenChange={setOpen}>
				<TraceCollapsibleTrigger>
					<TraceLine>
						<TraceIcon>
							<TerminalIcon label="" />
						</TraceIcon>
						<TraceTitle>Ran pnpm --version</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<CodeBlock size="sm">
						<CodeBlockContent wrap className="max-h-64">
							{"$ pnpm --version\n10.33.4"}
						</CodeBlockContent>
					</CodeBlock>
				</TraceCollapsibleContent>
			</TraceCollapsible>
			<Button variant="outline" onClick={() => setOpen((prev) => !prev)}>
				{open ? "Hide" : "Show"} the pnpm output
			</Button>
		</div>
	);
}

export function TraceLink() {
	return (
		<Trace className="max-w-sm">
			<a href="#link">
				<TraceLine>
					<TraceIcon>
						<FileTextIcon label="" />
					</TraceIcon>
					<TraceTitle>Read apps/v4/lib/docs.ts</TraceTitle>
					<TraceIcon>
						<ChevronRightIcon label="" />
					</TraceIcon>
				</TraceLine>
			</a>
			<a href="https://docs.astro.build/en/install-and-setup/" target="_blank" rel="noreferrer">
				<TraceLine>
					<TraceIcon>
						<GlobeIcon label="" />
					</TraceIcon>
					<TraceTitle>
						Install Astro | docs.astro.build
						<span className="sr-only"> (opens in a new tab)</span>
					</TraceTitle>
					<TraceIcon>
						<ArrowUpRightIcon label="" />
					</TraceIcon>
				</TraceLine>
			</a>
		</Trace>
	);
}

const results = [
	{
		title: "Caching build outputs",
		url: "https://nextjs.org/docs/app/guides/caching",
	},
	{
		title: "Image optimization reference",
		url: "https://nextjs.org/docs/app/api-reference/components/image",
	},
	{
		title: "Deploy hooks and cache keys",
		url: "https://vercel.com/docs/deploy-hooks",
	},
];

export function TraceDialog() {
	return (
		<Trace className="max-w-sm">
			<Dialog>
				<DialogTrigger>
					<TraceLine>
						<TraceIcon>
							<GlobeIcon label="" />
						</TraceIcon>
						<TraceTitle>Searched the web for cache keys</TraceTitle>
						<TraceIcon>
							<ChevronRightIcon label="" />
						</TraceIcon>
					</TraceLine>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Searched the web for cache keys</DialogTitle>
						<DialogDescription>Three results were used in the response.</DialogDescription>
					</DialogHeader>
					<Trace>
						{results.map((result) => (
							<a key={result.url} href={result.url} target="_blank" rel="noreferrer">
								<TraceLine>
									<TraceIcon>
										<GlobeIcon label="" />
									</TraceIcon>
									<TraceTitle>
										{result.title}
										<span className="sr-only"> (opens in a new tab)</span>
									</TraceTitle>
									<TraceIcon>
										<ArrowUpRightIcon label="" />
									</TraceIcon>
								</TraceLine>
							</a>
						))}
					</Trace>
				</DialogContent>
			</Dialog>
		</Trace>
	);
}

export function TraceSheet() {
	return (
		<Trace className="max-w-sm">
			<Sheet>
				<SheetTrigger>
					<TraceLine>
						<TraceIcon>
							<FolderSearchIcon label="" />
						</TraceIcon>
						<TraceTitle>Explored 4 files</TraceTitle>
						<TraceIcon>
							<ChevronRightIcon label="" />
						</TraceIcon>
					</TraceLine>
				</SheetTrigger>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Explored 4 files</SheetTitle>
						<SheetDescription>Files read while preparing the response.</SheetDescription>
					</SheetHeader>
					<ul className="flex flex-col gap-2 px-6 font-mono text-xs">
						<li>apps/v4/lib/docs.ts</li>
						<li>apps/v4/lib/components.ts</li>
						<li>apps/v4/next.config.mjs</li>
						<li>apps/v4/package.json</li>
					</ul>
				</SheetContent>
			</Sheet>
		</Trace>
	);
}

export function TraceGroupDemo() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<SearchIcon label="" />
				</TraceIcon>
				<TraceTitle>Searched for minimumReleaseAge</TraceTitle>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<FileTextIcon label="" />
				</TraceIcon>
				<TraceTitle>Read pnpm-workspace.yaml</TraceTitle>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<TerminalIcon label="" />
				</TraceIcon>
				<TraceTitle>Ran pnpm install</TraceTitle>
			</TraceLine>
		</Trace>
	);
}

const sources = [
	{
		title: "Install Astro | docs.astro.build",
		href: "https://docs.astro.build/en/install-and-setup/",
	},
	{
		title: "create-astro | npmjs.com",
		href: "https://www.npmjs.com/package/create-astro",
	},
	{
		title: "Settings: minimumReleaseAge | pnpm.io",
		href: "https://pnpm.io/settings#minimumreleaseage",
	},
];

export function TraceSources() {
	return (
		<div className="w-full max-w-sm">
			<TraceCollapsible defaultOpen>
				<TraceCollapsibleTrigger>
					<TraceLine>
						<TraceIcon>
							<GlobeIcon label="" />
						</TraceIcon>
						<TraceTitle>Used {sources.length} sources</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<Trace>
						{sources.map((source) => (
							<a key={source.href} href={source.href} target="_blank" rel="noreferrer">
								<TraceLine>
									<TraceIcon>
										<GlobeIcon label="" />
									</TraceIcon>
									<TraceTitle>
										{source.title}
										<span className="sr-only"> (opens in a new tab)</span>
									</TraceTitle>
									<TraceIcon>
										<ArrowUpRightIcon label="" />
									</TraceIcon>
								</TraceLine>
							</a>
						))}
					</Trace>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</div>
	);
}

export function TraceSteps() {
	return (
		<div className="w-full max-w-sm">
			<TraceCollapsible defaultOpen>
				<TraceCollapsibleTrigger>
					<TraceLine status="running">
						<TraceTitle>Looking into the slow deploy</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent keepMounted>
					<Trace>
						<TraceCollapsible>
							<TraceCollapsibleTrigger>
								<TraceLine>
									<TraceIcon>
										<SearchIcon label="" />
									</TraceIcon>
									<TraceTitle>Searched for the checkout build log</TraceTitle>
								</TraceLine>
							</TraceCollapsibleTrigger>
							<TraceCollapsibleContent className="flex flex-wrap gap-1.5">
								<Badge variant="neutral">vercel.com</Badge>
								<Badge variant="neutral">github.com</Badge>
							</TraceCollapsibleContent>
						</TraceCollapsible>
						<a href="#steps">
							<TraceLine>
								<TraceIcon>
									<FileTextIcon label="" />
								</TraceIcon>
								<TraceTitle>Read the last twelve deploys</TraceTitle>
								<TraceIcon>
									<ChevronRightIcon label="" />
								</TraceIcon>
							</TraceLine>
						</a>
						<TraceCollapsible>
							<TraceCollapsibleTrigger>
								<TraceLine status="running">
									<TraceIcon>
										<SearchIcon label="" />
									</TraceIcon>
									<TraceTitle>Searching for the cache key</TraceTitle>
								</TraceLine>
							</TraceCollapsibleTrigger>
							<TraceCollapsibleContent>
								<CodeBlock size="sm">
									<CodeBlockContent wrap className="max-h-64">
										cache key image optimization
									</CodeBlockContent>
								</CodeBlock>
							</TraceCollapsibleContent>
						</TraceCollapsible>
					</Trace>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</div>
	);
}

const commitFiles = [
	{
		path: "app/login/page.tsx",
		added: false,
		additions: 2,
		deletions: 2,
		diff: `@@ -14,7 +14,7 @@ export async function LoginPage({
   searchParams,
 }) {
   const { next } = await searchParams
-  const redirectTo =
-    next && next.startsWith("/") ? next : "/"
+  const redirectTo = safeRedirect(next)
+
   return <LoginForm redirectTo={redirectTo} />
 }`,
	},
	{
		path: "lib/auth/redirect.ts",
		added: true,
		additions: 7,
		deletions: 0,
		diff: `@@ -0,0 +1,7 @@
+export function safeRedirect(next: string | undefined) {
+  if (!next || !next.startsWith("/") || next.startsWith("//")) {
+    return "/"
+  }
+
+  return next
+}`,
	},
];

function getDiffVariant(line: string) {
	if (line.startsWith("+")) {
		return "added";
	}

	return line.startsWith("-") ? "removed" : "default";
}

function DiffLines({ diff }: Readonly<{ diff: string }>) {
	return diff.split("\n").map((line, index) => {
		if (line.startsWith("@@")) {
			return (
				<CodeBlockLine key={index} className="text-muted-foreground">
					{line}
				</CodeBlockLine>
			);
		}

		return (
			<CodeBlockLine key={index} variant={getDiffVariant(line)}>
				{line.slice(1)}
			</CodeBlockLine>
		);
	});
}

export function TraceCommit() {
	return (
		<Trace className="max-w-sm">
			<TraceCollapsible defaultOpen>
				<TraceCollapsibleTrigger>
					<TraceLine>
						<TraceIcon>
							<GitCommitIcon label="" />
						</TraceIcon>
						<TraceTitle>Committed a1b2c3: Fix the login redirect</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<Trace>
						{commitFiles.map((file) => (
							<Sheet key={file.path}>
								<SheetTrigger>
									<TraceLine>
										<TraceIcon>{file.added ? <FilePlusIcon label="" /> : <FilePenIcon label="" />}</TraceIcon>
										<TraceTitle>
											{file.added ? "Added" : "Edited"} {file.path}
										</TraceTitle>
										<TraceDescription className="font-mono">
											+{file.additions} −{file.deletions}
										</TraceDescription>
										<TraceIcon>
											<ChevronRightIcon label="" />
										</TraceIcon>
									</TraceLine>
								</SheetTrigger>
								<SheetContent>
									<SheetHeader>
										<SheetTitle className="font-mono">{file.path}</SheetTitle>
										<SheetDescription>
											{file.additions} additions, {file.deletions} deletions
										</SheetDescription>
									</SheetHeader>
									<CodeBlock className="mx-6 mb-6 w-auto">
										<CodeBlockContent>
											<DiffLines diff={file.diff} />
										</CodeBlockContent>
									</CodeBlock>
								</SheetContent>
							</Sheet>
						))}
					</Trace>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</Trace>
	);
}

export function TraceTurn() {
	return (
		<div className="w-full max-w-sm">
			<TraceCollapsible defaultOpen>
				<TraceCollapsibleTrigger>
					<TraceLine status="error">
						<TraceTitle>Worked for 2m 4s, 1 command failed</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent keepMounted className="flex flex-col gap-2">
					<Trace>
						<TraceCollapsible>
							<TraceCollapsibleTrigger>
								<TraceLine>
									<TraceIcon>
										<BrainIcon label="" />
									</TraceIcon>
									<TraceTitle>Thought</TraceTitle>
									<TraceDescription>12s</TraceDescription>
								</TraceLine>
							</TraceCollapsibleTrigger>
							<TraceCollapsibleContent className="whitespace-pre-wrap">
								I should check which package managers are installed before I scaffold anything.
							</TraceCollapsibleContent>
						</TraceCollapsible>
						<TraceCollapsible defaultOpen>
							<TraceCollapsibleTrigger>
								<TraceLine status="error">
									<TraceIcon>
										<TerminalIcon label="" />
									</TraceIcon>
									<TraceTitle>Ran 2 commands, 1 failed</TraceTitle>
								</TraceLine>
							</TraceCollapsibleTrigger>
							<TraceCollapsibleContent keepMounted>
								<Trace>
									<TraceLine>
										<TraceIcon>
											<TerminalIcon label="" />
										</TraceIcon>
										<TraceTitle>Ran node --version</TraceTitle>
									</TraceLine>
									<TraceCollapsible>
										<TraceCollapsibleTrigger>
											<TraceLine status="error">
												<TraceIcon>
													<TerminalIcon label="" />
												</TraceIcon>
												<TraceTitle>Failed to run pnpm --version</TraceTitle>
											</TraceLine>
										</TraceCollapsibleTrigger>
										<TraceCollapsibleContent>
											<CodeBlock size="sm" variant="destructive">
												<CodeBlockContent wrap className="max-h-64">
													command not found: pnpm
												</CodeBlockContent>
											</CodeBlock>
										</TraceCollapsibleContent>
									</TraceCollapsible>
								</Trace>
							</TraceCollapsibleContent>
						</TraceCollapsible>
					</Trace>
					<p>Node is installed and pnpm is not. Reading the docs config.</p>
					<Trace>
						<a href="#turn">
							<TraceLine>
								<TraceIcon>
									<FileTextIcon label="" />
								</TraceIcon>
								<TraceTitle>Read apps/v4/lib/docs.ts</TraceTitle>
								<TraceIcon>
									<ChevronRightIcon label="" />
								</TraceIcon>
							</TraceLine>
						</a>
					</Trace>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		</div>
	);
}
