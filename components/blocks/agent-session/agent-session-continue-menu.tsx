"use client";

import { useEffect, useId, useRef, type ReactElement, type RefObject } from "react";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { CopyPromptButton } from "@/components/ui-custom/copy-prompt-button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { AgentSessionMoreMenuActions } from "./agent-session-more-menu";
import type { AgentSessionItem } from "./agent-session-types";

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
							<AgentAvatarVisual
								animate={false}
								appearance="coding"
								avatarSrc={item.agent.avatarSrc}
								brandName={item.agent.brandName}
								label=""
								shape="square"
								sizePx={24}
								vpkLogo={item.agent.vpkLogo}
							/>
						)}
						onSelect={() => actions.onContinueInAgent?.()}
					>
						{item.agent.name}
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={false}
						nativeButton
						onSelect={(event) => {
							event.preventDefault();
							actions.onCopyPrompt?.();
						}}
						render={<CopyPromptButton feedback={copied ? "copied" : "idle"} presentation="menu" />}
						selected={copied}
					/>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
