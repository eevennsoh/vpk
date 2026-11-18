import type {
	CSSProperties,
	ComponentProps,
	ComponentType,
	ReactNode,
} from "react";

import AddIconGlyph from "@atlaskit/icon/core/add";
import ArchiveBoxIconGlyph from "@atlaskit/icon/core/archive-box";
import ArrowDownIconGlyph from "@atlaskit/icon/core/arrow-down";
import ArrowLeftIconGlyph from "@atlaskit/icon/core/arrow-left";
import ArrowRightIconGlyph from "@atlaskit/icon/core/arrow-right";
import ArrowUpIconGlyph from "@atlaskit/icon/core/arrow-up";
import AttachmentIconGlyph from "@atlaskit/icon/core/attachment";
import AiSparkleIconGlyph from "@atlaskit/icon/core/ai-sparkle";
import AlignTextCenterIconGlyph from "@atlaskit/icon/core/align-text-center";
import AlignTextLeftIconGlyph from "@atlaskit/icon/core/align-text-left";
import AlignTextRightIconGlyph from "@atlaskit/icon/core/align-text-right";
import BookWithBookmarkIconGlyph from "@atlaskit/icon/core/book-with-bookmark";
import BranchIconGlyph from "@atlaskit/icon/core/branch";
import CheckMarkIconGlyph from "@atlaskit/icon/core/check-mark";
import CheckCircleIconGlyph from "@atlaskit/icon/core/check-circle";
import ClipboardIconGlyph from "@atlaskit/icon/core/clipboard";
import ChevronDoubleLeftIconGlyph from "@atlaskit/icon/core/chevron-double-left";
import ChevronDoubleRightIconGlyph from "@atlaskit/icon/core/chevron-double-right";
import ChevronDownIconGlyph from "@atlaskit/icon/core/chevron-down";
import ChevronLeftIconGlyph from "@atlaskit/icon/core/chevron-left";
import ChevronRightIconGlyph from "@atlaskit/icon/core/chevron-right";
import ChevronUpIconGlyph from "@atlaskit/icon/core/chevron-up";
import CommentAddIconGlyph from "@atlaskit/icon/core/comment-add";
import CommentIconGlyph from "@atlaskit/icon/core/comment";
import CommitIconGlyph from "@atlaskit/icon/core/commit";
import CopyIconGlyph from "@atlaskit/icon/core/copy";
import CrossIconGlyph from "@atlaskit/icon/core/cross";
import CrossCircleIconGlyph from "@atlaskit/icon/core/cross-circle";
import DeleteIconGlyph from "@atlaskit/icon/core/delete";
import DownloadIconGlyph from "@atlaskit/icon/core/download";
import DragHandleVerticalIconGlyph from "@atlaskit/icon/core/drag-handle-vertical";
import EditIconGlyph from "@atlaskit/icon/core/edit";
import EyeOpenIconGlyph from "@atlaskit/icon/core/eye-open";
import EyeOpenStrikethroughIconGlyph from "@atlaskit/icon/core/eye-open-strikethrough";
import FileIconGlyph from "@atlaskit/icon/core/file";
import FolderClosedIconGlyph from "@atlaskit/icon/core/folder-closed";
import FolderOpenIconGlyph from "@atlaskit/icon/core/folder-open";
import GlobeIconGlyph from "@atlaskit/icon/core/globe";
import HeartIconGlyph from "@atlaskit/icon/core/heart";
import HomeIconGlyph from "@atlaskit/icon/core/home";
import ImageIconGlyph from "@atlaskit/icon/core/image";
import InformationCircleIconGlyph from "@atlaskit/icon/core/information-circle";
import LinkExternalIconGlyph from "@atlaskit/icon/core/link-external";
import LinkIconGlyph from "@atlaskit/icon/core/link";
import LockLockedIconGlyph from "@atlaskit/icon/core/lock-locked";
import LogOutIconGlyph from "@atlaskit/icon/core/log-out";
import MenuIconGlyph from "@atlaskit/icon/core/menu";
import MicrophoneIconGlyph from "@atlaskit/icon/core/microphone";
import MinusIconGlyph from "@atlaskit/icon/core/minus";
import NotificationIconGlyph from "@atlaskit/icon/core/notification";
import PersonIconGlyph from "@atlaskit/icon/core/person";
import PersonRemoveIconGlyph from "@atlaskit/icon/core/person-remove";
import PeopleGroupIconGlyph from "@atlaskit/icon/core/people-group";
import PanelLeftIconGlyph from "@atlaskit/icon/core/panel-left";
import PhoneIconGlyph from "@atlaskit/icon/core/phone";
import PinIconGlyph from "@atlaskit/icon/core/pin";
import PinFilledIconGlyph from "@atlaskit/icon/core/pin-filled";
import ProjectionScreenIconGlyph from "@atlaskit/icon/core/projection-screen";
import RadioCheckedIconGlyph from "@atlaskit/icon/core/radio-checked";
import RadioUncheckedIconGlyph from "@atlaskit/icon/core/radio-unchecked";
import RefreshIconGlyph from "@atlaskit/icon/core/refresh";
import ScreenIconGlyph from "@atlaskit/icon/core/screen";
import SearchIconGlyph from "@atlaskit/icon/core/search";
import SettingsIconGlyph from "@atlaskit/icon/core/settings";
import ShareIconGlyph from "@atlaskit/icon/core/share";
import ShowMoreHorizontalIconGlyph from "@atlaskit/icon/core/show-more-horizontal";
import ShowMoreVerticalIconGlyph from "@atlaskit/icon/core/show-more-vertical";
import StarStarredIconGlyph from "@atlaskit/icon/core/star-starred";
import AudioIconGlyph from "@atlaskit/icon/core/audio";
import AngleBracketsIconGlyph from "@atlaskit/icon/core/angle-brackets";
import ArrowUpRightIconGlyph from "@atlaskit/icon/core/arrow-up-right";
import CalendarIconGlyph from "@atlaskit/icon/core/calendar";
import CameraIconGlyph from "@atlaskit/icon/core/camera";
import ChartBarIconGlyph from "@atlaskit/icon/core/chart-bar";
import ChartPieIconGlyph from "@atlaskit/icon/core/chart-pie";
import ChartTrendDownIconGlyph from "@atlaskit/icon/core/chart-trend-down";
import ChartTrendUpIconGlyph from "@atlaskit/icon/core/chart-trend-up";
import ClockIconGlyph from "@atlaskit/icon/core/clock";
import DashboardIconGlyph from "@atlaskit/icon/core/dashboard";
import DatabaseIconGlyph from "@atlaskit/icon/core/database";
import CreditCardIconGlyph from "@atlaskit/icon/core/credit-card";
import EmailIconGlyph from "@atlaskit/icon/core/email";
import FlagIconGlyph from "@atlaskit/icon/core/flag";
import InboxIconGlyph from "@atlaskit/icon/core/inbox";
import LayoutThreeColumnsIconGlyph from "@atlaskit/icon/core/layout-three-columns";
import LightbulbIconGlyph from "@atlaskit/icon/core/lightbulb";
import ListBulletedIconGlyph from "@atlaskit/icon/core/list-bulleted";
import MaximizeIconGlyph from "@atlaskit/icon/core/maximize";
import MinimizeIconGlyph from "@atlaskit/icon/core/minimize";
import SendIconGlyph from "@atlaskit/icon/core/send";
import TableIconGlyph from "@atlaskit/icon/core/table";
import TargetIconGlyph from "@atlaskit/icon/core/target";
import TaskToDoIconGlyph from "@atlaskit/icon/core/task-to-do";
import ListChecklistIconGlyph from "@atlaskit/icon/core/list-checklist";
import TreeIconGlyph from "@atlaskit/icon/core/tree";
import TextBoldIconGlyph from "@atlaskit/icon/core/text-bold";
import TextItalicIconGlyph from "@atlaskit/icon/core/text-italic";
import TextUnderlineIconGlyph from "@atlaskit/icon/core/text-underline";
import ThumbsDownIconGlyph from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIconGlyph from "@atlaskit/icon/core/thumbs-up";
import VolumeMutedIconGlyph from "@atlaskit/icon/core/volume-muted";
import VideoIconGlyph from "@atlaskit/icon/core/video";
import VideoPauseIconGlyph from "@atlaskit/icon/core/video-pause";
import VideoPlayIconGlyph from "@atlaskit/icon/core/video-play";
import VideoStopIconGlyph from "@atlaskit/icon/core/video-stop";
import WarningIconGlyph from "@atlaskit/icon/core/warning";
import ZoomInIconGlyph from "@atlaskit/icon/core/zoom-in";
import ZoomOutIconGlyph from "@atlaskit/icon/core/zoom-out";
import DiagramSymbolPackageIconGlyph from "@atlaskit/icon-lab/core/diagram-symbol-package";
import AiBotIconGlyph from "@atlaskit/icon-lab/core/ai-bot";
import ArrowCurvedDownLeftIconGlyph from "@atlaskit/icon-lab/core/arrow-curved-down-left";
import ArrowCurvedDownRightIconGlyph from "@atlaskit/icon-lab/core/arrow-curved-down-right";
import BluetoothIconGlyph from "@atlaskit/icon-lab/core/bluetooth";
import HistoryIconGlyph from "@atlaskit/icon-lab/core/history";
import MicrophoneStrikethroughIconGlyph from "@atlaskit/icon-lab/core/microphone-strikethrough";
import PaintBrushIconGlyph from "@atlaskit/icon-lab/core/paint-brush";
import PlusCircleIconGlyph from "@atlaskit/icon-lab/core/plus-circle";
import SaveIconGlyph from "@atlaskit/icon-lab/core/save";
import TerminalIconGlyph from "@atlaskit/icon-lab/core/terminal";
import TextNormalIconGlyph from "@atlaskit/icon-lab/core/text-normal";
import AudioWaveformIconGlyph from "@atlaskit/icon-lab/core/audio-waveform";
import ArrowStartIconGlyph from "@atlaskit/icon-lab/core/arrow-start";
import QrCodeIconGlyph from "@atlaskit/icon-lab/core/qr-code";
import ReturnIconGlyph from "@atlaskit/icon-lab/core/return";
import VideoClosedCaptionsFilledIconGlyph from "@atlaskit/icon-lab/core/video-closed-captions-filled";
import ViewTypeCardHomeIconGlyph from "@atlaskit/icon-lab/core/view-type-card-home";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type AtlaskitIconSize = "small" | "medium";
type AtlaskitRenderIcon = ComponentType<{
	color?: string;
	label: string;
	size?: AtlaskitIconSize;
	spacing?: "none" | "default";
}>;

