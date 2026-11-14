"use client";

import { createElement, Suspense, use, useCallback, useEffect, useRef, useState } from "react";
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
//
// The rule's :has() subjects are re-checked on every DOM change inside the article, which made a
// busy demo's style recalcs about 40% slower, so the <style> is removed once the demo has rendered
// (or after the same 3s), leaving nothing to re-check while the demo runs.
const PENDING_SENTINEL = ":nth-child(1 of :not(template, [data-doc-preview-pending]))";
const HOLD_RELEASE_TIMEOUT_MS = 3000;
const HOLD_SECTIONS_AFTER_PREVIEW_CSS = `article:is(
	:has([data-doc-preview-pending]),
	:has(#preview [data-doc-preview-sentinel]${PENDING_SENTINEL})
) > :has(#preview, [data-doc-preview-pending]) ~ * {
	opacity: 0;
	animation: doc-preview-hold-release 0s linear 3s forwards;
}
@keyframes doc-preview-hold-release { to { opacity: 1; } }`;

function HoldSectionsAfterPreview() {
	return <style>{HOLD_SECTIONS_AFTER_PREVIEW_CSS}</style>;
}

/** Placed after the demo; reports once the demo has rendered an element ahead of it. */
function PreviewSentinel({ onDemoRendered }: Readonly<{ onDemoRendered: () => void }>) {
	const sentinelRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		const sentinel = sentinelRef.current;
		const slot = sentinel?.parentElement;
		if (!sentinel || !slot) return undefined;
		const rendered = () => !sentinel.matches(PENDING_SENTINEL);
		if (rendered()) {
			onDemoRendered();
			return undefined;
		}
		const observer = new MutationObserver(() => {
			if (!rendered()) return;
			observer.disconnect();
			onDemoRendered();
		});
		observer.observe(slot, { childList: true });
		return () => observer.disconnect();
	}, [onDemoRendered]);
	return <span ref={sentinelRef} data-doc-preview-sentinel="" hidden />;
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
	onDemoRendered,
}: Readonly<DocPreviewProps & { onDemoRendered: () => void }>) {
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
				<PreviewSentinel onDemoRendered={onDemoRendered} />
			</DemoPreviewShell>
		</DocSection>
	);
}

export function DocPreview(props: Readonly<DocPreviewProps>) {
	// Keyed by page so a client-side navigation to another doc page holds again.
	const previewKey = `${props.category}:${props.slug}`;
	const [releasedKey, setReleasedKey] = useState<string | null>(null);
	const releaseHold = useCallback(() => setReleasedKey(previewKey), [previewKey]);
	useEffect(() => {
		const timeout = window.setTimeout(releaseHold, HOLD_RELEASE_TIMEOUT_MS);
		return () => window.clearTimeout(timeout);
	}, [releaseHold]);
	return (
		<>
			{releasedKey === previewKey ? null : <HoldSectionsAfterPreview />}
			<Suspense fallback={<PreviewSkeleton />}>
				<ResolvedDocPreview {...props} onDemoRendered={releaseHold} />
			</Suspense>
		</>
	);
}
