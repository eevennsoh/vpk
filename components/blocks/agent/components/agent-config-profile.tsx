"use client";

import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "motion/react";

import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";

import { UNTITLED_SUBAGENT_NAME } from "@/components/blocks/subagent/lib/subagent-prompts";
import { AgentProfileCover } from "@/components/blocks/agent/components/agent-profile-cover";
import type { AgentConfigFormValue, AgentConfigTextFieldName } from "@/components/blocks/agent/lib/agent-config-model";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/ui/inline-edit";
import { getDeterministicAgentBannerSrc } from "@/lib/agent-avatars";

const AGENT_PROFILE_INLINE_EDIT_MOTION_PROPS = {
	initial: "rest",
	animate: "rest",
	whileHover: "active",
	whileFocus: "active",
	variants: {
		rest: { paddingLeft: 0, paddingRight: 0 },
		active: { paddingLeft: "0.375rem", paddingRight: "0.375rem" },
	},
	transition: { type: "spring", bounce: 0.08, visualDuration: 0.18 },
} satisfies Pick<MotionProps, "initial" | "animate" | "whileHover" | "whileFocus" | "variants" | "transition">;
const AGENT_PROFILE_INLINE_EDIT_BACKDROP_MOTION_PROPS = {
	variants: {
		rest: { opacity: 0, scaleX: 0.98 },
		active: { opacity: 1, scaleX: 1 },
	},
	transition: { type: "spring", bounce: 0.08, visualDuration: 0.18 },
} satisfies Pick<MotionProps, "variants" | "transition">;
// Direction-aware swap for the profile header (name + description, plus the
// inline back-arrow on subagents) when toggling between the base agent and a
// subagent. Forward (parent →
// subagent) slides the incoming content in from the right; back (subagent →
// parent) slides it in from the left. Spring-based so an interrupted swap (rapid
// jumps) settles naturally; `opacity` + `transform` are the only animated props.
const AGENT_PROFILE_SWAP_SLIDE_PX = 16;
const AGENT_PROFILE_SWAP_VARIANTS = {
	enter: (direction: number) => ({ opacity: 0, x: direction * AGENT_PROFILE_SWAP_SLIDE_PX }),
	center: { opacity: 1, x: 0 },
	exit: (direction: number) => ({ opacity: 0, x: direction * -AGENT_PROFILE_SWAP_SLIDE_PX }),
} as const;
const AGENT_PROFILE_SWAP_TRANSITION = { type: "spring", bounce: 0.12, visualDuration: 0.22 } as const;

export interface AgentConfigProfileProps {
	config: AgentConfigFormValue;
	avatarSrc?: string;
	onAvatarChange?: (avatarSrc: string) => void;
	onTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	screenAssistantTargetPrefix?: string;
	// Subagent editing context. When `isSubagent` is true the profile header
	// shows a back-arrow icon button inline before the name (a quick way back to
	// the base agent, wired to `onSelectBaseAgent`), and the big editable title
	// becomes the subagent's name (placeholder "Untitled subagent") wired to
	// `onSubagentNameChange` instead of the base config name.
	isSubagent?: boolean;
	baseAgentName?: string;
	subagentName?: string;
	onSelectBaseAgent?: () => void;
	onSubagentNameChange?: (value: string) => void;
	// While editing a subagent the description slot becomes the trigger
	// condition ("Describe the situation that should trigger this subagent"),
	// bound to the subagent's condition rather than the base agent description.
	subagentCondition?: string;
	onSubagentConditionChange?: (value: string) => void;
}