export interface VpkIconProps
	extends Omit<ComponentProps<"span">, "children"> {
	color?: string;
	children?: ReactNode;
	label?: string;
	size?: AtlaskitIconSize | number;
}

export type VpkIconRenderer = (props: VpkIconProps) => React.JSX.Element;
export type VpkIconComponent = ComponentType<{
  children?: ReactNode;
  className?: string;
  color?: string;
  size?: number | AtlaskitIconSize;
  style?: CSSProperties;
}>;

function mapNumericSizeToAtlaskit(size: number): AtlaskitIconSize {
	if (size <= 14) {
		return "small";
	}
	return "medium";
}

function extractTailwindSize(className: string | undefined): number | null {
	if (!className) {
		return null;
	}

	const match = className.match(/\b(?:size|h|w)-(\d+(?:\.\d+)?)\b/);
	if (!match?.[1]) {
		return null;
	}

	const parsed = Number.parseFloat(match[1]);
	return Number.isFinite(parsed) ? parsed * 4 : null;
}

function resolveAtlaskitSize(
	size: VpkIconProps["size"],
	className: string | undefined,
): AtlaskitIconSize {
	if (typeof size === "string") {
		return size;
	}

	if (typeof size === "number") {
		return mapNumericSizeToAtlaskit(size);
	}

	const classNameSize = extractTailwindSize(className);
	if (classNameSize !== null) {
		return mapNumericSizeToAtlaskit(classNameSize);
	}

	return "medium";
}

