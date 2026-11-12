"use client";

import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter-v1/use-project-butter-content";
import { token } from "@/lib/tokens";

export function ProjectButterSummary({ content }: Readonly<{ content: ProjectButterContent }>) {
	return (
		<h1 className="flex h-8 min-w-0 flex-1 items-center text-text" style={{ font: token("font.heading.medium") }}><span
			aria-label="Work item summary"
			aria-multiline="false"
			className="block h-8 min-w-0 w-full cursor-text truncate rounded-sm leading-8 outline-none"
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
