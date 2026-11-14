"use client";

import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import type { ComponentType } from "react";

import { createLazyGlyph } from "@/components/ui/lazy-glyph";

export type IconComponent = (props: NewCoreIconProps) => JSX.Element;

type IconModule = Readonly<{ default: ComponentType<NewCoreIconProps> }>;

/**
 * An icon component that downloads its module on first render. Until it arrives, the glyph's box
 * (ADS icons are 16px, 12px at `size="small"`) is held empty.
 */
export function createLazyIcon(load: () => Promise<IconModule>): IconComponent {
	return createLazyGlyph<NewCoreIconProps>(
		() => load().then((module) => module.default),
		(props) => (props.size === "small" ? 12 : 16),
	) as unknown as IconComponent;
}
