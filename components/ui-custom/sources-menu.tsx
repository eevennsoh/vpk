"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- Popover and dropdown triggers use render-node elements so the caller owns the visual state.

import { useId, useState, type ReactElement, type ReactNode } from "react";
import GrowDiagonalIcon from "@atlaskit/icon/core/grow-diagonal";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import CommentIcon from "@atlaskit/icon/core/comment";
import FileIcon from "@atlaskit/icon/core/file";
import LinkIcon from "@atlaskit/icon/core/link";
import PageIcon from "@atlaskit/icon/core/page";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import VideoIcon from "@atlaskit/icon/core/video";
import WorkItemIcon from "@atlaskit/icon/core/work-item";
import TeamworkGraphIcon from "@atlaskit/icon-lab/core/teamwork-graph";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
	dropdownStyles,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SonnerToast, Toaster } from "@/components/ui/sonner";
import {
	formatSourcePreviewDate,
	getSourcePreviewApps,
	getSourcePreviewProduct,
	type SourcePreviewPage,
} from "@/components/ui-custom/sources-menu-data";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { cn } from "@/lib/utils";

export {
	formatSourcePreviewDate,
	getSourcePreviewIconTileVariant,
	getSourcePreviewProduct,
	isConfluenceWikiHref,
	SOURCE_PREVIEW_LONG_OWNER,
	SOURCE_PREVIEW_PAGES,
	type SourcePreviewPage,
	type SourcePreviewProduct,
} from "@/components/ui-custom/sources-menu-data";

export const SOURCES_MENU_TOASTER_ID = "sources-menu";

function showSourcesToast(
	title: string,
	appearance: "success" | "error",
	toasterId: string,
): void {
	toast.custom(
		(id) => (
			<SonnerToast
				appearance={appearance}
				onDismiss={() => toast.dismiss(id)}
				title={title}
			/>
		),
		{ toasterId },
	);
}

async function copySourceLink(href: string, toasterId: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(href);
		showSourcesToast("Link copied", "success", toasterId);
	} catch {
		showSourcesToast("Could not copy link", "error", toasterId);
	}
}

function SourcePreviewMetadata({
	source,
	truncateOwner = false,
}: Readonly<{
	source: SourcePreviewPage;
	truncateOwner?: boolean;
}>) {
	return (
		<>
			<span className="shrink-0">
				Updated on {formatSourcePreviewDate(source.updatedAt)}
			</span>
			<span aria-hidden="true" className="shrink-0">
				·
			</span>
			<span className={truncateOwner ? "min-w-0 flex-1 truncate" : undefined}>
				Owned by {source.owner}
			</span>
		</>
	);
}

