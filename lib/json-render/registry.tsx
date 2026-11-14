"use client";

import NextImage from "next/image";
import dynamic from "next/dynamic";
import { Children, Fragment, Suspense, lazy, useState, type ReactNode } from "react";
import { defineRegistry, useBoundProp } from "@json-render/react";
import { getByPath, setByPath } from "@json-render/core";
import { catalog } from "./catalog";
import type { MapWidgetCanvasProps } from "./map-widget-canvas";
import { getWorkflowLozengeVariant } from "@/lib/workflow-status";

/** Convert null to undefined for React component props that expect optional values */
function nu<T>(v: T | null | undefined): T | undefined {
	return v ?? undefined;
}

function isDynamicExpressionObject(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const record = value as Record<string, unknown>;
	return (
		Object.prototype.hasOwnProperty.call(record, "$state") ||
		Object.prototype.hasOwnProperty.call(record, "$item") ||
		Object.prototype.hasOwnProperty.call(record, "$index") ||
		Object.prototype.hasOwnProperty.call(record, "$bindState") ||
		Object.prototype.hasOwnProperty.call(record, "$bindItem") ||
		Object.prototype.hasOwnProperty.call(record, "$cond")
	);
}

function toSafeText(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}

	if (Array.isArray(value)) {
		return value
			.map((entry) => toSafeText(entry))
			.filter(Boolean)
			.join(", ");
	}

	if (isDynamicExpressionObject(value)) {
		return "";
	}

	try {
		return JSON.stringify(value);
	} catch {
		return "";
	}
}

function toSafeOptionalText(value: unknown): string | undefined {
	const text = toSafeText(value).trim();
	return text.length > 0 ? text : undefined;
}

function toPositiveDimension(value: unknown, fallbackValue: number): number {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return Math.round(value);
	}

	if (typeof value === "string") {
		const trimmedValue = value.trim();
		if (!trimmedValue) {
			return fallbackValue;
		}

		const parsedValue = Number.parseFloat(trimmedValue);
		if (Number.isFinite(parsedValue) && parsedValue > 0) {
			return Math.round(parsedValue);
		}
	}

	return fallbackValue;
}

const MERMAID_FENCE_BLOCK_REGEX = /```mermaid\b[\s\S]*?```/i;

function isMermaidLanguage(value: unknown): boolean {
	const normalizedLanguage = toSafeOptionalText(value)?.toLowerCase();
	return normalizedLanguage === "mermaid" || normalizedLanguage === "mmd";
}

function hasMermaidFenceBlock(value: string): boolean {
	return MERMAID_FENCE_BLOCK_REGEX.test(value);
}

function toMermaidMarkdown(code: string): string {
	const normalizedCode = code.trim();
	if (!normalizedCode) {
		return "";
	}

	if (hasMermaidFenceBlock(normalizedCode)) {
		return normalizedCode;
	}

	return ["```mermaid", normalizedCode, "```", ""].join("\n");
}

function cloneStateModel<TState extends Record<string, unknown>>(state: TState): TState {
	return structuredClone(state);
}

type JsonRenderFileTreeNode = {
	path: string;
	name?: string | null;
	type?: "file" | "folder" | null;
};

type FileTreeRenderNode = {
	path: string;
	name: string;
	type: "file" | "folder";
	children: FileTreeRenderNode[];
};

type FileTreeRenderData = {
	defaultExpandedPaths: string[];
	roots: FileTreeRenderNode[];
};

type MutableFileTreeNode = {
	children: Set<string>;
	name: string;
	path: string;
	type: "file" | "folder";
};

type TagTaxonomyGroup = {
	color: "blue" | "teal" | "orange" | "purple" | "gray";
	label: string;
	tags: string[];
};

