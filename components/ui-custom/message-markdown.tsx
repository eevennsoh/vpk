"use client";

/* eslint-disable @next/next/no-img-element -- MarkdownImage renders arbitrary markdown image payloads where Next Image sizing/loading would change the rendering contract. */

import type {
	ComponentProps,
	MouseEvent,
	ReactElement,
	ReactNode,
} from "react";
import { Children, cloneElement, Fragment, isValidElement, memo, use } from "react";
import type { BundledLanguage } from "shiki";
import type { ExtraProps, LinkSafetyConfig } from "streamdown";
import { Streamdown, StreamdownContext } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code as baseCodePlugin } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
	CodeBlockFilename,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@/components/ui-custom/code-block";
import { resolveImageRenderSrc } from "@/lib/image-proxy";
import { cn } from "@/lib/utils";

const linkSafetyConfig: LinkSafetyConfig = {
	enabled: true,
	onLinkCheck: () => true,
};

export type MessageResponseProps = ComponentProps<typeof Streamdown> & {
	/**
	 * Opt out of the baked-in typeset typography container. Use for flat
	 * surfaces (e.g. single-line user bubbles) that should inherit ambient
	 * text styles instead of the prose hierarchy.
	 */
	plain?: boolean;
};

/**
 * Wraps the Shiki code plugin to skip languages not in the Shiki bundle.
 * Without this, languages like "spec" (used by GenUI) cause a ShikiError
 * when Shiki tries to create a highlighter for an unknown language.
 */
const safeCodePlugin: typeof baseCodePlugin = {
	...baseCodePlugin,
	highlight(options, callback) {
		if (!baseCodePlugin.supportsLanguage(options.language)) {
			return null;
		}
		return baseCodePlugin.highlight(options, callback);
	},
};

// react-doctor-disable-next-line react-doctor/only-export-components -- This module intentionally exports colocated non-component API used by consumers.
export const streamdownPlugins = { cjk, code: safeCodePlugin, math, mermaid };

const inlineStreamTags = new Set([
	"a",
	"abbr",
	"acronym",
	"b",
	"bdi",
	"bdo",
	"br",
	"cite",
	"code",
	"data",
	"del",
	"em",
	"i",
	"kbd",
	"mark",
	"q",
	"rp",
	"rt",
	"ruby",
	"s",
	"samp",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"time",
	"u",
	"var",
	"img",
]);

function hasBlockMarkdownContent(children: ReactNode): boolean {
	return Children.toArray(children).some((child) => {
		if (
			child === null ||
			child === undefined ||
			typeof child === "boolean" ||
			typeof child === "string" ||
			typeof child === "number"
		) {
			return false;
		}

		if (!isValidElement(child)) {
			return false;
		}

		const element = child as ReactElement<{ children?: ReactNode }>;

		if (element.type === Fragment) {
			return hasBlockMarkdownContent(element.props.children);
		}

		if (typeof element.type === "string") {
			return !inlineStreamTags.has(element.type);
		}

		return true;
	});
}

type MarkdownParagraphProps = ComponentProps<"p"> & { node?: unknown };

function MarkdownParagraph({
	children,
	className,
	...props
}: Readonly<MarkdownParagraphProps>) {
	const { node, ...htmlProps } = props;
	void node;
	void className;

	const blockContent = hasBlockMarkdownContent(children);

	const Element = blockContent ? "div" : "p";

	return (
		<Element {...htmlProps}>
			{children}
		</Element>
	);
}

type MarkdownImageProps = ComponentProps<"img"> & { node?: unknown };
type MarkdownAnchorProps = ComponentProps<"a"> & { node?: unknown };

type MarkdownInlineCodeProps = ComponentProps<"code"> & { node?: unknown };

type MarkdownCodeBlockProps = ComponentProps<"code"> & ExtraProps;

const CODE_LANGUAGE_PATTERN = /language-([^\s]+)/u;
const CODE_TITLE_PATTERN =
	/(?:^|\s)(?:title|filename)=["']([^"']+)["']/u;
