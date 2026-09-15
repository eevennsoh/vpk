"use client";

import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	type AnimationPlaybackControls,
} from "motion/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { BENTO_CAROUSEL_CONTAINER_CLASS, BENTO_CAROUSEL_TILE_CLASS, CarouselArrow, getBentoEdgeMaskStyle } from "@/components/ui-custom/bento-carousel";
import { useHasHorizontalOverflow } from "@/components/hooks/use-has-horizontal-overflow";
import { useBentoDescriptionClamp } from "@/components/ui-custom/hooks/use-bento-description-clamp";
import { SkillTag, SkillTagGroup } from "@/components/ui-custom/skill-tag";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	CARD_GLOW_EFFECT_STYLE,
	CardGlowLayers,
	cardGlowSurfaceStyle,
	useCardGlowPointerGroup,
	type CardGlowCSSProperties,
} from "@/components/visual/card-glow";
import { getAgentAvatarAccent } from "@/lib/agent-avatars";
import { getSkillIcon } from "@/lib/skill-icons";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	HOME_STARTER_CATEGORIES,
	HOME_STARTER_DEFAULT_CATEGORY,
	HOME_STARTER_VIEWS,
	type HomeStarterCategory,
	type HomeStarterHeroDecoration,
	type HomeStarterTemplate,
} from "../data/home-starter-views";

// The bento landing variant fits its tiles to a fixed-width content column,
// matching the studio shell. The carousel collapses to horizontal scroll below
// `lg` (handled by `BENTO_CAROUSEL_CONTAINER_CLASS`).
const CONTENT_MAX_WIDTH_CLASS = "max-w-[1280px]";

// Each tile's hover glow uses its own agent-avatar colour, so the traced stroke
// always matches the avatar shown on the tile.
function getCardStyle(iconSrc: string): CardGlowCSSProperties {
	return {
		// `container` travel keeps the bento's original reading of how far the
		// bloom drifts; the tiles already declare `containerType: size` for it.
		...cardGlowSurfaceStyle(getAgentAvatarAccent(iconSrc), "container"),
		containerType: "size",
		willChange: "transform, opacity",
	};
}

function BentoTileGlow({ iconSrc }: Readonly<{ iconSrc: string }>) {
	return (
		<CardGlowLayers
			art={(
				<Image
					alt=""
					aria-hidden
					className="size-12 object-contain opacity-[var(--card-glow-icon-opacity)]"
					height={48}
					src={iconSrc}
					width={48}
				/>
			)}
		/>
	);
}

const HERO_VARIANTS = {
	exit: { opacity: 0, scale: 0.98, y: -4 },
	hidden: { opacity: 0, scale: 0.98, y: 8 },
	visible: { opacity: 1, scale: 1, y: 0 },
} as const;

const CYCLE_DURATION_MS = 6000;

