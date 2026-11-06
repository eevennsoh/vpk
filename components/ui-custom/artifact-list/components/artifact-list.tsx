"use client";

import { type ReactNode } from "react";

import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import GlobeIcon from "@atlaskit/icon/core/globe";
import PageIcon from "@atlaskit/icon/core/page";
import VideoIcon from "@atlaskit/icon/core/video";

import { Button } from "@/components/ui/button";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { Lozenge } from "@/components/ui/lozenge";
import { Tile } from "@/components/ui/tile";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface ArtifactListItem {
	/** Stable identity for the row (used as the React key and `onOpen` payload). */
	id: string;
	/** Primary line, e.g. "Audience Engagement Report". */
	title: string;
	/** Metadata source label, e.g. "Confluence page". */
	source: string;
	/** Metadata owner label, e.g. "Vitafleet Team". */
	owner?: string;
	/** Optional open destination for consumers that route `onOpen` via URL. */
	href?: string;
	/**
	 * Per-row action label, e.g. "Enable". Falls back to the list-level
	 * `openLabel`. Lets one list mix verbs (Create / Connect / Review) without a
	 * second row implementation.
	 */
	rowActionLabel?: string;
	/** Pull-request metadata rendered inline in compact rows, matching the agent session flyout. */
	pullRequest?: {
		number: number;
		status: "Open" | "Merged";
		additions: number;
		deletions: number;
	};
	/** Serializable built-in icon for data-only consumers. `icon` takes precedence. */
	iconName?: "ai-chat" | "globe" | "page" | "video";
	/** ADS icon for the leading tile (e.g. `<PageIcon label="" />`). */
	icon?: ReactNode;
	/**
	 * Tile color appearance for the `icon` variant — any `Tile` variant, e.g.
	 * `"blueSubtle"`. Defaults to `"neutral"`. Ignored for `logoSrc`/`avatarSrc`
	 * rows, which always use the neutral tile.
	 */
	tileVariant?: React.ComponentProps<typeof Tile>["variant"];
	/**
	 * Third-party brand id — renders the upstream package mark (its own tile).
	 * Takes precedence over `logoSrc`/`icon`.
	 */
	logoName?: ThirdPartyLogoName;
	/**
	 * 2P logo path (e.g. `/2p/appfire.png`) rendered 24px inset on the
	 * neutral tile. Takes precedence over `icon`.
	 */
	logoSrc?: string;
	/**
	 * Agent avatar image path (e.g. `/avatar-agent-new/blue/team-connection.svg`)
	 * rendered 20px inset on the neutral tile. Takes precedence over `logoSrc`/`icon`.
	 */
	avatarSrc?: string;
}

export interface ArtifactListProps extends React.ComponentProps<"div"> {
	items: readonly ArtifactListItem[];
	/** Fired when a row's hover/focus-revealed "Open" button is activated. */
	onOpen?: (item: ArtifactListItem) => void;
	/** Open-button label. Defaults to "Open". */
	openLabel?: string;
	/** Also fire `onOpen` when the row body is clicked. */
	openOnRowClick?: boolean;
	/** Row density and surface treatment. Defaults to `"default"`. */
	variant?: "default" | "compact";
}

function ArtifactListTileContent({ item }: Readonly<{ item: ArtifactListItem }>) {
	if (item.avatarSrc) {
		// eslint-disable-next-line @next/next/no-img-element -- Tile child-sizing CSS targets [&_img]; agent avatars render 20px inset on the neutral tile, not as a standalone hexagon Avatar.
		return <img alt="" aria-hidden className="object-contain" height={20} src={item.avatarSrc} width={20} />;
	}
	if (item.logoSrc) {
		// eslint-disable-next-line @next/next/no-img-element -- Tile child-sizing CSS targets [&_img]; mirrors logo-mark.tsx
		return <img alt="" aria-hidden className="object-contain" height={24} src={item.logoSrc} width={24} />;
	}
	if (item.icon) return item.icon;
	if (item.iconName === "page") return <PageIcon label="" size="small" />;
	if (item.iconName === "video") return <VideoIcon label="" size="small" />;
	if (item.iconName === "globe") return <GlobeIcon label="" size="small" />;
	if (item.iconName === "ai-chat") return <AiChatIcon label="" size="small" />;
	return null;
}

