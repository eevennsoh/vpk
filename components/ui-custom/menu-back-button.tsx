"use client";

import type { ComponentProps } from "react";

import { ArrowLeftIcon } from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";

export function MenuBackButton({ className, iconSize = "default", ...props }: Readonly<ComponentProps<"button"> & { iconSize?: "default" | "compact" }>) {
	return (
		<button
			className={cn("flex h-11 w-full shrink-0 items-center gap-3 border-0 bg-transparent py-0 pr-1.5 pl-3 text-left text-text-subtle hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", className)}
			type="button"
			{...props}
		>
			{iconSize === "compact" ? (
				<ArrowLeftIcon className="size-3 [&_svg]:size-3" />
			) : (
				<span className="inline-flex size-6 items-center justify-center">
					<ArrowLeftIcon className="size-4" />
				</span>
			)}
			<span className="menu-row-title">Back</span>
		</button>
	);
}
