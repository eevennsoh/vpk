"use client";

import { useRef, useState } from "react";

import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/app/contexts/context-sidebar";
import { useRovoChatControls } from "@/app/contexts";
import { useClickOutside } from "@/components/hooks/use-click-outside";
import ShareDropdownMenu from "./share-dropdown-menu";
import { PRESENCE_USERS } from "../data/presence-users";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import LockUnlockedIcon from "@atlaskit/icon/core/lock-unlocked";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

interface ConfluenceHeaderProps {
	embedded?: boolean;
}

export default function ConfluenceHeader({
	embedded = false,
}: Readonly<ConfluenceHeaderProps>) {
	const { isVisible, isHovered } = useSidebar();
	const { chatSurface } = useRovoChatControls();
	const isSidebarChatOpen = chatSurface === "sidebar";
	const isSidebarOpen = isVisible || isHovered;
	const sidebarWidth = isVisible ? "230px" : "0px";
	const rovoChatWidth = isSidebarChatOpen ? "400px" : "0px";

	const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);
	const [shareButtonRect, setShareButtonRect] = useState<DOMRect | null>(null);
	const shareButtonRef = useRef<HTMLButtonElement>(null);
	const shareMenuRef = useRef<HTMLDivElement>(null);
	const closeShareDropdown = () => {
		setIsShareDropdownOpen(false);
		setShareButtonRect(null);
	};
	const toggleShareDropdown = () => {
		if (isShareDropdownOpen) {
			closeShareDropdown();
			return;
		}

		const rect = shareButtonRef.current?.getBoundingClientRect() ?? null;
		setShareButtonRect(rect);
		setIsShareDropdownOpen(true);
	};

	useClickOutside(
		[shareMenuRef, shareButtonRef],
		closeShareDropdown,
		isShareDropdownOpen
	);

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: `${token("space.100")} ${token("space.150")}`,
				backgroundColor: token("elevation.surface"),
				minHeight: "56px",
				gap: token("space.100"),
				position: embedded ? "absolute" : "fixed",
				top: "var(--vpk-project-shell-top-offset, 48px)",
				left: sidebarWidth,
				right: rovoChatWidth,
				zIndex: 50,
				transition: "left var(--duration-medium) var(--ease-in-out), right var(--duration-medium) var(--ease-in-out)",
			}}
		>
			{/* Left section - only visible when sidebar is closed */}
			{!isSidebarOpen ? <div className="flex items-center gap-1">
					<div
						style={{
							padding: `${token("space.075")} ${token("space.100")}`,
							borderRadius: token("radius.medium"),
						}}
					>
						<div className="flex items-center gap-2">
							<ChevronDownIcon label="Expand breadcrumb" size="small" color={token("color.icon.subtle")} />
							<span className="text-sm text-text-subtle">
								Vitafleet Marketing
							</span>
						</div>
					</div>
				</div> : null}

			{/* Right section */}
			<div style={{ marginLeft: "auto" }}>
				<div className="flex items-center gap-2">
					{/* Edited timestamp */}
					<div style={{ padding: `0 ${token("space.100")}` }}>
						<a
							href="#"
							className="text-text-subtle hover:text-text active:text-text-subtle visited:text-text-subtle no-underline hover:no-underline"
						>
							Edited 4h ago
						</a>
					</div>

					{/* Presence avatars */}
					<div style={{ padding: `0 ${token("space.050")}` }}>
						<AvatarGroup>
							{PRESENCE_USERS.slice(0, 3).map((user) => (
								<Avatar key={user.key} size="sm">
									<AvatarImage src={user.src} alt={user.name} />
									<AvatarFallback>{user.name?.[0] ?? "U"}</AvatarFallback>
								</Avatar>
							))}
							{PRESENCE_USERS.length > 3 ? <AvatarGroupCount>{`+${PRESENCE_USERS.length - 3}`}</AvatarGroupCount> : null}
						</AvatarGroup>
					</div>

					{/* Actions */}
					<div className="flex items-center gap-1">
						{/* Share split button */}
						<div style={{ position: "relative", display: "flex", alignItems: "center" }}>
							<Button className="gap-2 rounded-r-none border-r border-border" variant="secondary">
								<LockUnlockedIcon label="" size="small" />
								Share
							</Button>
							<Button
								ref={shareButtonRef}
								aria-label="More share options"
								size="icon"
								variant="secondary"
								className="rounded-l-none"
								onClick={toggleShareDropdown}
							>
								<ChevronDownIcon label="" size="small" />
							</Button>

							{isShareDropdownOpen && shareButtonRect ? <ShareDropdownMenu
									menuRef={shareMenuRef}
									buttonRect={shareButtonRect}
									onClose={closeShareDropdown}
								/> : null}
						</div>

						{/* More options button */}
						<Button aria-label="More options" size="icon" variant="ghost">
							<ShowMoreHorizontalIcon label="" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
