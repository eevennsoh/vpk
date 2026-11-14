"use client";

// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ChatSurfaceSwitcherItems,
	type ChatSurfaceSwitchHandler,
} from "@/components/projects/shared/components/chat-surface-switcher";
import { RovoAppBrand } from "@/components/projects/rovo-core/components/rovo-app-brand";
import { RovoAgentBackButton } from "@/components/projects/rovo-core/components/rovo-agent-back-button";
import { ChatHistoryButton } from "./chat-history-button";
import AppIcon from "@atlaskit/icon/core/app";
import BugIcon from "@atlaskit/icon/core/bug";
import CrossIcon from "@atlaskit/icon/core/cross";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import FeedbackIcon from "@atlaskit/icon/core/feedback";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

interface ChatHeaderProps {
	onClose?: () => void;
	onBackToRovo?: () => void;
	onNewChat?: () => void;
	onSurfaceSwitch?: ChatSurfaceSwitchHandler;
	isStreaming?: boolean;
	onStop?: () => void;
	onHistoryToggle?: () => void;
	isHistoryOpen?: boolean;
	showAgentBackButton?: boolean;
	showAgentSelector?: boolean;
	endAction?: ReactNode;
	variant?: "default" | "minimal";
}

export default function ChatHeader({
	onClose,
	onBackToRovo,
	onNewChat,
	onSurfaceSwitch,
	isStreaming,
	onStop,
	onHistoryToggle,
	isHistoryOpen = false,
	showAgentBackButton = true,
	showAgentSelector = true,
	endAction,
	variant = "default",
}: Readonly<ChatHeaderProps>) {
	const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

	// No-op handlers for visual-only buttons
	const noop = () => {};
	const showControls = variant === "default";

	return (
		<div className="py-3 px-3">
			<div className="flex items-center">
				{/* Left side: Menu icon and Title */}
				<div className="flex min-w-0 flex-1 items-center gap-1">
					{showAgentBackButton ? <RovoAgentBackButton onBack={onBackToRovo} /> : null}
					{showControls ? (
						<ChatHistoryButton isHistoryOpen={isHistoryOpen} onToggle={onHistoryToggle} />
					) : null}
					<RovoAppBrand enableAgentSelector={showAgentSelector} />
				</div>

				{/* Right side: Chat actions */}
				{endAction ? <div className="flex shrink-0 items-center">{endAction}</div> : null}
				{showControls ? (
					<div className="flex shrink-0 items-center gap-1">
						<Button aria-label="New chat" size="icon" variant="ghost" onClick={onNewChat ?? noop}>
							<EditIcon label="" />
						</Button>
						<DropdownMenu open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
							<DropdownMenuTrigger
								render={
									<Button
										aria-label="More"
										size="icon"
										variant={isMoreMenuOpen ? "secondary" : "ghost"}
									/>
								}
							>
								<ShowMoreHorizontalIcon label="" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" sideOffset={4} positionerClassName="z-[600]">
								<ChatSurfaceSwitcherItems currentSurface="sidebar" onSurfaceSwitch={onSurfaceSwitch} />
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									{isStreaming ? (
										<DropdownMenuItem
											elemBefore={<span aria-hidden className="size-3 rounded-xs bg-current" />}
											onClick={onStop}
										>
											Cancel
										</DropdownMenuItem>
									) : null}
									<DropdownMenuItem elemBefore={<EditIcon label="" />}>
										Rename
									</DropdownMenuItem>
									<DropdownMenuItem variant="destructive" elemBefore={<DeleteIcon label="" />}>
										Delete
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuItem elemBefore={<AppIcon label="" />}>
										Chrome extension
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuItem elemBefore={<FeedbackIcon label="" />}>
										Feedback
									</DropdownMenuItem>
									<DropdownMenuItem elemBefore={<BugIcon label="" />}>
										Debug
									</DropdownMenuItem>
									<DropdownMenuItem elemBefore={<QuestionCircleIcon label="" />}>
										Get help
									</DropdownMenuItem>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
						<Button aria-label="Close" size="icon" variant="ghost" onClick={onClose ?? noop}>
							<CrossIcon label="" />
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}