const DIRECTORY_TREE_BRANCH_PATTERN = /^((?:│   |    )*)(?:├── |└── )(.+)$/u;
const DIRECTORY_TREE_SECTION_PATTERN = /^(.+\/):$/u;
const FILE_TREE_INLINE_COMMENT_PATTERN = /\s+[←#].*$/u;
const TAG_TAXONOMY_LINE_PATTERN = /^([A-Za-z][A-Za-z /&-]*):\s*(.+)$/u;
const TAG_TAXONOMY_COLOR_MAP: Record<string, TagTaxonomyGroup["color"]> = {
	business: "orange",
	meta: "gray",
	people: "purple",
	platform: "teal",
	products: "blue",
};

function normalizeFileTreePath(value: string): string {
	const normalizedValue = value.trim().replace(/\\/g, "/");
	if (!normalizedValue) {
		return "";
	}

	const collapsedSeparators = normalizedValue.replace(/\/{2,}/g, "/");
	if (collapsedSeparators === "/") {
		return "/";
	}

	return collapsedSeparators.replace(/\/+$/u, "");
}

function getFileTreeParentPath(path: string): string | null {
	const normalizedPath = normalizeFileTreePath(path);
	if (!normalizedPath || normalizedPath === "/" || normalizedPath === "~") {
		return null;
	}

	if (normalizedPath.startsWith("~/")) {
		const segments = normalizedPath.slice(2).split("/").filter(Boolean);
		if (segments.length <= 1) {
			return null;
		}

		return `~/${segments.slice(0, -1).join("/")}`;
	}

	if (normalizedPath.startsWith("/")) {
		const segments = normalizedPath.split("/").filter(Boolean);
		if (segments.length <= 1) {
			return null;
		}

		return `/${segments.slice(0, -1).join("/")}`;
	}

	const segments = normalizedPath.split("/").filter(Boolean);
	if (segments.length <= 1) {
		return null;
	}

	return segments.slice(0, -1).join("/");
}

function getDefaultFileTreeNodeName(path: string): string {
	const parentPath = getFileTreeParentPath(path);
	if (parentPath === null && path.includes("/")) {
		return path;
	}

	return path.split("/").filter(Boolean).at(-1) ?? path;
}

function sanitizeFileTreeLabel(label: string): { name: string; type: "file" | "folder" } | null {
	const withoutInlineComment = label.replace(FILE_TREE_INLINE_COMMENT_PATTERN, "").trim();
	if (!withoutInlineComment) {
		return null;
	}

	const isFolder = withoutInlineComment.endsWith("/");
	const normalizedName = isFolder
		? withoutInlineComment.slice(0, -1).trim()
		: withoutInlineComment;
	if (!normalizedName) {
		return null;
	}

	return {
		name: normalizedName,
		type: isFolder ? "folder" : "file",
	};
}

function compareFileTreeNodes(a: MutableFileTreeNode, b: MutableFileTreeNode): number {
	if (a.type !== b.type) {
		return a.type === "folder" ? -1 : 1;
	}

	return a.name.localeCompare(b.name, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function upsertFileTreeNode(
	nodeMap: Map<string, MutableFileTreeNode>,
	{
		name,
		path,
		type,
	}: Readonly<{
		name?: string | null;
		path: string;
		type: "file" | "folder";
	}>,
): MutableFileTreeNode {
	const existingNode = nodeMap.get(path);
	if (existingNode) {
		if (type === "folder") {
			existingNode.type = "folder";
		}
		if (name && name.trim()) {
			existingNode.name = name;
		}
		return existingNode;
	}

	const createdNode: MutableFileTreeNode = {
		children: new Set<string>(),
		name: name?.trim() || getDefaultFileTreeNodeName(path),
		path,
		type,
	};
	nodeMap.set(path, createdNode);
	return createdNode;
}

function createFileTreeRenderData(nodes: ReadonlyArray<JsonRenderFileTreeNode>): FileTreeRenderData | null {
	const nodeMap = new Map<string, MutableFileTreeNode>();
	const childPaths = new Set<string>();

	for (const node of nodes) {
		const rawPath = typeof node.path === "string" ? node.path : "";
		const normalizedPath = normalizeFileTreePath(rawPath);
		if (!normalizedPath) {
			continue;
		}

		const explicitName = typeof node.name === "string" && node.name.trim()
			? node.name.trim()
			: undefined;
		const explicitType = node.type === "folder" || rawPath.trim().endsWith("/") || explicitName?.endsWith("/")
			? "folder"
			: "file";

		upsertFileTreeNode(nodeMap, {
			path: normalizedPath,
			name: explicitName,
			type: explicitType,
		});

		let currentPath = normalizedPath;
		let parentPath = getFileTreeParentPath(currentPath);
		while (parentPath) {
			const parentNode = upsertFileTreeNode(nodeMap, {
				path: parentPath,
				type: "folder",
			});
			parentNode.children.add(currentPath);
			childPaths.add(currentPath);
			currentPath = parentPath;
			parentPath = getFileTreeParentPath(currentPath);
		}
	}

	if (nodeMap.size === 0) {
		return null;
	}

	const buildNode = (path: string): FileTreeRenderNode => {
		const currentNode = nodeMap.get(path)!;
		const children = Array.from(currentNode.children)
			.map((childPath) => nodeMap.get(childPath))
			.filter((childNode): childNode is MutableFileTreeNode => childNode !== undefined)
			.sort(compareFileTreeNodes)
			.map((childNode) => buildNode(childNode.path));

		return {
			children,
			name: currentNode.name,
			path: currentNode.path,
			type: currentNode.type,
		};
	};

	const roots = Array.from(nodeMap.values())
		.filter((node) => !childPaths.has(node.path))
		.sort(compareFileTreeNodes)
		.map((node) => buildNode(node.path));

	if (roots.length === 0) {
		return null;
	}

	return {
		defaultExpandedPaths: Array.from(nodeMap.values())
			.filter((node) => node.type === "folder")
			.map((node) => node.path)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
		roots,
	};
}

function parseAsciiDirectoryTree(value: string): FileTreeRenderData | null {
	const lines = value.split(/\r?\n/u).map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
	if (lines.length < 2) {
		return null;
	}

	const rootLine = lines[0].trim();
	if (DIRECTORY_TREE_BRANCH_PATTERN.test(rootLine) || !rootLine.endsWith("/")) {
		return null;
	}

	const rootPath = normalizeFileTreePath(rootLine);
	if (!rootPath) {
		return null;
	}

	const nodes: JsonRenderFileTreeNode[] = [
		{ path: rootPath, name: rootLine.replace(/\/+$/u, ""), type: "folder" },
	];
	const stack = new Map<number, string>([[0, rootPath]]);
	let matchedBranchCount = 0;

	for (const line of lines.slice(1)) {
		const branchMatch = line.match(DIRECTORY_TREE_BRANCH_PATTERN);
		if (!branchMatch) {
			continue;
		}

		const label = sanitizeFileTreeLabel(branchMatch[2] ?? "");
		if (!label) {
			continue;
		}

		const depth = (branchMatch[1] ?? "").length / 4 + 1;
		const parentPath = stack.get(depth - 1);
		if (!parentPath) {
			continue;
		}

		const nodePath = normalizeFileTreePath(`${parentPath}/${label.name}`);
		if (!nodePath) {
			continue;
		}

		nodes.push({
			path: nodePath,
			name: label.name,
			type: label.type,
		});
		stack.set(depth, nodePath);
		for (const existingDepth of Array.from(stack.keys())) {
			if (existingDepth > depth) {
				stack.delete(existingDepth);
			}
		}
		matchedBranchCount += 1;
	}

	return matchedBranchCount > 0 ? createFileTreeRenderData(nodes) : null;
}

function parseSectionedDirectoryTree(value: string): FileTreeRenderData | null {
	const lines = value.split(/\r?\n/u);
	const nodes: JsonRenderFileTreeNode[] = [];
	let currentFolderPath: string | null = null;
	let matchedEntryCount = 0;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}

		const sectionMatch = line.match(DIRECTORY_TREE_SECTION_PATTERN);
		if (sectionMatch?.[1]) {
			const folderPath = normalizeFileTreePath(sectionMatch[1]);
			if (!folderPath) {
				continue;
			}

			nodes.push({
				path: folderPath,
				name: getDefaultFileTreeNodeName(folderPath),
				type: "folder",
			});
			currentFolderPath = folderPath;
			continue;
		}

		if (!currentFolderPath) {
			continue;
		}

		const label = sanitizeFileTreeLabel(line);
		if (!label) {
			continue;
		}

		nodes.push({
			path: `${currentFolderPath}/${label.name}`,
			name: label.name,
			type: label.type,
		});
		matchedEntryCount += 1;
	}

	return matchedEntryCount > 0 ? createFileTreeRenderData(nodes) : null;
}

function parseDirectoryTreeText(value: string): FileTreeRenderData | null {
	return parseAsciiDirectoryTree(value) ?? parseSectionedDirectoryTree(value);
}

function parseTagTaxonomyText(value: string): TagTaxonomyGroup[] | null {
	const lines = value
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length < 2) {
		return null;
	}

	const groups: TagTaxonomyGroup[] = [];
	for (const line of lines) {
		const match = line.match(TAG_TAXONOMY_LINE_PATTERN);
		if (!match) {
			return null;
		}

		const label = match[1]?.trim();
		const rawTags = match[2] ?? "";
		if (!label) {
			return null;
		}

		const tags = rawTags
			.split(",")
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
		if (tags.length === 0) {
			return null;
		}

		groups.push({
			color: TAG_TAXONOMY_COLOR_MAP[label.toLowerCase()] ?? "gray",
			label,
			tags,
		});
	}

	return groups.length >= 2 ? groups : null;
}

function renderFileTreeNode(node: FileTreeRenderNode): ReactNode {
	if (node.type === "folder") {
		return (
			<FileTreeFolderRoot key={node.path} path={node.path} name={node.name}>
				{node.children.map((childNode) => renderFileTreeNode(childNode))}
			</FileTreeFolderRoot>
		);
	}

	return <FileTreeFileRoot key={node.path} path={node.path} name={node.name} />;
}

// ── VPK UI primitives ──────────────────────────────────────────
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Banner } from "@/components/ui/banner";
import { Separator } from "@/components/ui/separator";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { resolveImageRenderSrc } from "@/lib/image-proxy";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import type { BundledLanguage } from "shiki";
import NodeIcon from "@atlaskit/icon/core/node";

