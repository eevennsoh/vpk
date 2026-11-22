"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { token } from "@/lib/tokens";

/** The blanket behind the modal; a press on it closes the modal through `ModalRoot`. */
export function ModalBackdrop() {
	return (
		<DialogPrimitive.Backdrop
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: token("color.blanket"),
				zIndex: 500,
			}}
		/>
	);
}
