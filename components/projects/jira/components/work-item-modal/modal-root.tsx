"use client";

import { useCallback, useRef, useState, type ReactNode, type RefObject } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { useWorkItemModal } from "@/app/contexts/context-work-item-modal";
import { ModalFinalFocusContext, type ModalFinalFocus } from "./modal-final-focus-context";

/** A press or key from the document itself, or from anything rendered inside the modal's portal. */
function comesFromModal(event: Event, portal: HTMLElement | null): boolean {
	const target = event.target;
	if (!(target instanceof Node) || target === document.body || target === document.documentElement) {
		return true;
	}
	return portal?.contains(target) ?? false;
}

/** The element focused when the modal opened, unless nothing was (focus on the document body). */
function focusedOpener(): HTMLElement | null {
	if (typeof document === "undefined") return null;
	const active = document.activeElement;
	return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Modal-dialog behavior for the work item: focus moves in on open and stays inside, Escape
 * and backdrop presses close it, and focus returns to the opener. Focus is trapped without
 * blocking the pointer, so surfaces that float above the modal (the Rovo chat, an attachment
 * preview) stay clickable, and pressing or typing Escape in them does not close the work item.
 * A modal that opened with nothing focused (mounted open) returns focus to `finalFocusFallback`.
 */
export function ModalRoot({ children, finalFocusFallback }: Readonly<{ children: ReactNode; finalFocusFallback?: RefObject<HTMLElement | null> }>) {
	const { meta } = useWorkItemModal();
	const portalRef = useRef<HTMLDivElement | null>(null);
	// Read before the popup mounts and moves focus inside.
	const [opener] = useState(focusedOpener);
	const finalFocus: ModalFinalFocus = useCallback(
		() => (opener?.isConnected ? true : finalFocusFallback?.current ?? true),
		[opener, finalFocusFallback],
	);

	return (
		<DialogPrimitive.Root
			open
			modal="trap-focus"
			onOpenChange={(open, details) => {
				if (open) return;
				if (!comesFromModal(details.event, portalRef.current)) {
					details.cancel();
					return;
				}
				meta.onClose();
			}}
		>
			<DialogPrimitive.Portal ref={portalRef}>
				<ModalFinalFocusContext value={finalFocus}>{children}</ModalFinalFocusContext>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