function VpkIconFromGlyph({
	renderIcon: RenderIcon,
		className,
		color,
		label,
		size,
		...props
	}: Readonly<VpkIconProps & { renderIcon: AtlaskitRenderIcon }>) {
	return (
			<Icon
				className={cn("shrink-0", className)}
				label={label}
				style={color ? { color } : undefined}
				render={
					<RenderIcon
						label={label ?? ""}
						size={resolveAtlaskitSize(size, className)}
						spacing="none"
					/>
				}
				{...props}
			/>
		);
	}

export function MessageCircleIcon(props: Readonly<VpkIconProps>) {
	return <VpkIconFromGlyph renderIcon={CommentIconGlyph as AtlaskitRenderIcon} {...props} />;
}
export function CheckIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CheckMarkIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CopyIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CopyIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function EyeIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={EyeOpenIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function EyeOffIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={EyeOpenStrikethroughIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ChevronLeftIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChevronLeftIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ChevronRightIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChevronRightIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ChevronDownIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChevronDownIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ChevronUpIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChevronUpIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ChevronsLeftIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChevronDoubleLeftIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ChevronsRightIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChevronDoubleRightIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function DownloadIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={DownloadIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ExternalLinkIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={LinkExternalIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArchiveIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArchiveBoxIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArrowDownIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowDownIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArrowLeftIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowLeftIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArrowRightIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowRightIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArrowUpIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowUpIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArrowLeft(props: Readonly<VpkIconProps>) { return <ArrowLeftIcon {...props} />; }
export function ArrowRight(props: Readonly<VpkIconProps>) { return <ArrowRightIcon {...props} />; }
export function ArrowDown(props: Readonly<VpkIconProps>) { return <ArrowDownIcon {...props} />; }
export function ArrowUp(props: Readonly<VpkIconProps>) { return <ArrowUpIcon {...props} />; }
export function ArrowUpRightIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowUpRightIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArrowUpRight(props: Readonly<VpkIconProps>) { return <ArrowUpRightIcon {...props} />; }
export function ArrowLeftCircleIcon(props: Readonly<VpkIconProps>) { return <ArrowLeftIcon {...props} />; }
export function PaperclipIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AttachmentIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function SearchIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={SearchIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BookmarkIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={BookWithBookmarkIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BookIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={BookWithBookmarkIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function TextNormalIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TextNormalIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BoldIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TextBoldIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ItalicIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TextItalicIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function UnderlineIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TextUnderlineIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PackageIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={DiagramSymbolPackageIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function TerminalIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TerminalIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CircleAlertIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={InformationCircleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function TriangleAlertIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={WarningIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function SparklesIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AiSparkleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MicIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={MicrophoneIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MicOffIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={MicrophoneStrikethroughIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PauseIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={VideoPauseIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PlayIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={VideoPlayIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function SettingsIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={SettingsIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function SquareIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={VideoStopIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function XIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CrossIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MinusIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={MinusIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PlusIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AddIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Plus(props: Readonly<VpkIconProps>) { return <PlusIcon {...props} />; }
export function PinIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PinIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Pin(props: Readonly<VpkIconProps>) { return <PinIcon {...props} />; }
export function PinFilledIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PinFilledIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PinFilled(props: Readonly<VpkIconProps>) { return <PinFilledIcon {...props} />; }
export function Trash2Icon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={DeleteIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function TrashIcon(props: Readonly<VpkIconProps>) { return <Trash2Icon {...props} />; }
export function DeleteIcon(props: Readonly<VpkIconProps>) { return <Trash2Icon {...props} />; }
export function Trash(props: Readonly<VpkIconProps>) { return <TrashIcon {...props} />; }
export function MessageSquarePlusIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CommentAddIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PencilLineIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={EditIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PencilIcon(props: Readonly<VpkIconProps>) { return <PencilLineIcon {...props} />; }
export function SaveIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={SaveIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LoaderCircleIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={RefreshIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LoaderIcon(props: Readonly<VpkIconProps>) { return <LoaderCircleIcon {...props} />; }
export function RefreshCwIcon(props: Readonly<VpkIconProps>) { return <LoaderCircleIcon {...props} />; }
export function Loader2Icon(props: Readonly<VpkIconProps>) { return <LoaderCircleIcon {...props} />; }
export function CornerDownLeftIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowCurvedDownLeftIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CornerDownRightIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowCurvedDownRightIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function AlertTriangleIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={WarningIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function AudioWaveformIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AudioWaveformIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function AudioLinesIcon(props: Readonly<VpkIconProps>) { return <AudioWaveformIcon {...props} />; }
export function BarChart3Icon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChartBarIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BarChartIcon(props: Readonly<VpkIconProps>) { return <BarChart3Icon {...props} />; }
export function CalendarIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CalendarIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BellIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={NotificationIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BluetoothIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={BluetoothIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CreditCardIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CreditCardIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CameraIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CameraIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function DatabaseIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={DatabaseIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function DollarSignIcon(props: Readonly<VpkIconProps>) { return <CreditCardIcon {...props} />; }
export function EmailIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={EmailIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MailIcon(props: Readonly<VpkIconProps>) { return <EmailIcon {...props} />; }
export function InboxIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={InboxIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FileIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={FileIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FileTextIcon(props: Readonly<VpkIconProps>) { return <FileIcon {...props} />; }
export function FilePenIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={EditIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FileChartColumnIcon(props: Readonly<VpkIconProps>) { return <BarChart3Icon {...props} />; }
export function FileCodeIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AngleBracketsIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FileJsonIcon(props: Readonly<VpkIconProps>) { return <FileIcon {...props} />; }
export function FolderIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={FolderClosedIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FolderOpenIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={FolderOpenIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FolderPlusIcon(props: Readonly<VpkIconProps>) { return <FolderOpenIcon {...props} />; }
export function FolderSearchIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={FolderOpenIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function GripVerticalIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={DragHandleVerticalIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function GitCommitIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CommitIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function GitCommitVertical(props: Readonly<VpkIconProps>) { return <GitCommitIcon {...props} />; }
export function GitBranchIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={BranchIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function GlobeIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={GlobeIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function HomeIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={HomeIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LayoutDashboardIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={DashboardIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ArrowUpCircleIcon(props: Readonly<VpkIconProps>) { return <ArrowUpIcon {...props} />; }
export function ImageIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ImageIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MonitorIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ScreenIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function AppWindowIcon(props: Readonly<VpkIconProps>) { return <MonitorIcon {...props} />; }
export function KeyboardIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ProjectionScreenIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Music2Icon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AudioIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function AudioWaveform(props: Readonly<VpkIconProps>) { return <AudioWaveformIcon {...props} />; }
export function BotIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AiBotIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CodeIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AngleBracketsIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Columns3Icon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={LayoutThreeColumnsIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ClockIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ClockIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Clock2Icon(props: Readonly<VpkIconProps>) { return <ClockIcon {...props} />; }
export function PersonIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PersonIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CircleUserRoundIcon(props: Readonly<VpkIconProps>) { return <PersonIcon {...props} />; }
export function PhoneIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PhoneIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function VideoIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={VideoIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Video(props: Readonly<VpkIconProps>) { return <VideoIcon {...props} />; }
export function CaptionsIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={VideoClosedCaptionsFilledIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function TrendingDownIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChartTrendDownIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function TrendingUpIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChartTrendUpIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ChartBarIcon(props: Readonly<VpkIconProps>) { return <BarChart3Icon {...props} />; }
export function ChartLineIcon(props: Readonly<VpkIconProps>) { return <TrendingUpIcon {...props} />; }
export function ChartPieIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ChartPieIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ThumbsDownIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ThumbsDownIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ThumbsUpIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ThumbsUpIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function TargetIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TargetIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CheckCircle2Icon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CheckCircleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CheckCircleIcon(props: Readonly<VpkIconProps>) { return <CheckCircle2Icon {...props} />; }
export function CircleCheckIcon(props: Readonly<VpkIconProps>) { return <CheckCircle2Icon {...props} />; }
export function CircleDotIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={RadioCheckedIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CircleIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={RadioUncheckedIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CircleDashedIcon(props: Readonly<VpkIconProps>) { return <CircleIcon {...props} />; }
export function UserCircleIcon(props: Readonly<VpkIconProps>) { return <PersonIcon {...props} />; }
export function CirclePlusIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PlusCircleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function XCircleIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CrossCircleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MessageSquareIcon(props: Readonly<VpkIconProps>) { return <MessageCircleIcon {...props} />; }
export function MessageSquareDiffIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={CommentAddIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ListTodoIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TaskToDoIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ListChecksIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ListChecklistIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ListIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ListBulletedIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ClipboardListIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ClipboardIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function UsersIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PeopleGroupIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FootprintsIcon(props: Readonly<VpkIconProps>) { return <ListTodoIcon {...props} />; }
export function WavesIcon(props: Readonly<VpkIconProps>) { return <AudioWaveformIcon {...props} />; }
export function MenuIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={MenuIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LinkIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={LinkIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LightbulbIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={LightbulbIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BrainIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={LightbulbIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LockIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={LockLockedIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PaintbrushIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PaintBrushIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function PlusCircleIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PlusCircleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function GalleryVerticalEndIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ViewTypeCardHomeIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ShareIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ShareIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Share(props: Readonly<VpkIconProps>) { return <ShareIcon {...props} />; }
export function SendIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={SendIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function SidebarIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PanelLeftIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function BookOpenIcon(props: Readonly<VpkIconProps>) { return <BookIcon {...props} />; }
export function EllipsisVerticalIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ShowMoreHorizontalIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MoreHorizontalIcon(props: Readonly<VpkIconProps>) { return <EllipsisVerticalIcon {...props} />; }
export function MoreVerticalIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ShowMoreVerticalIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CommandIcon(props: Readonly<VpkIconProps>) { return <TerminalIcon {...props} />; }
export function Command(props: Readonly<VpkIconProps>) { return <TerminalIcon {...props} />; }
export function MousePointerIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={QrCodeIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MousePointerClickIcon(props: Readonly<VpkIconProps>) { return <MousePointerIcon {...props} />; }
export function PenToolIcon(props: Readonly<VpkIconProps>) { return <PaintbrushIcon {...props} />; }
export function ShoppingBagIcon(props: Readonly<VpkIconProps>) { return <CreditCardIcon {...props} />; }
export function WandIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ArrowStartIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function HelpCircleIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={InformationCircleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CircleHelpIcon(props: Readonly<VpkIconProps>) { return <HelpCircleIcon {...props} />; }
export function InfoIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={InformationCircleIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function RadioIcon(props: Readonly<VpkIconProps>) { return <CircleDotIcon {...props} />; }
export function RotateCwIcon(props: Readonly<VpkIconProps>) { return <LoaderCircleIcon {...props} />; }
export function Disc3(props: Readonly<VpkIconProps>) { return <AudioWaveformIcon {...props} />; }
export function FlipHorizontalIcon(props: Readonly<VpkIconProps>) { return <ArrowRightIcon {...props} />; }
export function FlipVerticalIcon(props: Readonly<VpkIconProps>) { return <ArrowDownIcon {...props} />; }
export function ReturnIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ReturnIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function CalculatorIcon(props: Readonly<VpkIconProps>) { return <CreditCardIcon {...props} />; }
export function ClipboardPasteIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ClipboardIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LayoutGridIcon(props: Readonly<VpkIconProps>) { return <Columns3Icon {...props} />; }
export function ScissorsIcon(props: Readonly<VpkIconProps>) { return <DeleteIcon {...props} />; }
export function CornerUpLeft(props: Readonly<VpkIconProps>) { return <CornerDownLeftIcon {...props} />; }
export function CornerUpRight(props: Readonly<VpkIconProps>) { return <ArrowRightIcon {...props} />; }
export function AlignCenterIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AlignTextCenterIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function AlignLeftIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AlignTextLeftIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function AlignRightIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={AlignTextRightIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function LogOutIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={LogOutIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function HeartIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={HeartIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function StarIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={StarStarredIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function Star(props: Readonly<VpkIconProps>) { return <StarIcon {...props} />; }
export function StarOff(props: Readonly<VpkIconProps>) { return <StarIcon {...props} />; }
export function TableIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TableIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function UserIcon(props: Readonly<VpkIconProps>) { return <PersonIcon {...props} />; }
export function UserRoundXIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={PersonRemoveIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function VolumeXIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={VolumeMutedIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ZoomInIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ZoomInIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function ZoomOutIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={ZoomOutIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MaximizeIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={MaximizeIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function MinimizeIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={MinimizeIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function HistoryIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={HistoryIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function FlagIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={FlagIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function SheetIcon(props: Readonly<VpkIconProps>) { return <FileIcon {...props} />; }
export function ShieldAlertIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={WarningIconGlyph as AtlaskitRenderIcon} {...props} />; }
export function SmileIcon(props: Readonly<VpkIconProps>) { return <PersonIcon {...props} />; }
export function Settings2Icon(props: Readonly<VpkIconProps>) { return <SettingsIcon {...props} />; }
export function TreePineIcon(props: Readonly<VpkIconProps>) { return <VpkIconFromGlyph renderIcon={TreeIconGlyph as AtlaskitRenderIcon} {...props} />; }

export const ChevronsUpDownIcon: VpkIconRenderer = ({
	className,
	color,
	label,
	size,
	...props
}: Readonly<VpkIconProps>) => {
	const resolvedSize = resolveAtlaskitSize(size, className);
	return (
		<Icon
			className={cn("shrink-0", className)}
			label={label}
			style={color ? { color } : undefined}
			render={
				<span className="flex flex-col items-center leading-none">
					<ChevronUpIconGlyph
						label=""
						size={resolvedSize}
						spacing="none"
					/>
					<ChevronDownIconGlyph
						label=""
						size={resolvedSize}
						spacing="none"
					/>
				</span>
			}
			{...props}
		/>
	);
};

export function ChevronsUpDown(props: Readonly<VpkIconProps>) { return <ChevronsUpDownIcon {...props} />; }
