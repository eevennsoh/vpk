"use client";

import { createElement, Suspense, use } from "react";
import { token } from "@/lib/tokens";
import type { DemoLayout } from "@/app/data/component-detail-types";
import {
	loadDemoComponent,
	type DemoCategory,
} from "@/components/website/demo-registry-loader";
import { Button } from "@/components/ui/button";
import { DocSection } from "./doc-section";
import { DemoPreviewShell } from "./demo-preview-shell";
import { shouldUseFullPagePreview } from "./preview-layout";
import FullscreenEnterIcon from "@atlaskit/icon/core/fullscreen-enter";

interface DocPreviewProps {
	slug: string;
	category: DemoCategory;
	demoLayout?: DemoLayout;
}

// Demos render on the client only (`ssr: false`) and can arrive well after the page paints. Until the
// preview shows its demo, the sections after it (Import, Usage, Examples, API) stay in the page,
// focusable and in the accessibility tree, but transparent, so they appear with the demo instead of
// jumping down under it (Chrome counts no layout shift for transparent content). Pending means the
// skeleton is showing, or nothing but React's client-render marker precedes the sentinel placed
// after the demo. The hold lifts after 3s in case a demo never renders.
const HOLD_SECTIONS_AFTER_PREVIEW_CSS = `article:is(
	:has([data-doc-preview-pending]),
	:has(#preview [data-doc-preview-sentinel]:nth-child(1 of :not(template, [data-doc-preview-pending])))
) > :has(#preview, [data-doc-preview-pending]) ~ * {
	opacity: 0;
	animation: doc-preview-hold-release 0s linear 3s forwards;
}
@keyframes doc-preview-hold-release { to { opacity: 1; } }`;

function HoldSectionsAfterPreview() {
	return <style>{HOLD_SECTIONS_AFTER_PREVIEW_CSS}</style>;
}

function PreviewSkeleton() {
	return (
		<div
			data-doc-preview-pending=""
			style={{
				display: "flex",
				width: "100%",
				alignItems: "center",
				justifyContent: "center",
				minHeight: 120,
			}}
		>
			<div
				style={{
					width: 80,
					height: 80,
					borderRadius: 8,
					backgroundColor: token("color.background.neutral"),
					animation: "pulse 2s ease-in-out infinite",
				}}
			/>
		</div>
	);
}

function ResolvedDocPreview({
	slug,
	category,
	demoLayout,
}: Readonly<DocPreviewProps>) {
	const Demo = use(loadDemoComponent(slug, category));

	if (!Demo) {
		return null;
	}

		const fullViewAction = (
			<Button variant="link" size="default" nativeButton={false} render={<a aria-label={`Open ${slug} preview fullscreen`} href={`/preview/${category}/${slug}`} />}>
			<FullscreenEnterIcon label="" size="small" />
			Fullscreen
		</Button>
	);

	const isFullPage = shouldUseFullPagePreview(category, demoLayout);
	const fitContent = demoLayout?.previewHeight === "fit";

	return (
		<DocSection id="preview" title="Preview" action={fullViewAction}>
			<DemoPreviewShell
				contentWidth={demoLayout?.previewContentWidth}
				fullPage={isFullPage}
				fitContent={fitContent}
			>
				<Suspense fallback={<PreviewSkeleton />}>
					{createElement(Demo)}
				</Suspense>
				<span data-doc-preview-sentinel="" hidden />
			</DemoPreviewShell>
		</DocSection>
	);
}

export function DocPreview(props: Readonly<DocPreviewProps>) {
	return (
		<>
			<HoldSectionsAfterPreview />
			<Suspense fallback={<PreviewSkeleton />}>
				<ResolvedDocPreview {...props} />
			</Suspense>
		</>
	);
}
