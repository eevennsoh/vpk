import { type ReactElement } from "react";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import SkillIcon from "@atlaskit/icon-lab/core/skill";
import AssetsIcon from "@atlaskit/icon/core/assets";
import BoardIcon from "@atlaskit/icon/core/board";
import BookWithBookmarkIcon from "@atlaskit/icon/core/book-with-bookmark";
import BranchIcon from "@atlaskit/icon/core/branch";
import BriefcaseIcon from "@atlaskit/icon/core/briefcase";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import ChartBarIcon from "@atlaskit/icon/core/chart-bar";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import CommentIcon from "@atlaskit/icon/core/comment";
import CurlyBracketsIcon from "@atlaskit/icon/core/curly-brackets";
import DatabaseIcon from "@atlaskit/icon/core/database";
import DeviceMobileIcon from "@atlaskit/icon/core/device-mobile";
import EditIcon from "@atlaskit/icon/core/edit";
import FilesIcon from "@atlaskit/icon/core/files";
import FocusAreaIcon from "@atlaskit/icon/core/focus-area";
import FolderClosedIcon from "@atlaskit/icon/core/folder-closed";
import GoalIcon from "@atlaskit/icon/core/goal";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import LinkIcon from "@atlaskit/icon/core/link";
import MegaphoneIcon from "@atlaskit/icon/core/megaphone";
import PageIcon from "@atlaskit/icon/core/page";
import PaintPaletteIcon from "@atlaskit/icon/core/paint-palette";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import ProjectIcon from "@atlaskit/icon/core/project";
import RoadmapIcon from "@atlaskit/icon/core/roadmap";
import SearchIcon from "@atlaskit/icon/core/search";
import TableIcon from "@atlaskit/icon/core/table";
import TeamsIcon from "@atlaskit/icon/core/teams";
import VideoIcon from "@atlaskit/icon/core/video";
import WhiteboardIcon from "@atlaskit/icon/core/whiteboard";
import WorkItemIcon from "@atlaskit/icon/core/work-item";

import type { RichTextMentionVisual } from "@/components/ui-custom/rich-text-editor";
import type { AtlassianLogoName } from "@/components/ui/logo";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

import type { DirectoryIconKey, DirectoryVisual, SkillIconKey } from "./types";

/**
 * Shared visual resolver for directory items whose mark comes from a brand logo
 * or an avatar/image path (agents and tools). A `logoName` renders the ADS brand
 * logo; avatars under `/avatar-agent-new/` are hexagon agent avatars; avatars under
 * `/avatar-project/` are square project avatars; any other path is a square
 * image. Returns `undefined` when the item has neither. Single source so agent
 * and tool tokens never diverge in shape.
 */
export function avatarVisualFromSrc(
	logoName: AtlassianLogoName | undefined,
	avatarSrc: string | undefined,
	brandName?: ThirdPartyLogoName,
): DirectoryVisual | undefined {
	if (brandName) {
		return { kind: "third-party", name: brandName };
	}

	if (logoName) {
		return { kind: "logo", logoName };
	}

	if (!avatarSrc) {
		return undefined;
	}

	const isAgentAvatar = (avatarSrc.startsWith("/avatar-agent/") || avatarSrc.startsWith("/avatar-agent-new/"));
	const isProjectAvatar = avatarSrc.startsWith("/avatar-project/");
	return {
		kind: isAgentAvatar || isProjectAvatar ? "avatar" : "image",
		shape: isAgentAvatar ? "hexagon" : "square",
		src: avatarSrc,
	};
}

/**
 * Resolves a directory icon key to a raw Atlaskit icon element (color inherits
 * from the parent). This is the single icon resolver for directory data — the
 * rich-text editor's `mention-visual` and every directory surface route through
 * it so an `iconKey` always maps to the same element.
 */
export function getDirectoryIcon(icon: DirectoryIconKey = "page"): ReactElement {
	switch (icon) {
		case "assets":
			return <AssetsIcon label="" color="currentColor" />;
		case "board":
			return <BoardIcon label="" color="currentColor" />;
		case "book-with-bookmark":
			return <BookWithBookmarkIcon label="" color="currentColor" />;
		case "briefcase":
			return <BriefcaseIcon label="" color="currentColor" />;
		case "chart-bar":
			return <ChartBarIcon label="" color="currentColor" />;
		case "comment":
			return <CommentIcon label="" color="currentColor" />;
		case "curly-brackets":
			return <CurlyBracketsIcon label="" color="currentColor" />;
		case "database":
			return <DatabaseIcon label="" color="currentColor" />;
		case "device-mobile":
			return <DeviceMobileIcon label="" color="currentColor" />;
		case "video":
			return <VideoIcon label="" color="currentColor" />;
		case "edit":
			return <EditIcon label="" color="currentColor" />;
		case "files":
			return <FilesIcon label="" color="currentColor" />;
		case "focus-area":
			return <FocusAreaIcon label="" color="currentColor" />;
		case "folder-closed":
			return <FolderClosedIcon label="" color="currentColor" />;
		case "goal":
			return <GoalIcon label="" color="currentColor" />;
		case "lightbulb":
			return <LightbulbIcon label="" color="currentColor" />;
		case "chart-trend-up":
			return <ChartTrendUpIcon label="" color="currentColor" />;
		case "branch":
			return <BranchIcon label="" color="currentColor" />;
		case "angle-brackets":
			return <AngleBracketsIcon label="" color="currentColor" />;
		case "link":
			return <LinkIcon label="" color="currentColor" />;
		case "calendar":
			return <CalendarIcon label="" color="currentColor" />;
		case "megaphone":
			return <MegaphoneIcon label="" color="currentColor" />;
		case "paint-palette":
			return <PaintPaletteIcon label="" color="currentColor" />;
		case "people-group":
			return <PeopleGroupIcon label="" color="currentColor" />;
		case "project":
			return <ProjectIcon label="" color="currentColor" />;
		case "roadmap":
			return <RoadmapIcon label="" color="currentColor" />;
		case "search":
			return <SearchIcon label="" color="currentColor" />;
		case "table":
			return <TableIcon label="" color="currentColor" />;
		case "teams":
			return <TeamsIcon label="" color="currentColor" />;
		case "whiteboard":
			return <WhiteboardIcon label="" color="currentColor" />;
		case "work-item":
			return <WorkItemIcon label="" color="currentColor" />;
		case "skill":
			return <SkillIcon label="" color="currentColor" />;
		case "page":
		default:
			return <PageIcon label="" color="currentColor" />;
	}
}

/**
 * Backwards-compatible skill icon resolver. Skill surfaces keep the narrower
 * {@link SkillIconKey} type even though the shared directory resolver now knows
 * about knowledge content icons too.
 */
export function getSkillIcon(icon: SkillIconKey = "page"): ReactElement {
	return getDirectoryIcon(icon);
}

/**
 * Rehydrates a JSON-serializable {@link DirectoryVisual} into the rich-text
 * editor's runtime `RichTextMentionVisual` (resolving the `icon` kind's key
 * into a live element). `avatar`/`image`/`logo` pass through unchanged.
 */
export function resolveDirectoryVisual(
	visual: DirectoryVisual | undefined,
): RichTextMentionVisual | undefined {
	if (!visual) {
		return undefined;
	}

	if (visual.kind === "icon") {
		return {
			kind: "icon",
			icon: getDirectoryIcon(visual.iconKey),
			iconColor: visual.iconColor,
			iconKey: visual.iconKey,
		};
	}

	return visual;
}
