"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { KeyboardIcon } from "@/components/ui/vpk-icons";
import type { PreviewKeyCapture } from "@/hooks/use-preview-key-capture";

type PreviewKeyCaptureToggleProps = Omit<ComponentProps<typeof Button>, "aria-pressed" | "id" | "onClick"> & {
	capture: PreviewKeyCapture;
};

/**
 * Toggle for the "capture keys" mode. Mouse presses keep focus where it is, so clicking it while
 * captured releases capture without blurring the viewport first, and clicking it to start capture
 * moves focus into the viewport.
 */
export function PreviewKeyCaptureToggle({
	capture,
	className,
	...props
}: Readonly<PreviewKeyCaptureToggleProps>) {
	return (
		<Button
			aria-pressed={capture.captured}
			className={className}
			id={capture.toggleId}
			onClick={capture.toggle}
			onMouseDown={(event) => event.preventDefault()}
			size="compact"
			type="button"
			variant="ghost"
			{...props}
		>
			<KeyboardIcon className="size-4" />
			Capture keys
		</Button>
	);
}

/**
 * Visible "captured" badge plus a polite live region. The live region stays mounted so screen
 * readers announce each change; the badge is decorative because the region already speaks it.
 */
export function PreviewKeyCaptureStatus({ capture }: Readonly<{ capture: PreviewKeyCapture }>) {
	return (
		<>
			<span className="sr-only" role="status">
				{capture.announcement}
			</span>
			{capture.captured ? (
				<span
					aria-hidden="true"
					className="bg-bg-neutral-bold text-text-inverse pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md px-2 py-1 text-xs font-medium shadow-md"
				>
					Keyboard captured · Esc to release
				</span>
			) : null}
		</>
	);
}
