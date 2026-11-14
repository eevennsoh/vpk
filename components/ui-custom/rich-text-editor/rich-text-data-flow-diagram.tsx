"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const dataFlowStreamdownPlugins = { mermaid };

export function DataFlowDiagramView({
	isRefining,
	mermaidCode,
	diagramLabel,
}: Readonly<{
	isRefining: boolean;
	mermaidCode: string;
	diagramLabel?: string;
}>) {
	const mermaidMarkdown = ["```mermaid", mermaidCode.trim(), "```"].join("\n");
	const containerRef = useRef<HTMLDivElement>(null);

	// The diagram re-fits to its container automatically because the SVG is sized
	// in % (see the `size-full` overrides below). That covers untouched diagrams
	// when the surrounding layout changes (sidebar toggled, agent config
	// expanded/collapsed). However, once a user pans/zooms, streamdown stores a
	// pixel-based transform that no longer matches a resized container, so the
	// diagram looks off-centre/clipped after a layout change. Watch for width
	// changes and re-fit by resetting streamdown's pan/zoom in that case.
	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- data-flow refinement state is cancelled when editor mode/input becomes invalid.
	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}

		let lastWidth = container.getBoundingClientRect().width;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const refitIfTransformed = () => {
			const panZoom = container.querySelector<HTMLElement>(
				"[data-streamdown=mermaid] [role=application]",
			);
			const transform = panZoom?.style.transform ?? "";
			const isFitted =
				transform === "" ||
				(/translate\(0px,\s*0px\)/.test(transform) && /scale\(1\)/.test(transform));
			if (isFitted) {
				// An untouched diagram already re-fits via CSS — nothing to do.
				return;
			}
			const resetButton = container.querySelector<HTMLButtonElement>(
				'[data-streamdown=mermaid] button[title="Reset zoom and pan"]',
			);
			resetButton?.click();
		};

		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? lastWidth;
			// Ignore height-only changes; the SVG handles those via aspect-fit.
			if (Math.abs(width - lastWidth) < 1) {
				return;
			}
			lastWidth = width;
			// Debounce so we re-fit once after the layout settles (e.g. after the
			// expand/collapse animation), not on every intermediate frame.
			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(refitIfTransformed, 180);
		});

		observer.observe(container);
		return () => {
			observer.disconnect();
			if (timer) {
				clearTimeout(timer);
			}
		};
	}, []);

	// Streamdown renders its own "mermaid" header <span>. When a custom label is
	// provided we hide that text and inject our own via a ::after pseudo-element,
	// driven by a CSS variable so the value stays dynamic.
	const labelOverrideClassName = diagramLabel
		? "[&_[data-streamdown=mermaid-block]>div:first-child>span]:text-[0px] [&_[data-streamdown=mermaid-block]>div:first-child>span]:after:text-xs [&_[data-streamdown=mermaid-block]>div:first-child>span]:after:normal-case [&_[data-streamdown=mermaid-block]>div:first-child>span]:after:content-[var(--rich-text-diagram-label)]"
		: undefined;

	return (
		<div
			className={cn("relative", labelOverrideClassName)}
			data-rich-text-data-flow-diagram
			ref={containerRef}
			style={
				diagramLabel
					? ({
							"--rich-text-diagram-label": JSON.stringify(diagramLabel),
						} as CSSProperties)
					: undefined
			}
		>
			<Streamdown
				className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_[data-streamdown=mermaid-block]]:flex [&_[data-streamdown=mermaid-block]]:min-h-[480px] [&_[data-streamdown=mermaid-block]]:flex-col [&_[data-streamdown=mermaid-block]]:overflow-hidden [&_[data-streamdown=mermaid-block]]:rounded-md [&_[data-streamdown=mermaid-block]]:border [&_[data-streamdown=mermaid-block]]:border-border [&_[data-streamdown=mermaid-block]>div:last-child]:flex [&_[data-streamdown=mermaid-block]>div:last-child]:flex-1 [&_[data-streamdown=mermaid-block]>div:last-child]:overflow-hidden [&_[data-streamdown=mermaid-block]>div:last-child]:p-4 [&_[data-streamdown=mermaid]]:size-full [&_[data-streamdown=mermaid]>div]:h-full [&_[data-streamdown=mermaid]_[aria-label='Mermaid_chart']]:size-full [&_[data-streamdown=mermaid]_[aria-label='Mermaid_chart']]:items-center [&_[data-streamdown=mermaid]_svg]:!size-full [&_[data-streamdown=mermaid]_svg]:!max-w-none [&_[data-streamdown=mermaid]_svg]:!max-h-none"
				controls
				mode="static"
				plugins={dataFlowStreamdownPlugins}
			>
				{mermaidMarkdown}
			</Streamdown>
			{isRefining ? (
				<div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-end">
					{/*
						top-2 (8px) matches the mermaid block's p-2 padding so the
						spinner + label line up with the "mermaid" header row. The
						32px-tall container vertically centers them with that row, and
						mr-28 (112px) clears the zoom/copy/download pill (~96px) and
						leaves a ~16px gap to its left.
					*/}
					<div className="mr-28 flex h-8 items-center gap-1.5 text-sm text-text-subtle">
						<Spinner size="sm" label="Updating diagram" />
						<span>Updating diagram</span>
					</div>
				</div>
			) : null}
		</div>
	);
}
