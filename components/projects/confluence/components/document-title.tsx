"use client";

import React, { useRef } from "react";
import { token } from "@/lib/tokens";
import { ConfluenceIcon } from "@/components/ui/logo";

interface DocumentTitleProps {
	title: string;
}

export default function DocumentTitle({ title }: Readonly<DocumentTitleProps>) {
	const titleRef = useRef<HTMLDivElement>(null);

	const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			titleRef.current?.blur();
		}
	};

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				marginBottom: token("space.100"),
				gap: "12px",
			}}
		>
			{/* Icon Container */}
			<div
				style={{
					width: "40px",
					height: "40px",
					borderRadius: token("radius.large"),
					backgroundColor: token("color.background.neutral"),
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
					opacity: 0.6,
				}}
			>
				<ConfluenceIcon label="Confluence page" size="small" />
			</div>

			{/* Title */}
			<div
				ref={titleRef}
				role="textbox"
				aria-label="Page title"
				aria-multiline="false"
				// Already focusable as contentEditable; stated so the textbox role is a tab stop for lint too.
				tabIndex={0}
				contentEditable
				suppressContentEditableWarning
				onKeyDown={handleTitleKeyDown}
				style={{
					margin: 0,
					fontSize: "32px",
					fontWeight: 400,
					lineHeight: "1.2",
					color: token("color.text"),
					outline: "none",
					cursor: "text",
				}}
			>
				{title}
			</div>
		</div>
	);
}
