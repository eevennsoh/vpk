"use client";

/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

import type { ComponentType } from "react";

import { AttachmentMedia, type AttachmentMediaProps } from "@/components/ui/attachment";
import {
	FileTextIcon,
	GlobeIcon,
	ImageIcon,
	Music2Icon,
	PaperclipIcon,
	VideoIcon,
	type VpkIconProps,
} from "@/components/ui/vpk-icons";
import { getMediaCategory, type AttachmentData, type AttachmentMediaCategory } from "@/lib/attachment-media";
import { cn } from "@/lib/utils";

const MEDIA_CATEGORY_ICONS: Record<AttachmentMediaCategory, ComponentType<Readonly<VpkIconProps>>> = {
	audio: Music2Icon,
	document: FileTextIcon,
	image: ImageIcon,
	source: GlobeIcon,
	unknown: PaperclipIcon,
	video: VideoIcon,
};

interface AttachmentPartMediaProps extends Omit<AttachmentMediaProps, "children" | "variant"> {
	data: AttachmentData;
	iconClassName?: string;
}

/** `AttachmentMedia` filled from an AI SDK file or source-document part: image, video, or a category icon. */
export function AttachmentPartMedia({ data, iconClassName, ...props }: Readonly<AttachmentPartMediaProps>) {
	const category = getMediaCategory(data);
	const url = data.type === "file" ? data.url : undefined;

	if (category === "image" && url) {
		return (
			<AttachmentMedia variant="image" {...props}>
				<img alt={data.type === "file" && data.filename ? data.filename : "Image"} src={url} />
			</AttachmentMedia>
		);
	}

	if (category === "video" && url) {
		return (
			<AttachmentMedia variant="image" {...props}>
				<video
					aria-label={data.type === "file" && data.filename ? data.filename : "Video attachment"}
					className="size-full object-cover"
					muted
					src={url}
				/>
			</AttachmentMedia>
		);
	}

	const Icon = MEDIA_CATEGORY_ICONS[category];
	return (
		<AttachmentMedia variant="icon" {...props}>
			<Icon className={cn("text-icon-subtle", iconClassName)} label="" />
		</AttachmentMedia>
	);
}
