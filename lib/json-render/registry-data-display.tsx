"use client";

// Data display components for the json-render registry.
import NextImage from "next/image";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { useBoundProp } from "@json-render/react";
import type { MapWidgetCanvasProps } from "./map-widget-canvas";
import { getWorkflowLozengeVariant } from "@/lib/workflow-status";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Banner } from "@/components/ui/banner";
import { Separator } from "@/components/ui/separator";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { resolveImageRenderSrc } from "@/lib/image-proxy";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import { Avatar as AvatarRoot, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { Tag as TagPrimitive, TagGroup } from "@/components/ui/tag";
import { Spinner } from "@/components/ui/spinner";
import { CodeBlock } from "@/components/ui/code-block";
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content";
import { MessageResponse } from "@/components/ui-custom/message-markdown";
import { Kbd } from "@/components/ui/kbd";
import { Comment } from "@/components/ui/comment";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { ObjectTile } from "@/components/ui-custom/object-tile";
import { IconTile } from "@/components/ui/icon-tile";
import { FileTree as FileTreeRoot } from "@/components/ui-custom/file-tree";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import ChartTrendDownIcon from "@atlaskit/icon/core/chart-trend-down";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import SortDescendingIcon from "@atlaskit/icon/core/sort-descending";
import { nu, toSafeText, toSafeOptionalText, toPositiveDimension, isMermaidLanguage, hasMermaidFenceBlock, toMermaidMarkdown, toDataArray } from "./registry-values";
import { createFileTreeRenderData, renderFileTreeNode, type JsonRenderFileTreeNode } from "./registry-file-tree";
import type { Components } from "@json-render/react";
import type { catalog } from "./catalog";

const MapWidgetCanvas = dynamic<MapWidgetCanvasProps>(() => import("./map-widget-canvas").then((mod) => mod.MapWidgetCanvas), {
	ssr: false,
	loading: () => <div className="flex h-full w-full items-center justify-center text-xs text-text-subtle">Loading map...</div>,
});

type BadgeVariant = NonNullable<Parameters<typeof Badge>[0]["variant"]>;

const JSON_RENDER_BADGE_VARIANT_ALIASES: Record<string, BadgeVariant> = {
	neutral: "neutral",
	default: "neutral",
	secondary: "neutral",
	outline: "neutral",
	ghost: "neutral",
	link: "neutral",
	danger: "danger",
	destructive: "danger",
	important: "dangerBold",
	removed: "danger",
	success: "success",
	added: "success",
	warning: "warning",
	information: "information",
	info: "information",
	primary: "information",
	discovery: "discovery",
	inverse: "inverse",
	primaryInverted: "inverse",
	informationBold: "informationBold",
	successBold: "successBold",
	dangerBold: "dangerBold",
	warningBold: "warningBold",
	discoveryBold: "discoveryBold",
};

function normalizeJsonRenderBadgeVariant(value: unknown): BadgeVariant {
	if (typeof value !== "string") {
		return "neutral";
	}

	return JSON_RENDER_BADGE_VARIANT_ALIASES[value.trim()] ?? "neutral";
}


const LOZENGE_VARIANT_ALIASES: Record<string, LozengeProps["variant"]> = {
	default: "neutral",
	rounded: "neutral",
	removed: "danger",
	inprogress: "information",
	new: "discovery",
	moved: "warning",
	info: "information",
};

const LOZENGE_VARIANTS = new Set<NonNullable<LozengeProps["variant"]>>([
	"neutral",
	"success",
	"danger",
	"information",
	"discovery",
	"warning",
	"accent-red",
	"accent-orange",
	"accent-yellow",
	"accent-lime",
	"accent-green",
	"accent-teal",
	"accent-blue",
	"accent-purple",
	"accent-magenta",
	"accent-gray",
]);

function isStatusTableColumn(column: { key: string; label: string }): boolean {
	const normalizedKey = column.key.trim().toLowerCase();
	const normalizedLabel = column.label.trim().toLowerCase();

	return normalizedKey === "status" || normalizedLabel === "status";
}

function renderTableCellValue(
	row: Record<string, unknown>,
	column: { key: string; label: string },
): ReactNode {
	const cellText = toSafeText(row[column.key]);

	if (isStatusTableColumn(column) && cellText.trim()) {
		return (
			<Lozenge variant={getWorkflowLozengeVariant(cellText)}>
				{cellText}
			</Lozenge>
		);
	}

	return cellText;
}

export const dataDisplayComponents = {
	// ── Data Display ───────────────────────────────
	Badge: ({ props }) => {
		const variant = normalizeJsonRenderBadgeVariant(props.variant);
		const text = toSafeText(props.text);
		return <Badge variant={variant}>{text}</Badge>;
	},

	Alert: ({ props }) => {
		const { variant = "default" } = props;
		const title = toSafeOptionalText(props.title);
		const description = toSafeText(props.description);
		return (
			<Alert variant={variant}>
				{title ? <AlertTitle>{title}</AlertTitle> : null}
				<AlertDescription>{description}</AlertDescription>
			</Alert>
		);
	},
	Banner: ({ props }) => {
		const text = toSafeText(props.text);
		return <Banner variant={nu(props.variant)}>{text}</Banner>;
	},

	Separator: ({ props }) => {
		const { orientation = "horizontal" } = props;
		return <Separator orientation={orientation ?? undefined} />;
	},

	Metric: ({ props }) => {
		const { trend } = props;
		const label = toSafeText(props.label);
		const value = toSafeText(props.value);
		const detail = toSafeOptionalText(props.detail);
		const trendColor = trend === "up" ? token("color.icon.success") : trend === "down" ? token("color.icon.danger") : undefined;
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-1 text-center">
					<p className="text-xs text-text-subtlest">{label}</p>
					<div className="flex items-center justify-center gap-2">
						<p className="text-2xl font-semibold text-text">{value}</p>
						{trend === "up" ? <ChartTrendUpIcon label="" size="small" color={trendColor} /> : null}
						{trend === "down" ? <ChartTrendDownIcon label="" size="small" color={trendColor} /> : null}
					</div>
					{detail ? (
						<p className={cn("text-xs", trend === "up" && "text-text-success", trend === "down" && "text-text-danger", (!trend || trend === "neutral") && "text-text-subtle")}>{detail}</p>
					) : null}
				</CardContent>
			</Card>
		);
	},

	Table: ({ props }) => {
		const { columns, emptyMessage } = props;
		const data = toDataArray(props.data);
		const [sortKey, setSortKey] = useState<string | null>(null);
		const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

		const handleSort = (key: string) => {
			if (sortKey === key) {
				setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
			} else {
				setSortKey(key);
				setSortDir("asc");
			}
		};

		const sortedData = sortKey
			? [...data].sort((a, b) => {
					const aVal = a[sortKey];
					const bVal = b[sortKey];
					const aStr = String(aVal ?? "");
					const bStr = String(bVal ?? "");
					const aNum = Number(aVal);
					const bNum = Number(bVal);
					if (!isNaN(aNum) && !isNaN(bNum)) {
						return sortDir === "asc" ? aNum - bNum : bNum - aNum;
					}
					return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
				})
			: data;

		if (!Array.isArray(data) || data.length === 0) {
			return <div className="rounded-lg border border-border p-6 text-center text-sm text-text-subtle">{emptyMessage ?? "No data available."}</div>;
		}

		return (
			<div className="overflow-x-auto">
			<Table>
				<TableHeader>
						<TableRow>
							{columns.map((col: { key: string; label: string }) => {
								const isSortedColumn = sortKey === col.key;
								const sortIcon = isSortedColumn
									? sortDir === "asc"
										? <ArrowUpIcon label="" size="small" />
										: <ArrowDownIcon label="" size="small" />
									: <SortDescendingIcon label="" size="small" />;

								return (
									<TableHead key={col.key} className="cursor-pointer select-none" onClick={() => handleSort(col.key)}>
										<div className="inline-flex items-center gap-1 leading-none">
											<span>{toSafeText(col.label)}</span>
											<span className={cn("inline-flex items-center", isSortedColumn ? "opacity-100" : "opacity-40")}>
												{sortIcon}
											</span>
										</div>
									</TableHead>
								);
							})}
						</TableRow>
				</TableHeader>
				<TableBody>
					{sortedData.map((row, i: number) => (
						<TableRow key={i}>
							{columns.map((col: { key: string; label: string }) => (
								<TableCell key={col.key}>{renderTableCellValue(row, col)}</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
			</div>
		);
	},

	Link: ({ props }) => {
		const text = toSafeText(props.text);
		const href = toSafeOptionalText(props.href);
		if (!href) {
			return null;
		}

		return (
			<a href={href} className="text-sm text-link hover:underline" target="_blank" rel="noopener noreferrer">
				{text}
			</a>
		);
	},

	// ── Data Display (extended) ───────────────────
	Avatar: ({ props }) => {
		const { src, fallback, size = "default", shape = "circle" } = props;
		const safeFallback = toSafeText(fallback);
		const resolvedSrc = resolveImageRenderSrc(src);
		const initials =
			safeFallback
				.split(" ")
				.filter(Boolean)
				.slice(0, 2)
				.map((w) => w[0]?.toUpperCase())
				.join("") || "?";
		return (
			<AvatarRoot size={size} shape={shape}>
				{resolvedSrc ? <AvatarImage src={resolvedSrc} alt={safeFallback} /> : null}
				<AvatarFallback>{initials}</AvatarFallback>
			</AvatarRoot>
		);
	},

	Lozenge: ({ props }) => {
		const { text, variant, isBold = false, metric } = props;
		const variantKey = typeof variant === "string" ? variant.toLowerCase() : "";
		const normalizedVariant =
			(variantKey ? LOZENGE_VARIANT_ALIASES[variantKey] : undefined) ??
			(variantKey && LOZENGE_VARIANTS.has(variant as NonNullable<LozengeProps["variant"]>)
				? (variant as NonNullable<LozengeProps["variant"]>)
				: undefined) ??
			getWorkflowLozengeVariant(text);
		const safeMetric = typeof metric === "number" ? metric : toSafeOptionalText(metric);
		return (
			<Lozenge variant={normalizedVariant} isBold={isBold} metric={safeMetric}>
				{toSafeText(text)}
			</Lozenge>
		);
	},

	Tag: ({ props }) => {
		const { text, variant = "default", color } = props;
		return (
			<TagPrimitive variant={nu(variant)} color={nu(color)}>
				{toSafeText(text)}
			</TagPrimitive>
		);
	},

	TagGroup: ({ children }) => {
		return <TagGroup>{children}</TagGroup>;
	},

	Spinner: ({ props }) => {
		const { size = "default", label } = props;
		return <Spinner size={size} label={toSafeOptionalText(label)} />;
	},

	Code: ({ props }) => {
		return <code className="bg-bg-neutral text-text rounded-sm border border-border px-1.5 py-0.5 text-[0.8125rem]">{toSafeText(props.text)}</code>;
	},

	CodeBlock: ({ props }) => {
		const code = toSafeText(props.code);
		const language = toSafeOptionalText(props.language);
		const shouldRenderMermaid =
			isMermaidLanguage(language) || hasMermaidFenceBlock(code);

		if (shouldRenderMermaid) {
			const mermaidMarkdown = toMermaidMarkdown(code);
			if (!mermaidMarkdown) {
				return null;
			}

			return (
				<MessageResponse plain mode="static" controls={false} className="text-sm [&_p]:m-0">
					{mermaidMarkdown}
				</MessageResponse>
			);
		}

		return (
			<CodeBlock>
				<HighlightedCodeContent code={code} language={language ?? "text"} />
			</CodeBlock>
		);
	},

	Kbd: ({ props }) => {
		return <Kbd>{toSafeText(props.text)}</Kbd>;
	},

	Image: ({ props }) => {
		const { src, alt, width, height } = props;
		const resolvedSrc = resolveImageRenderSrc(src);
		if (!resolvedSrc) {
			return null;
		}

		return (
			<NextImage
				src={resolvedSrc}
				alt={toSafeText(alt)}
				width={toPositiveDimension(width, 960)}
				height={toPositiveDimension(height, 540)}
				unoptimized
				className="rounded-md"
			/>
		);
	},

	Comment: ({ props }) => {
		const { author, avatarSrc, time, content } = props;
		return (
			<Comment author={toSafeText(author)} avatarSrc={nu(avatarSrc)} time={toSafeOptionalText(time)}>
				{toSafeText(content)}
			</Comment>
		);
	},

	SectionMessage: ({ props }) => {
		const { title, description, appearance = "info" } = props;
		const titleText = toSafeText(title).trim();
		// Filter out AI-to-AI implementation notes that aren't meant for end users.
		if (/implementation\s+note/i.test(titleText)) {
			return null;
		}
		return (
			<Alert variant={appearance}>
				{titleText ? <AlertTitle>{titleText}</AlertTitle> : null}
				{description ? <AlertDescription>{toSafeText(description)}</AlertDescription> : null}
			</Alert>
		);
	},

	EmptyState: ({ props }) => {
		const { title, description } = props;
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>{toSafeText(title)}</EmptyTitle>
					{description ? <EmptyDescription>{toSafeText(description)}</EmptyDescription> : null}
				</EmptyHeader>
			</Empty>
		);
	},

	ObjectTile: ({ props }) => {
		const { title, description, href } = props;
		return <ObjectTile title={toSafeText(title)} description={toSafeOptionalText(description)} href={toSafeOptionalText(href)} />;
	},

	IconTile: ({ props }) => {
		const { label, variant = "gray", size = "medium", shape = "square" } = props;
		return <IconTile icon={null} label={toSafeText(label)} variant={nu(variant)} size={nu(size)} shape={nu(shape)} />;
	},
	FileTree: ({ props, bindings }) => {
		const fileTreeNodes: JsonRenderFileTreeNode[] = Array.isArray(props.nodes)
			? props.nodes.flatMap((node) => {
				if (!node || typeof node !== "object" || Array.isArray(node)) {
					return [];
				}

				const candidateNode = node as Record<string, unknown>;
				if (typeof candidateNode.path !== "string") {
					return [];
				}

				return [{
					path: candidateNode.path,
					name: typeof candidateNode.name === "string" ? candidateNode.name : null,
					type: candidateNode.type === "folder" || candidateNode.type === "file" ? candidateNode.type : null,
				}];
			})
			: [];
		const fileTreeData = createFileTreeRenderData(fileTreeNodes);
		const [selectedPath, setSelectedPath] = useBoundProp<string>(nu(props.selectedPath), bindings?.selectedPath);

		if (!fileTreeData) {
			return (
				<div className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-text-subtle">
					No files available.
				</div>
			);
		}

		const defaultExpandedPaths = Array.isArray(props.defaultExpandedPaths) && props.defaultExpandedPaths.length > 0
			? props.defaultExpandedPaths.filter((path): path is string => typeof path === "string" && path.trim().length > 0)
			: fileTreeData.defaultExpandedPaths;

		return (
			<div className="rounded-md border border-border bg-surface p-2">
				<FileTreeRoot
					className={cn("bg-transparent text-xs", props.className ?? undefined)}
					defaultExpanded={new Set(defaultExpandedPaths)}
					selectedPath={selectedPath ?? undefined}
					onSelect={setSelectedPath}
				>
					{fileTreeData.roots.map((node) => renderFileTreeNode(node))}
				</FileTreeRoot>
			</div>
		);
	},
	MapWidget: ({ props, bindings }) => {
		const markerEntries = Array.isArray(props.markers)
			? props.markers.filter((marker) => typeof marker.id === "string" && Number.isFinite(marker.lat) && Number.isFinite(marker.lng) && typeof marker.title === "string")
			: [];

		const [selectedMarkerId, setSelectedMarkerId] = useBoundProp<string>(nu(props.selectedMarkerId), bindings?.selectedMarkerId);
		const activeMarkerId = selectedMarkerId ?? props.selectedMarkerId ?? markerEntries[0]?.id ?? "";
		const activeMarker = markerEntries.find((marker: { id: string }) => marker.id === activeMarkerId) ?? null;
		const fallbackCenter = markerEntries[0] ? { lat: markerEntries[0].lat, lng: markerEntries[0].lng } : { lat: 39.5, lng: -98.35 };
		const center = Number.isFinite(props.center?.lat) && Number.isFinite(props.center?.lng) ? props.center : fallbackCenter;
		const zoom = Number.isFinite(props.zoom) ? props.zoom! : 4;
		const height = Number.isFinite(props.height) ? props.height! : 320;

		return (
			<div className="space-y-3">
				<div className="overflow-hidden rounded-lg border border-border" style={{ height: `${height}px` }}>
					<MapWidgetCanvas
						center={center}
						zoom={zoom}
						markers={markerEntries}
						activeMarkerId={activeMarkerId}
						onSelectMarker={setSelectedMarkerId}
					/>
				</div>
				{activeMarker ? (
					<div className="rounded-lg border border-border bg-surface-raised p-3">
						<p className="text-sm font-medium text-text">{activeMarker.title}</p>
						{activeMarker.description ? <p className="mt-1 text-xs text-text-subtle">{activeMarker.description}</p> : null}
					</div>
				) : (
					<div className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-text-subtle">No marker selected.</div>
				)}
			</div>
		);
	},
} satisfies Partial<Components<typeof catalog>>;
