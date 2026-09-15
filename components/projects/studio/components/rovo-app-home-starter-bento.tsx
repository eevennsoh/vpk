"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate animation loops and refs without restarting bridges on every callback change.
// oxlint-disable react-doctor/no-chain-state-updates -- Interaction refs and state are updated together to keep animation controls synchronized.
// oxlint-disable react-doctor/no-pass-data-to-parent -- Starter selection and preview callbacks intentionally report user choices to the Studio shell owner.

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";
import { useBentoDescriptionClamp } from "@/components/ui-custom/hooks/use-bento-description-clamp";
import { useHasHorizontalOverflow } from "@/components/hooks/use-has-horizontal-overflow";
import { BENTO_CAROUSEL_CONTAINER_CLASS, BENTO_CAROUSEL_TILE_CLASS, CarouselArrow, getBentoEdgeMaskStyle } from "@/components/ui-custom/bento-carousel";
import { ROVO_APP_STUDIO_CONTENT_MAX_WIDTH_CLASS } from "@/components/projects/studio/lib/studio-layout-constants";
import { buildCreationTemplateContextFromStarter, type StudioCreationTemplateContext } from "@/components/projects/rovo-core/lib/agent-records/agent-creation-context";
import { HOME_STARTER_CATEGORIES, HOME_STARTER_DEFAULT_CATEGORY, HOME_STARTER_VIEWS, type HomeStarterCategory, type HomeStarterHeroDecoration, type HomeStarterTemplate } from "@/components/projects/studio/data/home-starter-templates";
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
import { SkillTag, SkillTagGroup } from "@/components/ui-custom/skill-tag";
import { getSkillIcon } from "@/lib/skill-icons";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const HOME_STARTER_BENTO_ENTER_TRANSITION = {
	type: "spring",
	visualDuration: 0.32,
	bounce: 0,
} as const;
const STUDIO_HOME_BENTO_INSTANT_EXIT = {
	height: 0,
	marginBottom: 0,
	opacity: 0,
	overflow: "hidden",
	transition: { duration: 0 },
} as const;
const STUDIO_HOME_BENTO_COLLAPSE_EXIT = {
	height: 0,
	marginBottom: 0,
	opacity: 0,
	overflow: "hidden",
	transform: "translateY(-8px)",
	transition: { type: "spring", visualDuration: 0.35, bounce: 0 },
} as const;
type StudioHomeBentoExitContext = {
	instant: boolean;
	reduceMotion: boolean;
};
const STUDIO_HOME_BENTO_VARIANTS = {
	hidden: {
		opacity: 0,
		transform: "translateY(-8px)",
	},
	visible: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: HOME_STARTER_BENTO_ENTER_TRANSITION,
	},
	exit: ({ instant, reduceMotion }: StudioHomeBentoExitContext) =>
		instant || reduceMotion ? STUDIO_HOME_BENTO_INSTANT_EXIT : STUDIO_HOME_BENTO_COLLAPSE_EXIT,
} as const;

// Each tile's hover glow uses its own agent-avatar colour, so the traced
// stroke always matches the avatar shown on the tile.
function getHomeStarterCardStyle(iconSrc: string): CardGlowCSSProperties {
	return {
		// `container` travel keeps the bento's original reading of how far the
		// bloom drifts; the tiles already declare `containerType: size` for it.
		...cardGlowSurfaceStyle(getAgentAvatarAccent(iconSrc), "container"),
		containerType: "size",
		willChange: "transform, opacity",
	};
}