// ── New VPK UI primitives ─────────────────────────────────────
import { Checkbox as CheckboxPrimitive } from "@/components/ui/checkbox";
import { Switch as SwitchPrimitive } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider as SliderPrimitive } from "@/components/ui/slider";
import { Toggle as TogglePrimitive } from "@/components/ui/toggle";
import { ToggleGroup as ToggleGroupPrimitive, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar as AvatarRoot, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { Tag as TagPrimitive, TagGroup } from "@/components/ui/tag";
import { Spinner } from "@/components/ui/spinner";
import { CodeBlock as CustomCodeBlock } from "@/components/ui-custom/code-block";
import { MessageResponse } from "@/components/ui-custom/message";
import { Kbd } from "@/components/ui/kbd";
import { Comment } from "@/components/ui/comment";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { ObjectTile } from "@/components/ui-custom/object-tile";
import { IconTile } from "@/components/ui/icon-tile";
import { Breadcrumb as BreadcrumbRoot, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonGroup as ButtonGroupPrimitive } from "@/components/ui/button-group";
import { Progress as ProgressBar, ProgressLabel as ProgressBarLabel } from "@/components/ui/progress";
import { ProgressTracker } from "@/components/ui/progress-tracker";
import { Collapsible as CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { DatePicker as DatePickerPrimitive } from "@/components/ui/date-picker";
import { InlineEdit as InlineEditPrimitive } from "@/components/ui/inline-edit";
import { Pagination as PaginationRoot, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@/components/ui/pagination";
import { InputOTP as InputOTPRoot, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
import { TooltipProvider, Tooltip as TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog as DialogRoot, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { TimePicker as TimePickerPrimitive } from "@/components/ui/time-picker";
import { DateTimePicker as DateTimePickerPrimitive } from "@/components/ui/date-time-picker";
import { FileTree as FileTreeRoot, FileTreeFile as FileTreeFileRoot, FileTreeFolder as FileTreeFolderRoot } from "@/components/ui-custom/file-tree";

// ── Atlaskit icons ────────────────────────────────────────────
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import ChartTrendDownIcon from "@atlaskit/icon/core/chart-trend-down";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import SortDescendingIcon from "@atlaskit/icon/core/sort-descending";

// ── Recharts ───────────────────────────────────────────────────
import {
	BarChart as RechartsBarChart,
	Bar,
	LineChart as RechartsLineChart,
	Line,
	PieChart as RechartsPieChart,
	Pie,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	AreaChart as RechartsAreaChart,
	Area,
	RadarChart as RechartsRadarChart,
	Radar,
	PolarGrid,
	PolarAngleAxis,
	PolarRadiusAxis,
} from "recharts";

// ── 3D (lazy-loaded) ──────────────────────────────────────────
const Scene3DImpl = lazy(() => import("./scene-3d"));
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

// ── Chart helpers ─────────────────────────────────────────────
const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function toDataArray(raw: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(raw)) return raw;
	if (raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).data)) {
		return (raw as Record<string, unknown>).data as Array<Record<string, unknown>>;
	}
	return [];
}

function processChartData(
	items: Array<Record<string, unknown>>,
	xKey: string,
	yKey: string,
	aggregate: "sum" | "count" | "avg" | null | undefined,
): { items: Array<Record<string, unknown>>; valueKey: string } {
	if (items.length === 0) {
		return { items: [], valueKey: yKey };
	}
	if (!aggregate) {
		const formatted = items.map((item) => ({ ...item, label: String(item[xKey] ?? "") }));
		return { items: formatted, valueKey: yKey };
	}
	const groups = new Map<string, Array<Record<string, unknown>>>();
	for (const item of items) {
		const groupKey = String(item[xKey] ?? "unknown");
		const group = groups.get(groupKey) ?? [];
		group.push(item);
		groups.set(groupKey, group);
	}
	const valueKey = aggregate === "count" ? "count" : yKey;
	const aggregated: Array<Record<string, unknown>> = [];
	const sortedKeys = Array.from(groups.keys()).sort();
	for (const key of sortedKeys) {
		const group = groups.get(key)!;
		let value: number;
		if (aggregate === "count") {
			value = group.length;
		} else if (aggregate === "sum") {
			value = group.reduce((sum, item) => {
				const v = item[yKey];
				return sum + (typeof v === "number" ? v : parseFloat(String(v)) || 0);
			}, 0);
		} else {
			const sum = group.reduce((s, item) => {
				const v = item[yKey];
				return s + (typeof v === "number" ? v : parseFloat(String(v)) || 0);
			}, 0);
			value = group.length > 0 ? sum / group.length : 0;
		}
		aggregated.push({ label: key, [valueKey]: value });
	}
	return { items: aggregated, valueKey };
}

// ── Gap class mapping ─────────────────────────────────────────
const GAP_CLASSES: Record<string, string> = {
	sm: "gap-2",
	md: "gap-3",
	lg: "gap-4",
};

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

// ── Grid column class mapping ─────────────────────────────────
const GRID_COL_CLASSES: Record<string, string> = {
	"1": "grid-cols-1",
	"2": "grid-cols-1 @[480px]/grid:grid-cols-2",
	"3": "grid-cols-1 @[480px]/grid:grid-cols-2 @[640px]/grid:grid-cols-3",
	"4": "grid-cols-1 @[480px]/grid:grid-cols-2 @[768px]/grid:grid-cols-4",
};

function normalizeHeadingLevel(rawLevel: unknown): "h1" | "h2" | "h3" | "h4" {
	if (typeof rawLevel === "string") {
		const trimmed = rawLevel.trim().toLowerCase();
		if (trimmed === "h1" || trimmed === "h2" || trimmed === "h3" || trimmed === "h4") {
			return trimmed;
		}
		if (trimmed === "1" || trimmed === "2" || trimmed === "3" || trimmed === "4") {
			return `h${trimmed}` as "h1" | "h2" | "h3" | "h4";
		}
	}

	if (typeof rawLevel === "number" && Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 4) {
		return `h${rawLevel}` as "h1" | "h2" | "h3" | "h4";
	}

	return "h2";
}

// ── Registry ───────────────────────────────────────────────────

export const { registry } = defineRegistry(catalog, {
	components: {
		// ── Layout ──────────────────────────────────────
		Stack: ({ props, children }) => {
			const { direction = "vertical", gap = "md", align, justify, padding, wrap, className } = props;
			const isHorizontal = direction === "horizontal";
			const directionClass = isHorizontal
				? wrap ? "flex-row flex-wrap" : "flex-row"
				: "flex-col";
			return (
				<div className="@container/stack" data-json-render-layout="stack">
					<div
						className={cn(
							"flex",
							directionClass,
							isHorizontal && "[&>*]:min-w-0",
							isHorizontal && !wrap && "[&>[data-json-render-layout=stack]]:flex-1",
							GAP_CLASSES[gap ?? "md"],
							align === "center" && "items-center",
							align === "start" && "items-start",
							align === "end" && "items-end",
							align === "stretch" && "items-stretch",
							justify === "center" && "justify-center",
							justify === "start" && "justify-start",
							justify === "end" && "justify-end",
							justify === "between" && "justify-between",
							className,
						)}
						style={{ padding: padding ? `${padding * 4}px` : undefined }}
					>
						{children}
					</div>
				</div>
			);
		},

		Card: ({ props, children }) => {
			const { className } = props;
			const title = toSafeOptionalText(props.title);
			const description = toSafeOptionalText(props.description);
			const href = toSafeOptionalText(props.href);
			const childCount = Children.count(children);
			const card = (
				<Card className={cn(href && "no-underline transition-colors hover:bg-surface-hovered", className ?? undefined)}>
					{title || description ? (
						<CardHeader>
							{title ? <CardTitle>{title}</CardTitle> : null}
							{description ? <CardDescription>{description}</CardDescription> : null}
						</CardHeader>
					) : null}
					<CardContent>{childCount > 1 ? <div className="flex flex-col gap-2">{children}</div> : children}</CardContent>
				</Card>
			);
			if (href) {
				return (
					<a href={href} className="no-underline" target="_blank" rel="noopener noreferrer">
						{card}
					</a>
				);
			}
			return card;
		},

		Grid: ({ props, children }) => {
			const { columns = "2", gap = "md", className } = props;
			return (
				<div className="@container/grid">
					<div className={cn("grid", GRID_COL_CLASSES[columns ?? "2"], GAP_CLASSES[gap ?? "md"], className)}>{children}</div>
				</div>
			);
		},

		AspectRatio: ({ props, children }) => {
			return (
				<AspectRatio ratio={props.ratio}>
					{children}
				</AspectRatio>
			);
		},

		ScrollArea: ({ props, children }) => {
			const { maxHeight, className } = props;
			return (
				<ScrollArea className={cn(className)} style={maxHeight ? { maxHeight } : undefined}>
					{children}
				</ScrollArea>
			);
		},

		Carousel: ({ props, children }) => {
			const { orientation = "horizontal" } = props;
			const childArray = Children.toArray(children);
			return (
				<Carousel orientation={nu(orientation)} className="w-full">
					<CarouselContent>
						{childArray.map((child, i) => (
							<CarouselItem key={i}>{child}</CarouselItem>
						))}
					</CarouselContent>
					<CarouselPrevious />
					<CarouselNext />
				</Carousel>
			);
		},

		// ── Typography ─────────────────────────────────
		Heading: ({ props }) => {
			const { level, className } = props;
			const text = toSafeText(props.text);
			const normalizedLevel = normalizeHeadingLevel(level);
			const Tag = normalizedLevel;
			const normalizedText = text.trim().toLowerCase();
			const sizes: Record<string, string> = {
				h1: "text-2xl font-bold @[480px]/stack:text-3xl",
				h2: "text-xl font-semibold @[480px]/stack:text-2xl",
				h3: "text-lg font-semibold @[480px]/stack:text-xl",
				h4: "text-lg font-medium",
			};
			const headingSizeClass =
				normalizedLevel === "h4" && normalizedText === "child elements"
					? "text-sm font-medium"
					: sizes[normalizedLevel];
			return <Tag className={cn(headingSizeClass, "text-text", className)}>{text}</Tag>;
		},

		Text: ({ props }) => {
			const { muted, size = "sm" } = props;
			const content = toSafeText(props.content);
			const normalizedContent = content.trim().toLowerCase();
			const isFigmaFrameDimensionsRow = normalizedContent.startsWith("frame dimensions:");
			if (hasMermaidFenceBlock(content)) {
				return (
					<div className="rounded-md border border-border bg-surface p-3">
						<MessageResponse plain mode="static" controls={false} className="text-sm [&_p]:m-0">
							{content}
						</MessageResponse>
					</div>
				);
			}
			const sizeClass =
				size === "xs"
					? "text-xs"
					: size === "base"
						? isFigmaFrameDimensionsRow
							? "text-sm"
							: "text-base"
						: "text-sm";
			const textToneClass = isFigmaFrameDimensionsRow
				? "text-muted-foreground"
				: muted
					? "text-text-subtlest"
					: "text-text-subtle";
			return (
				<p className={cn(sizeClass, textToneClass, isFigmaFrameDimensionsRow ? "-mt-3" : undefined)}>
					{content}
				</p>
			);
		},

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

		// ── Compound ──────────────────────────────────
		FigmaDesignContext: ({ props }) => {
			const figmaUrl = toSafeOptionalText(props.figmaUrl);
			const code = toSafeOptionalText(props.code);
			const codeLanguage = toSafeOptionalText(props.codeLanguage) || "tsx";
			const links = Array.isArray(props.links) ? props.links : [];

			if (!figmaUrl && !code && links.length === 0) {
				return null;
			}

			return (
				<div className="flex flex-col gap-4">
					{figmaUrl ? (
						<a
							href={figmaUrl}
							className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							Open in Figma ↗
						</a>
					) : null}
					{code ? (
						<CustomCodeBlock
							code={code}
							language={codeLanguage as BundledLanguage}
						/>
					) : null}
					{links.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{links.map((link, i) => (
								<a
									key={`${link.href}-${i}`}
									href={link.href}
									className="text-sm text-link hover:underline"
									target="_blank"
									rel="noopener noreferrer"
								>
									{link.text}
								</a>
							))}
						</div>
					) : null}
				</div>
			);
		},

		WorkSummary: ({ props }) => {
			const { jiraItems, confluencePages } = props;
			const workItemsCount = jiraItems.length;
			const pagesCount = confluencePages.length;
			const totalCount = workItemsCount + pagesCount;

			const STATUS_CATEGORY_VARIANT: Record<string, LozengeProps["variant"]> = {
				done: "success",
				inprogress: "information",
				todo: "neutral",
				blocked: "danger",
			};

			const [activeTab, setActiveTab] = useState("work-items");

			return (
				<div className="flex flex-col gap-4">
					{/* Metrics row */}
					<div className="@container/grid">
						<div className="grid grid-cols-1 gap-3 @[480px]/grid:grid-cols-3">
							<Card>
								<CardContent className="flex flex-col items-center gap-1 text-center">
									<p className="text-xs text-text-subtlest">Work Items</p>
									<p className="text-2xl font-semibold text-text">{workItemsCount}</p>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="flex flex-col items-center gap-1 text-center">
									<p className="text-xs text-text-subtlest">Pages</p>
									<p className="text-2xl font-semibold text-text">{pagesCount}</p>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="flex flex-col items-center gap-1 text-center">
									<p className="text-xs text-text-subtlest">Total Activity</p>
									<p className="text-2xl font-semibold text-text">{totalCount}</p>
								</CardContent>
							</Card>
						</div>
					</div>

					{/* Bar chart */}
					{workItemsCount > 0 && pagesCount > 0 ? (
						<ChartContainer
							config={{
								count: { label: "Count", color: "var(--color-chart-1)" },
							}}
							className="min-h-[200px] w-full"
							style={{ height: 220 }}
						>
							<RechartsBarChart
								data={[
									{ source: "Work Items", count: workItemsCount },
									{ source: "Pages", count: pagesCount },
								]}
							>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="source" tick={{ fontSize: 12 }} />
								<YAxis tick={{ fontSize: 12 }} />
								<ChartTooltip content={<ChartTooltipContent />} />
								<Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
							</RechartsBarChart>
						</ChartContainer>
					) : null}

					{/* Tabbed detail lists */}
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="w-full overflow-x-auto">
							<TabsTrigger value="work-items">Work Items</TabsTrigger>
							<TabsTrigger value="pages">Pages</TabsTrigger>
						</TabsList>
						<TabsContent value="work-items">
							{jiraItems.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-subtle">
									No work items in this period.
								</div>
							) : (
								<div className="flex flex-col gap-2">
									{jiraItems.map((item, i) => {
										const lozengeVariant = item.statusCategory
											? STATUS_CATEGORY_VARIANT[item.statusCategory] ?? "neutral"
											: "neutral";
										return (
											<Card key={item.key ? `${item.key}-${i}` : i} className={item.url ? "no-underline transition-colors hover:bg-surface-hovered" : undefined}>
												<CardContent className="flex flex-col gap-1.5">
													<div className="flex items-start justify-between gap-2">
														<div className="flex-1">
															{item.url ? (
																<a href={item.url} className="text-sm font-medium text-link hover:underline" target="_blank" rel="noopener noreferrer">
																	{item.key} — {item.summary}
																</a>
															) : (
																<p className="text-sm font-medium text-text">
																	{item.key} — {item.summary}
																</p>
															)}
														</div>
														<Lozenge variant={lozengeVariant} isBold>
															{item.status}
														</Lozenge>
													</div>
													<div className="flex flex-wrap items-center gap-2">
														{item.priority ? <Badge variant="neutral">{item.priority}</Badge> : null}
														{item.type ? (
															<TagPrimitive color="blue">{item.type}</TagPrimitive>
														) : null}
														{item.updated ? (
															<span className="text-xs text-text-subtlest">Updated {item.updated}</span>
														) : null}
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							)}
						</TabsContent>
						<TabsContent value="pages">
							{confluencePages.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-subtle">
									No pages in this period.
								</div>
							) : (
								<div className="flex flex-col gap-2">
									{confluencePages.map((page, i) => (
										<Card key={page.title ? `${page.title}-${i}` : i} className={page.url ? "no-underline transition-colors hover:bg-surface-hovered" : undefined}>
											<CardContent className="flex flex-col gap-1.5">
												{page.url ? (
													<a href={page.url} className="text-sm font-medium text-link hover:underline" target="_blank" rel="noopener noreferrer">
														{page.title}
													</a>
												) : (
													<p className="text-sm font-medium text-text">{page.title}</p>
												)}
												<div className="flex flex-wrap items-center gap-2">
													{page.space ? (
														<TagPrimitive color="teal">{page.space}</TagPrimitive>
													) : null}
													{page.lastModified ? (
														<span className="text-xs text-text-subtlest">Modified {page.lastModified}</span>
													) : null}
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</TabsContent>
					</Tabs>
				</div>
			);
		},

		// ── Charts ─────────────────────────────────────
		BarChart: ({ props }) => {
			const { xKey, yKey, aggregate, color, height } = props;
			const title = toSafeOptionalText(props.title);
			const rawData = toDataArray(props.data);
			const { items, valueKey } = processChartData(rawData, xKey, yKey, aggregate);
			const fillColor = color ?? "var(--color-chart-1)";
			const config: ChartConfig = { [valueKey]: { label: valueKey, color: fillColor } };
			return (
				<div>
					{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
					<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
						<RechartsBarChart data={items}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey={aggregate ? "label" : xKey} tick={{ fontSize: 12 }} />
							<YAxis tick={{ fontSize: 12 }} />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Bar dataKey={valueKey} fill={fillColor} radius={[4, 4, 0, 0]} />
						</RechartsBarChart>
					</ChartContainer>
				</div>
			);
		},

		LineChart: ({ props }) => {
			const { xKey, yKey, aggregate, color, height } = props;
			const title = toSafeOptionalText(props.title);
			const rawData = toDataArray(props.data);
			const { items, valueKey } = processChartData(rawData, xKey, yKey, aggregate);
			const strokeColor = color ?? "var(--color-chart-1)";
			const config: ChartConfig = { [valueKey]: { label: valueKey, color: strokeColor } };
			return (
				<div>
					{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
					<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
						<RechartsLineChart data={items}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey={aggregate ? "label" : xKey} tick={{ fontSize: 12 }} />
							<YAxis tick={{ fontSize: 12 }} />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Line type="monotone" dataKey={valueKey} stroke={strokeColor} strokeWidth={2} dot={false} />
						</RechartsLineChart>
					</ChartContainer>
				</div>
			);
		},

		PieChart: ({ props }) => {
			const { nameKey, valueKey, height } = props;
			const title = toSafeOptionalText(props.title);
			const rawData = toDataArray(props.data);
			const config: ChartConfig = {};
			for (let i = 0; i < rawData.length; i++) {
				const name = String(rawData[i][nameKey] ?? `item-${i}`);
				config[name] = { label: name, color: PIE_COLORS[i % PIE_COLORS.length] };
			}
			return (
				<div>
					{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
					<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
						<RechartsPieChart>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Pie data={rawData} nameKey={nameKey} dataKey={valueKey} cx="50%" cy="50%" outerRadius={80} label>
								{rawData.map((entry, i: number) => (
									<Cell key={String(entry[nameKey] ?? i)} fill={PIE_COLORS[i % PIE_COLORS.length]} />
								))}
							</Pie>
						</RechartsPieChart>
					</ChartContainer>
				</div>
			);
		},

		// ── Interactive ────────────────────────────────
		Tabs: ({ props, children }) => {
			const { tabs, defaultValue } = props;
			return (
				<Tabs defaultValue={toSafeOptionalText(defaultValue) || toSafeOptionalText(tabs[0]?.value)}>
					<TabsList className="w-full overflow-x-auto">
						{tabs.map((tab: { value: string; label: string }) => (
							<TabsTrigger key={toSafeText(tab.value)} value={toSafeText(tab.value)}>
								{toSafeText(tab.label)}
							</TabsTrigger>
						))}
					</TabsList>
					{children}
				</Tabs>
			);
		},

		TabContent: ({ props, children }) => {
			const { value } = props;
			return <TabsContent value={value}>{children}</TabsContent>;
		},

		Progress: ({ props }) => {
			const { value, max = 100, label } = props;
			const maxVal = max ?? 100;
			const percentage = maxVal > 0 ? (value / maxVal) * 100 : 0;
			return (
				<div className="space-y-1">
					{label ? <p className="text-sm text-text-subtle">{toSafeText(label)}</p> : null}
					<Progress value={percentage} />
				</div>
			);
		},

		Skeleton: ({ props }) => {
			const { width, height, className } = props;
			return <Skeleton className={className ?? undefined} style={{ width: width ?? undefined, height: height ?? undefined }} />;
		},

		Callout: ({ props }) => {
			const { type = "info" } = props;
			const title = toSafeOptionalText(props.title);
			const content = toSafeText(props.content);
			const icon = toSafeOptionalText(props.icon);
			const colorMap: Record<string, string> = {
				info: "border-border-information bg-bg-information",
				warning: "border-border-warning bg-bg-warning",
				success: "border-border-success bg-bg-success",
				error: "border-border-danger bg-bg-danger",
			};
			const iconMap: Record<string, string> = {
				info: "\u2139\uFE0F",
				warning: "\u26A0\uFE0F",
				success: "\u2705",
				error: "\u274C",
			};
			return (
				<div className={cn("rounded-lg border p-4", colorMap[type ?? "info"] || colorMap.info)}>
					<div className="flex gap-2">
						{icon ? <span className="shrink-0">{icon}</span> : (type ?? "info") in iconMap ? <span className="shrink-0">{iconMap[type ?? "info"]}</span> : null}
						<div>
							{title ? <p className="text-sm font-medium text-text">{title}</p> : null}
							<p className="text-sm text-text-subtle">{content}</p>
						</div>
					</div>
				</div>
			);
		},

		Accordion: ({ props }) => {
			const { items } = props;
			return (
				<Accordion>
					{items.map((item: { title: string; content: string }) => {
						const title = toSafeText(item.title);
						const content = toSafeText(item.content);
						const itemKey = `${title}-${content.slice(0, 64)}`;
						return (
							<AccordionItem key={itemKey} value={itemKey}>
								<AccordionTrigger>{title}</AccordionTrigger>
								<AccordionContent>
									{(() => {
										const fileTreeData = parseDirectoryTreeText(content);
										if (fileTreeData) {
											return (
												<div className="rounded-md border border-border bg-surface p-2">
													<FileTreeRoot
														className="bg-transparent text-xs"
														defaultExpanded={new Set(fileTreeData.defaultExpandedPaths)}
													>
														{fileTreeData.roots.map((node) => renderFileTreeNode(node))}
													</FileTreeRoot>
												</div>
											);
										}

										const tagTaxonomy = /tag taxonomy/i.test(title)
											? parseTagTaxonomyText(content)
											: null;
										if (tagTaxonomy) {
											return (
												<div className="space-y-3">
													{tagTaxonomy.map((group) => (
														<div key={group.label} className="space-y-1.5">
															<div className="text-xs font-medium text-text-subtlest">
																{group.label}
															</div>
															<TagGroup className="gap-1.5">
																{group.tags.map((tag) => (
																	<TagPrimitive
																		key={`${group.label}-${tag}`}
																		color={group.color}
																		variant="rounded"
																	>
																		{tag}
																	</TagPrimitive>
																))}
															</TagGroup>
														</div>
													))}
												</div>
											);
										}

										return content;
									})()}
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
			);
		},

		AccordionForm: ({ props, children }) => {
			const { items, defaultOpenValues } = props;
			const childArray = Children.toArray(children);
			return (
				<Accordion defaultValue={defaultOpenValues ?? undefined}>
					{items.map((item: { value: string; title: string }, i: number) => (
						<AccordionItem key={item.value} value={item.value}>
							<AccordionTrigger>{toSafeText(item.title)}</AccordionTrigger>
							<AccordionContent>
								{childArray[i] ?? null}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			);
		},

		Timeline: ({ props }) => {
			const { items } = props;
			return (
				<div className="flex flex-col">
					{items.map((item, i) => (
						<div key={i} className="flex gap-3">
							<div className="flex flex-col items-center">
								<div className="flex h-5 shrink-0 items-center justify-center">
									<NodeIcon label="" size="small" color={token("color.icon.subtlest")} />
								</div>
								{i < items.length - 1 ? <div className="w-px flex-1 bg-border" /> : null}
							</div>
							<div className="pb-4">
								<p className="text-sm font-medium leading-5 text-text">{toSafeText(item.title)}</p>
								{item.description ? <p className="text-xs text-text-subtle">{toSafeText(item.description)}</p> : null}
								{item.date ? <p className="mt-0.5 text-xs text-text-subtlest">{toSafeText(item.date)}</p> : null}
							</div>
						</div>
					))}
				</div>
			);
		},

		CalendarTimeline: ({ props }) => {
			const { events } = props;
			const colorMap: Record<string, { dot: string; bar: string; bg: string }> = {
				blue: { dot: "bg-blue-500", bar: "bg-blue-500/30", bg: "bg-blue-500/8" },
				green: { dot: "bg-green-500", bar: "bg-green-500/30", bg: "bg-green-500/8" },
				red: { dot: "bg-red-500", bar: "bg-red-500/30", bg: "bg-red-500/8" },
				purple: { dot: "bg-purple-500", bar: "bg-purple-500/30", bg: "bg-purple-500/8" },
				yellow: { dot: "bg-yellow-500", bar: "bg-yellow-500/30", bg: "bg-yellow-500/8" },
				teal: { dot: "bg-teal-500", bar: "bg-teal-500/30", bg: "bg-teal-500/8" },
			};
			return (
				<div className="flex flex-col">
					{events.map((event, i) => {
						const c = colorMap[toSafeText(event.color)] ?? colorMap.blue;
						const isCurrent = event.status === "current";
						const isPast = event.status === "past";
						return (
							<div key={i} className="flex gap-3">
								{/* Time column */}
								<div className="flex w-16 shrink-0 justify-end pt-2.5">
									<span className={cn("text-xs font-medium tabular-nums", isPast ? "text-text-subtlest" : "text-text-subtle")}>
										{toSafeText(event.time)}
									</span>
								</div>
								{/* Timeline rail */}
								<div className="flex flex-col items-center">
									<div className="flex h-8 shrink-0 items-center justify-center">
										<div
											className={cn(
												"rounded-full transition-all",
												isCurrent ? "h-3 w-3 ring-2 ring-offset-1 ring-offset-surface" : "h-2 w-2",
												isCurrent ? cn(c.dot, "ring-blue-500/40") : isPast ? "bg-text-subtlest" : c.dot,
											)}
										/>
									</div>
									{i < events.length - 1 ? <div className={cn("w-px flex-1", isPast ? "bg-border" : c.bar)} /> : null}
								</div>
								{/* Event card */}
								<div className={cn("mb-2 flex-1 rounded-lg border px-3 py-2", isCurrent ? cn("border-blue-500/30", c.bg) : "border-border bg-surface")}>
									<p className={cn("text-sm font-medium", isPast ? "text-text-subtle" : "text-text")}>
										{toSafeText(event.title)}
									</p>
									<div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
										{event.duration ? (
											<span className="text-xs text-text-subtlest">{toSafeText(event.duration)}</span>
										) : null}
										{event.location ? (
											<span className="text-xs text-text-subtlest">{toSafeText(event.location)}</span>
										) : null}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			);
		},

		RadioGroup: ({ props, bindings }) => {
			const { options, label } = props;
			const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value);
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<RadioGroup value={value ?? ""} onValueChange={setValue}>
						{options.map((opt) => (
							<div key={toSafeText(opt.value)} className="flex items-center gap-2">
								<RadioGroupItem value={toSafeText(opt.value)} />
								<Label className="font-normal">{toSafeText(opt.label)}</Label>
							</div>
						))}
					</RadioGroup>
				</div>
			);
		},

		SelectInput: ({ props, bindings }) => {
			const { options, placeholder, label } = props;
			const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value);
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<Select
						value={value ?? ""}
						onValueChange={(v) => {
							if (v !== null) setValue(v);
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder={toSafeOptionalText(placeholder) ?? "Select..."} />
						</SelectTrigger>
						<SelectContent>
							{options.map((opt) => (
								<SelectItem key={toSafeText(opt.value)} value={toSafeText(opt.value)}>
									{toSafeText(opt.label)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			);
		},

		TextInput: ({ props, bindings }) => {
			const { placeholder, label, type = "text" } = props;
			const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value);
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<Input type={nu(type)} placeholder={toSafeOptionalText(placeholder)} value={value ?? ""} onChange={(e) => setValue(e.target.value)} />
				</div>
			);
		},

		Button: ({ props, emit }) => {
			const { label, variant = "default", size = "default", disabled } = props;
			return (
				<Button variant={variant} size={size} disabled={disabled ?? false} onClick={() => emit("press")}>
					{toSafeText(label)}
				</Button>
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
				<CustomCodeBlock
					code={code}
					language={(language ?? "text") as BundledLanguage}
				/>
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

		// ── Layout (extended) ─────────────────────────
		Breadcrumb: ({ props }) => {
			const { items } = props;
			return (
				<BreadcrumbRoot>
					<BreadcrumbList>
						{items.map((item, i) => (
							<Fragment key={`crumb-${i}`}>
								{i > 0 ? <BreadcrumbSeparator /> : null}
								<BreadcrumbItem>
									{item.href && i < items.length - 1 ? (
										<BreadcrumbLink href={toSafeText(item.href)}>{toSafeText(item.label)}</BreadcrumbLink>
									) : (
										<BreadcrumbPage>{toSafeText(item.label)}</BreadcrumbPage>
									)}
								</BreadcrumbItem>
							</Fragment>
						))}
					</BreadcrumbList>
				</BreadcrumbRoot>
			);
		},

		PageHeader: ({ props }) => {
			const { title, description } = props;
			return <PageHeader title={toSafeText(title)} description={toSafeOptionalText(description)} />;
		},

		ButtonGroup: ({ props, children }) => {
			const { orientation = "horizontal" } = props;
			return <ButtonGroupPrimitive orientation={orientation}>{children}</ButtonGroupPrimitive>;
		},

		ProgressBar: ({ props }) => {
			const { value, label, appearance = "default" } = props;
			return (
				<ProgressBar value={value} variant={nu(appearance)}>
					{label ? <ProgressBarLabel>{toSafeText(label)}</ProgressBarLabel> : null}
				</ProgressBar>
			);
		},

		ProgressTracker: ({ props }) => {
			const steps = props.steps.map((step) => ({
				id: toSafeText(step.id),
				label: toSafeText(step.label),
				state: (step.state ?? "todo") as "todo" | "current" | "done",
			}));
			return <ProgressTracker steps={steps} />;
		},

		// ── Interactive (extended) ────────────────────
		Checkbox: ({ props, bindings }) => {
			const { label, disabled } = props;
			const [checked, setChecked] = useBoundProp<boolean>(nu(props.checked), bindings?.checked);
			return (
				<div className="flex items-center gap-2">
					<CheckboxPrimitive checked={checked ?? false} onCheckedChange={(v) => setChecked(v as boolean)} disabled={nu(disabled)} />
					{label ? <Label className="font-normal">{toSafeText(label)}</Label> : null}
				</div>
			);
		},

		Switch: ({ props, bindings }) => {
			const { label, size = "default", disabled } = props;
			const [checked, setChecked] = useBoundProp<boolean>(nu(props.checked), bindings?.checked);
			return (
				<div className="flex items-center gap-2">
					<SwitchPrimitive checked={checked ?? false} onCheckedChange={setChecked} size={nu(size)} disabled={nu(disabled)} />
					{label ? <Label className="font-normal">{toSafeText(label)}</Label> : null}
				</div>
			);
		},

		TextArea: ({ props, bindings }) => {
			const { placeholder, label, rows = 3 } = props;
			const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<Textarea placeholder={toSafeOptionalText(placeholder)} value={value ?? ""} onChange={(e) => setValue(e.target.value)} rows={nu(rows)} />
				</div>
			);
		},

		Slider: ({ props, bindings }) => {
			const { min = 0, max = 100, step = 1, label } = props;
			const [value, setValue] = useBoundProp<number>(nu(props.value), bindings?.value);
			const displayValue = value ?? min ?? 0;
			return (
				<div className="space-y-2">
					{label ? (
						<div className="flex items-center justify-between">
							<Label>{toSafeText(label)}</Label>
							<span className="text-xs tabular-nums text-text-subtle">{displayValue}</span>
						</div>
					) : null}
					<SliderPrimitive value={[displayValue]} onValueChange={(v) => setValue(Array.isArray(v) ? v[0] : v)} min={nu(min)} max={nu(max)} step={nu(step)} />
				</div>
			);
		},

		Toggle: ({ props, bindings }) => {
			const { text, variant = "default", size = "default" } = props;
			const [pressed, setPressed] = useBoundProp<boolean>(nu(props.pressed), bindings?.pressed);
			return (
				<TogglePrimitive variant={variant} size={size} pressed={pressed ?? false} onPressedChange={setPressed}>
					{toSafeText(text)}
				</TogglePrimitive>
			);
		},

		ToggleGroup: ({ props, bindings }) => {
			const { options, type = "single" } = props;
			const [value, setValue] = useBoundProp<string | string[]>(nu(props.value), bindings?.value);
			const arrayValue = type === "multiple" ? (Array.isArray(value) ? value : value ? [value] : []) : typeof value === "string" && value ? [value] : [];
			return (
				<ToggleGroupPrimitive
					value={arrayValue}
					onValueChange={(v: string[]) => {
						if (type === "multiple") {
							setValue(v);
						} else {
							setValue(v[0] ?? "");
						}
					}}
				>
					{options.map((opt: { label: string; value: string }) => (
						<ToggleGroupItem key={toSafeText(opt.value)} value={toSafeText(opt.value)}>
							{toSafeText(opt.label)}
						</ToggleGroupItem>
					))}
				</ToggleGroupPrimitive>
			);
		},

		// ── Overlay & Trigger ─────────────────────────
		Collapsible: ({ props, children }) => {
			const { title, defaultOpen } = props;
			return (
				<CollapsibleRoot defaultOpen={nu(defaultOpen)}>
					<CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-text hover:bg-bg-neutral-hovered">
						{toSafeText(title)}
					</CollapsibleTrigger>
					<CollapsibleContent className="px-3 pb-2">
						{children}
					</CollapsibleContent>
				</CollapsibleRoot>
			);
		},

		Tooltip: ({ props, children }) => {
			const text = toSafeText(props.text);
			return (
				<TooltipProvider>
					<TooltipRoot>
						<TooltipTrigger render={<span className="inline-flex cursor-default" />}>
							{children}
						</TooltipTrigger>
						<TooltipContent>{text}</TooltipContent>
					</TooltipRoot>
				</TooltipProvider>
			);
		},

		Dialog: ({ props, children }) => {
			const { triggerLabel, title, description, size = "sm", triggerVariant = "default" } = props;
			return (
				<DialogRoot>
					<DialogTrigger render={<Button variant={nu(triggerVariant)} />}>
						{toSafeText(triggerLabel)}
					</DialogTrigger>
					<DialogContent size={nu(size)}>
						{title || description ? (
							<DialogHeader>
								{title ? <DialogTitle>{toSafeText(title)}</DialogTitle> : null}
								{description ? <DialogDescription>{toSafeText(description)}</DialogDescription> : null}
							</DialogHeader>
						) : null}
						{children}
					</DialogContent>
				</DialogRoot>
			);
		},

		// ── Form Inputs (extended) ────────────────────────
		DatePicker: ({ props, bindings }) => {
			const { placeholder, label, disabled } = props;
			const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
			const dateValue = value ? new Date(value) : undefined;
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<DatePickerPrimitive
						value={dateValue}
						onChange={(date) => setValue(date ? date.toISOString().split("T")[0] : "")}
						placeholder={toSafeOptionalText(placeholder)}
						disabled={nu(disabled)}
					/>
				</div>
			);
		},

		TimePicker: ({ props, bindings }) => {
			const { placeholder, label, stepMinutes, disabled } = props;
			const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
			const step = stepMinutes ? (Number(stepMinutes) as 15 | 30 | 60) : undefined;
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<TimePickerPrimitive
						value={value ?? undefined}
						onChange={setValue}
						placeholder={toSafeOptionalText(placeholder)}
						stepMinutes={step}
						disabled={nu(disabled)}
					/>
				</div>
			);
		},

		DateTimePicker: ({ props, bindings }) => {
			const { label, disabled } = props;
			const [date, setDate] = useBoundProp<string>(nu(props.date), bindings?.date);
			const [time, setTime] = useBoundProp<string>(nu(props.time), bindings?.time);
			const dateValue = date ? new Date(date) : undefined;
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<DateTimePickerPrimitive
						value={{ date: dateValue, time: time ?? undefined }}
						onChange={(val) => {
							setDate(val.date ? val.date.toISOString().split("T")[0] : "");
							setTime(val.time ?? "");
						}}
						disabled={nu(disabled)}
					/>
				</div>
			);
		},

		InlineEdit: ({ props, bindings }) => {
			const { label, placeholder } = props;
			const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
			return (
				<InlineEditPrimitive
					value={value ?? ""}
					onConfirm={setValue}
					label={toSafeOptionalText(label)}
					placeholder={toSafeOptionalText(placeholder)}
				/>
			);
		},

		InputOTP: ({ props, bindings }) => {
			const { length, label } = props;
			const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
			const slotCount = length ?? 6;
			return (
				<div className="space-y-2">
					{label ? <Label>{toSafeText(label)}</Label> : null}
					<InputOTPRoot maxLength={slotCount} value={value ?? ""} onChange={(v) => setValue(v)}>
						<InputOTPGroup>
							{Array.from({ length: slotCount }, (_, i) => (
								<InputOTPSlot key={i} index={i} />
							))}
						</InputOTPGroup>
					</InputOTPRoot>
				</div>
			);
		},

		Calendar: ({ props, bindings }) => {
			const { label } = props;
			const [selected, setSelected] = useBoundProp<string>(nu(props.selected), bindings?.selected);
			const dateValue = selected ? new Date(selected) : undefined;
			return (
				<div className="space-y-2">
					{label ? <p className="text-sm font-medium text-text">{toSafeText(label)}</p> : null}
					<CalendarPrimitive
						mode="single"
						selected={dateValue}
						onSelect={(date) => setSelected(date ? date.toISOString().split("T")[0] : "")}
					/>
				</div>
			);
		},

		// ── Navigation ────────────────────────────────────
		Pagination: ({ props, bindings }) => {
			const { totalPages } = props;
			const [currentPage, setCurrentPage] = useBoundProp<number>(props.currentPage ?? 1, bindings?.currentPage);
			const page = currentPage ?? 1;
			const pages: (number | "ellipsis")[] = [];
			for (let i = 1; i <= totalPages; i++) {
				if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
					pages.push(i);
				} else if (pages[pages.length - 1] !== "ellipsis") {
					pages.push("ellipsis");
				}
			}
			return (
				<PaginationRoot>
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(Math.max(1, page - 1)); }} />
						</PaginationItem>
						{pages.map((p, i) =>
							p === "ellipsis" ? (
								<PaginationItem key={`e-${i}`}>
									<PaginationEllipsis />
								</PaginationItem>
							) : (
								<PaginationItem key={p}>
									<PaginationLink isActive={p === page} href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p as number); }}>
										{p}
									</PaginationLink>
								</PaginationItem>
							),
						)}
						<PaginationItem>
							<PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(Math.min(totalPages, page + 1)); }} />
						</PaginationItem>
					</PaginationContent>
				</PaginationRoot>
			);
		},

		// ── Charts (extended) ─────────────────────────
		AreaChart: ({ props }) => {
			const { xKey, yKey, aggregate, color, height } = props;
			const title = toSafeOptionalText(props.title);
			const rawData = toDataArray(props.data);
			const { items, valueKey } = processChartData(rawData, xKey, yKey, aggregate);
			const fillColor = color ?? "var(--color-chart-1)";
			const config: ChartConfig = { [valueKey]: { label: valueKey, color: fillColor } };
			return (
				<div>
					{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
					<ChartContainer config={config} className="min-h-[200px] w-full" style={height ? { height } : undefined}>
						<RechartsAreaChart data={items}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey={aggregate ? "label" : xKey} tick={{ fontSize: 12 }} />
							<YAxis tick={{ fontSize: 12 }} />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Area type="monotone" dataKey={valueKey} stroke={fillColor} fill={fillColor} fillOpacity={0.2} strokeWidth={2} />
						</RechartsAreaChart>
					</ChartContainer>
				</div>
			);
		},

		RadarChart: ({ props }) => {
			const { data, dataKey, categories, colors } = props;
			const title = toSafeOptionalText(props.title);
			const config: ChartConfig = {};
			for (let i = 0; i < categories.length; i++) {
				config[categories[i]] = { label: toSafeText(categories[i]), color: colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length] };
			}
			return (
				<div>
					{title ? <p className="mb-2 text-sm font-medium text-text">{title}</p> : null}
					<ChartContainer config={config} className="min-h-[200px] w-full">
						<RechartsRadarChart data={data as Record<string, unknown>[]}>
							<PolarGrid />
							<PolarAngleAxis dataKey={dataKey} tick={{ fontSize: 12 }} />
							<PolarRadiusAxis tick={{ fontSize: 10 }} />
							<ChartTooltip content={<ChartTooltipContent />} />
							{categories.map((cat: string, i: number) => (
								<Radar key={cat} name={cat} dataKey={cat} stroke={colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length]} fill={colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.2} />
							))}
						</RechartsRadarChart>
					</ChartContainer>
				</div>
			);
		},

		// ── 3D ─────────────────────────────────────────
		Scene3D: ({ props, children }) => (
			<Suspense
				fallback={
					<div className="flex items-center justify-center bg-bg-neutral rounded-lg" style={{ height: nu(props.height) }}>
						Loading 3D scene...
					</div>
				}
			>
				<Scene3DImpl props={{ background: nu(props.background), cameraPosition: nu(props.cameraPosition), height: nu(props.height), orbitControls: nu(props.orbitControls) }}>{children}</Scene3DImpl>
			</Suspense>
		),

		Group3D: ({ props, children }) => (
			<group position={nu(props.position)} rotation={nu(props.rotation)} userData={{ animate: props.animate }}>
				{children}
			</group>
		),

		Box: ({ props }) => (
			<mesh position={nu(props.position)}>
				<boxGeometry args={props.size ?? [1, 1, 1]} />
				<meshStandardMaterial color={nu(props.color)} />
			</mesh>
		),

		Sphere: ({ props }) => (
			<mesh position={nu(props.position)}>
				<sphereGeometry args={[nu(props.radius), 32, 32]} />
				<meshStandardMaterial color={nu(props.color)} />
			</mesh>
		),

		Cylinder: ({ props }) => (
			<mesh position={nu(props.position)}>
				<cylinderGeometry args={[nu(props.radiusTop), nu(props.radiusBottom), nu(props.height), 32]} />
				<meshStandardMaterial color={nu(props.color)} />
			</mesh>
		),

		Cone: ({ props }) => (
			<mesh position={nu(props.position)}>
				<coneGeometry args={[nu(props.radius), nu(props.height), 32]} />
				<meshStandardMaterial color={nu(props.color)} />
			</mesh>
		),

		Torus: ({ props }) => (
			<mesh position={nu(props.position)}>
				<torusGeometry args={[nu(props.radius), nu(props.tube), 16, 48]} />
				<meshStandardMaterial color={nu(props.color)} />
			</mesh>
		),

		Plane: ({ props }) => (
			<mesh position={nu(props.position)} rotation={nu(props.rotation)}>
				<planeGeometry args={props.size ?? [10, 10]} />
				<meshStandardMaterial color={nu(props.color)} />
			</mesh>
		),

		Ring: ({ props }) => (
			<mesh position={nu(props.position)} rotation={nu(props.rotation)}>
				<ringGeometry args={[nu(props.innerRadius), nu(props.outerRadius), 32]} />
				<meshStandardMaterial color={nu(props.color)} side={2} />
			</mesh>
		),

		AmbientLight: ({ props }) => <ambientLight intensity={nu(props.intensity)} color={nu(props.color)} />,

		PointLight: ({ props }) => <pointLight position={nu(props.position)} intensity={nu(props.intensity)} color={nu(props.color)} />,

		DirectionalLight: ({ props }) => <directionalLight position={nu(props.position)} intensity={nu(props.intensity)} color={nu(props.color)} />,

		Stars: ({ props }) => (
			<Suspense fallback={null}>
				<StarsImpl count={nu(props.count)} radius={nu(props.radius)} depth={nu(props.depth)} />
			</Suspense>
		),

		Label3D: ({ props }) => (
			<Suspense fallback={null}>
				<Label3DImpl text={toSafeText(props.text)} position={nu(props.position)} color={nu(props.color)} fontSize={nu(props.fontSize)} />
			</Suspense>
		),
	},
	actions: {
		push: async (params, setState) => {
			if (!params) return;
			setState((prev) => {
				const currentScreenValue = getByPath(prev, "/currentScreen");
				const currentScreen = typeof currentScreenValue === "string" ? currentScreenValue : "";
				const navStackValue = getByPath(prev, "/navStack");
				const navStack = Array.isArray(navStackValue) ? navStackValue : [];
				const next = cloneStateModel(prev);
				setByPath(next, "/navStack", [...navStack, currentScreen]);
				setByPath(next, "/currentScreen", params.screen);
				return next;
			});
		},
		pop: async (_params, setState) => {
			setState((prev) => {
				const navStackValue = getByPath(prev, "/navStack");
				if (!Array.isArray(navStackValue) || navStackValue.length === 0) {
					return prev;
				}

				const next = cloneStateModel(prev);
				const previousScreen = navStackValue[navStackValue.length - 1];
				setByPath(next, "/navStack", navStackValue.slice(0, -1));
				setByPath(next, "/currentScreen", typeof previousScreen === "string" ? previousScreen : "");
				return next;
			});
		},
	},
});

// ── Lazy wrappers for drei components ──────────────────────────
const StarsImpl = lazy(() =>
	import("@react-three/drei").then((mod) => ({
		default: (p: { count?: number; radius?: number; depth?: number }) => <mod.Stars count={p.count} radius={p.radius} depth={p.depth} />,
	})),
);

const Label3DImpl = lazy(() =>
	import("@react-three/drei").then((mod) => ({
		default: (p: { text: string; position?: [number, number, number]; color?: string; fontSize?: number }) => (
			<mod.Text position={p.position} color={p.color} fontSize={p.fontSize} anchorX="center" anchorY="middle">
				{p.text}
			</mod.Text>
		),
	})),
);
