"use client";

import { useEffect, useId, useRef, type ReactElement, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import TerminalIcon from "@atlaskit/icon-lab/core/terminal";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";

import type { AgentSessionMoreMenuActions } from "./agent-session-more-menu";
import type { AgentSessionItem } from "./agent-session-types";

// duration-normal + ease-out-practical; duration-fast + ease-in.
const COPIED_ENTER = { duration: 0.15, ease: [0.4, 1, 0.6, 1] } as const;
const COPIED_EXIT = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] } as const;

function CopiedPromptIndicator({ copied }: Readonly<{ copied: boolean }>) {
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	return (
		<span className="inline-flex size-3 items-center justify-center">
			<AnimatePresence initial={false}>
				{copied ? (
					<motion.span
						key="copied"
						aria-hidden="true"
						data-agent-session-copy-success=""
						className="inline-flex [&_svg]:text-icon-success!"
						initial={reducedMotion ? false : { opacity: 0, transform: "scale(0.65)" }}
						animate={{ opacity: 1, transform: "scale(1)" }}
						exit={{ opacity: 0, transform: reducedMotion ? "scale(1)" : "scale(0.85)", transition: reducedMotion ? { duration: 0 } : COPIED_EXIT }}
						transition={reducedMotion ? { duration: 0 } : COPIED_ENTER}
					>
						<StatusSuccessIcon color="currentColor" label="" size="small" />
					</motion.span>
				) : null}
			</AnimatePresence>
		</span>
	);
}

export function AgentSessionContinueMenu({
	actions,
	anchor,
	copied,
	item,
	onOpenChange,
	open,
	positionerClassName,
	trigger,
}: Readonly<{
	actions: Pick<AgentSessionMoreMenuActions, "onContinueInAgent" | "onCopyPrompt">;
	copied: boolean;
	item: AgentSessionItem;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	positionerClassName?: string;
} & ({ trigger: ReactElement; anchor?: never } | { trigger?: undefined; anchor: RefObject<HTMLElement | null> })>) {
	const triggerId = useId();
	const copiedTooltipId = useId();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);
	const focusTarget = anchor ?? triggerRef;
	useEffect(() => {
		if (!open || anchor === undefined || anchor.current === null) return;
		const ownerDocument = anchor.current.ownerDocument;
		function dismissOutsideCard(event: Event) {
			const target = event.target;
			if (!(target instanceof Node) || anchor?.current?.contains(target) || popupRef.current?.contains(target)) return;
			onOpenChange(false);
		}
		function dismissOnEscape(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			onOpenChange(false);
			anchor?.current?.focus({ preventScroll: true });
		}
		// The card is an explicit positioning anchor, not a registered Menu trigger.
		// Capture outside presses before neighboring drag/preview handlers consume them.
		ownerDocument.addEventListener("pointerdown", dismissOutsideCard, true);
		ownerDocument.addEventListener("click", dismissOutsideCard, true);
		ownerDocument.addEventListener("keydown", dismissOnEscape, true);
		return () => {
			ownerDocument.removeEventListener("pointerdown", dismissOutsideCard, true);
			ownerDocument.removeEventListener("click", dismissOutsideCard, true);
			ownerDocument.removeEventListener("keydown", dismissOnEscape, true);
		};
	}, [anchor, onOpenChange, open]);
	return (
		<DropdownMenu
			modal={trigger !== undefined}
			onOpenChange={(nextOpen, details) => {
				// The card owns its toggle; do not dismiss it before its click runs.
				if (!nextOpen && details.reason === "outside-press" && details.event.target instanceof Node && anchor?.current?.contains(details.event.target)) {
					details.cancel();
					return;
				}
				onOpenChange(nextOpen);
			}}
			open={open}
			triggerId={trigger === undefined ? undefined : triggerId}
		>
			{trigger === undefined ? null : <DropdownMenuTrigger id={triggerId} ref={triggerRef} render={trigger} />}
			<DropdownMenuContent
				ref={popupRef}
				anchor={anchor}
				aria-label={trigger === undefined ? `Continue ${item.agent.name} session` : undefined}
				className="min-w-44"
				collisionAvoidance={{ side: "shift", align: "shift" }}
				side="right"
				align="start"
				alignOffset={0}
				sideOffset={8}
				finalFocus={(closeType) => {
					// An exiting menu must not steal focus from a newly opened sibling.
					if (closeType !== "keyboard" || document.querySelector('[role="menu"][data-open]')) {
						return false;
					}
					return focusTarget.current;
				}}
				positionerClassName={positionerClassName}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Continue in</DropdownMenuLabel>
					{/* Prototype options stay enabled; missing callbacks intentionally do nothing. */}
					<DropdownMenuItem
						disabled={false}
						elemBefore={(
							<span aria-hidden="true">
								{item.agent.brandName ? (
									<LogoThirdParty borderless name={item.agent.brandName} size="xxsmall" />
								) : (
									<AgentAvatarVisual avatarSrc={item.agent.avatarSrc} label="" sizePx={16} vpkLogo={item.agent.vpkLogo} />
								)}
							</span>
						)}
						onSelect={() => actions.onContinueInAgent?.()}
					>
						{item.agent.name}
					</DropdownMenuItem>
					<Tooltip
						disabled={!copied}
						open={copied && open}
						triggerId={`${copiedTooltipId}-trigger`}
						onOpenChange={(nextOpen, details) => {
							if (!nextOpen && details.reason === "escape-key") {
								onOpenChange(false);
								focusTarget.current?.focus({ preventScroll: true });
							}
						}}
					>
						<DropdownMenuItem
							aria-describedby={copied ? copiedTooltipId : undefined}
							description="Copy prompt"
							disabled={false}
							elemBefore={<TerminalIcon label="" size="small" />}
							elemAfter={<CopiedPromptIndicator copied={copied} />}
							onSelect={(event) => {
								event.preventDefault();
								actions.onCopyPrompt?.();
							}}
							render={<TooltipTrigger id={`${copiedTooltipId}-trigger`} closeOnClick={false} render={<div />} />}
							selected={copied}
						>
							Terminal
						</DropdownMenuItem>
						<TooltipContent id={copiedTooltipId} role="tooltip" side="right" sideOffset={8}>Copied prompt</TooltipContent>
					</Tooltip>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
