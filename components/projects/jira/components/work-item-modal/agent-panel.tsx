"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useState } from "react";
import { useWorkItemData } from "@/app/contexts/context-work-item-modal";
import { AgentSelector } from "@/components/blocks/agent-selector";
import { BOARD_AGENTS } from "@/components/projects/jira/data/board-agents";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Heading from "@/components/ui/heading";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

const AGENT_ICON_ROTATION_VARIANTS = {
	rest: {
		transform: "rotate(0deg)",
	},
	hovered: {
		transform: "rotate(45deg)",
	},
} satisfies Variants;

const AGENT_ICON_ROTATION_REDUCED_VARIANTS = {
	rest: {
		transform: "rotate(0deg)",
	},
	hovered: {
		transform: "rotate(0deg)",
	},
} satisfies Variants;

const AGENT_ICON_ROTATION_TRANSITION = {
	duration: 0.42,
	ease: motionEase.out,
} as const;

type AgentPanelIllustrationProps = {
	isSparkleVisible: boolean;
};

function AgentPanelIllustration({ isSparkleVisible }: AgentPanelIllustrationProps) {
	const shouldReduceMotion = useReducedMotion();

	return (
		<>
			<div
				className={cn(
					"pointer-events-none absolute -left-3 -top-3 z-10 text-text motion-safe:transition-opacity motion-safe:duration-normal",
					isSparkleVisible ? "opacity-100" : "opacity-0",
				)}
				aria-hidden="true"
			>
				<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
					<path d="M0.1753 8.18322C-0.179257 8.37652 0.0503008 9.4565 0.452825 9.48887C1.02501 9.53572 1.604 9.50027 2.33257 9.35214C3.14178 9.12623 3.30036 8.86002 3.86037 8.76794C4.80009 8.5682 6.45103 8.53065 6.84865 8.52363C6.90716 8.5213 6.96429 8.51253 7.02005 8.4973C7.41625 8.36929 9.15847 7.83049 10.7024 7.5832C11.7815 7.35381 12.4509 7.20479 12.7996 7.13068C13.621 6.94597 14.2153 6.70508 14.7765 6.37352C15.0846 6.19011 14.8852 5.25197 14.5291 5.20972C13.8809 5.13185 13.24 5.15352 12.4151 5.32211C12.0964 5.38987 11.3708 5.27453 10.4215 5.42914C10.2674 5.45516 10.1181 5.50374 9.97424 5.57812C8.734 6.20902 7.006 6.47186 7.006 6.47186C7.006 6.47186 4.45847 7.00998 3.38525 7.23473C2.57504 7.40695 2.18722 7.49275 1.94883 7.54679C1.22632 7.70711 0.680334 7.91414 0.176671 8.18967L0.1753 8.18322Z" fill="currentColor" />
					<path d="M6.55751 0.165326C6.36317 -0.177488 5.25079 0.0589546 5.21269 0.451175C5.15768 1.00873 5.18715 1.57191 5.33058 2.27934C5.55296 3.06433 5.82456 3.21551 5.91244 3.75954C6.10636 4.67188 6.1251 6.27852 6.12753 6.66549C6.12922 6.72241 6.13755 6.77793 6.15252 6.83203C6.27928 7.21616 6.81192 8.90562 7.04744 10.4055C7.27014 11.4533 7.41521 12.1031 7.48716 12.4416C7.66706 13.239 7.90742 13.8146 8.24132 14.3569C8.42607 14.6546 9.39234 14.4492 9.44004 14.1021C9.52784 13.4702 9.51328 12.8465 9.34998 12.0456C9.28419 11.7361 9.41141 11.0285 9.26398 10.1062C9.2391 9.95652 9.19097 9.81175 9.11628 9.67263C8.48299 8.47293 8.23371 6.79399 8.23371 6.79399C8.23371 6.79399 7.71144 4.3206 7.49343 3.2786C7.32623 2.49198 7.24273 2.1155 7.19008 1.88409C7.03405 1.1827 6.8279 0.653709 6.55087 0.166737L6.55751 0.165326Z" fill="currentColor" />
				</svg>
			</div>
			<div
				className="flex size-6 items-center justify-center rounded-full text-text"
				aria-hidden="true"
				style={{ backgroundColor: token("color.background.accent.green.subtle") }}
			>
				<motion.svg
					animate={isSparkleVisible ? "hovered" : "rest"}
					initial={false}
					transition={AGENT_ICON_ROTATION_TRANSITION}
					variants={shouldReduceMotion ? AGENT_ICON_ROTATION_REDUCED_VARIANTS : AGENT_ICON_ROTATION_VARIANTS}
					width="13"
					height="13"
					viewBox="0 0 13 13"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
					focusable="false"
				>
					<path fillRule="evenodd" clipRule="evenodd" d="M-5.74054e-05 4.61972L1.76402 10.7718L8.02913 12.3043L12.5302 7.68465L10.7661 1.53258L4.50097 0.000111983L-5.74054e-05 4.61972ZM5.63008 3.0053L5.99159 3.47665C6.505 4.14621 6.76165 4.48122 7.11716 4.68671C7.47269 4.8922 7.89108 4.94728 8.72759 5.05798L9.08584 5.10561L9.21182 5.54494L8.93313 5.7748C8.28234 6.31198 7.95688 6.58073 7.76427 6.94343C7.57168 7.3061 7.53153 7.72617 7.45096 8.56608L7.39416 9.15738L6.95483 9.28335L6.59333 8.812C6.07989 8.14242 5.82325 7.80745 5.46775 7.60194C5.11222 7.39644 4.69377 7.341 3.85722 7.23029L3.49907 7.18304L3.3731 6.74372L3.65168 6.51348C4.30236 5.97633 4.62806 5.70787 4.82065 5.34523C5.01324 4.98257 5.05334 4.56249 5.13396 3.72257L5.19076 3.13128L5.63008 3.0053Z" fill="currentColor" />
				</motion.svg>
			</div>
		</>
	);
}