const CODE_NO_LINE_NUMBERS_PATTERN = /(?:^|\s)noLineNumbers(?:\s|$)/u;
const INLINE_CODE_BACKTICK_PATTERN = /`+/gu;
type StreamdownCodeLanguage = Parameters<typeof safeCodePlugin.supportsLanguage>[0];

const getCodeFenceLanguage = (className?: string) => {
	const match = className?.match(CODE_LANGUAGE_PATTERN);
	return match?.[1]?.toLowerCase() ?? "text";
};

const getCodeFenceTitle = (meta?: string) => {
	const match = meta?.match(CODE_TITLE_PATTERN);
	return match?.[1];
};

const getCodeFenceMeta = (node?: MarkdownCodeBlockProps["node"]) => {
	const metastring = node?.properties?.metastring;
	return typeof metastring === "string" ? metastring : undefined;
};

const getInlineCodeText = (children: ReactNode) =>
	Children.toArray(children)
		.map((child) => {
			if (typeof child === "string" || typeof child === "number") {
				return String(child);
			}

			return "";
		})
		.join("");

const getInlineCodeFence = (content: string) => {
	let longestBacktickRun = 0;

	for (const match of content.matchAll(INLINE_CODE_BACKTICK_PATTERN)) {
		longestBacktickRun = Math.max(longestBacktickRun, match[0].length);
	}

	return "`".repeat(longestBacktickRun + 1);
};

const toBundledLanguage = (language: string): BundledLanguage =>
	safeCodePlugin.supportsLanguage(language as StreamdownCodeLanguage)
		? (language as BundledLanguage)
		: "markdown";

function MarkdownInlineCode({
	children,
	className,
	node,
	...props
}: Readonly<MarkdownInlineCodeProps>) {
	void node;
	const { isAnimating, mode } = use(StreamdownContext);
	const isStreamingInlineCode = mode === "streaming" && isAnimating;

	if (isStreamingInlineCode) {
		const inlineCodeText = getInlineCodeText(children);
		const inlineCodeFence = getInlineCodeFence(inlineCodeText);

		return (
			<code
				className={cn(
					"rounded-none bg-transparent px-0 py-0 font-mono text-inherit",
					className,
				)}
				data-inline-code-state="streaming"
				{...props}
			>
				{inlineCodeFence}{children}{inlineCodeFence}
			</code>
		);
	}

	return (
		<code
			className={cn(
				"rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
				className,
			)}
			data-inline-code-state="complete"
			{...props}
		>
			{children}
		</code>
	);
}

function MarkdownCodeBlock({
	children,
	className,
	node,
	...props
}: Readonly<MarkdownCodeBlockProps>) {
	const code = typeof children === "string" ? children : "";
	const rawLanguage = getCodeFenceLanguage(className);
	const meta = getCodeFenceMeta(node);

	if (rawLanguage === "mermaid" || rawLanguage === "mmd") {
		const mermaidMarkdown = ["```mermaid", code.trim(), "```"].join("\n");

		return (
			<Streamdown
				className="not-typeset text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_[data-streamdown=mermaid-block]]:overflow-hidden [&_p]:m-0"
				components={{
					img: MarkdownImage,
					inlineCode: MarkdownInlineCode,
					p: MarkdownParagraph,
				}}
				controls
				linkSafety={linkSafetyConfig}
				mode="static"
				plugins={streamdownPlugins}
			>
				{mermaidMarkdown}
			</Streamdown>
		);
	}

	const language = toBundledLanguage(rawLanguage);
	const title = getCodeFenceTitle(meta) ?? rawLanguage;
	const showLineNumbers = meta ? !CODE_NO_LINE_NUMBERS_PATTERN.test(meta) : true;

	return (
		<CodeBlock
			className="not-typeset"
			code={code}
			language={language}
			showLineNumbers={showLineNumbers}
			{...props}
		>
			<CodeBlockHeader>
				<CodeBlockTitle>
					<CodeBlockFilename>{title}</CodeBlockFilename>
				</CodeBlockTitle>
				<CodeBlockActions>
					<CodeBlockDownloadButton />
					<CodeBlockCopyButton />
				</CodeBlockActions>
			</CodeBlockHeader>
		</CodeBlock>
	);
}

function MarkdownImage({
	src,
	alt,
	className,
	node,
	...props
}: Readonly<MarkdownImageProps>) {
	void node;
	const resolvedSrc = resolveImageRenderSrc(src);
	if (!resolvedSrc) {
		return null;
	}

	return (
		<img
			{...props}
			src={resolvedSrc}
			alt={typeof alt === "string" ? alt : ""}
			loading={props.loading ?? "lazy"}
			referrerPolicy={props.referrerPolicy ?? "no-referrer"}
			className={cn("h-auto max-w-full rounded-md", className)}
		/>
	);
}

