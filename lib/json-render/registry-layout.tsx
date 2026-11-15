"use client";

// Layout, typography, overlay and navigation components for the json-render registry.
import { Children, Fragment } from "react";
import { useBoundProp } from "@json-render/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageResponse } from "@/components/ui-custom/message";
import { Breadcrumb as BreadcrumbRoot, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonGroup as ButtonGroupPrimitive } from "@/components/ui/button-group";
import { Progress as ProgressBar, ProgressLabel as ProgressBarLabel } from "@/components/ui/progress";
import { ProgressTracker } from "@/components/ui/progress-tracker";
import { Collapsible as CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Pagination as PaginationRoot, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@/components/ui/pagination";
import { TooltipProvider, Tooltip as TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog as DialogRoot, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { nu, toSafeText, toSafeOptionalText, hasMermaidFenceBlock } from "./registry-values";
import type { Components } from "@json-render/react";
import type { catalog } from "./catalog";

// ── Gap class mapping ─────────────────────────────────────────
const GAP_CLASSES: Record<string, string> = {
	sm: "gap-2",
	md: "gap-3",
	lg: "gap-4",
};

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

export const layoutComponents = {
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
} satisfies Partial<Components<typeof catalog>>;
