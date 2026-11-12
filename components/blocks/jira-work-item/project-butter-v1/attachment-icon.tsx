import FileIcon from "@atlaskit/icon/core/file";
import ImageIcon from "@atlaskit/icon/core/image";
import VideoIcon from "@atlaskit/icon/core/video";
import LinkIcon from "@atlaskit/icon/core/link";
import PageIcon from "@atlaskit/icon/core/page";
import LoomIcon from "@atlaskit/icon-lab/core/loom";
import { GoogleDriveLogo } from "@/components/ui/logo-third-party";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-data";

export function ProjectButterAttachmentIcon({ kind }: Readonly<Pick<ProjectButterAttachment, "kind">>) {
	if (kind === "confluence") return <span className="text-icon-information"><PageIcon color="currentColor" label="" size="small" /></span>;
	if (kind === "google-drive") return <GoogleDriveLogo aria-hidden borderless size="xxsmall" />;
	if (kind === "loom") return <span className="text-icon-accent-blue"><LoomIcon color="currentColor" label="" size="small" /></span>;
	const Icon = kind === "image" ? ImageIcon : kind === "video" ? VideoIcon : kind === "link" ? LinkIcon : FileIcon;
	return <Icon label="" size="small" />;
}
