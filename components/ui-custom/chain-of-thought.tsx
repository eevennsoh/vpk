"use client";

// oxlint-disable react-doctor/no-reset-all-state-on-prop-change -- These prop/key changes intentionally restart a workflow to avoid carrying stale state across runs.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import type { ComponentProps, ComponentType, CSSProperties, ReactNode } from "react";
import type { NewCoreIconProps } from "@atlaskit/icon/base-new";

import { useControllableState } from "@/hooks/use-controllable-state";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { AnimatedDots } from "@/components/ui-custom/animated-dots";
import { MorphingRovo } from "@/components/ui-custom/morphing-rovo";
import RovoIconGlyph from "@atlaskit/icon-lab/core/rovo";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import NodeIcon from "@atlaskit/icon/core/node";
import { createContext, memo, use, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "motion/react";

import { getDefaultThinkingLabel, getPreloadShimmerLabel, getReasoningCompletedLabel } from "@/components/projects/shared/lib/reasoning-labels";
import { token } from "@/lib/tokens";

interface ChainOfThoughtContextValue {
	isOpen: boolean;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
	null
);

const useChainOfThought = () => {
	const context = use(ChainOfThoughtContext);
	if (!context) {
		throw new Error(
			"ChainOfThought components must be used within ChainOfThought"
		);
	}
	return context;
};

export type ChainOfThoughtProps = Omit<
	ComponentProps<typeof Collapsible>,
	"onOpenChange" | "open" | "defaultOpen"
> & {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
	({
		className,
		open,
		defaultOpen = false,
		onOpenChange,
		children,
		...props
	}: ChainOfThoughtProps) => {
		const [isOpen, setIsOpen] = useControllableState({
			defaultProp: defaultOpen,
			onChange: onOpenChange,
			prop: open,
		});

		const chainOfThoughtContext = useMemo(() => ({ isOpen }), [isOpen]);

		return (
			<ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
				<Collapsible
					className={cn(
						"not-prose w-full",
						className
					)}
					onOpenChange={setIsOpen}
					open={isOpen}
					{...props}
				>
					{children}
				</Collapsible>
			</ChainOfThoughtContext.Provider>
		);
	}
);

export type ChainOfThoughtHeaderProps = ComponentProps<
	typeof CollapsibleTrigger
> & {
	showChevron?: boolean;
	shimmer?: boolean;
	state?: "preload" | "thinking" | "completed";
	duration?: number;
};

const BYLINE_TRANSITION = { duration: 0.2, ease: "easeOut" } as const;

/**
 * Renders a step byline that animates smoothly between three transitions:
 * - appear (height grows + fades/slides in) when the byline becomes visible,
 * - disappear (height collapses + fades/slides out) when it is hidden, and
 * - cross-fade in place (stable height) when the byline text cycles.
 *
 * The persistent byline on the active/last step keeps a fixed row height while
 * its text changes, so it stays put instead of flickering on every update.
 */
export function CyclingByline({
	children,
	className,
	contentKey,
}: Readonly<{
	children: ReactNode;
	className?: string;
	/** Explicit transition key when composed children carry cycling text. */
	contentKey?: string;
}>) {
	const shouldReduceMotion = useReducedMotion();
	const hasContent = children != null && children !== false;
	const textKey = contentKey ?? (typeof children === "string" ? children : "byline");

	return (
		<motion.span
			className={cn(
				"block overflow-hidden",
				className ?? "text-xs leading-4 text-text-subtle",
			)}
			initial={false}
			animate={shouldReduceMotion ? undefined : { height: hasContent ? "auto" : 0 }}
			transition={BYLINE_TRANSITION}
		>
			<span className="block min-h-4">
				<AnimatePresence initial={false} mode="wait">
					{hasContent ? (
						<motion.span
							key={textKey}
							className="block truncate"
							initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
							animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
							exit={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
							transition={BYLINE_TRANSITION}
						>
							{children}
						</motion.span>
					) : null}
				</AnimatePresence>
			</span>
		</motion.span>
	);
}

function stripTrailingDots(label: string): string {
	return label.replace(/\s*\.+$/, "");
}

export const ChainOfThoughtHeader = memo(
	({
		className,
		children,
		showChevron = true,
		shimmer = false,
		state,
		duration,
		...props
	}: ChainOfThoughtHeaderProps) => {
		const { isOpen } = useChainOfThought();
		const resolvedState = state ?? (shimmer ? "preload" : undefined);
		const text = children ?? (
			resolvedState === "preload"
				? getPreloadShimmerLabel()
				: resolvedState === "thinking"
					? getDefaultThinkingLabel()
					: resolvedState === "completed"
						? getReasoningCompletedLabel(duration)
						: "Chain of Thought"
		);
		const isCompleted = resolvedState == "completed";
		const shouldShimmerLabel =
			typeof text === "string" &&
			resolvedState !== "completed" &&
			(shimmer || resolvedState === "preload" || resolvedState === "thinking");
		const shouldShowAnimatedDots =
			resolvedState === "preload" || resolvedState === "thinking";
		const renderedText =
			shouldShowAnimatedDots && typeof text === "string"
				? stripTrailingDots(text)
				: text;

		return (
			<CollapsibleTrigger
				className={cn(
					"flex w-full items-start gap-2 text-sm text-text-subtle transition-colors",
					showChevron && "hover:text-text",
					className
				)}
				disabled={!showChevron}
				{...props}
			>
				{isCompleted ? (
					<span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center">
						<RovoIconGlyph
							color={token("color.icon.subtlest")}
							label=""
							size="small"
						/>
					</span>
				) : (
					<MorphingRovo.Shape size={16} duration={0.8} blur={1.25} className="mt-0.5 shrink-0" />
				)}
				<span className="grid min-w-0 flex-1 gap-0.5 text-left">
					<span className="flex min-w-0 items-center gap-1.5">
						<span className="inline-flex min-w-0 items-baseline">
							{shouldShimmerLabel && typeof renderedText === "string" ? (
								<Shimmer
									as="span"
									duration={1.4}
									spread={2}
									className="min-w-0 truncate text-left"
								>
									{renderedText}
								</Shimmer>
							) : (
								<span className="min-w-0 truncate text-left">{renderedText}</span>
							)}
							{shouldShowAnimatedDots ? <AnimatedDots /> : null}
						</span>
						{showChevron ? (
							<Icon
								render={<ChevronDownIcon label="" size="small" spacing="none" />}
								className={cn(
									"size-4 shrink-0 transition-transform",
									isOpen ? "rotate-0" : "-rotate-90"
								)}
							/>
						) : null}
					</span>
				</span>
			</CollapsibleTrigger>
		);
	}
);

export type ChainOfThoughtStepProps = ComponentProps<"div"> & MotionProps & {
	animateOnMount?: boolean;
	entranceDelay?: number;
	icon?: ComponentType<NewCoreIconProps>;
	iconRender?: ReactNode;
	iconContainerClassName?: string;
	iconContainerStyle?: CSSProperties;
	label: ReactNode;
	description?: ReactNode;
	status?: "complete" | "active" | "pending";
	/**
	 * Whether the active-state icon shimmer wash is applied. Defaults to
	 * `status === "active"`. Set to `false` for self-animating icons (e.g. a
	 * spinner) that would be doubled by the wash overlay.
	 */
	iconShimmer?: boolean;
	collapsible?: boolean;
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	headerRender?: (context: ChainOfThoughtStepHeaderRenderContext) => ReactNode;
};

export interface ChainOfThoughtStepHeaderRenderContext {
	hasExpandableContent: boolean;
	isOpen: boolean;
	resolvedDescription: ReactNode;
	shouldShowDescription: boolean;
	toggleOpen: () => void;
}

const stepStatusStyles = {
	active: "text-text",
	complete: "text-text-subtle",
	pending: "text-text-subtlest",
};

function getDefaultStepDescription(
	status: NonNullable<ChainOfThoughtStepProps["status"]>,
): ReactNode {
	if (status === "active") {
		return "In progress";
	}
	if (status === "pending") {
		return "Queued";
	}
	return "Complete";
}

function ChainOfThoughtIconSlot({
	children,
	shimmer,
}: Readonly<{
	children: ReactNode;
	shimmer: boolean;
}>): ReactNode {
	return (
		<span
			data-cot-icon-slot={shimmer ? "active" : undefined}
			className={cn(
				"inline-flex size-4 shrink-0 items-center justify-center",
				shimmer && "relative text-muted-foreground",
			)}
		>
			{children}
			{shimmer ? (
				<span
					aria-hidden="true"
					className="cot-icon-wash pointer-events-none absolute inset-0 inline-flex items-center justify-center motion-safe:animate-cot-icon-shimmer motion-reduce:hidden"
				>
					{children}
				</span>
			) : null}
		</span>
	);
}

export const ChainOfThoughtStep = memo(
	({
		className,
		icon: IconComponent = NodeIcon,
		iconRender,
		iconContainerClassName,
		iconContainerStyle,
		label,
		description,
		status = "complete",
		iconShimmer,
		collapsible = false,
		defaultOpen = false,
		animateOnMount = false,
		entranceDelay = 0,
		open,
		onOpenChange,
		headerRender,
		style,
		children,
		...props
	}: ChainOfThoughtStepProps) => {
		const shouldReduceMotion = useReducedMotion();
		const shouldAnimateEntrance = animateOnMount && !shouldReduceMotion;
		const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
		const isControlled = open !== undefined;
		const isOpen = isControlled ? open : uncontrolledOpen;
		const hasExpandableContent = collapsible && children != null;
		const shouldShowDescription = description !== null;
		const shouldShowHeaderDescription = shouldShowDescription && (!hasExpandableContent || !isOpen);
		const resolvedDescription =
			description === undefined ? getDefaultStepDescription(status) : description;
		const iconNode = iconRender ?? <Icon render={<IconComponent label="" size="small" spacing="none" />} className="size-4" />;

		const handleOpenChange = (nextOpen: boolean) => {
			if (!isControlled) {
				setUncontrolledOpen(nextOpen);
			}
			onOpenChange?.(nextOpen);
		};

		useEffect(() => {
			if (!isControlled) {
				setUncontrolledOpen(defaultOpen);
			}
		}, [defaultOpen, isControlled]);

		const stepHeader = headerRender ? headerRender({
			hasExpandableContent,
			isOpen,
			resolvedDescription,
			shouldShowDescription: shouldShowHeaderDescription,
			toggleOpen: () => handleOpenChange(!isOpen),
		}) : hasExpandableContent ? (
			<button
				type="button"
				className="group/step flex w-full items-start text-left transition-colors hover:text-text"
				onClick={() => handleOpenChange(!isOpen)}
			>
				<span className="grid min-w-0 flex-1 gap-0.5">
					<span className="inline-flex min-w-0 items-start gap-1.5">
						<span className="min-w-0 truncate">{label}</span>
						<Icon
							render={<ChevronDownIcon label="" size="small" spacing="none" />}
							className={cn(
								"mt-0.5 size-4 shrink-0 transition-[transform,opacity] duration-medium ease-out opacity-0 group-hover/step:opacity-100 group-focus-visible/step:opacity-100",
								isOpen ? "rotate-0" : "-rotate-90"
							)}
						/>
					</span>
					<CyclingByline>{shouldShowHeaderDescription ? resolvedDescription : null}</CyclingByline>
				</span>
			</button>
		) : (
			<div className="grid min-w-0 gap-0.5">
				<span className="min-w-0 truncate">{label}</span>
				<CyclingByline>{shouldShowDescription ? resolvedDescription : null}</CyclingByline>
			</div>
		);

		return (
			<motion.div
				className={cn(
					"group/cot-step transition-all duration-medium ease-out data-starting-style:opacity-0 data-starting-style:-translate-y-2",
					"flex items-stretch gap-2 text-sm",
					stepStatusStyles[status],
					className
				)}
				initial={shouldAnimateEntrance ? { opacity: 0, y: -6 } : false}
				animate={shouldAnimateEntrance ? { opacity: 1, y: 0 } : undefined}
				transition={shouldAnimateEntrance ? { duration: 0.22, ease: "easeOut", delay: entranceDelay } : undefined}
				style={{
					...style,
					...(shouldAnimateEntrance ? { willChange: "opacity, transform" } : {}),
				}}
				{...props}
			>
				<div
					className={cn("relative mt-0.5 self-stretch", iconContainerClassName)}
					style={iconContainerStyle}
				>
					<ChainOfThoughtIconSlot shimmer={iconShimmer ?? status === "active"}>
						{iconNode}
					</ChainOfThoughtIconSlot>
					<div
						className={cn(
							"absolute top-5 left-1/2 -mx-px w-px bg-border",
							hasExpandableContent && isOpen
								? "-bottom-3"
								: "-bottom-3 group-last/cot-step:hidden"
						)}
					/>
				</div>
				{/*
				  Expandable steps keep a closed panel mounted (`--collapsible-panel-height:
				  auto` at rest). Parent `space-y-2` would leave an 8px margin under the
				  header after collapse, and panel `pt-2` also resolves to 8px when height
				  is auto. Only apply header→content spacing while open.
				*/}
				<div
					className={cn(
						"min-w-0 flex-1",
						hasExpandableContent
							? isOpen && "space-y-2"
							: children != null && "space-y-2",
					)}
				>
					{stepHeader}
					{hasExpandableContent ? (
						<Collapsible onOpenChange={handleOpenChange} open={isOpen}>
							<CollapsibleContent
								className="space-y-2 overflow-hidden has-[:focus-visible]:overflow-visible h-(--collapsible-panel-height) transition-[height,opacity] ease-out duration-medium data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0"
							>
								{children}
							</CollapsibleContent>
						</Collapsible>
					) : (
						children
					)}
				</div>
			</motion.div>
		);
	}
);

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
	({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
		<div
			className={cn("flex flex-wrap items-center gap-1.5", className)}
			{...props}
		/>
	)
);

export type ChainOfThoughtSearchResultProps = LozengeProps;

export const ChainOfThoughtSearchResult = memo(
	({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
		<Lozenge
			className={cn("max-w-none", className)}
			variant="neutral"
			{...props}
		>
			{children}
		</Lozenge>
	)
);

export type ChainOfThoughtContentProps = ComponentProps<
	typeof CollapsibleContent
>;

export const ChainOfThoughtContent = memo(
	({ className, children, ...props }: ChainOfThoughtContentProps) => (
		<CollapsibleContent
			className={cn(
				"mt-2 space-y-3",
				"outline-none overflow-hidden has-[:focus-visible]:overflow-visible h-(--collapsible-panel-height) transition-[height,opacity] ease-out duration-medium data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0",
				className
			)}
			{...props}
		>
			{children}
		</CollapsibleContent>
	)
);

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
	caption?: string;
};

export const ChainOfThoughtImage = memo(
	({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
		<div className={cn("mt-2 space-y-2", className)} {...props}>
			<div className="relative flex max-h-[22rem] items-center justify-start overflow-hidden rounded-lg bg-surface-raised">
				{children}
			</div>
			{caption ? <p className="text-text-subtle text-xs">{caption}</p> : null}
		</div>
	)
);

export type ChainOfThoughtScenarioState = NonNullable<ChainOfThoughtHeaderProps["state"]>;

export interface ChainOfThoughtScenarioStep {
	id: string;
	label: ReactNode;
	description?: ReactNode;
	status: NonNullable<ChainOfThoughtStepProps["status"]>;
	icon?: ComponentType<NewCoreIconProps>;
	iconRender?: ReactNode;
	collapsible?: boolean;
	defaultOpen?: boolean;
	className?: string;
	children?: ReactNode;
}

export interface ChainOfThoughtScenarioProps extends Omit<ChainOfThoughtProps, "children"> {
	animateStepEntrance?: boolean;
	state: ChainOfThoughtScenarioState;
	duration?: number;
	steps: readonly ChainOfThoughtScenarioStep[];
	headerLabel?: ReactNode;
	contentClassName?: string;
}

export const ChainOfThoughtScenario = memo(
	({
		className,
		contentClassName,
		defaultOpen,
		animateStepEntrance = false,
		duration,
		headerLabel,
		state,
		steps,
		...props
	}: ChainOfThoughtScenarioProps) => (
		<ChainOfThought
			className={className}
			defaultOpen={defaultOpen ?? state === "thinking"}
			{...props}
		>
			<ChainOfThoughtHeader
				duration={duration}
				showChevron={state !== "preload" && steps.length > 0}
				state={state}
			>
				{headerLabel}
			</ChainOfThoughtHeader>
			<ChainOfThoughtContent className={contentClassName}>
				{steps.map((step, index) => (
					<ChainOfThoughtStep
						key={step.id}
						className={step.className}
						collapsible={step.collapsible}
						defaultOpen={step.defaultOpen}
						description={step.description}
						animateOnMount={animateStepEntrance}
						entranceDelay={animateStepEntrance ? Math.min(index * 0.045, 0.18) : 0}
						icon={step.icon}
						iconRender={step.iconRender}
						label={step.label}
						status={step.status}
					>
						{step.children}
					</ChainOfThoughtStep>
				))}
			</ChainOfThoughtContent>
		</ChainOfThought>
	)
);

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
ChainOfThoughtScenario.displayName = "ChainOfThoughtScenario";
