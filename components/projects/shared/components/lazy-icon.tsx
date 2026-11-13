"use client";

import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import { lazy, Suspense, type ComponentType } from "react";

import { cn } from "@/lib/utils";

export type IconComponent = (props: NewCoreIconProps) => JSX.Element;

type IconModule = Readonly<{ default: ComponentType<NewCoreIconProps> }>;

/**
 * Holds the glyph's box (ADS icons are 16px, 12px at `size="small"`) while the icon module
 * loads, so an icon that arrives late never moves the content around it.
 */
function IconPlaceholder({ size }: Readonly<Pick<NewCoreIconProps, "size">>) {
	return <span aria-hidden className={cn("inline-block shrink-0", size === "small" ? "size-3" : "size-4")} />;
}

/** An icon component that downloads its module on first render. */
export function createLazyIcon(load: () => Promise<IconModule>): IconComponent {
	const LoadedIcon = lazy(load);

	function LazyIcon(props: NewCoreIconProps) {
		return (
			<Suspense fallback={<IconPlaceholder size={props.size} />}>
				<LoadedIcon {...props} />
			</Suspense>
		);
	}

	return LazyIcon;
}
