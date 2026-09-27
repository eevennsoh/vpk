import Image from "next/image";
import type { CSSProperties } from "react";

import type { JiraIssueCoverImage } from "@/components/blocks/jira-issue/types";
import { TWGAppstack, TwgToolSourceIcon } from "@/components/ui-custom/twg-appstack";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import PatternTile from "@/components/website/demos/visual/pattern-tile";
import { cn } from "@/lib/utils";

const GRID_FADE_STYLE = buildScrollMaskStyle({ fadeTop: false, fadeBottom: true, fadeSize: "4rem", scrollbarWidth: 0 });
const GRID_STROKE = { style: "dashed", width: 1, dash: 1, gap: 3, lineCap: "round" } as const;
// App tiles belong to the fixed white artwork, including when the surrounding UI is dark.
const COVER_APP_THEME = {
	"--ds-surface": "#ffffff",
	"--ds-border": "rgba(11, 18, 14, 0.14)",
} as CSSProperties;

export function JiraIssueCover({ image }: Readonly<{ image: JiraIssueCoverImage }>) {
	const isTextCover = image.heading !== undefined;
	const hasSubheading = image.subheading !== undefined;
	const hasGrid = image.backgroundPattern === "grid";
	const appSources = image.appSources ?? [];
	const firstApp = appSources[0];

	return (
		<div
			className={cn(
				"relative aspect-video w-full overflow-hidden rounded-t-lg",
				// Reveal the underlying card stroke without reserving space or shifting text.
				"group-data-[selected=true]/jira-issue:[--cover-ring-inset:1px] group-focus-visible/jira-issue:[--cover-ring-inset:1px] group-has-[[data-jira-issue-activation-control]:focus-visible]/jira-issue:[--cover-ring-inset:1px]",
				image.backgroundClassName,
				// Typographic artwork keeps its white/ink palette in either UI theme.
				isTextCover ? "flex flex-col items-start gap-3 bg-[#ffffff] px-[calc(var(--spacing)*3+1px)] pt-6 pb-4 text-left text-[#101214]" : null,
			)}
			aria-hidden={image.src || isTextCover ? undefined : true}
			data-slot="jira-issue-cover"
			style={{
				maxHeight: image.maxHeight,
				clipPath: "inset(var(--cover-ring-inset, 0px) var(--cover-ring-inset, 0px) 0px round calc(var(--ds-radius-large) - var(--cover-ring-inset, 0px)) calc(var(--ds-radius-large) - var(--cover-ring-inset, 0px)) 0px 0px)",
			}}
		>
			{hasGrid ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0"
					data-slot="jira-issue-cover-pattern"
					style={GRID_FADE_STYLE}
				>
					<PatternTile patternType="grid" gridAlignment="balanced" front="rgb(16 18 20 / 14%)" back="transparent" scale={32} stroke={GRID_STROKE} />
				</div>
			) : null}
			{firstApp ? (
				<div className="relative flex shrink-0 items-center" data-slot="jira-issue-cover-apps" style={COVER_APP_THEME}>
					{appSources.length > 1 ? (
						<TWGAppstack animated={false} iconSize="small" sources={appSources} data-slot="jira-issue-cover-app-stack" />
					) : (
						<TwgToolSourceIcon source={firstApp} size="small" />
					)}
				</div>
			) : null}
			{isTextCover ? (
				<div className="relative mt-auto flex w-full flex-col gap-1">
					<p
						className="relative w-full whitespace-pre-line font-sans text-xl font-normal capitalize leading-tight tracking-[-0.02em]"
						data-slot="jira-issue-cover-heading"
					>{image.heading}</p>
					{hasSubheading ? (
						<p className="relative w-full font-sans text-base font-light leading-tight" data-slot="jira-issue-cover-subheading">{image.subheading}</p>
					) : null}
				</div>
			) : null}
			{image.src ? <Image
				alt={image.alt}
				className="object-contain"
				draggable={false}
				fill
				sizes="(max-width: 768px) 100vw, 50vw"
				src={image.src}
			/> : null}
		</div>
	);
}
