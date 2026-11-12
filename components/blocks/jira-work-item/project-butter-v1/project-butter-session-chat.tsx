"use client";

import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function ProjectButterSessionChat({ children, onClose, open, title = "Agent session chat" }: Readonly<{
	children: ReactNode;
	onClose: () => void;
	open: boolean;
	title?: string;
}>) {
	return (
		<Dialog disablePointerDismissal modal={false} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }} open={open}>
			<DialogContent className="bottom-4 left-auto right-4 top-auto flex max-h-[calc(100dvh-2rem)] w-[440px] max-w-[calc(100vw-2rem)] translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto p-0 sm:max-w-[440px]" overlayProps={{ className: "hidden" }} showCloseButton={false}>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">Continue the agent session while working on this item.</DialogDescription>
				{children}
			</DialogContent>
		</Dialog>
	);
}