function HomeStarterHeroTile({
	onBlur,
	onClick,
	onFocus,
	onMouseEnter,
	onMouseLeave,
	setTileRef,
	shouldReduceMotion,
	template,
}: Readonly<{
	onBlur: () => void;
	onClick: () => void;
	onFocus: () => void;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
	setTileRef: (node: HTMLButtonElement | null) => (() => void) | undefined;
	shouldReduceMotion: boolean | null;
	template: HomeStarterTemplate & { hero: HomeStarterHeroDecoration };
}>) {
	const { hero } = template;

	return (
		<motion.button
			aria-label={`Use prompt starter: ${template.title}`}
			className={cn(
				"group group/home-starter-card relative isolate flex min-h-0 flex-col items-start gap-3 overflow-hidden rounded-lg bg-background p-4 text-left outline-none transition-[background-color,box-shadow] duration-fast ease-out hover:bg-bg-neutral-subtle focus-visible:ring-3 focus-visible:ring-ring/50",
				BENTO_CAROUSEL_TILE_CLASS,
				template.layoutClassName,
			)}
			onBlur={onBlur}
			onClick={onClick}
			onFocus={onFocus}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			ref={setTileRef}
			style={getCardStyle(template.iconSrc)}
			transition={{ duration: 0.2, ease: [0, 0.4, 0, 1] }}
			type="button"
			variants={HERO_VARIANTS}
			whileHover={
				shouldReduceMotion
					? undefined
					: { transition: { damping: 22, stiffness: 400, type: "spring" }, y: -2 }
			}
			whileTap={shouldReduceMotion ? undefined : { scale: 0.98, transition: { duration: 0.05 } }}
		>
			<BentoTileGlow iconSrc={template.iconSrc} />
			<span className="relative z-[3] inline-flex size-8 shrink-0 items-center justify-center">
				<Avatar shape="hexagon" size="default">
					<AvatarImage src={template.iconSrc} alt="" className="object-contain" />
					<AvatarFallback>{template.title.slice(0, 2).toUpperCase()}</AvatarFallback>
				</Avatar>
			</span>
			<div className="relative z-[3] flex min-h-0 flex-1 flex-col gap-4">
				<div className="flex flex-col gap-1">
					<span className="block w-full min-w-0 text-sm font-semibold leading-5 text-text">
						{template.title}
					</span>
					<span className="block w-full min-w-0 text-sm leading-5 text-text max-lg:line-clamp-2 max-lg:overflow-hidden">
						{template.description}
					</span>
				</div>
				{hero.sources.length > 0 || hero.skills.length > 0 ? (
					<div className="flex flex-col gap-4 max-lg:hidden">
						{hero.sources.length > 0 ? (
							<div className="flex flex-col gap-1">
								<span className="block text-xs font-semibold leading-4 text-text-subtle">
									Works with
								</span>
								<TWGAppstack
									animated={false}
									className="justify-start"
									iconSize="small"
									maxVisible={hero.sources.length}
									sources={hero.sources}
								/>
							</div>
						) : null}
						{hero.skills.length > 0 ? (
							<div className="flex flex-col gap-1">
								<span className="block text-xs font-semibold leading-4 text-text-subtle">
									Skills
								</span>
								<SkillTagGroup maxRows={2}>
									{hero.skills.map((skill) => (
										<SkillTag color={skill.color ?? "default"} icon={skill.icon ?? getSkillIcon(skill.label)} key={skill.label}>
											{skill.label}
										</SkillTag>
									))}
								</SkillTagGroup>
							</div>
						) : null}
					</div>
				) : null}
			</div>
		</motion.button>
	);
}

export interface HomeStarterBentoProps {
	/** Called when the "Browse all" pill is clicked (receives the active category). */
	onBrowseTemplates?: (category: HomeStarterCategory) => void;
	/** Called when the "Dismiss" pill is clicked. */
	onDismiss?: () => void;
	/** Called when a tile preview should stop. */
	onPreviewEnd?: () => void;
	/** Called when a tile is hovered/focused, with its prompt. */
	onPreviewStart?: (prompt: string) => void;
	/** Called when a tile is clicked, with its prompt. */
	onSelect?: (prompt: string) => void;
}

const NOOP = () => undefined;

/**
 * The full "Agent bento" landing variant, copied from the studio shell
 * (`HomeStarterBento`). Category tabs auto-cycle, a hero tile shows "Works with"
 * sources + "Skills", and the desktop grid collapses to a horizontal carousel
 * below `lg`. All callbacks are optional so the bento can stand alone in a
 * showcase; tiles remain fully interactive but default to no-ops.
 */
