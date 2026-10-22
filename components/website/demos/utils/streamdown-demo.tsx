"use client";

import { MessageResponse } from "@/components/ui-custom/message";
import { Button } from "@/components/ui/button";
import { renderLinkSafetyModal } from "@/components/ui-custom/link-safety-dialog";
import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { ComponentProps, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkSafetyConfig } from "streamdown";
import { Streamdown } from "streamdown";

const streamdownPlugins = { cjk, code, math, mermaid };

const streamdownControls = {
	code: {
		copy: true,
		download: true,
	},
	table: {
		copy: true,
		download: true,
		fullscreen: true,
	},
	mermaid: {
		copy: true,
		download: true,
		fullscreen: true,
		panZoom: true,
	},
} as const;

const demoTranslations = {
	copyCode: "Copy snippet",
	copyTable: "Copy table",
	downloadDiagram: "Export diagram",
	downloadTable: "Export table",
	openLink: "Review link",
} as const;

const linkSafetyConfig: LinkSafetyConfig = {
	enabled: true,
	onLinkCheck: () => false,
	renderModal: renderLinkSafetyModal,
};

const FEATURE_MARKDOWN = `# Streamdown Latest API Demo

This preview exercises **animated streaming**, _GFM_, ~~strikethrough~~, and an [external docs link](https://streamdown.ai/docs).

## What this page is validating

- [x] \`animated\` + \`isAnimating\` + caret rendering
- [x] Code, table, and Mermaid controls
- [x] Math via KaTeX
- [x] CJK plugin support
- [x] Link-safety modal wiring

| Capability | Status | Notes |
|:--|:--:|:--|
| Animation | ✅ | Word-by-word blur entrance |
| Code blocks | ✅ | Copy, download, line numbers |
| Mermaid | ✅ | Copy, download, fullscreen, pan/zoom |
| Tables | ✅ | Copy + download |

## Code block

\`\`\`ts
type ReleaseNote = {
	id: string;
	title: string;
	state: "draft" | "ready";
	features: string[];
};

const release: ReleaseNote = {
	id: "sd-250",
	title: "Ship latest Streamdown demo",
	state: "ready",
	features: ["animated", "lineNumbers", "linkSafety", "literalTagContent"],
};

console.log(release.features.join(", "));
\`\`\`

## Math

Inline display math: $$E = mc^2$$

$$
\\\\int_0^1 x^2\\\\,dx = \\\\frac{1}{3}
$$

## Mermaid

\`\`\`mermaid
flowchart LR
	A["Prompt"] --> B{"Streamdown"}
	B -->|"animate"| C["Word reveal"]
	B -->|"controls"| D["Copy / Download / Fullscreen"]
	B -->|"plugins"| E["Code + Math + Mermaid + CJK"]
	C --> F["Demo page"]
	D --> F
	E --> F
\`\`\`
`;

const CUSTOM_TAG_MARKDOWN = `# Custom Tags + Normalized HTML

<mention user_id="ops_primary">@ops_primary_oncall</mention>

Underscores stay literal because \`literalTagContent={["mention"]}\` prevents markdown parsing inside the custom tag.

    <div>
      <p>Indented HTML stays renderable because this example enables \`normalizeHtmlIndentation\`.</p>
    </div>
`;

const DIRECTION_MARKDOWN = `مرحبا بفريق Streamdown.

This first paragraph starts in Arabic, so \`dir="auto"\` should resolve this block to RTL.

The next paragraph starts in English, so it should resolve LTR while still keeping [external links](https://streamdown.ai/docs) behind the custom link-safety modal.
`;

const MESSAGE_RESPONSE_MARKDOWN = `The shared renderer should keep \`animated\` in literal backticks while the rest of this paragraph continues streaming forward, preventing the inline-code lozenge from punching a visual hole into the unfinished sentence while more words are still arriving from the model.`;

const STREAM_INTERVAL_MS = 24;
const STREAM_STEP_CHARS = 20;

type MentionProps = ComponentProps<"span"> & {
	node?: unknown;
	user_id?: string;
};

function Mention({
	children,
	className,
	node,
	user_id,
	...props
}: Readonly<MentionProps>) {
	void node;

	return (
		<span
			{...props}
			className={cn(
				"inline-flex items-center rounded-full border border-border/70 bg-muted px-2 py-0.5 font-medium text-foreground",
				className,
			)}
			data-user-id={user_id}
		>
			{children}
		</span>
	);
}

