"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import { token } from "@/lib/tokens";
import Heading from "@/components/ui/heading";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { ControlledRovoIllustration } from "@/components/ui-custom/rovo-illustration";
import { GreetingPromptRow } from "@/components/projects/shared/components/greeting-prompt-row";
import { defaultSuggestions, type RovoSuggestion } from "@/lib/rovo-suggestions";
import { isRovoAgentProfile, type RovoAgentProfile } from "@/app/data/directory/agents";
import { RichTextMentionVisualMark } from "@/components/ui-custom/rich-text-editor/menus";
import { IconTile } from "@/components/ui/icon-tile";
import { Kbd } from "@/components/ui/kbd";
import type { DirectoryAutocompleteState } from "@/lib/directory-autocomplete";
import { cn } from "@/lib/utils";

const DEFAULT_ILLUSTRATION_SRC = "/illustration-ai/chat/light.svg";
const DEFAULT_ILLUSTRATION_DARK_SRC = "/illustration-ai/chat/dark.svg";
const AGENT_ILLUSTRATION_SRC = "/illustration-ai/ai/light.svg";
const AGENT_ILLUSTRATION_DARK_SRC = "/illustration-ai/ai/dark.svg";
const LIGHT_SVG_SUFFIX = "/light.svg";
const MAX_MODE_HEADING = "Let's plan your next move";
const MAX_MODE_ILLUSTRATION_SRC = "/illustration-ai/max/light.gif";
const MAX_MODE_ILLUSTRATION_DARK_SRC = "/illustration-ai/max/dark.gif";
const CHAT_GREETING_CONTROLLED_ILLUSTRATION_SIZE = 72;
const CHAT_GREETING_CONTROLLED_CHAT_MOTION_SIZE = 180;
const CHAT_GREETING_STATIC_ILLUSTRATION_CLASS_NAME = "h-[67px] w-[74px]";
const CHAT_GREETING_ILLUSTRATION_HEADING_STAGGER = 0.18;
const CHAT_GREETING_HEADING_PROMPT_STAGGER = 0.18;
const CHAT_GREETING_HEADING_CHILD_DELAY = CHAT_GREETING_ILLUSTRATION_HEADING_STAGGER;
const CHAT_GREETING_PROMPT_CHILD_DELAY = CHAT_GREETING_HEADING_CHILD_DELAY + CHAT_GREETING_HEADING_PROMPT_STAGGER;
const CHAT_GREETING_MODE_TRANSITION = {
	type: "spring",
	bounce: 0,
	visualDuration: 0.22,
} as const;
const CHAT_GREETING_EXIT_TRANSITION = {
	duration: 0.08,
} as const;
const CHAT_GREETING_REDUCED_TRANSITION = {
	duration: 0.08,
} as const;
const CHAT_GREETING_CONTAINER_VARIANTS = {
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
const CHAT_GREETING_SEQUENCE_CONTAINER_VARIANTS = {
	hidden: {},
	visible: {},
	exit: {},
} as const;
const CHAT_GREETING_PROMPT_CONTAINER_VARIANTS = {
	hidden: {},
	visible: {
		transition: {
			delayChildren: CHAT_GREETING_PROMPT_CHILD_DELAY,
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
const CHAT_GREETING_ITEM_VARIANTS = {
	hidden: {
		opacity: 0,
		transform: "translateY(24px)",
	},
	visible: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: CHAT_GREETING_MODE_TRANSITION,
	},
	exit: {
		opacity: 0,
		transform: "translateY(-24px)",
		transition: CHAT_GREETING_EXIT_TRANSITION,
	},
} as const;
const CHAT_GREETING_HEADING_ITEM_VARIANTS = {
	hidden: {
		opacity: 0,
		transform: "translateY(24px)",
	},
	visible: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: {
			...CHAT_GREETING_MODE_TRANSITION,
			delay: CHAT_GREETING_HEADING_CHILD_DELAY,
		},
	},
	exit: {
		opacity: 0,
		transform: "translateY(-24px)",
		transition: CHAT_GREETING_EXIT_TRANSITION,
	},
} as const;
const CHAT_GREETING_REDUCED_ITEM_VARIANTS = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: CHAT_GREETING_REDUCED_TRANSITION,
	},
	exit: {
		opacity: 0,
		transition: CHAT_GREETING_REDUCED_TRANSITION,
	},
} as const;
const CHAT_GREETING_INSTANT_CONTAINER_VARIANTS = {
	hidden: {},
	visible: {},
	exit: {},
} as const;
const CHAT_GREETING_INSTANT_ITEM_VARIANTS = {
	hidden: {
		opacity: 1,
		transform: "translateY(0px)",
	},
	visible: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: {
			duration: 0,
		},
	},
	exit: {
		opacity: 0,
		transform: "translateY(0px)",
		transition: {
			duration: 0,
		},
	},
} as const;
type ChatGreetingItemVariants =
	| typeof CHAT_GREETING_ITEM_VARIANTS
	| typeof CHAT_GREETING_HEADING_ITEM_VARIANTS
	| typeof CHAT_GREETING_REDUCED_ITEM_VARIANTS;