export function AgentConfigProfile({
	config,
	avatarSrc,
	onAvatarChange,
	onTextChange,
	screenAssistantTargetPrefix,
	isSubagent = false,
	subagentName,
	onSelectBaseAgent,
	onSubagentNameChange,
	subagentCondition,
	onSubagentConditionChange,
}: Readonly<AgentConfigProfileProps>) {
	const shouldReduceMotion = useReducedMotion();
	// Swap direction for the header content: +1 when entering a subagent (slide in
	// from the right), -1 when returning to the parent (slide in from the left).
	// Reduced motion collapses the slide to a pure crossfade.
	const direction = shouldReduceMotion ? 0 : isSubagent ? 1 : -1;
	return (
		<section
			className="flex flex-col gap-4"
			data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:profile` : undefined}
		>
			<AgentProfileCover
				avatarSrc={avatarSrc}
				onAvatarChange={onAvatarChange}
				bannerSrc={getDeterministicAgentBannerSrc(avatarSrc, config.agentId ?? avatarSrc)}
				screenAssistantTargetPrefix={screenAssistantTargetPrefix}
			/>
			<div className="flex flex-col gap-1" data-agent-field="name">
				{/* The cover/avatar and the description below stay put; only the name
				    row (title + inline back-arrow on subagents) crossfades and slides
				    when swapping between the base agent and a subagent. `popLayout`
				    lets the exiting copy leave the layout flow so the entering copy
				    doesn't jump. */}
				<AnimatePresence custom={direction} initial={false} mode="popLayout">
					<motion.div
						key={isSubagent ? "subagent" : "base"}
						custom={direction}
						variants={AGENT_PROFILE_SWAP_VARIANTS}
						initial="enter"
						animate="center"
						exit="exit"
						transition={AGENT_PROFILE_SWAP_TRANSITION}
						className="flex items-center gap-1"
						style={{ willChange: "transform, opacity" }}
						data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:name` : undefined}
					>
						{isSubagent ? (
							<Button
								type="button"
								aria-label="Back to parent agent"
								data-agent-field="back-to-parent"
								className="-ml-2 text-icon-subtle"
								onClick={onSelectBaseAgent}
								size="icon"
								variant="ghost"
							>
								<ArrowLeftIcon label="" color="currentColor" />
							</Button>
						) : null}
						<InlineEdit
							className="min-w-0 flex-1"
							value={isSubagent ? subagentName ?? "" : config.name ?? ""}
							placeholder={isSubagent ? UNTITLED_SUBAGENT_NAME : "Untitled agent"}
							editButtonLabel={isSubagent ? "Edit subagent name" : "Edit agent name"}
							readViewClassName="relative h-auto overflow-visible border-2 bg-transparent px-0 py-1 text-2xl leading-7 font-semibold hover:bg-transparent active:bg-transparent focus:border-border-focused focus-visible:border-border-focused focus-visible:bg-transparent"
							readViewMotionProps={AGENT_PROFILE_INLINE_EDIT_MOTION_PROPS}
							readViewBackdropClassName="-inset-0.5 bg-bg-neutral-subtle-hovered"
							readViewBackdropMotionProps={AGENT_PROFILE_INLINE_EDIT_BACKDROP_MOTION_PROPS}
							inputProps={{ className: "h-auto border-2 px-1.5 py-1 text-2xl leading-7 font-semibold focus:border-ring md:text-2xl" }}
							onConfirm={(value) => (isSubagent ? onSubagentNameChange?.(value) : onTextChange?.("name", value))}
						/>
					</motion.div>
				</AnimatePresence>
				{/* Description / trigger condition is intentionally NOT animated — it
				    stays put and just swaps its bound value as the view changes. */}
				<div
					data-agent-field={isSubagent ? "condition" : "description"}
					data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:${isSubagent ? "condition" : "description"}` : undefined}
				>
					<InlineEdit
						value={isSubagent ? subagentCondition ?? "" : config.description ?? config.summary ?? ""}
						placeholder={isSubagent ? "Describe the situation that should trigger this subagent" : "Add a description"}
						editButtonLabel={isSubagent ? "Edit subagent trigger condition" : "Edit agent description"}
						multiline
						readViewClassName="relative overflow-visible border-2 bg-transparent px-0 hover:bg-transparent active:bg-transparent focus-visible:bg-transparent"
						readViewMotionProps={AGENT_PROFILE_INLINE_EDIT_MOTION_PROPS}
						readViewBackdropClassName="-inset-0.5 bg-bg-neutral-subtle-hovered"
						readViewBackdropMotionProps={AGENT_PROFILE_INLINE_EDIT_BACKDROP_MOTION_PROPS}
						textareaProps={{ rows: 1, className: "min-h-10 border-2 bg-bg-neutral-subtle px-1.5 focus:border-ring focus-visible:border-ring focus-visible:ring-0 focus-visible:ring-offset-0 data-[variant=default]:border-transparent data-[variant=default]:focus:border-ring data-[variant=default]:focus-visible:border-ring" }}
						onConfirm={(value) => (isSubagent ? onSubagentConditionChange?.(value) : onTextChange?.("description", value))}
					/>
				</div>
			</div>
		</section>
	);
}
