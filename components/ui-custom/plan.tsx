"use client";

// oxlint-disable react-doctor/jsx-no-constructed-context-values -- Context values in this file intentionally combine live state and setters; extracting them would not reduce meaningful consumer churn.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tag } from "@/components/ui/tag";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import { ChevronsUpDownIcon } from "@/components/ui/vpk-icons";
import { motion } from "motion/react";
import { createContext, use, useEffect, useMemo, useRef, useState } from "react";

import { GenerativeCardFooter, GenerativeCardHeader } from "@/components/blocks/generative-card";
import { VisualIdentityTile } from "@/components/projects/shared/components/visual-identity-tile";
import type { VisualIdentity } from "@/components/projects/shared/lib/visual-identity";
import { resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import { MessageResponse } from "./message";
import { Shimmer } from "./shimmer";

/* ----- Types ----- */

export interface PlanTask {
	id: string;
	label: string;
	blockedBy: string[];
	agent?: string;
	agentAvatarSrc?: string;
}

/* ----- Context ----- */

interface PlanContextValue {
	isStreaming: boolean;
	isOpen: boolean;
	setIsOpen: (next: boolean) => void;
	isContentExpanded: boolean;
	setIsContentExpanded: (next: boolean) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlan = () => {
	const context = use(PlanContext);
	if (!context) {
		throw new Error("Plan components must be used within Plan");
	}
	return context;
};

/* ----- Plan (root) ----- */

export type PlanProps = Omit<ComponentProps<typeof Collapsible>, "open" | "defaultOpen" | "onOpenChange"> & {
	isStreaming?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	defaultContentExpanded?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export const Plan = ({ className, isStreaming = false, open, defaultOpen = false, defaultContentExpanded = false, onOpenChange, children, ...props }: Readonly<PlanProps>) => {
	const isControlled = open !== undefined;
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const [isContentExpanded, setIsContentExpanded] = useState(defaultContentExpanded);
	const isOpen = isControlled ? open : uncontrolledOpen;

	const setIsOpen = (next: boolean) => {
		if (!isControlled) {
			setUncontrolledOpen(next);
		}
		onOpenChange?.(next);
	};

	return (
		<PlanContext value={{ isStreaming, isOpen, setIsOpen, isContentExpanded, setIsContentExpanded }}>
			<Collapsible data-slot="plan" open={isOpen} onOpenChange={setIsOpen} {...props} render={<Card className={cn("shadow-none", "data-closed:gap-0", "transition-[opacity,transform] duration-normal ease-out data-starting-style:opacity-0 data-starting-style:-translate-y-1", className)} />}>
				{children}
			</Collapsible>
		</PlanContext>
	);
};

/* ----- PlanHeader ----- */

export type PlanHeaderProps = Omit<ComponentProps<typeof GenerativeCardHeader>, "expanded" | "onExpandedChange">;

export const PlanHeader = ({ className, ...props }: Readonly<PlanHeaderProps>) => {
	const { isOpen, setIsOpen } = usePlan();

	return (
		<GenerativeCardHeader
			expanded={isOpen}
			onExpandedChange={setIsOpen}
			className={className}
			data-slot="plan-header"
			{...props}
		/>
	);
};

/* ----- PlanAvatar ----- */

export type PlanAvatarProps = ComponentProps<"div"> & {
	visualIdentity?: VisualIdentity;
};

export const PlanAvatar = ({ visualIdentity = resolvePlanVisualIdentity("Untitled task run"), className, ...props }: Readonly<PlanAvatarProps>) => (
	<div className={cn("shrink-0", className)} data-slot="plan-avatar" {...props}>
		<VisualIdentityTile decorative label="Plan" visualIdentity={visualIdentity} />
	</div>
);

/* ----- PlanTitle ----- */

export type PlanTitleProps = Omit<ComponentProps<typeof CardTitle>, "children"> & {
	children: ReactNode;
};

export const PlanTitle = ({ children, ...props }: Readonly<PlanTitleProps>) => {
	const { isStreaming } = usePlan();

	return (
		<CardTitle data-slot="plan-title" {...props}>
			{isStreaming && typeof children === "string" ? <Shimmer>{children}</Shimmer> : children}
		</CardTitle>
	);
};

/* ----- PlanDescription ----- */

export type PlanDescriptionProps = Omit<ComponentProps<typeof CardDescription>, "children"> & {
	children: ReactNode;
};

export const PlanDescription = ({ className, children, ...props }: Readonly<PlanDescriptionProps>) => {
	const { isStreaming } = usePlan();

	return (
		<CardDescription className={className} data-slot="plan-description" {...props}>
			{isStreaming && typeof children === "string" ? <Shimmer>{children}</Shimmer> : children}
		</CardDescription>
	);
};

/* ----- PlanAction ----- */

export type PlanActionProps = ComponentProps<typeof CardAction>;

export const PlanAction = (props: Readonly<PlanActionProps>) => <CardAction data-slot="plan-action" {...props} />;

/* ----- PlanContent ----- */

export type PlanContentProps = ComponentProps<typeof CardContent>;

export const PlanContent = ({ className, ...props }: Readonly<PlanContentProps>) => (
	<CollapsibleContent
		render={<CardContent data-slot="plan-content" className={cn("data-closed:h-0 data-closed:overflow-hidden data-closed:py-0", className)} {...props} />}
	/>
);

const COLLAPSED_CONTENT_MAX_HEIGHT_PX = 240;
const COLLAPSED_CONTENT_HEIGHT_CLASS = "max-h-[240px]";
const COLLAPSED_CONTENT_FADE_HEIGHT_PX = 72;
const collapsedContentFadeMask = {
	WebkitMaskImage: `linear-gradient(to bottom, black calc(100% - ${COLLAPSED_CONTENT_FADE_HEIGHT_PX}px), transparent)`,
	maskImage: `linear-gradient(to bottom, black calc(100% - ${COLLAPSED_CONTENT_FADE_HEIGHT_PX}px), transparent)`,
} satisfies CSSProperties;

type PlanShowMoreButtonProps = {
	label: string;
	onClick: () => void;
};

const PlanShowMoreButton = ({ label, onClick }: Readonly<PlanShowMoreButtonProps>) => (
	<Button
		size="compact"
		variant="ghost"
		className="h-7 rounded-full border-0 bg-surface px-3 text-sm leading-5 font-normal text-text-subtle hover:bg-surface-hovered"
		style={{ boxShadow: token("elevation.shadow.overlay") }}
		onClick={onClick}
	>
		{label}
	</Button>
);

export type PlanSummaryProps = Omit<ComponentProps<typeof MessageResponse>, "children"> & {
	summary: string;
	emptyMessage?: string;
	showMoreLabel?: string;
};

export const PlanSummary = ({ summary, className, emptyMessage = "No summary provided.", showMoreLabel = "Show more", ...props }: Readonly<PlanSummaryProps>) => {
	const { isStreaming, isContentExpanded, setIsContentExpanded } = usePlan();
	const [hasOverflow, setHasOverflow] = useState(false);
	const [hasMeasured, setHasMeasured] = useState(false);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const rawContent = summary.trim().length > 0 ? summary : emptyMessage;
	const content = rawContent;

		// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- overflow is measured from rendered DOM after content changes.
		useEffect(() => {
		if (isContentExpanded || !contentRef.current) return;

		const contentElement = contentRef.current;
		const updateOverflow = () => {
			const overflowsVisible = contentElement.scrollHeight - contentElement.clientHeight > 1;
			const overflowsCollapsed = contentElement.scrollHeight - COLLAPSED_CONTENT_MAX_HEIGHT_PX > 1;
			setHasOverflow(overflowsVisible || overflowsCollapsed);
			setHasMeasured(true);
		};

		const rafId = requestAnimationFrame(updateOverflow);

		if (typeof ResizeObserver === "undefined") {
			return () => cancelAnimationFrame(rafId);
		}

		const resizeObserver = new ResizeObserver(() => {
			updateOverflow();
		});

		resizeObserver.observe(contentElement);

		return () => {
			cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
		};
		}, [content, isContentExpanded]);
		// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	const showCollapsedState = !isContentExpanded;
	const showCollapsedControls = showCollapsedState && (hasMeasured ? hasOverflow : false);

	return (
		<div className="relative" data-slot="plan-summary">
			<div
				ref={contentRef}
				className={showCollapsedState ? `${COLLAPSED_CONTENT_HEIGHT_CLASS} overflow-hidden` : undefined}
				style={showCollapsedControls ? collapsedContentFadeMask : undefined}
			>
				<MessageResponse
					className={cn(
						"size-full text-sm leading-5 text-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:leading-7 [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:leading-6 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:leading-5 [&_h3]:font-semibold [&_p]:my-0",
						className
					)}
					isAnimating={isStreaming}
					{...props}
				>
					{content}
				</MessageResponse>
			</div>

			{showCollapsedControls ? (
				<>
					<div className="absolute inset-x-0 bottom-2 flex justify-center">
						<PlanShowMoreButton label={showMoreLabel} onClick={() => setIsContentExpanded(true)} />
					</div>
				</>
			) : null}
		</div>
	);
};

/* ----- PlanFooter ----- */

export type PlanFooterProps = ComponentProps<typeof GenerativeCardFooter>;

export const PlanFooter = (props: Readonly<PlanFooterProps>) => <GenerativeCardFooter data-slot="plan-footer" {...props} />;

/* ----- PlanTrigger ----- */

export type PlanTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export const PlanTrigger = ({ className, ...props }: Readonly<PlanTriggerProps>) => (
	<CollapsibleTrigger
		{...props}
		render={
			<Button
				className={cn("size-8", className)}
				data-slot="plan-trigger"
				size="icon"
				variant="ghost"
			/>
		}
	>
		<ChevronsUpDownIcon className="size-4" />
		<span className="sr-only">Toggle plan</span>
	</CollapsibleTrigger>
);

/* ----- PlanAgentBar ----- */

export type PlanAgentBarProps = ComponentProps<"div"> & {
	agents: string[];
};

export const PlanAgentBar = ({ agents, className, ...props }: Readonly<PlanAgentBarProps>) => {
	if (agents.length === 0) return null;

	return (
		<div className={cn("flex items-center gap-2 rounded-lg bg-bg-neutral px-3 py-2", className)} data-slot="plan-agent-bar" {...props}>
			<PeopleGroupIcon label="" size="small" color="currentColor" />
			<span className="text-xs leading-4 font-medium text-text-subtle">
				{agents.length} {agents.length === 1 ? "agent" : "agents"}
			</span>
			<span className="text-xs leading-4 text-text-subtlest">{agents.join(" · ")}</span>
		</div>
	);
};

/* ----- PlanTaskList ----- */

export type PlanTaskListProps = ComponentProps<"ol"> & {
	showMoreLabel?: string;
};

export const PlanTaskList = ({ children, className, showMoreLabel = "Show more", ...props }: Readonly<PlanTaskListProps>) => {
	const { isContentExpanded, setIsContentExpanded } = usePlan();
	const [hasOverflow, setHasOverflow] = useState(false);
	const [hasMeasured, setHasMeasured] = useState(false);
	const listRef = useRef<HTMLOListElement | null>(null);

		// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- overflow is measured from rendered DOM after children render.
		useEffect(() => {
		if (isContentExpanded || !listRef.current) return;

		const listElement = listRef.current;
		const updateOverflow = () => {
			const overflowsVisible = listElement.scrollHeight - listElement.clientHeight > 1;
			const overflowsCollapsed = listElement.scrollHeight - COLLAPSED_CONTENT_MAX_HEIGHT_PX > 1;
			setHasOverflow(overflowsVisible || overflowsCollapsed);
			setHasMeasured(true);
		};

		const rafId = requestAnimationFrame(updateOverflow);

		if (typeof ResizeObserver === "undefined") {
			return () => cancelAnimationFrame(rafId);
		}

		const resizeObserver = new ResizeObserver(() => {
			updateOverflow();
		});

		resizeObserver.observe(listElement);

		return () => {
			cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
		};
		}, [children, isContentExpanded]);
		// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	const showCollapsedState = !isContentExpanded;
	const showCollapsedControls = showCollapsedState && (hasMeasured ? hasOverflow : false);

	return (
		<div className="relative" data-slot="plan-task-list">
			<ol
				ref={listRef}
				className={cn("flex flex-col gap-0", showCollapsedState ? `${COLLAPSED_CONTENT_HEIGHT_CLASS} overflow-hidden` : null, className)}
				style={showCollapsedControls ? collapsedContentFadeMask : undefined}
				{...props}
			>
				{children}
			</ol>

			{showCollapsedControls ? (
				<>
					<div className="absolute inset-x-0 bottom-2 flex justify-center">
						<PlanShowMoreButton label={showMoreLabel} onClick={() => setIsContentExpanded(true)} />
					</div>
				</>
			) : null}
		</div>
	);
};

/* ----- PlanTaskItem ----- */

export type PlanTaskItemProps = {
	index: number;
	label: string;
	blockedByLabels?: string[];
	blockedByText?: string;
	agent?: string;
	agentAvatarSrc?: string;
	className?: string;
};

export const PlanTaskItem = ({ index, label, blockedByLabels, blockedByText, agent, agentAvatarSrc, className }: Readonly<PlanTaskItemProps>) => (
	<motion.li
		initial={{ opacity: 0, y: 8 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.25, ease: "easeOut" }}
		className={cn("flex min-h-8 shrink-0 items-center gap-4 rounded-lg px-2 py-1.5", className)}
		data-slot="plan-task-item"
	>
		<span className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-surface text-sm leading-5 font-medium text-text">{index}.</span>
		<div className="flex min-w-0 flex-1 flex-col gap-0.5">
			<span className="text-sm leading-5 font-medium text-text">{label}</span>
			{blockedByText ? <span className="text-xs leading-4 text-text-subtlest">{blockedByText}</span> : null}
			{!blockedByText && blockedByLabels && blockedByLabels.length > 0 ? <span className="text-xs leading-4 text-text-subtlest">Blocked by: Step {blockedByLabels.join(", ")}</span> : null}
		</div>
		{agent ? (
			<Tag
				type="agent"
				elemBefore={
					<Avatar size="xs" shape="hexagon">
						{agentAvatarSrc ? <AvatarImage src={agentAvatarSrc} alt={agent} /> : null}
						<AvatarFallback>{agent.slice(0, 2).toUpperCase()}</AvatarFallback>
					</Avatar>
				}
			>
				{agent}
			</Tag>
		) : null}
	</motion.li>
);

/* ----- PlanTabContent ----- */

function stripLeadingMarkdownRule(value: string): string {
	return value.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*(?:\r?\n)+/, "").trimStart();
}

export interface PlanTabContentProps {
	description: string;
	markdown?: string;
	emptySummaryMessage?: string;
	summaryShowMoreLabel?: string;
	className?: string;
	summaryTabContentClassName?: string;
}

export const PlanTabContent = ({
	description,
	markdown = "",
	emptySummaryMessage = "No description provided.",
	summaryShowMoreLabel = "Show more",
	className,
	summaryTabContentClassName,
}: Readonly<PlanTabContentProps>) => {
	const normalizedSummaryMarkdown = useMemo(() => {
		const rawContent = markdown.trim().length > 0 ? markdown : description;
		const stripped = stripLeadingMarkdownRule(rawContent);
		return stripped && !stripped.endsWith("\n") ? `${stripped}\n` : stripped;
	}, [description, markdown]);

	return (
		<div className={cn("gap-4", className)}>
			<div className={cn("px-4 pb-4", summaryTabContentClassName)}>
				<PlanSummary
					summary={normalizedSummaryMarkdown}
					emptyMessage={emptySummaryMessage}
					showMoreLabel={summaryShowMoreLabel}
				/>
			</div>
		</div>
	);
};

/* ----- PlanChevronTrigger ----- */

export type PlanChevronTriggerProps = ComponentProps<typeof Button> & {
	isOpen?: boolean;
};

export const PlanChevronTrigger = ({ isOpen = true, className, ...props }: Readonly<PlanChevronTriggerProps>) => (
	<Button
		aria-label={isOpen ? "Collapse plan" : "Expand plan"}
		size="icon"
		variant="ghost"
		className={cn("rounded-full [&_svg]:transition-transform [&_svg]:duration-normal", isOpen ? "[&_svg]:rotate-90" : "[&_svg]:rotate-0", className)}
		data-slot="plan-chevron-trigger"
		{...props}
	>
		<ChevronRightIcon label="" size="small" />
	</Button>
);
