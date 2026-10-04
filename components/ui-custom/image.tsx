/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

import type { GeneratedFile } from "ai";

import { cn } from "@/lib/utils";

export interface ImageProps extends GeneratedFile {
	className?: string;
	alt?: string;
}

export function Image({
	base64,
	uint8Array: _uint8Array,
	mediaType,
	className,
	alt = "",
	...props
}: Readonly<ImageProps>) {
	return (
		<img
			alt={alt}
			src={`data:${mediaType};base64,${base64}`}
			className={cn("h-auto max-w-full overflow-hidden rounded-md", className)}
			{...props}
		/>
	);
}
