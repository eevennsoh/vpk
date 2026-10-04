"use client";

import { useCallback } from "react";
import Image from "next/image";
import CrossIcon from "@atlaskit/icon/core/cross";
import { motion } from "motion/react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { FloatingRovoButtonOnboardingConfig } from "./types";
import { motionEase } from "@/lib/motion";

export const AGENT_AVATAR_HEXAGON_PATH = "M19.01 0.922148C20.24 0.212148 21.76 0.212148 23 0.922148L40 10.6921C41.24 11.4021 42.01 12.7321 42.01 14.1621V33.6721C42.01 35.1021 41.24 36.4221 40 37.1421L23 46.9121C21.77 47.6221 20.25 47.6221 19.01 46.9121L2.01 37.1321C0.77 36.4221 0 35.0921 0 33.6621V14.1621C0 12.7321 0.77 11.4121 2.01 10.6921L19.01 0.922148Z";

export function FloatingRovoButtonOnboardingPanelInner({
	onboarding,
	onOpenChange,
	shouldReduceMotion,
}: Readonly<{
	onboarding: FloatingRovoButtonOnboardingConfig;
	onOpenChange: (open: boolean) => void;
	shouldReduceMotion: boolean;
}>) {
	const titleId = `${onboarding.id}-title`;
	const descriptionId = `${onboarding.id}-description`;
	const avatarSrc = onboarding.avatarSrc ?? "/avatar-agent/teamwork-agents/blocker-checker.svg";
	const coverSrc = onboarding.coverSrc ?? avatarSrc;
	const closeLabel = onboarding.closeLabel ?? "Dismiss onboarding";
	const phaseOneTransition = shouldReduceMotion
		? { duration: 0 }
		: { type: "spring" as const, bounce: 0.18, visualDuration: 0.26, delay: 0.22 };
	const phaseTwoContainer = shouldReduceMotion
		? { duration: 0 }
		: { delayChildren: 0.36, staggerChildren: 0.05 };
	const phaseTwoChild = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: motionEase.out };
	const phaseTwoHeaderTransition = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.22, delay: 0.32, ease: motionEase.out };
	const phaseTwoVariants = shouldReduceMotion
		? ({
			hidden: { opacity: 1, y: 0, filter: "blur(0px)" },
			visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: phaseTwoChild },
		} as const)
		: ({
			hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
			visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: phaseTwoChild },
		} as const);
	const statusLabel = onboarding.statusLabel
		?? (onboarding.status === "creating" ? "Creating..." : onboarding.status === "created" ? "Created" : "");

	const handleClose = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);
	const handleSecondaryAction = useCallback(() => {
		onboarding.onSecondaryAction?.();
		onOpenChange(false);
	}, [onboarding, onOpenChange]);

	return (
		<motion.section
			key="floating-rovo-button-panel"
			aria-describedby={descriptionId}
			aria-labelledby={titleId}
			className="flex w-full flex-col text-text-inverse"
			data-testid="floating-rovo-button-onboarding"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0, transition: { duration: 0 } }}
			transition={shouldReduceMotion
				? { duration: 0 }
				: { duration: 0.14, delay: 0.18, ease: motionEase.out }}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					handleClose();
				}
			}}
			role="dialog"
			tabIndex={-1}
		>
			<motion.header
				className="flex h-12 shrink-0 items-center justify-between gap-3 py-3 pr-2 pl-4"
				variants={phaseTwoVariants}
				initial="hidden"
				animate="visible"
				transition={phaseTwoHeaderTransition}
				style={{ willChange: "transform, opacity, filter" }}
			>
				<h2 id={titleId} className="min-w-0 truncate text-text-inverse" style={{ font: token("font.heading.xsmall") }}>
					{onboarding.title}
				</h2>
				<button
					aria-label={closeLabel}
					autoFocus
					className="flex size-8 shrink-0 items-center justify-center rounded-md text-icon-inverse transition-colors duration-normal ease-out hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15"
					onClick={handleClose}
					type="button"
				>
					<CrossIcon color={token("color.icon.inverse")} label="" size="small" />
				</button>
			</motion.header>
			<div className="flex flex-col">
				<div className="relative overflow-hidden bg-surface text-text">
					<motion.div
						aria-hidden="true"
						className="relative h-12 overflow-hidden"
						initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={phaseOneTransition}
						style={{
							backgroundColor: onboarding.coverBackgroundColor ?? token("color.icon.accent.blue"),
							willChange: "transform, opacity",
						}}
					>
						<Image
							alt=""
							aria-hidden
							className="absolute top-1/2 left-[72%] h-48 w-[168px] -translate-x-1/2 -translate-y-1/2 opacity-95"
							height={192}
							src={coverSrc}
							width={168}
						/>
					</motion.div>
					<motion.div
						className="flex flex-col gap-2 bg-surface-raised pt-8"
						initial="hidden"
						animate="visible"
						variants={{
							hidden: {},
							visible: { transition: phaseTwoContainer },
						}}
					>
						<motion.div
							className="flex flex-col gap-1 px-4 pt-2"
							variants={phaseTwoVariants}
							style={{ willChange: "transform, opacity, filter" }}
						>
							<h3 className="truncate text-text" style={{ font: token("font.heading.medium") }}>
								{onboarding.agentName}
							</h3>
							<p className="text-xs leading-4 text-text-subtle">{onboarding.byline}</p>
						</motion.div>
						<motion.p
							id={descriptionId}
							className="px-4 pb-4 text-sm leading-5 text-text"
							variants={phaseTwoVariants}
							style={{ willChange: "transform, opacity, filter" }}
						>
							{onboarding.description}
						</motion.p>
					</motion.div>
					<motion.div
						className="absolute top-6 left-4 size-12"
						initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.7 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={phaseOneTransition}
						style={{ willChange: "transform, opacity" }}
					>
						<Image
							alt={onboarding.avatarAlt ?? ""}
							className="h-12 w-[42px]"
							height={48}
							src={avatarSrc}
							width={42}
						/>
						<svg
							aria-hidden="true"
							className="pointer-events-none absolute top-0 left-0 h-12 w-[42px] overflow-visible"
							focusable="false"
							viewBox="0 0 43 48"
						>
							<path d={AGENT_AVATAR_HEXAGON_PATH} fill="none" stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
						</svg>
					</motion.div>
				</div>
				<motion.div
					className="flex flex-col"
					initial="hidden"
					animate="visible"
					variants={{
						hidden: {},
						visible: { transition: { ...phaseTwoContainer, delayChildren: 0.46 } },
					}}
				>
					<motion.p
						className="px-4 pt-3 pb-2 text-sm leading-5 text-text-inverse"
						variants={phaseTwoVariants}
						style={{ willChange: "transform, opacity, filter" }}
					>
						{onboarding.prompt}
					</motion.p>
					<motion.footer
						className="flex items-center justify-between gap-3 px-4 pt-2 pb-4"
						variants={phaseTwoVariants}
						style={{ willChange: "transform, opacity, filter" }}
					>
						<p
							aria-live="polite"
							className={cn(
								"min-w-0 text-xs leading-4 text-text-inverse",
								statusLabel ? "opacity-80" : "opacity-0",
							)}
						>
							{statusLabel || "Idle"}
						</p>
						<div className="flex shrink-0 items-center justify-end gap-2">
							<button
								className="flex h-6 items-center justify-center rounded px-2 text-sm leading-5 font-medium text-text-inverse transition-colors duration-normal ease-out hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15"
								onClick={handleSecondaryAction}
								type="button"
							>
								{onboarding.secondaryActionLabel}
							</button>
							<button
								className="flex h-6 items-center justify-center rounded border border-border-inverse/40 bg-bg-neutral-bold px-2 text-sm leading-5 font-medium text-text-inverse transition-colors duration-normal ease-out hover:bg-bg-neutral-bold-hovered focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-bg-neutral-bold-pressed disabled:cursor-default disabled:opacity-60"
								disabled={onboarding.primaryActionDisabled}
								onClick={onboarding.onPrimaryAction}
								type="button"
							>
								{onboarding.primaryActionLabel}
							</button>
						</div>
					</motion.footer>
				</motion.div>
			</div>
		</motion.section>
	);
}