function HomeStarterCardGlowLayers({ iconSrc }: Readonly<{ iconSrc: string }>) {
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

const HOME_STARTER_HERO_VARIANTS = {
	exit: { opacity: 0, scale: 0.98, y: -4 },
	hidden: { opacity: 0, scale: 0.98, y: 8 },
	visible: { opacity: 1, scale: 1, y: 0 },
} as const;

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
			style={getHomeStarterCardStyle(template.iconSrc)}
			transition={{ duration: 0.2, ease: [0, 0.4, 0, 1] }}
			type="button"
			variants={HOME_STARTER_HERO_VARIANTS}
			whileHover={
				shouldReduceMotion
					? undefined
					: { transition: { damping: 22, stiffness: 400, type: "spring" }, y: -2 }
			}
			whileTap={shouldReduceMotion ? undefined : { scale: 0.98, transition: { duration: 0.05 } }}
		>
			<HomeStarterCardGlowLayers iconSrc={template.iconSrc} />
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

const HOME_STARTER_CYCLE_DURATION_MS = 6000;

// Bottom "more below" tease. Applied as an alpha mask on the grid wrapper (the
// stable AnimatePresence host) rather than as a semi-transparent gradient
// overlay: an overlay only hides content that is fully opaque, so during a tab
// swap the exiting/entering tiles — whose own opacity is mid-animation — show
// *through* the scrim. A mask clips the content layer's alpha at the source, so
// transitioning tiles can never leak past the fade. Height matches the prior
// `h-24` (96px) overlay. The "Browse all" pill stays a separate, unmasked
// sibling so it keeps reading as a crisp affordance over the faded edge.

function HomeStarterBento({
	onBrowseTemplates,
	onDismiss,
	onPreviewEnd,
	onPreviewStart,
	onSelect,
	templatesDialogOpen,
}: Readonly<{
	onBrowseTemplates: (category: HomeStarterCategory) => void;
	onDismiss: () => void;
	onPreviewEnd: () => void;
	onPreviewStart: (prompt: string) => void;
	onSelect: (prompt: string, template?: StudioCreationTemplateContext) => void;
	templatesDialogOpen: boolean;
}>) {
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
	const cycleRunning = !shouldReduceMotion && !templatesDialogOpen;
	const cycleProgress = useMotionValue(0);
	const cycleControlsRef = useRef<AnimationPlaybackControls | null>(null);
	const updateBentoInteracting = useCallback((interacting: boolean) => {
		bentoInteractingRef.current = interacting;
		setBentoInteracting(interacting);
	}, []);

	useEffect(() => {
		if (!cycleRunning) {
			cycleProgress.set(0);
			return;
		}

		cycleProgress.set(0);
		const controls = animate(cycleProgress, 1, {
			duration: HOME_STARTER_CYCLE_DURATION_MS / 1000,
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
			<div className="@container/bento relative" style={CARD_GLOW_EFFECT_STYLE}>
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
							className={cn(BENTO_CAROUSEL_CONTAINER_CLASS, ROVO_APP_STUDIO_CONTENT_MAX_WIDTH_CLASS)}
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
											onClick={() => onSelect(template.prompt, buildCreationTemplateContextFromStarter(template))}
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
										style={getHomeStarterCardStyle(template.iconSrc)}
									>
										<HomeStarterCardGlowLayers iconSrc={template.iconSrc} />
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
									<>
										{/* Bridge the visual 8px gap so pointer movement from "Browse all" to
										    "Dismiss" cannot fall through and hover a bento tile behind it. */}
										<div aria-hidden className="pointer-events-auto absolute left-full top-0 h-7 w-2" />
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
									</>
								) : null}
							</AnimatePresence>
						</div>
					</div>
			</div>
		</div>
	);
}

export function RovoAppHomeStarterBento({
	instantExit,
	isVisible,
	onBrowseTemplates,
	onDismiss,
	onPreviewEnd,
	onPreviewStart,
	onSelect,
	reduceMotion,
	templatesDialogOpen,
}: Readonly<{
	instantExit: boolean;
	isVisible: boolean;
	onBrowseTemplates: (category: HomeStarterCategory) => void;
	onDismiss: () => void;
	onPreviewEnd: () => void;
	onPreviewStart: (prompt: string) => void;
	onSelect: (prompt: string, template?: StudioCreationTemplateContext) => void;
	reduceMotion: boolean;
	templatesDialogOpen: boolean;
}>) {
	const homeStarterBentoPresence = {
		instant: instantExit,
		reduceMotion,
	};

	return (
		<AnimatePresence custom={homeStarterBentoPresence} initial={false}>
			{isVisible ? (
				<motion.div
					key="home-starter-bento"
					className="z-10 mx-auto mb-3 w-[90%]"
					animate="visible"
					custom={homeStarterBentoPresence}
					exit="exit"
					initial={reduceMotion ? false : "hidden"}
					style={{ willChange: "transform, opacity, height" }}
					variants={STUDIO_HOME_BENTO_VARIANTS}
				>
					<HomeStarterBento
						onBrowseTemplates={onBrowseTemplates}
						onDismiss={onDismiss}
						onPreviewEnd={onPreviewEnd}
						onPreviewStart={onPreviewStart}
						onSelect={onSelect}
						templatesDialogOpen={templatesDialogOpen}
					/>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
