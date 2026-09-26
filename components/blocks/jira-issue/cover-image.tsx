import Image from "next/image";

import type { JiraIssueCoverImage } from "@/components/blocks/jira-issue/types";

export function JiraIssueCover({ image }: Readonly<{ image: JiraIssueCoverImage }>) {
	return (
		<div
			className="relative aspect-video w-full overflow-hidden rounded-sm"
			data-slot="jira-issue-cover"
			style={{ maxHeight: image.maxHeight }}
		>
			<Image
				alt={image.alt}
				className="object-contain"
				draggable={false}
				fill
				sizes="(max-width: 768px) 100vw, 50vw"
				src={image.src}
			/>
		</div>
	);
}