export default function StreamdownDemo(): ReactElement {
	const [streamedMarkdown, setStreamedMarkdown] = useState("");
	const [streamedMessageResponseMarkdown, setStreamedMessageResponseMarkdown] = useState("");
	const [isAnimating, setIsAnimating] = useState(false);
	const [lineNumbers, setLineNumbers] = useState(true);
	const [animationStarts, setAnimationStarts] = useState(0);
	const [animationEnds, setAnimationEnds] = useState(0);
	const intervalRef = useRef<number | null>(null);
	const kickoffTimeoutRef = useRef<number | null>(null);

	const stopStreaming = useCallback(() => {
		if (intervalRef.current !== null) {
			window.clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	const runStreamingDemo = useCallback(() => {
		stopStreaming();
		setStreamedMarkdown("");
		setStreamedMessageResponseMarkdown("");
		setIsAnimating(true);

		let featureCursor = 0;
		let messageResponseCursor = 0;
		intervalRef.current = window.setInterval(() => {
			featureCursor = Math.min(
				FEATURE_MARKDOWN.length,
				featureCursor + STREAM_STEP_CHARS,
			);
			messageResponseCursor = Math.min(
				MESSAGE_RESPONSE_MARKDOWN.length,
				messageResponseCursor + STREAM_STEP_CHARS,
			);
			setStreamedMarkdown(FEATURE_MARKDOWN.slice(0, featureCursor));
			setStreamedMessageResponseMarkdown(
				MESSAGE_RESPONSE_MARKDOWN.slice(0, messageResponseCursor),
			);

			if (
				featureCursor >= FEATURE_MARKDOWN.length
				&& messageResponseCursor >= MESSAGE_RESPONSE_MARKDOWN.length
			) {
				stopStreaming();
				setIsAnimating(false);
			}
		}, STREAM_INTERVAL_MS);
	}, [stopStreaming]);

	useEffect(() => {
		kickoffTimeoutRef.current = window.setTimeout(() => {
			runStreamingDemo();
		}, 80);

		return () => {
			if (kickoffTimeoutRef.current !== null) {
				window.clearTimeout(kickoffTimeoutRef.current);
				kickoffTimeoutRef.current = null;
			}

			stopStreaming();
		};
	}, [runStreamingDemo, stopStreaming]);

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
			<header className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-semibold">Streamdown Latest API Demo</h1>
					<p className="max-w-3xl text-sm text-muted-foreground">
						This page now covers the current Streamdown surface:{" "}
						<code>animated</code>, caret streaming, line numbers, link safety,
						custom HTML tags, normalized HTML indentation, and auto direction
						detection.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<Button onClick={runStreamingDemo} type="button">
						Replay
					</Button>
					<Button
						onClick={() => {
							stopStreaming();
							setIsAnimating(false);
							setStreamedMarkdown(FEATURE_MARKDOWN);
							setStreamedMessageResponseMarkdown(
								MESSAGE_RESPONSE_MARKDOWN,
							);
						}}
						type="button"
						variant="outline"
					>
						Show final state
					</Button>
					<Button
						onClick={() => {
							setLineNumbers((current) => !current);
						}}
						type="button"
						variant="outline"
					>
						{lineNumbers ? "Hide" : "Show"} line numbers
					</Button>
				</div>
			</header>

			<section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
				<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
					<span>Streaming state: {isAnimating ? "active" : "idle"}</span>
					<span>Animation starts: {animationStarts}</span>
					<span>Animation ends: {animationEnds}</span>
					<span>Line numbers: {lineNumbers ? "on" : "off"}</span>
				</div>

				<Streamdown
					animated={{
						animation: "blurIn",
						duration: 260,
						easing: "ease-out",
						sep: "word",
						stagger: 0.03,
					}}
					caret="block"
					controls={streamdownControls}
					isAnimating={isAnimating}
					lineNumbers={lineNumbers}
					linkSafety={linkSafetyConfig}
					onAnimationEnd={() => {
						setAnimationEnds((count) => count + 1);
					}}
					onAnimationStart={() => {
						setAnimationStarts((count) => count + 1);
					}}
					plugins={streamdownPlugins}
					translations={demoTranslations}
				>
					{streamedMarkdown}
				</Streamdown>
			</section>

			<section
				className="flex flex-col gap-4 rounded-xl border bg-card p-5"
				data-testid="message-response-streaming-demo"
			>
				<div className="flex flex-col gap-2">
					<h2 className="text-sm font-medium text-muted-foreground">
						Shared MessageResponse streaming harness
					</h2>
					<p className="max-w-3xl text-sm text-muted-foreground">
						This section exercises the shared assistant markdown renderer. While
						the current block is still streaming, inline code stays in literal
						backticks before settling into the final lozenge styling.
					</p>
				</div>

				<MessageResponse caret="block" isAnimating={isAnimating} lineNumbers={lineNumbers}>
					{streamedMessageResponseMarkdown}
				</MessageResponse>
			</section>

			<div className="grid gap-6 xl:grid-cols-2">
				<section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
					<div className="flex flex-col gap-3">
						<h2 className="text-sm font-medium text-muted-foreground">
							Custom tags + literal content
						</h2>
						<p className="text-sm text-muted-foreground">
							This card uses <code>allowedTags</code>,{" "}
							<code>literalTagContent</code>, and keeps{" "}
							<code>normalizeHtmlIndentation</code> enabled for AI-generated HTML
							blocks.
						</p>
					</div>
					<Streamdown
						allowedTags={{
							mention: ["user_id"],
						}}
						components={{
							mention: Mention,
						}}
						literalTagContent={["mention"]}
						mode="static"
						normalizeHtmlIndentation
						plugins={streamdownPlugins}
					>
						{CUSTOM_TAG_MARKDOWN}
					</Streamdown>
				</section>

				<section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
					<div className="flex flex-col gap-3">
						<h2 className="text-sm font-medium text-muted-foreground">
							Direction auto + link safety
						</h2>
						<p className="text-sm text-muted-foreground">
							This card uses <code>dir=&quot;auto&quot;</code> and the shared custom{" "}
							<code>linkSafety</code> modal.
						</p>
					</div>
					<Streamdown
						dir="auto"
						linkSafety={linkSafetyConfig}
						mode="static"
						plugins={streamdownPlugins}
					>
						{DIRECTION_MARKDOWN}
					</Streamdown>
				</section>
			</div>
		</main>
	);
}
