import Image from "next/image";
import type { CSSProperties } from "react";

import type { JiraIssueCoverImage } from "@/components/blocks/jira-issue/types";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import PatternTile from "@/components/website/demos/visual/pattern-tile";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const GRID_FADE_STYLE = buildScrollMaskStyle({ fadeTop: false, fadeBottom: true, fadeSize: "4rem", scrollbarWidth: 0 });
const GRID_STROKE = { style: "dashed", width: 1, dash: 1, gap: 3, lineCap: "round" } as const;
const COVER_SIDE_INSET = "max(var(--cover-ring-inset, 0px), var(--cover-surface-inset, 0px))";
const COVER_TOP_INSET = `var(--cover-surface-top-inset, ${COVER_SIDE_INSET})`;
const COVER_RADIUS = `calc(var(--ds-radius-large) - min(${COVER_SIDE_INSET}, 1px))`;

export function JiraIssueCover({ image }: Readonly<{ image: JiraIssueCoverImage }>) {
	const isTextCover = image.heading !== undefined;
	const hasSubheading = image.subheading !== undefined;
	const hasGrid = image.backgroundPattern === "grid";
	const appSources = image.appSources ?? [];
	const appIconSize = "small";
	const imagePadding = image.src ? image.padding : undefined;
	const imageMaskStyle = image.mask ? {
		maskImage: `url("${image.mask.src}")`,
		maskMode: "luminance",
		maskSize: image.fit ?? "contain",
		maskPosition: "center",
		maskRepeat: "no-repeat",
	} satisfies CSSProperties : undefined;

	return (
		<div
			className={cn(
				"relative aspect-video w-full overflow-hidden rounded-t-lg",
				// Reveal the underlying card stroke without reserving space or shifting text.
				"group-data-[selected=true]/jira-issue:[--cover-ring-inset:1px] group-focus-visible/jira-issue:[--cover-ring-inset:1px] group-has-[[data-jira-issue-activation-control]:focus-visible]/jira-issue:[--cover-ring-inset:1px]",
				image.backgroundClassName,
				isTextCover ? "flex flex-col items-start gap-3 bg-surface px-[calc(var(--spacing)*3+1px)] pt-4 pb-4 text-left text-text" : null,
			)}
			aria-hidden={image.src || isTextCover ? undefined : true}
			data-slot="jira-issue-cover"
			style={{
				height: image.height,
				maxHeight: image.maxHeight,
				boxSizing: imagePadding ? "content-box" : undefined,
				paddingBlockStart: imagePadding?.blockStart,
				paddingBlockEnd: imagePadding?.blockEnd,
				backgroundColor: image.mask?.backgroundColor ?? imagePadding?.backgroundColor,
				clipPath: `inset(${COVER_TOP_INSET} ${COVER_SIDE_INSET} 0px round ${COVER_RADIUS} ${COVER_RADIUS} 0px 0px)`,
			}}
		>
			{hasGrid ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0"
					data-slot="jira-issue-cover-pattern"
					style={GRID_FADE_STYLE}
				>
					<PatternTile patternType="grid" gridAlignment="centered" front={token("color.border")} back="transparent" scale={32} stroke={GRID_STROKE} style={{ maskPosition: "center 8px" }} />
				</div>
			) : null}
			{appSources.length > 0 ? (
				<div
					className={cn("flex shrink-0 items-center", image.src ? "absolute top-4 left-4 z-10" : "relative")}
					data-slot="jira-issue-cover-apps"
				>
					<TWGAppstack animated={false} iconSize={appIconSize} sources={appSources} data-slot="jira-issue-cover-app-stack" />
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
			{image.src ? (
				<div
					className="absolute inset-x-0"
					data-slot="jira-issue-cover-artwork"
					style={{ top: imagePadding?.blockStart ?? 0, bottom: imagePadding?.blockEnd ?? 0, containerType: image.objectPosition ? "inline-size" : undefined }}
				>
					<Image
						alt={image.alt}
						className={image.fit === "cover" ? "object-cover object-center" : "object-contain"}
						style={{
							...imageMaskStyle,
							objectPosition: image.objectPosition,
							transform: image.zoom ? `scale(${image.zoom})` : undefined,
						}}
						draggable={false}
						fill
						sizes="(max-width: 768px) 100vw, 50vw"
						src={image.src}
					/>
					{image.layers?.map((src) => <Image
						key={src}
						alt=""
						aria-hidden="true"
						className={image.fit === "cover" ? "pointer-events-none object-cover object-center" : "pointer-events-none object-contain"}
						data-slot="jira-issue-cover-layer"
						draggable={false}
						fill
						sizes="(max-width: 768px) 100vw, 50vw"
						src={src}
						style={{ objectPosition: image.objectPosition }}
					/>)}
				</div>
			) : null}
			{image.foreground ? <Image
				alt=""
				aria-hidden="true"
				className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
				data-slot="jira-issue-cover-foreground"
				draggable={false}
				height={image.foreground.height}
				src={image.foreground.src}
				style={{ width: `max(${image.foreground.width}px, ${image.foreground.width / image.foreground.canvasWidth * 100}%)`, height: "auto" }}
				width={image.foreground.width}
			/> : null}
		</div>
	);
}
