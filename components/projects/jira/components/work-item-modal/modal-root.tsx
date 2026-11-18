"use client";

import { useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { useWorkItemModal } from "@/app/contexts/context-work-item-modal";

/** A press or key from the document itself, or from anything rendered inside the modal's portal. */
function comesFromModal(event: Event, portal: HTMLElement | null): boolean {
	const target = event.target;
	if (!(target instanceof Node) || target === document.body || target === document.documentElement) {
		return true;
	}
	return portal?.contains(target) ?? false;
}

/**
 * Modal-dialog behavior for the work item: focus moves in on open and stays inside, Escape
 * and backdrop presses close it, and focus returns to the opener. Focus is trapped without
 * blocking the pointer, so surfaces that float above the modal (the Rovo chat, an attachment
 * preview) stay clickable, and pressing or typing Escape in them does not close the work item.
 */
export function ModalRoot({ children }: Readonly<{ children: ReactNode }>) {
	const { meta } = useWorkItemModal();
	const portalRef = useRef<HTMLDivElement | null>(null);

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
			<DialogPrimitive.Portal ref={portalRef}>{children}</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
