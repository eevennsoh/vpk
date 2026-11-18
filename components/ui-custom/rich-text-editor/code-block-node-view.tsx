"use client";

import {
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
} from "@tiptap/react";

import { MessageResponse } from "@/components/ui-custom/message-markdown";
import { cn } from "@/lib/utils";

import {
	isMermaidCodeBlockLanguage,
	toMermaidFenceMarkdown,
} from "./code-block-language";

/**
 * TipTap CodeBlock NodeView (see tiptap CodeBlockLanguage React demo).
 * Mermaid/mmd fences reuse MessageResponse → Streamdown mermaid plugin —
 * the same path as chat markdown and the mermaid-diagram block.
 */
export function RichTextCodeBlockNodeView({
	node,
	selected,
}: Readonly<ReactNodeViewProps>) {
	const language = node.attrs.language;
	const isMermaid = isMermaidCodeBlockLanguage(language);

	if (isMermaid) {
		const mermaidMarkdown = toMermaidFenceMarkdown(node.textContent ?? "");

		return (
			<NodeViewWrapper
				as="div"
				className={cn(
					"rich-text-mermaid-block my-2",
					selected && "rich-text-mermaid-block-selected",
				)}
				data-language="mermaid"
			>
				{/*
				 * Diagram is display-only; source stays in a hidden contentDOM so
				 * ProseMirror keeps the codeBlock text for markdown round-trips.
				 * Edit the fence in Markdown view mode.
				 */}
				<div contentEditable={false} className="rich-text-mermaid-diagram">
					<MessageResponse
						plain
						mode="static"
						controls
						className="text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_[data-streamdown=mermaid-block]]:my-0 [&_[data-streamdown=mermaid-block]]:overflow-hidden [&_p]:m-0"
					>
						{mermaidMarkdown}
					</MessageResponse>
				</div>
				<pre className="rich-text-mermaid-source" hidden>
					{/* Explicit generic: TipTap types `as` with NoInfer, so `"code"` needs T. */}
					<NodeViewContent<"code"> as="code" />
				</pre>
			</NodeViewWrapper>
		);
	}

	return (
		<NodeViewWrapper as="div" className="rich-text-code-block" data-language={language ?? undefined}>
			<pre>
				<NodeViewContent<"code"> as="code" />
			</pre>
		</NodeViewWrapper>
	);
}