interface ChatGreetingProps {
	/** Optional custom heading text */
	heading?: string;
	/** Optional custom light-mode illustration src */
	illustrationSrc?: string;
	/** Optional custom dark-mode illustration src */
	illustrationDarkSrc?: string;
	/**
	 * Render the illustration + heading block above the suggestion list.
	 * Surfaces with constrained vertical space (e.g. the floating chat) can
	 * pass `false` to keep just the suggestions.
	 */
	showHero?: boolean;
	/**
	 * When the user has started composing in the chat input, hide the
	 * illustration + heading hero so the suggestion list can rise to fill the
	 * freed vertical space. The suggestion list stays visible.
	 */
	isComposing?: boolean;
	/** Whether to render the Max-mode greeting and illustration. */
	isMaxMode?: boolean;
	/** Optional custom suggestions list */
	suggestions?: ReadonlyArray<RovoSuggestion>;
	/**
	 * Render a group label above the custom-agent starter list. Custom-agent
	 * branch only.
	 */
	starterGroupLabel?: string;
	/**
	 * Render `starterGroupLabel` above the custom-agent starter list. Used by
	 * custom-agent surfaces that need a labeled prompt group.
	 * Custom-agent branch only.
	 */
	showStarterGroupLabel?: boolean;
	/**
	 * Extra rows rendered in the custom-agent starter list (e.g. agent test
	 * automation rows). Custom-agent branch only.
	 */
	agentTestSection?: ReactNode;
	/** Composer-owned skill/tool autocomplete state for filtered empty-state rows. */
	directoryAutocompleteState?: DirectoryAutocompleteState | null;
	/** Uses two columns for large Rovo-style empty states only. */
	useWideSuggestionLayout?: boolean;
	/** Optional selected agent profile for custom-agent empty states. */
	selectedAgent?: RovoAgentProfile | null;
	/**
	 * Render the custom-agent greeting at the narrower Test-panel width
	 * (600px) instead of the default 800px used in the main Rovo App chat.
	 */
	isAgentTest?: boolean;
	/** Callback when a suggestion is clicked */
	onSuggestionClick?: (suggestion: RovoSuggestion) => void;
	onDirectoryAutocompleteSelect?: (index: number) => void;
}

interface SkillListItemProps {
	suggestion: RovoSuggestion;
	shortcut?: ReactNode;
	onClick?: () => void;
}

function SidebarControlledRovoIllustration({ illusId }: Readonly<{ illusId: "ai" | "chat" }>) {
	return (
		<ControlledRovoIllustration
			illusId={illusId}
			motionSize={illusId === "chat" ? CHAT_GREETING_CONTROLLED_CHAT_MOTION_SIZE : undefined}
			size={CHAT_GREETING_CONTROLLED_ILLUSTRATION_SIZE}
		/>
	);
}

function getPairedDarkIllustrationSrc(illustrationSrc: string): string {
	if (illustrationSrc.endsWith(LIGHT_SVG_SUFFIX)) {
		return `${illustrationSrc.slice(0, -LIGHT_SVG_SUFFIX.length)}/dark.svg`;
	}

	return DEFAULT_ILLUSTRATION_DARK_SRC;
}

function SkillListItem({
	suggestion,
	shortcut,
	onClick,
}: Readonly<SkillListItemProps>) {
	const iconColor = suggestion.id === "work-last-7-days" || suggestion.id === "draft-confluence-page"
		? token("color.icon.accent.blue")
		: token("color.icon.subtlest");

	return (
		<GreetingPromptRow
			description={suggestion.description}
			icon={suggestion.icon}
			iconColor={iconColor}
			imageName={suggestion.imageName}
			imageSrc={suggestion.imageSrc}
			label={suggestion.label}
			onClick={onClick}
			shortcut={shortcut}
		/>
	);
}

