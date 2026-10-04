"use client";

import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { token } from "@/lib/tokens";
import { createRichTextEditorExtensions } from "@/components/ui-custom/rich-text-editor";
import EditorBubbleMenu from "./editor-bubble-menu/index";
import TitleActionBar from "./title-action-bar";
import DocumentTitle from "./document-title";
import DocumentMetadata from "./document-metadata";
import { INITIAL_CONTENT, DEFAULT_DOCUMENT } from "../data/editor-content";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";

export default function DocumentEditor() {
	const [isHoveringTitle, setIsHoveringTitle] = useState(false);

	const editor = useEditor({
		extensions: createRichTextEditorExtensions(),
		content: INITIAL_CONTENT,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				class: "tiptap-editor",
			},
		},
	});

	return (
		<div
			style={{
				backgroundColor: token("elevation.surface"),
				borderRadius: token("radius.large"),
				overflow: "visible",
				minHeight: "calc(100vh - 200px)",
				position: "relative",
				display: "flex",
				flexDirection: "column",
				paddingTop: 0,
			}}
		>
			{/* Title Section */}
			<div
				onMouseEnter={() => setIsHoveringTitle(true)}
				onMouseLeave={() => setIsHoveringTitle(false)}
				style={{
					paddingTop: token("space.250"),
					paddingBottom: token("space.300"),
					paddingLeft: token("space.500"),
					paddingRight: token("space.500"),
					flexShrink: 0,
				}}
			>
				<TitleActionBar isVisible={isHoveringTitle} />

				{/* 40px vertical gap */}
				<div style={{ height: "40px" }} />

				<DocumentTitle title={DEFAULT_DOCUMENT.title} />
				<DocumentMetadata author={DEFAULT_DOCUMENT.author} readTime={DEFAULT_DOCUMENT.readTime} />
			</div>

			{/* Scrollable Editor Content */}
			<div
				style={{
					padding: `${token("space.400")} ${token("space.500")}`,
					overflow: "auto",
					flex: 1,
				}}
			>
				<EditorContent editor={editor} />
				{editor ? <EditorBubbleMenu editor={editor} /> : null}
			</div>
		</div>
	);
}
