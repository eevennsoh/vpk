"use client";

import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { token } from "@/lib/tokens";

export function ProjectButterSummary({ content }: Readonly<{ content: ProjectButterContent }>) {
	return (
		<h1 className="min-w-0 flex-1 text-text" style={{ font: token("font.heading.medium") }}><span
			aria-label="Work item summary"
			aria-multiline="false"
			className="block cursor-text rounded-sm outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring"
			contentEditable="plaintext-only"
			onBlur={(event) => {
				const summary = event.currentTarget.textContent?.replace(/\s+/g, " ").trim() || content.summary;
				event.currentTarget.textContent = summary;
				content.setSummary(summary);
			}}
			onKeyDown={(event) => {
				if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
				event.preventDefault();
				event.currentTarget.blur();
			}}
			onPaste={(event) => {
				event.preventDefault();
				const text = event.clipboardData.getData("text/plain").replace(/\s+/g, " ");
				const selection = event.currentTarget.ownerDocument.getSelection();
				if (!selection?.rangeCount) return;
				const range = selection.getRangeAt(0);
				if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
				range.deleteContents();
				const node = event.currentTarget.ownerDocument.createTextNode(text);
				range.insertNode(node);
				range.setStartAfter(node);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
			}}
			role="textbox"
			spellCheck={false}
			suppressContentEditableWarning
			tabIndex={0}
		>
			{content.summary}
		</span></h1>
	);
}