function MarkdownAnchor({
	href,
	onClick,
	node,
	className,
	...props
}: Readonly<MarkdownAnchorProps>) {
	void node;
	// Drop Streamdown's baked-in `text-primary underline` utilities and own ADS
	// text-link chrome here (blue, no underline until hover). Also backed by
	// nested `.typeset-chat & a` rules in globals.css.
	void className;
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (event.defaultPrevented || typeof href !== "string") {
			return;
		}

		const prefix = "#rovo-canvas-";
		if (!href.startsWith(prefix)) {
			return;
		}

		event.preventDefault();
		let documentId: string;
		try {
			documentId = decodeURIComponent(href.slice(prefix.length));
		} catch {
			documentId = href.slice(prefix.length);
		}

		window.dispatchEvent(new CustomEvent("rovo:open-canvas-artifact", {
			cancelable: true,
			detail: {
				documentId,
			},
		}));
	};

	return (
		<a
			aria-label={typeof props.children === "string" ? props.children : href}
			className="text-link no-underline hover:underline active:text-link-pressed"
			{...props}
			href={href}
			onClick={handleClick}
		/>
	);
}

/**
 * Renders a bare HTML element for a Streamdown block tag, stripping the `node`
 * hint and Streamdown's hardcoded utility `className`. Dropping the class lets
 * typeset's zero-specificity `:where()` rules own block typography instead of
 * losing to Streamdown's baked-in utilities.
 */
type BareElementProps = ExtraProps & {
	className?: string;
	children?: ReactNode;
};

const bareEl = (tag: string) =>
	function BareElement({
		node,
		className,
		...rest
	}: Readonly<BareElementProps>) {
		void node;
		void className;
		const Element = tag as unknown as (
			props: Readonly<BareElementProps>,
		) => ReactElement;
		return <Element {...rest} />;
	};

/**
 * Unwrap the `<pre>` that react-markdown wraps fenced code in. MarkdownCodeBlock
 * already renders a self-contained (`not-typeset`) CodeBlock, so a surviving
 * `<pre>` wrapper would be styled by typeset's `:where(pre)` rules and double-box
 * the highlighted output.
 *
 * Streamdown 2.x marks fenced (block) code by cloning the child `<code>` with
 * `data-block` from its default `pre` renderer. When `components.inlineCode` is
 * set, Streamdown routes `"data-block" in props` → `code`, else → `inlineCode`.
 * We must preserve that marker while still omitting the `<pre>` element, or
 * mermaid/fenced blocks fall through to MarkdownInlineCode (raw gray text).
 */
function MarkdownPre({ children }: Readonly<{ children?: ReactNode }>) {
	if (isValidElement(children)) {
		return cloneElement(children as ReactElement<Record<string, unknown>>, {
			"data-block": "true",
		});
	}
	return <>{children}</>;
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This module intentionally exports colocated non-component API used by consumers.
export const streamdownComponents = {
	a: MarkdownAnchor,
	code: MarkdownCodeBlock,
	inlineCode: MarkdownInlineCode,
	p: MarkdownParagraph,
	pre: MarkdownPre,
	img: MarkdownImage,
	h1: bareEl("h1"),
	h2: bareEl("h2"),
	h3: bareEl("h3"),
	h4: bareEl("h4"),
	h5: bareEl("h5"),
	h6: bareEl("h6"),
	ul: bareEl("ul"),
	ol: bareEl("ol"),
	li: bareEl("li"),
	blockquote: bareEl("blockquote"),
	hr: bareEl("hr"),
	table: bareEl("table"),
	thead: bareEl("thead"),
	tbody: bareEl("tbody"),
	tr: bareEl("tr"),
	th: bareEl("th"),
	td: bareEl("td"),
};

export const MessageResponse = memo(
	function MessageResponse({ className, plain, ...props }: Readonly<MessageResponseProps>) {
		return (
			<Streamdown
				animated={{
					animation: "blurIn",
					duration: 220,
					easing: "ease-out",
				}}
				className={cn(
					!plain && "typeset typeset-chat",
					"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_[data-streamdown=mermaid-block]]:overflow-hidden",
					className,
				)}
				mode="streaming"
				plugins={streamdownPlugins}
				components={streamdownComponents}
				linkSafety={linkSafetyConfig}
				{...props}
			/>
		);
	},
);
