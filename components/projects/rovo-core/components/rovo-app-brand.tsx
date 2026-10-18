"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import EditIcon from "@atlaskit/icon/core/edit";

import { useRovoSelectedAgent } from "@/app/contexts";
import { AgentSelector, type AgentSelectorAction } from "@/components/blocks/agent-selector";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { RovoColorIcon } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import {
	isRovoAgentProfile,
} from "@/app/data/directory/agents";

const ROVO_APP_BRAND_CONTAINER_VARIANTS = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.035,
		},
	},
	exit: {
		transition: {
			staggerChildren: 0.02,
			staggerDirection: -1,
		},
	},
} as const;
const ROVO_APP_BRAND_ITEM_VARIANTS = {
	hidden: {
		opacity: 0,
		transform: "translateY(4px)",
	},
	visible: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: {
			type: "spring",
			bounce: 0,
			visualDuration: 0.16,
		},
	},
	exit: {
		opacity: 0,
		transform: "translateY(-4px)",
		transition: {
			duration: 0.08,
		},
	},
} as const;
const ROVO_APP_BRAND_REDUCED_ITEM_VARIANTS = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: {
			duration: 0.08,
		},
	},
	exit: {
		opacity: 0,
		transition: {
			duration: 0.08,
		},
	},
} as const;

export interface RovoAppBrandProps {
	className?: string;
	enableAgentSelector?: boolean;
}

export function RovoAppBrand({
	className,
	enableAgentSelector = true,
}: Readonly<RovoAppBrandProps>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const shouldReduceMotion = Boolean(useReducedMotion());
	const {
		selectedAgent,
		selectedAgentId,
		selectableAgents,
		isCustomAgentSelected,
		selectAgent,
		resetAgentToRovo,
	} = useRovoSelectedAgent();

	const closeSelector = useCallback(() => {
		setOpen(false);
		setQuery("");
	}, []);

	const selectedAgentActions = useMemo<readonly AgentSelectorAction[]>(() => {
		if (!isCustomAgentSelected) {
			return [];
		}

		return [
			{
				id: "chat-with-rovo",
				icon: <RovoColorIcon aria-hidden className="mx-auto block" size="xxsmall" />,
				label: "Chat with Rovo",
				onSelect: () => {
					resetAgentToRovo();
					closeSelector();
				},
			},
			{
				id: "edit-agent",
				icon: <Icon className="size-4" render={<EditIcon label="" />} />,
				label: "Edit agent",
				onSelect: closeSelector,
			},
		];
	}, [closeSelector, isCustomAgentSelected, resetAgentToRovo]);

	function handleAgentSelect(agentId: string) {
		selectAgent(agentId);
		closeSelector();
	}

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	}

	const triggerLabel = isRovoAgentProfile(selectedAgent) ? "Rovo" : selectedAgent.name;
	const identityItemVariants = shouldReduceMotion ? ROVO_APP_BRAND_REDUCED_ITEM_VARIANTS : ROVO_APP_BRAND_ITEM_VARIANTS;
	const identity = (
		<AnimatePresence initial={false} mode="wait">
			<motion.span
				animate="visible"
				className="flex min-w-0 items-center gap-1.5"
				exit="exit"
				initial="hidden"
				key={selectedAgentId}
				variants={ROVO_APP_BRAND_CONTAINER_VARIANTS}
			>
				<motion.span
					aria-hidden
					className="flex size-4 shrink-0 items-center justify-center"
					data-icon="inline-start"
					variants={identityItemVariants}
				>
					<AgentAvatarVisual
						avatarSrc={selectedAgent.avatarSrc}
						brandName={selectedAgent.brandName}
						className="size-4 object-contain"
						label={selectedAgent.name}
						logoName={selectedAgent.logoName}
						sizePx={16}
					/>
				</motion.span>
				<motion.span className="min-w-0 truncate font-semibold" variants={identityItemVariants}>
					{triggerLabel}
				</motion.span>
			</motion.span>
		</AnimatePresence>
	);

	if (!enableAgentSelector) {
		return (
			<div className={cn("flex h-8 min-w-0 shrink-0 items-center px-2 text-sm font-medium text-text", className)}>
				{identity}
			</div>
		);
	}

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={isCustomAgentSelected ? `Select ${selectedAgent.name}` : "Select Rovo agent"}
						className={cn("h-8 min-w-0 shrink gap-1.5 px-2 text-sm font-medium text-text", className)}
						type="button"
						variant="ghost"
					/>
				}
			>
				{identity}
				<Icon
					aria-hidden
					className="-ml-0.5 size-4 shrink-0 text-icon-subtle group-aria-expanded/button:text-icon-selected"
					data-icon="inline-end"
					render={<ChevronDownIcon label="" size="small" spacing="none" />}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="max-h-none w-[360px] overflow-hidden p-0"
				positionerClassName="z-[600]"
				sideOffset={8}
			>
				<AgentSelector
					agents={selectableAgents}
					heading={isCustomAgentSelected ? "Switch to another agent" : undefined}
					onAgentToggle={handleAgentSelect}
					onBrowseAgents={closeSelector}
					onCreateAgent={closeSelector}
					onQueryChange={setQuery}
					query={query}
					selectedAgentActions={selectedAgentActions}
					selectionMode="single"
					searchVariant="palette"
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
