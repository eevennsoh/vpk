"use client";

import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface MenuItemButtonProps {
	elemBefore?: React.ReactNode;
	elemAfter?: React.ReactNode;
	description?: string;
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
}

export function MenuItemButton({
	className,
	elemBefore,
	elemAfter,
	description,
	children,
	...props
}: Readonly<MenuItemButtonProps> & Omit<React.ComponentProps<"button">, keyof MenuItemButtonProps>) {
	return (
		<button
			type="button"
			className={cn(
				"flex w-full cursor-default items-center gap-3 rounded-md px-4 py-2 text-sm text-left outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{elemBefore ? (
				<span aria-hidden className="flex shrink-0 items-center justify-center text-icon-subtle">{elemBefore}</span>
			) : null}
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate">{children}</span>
				{description ? <span className="text-text-subtle text-xs">{description}</span> : null}
			</span>
			{elemAfter ? <span className="ml-auto flex items-center">{elemAfter}</span> : null}
		</button>
	);
}

interface CircleIconProps {
	isSelected?: boolean;
	children: React.ReactNode;
}

export function CircleIcon({ isSelected = false, children }: Readonly<CircleIconProps>) {
	return (
		<div
			style={{
				width: "32px",
				height: "32px",
				borderRadius: token("radius.full"),
				backgroundColor: isSelected ? token("color.icon") : token("color.background.accent.gray.subtler"),
				color: isSelected ? token("color.text.inverse") : undefined,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{children}
		</div>
	);
}