function ArtifactListLeadingTile({
	item,
	variant,
}: Readonly<{ item: ArtifactListItem; variant: "default" | "compact" }>) {
	// 3P brand logos render as the self-framing package mark (its own tile).
	if (item.logoName) {
		const logo = (
			<LogoThirdParty
				label=""
				name={item.logoName}
				size={variant === "compact" ? "small" : "medium"}
			/>
		);
		return logo;
	}

	// Logo + agent-avatar rows stay neutral; logos render 24px inset and agent
	// avatars 20px, while plain icon rows can opt into a color appearance and keep
	// the tile's default 16px inset.
	const usesInsetImage = Boolean(item.avatarSrc || item.logoSrc);
	const tile = (
		<Tile
			aria-hidden
			label={item.source}
			variant={usesInsetImage ? "neutral" : item.tileVariant ?? "neutral"}
			size={variant === "compact" ? "small" : "medium"}
			className={cn(
				"rounded-tile",
				item.logoSrc && "[&_img]:size-6!",
				item.avatarSrc && "[&_img]:size-5!",
			)}
		>
			<ArtifactListTileContent item={item} />
		</Tile>
	);

	return tile;
}

function ArtifactListRow({
	item,
	isLast,
	openLabel,
	openOnRowClick,
	onOpen,
	variant,
}: Readonly<{
	item: ArtifactListItem;
	isLast: boolean;
	openLabel: string;
	openOnRowClick?: boolean;
	onOpen?: (item: ArtifactListItem) => void;
	variant: "default" | "compact";
}>) {
	const handleOpen = () => onOpen?.(item);
	const rowOpenLabel = item.rowActionLabel ?? openLabel;
	const compactMetadata = (
		<span className="block w-full truncate text-xs leading-4 text-text-subtle">
			{item.source}
			{item.owner ? (
				<>
					<span aria-hidden="true" className="text-text-subtlest"> · </span>
					{item.owner}
				</>
			) : null}
		</span>
	);
	const compactPullRequestByline = item.pullRequest ? (
		<span className="mt-0.5 flex w-full min-w-0 items-center gap-1 text-xs leading-4">
			<span className="shrink-0">
				<Lozenge variant={item.pullRequest.status === "Merged" ? "discovery" : "success"}>
					{item.pullRequest.status}
				</Lozenge>
			</span>
			{item.href ? (
				<a
					className="min-w-0 flex-1 truncate rounded-[3px] text-text no-underline decoration-current outline-none hover:underline focus-visible:underline"
					href={item.href}
					title={`#${item.pullRequest.number}: ${item.title}`}
				>
					#{item.pullRequest.number}: {item.title}
				</a>
			) : (
				// No destination: plain text rather than a focusable link that cannot navigate.
				<span
					className="min-w-0 flex-1 truncate text-text"
					title={`#${item.pullRequest.number}: ${item.title}`}
				>
					#{item.pullRequest.number}: {item.title}
				</span>
			)}
		</span>
	) : null;

	const openAction = (
		<div
			className={cn(
				// Collapse at rest so titles use the full row; expand on hover/focus
				// without jumping the Open control into an absolute overlay (which
				// the raised card's overflow would clip). Margin (not flex gap) so
				// the slot leaves no empty space when width is 0fr.
				"ml-0 grid shrink-0",
				"grid-cols-[0fr] group-hover/artifact-row:ml-3 group-hover/artifact-row:grid-cols-[1fr]",
				"group-has-[:focus-visible]/artifact-row:ml-3 group-has-[:focus-visible]/artifact-row:grid-cols-[1fr]",
				"[@media(hover:none)]:ml-3 [@media(hover:none)]:grid-cols-[1fr]",
			)}
		>
			<div className="min-w-0 overflow-hidden has-[:focus-visible]:overflow-visible">
				<Button
					aria-label={item.pullRequest
						? `Code changes: ${item.pullRequest.additions} additions, ${item.pullRequest.deletions} deletions`
						: undefined}
					className={cn(
						"shrink-0 whitespace-nowrap",
						// Instant reveal/hide; keep Button chrome transitions but drop opacity.
						"pointer-events-none opacity-0 transition-[background-color,border-color,box-shadow,color] motion-reduce:transition-none",
						"group-hover/artifact-row:pointer-events-auto group-hover/artifact-row:opacity-100",
						"group-has-[:focus-visible]/artifact-row:pointer-events-auto group-has-[:focus-visible]/artifact-row:opacity-100",
						"[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
						"focus-visible:pointer-events-auto focus-visible:opacity-100",
					)}
					variant="outline"
					size={variant === "compact" ? "compact" : "default"}
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						handleOpen();
					}}
				>
					{item.pullRequest ? (
						<span className="flex items-center gap-1">
							<span className="text-text-success">+{item.pullRequest.additions}</span>
							<span className="text-text-danger">-{item.pullRequest.deletions}</span>
						</span>
					) : rowOpenLabel}
				</Button>
			</div>
		</div>
	);

	return (
		<div
			className={cn(
				"group/artifact-row min-w-0 w-full",
				variant === "compact"
					? "flex min-h-12 items-center px-3 py-2 transition-colors motion-reduce:transition-none hover:bg-surface-hovered"
					: "flex min-h-16 items-center px-3 py-2 transition-colors motion-reduce:transition-none hover:bg-surface-hovered",
				!isLast && "border-b border-border",
			)}
		>
			<div className="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
				{openOnRowClick ? (
						<button
							aria-label={`${rowOpenLabel} ${item.title}`}
							// Inset ring: the row content wrapper is `overflow-hidden`, which would
							// clip an outward `ring-offset` indicator on every edge.
							className="absolute inset-0 z-10 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
							type="button"
							onClick={handleOpen}
						/>
				) : null}
				<span className="shrink-0">
					<ArtifactListLeadingTile item={item} variant={variant} />
				</span>
				{variant === "compact" ? (
					<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
						<p className="w-full truncate text-xs font-medium leading-4 text-text">{item.title}</p>
						{compactPullRequestByline ?? compactMetadata}
					</div>
				) : (
					<div className="min-w-0 flex-1 overflow-hidden">
						<p className="truncate text-sm font-medium leading-5 text-text">{item.title}</p>
						<p className="flex min-w-0 items-center gap-1 text-xs leading-4">
							<span className="shrink-0 text-text-subtle">{item.source}</span>
							{item.owner ? (
								<>
									<span aria-hidden="true" className="shrink-0 text-text-subtlest">·</span>
									<span className="min-w-0 truncate text-text-subtle">{item.owner}</span>
								</>
							) : null}
						</p>
					</div>
				)}
			</div>
			{openAction}
		</div>
	);
}

export function ArtifactList({
	items,
	onOpen,
	openLabel = "Open",
	openOnRowClick = false,
	variant = "default",
	className,
	...props
}: Readonly<ArtifactListProps>) {
	return (
		<div
			className={cn("min-w-0 max-w-full overflow-hidden rounded-lg bg-surface-raised", className)}
			style={{ boxShadow: token("elevation.shadow.raised") }}
			{...props}
		>
			{items.map((item, index) => (
				<ArtifactListRow
					key={item.id}
					item={item}
					isLast={index === items.length - 1}
					openLabel={openLabel}
					openOnRowClick={openOnRowClick}
					onOpen={onOpen}
					variant={variant}
				/>
			))}
		</div>
	);
}