function DirectoryAutocompleteShortcut({
	index,
}: Readonly<{
	index: number;
}>) {
	return (
		<Kbd className="h-5 min-w-7 rounded-sm bg-bg-neutral px-1.5 text-[11px] text-text-subtle">
			⌘{index + 1}
		</Kbd>
	);
}

function DirectoryAutocompleteItem({
	index,
	state,
	onSelect,
}: Readonly<{
	index: number;
	state: DirectoryAutocompleteState;
	onSelect?: () => void;
}>) {
	const match = state.matches[index];
	if (!match) {
		return null;
	}

	return (
		<GreetingPromptRow
			description={match.mention.description}
			label={match.mention.label}
			onClick={onSelect}
			shortcut={<DirectoryAutocompleteShortcut index={index} />}
			visual={
				match.mention.visual ? (
					<RichTextMentionVisualMark
						category={match.mention.category}
						label={match.mention.label}
						size="menu"
						visual={match.mention.visual}
					/>
				) : undefined
			}
		/>
	);
}

function CustomAgentStarterItem({
	suggestion,
	onClick,
}: Readonly<SkillListItemProps>) {
	const hasOwnVisual = Boolean(suggestion.imageName || suggestion.imageSrc || suggestion.icon);

	return (
		<GreetingPromptRow
			description={suggestion.description}
			icon={suggestion.icon}
			iconColor={token("color.icon.subtle")}
			imageName={suggestion.imageName}
			imageSrc={suggestion.imageSrc}
			label={suggestion.label}
			onClick={onClick}
			visual={
				hasOwnVisual ? undefined : (
					// Greeting prompts have no inherent icon, so use a single consistent
					// "AI chat" glyph on the same neutral surface treatment used by
					// GreetingPromptVisual (bordered white tile + subtle icon).
					<IconTile
						aria-hidden={true}
						className="border border-border bg-surface"
						icon={<AiChatIcon color={token("color.icon.subtle")} label={suggestion.label} />}
						label={suggestion.label}
						size="medium"
					/>
				)
			}
		/>
	);
}

// Small left-aligned group header for custom-agent greeting surfaces that still
// need a labeled prompt group.
function GreetingGroupLabel({ label }: Readonly<{ label: string }>) {
	return (
		<div className="px-1.5 text-xs font-semibold leading-4 text-text-subtle">
			{label}
		</div>
	);
}