export function AgentPanel() {
	const workItem = useWorkItemData();
	const [isAgentPanelHovered, setIsAgentPanelHovered] = useState(false);
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedAgentIds, setSelectedAgentIds] = useState<readonly string[]>([]);

	const handleAgentToggle = (agentId: string) => {
		setSelectedAgentIds((currentIds) => (
			currentIds.includes(agentId)
				? currentIds.filter((currentId) => currentId !== agentId)
				: [...currentIds, agentId]
		));
	};

	const handleSelectorOpenChange = (nextOpen: boolean) => {
		setIsSelectorOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	};

	const handleFooterAction = () => {
		setIsSelectorOpen(false);
		setQuery("");
	};

	const handleAgentPanelHover = (direction: "enter" | "leave") => {
		setIsAgentPanelHovered(direction === "enter");
	};

	return (
		<section
			aria-labelledby="work-item-agent-panel-title"
			style={{
				display: "grid",
				rowGap: token("space.200"),
			}}
		>
			<div>
				<Heading as="h3" id="work-item-agent-panel-title" size="small">
					Agents
				</Heading>
			</div>

			<div
				data-testid="ai-agent-sessions.agent-panel-empty-state"
				className="flex min-h-14 items-center justify-center rounded-lg border border-dashed border-border"
				onMouseEnter={() => handleAgentPanelHover("enter")}
				onMouseLeave={() => handleAgentPanelHover("leave")}
				style={{
					paddingBlock: "20px",
					paddingInline: token("space.200"),
				}}
			>
				<div
					className="flex items-center justify-center gap-2"
				>
					<div
						data-slot="icon-tile"
						aria-label="Agent"
						className="relative inline-flex size-6 shrink-0 items-center justify-center"
					>
						<AgentPanelIllustration
							isSparkleVisible={isAgentPanelHovered}
						/>
					</div>
					<DropdownMenu open={isSelectorOpen} onOpenChange={handleSelectorOpenChange}>
						<DropdownMenuTrigger
							render={
								<Button
									aria-label={`Open agent selector for ${workItem.code}`}
									variant="outline"
								/>
							}
						>
							Start work
							<ChevronDownIcon label="" size="small" />
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="max-h-none w-[360px] overflow-hidden p-0"
							positionerClassName="z-[502]"
							sideOffset={8}
						>
							<AgentSelector
								agents={BOARD_AGENTS}
								onAgentToggle={handleAgentToggle}
								onBrowseAgents={handleFooterAction}
								onCreateAgent={handleFooterAction}
								onQueryChange={setQuery}
								query={query}
								selectedAgentIds={selectedAgentIds}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</section>
	);
}
