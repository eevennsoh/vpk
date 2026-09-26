import Image from "next/image";

import type { JiraIssueCoverImage } from "@/components/blocks/jira-issue/types";
import { cn } from "@/lib/utils";

export function JiraIssueCover({ image }: Readonly<{ image: JiraIssueCoverImage }>) {
	return (
		<div
			className={cn("relative aspect-video w-full overflow-hidden rounded-t-lg", image.backgroundClassName)}
			aria-hidden={image.src ? undefined : true}
			data-slot="jira-issue-cover"
			style={{ maxHeight: image.maxHeight }}
		>
			{image.src ? <Image
				alt={image.alt}
				className="object-contain"
				draggable={false}
				fill
				sizes="(max-width: 768px) 100vw, 50vw"
				src={image.src}
			/> : null}
		</div>
	);
}
