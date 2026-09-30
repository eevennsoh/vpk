"use client";

import React, { useState } from "react";
import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import Heading from "@/components/ui/heading";

import CollapsedSummary from "./collapsed-summary";
import SourcesCarousel from "./sources-carousel";
import SummaryFooter from "./summary-footer";
import { MOCK_SOURCES, SUMMARY_ITEMS, SUGGESTED_QUESTIONS } from "../data/ai-summary-data";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";

interface AISummaryPanelProps {
	defaultExpanded?: boolean;
}

export default function AISummaryPanel({ defaultExpanded = true }: Readonly<AISummaryPanelProps>): React.ReactElement {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	function handleToggle(): void {
		setIsExpanded((prev) => !prev);
	}

	function handleExpand(): void {
		setIsExpanded(true);
	}

	return (
		<div
			className="bg-surface"
			style={{
				border: `1px solid ${token("color.border")}`,
				borderRadius: token("radius.large"),
				paddingTop: token("space.100"),
				paddingRight: token("space.100"),
				paddingBottom: token("space.100"),
				paddingLeft: token("space.200"),
				marginBottom: token("space.300"),
			}}
		>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: token("space.100"),
				}}
			>
				<div style={{ color: token("color.text.subtle") }}>
					<Heading size="xxsmall">Answer</Heading>
				</div>
				<Button
					aria-label={isExpanded ? "Collapse" : "Expand"}
					size="icon"
					variant="ghost"
					onClick={handleToggle}
				>
					{isExpanded ? <ChevronUpIcon label="" size="small" /> : <ChevronDownIcon label="" size="small" />}
				</Button>
			</div>

			{/* Collapsed State */}
			{!isExpanded ? <CollapsedSummary onExpand={handleExpand} /> : null}

			{/* Expanded Content */}
			{isExpanded ? <div style={{ marginRight: token("space.200") }}>
					<div className="flex flex-col gap-2">
						{/* Summary Text */}
						<div style={{ font: token("font.body") }}>
							<span className="text-sm">For detailed information on the OKRs for 2026, you can refer to the following resources:</span>
						</div>

						{/* Numbered List */}
						<div style={{ paddingLeft: token("space.100") }}>
							<div className="flex flex-col gap-3">
								{SUMMARY_ITEMS.map((item) => (
									<div key={item.tagNumber} style={{ font: token("font.body") }}>
										<span className="text-sm font-semibold">
											{item.tagNumber}. {item.title}
										</span>
										<span className="text-sm">
											: {item.description} You can <a href="#">view the referenced result</a>{" "}
											<Tag color="blue" shape="rounded">
												{item.tagNumber}
											</Tag>
											.
										</span>
									</div>
								))}
							</div>
						</div>

						<div style={{ font: token("font.body"), marginTop: token("space.100") }}>
							<span className="text-sm">These resources should provide you with comprehensive insights into the objectives and key results planned for 2026.</span>
						</div>

						<SourcesCarousel sources={MOCK_SOURCES} />

						<SummaryFooter />

						{/* Suggested Questions */}
						<div
							style={{
								paddingTop: token("space.200"),
								paddingBottom: token("space.100"),
								borderTop: `1px solid ${token("color.border")}`,
								display: "flex",
								flexWrap: "wrap",
								gap: token("space.100"),
							}}
						>
							{SUGGESTED_QUESTIONS.map((question) => (
								<Button key={question} className="gap-2" variant="secondary">
									<AiChatIcon label="" size="small" />
									{question}
								</Button>
							))}
						</div>
					</div>
				</div> : null}
		</div>
	);
}
