"use client";

import { useState } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";
import EditIcon from "@atlaskit/icon/core/edit";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import type { AgentListInvoker } from "@/components/blocks/agent-list";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ChatSurfaceSwitcherItems,
	type ChatSurfaceSwitchHandler,
} from "@/components/projects/shared/components/chat-surface-switcher";
import { RovoAppBrand } from "@/components/projects/rovo-core/components/rovo-app-brand";
import { RovoAgentBackButton } from "@/components/projects/rovo-core/components/rovo-agent-back-button";
import { ChatHistoryButton } from "@/components/projects/sidebar-chat/components/chat-history-button";
import { cn } from "@/lib/utils";

interface FloatingChatHeaderProps {
	attributedBy?: AgentListInvoker;
	className?: string;
	/** 24px row — matches Pulse's insight eyebrow (`min-h-6`) and icon-compact chevrons. */
	compact?: boolean;
	onClose: () => void;
	onNewChat?: () => void;
	onSurfaceSwitch?: ChatSurfaceSwitchHandler;
	onHistoryToggle?: () => void;
	isHistoryOpen?: boolean;
	showAgentBackButton?: boolean;
	showAgentSelector?: boolean;
	showChatHistory?: boolean;
	showMoreButton?: boolean;
	showNewChatButton?: boolean;
}

const noop = () => {};

export default function FloatingChatHeader({
	attributedBy,
	className,
	compact = false,
	onClose,
	onNewChat,
	onSurfaceSwitch,
	onHistoryToggle,
	isHistoryOpen = false,
	showAgentBackButton = true,
	showAgentSelector = true,
	showChatHistory = true,
	showMoreButton = true,
	showNewChatButton = true,
}: Readonly<FloatingChatHeaderProps>) {
	const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
	const iconSize = compact ? "icon-compact" : "icon";

	return (
		<div className={cn("relative z-10 flex shrink-0 items-center justify-between px-3 py-3", className)}>
			<div className="flex items-center gap-1">
				{showAgentBackButton ? <RovoAgentBackButton /> : null}
				{showChatHistory ? (
					<ChatHistoryButton isHistoryOpen={isHistoryOpen} onToggle={onHistoryToggle} />
				) : null}
				<RovoAppBrand
					attributedBy={attributedBy}
					className={compact ? "h-6 px-1" : undefined}
					enableAgentSelector={showAgentSelector}
				/>
			</div>
			<div className="flex items-center gap-1">
				{showNewChatButton ? (
					<Button aria-label="New chat" size={iconSize} variant="ghost" onClick={onNewChat ?? noop}>
						<EditIcon label="" />
					</Button>
				) : null}
				{showMoreButton ? (
					<DropdownMenu open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
						<DropdownMenuTrigger
							render={
								<Button
									aria-label="More"
									size={iconSize}
									variant={isMoreMenuOpen ? "secondary" : "ghost"}
								/>
							}
						>
							<ShowMoreHorizontalIcon label="" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" sideOffset={4} positionerClassName="z-[600]">
							<ChatSurfaceSwitcherItems currentSurface="floating" onSurfaceSwitch={onSurfaceSwitch} />
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
				<Button aria-label="Close" size={iconSize} variant="ghost" onClick={onClose}>
					<CrossIcon label="" />
				</Button>
			</div>
		</div>
	);
}
