"use client";

import { createFileTreeIconResolver } from "@pierre/trees";
import { useMemo, type HTMLAttributes } from "react";

import {
	fileExplorerIconColorStyles,
	getFileExplorerIconSpriteSheet,
	type FileExplorerIcons,
} from "@/components/ui-custom/file-explorer-file-icon-helpers";
import { cn } from "@/lib/utils";

export type { FileExplorerIcons };

interface FileExplorerIconSpriteProps {
	icons?: FileExplorerIcons;
}

export function FileExplorerIconSprite({ icons = "complete" }: Readonly<FileExplorerIconSpriteProps>) {
	return (
		<div
			aria-hidden="true"
			className="absolute size-0 overflow-hidden"
			dangerouslySetInnerHTML={{ __html: getFileExplorerIconSpriteSheet(icons) }}
		/>
	);
}

interface FileExplorerFileIconProps extends Omit<HTMLAttributes<SVGSVGElement>, "children"> {
	colored?: boolean;
	icons?: FileExplorerIcons;
	path: string;
}

export function FileExplorerFileIcon({
	className,
	colored,
	icons = "complete",
	path,
	...props
}: Readonly<FileExplorerFileIconProps>) {
	const iconResolver = useMemo(() => createFileTreeIconResolver(icons), [icons]);
	const coloredIcons = colored ?? (typeof icons === "object" ? (icons.colored ?? true) : true);
	const resolvedIcon = iconResolver.resolveIcon("file-tree-icon-file", path);
	const resolvedIconColor = resolvedIcon?.token && coloredIcons
		? fileExplorerIconColorStyles[resolvedIcon.token]
		: "text-icon-subtle";

	return (
		<svg
			aria-hidden="true"
			className={cn("size-4", resolvedIconColor, className)}
			data-icon-name={resolvedIcon?.name}
			data-icon-token={resolvedIcon?.token}
			viewBox={resolvedIcon?.viewBox ?? "0 0 16 16"}
			{...props}
		>
			<use href={`#${resolvedIcon?.name ?? "file-tree-icon-file"}`} />
		</svg>
	);
}
