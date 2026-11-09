"use client";

// oxlint-disable react-doctor/only-export-components -- This module intentionally exports colocated component API, variant contracts, context contracts, or metadata used by consumers.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, cubicBezier, motion, useReducedMotion } from "motion/react";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossIcon from "@atlaskit/icon/core/cross";

import {
	type AgentBrowserAgent,
	type AgentBrowserSidebarGroup,
} from "@/components/blocks/agent-browser";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import {
	EntityCardAgentExpandedCard,
	type EntityCardCapability,
	type EntityCardSkillTag,
} from "@/components/ui-custom/entity-card";
import { type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/**
 * Carousel agents extend the shared `AgentBrowserAgent` identity with the richer
 * directory-card detail (`EntityCardAgentExpandedCard`) renders. Every detail field
 * is optional so plain `AgentBrowserAgent` data still satisfies the type — the card
 * derives a publisher from `byline` and falls back gracefully when detail is absent.
 */
export interface AgentTemplateAgent extends AgentBrowserAgent {
	categoryId?: AgentTemplateCategoryId;
	publisher?: string;
	publisherBrandName?: ThirdPartyLogoName;
	templatePrompt?: string;
	/** Robust setup/usage guidance for the template (from the directory catalog). */
	instructions?: string;
	verified?: boolean;
	capabilities?: readonly EntityCardCapability[];
	sources?: ReadonlyArray<TwgToolSource>;
	skills?: ReadonlyArray<EntityCardSkillTag>;
	stats?: ReadonlyArray<{ value: string; label: string }>;
	collaborators?: ReadonlyArray<{ src: string; name: string }>;
	collaboratorOverflow?: number;
}
export type AgentTemplateSidebarGroup = AgentBrowserSidebarGroup;

export interface AgentTemplateDialogProps {
	agents: readonly AgentTemplateAgent[];
	initialCategoryId?: AgentTemplateCategoryId;
	onSelectAgent?: (agent: AgentTemplateAgent) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionAgents?: readonly AgentTemplateAgent[];
	sidebarGroups?: readonly AgentTemplateSidebarGroup[];
	title?: string;
}

const EMPTY_AGENT_TEMPLATE_AGENTS: readonly AgentTemplateAgent[] = [];
const AGENT_TEMPLATE_CARD_SCROLL_OFFSET = 376;
const AGENT_TEMPLATE_MAX_VISIBLE_AGENTS = 8;
const AGENT_TEMPLATE_SCROLL_EDGE_THRESHOLD = 2;
const AGENT_TEMPLATE_CAROUSEL_CONTROL_TRANSITION = {
	type: "spring",
	bounce: 0,
	visualDuration: 0.2,
} as const;
// Tab swaps are sequenced via AnimatePresence `mode="wait"`: the current tab
// exits quickly (ADS `--ease-in`, "leaving view"), then the incoming tab is
// revealed gradually. The deck assembles one-by-one — each card fades + slides
// in on a soft spring, offset by a per-card stagger delay — so the new tab
// arrives with momentum rather than as a single block fade.
const AGENT_TEMPLATE_TAB_EXIT_TRANSITION = {
	duration: 0.13, // quick exit
	ease: cubicBezier(0.6, 0.01, 0.8, 0.6), // ADS --ease-in ("leaving view")
};
const AGENT_TEMPLATE_TAB_COPY_ENTER_TRANSITION = {
	duration: 0.3, // gradual title entrance
	ease: cubicBezier(0, 0.4, 0, 1), // ADS --ease-out ("entering view")
};
const AGENT_TEMPLATE_TAB_CARD_ENTER_TRANSITION = {
	type: "spring",
	bounce: 0,
	visualDuration: 0.4, // soft, gradual per-card slide-in
} as const;
const AGENT_TEMPLATE_TAB_CARD_STAGGER = 0.05; // delay between consecutive cards
const AGENT_TEMPLATE_TAB_COPY_SWAP_OFFSET = 16;
const AGENT_TEMPLATE_TAB_CARDS_SWAP_OFFSET = 24; // whole-deck slide distance on exit
const AGENT_TEMPLATE_TAB_CARD_ENTER_OFFSET = 16; // per-card slide-in distance
const NOOP_TEMPLATE_MORE_ACTIONS = () => undefined;

export type AgentTemplateCategoryId = "brainstorm" | "analyze" | "review" | "summarize" | "create";
type AgentTemplateTabMotionDirection = 1 | -1;
type AgentTemplateTabMotionCustom = {
	direction: AgentTemplateTabMotionDirection;
	shouldReduceMotion: boolean;
};

export type AgentTemplateCategory = {
	id: AgentTemplateCategoryId;
	label: string;
	iconClassName?: string;
	iconSrc: string;
	titleLines: readonly [string, string];
};

const RICH_ICON_ROOT = "/illustration/rich-icon";

export const AGENT_TEMPLATE_CATEGORIES: readonly AgentTemplateCategory[] = [
	{
		id: "brainstorm",
		label: "Planning",
		iconSrc: `${RICH_ICON_ROOT}/lightbulb/standard.svg`,
		iconClassName: "-translate-y-px scale-[1.08]",
		titleLines: ["Turn rough ideas into plans,", "and choose the next step."],
	},
	{
		id: "analyze",
		label: "Insights",
		iconSrc: `${RICH_ICON_ROOT}/marketing/standard.svg`,
		iconClassName: "scale-[1.08]",
		titleLines: ["Pull signal from context,", "and turn scattered data into decisions."],
	},
	{
		id: "review",
		label: "Operations",
		iconSrc: `${RICH_ICON_ROOT}/product-management/standard.svg`,
		iconClassName: "translate-x-0.5 -translate-y-0.5 scale-[1.14]",
		titleLines: ["Keep routines moving,", "and make follow-through easier to trust."],
	},
	{
		id: "summarize",
		label: "Writing",
		iconSrc: `${RICH_ICON_ROOT}/illustrations/standard.svg`,
		iconClassName: "-translate-y-px scale-[0.88]",
		titleLines: ["Draft, refine, and adapt writing,", "without losing the point."],
	},
	{
		id: "create",
		label: "Work management",
		iconSrc: `${RICH_ICON_ROOT}/project-management/standard.svg`,
		iconClassName: "scale-[1.08]",
		titleLines: ["Track the work that matters,", "and keep momentum visible."],
	},
] as const;

const EMPTY_CAPABILITIES: readonly EntityCardCapability[] = [];
const AGENT_TEMPLATE_TAB_COPY_VARIANTS = {
	enter: ({ direction, shouldReduceMotion }: AgentTemplateTabMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateX(0px)" : `translateX(${AGENT_TEMPLATE_TAB_COPY_SWAP_OFFSET * direction}px)`,
	}),
	center: {
		opacity: 1,
		transform: "translateX(0px)",
		transition: AGENT_TEMPLATE_TAB_COPY_ENTER_TRANSITION,
	},
	exit: ({ direction, shouldReduceMotion }: AgentTemplateTabMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateX(0px)" : `translateX(${-AGENT_TEMPLATE_TAB_COPY_SWAP_OFFSET * direction}px)`,
		transition: AGENT_TEMPLATE_TAB_EXIT_TRANSITION,
	}),
} as const;
const AGENT_TEMPLATE_TAB_CARDS_VARIANTS = {
	// The deck container appears instantly on enter; its cards stagger in via the
	// per-card initial/animate below. On exit the whole deck fades + slides out fast.
	enter: { opacity: 1 },
	center: { opacity: 1 },
	exit: ({ direction, shouldReduceMotion }: AgentTemplateTabMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateX(0px)" : `translateX(${-AGENT_TEMPLATE_TAB_CARDS_SWAP_OFFSET * direction}px)`,
		transition: AGENT_TEMPLATE_TAB_EXIT_TRANSITION,
	}),
} as const;

