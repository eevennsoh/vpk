"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { GreetingPromptRow } from "@/components/projects/shared/components/greeting-prompt-row";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Heading from "@/components/ui/heading";
import type {
	RovoAppEmptyStateConfig,
	RovoAppEmptyState,
	RovoAppEmptyStateHeadingAs,
	RovoAppImageIllustrationEmptyState as RovoAppIllustratedEmptyState,
} from "./rovo-app-empty-state-config";

export type { RovoAppEmptyStateConfig } from "./rovo-app-empty-state-config";

const ROVO_APP_EMPTY_STATE_MODE_TRANSITION = {
	type: "spring",
	bounce: 0,
	visualDuration: 0.14,
} as const;
const ROVO_APP_EMPTY_STATE_EXIT_TRANSITION = {
	duration: 0.08,
} as const;
const ROVO_APP_EMPTY_STATE_REDUCED_TRANSITION = {
	duration: 0.08,
} as const;
const ROVO_APP_EMPTY_STATE_CONTAINER_VARIANTS = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.04,
		},
	},
	exit: {
		transition: {
			staggerChildren: 0.02,
			staggerDirection: -1,
		},
	},
} as const;
const ROVO_APP_EMPTY_STATE_ITEM_VARIANTS = {
	hidden: {
		opacity: 0,
		transform: "translateY(6px)",
	},
	visible: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: ROVO_APP_EMPTY_STATE_MODE_TRANSITION,
	},
	exit: {
		opacity: 0,
		transform: "translateY(-6px)",
		transition: ROVO_APP_EMPTY_STATE_EXIT_TRANSITION,
	},
} as const;
const ROVO_APP_EMPTY_STATE_REDUCED_ITEM_VARIANTS = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: ROVO_APP_EMPTY_STATE_REDUCED_TRANSITION,
	},
	exit: {
		opacity: 0,
		transition: ROVO_APP_EMPTY_STATE_REDUCED_TRANSITION,
	},
} as const;
type RovoAppEmptyStateItemVariants = typeof ROVO_APP_EMPTY_STATE_ITEM_VARIANTS | typeof ROVO_APP_EMPTY_STATE_REDUCED_ITEM_VARIANTS;

function hasRovoAppEmptyStateIllustration(emptyState: RovoAppEmptyState): emptyState is RovoAppIllustratedEmptyState {
	return "illustrationClassName" in emptyState;
}

function RovoAppCustomAgentEmptyState({
	agent,
	headingAs,
	hideStarters,
	itemVariants,
	onSelectSuggestion,
}: Readonly<{
	agent: RovoAgentProfile;
	headingAs: RovoAppEmptyStateHeadingAs;
	hideStarters: boolean;
	itemVariants: RovoAppEmptyStateItemVariants;
	onSelectSuggestion: (suggestion: string) => Promise<void>;
}>) {
	return (
		<motion.div
			animate="visible"
			className="flex flex-col items-center gap-8 py-6 text-center"
			exit="exit"
			initial="hidden"
			key={agent.id}
			variants={ROVO_APP_EMPTY_STATE_CONTAINER_VARIANTS}
		>
			<div className="flex max-w-[520px] flex-col items-center gap-3">
				<motion.div variants={itemVariants}>
					<AgentAvatarVisual avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} label={agent.name} sizePx={40} className="size-10 object-contain" loading="eager" />
				</motion.div>
				<motion.div className="flex flex-col items-center gap-2" variants={itemVariants}>
					<Heading as={headingAs} size="xlarge">{agent.name}</Heading>
					{agent.description ? (
						<p className="max-w-[460px] text-base leading-6 text-text-subtle">{agent.description}</p>
					) : null}
				</motion.div>
			</div>
			{hideStarters ? null : (
				<motion.div className="flex w-full max-w-[720px] flex-col gap-2" variants={ROVO_APP_EMPTY_STATE_CONTAINER_VARIANTS}>
					{agent.starters.map((starter) => {
						const starterPrompt = starter.prompt ?? starter.label;

						return (
							<motion.div key={starter.id} variants={itemVariants}>
								<GreetingPromptRow
									description={starter.description}
									icon={starter.icon}
									imageSrc={starter.imageSrc}
									label={starter.label}
									onClick={() => {
										void onSelectSuggestion(starterPrompt);
									}}
								/>
							</motion.div>
						);
					})}
				</motion.div>
			)}
		</motion.div>
	);
}

export function RovoAppConversationEmptyState({
	customAgent,
	emptyStateConfig,
	headingAs = "h2",
	hideCustomAgentStarters,
	isMaxMode,
	onSelectSuggestion,
}: Readonly<{
	customAgent: RovoAgentProfile | null;
	emptyStateConfig: RovoAppEmptyStateConfig;
	headingAs?: RovoAppEmptyStateHeadingAs;
	hideCustomAgentStarters: boolean;
	isMaxMode: boolean;
	onSelectSuggestion: (suggestion: string) => Promise<void>;
}>) {
	const shouldReduceMotion = useReducedMotion();
	const emptyState = isMaxMode ? emptyStateConfig.max : emptyStateConfig.default;
	const emptyStateItemVariants = shouldReduceMotion ? ROVO_APP_EMPTY_STATE_REDUCED_ITEM_VARIANTS : ROVO_APP_EMPTY_STATE_ITEM_VARIANTS;

	return (
		<div className="flex flex-col items-center gap-2 py-6">
			<AnimatePresence mode="wait">
				{customAgent ? (
					<RovoAppCustomAgentEmptyState
						agent={customAgent}
						headingAs={headingAs}
						hideStarters={hideCustomAgentStarters}
						itemVariants={emptyStateItemVariants}
						key={`agent-${customAgent.id}`}
						onSelectSuggestion={onSelectSuggestion}
					/>
				) : (
					<motion.div
						animate="visible"
						className="flex flex-col items-center gap-2"
						exit="exit"
						initial="hidden"
						key={emptyState.id}
						variants={ROVO_APP_EMPTY_STATE_CONTAINER_VARIANTS}
					>
						{hasRovoAppEmptyStateIllustration(emptyState) ? (
							<motion.div className={cn(emptyState.illustrationClassName, "relative")} style={{ willChange: "transform, opacity" }} variants={emptyStateItemVariants}>
								<Image alt={emptyState.alt} className={cn(emptyState.illustrationClassName, "object-contain dark:hidden [[data-color-mode=dark]_&]:hidden")} height={emptyState.height} priority src={emptyState.lightIllustrationSrc} width={emptyState.width} />
								<Image alt={emptyState.alt} className={cn(emptyState.illustrationClassName, "hidden object-contain dark:block [[data-color-mode=dark]_&]:block")} height={emptyState.height} priority src={emptyState.darkIllustrationSrc} width={emptyState.width} />
							</motion.div>
						) : null}
						<motion.div style={{ willChange: "transform, opacity" }} variants={emptyStateItemVariants}>
							<Heading as={headingAs} size="xlarge">{emptyState.heading}</Heading>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
