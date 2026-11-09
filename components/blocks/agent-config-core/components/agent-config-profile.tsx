"use client";

import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "motion/react";
import type { ReactNode } from "react";

import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";

import { AgentProfileCover } from "@/components/blocks/agent-config-core/components/agent-profile-cover";
import { UNTITLED_SUBAGENT_NAME } from "@/components/blocks/subagent/lib/subagent-prompts";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/ui/inline-edit";
import type {
	AgentConfigFormValue,
	AgentConfigTextFieldName,
} from "@/components/blocks/agent-config-core/lib/agent-config-model";

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

const AGENT_PROFILE_SWAP_SLIDE_PX = 16;
const AGENT_PROFILE_SWAP_VARIANTS = {
	enter: (direction: number) => ({ opacity: 0, x: direction * AGENT_PROFILE_SWAP_SLIDE_PX }),
	center: { opacity: 1, x: 0 },
	exit: (direction: number) => ({ opacity: 0, x: direction * -AGENT_PROFILE_SWAP_SLIDE_PX }),
} as const;
const AGENT_PROFILE_SWAP_TRANSITION = { type: "spring", bounce: 0.12, visualDuration: 0.22 } as const;

export interface AgentConfigProfileLabels {
	untitledName: string;
	editName: string;
	editDescription: string;
}

export interface AgentConfigProfileProps {
	config: AgentConfigFormValue;
	labels: AgentConfigProfileLabels;
	profileCover?: ReactNode;
	profileMetaSlot?: ReactNode;
	onTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	screenAssistantTargetPrefix?: string;
	isSubagent?: boolean;
	baseAgentName?: string;
	subagentName?: string;
	onSelectBaseAgent?: () => void;
	onSubagentNameChange?: (value: string) => void;
	subagentCondition?: string;
	onSubagentConditionChange?: (value: string) => void;
}

export function AgentConfigProfile({
	config,
	labels,
	profileCover,
	profileMetaSlot,
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
	const direction = shouldReduceMotion ? 0 : isSubagent ? 1 : -1;

	return (
		<section
			className="flex flex-col gap-2"
			data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:profile` : undefined}
		>
			{profileCover ?? <AgentProfileCover />}
			<div className="flex flex-col gap-1" data-agent-field="name">
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
								className="size-10 shrink-0 rounded-md text-icon-subtle hover:text-icon [&_svg]:size-4"
								onClick={onSelectBaseAgent}
								size="icon"
								variant="ghost"
							>
								<ArrowLeftIcon label="" />
							</Button>
						) : null}
						<InlineEdit
							className="min-w-0 flex-1"
							value={isSubagent ? subagentName ?? "" : config.name ?? ""}
							placeholder={isSubagent ? UNTITLED_SUBAGENT_NAME : labels.untitledName}
							editButtonLabel={isSubagent ? "Edit subagent name" : labels.editName}
							readViewClassName="relative h-auto overflow-visible border-2 bg-transparent px-0 py-1 text-2xl leading-7 font-semibold hover:bg-transparent active:bg-transparent focus:border-border-focused focus-visible:border-border-focused focus-visible:bg-transparent"
							readViewMotionProps={AGENT_PROFILE_INLINE_EDIT_MOTION_PROPS}
							readViewBackdropClassName="-inset-0.5 bg-bg-neutral-subtle-hovered"
							readViewBackdropMotionProps={AGENT_PROFILE_INLINE_EDIT_BACKDROP_MOTION_PROPS}
							inputProps={{ className: "h-auto border-2 px-1.5 py-1 text-2xl leading-7 font-semibold focus:border-ring md:text-2xl" }}
							onConfirm={(value) => (isSubagent ? onSubagentNameChange?.(value) : onTextChange?.("name", value))}
						/>
					</motion.div>
				</AnimatePresence>
				<div
					data-agent-field={isSubagent ? "condition" : "description"}
					data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:${isSubagent ? "condition" : "description"}` : undefined}
				>
					<InlineEdit
						value={isSubagent ? subagentCondition ?? "" : config.description ?? config.summary ?? ""}
						placeholder={isSubagent ? "Describe the situation that should trigger this subagent" : "Add a description"}
						editButtonLabel={isSubagent ? "Edit subagent trigger condition" : labels.editDescription}
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
			{profileMetaSlot ?? null}
		</section>
	);
}
