"use client";

import { useId } from "react";
import { motion } from "motion/react";
import FileIcon from "@atlaskit/icon/core/file";
import ImageIcon from "@atlaskit/icon/core/image";
import LinkIcon from "@atlaskit/icon/core/link";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectButterAttachmentFilter } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";

const FILTER_ICONS = { Documents: FileIcon, Images: ImageIcon, Videos: VideoPlayIcon, Links: LinkIcon } as const;

/**
 * List-view segmented filter (reference TabHeader "Filter attachments"). "All" is text; the type tabs are
 * icon-only, named by their label with a tooltip. The raised pill slides between tabs.
 */
export function AttachmentFilterTabs({ filters, onChange, value }: Readonly<{
	filters: readonly ProjectButterAttachmentFilter[];
	onChange: (filter: ProjectButterAttachmentFilter) => void;
	value: ProjectButterAttachmentFilter;
}>) {
	const pillId = useId();
	return (
		<Tabs onValueChange={(next) => onChange(next as ProjectButterAttachmentFilter)} value={value}>
			<TabsList aria-label="Filter attachments" className="bg-bg-neutral" size="compact">
				{filters.map((filter) => {
					const Icon = filter === "All" ? null : FILTER_ICONS[filter];
					const active = filter === value;
					const content = <>
						{active ? <motion.span aria-hidden className="absolute inset-0 rounded-md bg-surface-raised" layoutId={pillId} style={{ boxShadow: token("elevation.shadow.raised") }} transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }} /> : null}
						<span className="relative flex items-center">{Icon ? <Icon label="" size="small" /> : filter}</span>
					</>;
					const tabClass = "data-active:bg-transparent! data-active:shadow-none!";
					return Icon ? (
						<Tooltip key={filter}>
							<TooltipTrigger render={<TabsTrigger aria-label={filter} className={tabClass} value={filter} />}>{content}</TooltipTrigger>
							<TooltipContent positionerClassName="z-[650]" side="bottom">{filter}</TooltipContent>
						</Tooltip>
					) : <TabsTrigger className={tabClass} key={filter} value={filter}>{content}</TabsTrigger>;
				})}
			</TabsList>
		</Tabs>
	);
}