/** Pull the publisher from a byline like "Customer feedback insights by Atlassian" → "Atlassian". */
function deriveAgentPublisher(byline: string): string {
	return byline.match(/\bby\s+(.+)$/iu)?.[1].trim() ?? byline;
}

function getAgentTemplateCategoryIndex(categoryId: AgentTemplateCategoryId): number {
	const categoryIndex = AGENT_TEMPLATE_CATEGORIES.findIndex((category) => category.id === categoryId);
	return categoryIndex >= 0 ? categoryIndex : 0;
}

export function AgentTemplateDialog({
	agents,
	initialCategoryId = AGENT_TEMPLATE_CATEGORIES[0].id,
	onSelectAgent,
	open,
	onOpenChange,
	sessionAgents = EMPTY_AGENT_TEMPLATE_AGENTS,
	sidebarGroups,
	title,
}: Readonly<AgentTemplateDialogProps>) {
	void sidebarGroups;

	const scrollRef = useRef<HTMLDivElement>(null);
	const shouldReduceMotion = useReducedMotion();
	const [activeCategoryState, setActiveCategoryState] = useState(() => ({
		activeCategory: initialCategoryId,
		initialCategoryId,
		open,
	}));
	let resolvedActiveCategoryState = activeCategoryState;
	if (activeCategoryState.open !== open || (open && activeCategoryState.initialCategoryId !== initialCategoryId)) {
		resolvedActiveCategoryState = open
			? { activeCategory: initialCategoryId, initialCategoryId, open }
			: { ...activeCategoryState, initialCategoryId, open };
		setActiveCategoryState(resolvedActiveCategoryState);
	}
	const activeCategory = resolvedActiveCategoryState.activeCategory;
	const [tabMotionDirection, setTabMotionDirection] = useState<AgentTemplateTabMotionDirection>(1);
	const [scrollControls, setScrollControls] = useState({ canScrollLeft: false, canScrollRight: false });
	if (!open && (scrollControls.canScrollLeft || scrollControls.canScrollRight)) {
		setScrollControls({ canScrollLeft: false, canScrollRight: false });
	}
	const activeCategoryOption = AGENT_TEMPLATE_CATEGORIES.find((category) => category.id === activeCategory) ?? AGENT_TEMPLATE_CATEGORIES[0];
	const tabMotionCustom = {
		direction: tabMotionDirection,
		shouldReduceMotion,
	};
	const allTemplateAgents = useMemo(
		() => [...agents, ...sessionAgents],
		[agents, sessionAgents],
	);
	const templateAgents = useMemo(() => {
		const categoryAgents = allTemplateAgents.filter((agent) => agent.categoryId === activeCategory);
		const visibleAgents = categoryAgents.length > 0 ? categoryAgents : allTemplateAgents;
		return visibleAgents.slice(0, AGENT_TEMPLATE_MAX_VISIBLE_AGENTS);
	}, [activeCategory, allTemplateAgents]);

	const updateScrollControls = useCallback(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) {
			setScrollControls((currentControls) => (
				currentControls.canScrollLeft || currentControls.canScrollRight
					? { canScrollLeft: false, canScrollRight: false }
					: currentControls
			));
			return;
		}

		const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
		const canScrollLeft = scrollElement.scrollLeft > AGENT_TEMPLATE_SCROLL_EDGE_THRESHOLD;
		const canScrollRight = scrollElement.scrollLeft < maxScrollLeft - AGENT_TEMPLATE_SCROLL_EDGE_THRESHOLD;

		setScrollControls((currentControls) => (
			currentControls.canScrollLeft === canScrollLeft && currentControls.canScrollRight === canScrollRight
				? currentControls
				: { canScrollLeft, canScrollRight }
		));
	}, []);

	const setCarouselRef = useCallback((scrollElement: HTMLDivElement | null) => {
		scrollRef.current = scrollElement;
		if (scrollElement) {
			window.requestAnimationFrame(updateScrollControls);
		}
	}, [updateScrollControls]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const scrollElement = scrollRef.current;
		if (!scrollElement) return;

		const animationFrameId = window.requestAnimationFrame(updateScrollControls);
		const resizeObserver = new ResizeObserver(updateScrollControls);
		resizeObserver.observe(scrollElement);

		return () => {
			window.cancelAnimationFrame(animationFrameId);
			resizeObserver.disconnect();
		};
	}, [open, templateAgents.length, updateScrollControls]);

	useEffect(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) return;

		scrollElement.scrollTo({ left: 0 });
		window.requestAnimationFrame(updateScrollControls);
	}, [activeCategory, templateAgents.length, updateScrollControls]);

	const handleScrollBy = (direction: -1 | 1) => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) return;

		const previousScrollLeft = scrollElement.scrollLeft;
		scrollElement.scrollBy({
			left: AGENT_TEMPLATE_CARD_SCROLL_OFFSET * direction,
			behavior: "smooth",
		});
		window.setTimeout(() => {
			if (scrollElement.scrollLeft !== previousScrollLeft) return;
			scrollElement.scrollBy({
				left: AGENT_TEMPLATE_CARD_SCROLL_OFFSET * direction,
			});
			updateScrollControls();
		}, 150);
	};

	const handleCategorySelect = (categoryId: AgentTemplateCategoryId) => {
		if (categoryId === activeCategory) return;

		setTabMotionDirection(getAgentTemplateCategoryIndex(categoryId) > getAgentTemplateCategoryIndex(activeCategory) ? 1 : -1);
		setActiveCategoryState((currentState) => ({ ...currentState, activeCategory: categoryId }));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="grid max-h-[min(744px,calc(100svh-1rem))] w-[min(1248px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,auto)] gap-0 overflow-hidden rounded-xl border border-border bg-surface p-0 shadow-xl sm:max-w-[1248px]"
				showCloseButton={false}
			>
				<header className="relative px-6 py-6">
					<div
						aria-label="Template categories"
						className="flex flex-wrap justify-start gap-2"
						role="group"
					>
						{AGENT_TEMPLATE_CATEGORIES.map((category) => (
							<AgentTemplateCategoryButton
								active={activeCategory === category.id}
								category={category}
								key={category.id}
								onClick={() => handleCategorySelect(category.id)}
							/>
						))}
					</div>
					<DialogClose render={<Button aria-label="Close agent templates" className="absolute top-6 right-6 size-8 shrink-0" size="icon" variant="ghost" />}>
						<CrossIcon label="" />
					</DialogClose>
					<DialogTitle
						className="mt-6 text-text"
						style={{ font: token("font.heading.xlarge") }}
					>
						<AnimatePresence custom={tabMotionCustom} initial={false} mode="wait">
							<motion.span
								animate="center"
								className="block"
								custom={tabMotionCustom}
								exit="exit"
								initial="enter"
								key={title ?? activeCategory}
								style={{ willChange: "transform, opacity" }}
								variants={AGENT_TEMPLATE_TAB_COPY_VARIANTS}
							>
								{title ? (
									title
								) : (
									<>
										<span className="block">{activeCategoryOption.titleLines[0]}</span>
										<span className="block text-text-subtlest">{activeCategoryOption.titleLines[1]}</span>
									</>
								)}
							</motion.span>
						</AnimatePresence>
					</DialogTitle>
				</header>

				{/* The deck's own `pb-6` (inside the overflow-clipped carousel) owns the single
				    24px bottom gap and the hover-shadow room — so this region adds no extra
				    bottom padding, otherwise the two stack into a ~48px gap. */}
				<div className="relative min-h-0 overflow-hidden">
					<div
						aria-label="Agent templates"
						className="h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						data-agent-template-carousel
						onScroll={updateScrollControls}
						ref={setCarouselRef}
					>
						<AnimatePresence custom={tabMotionCustom} initial={false} mode="wait">
							<motion.div
								animate="center"
								// `w-max` shrink-wraps the deck to its content so the trailing `px-6`
								// is part of the scrollable width — otherwise an auto-width flex row
								// in an overflow-x container drops its padding-right and the last card
								// rests flush at max scroll instead of leaving the 24px end gap.
								className="flex h-full w-max gap-4 px-6 pt-2 pb-6"
								custom={tabMotionCustom}
								exit="exit"
								initial="enter"
								key={activeCategory}
								style={{ willChange: "transform, opacity" }}
								variants={AGENT_TEMPLATE_TAB_CARDS_VARIANTS}
							>
								{templateAgents.map((agent, index) => (
										<motion.div
											animate={{ opacity: 1, transform: "translateX(0px)" }}
											className="h-[400px] w-90 shrink-0 [will-change:transform,opacity]"
										initial={{
											opacity: 0,
											transform: shouldReduceMotion ? "translateX(0px)" : `translateX(${tabMotionDirection * AGENT_TEMPLATE_TAB_CARD_ENTER_OFFSET}px)`,
										}}
										key={agent.id}
										transition={{
											...AGENT_TEMPLATE_TAB_CARD_ENTER_TRANSITION,
											delay: shouldReduceMotion ? 0 : index * AGENT_TEMPLATE_TAB_CARD_STAGGER,
										}}
									>
										<AgentTemplateCard
											agent={agent}
											onSelectAgent={onSelectAgent}
										/>
									</motion.div>
								))}
							</motion.div>
						</AnimatePresence>
					</div>
					<AnimatePresence initial={false}>
						{scrollControls.canScrollLeft ? (
							<AgentTemplateCarouselControl
								direction="previous"
								key="previous"
								onClick={() => handleScrollBy(-1)}
							/>
						) : null}
						{scrollControls.canScrollRight ? (
							<AgentTemplateCarouselControl
								direction="next"
								key="next"
								onClick={() => handleScrollBy(1)}
							/>
						) : null}
					</AnimatePresence>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function AgentTemplateCarouselControl({
	direction,
	onClick,
}: Readonly<{
	direction: "previous" | "next";
	onClick: () => void;
}>) {
	const isPrevious = direction === "previous";
	const hiddenTransform = `translateY(-50%) translateX(${isPrevious ? "-8px" : "8px"}) scale(0.96)`;

	return (
		<motion.div
			animate={{ opacity: 1, transform: "translateY(-50%) translateX(0px) scale(1)" }}
			className={cn(
				"absolute top-1/2 z-10",
				isPrevious ? "left-3" : "right-3",
			)}
			exit={{ opacity: 0, transform: hiddenTransform }}
			initial={{ opacity: 0, transform: hiddenTransform }}
			transition={AGENT_TEMPLATE_CAROUSEL_CONTROL_TRANSITION}
		>
			<Button
				aria-label={isPrevious ? "Show previous agent templates" : "Show next agent templates"}
				className="border-0 bg-surface-overlay text-icon-subtle opacity-100 hover:bg-surface-overlay-hovered active:bg-surface-overlay-pressed focus-visible:border-0"
				onClick={onClick}
				size="icon"
				style={{ boxShadow: token("elevation.shadow.overlay") }}
				type="button"
				variant="ghost"
			>
				<Icon
					className="pointer-events-none [&_*]:pointer-events-none"
					render={isPrevious ? <ChevronLeftIcon label="" color="currentColor" /> : <ChevronRightIcon label="" color="currentColor" />}
				/>
			</Button>
		</motion.div>
	);
}

function AgentTemplateCategoryButton({
	active,
	category,
	onClick,
}: Readonly<{
	active: boolean;
	category: AgentTemplateCategory;
	onClick: () => void;
}>) {
	return (
		<button
			aria-pressed={active}
			className={cn(
				"relative isolate inline-flex h-8 shrink-0 items-center overflow-hidden rounded-md border px-3 text-sm font-medium leading-5 outline-none transition-[border-color,color,box-shadow] duration-fast ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
				active
					? "border-border-selected bg-bg-selected text-text-selected"
					: "border-border bg-background text-text-subtle hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed",
			)}
			onClick={onClick}
			type="button"
		>
			<span className="relative z-[2] inline-flex items-center gap-1.5">
				<span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center">
					<Image
						alt=""
						className={cn("size-6 object-contain", category.iconClassName)}
						height={24}
						src={category.iconSrc}
						width={24}
					/>
				</span>
				<span>{category.label}</span>
			</span>
		</button>
	);
}

function AgentTemplateCard({
	agent,
	onSelectAgent,
}: Readonly<{
	agent: AgentTemplateAgent;
	onSelectAgent?: (agent: AgentTemplateAgent) => void;
}>) {
	// The motion wrapper owns the fixed carousel width; the card fills that frame.
	return (
		<EntityCardAgentExpandedCard
			avatarSrc={agent.avatarSrc}
			attributionKind={agent.attributionKind}
			capabilities={agent.capabilities ?? EMPTY_CAPABILITIES}
			className="h-full w-full"
			collaboratorOverflow={agent.collaboratorOverflow}
			collaborators={agent.collaborators}
			description={agent.description}
			name={agent.name}
			onMoreActions={NOOP_TEMPLATE_MORE_ACTIONS}
			onSelect={onSelectAgent ? () => onSelectAgent(agent) : undefined}
			publisher={agent.publisher ?? deriveAgentPublisher(agent.byline)}
			publisherBrandName={agent.publisherBrandName}
			skills={agent.skills}
			sources={agent.sources}
			stats={agent.stats}
			verified={agent.verified}
		/>
	);
}