function SourcePreviewActions({
	source,
	toasterId,
	onPreview,
}: Readonly<{
	source: SourcePreviewPage;
	toasterId: string;
	onPreview: (source: SourcePreviewPage) => void;
}>) {
	return (
		<div
			className={cn(
				"shrink-0 opacity-0 transition-opacity duration-fast ease-out-practical motion-reduce:transition-none",
				"group-hover/preview-card:opacity-100 group-has-[:focus-visible]/preview-card:opacity-100",
				"has-[[aria-expanded=true]]:opacity-100",
			)}
		>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							aria-label={`More actions for ${source.title}`}
							size="icon-compact"
							type="button"
							variant="ghost"
						>
							<ShowMoreHorizontalIcon label="" size="small" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end" sideOffset={6}>
					<DropdownMenuGroup>
						<DropdownMenuItem
							elemBefore={<Icon render={<LinkIcon label="" />} />}
							elemBeforeSize={16}
							onSelect={() => {
								void copySourceLink(source.href, toasterId);
							}}
						>
							Copy link
						</DropdownMenuItem>
						<DropdownMenuItem
							elemBefore={<Icon render={<GrowDiagonalIcon label="" />} />}
							elemBeforeSize={16}
							onSelect={() => onPreview(source)}
						>
							Open preview modal
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

type SimpleSource = Pick<SourcePreviewPage, "id" | "title" | "href" | "source">;

function SourcePreviewLeadingTile({
	source,
}: Readonly<{ source: SimpleSource }>) {
	const product = getSourcePreviewProduct(source.href);
	const kind = source.source?.name ?? source.source?.provider ?? product;
	const confluence = !source.source?.icon && (kind === "confluence" || (kind === "twg" && product === "confluence"));
	const icon = source.source?.icon ?? (confluence ? <PageIcon label="" size="small" />
		: kind === "jira" ? <WorkItemIcon label="" size="small" />
		: kind === "loom" ? <VideoIcon label="" size="small" />
		: kind === "slack" ? <CommentIcon label="" size="small" />
		: kind === "github" || kind === "bitbucket" ? <AngleBracketsIcon label="" size="small" />
		: <FileIcon label="" size="small" />);
	return <IconTile aria-hidden as="span" className={confluence ? undefined : "text-icon-subtle"} icon={icon} label={source.title} size="small" variant={confluence ? "blue" : "gray"} />;
}

function SourcePreviewCard({
	source,
	toasterId,
	onPreview,
}: Readonly<{
	source: SourcePreviewPage;
	toasterId: string;
	onPreview: (source: SourcePreviewPage) => void;
}>) {
	return (
		<article
			className={cn(
				"group/preview-card relative rich-text-command-menu-item",
				"h-auto! items-start! py-1.5!",
				"hover:bg-bg-neutral-subtle-hovered! has-[:focus-visible]:bg-bg-neutral-subtle-hovered!",
			)}
			data-has-trailing="true"
			data-menu-row=""
		>
			<a
				aria-label={source.title}
				className="absolute inset-0 z-0 rounded-lg"
				href={source.href}
				rel="noreferrer"
				target="_blank"
			/>
			<span className="rich-text-command-menu-avatar inline-flex shrink-0 items-center justify-center">
				<SourcePreviewLeadingTile source={source} />
			</span>
			<span className="rich-text-command-menu-copy">
				<span className="menu-row-title min-w-0 text-text!">{source.title}</span>
				<span className="menu-row-byline flex min-w-0 items-center gap-1.5 overflow-visible! text-text-subtlest!">
					<SourcePreviewMetadata source={source} truncateOwner={true} />
				</span>
				<span className="menu-row-byline mt-0.5 min-w-0 line-clamp-2 whitespace-normal! text-text-subtle!">
					{source.snippet}
				</span>
			</span>
			<span className="rich-text-command-menu-shortcut z-10 top-2! right-2! bottom-auto!">
				<SourcePreviewActions
					onPreview={onPreview}
					source={source}
					toasterId={toasterId}
				/>
			</span>
		</article>
	);
}

function SourceSimpleRow({ source }: Readonly<{ source: SimpleSource }>) {
	const contents = (
		<>
			<span className="inline-flex size-6 shrink-0 items-center justify-center">
				<SourcePreviewLeadingTile source={source} />
			</span>
			<span className="min-w-0 truncate">{source.title}</span>
		</>
	);
	return source.href ? (
		<a className={cn(dropdownStyles.itemBase, "gap-3 px-2 text-text no-underline hover:bg-bg-neutral-subtle-hovered hover:no-underline focus-visible:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring")} data-menu-row="" href={source.href} rel="noreferrer" target="_blank">{contents}</a>
	) : <div className={cn(dropdownStyles.itemBase, "cursor-default gap-3 px-2 text-text hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-hovered")} data-menu-row="">{contents}</div>;
}

function SourcePreviewDialog({
	source,
	onOpenChange,
}: Readonly<{
	source: SourcePreviewPage | null;
	onOpenChange: (open: boolean) => void;
}>) {
	return (
		<Dialog onOpenChange={onOpenChange} open={source !== null}>
			<DialogContent size="md">
				<DialogHeader>
					<DialogTitle>{source?.title ?? "Source preview"}</DialogTitle>
					<DialogDescription>
						{source ? (
							<span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
								<SourcePreviewMetadata source={source} />
							</span>
						) : (
							"Source details"
						)}
					</DialogDescription>
				</DialogHeader>
				{source ? <p className="text-sm text-text-subtle">{source.snippet}</p> : null}
				<DialogFooter>
					<Button
						onClick={() => {
							if (source) {
								window.open(source.href, "_blank", "noopener,noreferrer");
							}
						}}
						type="button"
					>
						Open source
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function SourcesMenu({
	pages = [],
	simpleSources,
	children,
	trigger,
	toasterId,
	align = "start",
	positionerClassName,
	variant = "verbose",
}: Readonly<{
	pages?: readonly SourcePreviewPage[];
	simpleSources?: readonly SimpleSource[];
	children?: ReactNode;
	trigger?: ReactElement;
	toasterId?: string;
	align?: "start" | "center" | "end";
	positionerClassName?: string;
	variant?: "simple" | "verbose";
}>) {
	const generatedToasterId = useId();
	const resolvedToasterId = toasterId ?? generatedToasterId;
	const [menuOpen, setMenuOpen] = useState(false);
	const [previewSource, setPreviewSource] = useState<SourcePreviewPage | null>(null);

	const openPreview = (source: SourcePreviewPage) => {
		setMenuOpen(false);
		setPreviewSource(source);
	};

	return (
		<>
			<Popover onOpenChange={setMenuOpen} open={menuOpen}>
				<PopoverTrigger render={trigger ?? <Button className="h-6 px-1 text-xs font-normal" type="button" variant="ghost" />}>
					{trigger ? children : (
						<>
							<Icon aria-hidden className="size-3 [&_svg]:size-3!" render={<TeamworkGraphIcon label="" size="small" />} />
							<span>Context</span>
							<TWGAppstack animated={false} aria-hidden iconSize="xxsmall" sources={getSourcePreviewApps(simpleSources ?? pages)} />
						</>
					)}
				</PopoverTrigger>
				<PopoverContent
					align={align}
					positionerClassName={positionerClassName}
					className={cn(variant === "simple" ? "w-[min(20rem,var(--available-width,20rem))]" : "w-[min(26rem,var(--available-width,26rem))]", "max-h-[min(22rem,var(--available-height,22rem))] gap-0 overflow-x-hidden overflow-y-auto border-0 shadow-2xl", dropdownStyles.surface, dropdownStyles.padding)}
					initialFocus={(openType) => openType === "keyboard"}
				>
					<PopoverTitle className="sr-only">Source previews</PopoverTitle>
					{variant === "simple" ? (simpleSources ?? pages).map((previewItem) => (
						<SourceSimpleRow key={previewItem.id} source={previewItem} />
					)) : pages.map((previewItem) => (
						<SourcePreviewCard
							key={previewItem.id}
							onPreview={openPreview}
							source={previewItem}
							toasterId={resolvedToasterId}
						/>
					))}
				</PopoverContent>
			</Popover>
			<SourcePreviewDialog
				onOpenChange={(open) => {
					if (!open) {
						setPreviewSource(null);
					}
				}}
				source={previewSource}
			/>
			{variant === "verbose" ? <Toaster id={resolvedToasterId} /> : null}
		</>
	);
}
