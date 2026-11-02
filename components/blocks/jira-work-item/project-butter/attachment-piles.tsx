"use client";

import { useId } from "react";
import { LayoutGroup, motion } from "motion/react";
import { ProjectButterAttachmentCard, type AttachmentCardActions } from "@/components/blocks/jira-work-item/project-butter/attachment-card";
import { ProjectButterAttachmentStack } from "@/components/blocks/jira-work-item/project-butter/attachment-stack";
import { groupProjectButterAttachments, type ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { motionDuration, motionEase } from "@/lib/motion";

export function ProjectButterAttachmentPiles({ items, onPreview, onRemove }: Readonly<AttachmentCardActions & { items: readonly ProjectButterAttachment[] }>) {
	const id = useId();
	const { piles, singles } = groupProjectButterAttachments(items);
	return (
		<LayoutGroup id={id}>
			<div className="@container/attachments">
				<motion.div aria-label="Attachments" className="grid grid-cols-2 items-start gap-6 pt-3 @[432px]/attachments:grid-cols-3 @[584px]/attachments:grid-cols-4 @[736px]/attachments:grid-cols-5 @[888px]/attachments:grid-cols-6 @[1040px]/attachments:grid-cols-7" data-attachment-piles layout role="group" transition={{ layout: { duration: motionDuration.slow, ease: motionEase.outPractical } }}>
					{piles.map((pile) => <ProjectButterAttachmentStack key={pile.type} onPreview={onPreview} onRemove={onRemove} pile={pile} />)}
					{singles.map((item) => <motion.div className="min-w-0" data-attachment-card={item.id} key={item.id} layout layoutId={item.id} transition={{ layout: { duration: motionDuration.slow, ease: motionEase.outPractical } }}><ProjectButterAttachmentCard item={item} onPreview={onPreview} onRemove={onRemove} /></motion.div>)}
				</motion.div>
			</div>
		</LayoutGroup>
	);
}
