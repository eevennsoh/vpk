"use client";

import { useEffect, useRef } from "react";
import {
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationAgents,
} from "./project-butter-invocation";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";

export function ProjectButterAgentPicker({
	onAssign,
}: Readonly<{ onAssign: (agent: AgentSelectorAgent) => void }>) {
	const agents = useProjectButterInvocationAgents();
	const actions = useProjectButterInvocationActions();
	const pointer = useRef<{ x: number; y: number } | null>(null);
	const viewport = useRef<HTMLDivElement | null>(null);
	const frame = useRef<number | null>(null);
	useEffect(
		() => () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
		},
		[],
	);
	if (!actions) return null;

	const previewAtPointer = (root: HTMLElement) => {
		if (frame.current !== null) return;
		frame.current = requestAnimationFrame(() => {
			frame.current = null;
			const position = pointer.current;
			if (!root.isConnected) return;
			const option = position
				? document.elementFromPoint(position.x, position.y)?.closest<HTMLElement>("[data-butter-agent-id]")
				: null;
			const scrolled = root.scrollTop > 0;
			root.toggleAttribute("data-scrolled", scrolled);
			if (!option || !root.contains(option)) return;
			const index = agents.findIndex((agent) => agent.id === option.dataset.butterAgentId);
			if (index >= 0) {
				if (document.activeElement !== option) option.focus({ preventScroll: true });
				actions.preview(agents[index], index);
			}
		});
	};

	return (
		<DropdownMenuContent
			aria-label="Agents"
			side="right"
			align="start"
			alignOffset={-6}
			sideOffset={8}
			className="w-[260px] max-h-none overflow-hidden p-0"
			onPointerEnter={(event) => {
				pointer.current = { x: event.clientX, y: event.clientY };
			}}
			onPointerMove={(event) => {
				pointer.current = { x: event.clientX, y: event.clientY };
				if (viewport.current) previewAtPointer(viewport.current);
			}}
			onWheelCapture={(event) => {
				pointer.current = { x: event.clientX, y: event.clientY };
			}}
			onKeyDownCapture={() => {
				pointer.current = null;
			}}
			onPointerLeave={() => {
				pointer.current = null;
				actions.preview(null, -1);
			}}
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<DropdownMenuGroup>
				<DropdownMenuLabel>Agents</DropdownMenuLabel>
			</DropdownMenuGroup>
			<div
				ref={viewport}
				data-slot="jira-issue-agent-picker-scroll"
				className="h-[262px] max-h-[262px] overflow-y-auto overscroll-contain px-1 pb-1.5 data-[scrolled]:scroll-mask-top [--scroll-mask-fade-size:20px]"
				onScroll={(event) => previewAtPointer(event.currentTarget)}
			>
				{agents.map((agent, index) => (
					<DropdownMenuItem
						key={agent.id}
						data-butter-agent-id={agent.id}
						className="h-8 min-h-8 py-1"
						elemBefore={
							agent.visual ?? (
								<AgentAvatarVisual
									avatarSrc={agent.avatarSrc}
									brandName={agent.brandName}
									logoName={agent.logoName}
									vpkLogo={agent.vpkLogo}
									label=""
									sizePx={16}
									animate={false}
								/>
							)
						}
						onMouseEnter={() => {
							if (pointer.current) actions.preview(agent, index);
						}}
						onFocus={() => actions.preview(agent, index)}
						onSelect={() => onAssign(agent)}
					>
						{agent.name}
					</DropdownMenuItem>
				))}
			</div>
		</DropdownMenuContent>
	);
}