export function HomeStarterBento({
	onBrowseTemplates = NOOP,
	onDismiss = NOOP,
	onPreviewEnd = NOOP,
	onPreviewStart = NOOP,
	onSelect = NOOP,
}: Readonly<HomeStarterBentoProps>) {
	const [activeCategory, setActiveCategory] = useState<HomeStarterCategory>(HOME_STARTER_DEFAULT_CATEGORY);
	const [bentoInteracting, setBentoInteracting] = useState(false);
	const [browseAllHovered, setBrowseAllHovered] = useState(false);
	const shouldReduceMotion = useReducedMotion();
	const focusedTemplatePromptRef = useRef<string | null>(null);
	const hoveredTemplatePromptRef = useRef<string | null>(null);
	const bentoInteractingRef = useRef(false);
	const cardGlow = useCardGlowPointerGroup();
	const registerDescBox = useBentoDescriptionClamp();
	const { ref: bentoCarouselRef, canScrollLeft, canScrollRight, scrollByDir } = useHasHorizontalOverflow<HTMLDivElement>({ reduceMotion: shouldReduceMotion ?? false });
	const templates = HOME_STARTER_VIEWS[activeCategory];
	const visibleTemplates = templates.slice(0, 5);
	const canShowMore = templates.length > visibleTemplates.length;
	const cycleRunning = !shouldReduceMotion;
	const cycleProgress = useMotionValue(0);
	const cycleControlsRef = useRef<AnimationPlaybackControls | null>(null);
	const updateBentoInteracting = useCallback((interacting: boolean) => {
		bentoInteractingRef.current = interacting;
		setBentoInteracting(interacting);
	}, []);
	const selectHomeStarterCategory = useCallback((category: HomeStarterCategory) => {
		setActiveCategory(category);
	}, []);

	useEffect(() => {
		if (!cycleRunning) {
			cycleProgress.set(0);
			return;
		}

		cycleProgress.set(0);
		const controls = animate(cycleProgress, 1, {
			duration: CYCLE_DURATION_MS / 1000,
			ease: "linear",
			onComplete: () => {
				cycleProgress.set(0);
				setActiveCategory((prev) => {
					const currentIndex = HOME_STARTER_CATEGORIES.findIndex((entry) => entry.id === prev);
					const nextIndex = (currentIndex + 1) % HOME_STARTER_CATEGORIES.length;
					return HOME_STARTER_CATEGORIES[nextIndex].id;
				});
			},
		});
		if (bentoInteractingRef.current) {
			controls.pause();
		}
		cycleControlsRef.current = controls;

		return () => {
			controls.stop();
			cycleControlsRef.current = null;
		};
	}, [activeCategory, cycleRunning, cycleProgress]);

	useEffect(() => {
		const controls = cycleControlsRef.current;
		if (!controls) {
			return;
		}
		if (bentoInteracting) {
			controls.pause();
		} else {
			controls.play();
		}
	}, [bentoInteracting]);
	const handleTemplateMouseEnter = useCallback((prompt: string) => {
		hoveredTemplatePromptRef.current = prompt;
		onPreviewStart(prompt);
	}, [onPreviewStart]);
	const handleTemplateMouseLeave = useCallback(() => {
		hoveredTemplatePromptRef.current = null;

		if (focusedTemplatePromptRef.current) {
			onPreviewStart(focusedTemplatePromptRef.current);
		} else {
			onPreviewEnd();
		}
	}, [onPreviewEnd, onPreviewStart]);
	const handleTemplateFocus = useCallback((prompt: string) => {
		focusedTemplatePromptRef.current = prompt;
		onPreviewStart(prompt);
	}, [onPreviewStart]);
	const handleTemplateBlur = useCallback(() => {
		focusedTemplatePromptRef.current = null;

		if (hoveredTemplatePromptRef.current) {
			onPreviewStart(hoveredTemplatePromptRef.current);
		} else {
			onPreviewEnd();
		}
	}, [onPreviewEnd, onPreviewStart]);
	return (
		<div
			className="w-full"
			onFocus={() => updateBentoInteracting(true)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					updateBentoInteracting(false);
				}
			}}
			onMouseEnter={() => updateBentoInteracting(true)}
			onMouseLeave={() => updateBentoInteracting(false)}
			onPointerLeave={cardGlow.onPointerLeave}
			onPointerMove={cardGlow.onPointerMove}
		>
			<div className="flex flex-wrap justify-center gap-2">
				{HOME_STARTER_CATEGORIES.map((category) => {
					const isActive = activeCategory === category.id;
					const showProgress = isActive && cycleRunning;

					return (
						<button
							key={category.id}
							type="button"
							aria-pressed={isActive}
							onClick={() => {
								selectHomeStarterCategory(category.id);
							}}
							className={cn(
								"relative isolate inline-flex h-8 shrink-0 items-center overflow-hidden rounded-md border px-3 text-sm font-medium leading-5 outline-none transition-[border-color,color,box-shadow] duration-fast ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
								isActive
									? "border-border-selected bg-bg-selected text-text-selected"
									: "border-border bg-background text-text-subtle hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed",
							)}
						>
							<span className="relative z-[2] inline-flex items-center gap-1.5">
								{category.iconSrc ? (
									<span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center">
										<Image
											alt=""
											className={cn("size-6 object-contain", category.iconClassName)}
											height={24}
											src={category.iconSrc}
											width={24}
										/>
									</span>
								) : null}
								<span>{category.label}</span>
							</span>
							{showProgress ? (
								<motion.span
									aria-hidden
									className="pointer-events-none absolute inset-0 z-[1] origin-left bg-bg-selected-hovered"
									style={{ scaleX: cycleProgress, willChange: "transform" }}
								/>
							) : null}
						</button>
					);
				})}
			</div>

			<div className="@container/bento relative mt-6" style={CARD_GLOW_EFFECT_STYLE}>
				{/*
					`-mt-2 pt-2` gives the masked content top headroom that nets to zero
					visual shift: the bottom-fade mask clips its children to the box, so
					tiles flush with the top edge would have their hover lift (`y: -2`) and
					focus ring sliced off. The padding keeps that motion inside the opaque
					region; the negative margin pulls the box back so spacing is unchanged.
				*/}
				<div
					className={cn("relative -mt-2 pt-2", canShowMore && "lg:bento-fade-bottom")}
				>
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={activeCategory}
							ref={bentoCarouselRef}
							style={getBentoEdgeMaskStyle(canScrollLeft, canScrollRight)}
							className={cn(BENTO_CAROUSEL_CONTAINER_CLASS, CONTENT_MAX_WIDTH_CLASS)}
							initial={shouldReduceMotion ? false : "hidden"}
							animate="visible"
							exit={shouldReduceMotion ? undefined : "exit"}
							variants={{
								hidden: {},
								visible: {
									transition: { staggerChildren: 0.04, delayChildren: 0.02 },
								},
								exit: {
									transition: { staggerChildren: 0.02, staggerDirection: -1 },
								},
							}}
						>
							{visibleTemplates.map((template) => {
								if (template.hero) {
									return (
										<HomeStarterHeroTile
											key={template.title}
											onBlur={handleTemplateBlur}
											onClick={() => onSelect(template.prompt)}
											onFocus={() => handleTemplateFocus(template.prompt)}
											onMouseEnter={() => handleTemplateMouseEnter(template.prompt)}
											onMouseLeave={handleTemplateMouseLeave}
											setTileRef={cardGlow.registerTile}
											shouldReduceMotion={shouldReduceMotion}
											template={template as HomeStarterTemplate & { hero: HomeStarterHeroDecoration }}
										/>
									);
								}

								return (
									<motion.button
										key={template.title}
										type="button"
										aria-label={`Use prompt starter: ${template.title}`}
										onClick={() => onSelect(template.prompt)}
										onMouseEnter={() => handleTemplateMouseEnter(template.prompt)}
										onMouseLeave={handleTemplateMouseLeave}
										onFocus={() => handleTemplateFocus(template.prompt)}
										onBlur={handleTemplateBlur}
										className={cn(
											"group group/home-starter-card relative isolate flex min-h-0 flex-col items-start gap-3 overflow-hidden rounded-lg bg-background p-4 text-left outline-none transition-[background-color,box-shadow] duration-fast ease-out hover:bg-bg-neutral-subtle focus-visible:ring-3 focus-visible:ring-ring/50",
											BENTO_CAROUSEL_TILE_CLASS,
											template.layoutClassName,
										)}
										ref={cardGlow.registerTile}
										variants={{
											hidden: { opacity: 0, y: 8, scale: 0.98 },
											visible: { opacity: 1, y: 0, scale: 1 },
											exit: { opacity: 0, y: -4, scale: 0.98 },
										}}
										transition={{ duration: 0.2, ease: [0, 0.4, 0, 1] }}
										whileHover={
											shouldReduceMotion
												? undefined
												: { y: -2, transition: { type: "spring", stiffness: 400, damping: 22 } }
										}
										whileTap={shouldReduceMotion ? undefined : { scale: 0.98, transition: { duration: 0.05 } }}
										style={getCardStyle(template.iconSrc)}
									>
										<BentoTileGlow iconSrc={template.iconSrc} />
										<span className="relative z-[3] inline-flex size-8 shrink-0 items-center justify-center transition-opacity duration-fast ease-out group-hover:opacity-90">
											<Avatar shape="hexagon" size="default">
												<AvatarImage src={template.iconSrc} alt="" className="object-contain" />
												<AvatarFallback>{template.title.slice(0, 2).toUpperCase()}</AvatarFallback>
											</Avatar>
										</span>
										<span className="relative z-[3] flex w-full min-w-0 flex-1 flex-col gap-1">
											<span className="block w-full min-w-0 text-sm font-semibold leading-5 text-text">
												{template.title}
											</span>
											<span
												ref={registerDescBox}
												className="block w-full min-w-0 flex-1 min-h-0 overflow-hidden"
											>
												<span className="text-sm leading-5 text-text-subtle line-clamp-2">
													{template.description}
												</span>
											</span>
										</span>
									</motion.button>
								);
							})}
						</motion.div>
					</AnimatePresence>
					<AnimatePresence initial={false}>
						{canScrollLeft ? (
							<CarouselArrow direction="previous" key="previous" label="Show previous prompt starters" onClick={() => scrollByDir(-1)} />
						) : null}
						{canScrollRight ? (
							<CarouselArrow direction="next" key="next" label="Show next prompt starters" onClick={() => scrollByDir(1)} />
						) : null}
					</AnimatePresence>
				</div>
				<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-2">
						<div
							className="group/browse-all pointer-events-auto relative flex items-center"
							onMouseEnter={() => setBrowseAllHovered(true)}
							onMouseLeave={() => setBrowseAllHovered(false)}
							onFocus={() => setBrowseAllHovered(true)}
							onBlur={(event) => {
								if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
									setBrowseAllHovered(false);
								}
							}}
						>
							{canShowMore ? (
								<Button
								type="button"
								aria-label="Browse all agents"
								variant="ghost"
								size="compact"
								className="h-7 rounded-full border-0 bg-surface px-3 text-sm leading-5 font-normal text-text-subtle hover:bg-surface-hovered"
								style={{ boxShadow: token("elevation.shadow.overlay") }}
								onClick={() => onBrowseTemplates(activeCategory)}
							>
								Browse all
								</Button>
							) : null}
							{/* Absolutely positioned so "Browse all" stays centered at rest. */}
							<AnimatePresence initial={false}>
								{canShowMore && browseAllHovered ? (
									<motion.div
										key="dismiss"
										className="absolute left-full top-0 ml-2"
										initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
										animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
										exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
										transition={{ type: "spring", visualDuration: 0.25, bounce: 0.2 }}
									>
										<Button
											type="button"
											aria-label="Dismiss prompt starters"
											variant="ghost"
											size="compact"
											className="h-7 rounded-full border-0 bg-surface px-3 text-sm leading-5 font-normal text-text-subtle hover:bg-surface-hovered"
											style={{ boxShadow: token("elevation.shadow.overlay") }}
											onClick={onDismiss}
										>
											Dismiss
										</Button>
									</motion.div>
								) : null}
							</AnimatePresence>
						</div>
					</div>
			</div>
		</div>
	);
}
