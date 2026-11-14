"use client";

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import type { UIMessage } from "ai";
import type {
	ComponentProps,
	HTMLAttributes,
	ReactElement,
} from "react";

import { Button } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupText,
} from "@/components/ui/button-group";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import CopyIcon from "@atlaskit/icon/core/copy";
import EditIcon from "@atlaskit/icon/core/edit";
import RetryIcon from "@atlaskit/icon/core/retry";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@/components/ui/vpk-icons";
import {
	createContext,
	useCallback,
	use,
	useEffect,
	useMemo,
	useState,
} from "react";

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
	animate?: boolean;
	fitContent?: boolean;
	from: UIMessage["role"];
	/**
	 * Apply `content-visibility: auto` to cull off-screen messages. @default true
	 *
	 * Set to `false` for messages that host dynamically-growing contained
	 * content (e.g. an AnswerCard that expands as answers stream in). The
	 * containment box clips overflow at the `contain-intrinsic-size` estimate,
	 * so live-growing content gets cut off mid-render.
	 */
	contain?: boolean;
}

export function Message({
	animate,
	className,
	contain = true,
	fitContent,
	from,
	...props
}: Readonly<MessageProps>) {
	return (
		<div
			className={cn(
				// cv-auto: skip layout/paint for off-screen messages in long
				// transcripts. `contain-intrinsic-size: auto 400px` makes each
				// message remember its real height once rendered, so scroll
				// anchoring stays stable. Applied here so every chat surface
				// (chatbot, cursor, rovo, studio) benefits from one place.
				// Opt out (`contain={false}`) when the message hosts content
				// that grows after mount, since containment clips overflow.
				"group group/message flex flex-col gap-2",
				contain && "cv-auto",
				from === "user"
					? cn(
							"is-user ml-auto w-fit items-end justify-end",
							fitContent
								? "max-w-[min(fit-content,80%)]"
								: "max-w-[80%]",
						)
					: "is-assistant w-full max-w-[80%]",
				animate && "fade-in animate-in duration-medium",
				className,
			)}
			{...props}
		/>
	);
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export function MessageContent({
	children,
	className,
	...props
}: Readonly<MessageContentProps>) {
	return (
		<div
			className={cn(
				"flex w-full min-w-0 max-w-full break-words [overflow-wrap:break-word] flex-col gap-2 text-sm",
				"group-[.is-user]:w-fit",
				"group-[.is-user]:rounded-xl group-[.is-user]:rounded-br-none group-[.is-user]:bg-bg-neutral group-[.is-user]:hover:bg-bg-neutral-hovered group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-text",
				"group-[.is-assistant]:text-foreground",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export interface MessageActionsProps extends ComponentProps<"div"> {
	reveal?: "hover" | "always";
}

export function MessageActions({
	className,
	children,
	reveal = "always",
	...props
}: Readonly<MessageActionsProps>) {
	return (
		<div
			className={cn(
				"flex items-center gap-1",
				reveal === "hover" &&
					"opacity-100 transition-opacity md:opacity-0 md:pointer-events-none md:group-hover/message:pointer-events-auto md:group-hover/message:opacity-100 md:focus-within:pointer-events-auto md:focus-within:opacity-100",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export interface MessageActionProps extends ComponentProps<typeof Button> {
	tooltip?: string;
	label?: string;
}

export function MessageAction({
	tooltip,
	children,
	label,
	variant = "ghost",
	size = "icon",
	...props
}: Readonly<MessageActionProps>) {
	const button = (
		<Button size={size} type="button" variant={variant} {...props}>
			{children}
			<span className="sr-only">{label || tooltip}</span>
		</Button>
	);

	if (tooltip) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger render={button} />
					<TooltipContent>
						<p>{tooltip}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return button;
}

export interface MessageCopyActionProps
	extends Omit<MessageActionProps, "children"> {
	text: string;
}

export function MessageCopyAction({
	text,
	...props
}: Readonly<MessageCopyActionProps>) {
	return (
		<MessageAction
			tooltip="Copy"
			onClick={() => void navigator.clipboard.writeText(text)}
			{...props}
		>
			<CopyIcon label="" size="small" />
		</MessageAction>
	);
}

export type MessageEditActionProps = Omit<MessageActionProps, "children">;

export function MessageEditAction(
	props: Readonly<MessageEditActionProps>,
) {
	return (
		<MessageAction tooltip="Edit" {...props}>
			<EditIcon label="" size="small" />
		</MessageAction>
	);
}

export interface MessageVoteActionsProps {
	value?: "up" | "down" | null;
	onVote: (value: "up" | "down" | null) => void;
}

export function MessageVoteActions({
	value,
	onVote,
}: Readonly<MessageVoteActionsProps>) {
	return (
		<>
			<MessageAction
				className={cn(value === "up" && "text-success")}
				onClick={() => onVote(value === "up" ? null : "up")}
				tooltip="Like"
			>
				<ThumbsUpIcon label="" size="small" />
			</MessageAction>
			<MessageAction
				className={cn(value === "down" && "text-danger")}
				onClick={() => onVote(value === "down" ? null : "down")}
				tooltip="Dislike"
			>
				<ThumbsDownIcon label="" size="small" />
			</MessageAction>
		</>
	);
}

export type MessageRegenerateActionProps = Omit<
	MessageActionProps,
	"children"
>;

export function MessageRegenerateAction(
	props: Readonly<MessageRegenerateActionProps>,
) {
	return (
		<MessageAction tooltip="Regenerate" {...props}>
			<RetryIcon label="" size="small" />
		</MessageAction>
	);
}

interface MessageBranchContextType {
	currentBranch: number;
	totalBranches: number;
	goToPrevious: () => void;
	goToNext: () => void;
	branches: ReactElement[];
	setBranches: (branches: ReactElement[]) => void;
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(
	null,
);

function useMessageBranch() {
	const context = use(MessageBranchContext);

	if (!context) {
		throw new Error(
			"MessageBranch components must be used within MessageBranch",
		);
	}

	return context;
}

export interface MessageBranchProps extends HTMLAttributes<HTMLDivElement> {
	defaultBranch?: number;
	onBranchChange?: (branchIndex: number) => void;
}

export function MessageBranch({
	defaultBranch = 0,
	onBranchChange,
	className,
	...props
}: Readonly<MessageBranchProps>) {
	const [currentBranch, setCurrentBranch] = useState(defaultBranch);
	const [branches, setBranches] = useState<ReactElement[]>([]);

	const handleBranchChange = useCallback(
		(newBranch: number) => {
			setCurrentBranch(newBranch);
			onBranchChange?.(newBranch);
		},
		[onBranchChange],
	);

	const goToPrevious = useCallback(() => {
		const newBranch =
			currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
		handleBranchChange(newBranch);
	}, [currentBranch, branches.length, handleBranchChange]);

	const goToNext = useCallback(() => {
		const newBranch =
			currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
		handleBranchChange(newBranch);
	}, [currentBranch, branches.length, handleBranchChange]);

	const contextValue = useMemo<MessageBranchContextType>(
		() => ({
			branches,
			currentBranch,
			goToNext,
			goToPrevious,
			setBranches,
			totalBranches: branches.length,
		}),
		[branches, currentBranch, goToNext, goToPrevious],
	);

	return (
		<MessageBranchContext value={contextValue}>
			<div
				className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
				{...props}
			/>
		</MessageBranchContext>
	);
}

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export function MessageBranchContent({
	children,
	...props
}: Readonly<MessageBranchContentProps>) {
	const { currentBranch, setBranches, branches } = useMessageBranch();
	const childrenArray = useMemo(
		() => (Array.isArray(children) ? children : [children]),
		[children],
	);

	// Use useEffect to update branches when they change
	useEffect(() => {
		if (branches.length !== childrenArray.length) {
			setBranches(childrenArray);
		}
	}, [childrenArray, branches, setBranches]);

	return <>{childrenArray.map((branch, index) => (
		<div
			className={cn(
				"grid gap-2 overflow-hidden [&>div]:pb-0",
				index === currentBranch ? "block" : "hidden",
			)}
			key={branch.key}
			{...props}
		>
			{branch}
		</div>
	))}</>;
}

export type MessageBranchSelectorProps = ComponentProps<typeof ButtonGroup>;

export function MessageBranchSelector({
	className,
	...props
}: Readonly<MessageBranchSelectorProps>) {
	const { totalBranches } = useMessageBranch();

	// Don't render if there's only one branch
	if (totalBranches <= 1) {
		return null;
	}

	return (
		<ButtonGroup
			className={cn(
				"[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
				className,
			)}
			orientation="horizontal"
			{...props}
		/>
	);
}

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export function MessageBranchPrevious({
	children,
	...props
}: Readonly<MessageBranchPreviousProps>) {
	const { goToPrevious, totalBranches } = useMessageBranch();

	return (
		<Button
			aria-label="Previous branch"
			disabled={totalBranches <= 1}
			onClick={goToPrevious}
			size="icon"
			type="button"
			variant="ghost"
			{...props}
		>
			{children ?? <ChevronLeftIcon size={14} />}
		</Button>
	);
}

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export function MessageBranchNext({
	children,
	...props
}: Readonly<MessageBranchNextProps>) {
	const { goToNext, totalBranches } = useMessageBranch();

	return (
		<Button
			aria-label="Next branch"
			disabled={totalBranches <= 1}
			onClick={goToNext}
			size="icon"
			type="button"
			variant="ghost"
			{...props}
		>
			{children ?? <ChevronRightIcon size={14} />}
		</Button>
	);
}

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export function MessageBranchPage({
	className,
	...props
}: Readonly<MessageBranchPageProps>) {
	const { currentBranch, totalBranches } = useMessageBranch();

	return (
		<ButtonGroupText
			className={cn(
				"border-none bg-transparent text-muted-foreground shadow-none",
				className,
			)}
			{...props}
		>
			{currentBranch + 1} of {totalBranches}
		</ButtonGroupText>
	);
}

// react-doctor-disable-next-line react-doctor/only-export-components -- Re-exporting colocated markdown API from the shared module so existing message.tsx consumers keep working.
export { MessageResponse, preloadMessageMarkdown, streamdownComponents } from "./message-markdown";
export type { MessageResponseProps } from "./message-markdown";

export type MessageToolbarProps = ComponentProps<"div">;

export function MessageToolbar({
	className,
	children,
	...props
}: Readonly<MessageToolbarProps>) {
	return (
		<div
			className={cn(
				"mt-4 flex w-full items-center justify-between gap-4",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