function CustomAgentGreeting({
	agent,
	agentTestSection,
	isAgentTest = false,
	isComposing = false,
	itemVariants,
	onSuggestionClick,
	showStarterGroupLabel = false,
	starterGroupLabel = "Chat",
}: Readonly<{
	agent: RovoAgentProfile;
	agentTestSection?: ReactNode;
	isAgentTest?: boolean;
	isComposing?: boolean;
	itemVariants: ChatGreetingItemVariants;
	onSuggestionClick?: (suggestion: RovoSuggestion) => void;
	showStarterGroupLabel?: boolean;
	starterGroupLabel?: string;
}>) {
	const shouldShowHero = !isComposing || agent.starters.length === 0;
	const activeContainerVariants = isComposing ? CHAT_GREETING_INSTANT_CONTAINER_VARIANTS : CHAT_GREETING_CONTAINER_VARIANTS;
	const activeItemVariants = isComposing ? CHAT_GREETING_INSTANT_ITEM_VARIANTS : itemVariants;

	return (
		<motion.div
			animate="visible"
			className={cn(
				"flex w-full flex-col gap-8",
				// The agent test greeting is flush-left and fills the container width
				// (avatar, heading, groups all left-aligned, lining up with the
				// composer); the main Rovo custom-agent greeting stays a centered column.
				isAgentTest ? "items-start text-left" : "mx-auto max-w-[800px] items-center text-center",
			)}
			exit="exit"
			initial="hidden"
			key={agent.id}
			variants={activeContainerVariants}
		>
			<AnimatePresence mode="popLayout" propagate>
				{shouldShowHero ? (
					<motion.div
						className={cn("flex flex-col gap-3", isAgentTest ? "items-start" : "max-w-[360px] items-center")}
						exit="exit"
						key="agent-hero"
						variants={activeContainerVariants}
					>
						<motion.div variants={activeItemVariants}>
							<AgentAvatarVisual avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} label={agent.name} sizePx={40} className="size-10 object-contain" loading="eager" />
						</motion.div>
						<motion.div className={cn("flex flex-col gap-2", isAgentTest ? "items-start" : "items-center")} variants={activeItemVariants}>
							<Heading size="large" className={isAgentTest ? "text-left" : "text-center"}>{agent.name}</Heading>
							{agent.description ? (
								<p className="line-clamp-3 text-sm leading-6 text-text-subtle">{agent.description}</p>
							) : null}
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
			<motion.div className="w-full" layout={isComposing ? false : "position"} variants={activeContainerVariants}>
				<div
					className={cn("flex max-w-full flex-col gap-1", isAgentTest ? "w-full" : "mx-auto w-fit")}
					// Onboarding-tour anchor: only the agent-test greeting exposes its
					// starters group as a spotlight target ("Test it right away" step).
					data-spotlight-anchor={isAgentTest ? "chat-starters" : undefined}
				>
					{showStarterGroupLabel ? (
						<motion.div variants={activeItemVariants}>
							<GreetingGroupLabel label={starterGroupLabel} />
						</motion.div>
					) : null}
					{agent.starters.map((suggestion) => (
						<motion.div key={suggestion.id} variants={activeItemVariants}>
							<CustomAgentStarterItem
								suggestion={suggestion}
								onClick={() => onSuggestionClick?.(suggestion)}
							/>
						</motion.div>
					))}
					{agentTestSection ? (
						agentTestSection
					) : null}
				</div>
			</motion.div>
		</motion.div>
	);
}

export default function ChatGreeting({
	heading = "How can I help?",
	illustrationSrc = DEFAULT_ILLUSTRATION_SRC,
	illustrationDarkSrc,
	isMaxMode = false,
	isComposing = false,
	selectedAgent = null,
	isAgentTest = false,
	showHero = true,
	showStarterGroupLabel = false,
	starterGroupLabel,
	agentTestSection,
	suggestions,
	directoryAutocompleteState = null,
	useWideSuggestionLayout = false,
	onSuggestionClick,
	onDirectoryAutocompleteSelect,
}: Readonly<ChatGreetingProps>) {
	const shouldReduceMotion = useReducedMotion();
	const customAgent = selectedAgent !== null && !isRovoAgentProfile(selectedAgent) ? selectedAgent : null;
	const greetingSuggestions = suggestions ?? defaultSuggestions;
	const shouldRenderDirectoryMatches =
		!customAgent &&
		directoryAutocompleteState !== null &&
		directoryAutocompleteState.matches.length > 0;
	// A directory autocomplete query that returns no matches must not collapse the
	// greeting to just the illustration + heading. Fall back to the default prompts
	// so there is always something actionable to show when there are neither
	// prompts nor search results to display.
	const hasEmptyDirectoryQuery =
		!customAgent &&
		directoryAutocompleteState !== null &&
		directoryAutocompleteState.matches.length === 0;
	const resolvedHeading = isMaxMode ? MAX_MODE_HEADING : heading;
	const resolvedIllustrationSrc = isMaxMode ? MAX_MODE_ILLUSTRATION_SRC : illustrationSrc;
	const resolvedIllustrationDarkSrc = isMaxMode
		? MAX_MODE_ILLUSTRATION_DARK_SRC
		: illustrationDarkSrc ?? getPairedDarkIllustrationSrc(illustrationSrc);
	const shouldUseControlledAgentIllustration =
		!isMaxMode &&
		resolvedIllustrationSrc === AGENT_ILLUSTRATION_SRC &&
		resolvedIllustrationDarkSrc === AGENT_ILLUSTRATION_DARK_SRC;
	// The default Rovo chat hero uses the animated, layered chat illustration
	// (enter → idle lifecycle) instead of the static chat SVG.
	const shouldUseControlledChatIllustration = !isMaxMode && resolvedIllustrationSrc === DEFAULT_ILLUSTRATION_SRC;
	const heroKey = isMaxMode ? "max" : "default";
	const itemVariants = shouldReduceMotion ? CHAT_GREETING_REDUCED_ITEM_VARIANTS : CHAT_GREETING_ITEM_VARIANTS;
	// Show directory matches when the query has them; otherwise always fall back to
	// the default prompts (empty composer, too-short query, or no-match query) so
	// the greeting is never left blank. The per-keystroke flicker that used to make
	// this list strobe between matches and defaults is fixed at the source (the
	// composer no longer nulls its autocomplete state mid-debounce), so this can
	// stay a simple "matches, else defaults" rule.
	const shouldShowSuggestionList =
		shouldRenderDirectoryMatches ||
		((directoryAutocompleteState === null || hasEmptyDirectoryQuery) && greetingSuggestions.length > 0);
	// While composing, the hero collapses to give the directory-match list room.
	// But when the query has no matches and we fall back to the default prompts,
	// keep the hero so the "no matching prompt/search results" state still shows
	// the illustration + heading above the default prompts.
	const shouldShowHero =
		showHero && (!isComposing || !shouldRenderDirectoryMatches);
	const activeContainerVariants = isComposing ? CHAT_GREETING_INSTANT_CONTAINER_VARIANTS : CHAT_GREETING_SEQUENCE_CONTAINER_VARIANTS;
	const activePromptContainerVariants = isComposing
		? CHAT_GREETING_INSTANT_CONTAINER_VARIANTS
		: shouldShowHero
			? CHAT_GREETING_PROMPT_CONTAINER_VARIANTS
			: CHAT_GREETING_CONTAINER_VARIANTS;
	const activeItemVariants = isComposing ? CHAT_GREETING_INSTANT_ITEM_VARIANTS : itemVariants;
	const headingItemVariants = isComposing
		? CHAT_GREETING_INSTANT_ITEM_VARIANTS
		: shouldReduceMotion
			? CHAT_GREETING_REDUCED_ITEM_VARIANTS
			: CHAT_GREETING_HEADING_ITEM_VARIANTS;
	return (
		<div className="w-full">
			<AnimatePresence mode="wait">
				{customAgent ? (
					<CustomAgentGreeting
						agent={customAgent}
						agentTestSection={agentTestSection}
						isAgentTest={isAgentTest}
						isComposing={isComposing}
						itemVariants={itemVariants}
						key={`agent-${customAgent.id}`}
						onSuggestionClick={onSuggestionClick}
						showStarterGroupLabel={showStarterGroupLabel}
						starterGroupLabel={starterGroupLabel}
					/>
				) : (
					<motion.div
						animate="visible"
						className="flex flex-col gap-6"
						exit="exit"
						initial="hidden"
						key={`rovo-${heroKey}-${resolvedHeading}`}
						variants={activeContainerVariants}
					>
						{shouldShowHero ? (
							<div className="flex flex-col items-center gap-2">
								{shouldUseControlledChatIllustration ? (
									<SidebarControlledRovoIllustration illusId="chat" />
								) : shouldUseControlledAgentIllustration ? (
									<SidebarControlledRovoIllustration illusId="ai" />
								) : (
									<div className={cn(CHAT_GREETING_STATIC_ILLUSTRATION_CLASS_NAME, "relative")}>
										<Image
											src={resolvedIllustrationSrc}
											alt=""
											width={74}
											height={67}
											priority
											className={cn(CHAT_GREETING_STATIC_ILLUSTRATION_CLASS_NAME, "object-contain dark:hidden [[data-color-mode=dark]_&]:hidden")}
										/>
										<Image
											src={resolvedIllustrationDarkSrc}
											alt=""
											width={74}
											height={67}
											priority
											className={cn(CHAT_GREETING_STATIC_ILLUSTRATION_CLASS_NAME, "hidden object-contain dark:block [[data-color-mode=dark]_&]:block")}
										/>
									</div>
								)}
								<motion.div style={{ willChange: "transform, opacity" }} variants={headingItemVariants}>
									<Heading size="large" className="text-center">{resolvedHeading}</Heading>
								</motion.div>
							</div>
						) : null}
						{shouldShowSuggestionList ? (
							<motion.div className="w-full" variants={activePromptContainerVariants}>
								<div className={cn(
									"grid gap-1",
									shouldRenderDirectoryMatches && useWideSuggestionLayout ? "grid-cols-2 gap-x-8" : "grid-cols-1",
								)}>
									{shouldRenderDirectoryMatches
										? directoryAutocompleteState.matches.map((match, index) => (
												<motion.div key={match.mention.id} variants={activeItemVariants}>
													<DirectoryAutocompleteItem
														index={index}
														state={directoryAutocompleteState}
														onSelect={() => onDirectoryAutocompleteSelect?.(index)}
													/>
												</motion.div>
											))
										: greetingSuggestions.map((suggestion) => (
												<motion.div key={suggestion.id} variants={activeItemVariants}>
													<SkillListItem
														suggestion={suggestion}
														onClick={() => onSuggestionClick?.(suggestion)}
													/>
												</motion.div>
											))}
								</div>
							</motion.div>
						) : null}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
