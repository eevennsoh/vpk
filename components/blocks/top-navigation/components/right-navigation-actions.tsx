"use client";

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDesignVariants } from "@/components/hooks/use-design-variants";
import { DESIGN_VARIANTS, type DesignVariantId } from "@/components/utils/design-variants";
import { ThemeToggle } from "@/components/utils/theme-wrapper";
import { RovoColorIcon } from "@/components/ui/logo";
import { token } from "@/lib/tokens";
import NotificationIcon from "@atlaskit/icon/core/notification";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import SettingsIcon from "@atlaskit/icon/core/settings";
import { DEFAULT_TOP_NAVIGATION_CURRENT_USER, type TopNavigationCurrentUser } from "../data/current-user";

export interface RightNavigationSettingsMenuItem {
	checked?: boolean;
	description?: string;
	disabled?: boolean;
	elemBefore?: ReactNode;
	id: string;
	label: string;
	onSelect: () => void;
	variant?: "default" | "destructive";
}

interface RightNavigationActionsProps {
	currentUser?: TopNavigationCurrentUser;
	showRovoAction: boolean;
	isChatOpen: boolean;
	onToggleChat: () => void;
	settingsDesignVariantIds?: readonly DesignVariantId[];
	settingsIconOnly?: boolean;
	settingsMenuItems?: ReadonlyArray<RightNavigationSettingsMenuItem>;
}

function renderSettingsMenuItem(item: RightNavigationSettingsMenuItem) {
	if (item.checked !== undefined) {
		return (
			<DropdownMenuCheckboxItem
				checked={item.checked}
				closeOnClick
				disabled={item.disabled}
				indicatorPlacement="end"
				key={item.id}
				onCheckedChange={item.onSelect}
			>
				{item.label}
			</DropdownMenuCheckboxItem>
		);
	}

	return (
		<DropdownMenuItem
			description={item.description}
			disabled={item.disabled}
			elemBefore={item.elemBefore}
			key={item.id}
			onSelect={item.onSelect}
			variant={item.variant}
		>
			{item.label}
		</DropdownMenuItem>
	);
}

// The shared cluster of right-side actions, rendered both inline (wide widths)
// and inside the "…" overflow popover (narrow widths). Returns a fragment so the
// caller owns the flex container in either context.
export function RightNavigationActions({
	currentUser = DEFAULT_TOP_NAVIGATION_CURRENT_USER,
	showRovoAction,
	isChatOpen,
	onToggleChat,
	settingsDesignVariantIds,
	settingsIconOnly = false,
	settingsMenuItems,
}: Readonly<RightNavigationActionsProps>) {
	const hasSettingsMenu = Boolean(settingsMenuItems && settingsMenuItems.length > 0);
	const { designVariants, setDesignVariant } = useDesignVariants();
	// Demo properties are opt-in; only Jira Team EU26 supplies this list.
	const settingsDesignVariants = DESIGN_VARIANTS.filter((variant) => settingsDesignVariantIds?.includes(variant.id));
	const hasSettingsProperties = settingsDesignVariants.length > 0;

	return (
		<>
			{/* Rovo chat button - suppressed on Rovo/Studio unless forceShowRovoAction overrides it */}
			{showRovoAction ? (
				<Button
					variant="outline"
					className="text-text-subtle"
					aria-pressed={isChatOpen}
					onClick={onToggleChat}
				>
					<RovoColorIcon size="xxsmall" data-icon="inline-start" />
					Ask Rovo
				</Button>
			) : null}

			{/* Notifications */}
			<Button aria-label="Notifications" size="icon" variant="ghost">
				<NotificationIcon label="" color={token("color.icon.subtle")} />
			</Button>

			{/* Help */}
			<Button aria-label="Help" size="icon" variant="ghost">
				<QuestionCircleIcon label="" color={token("color.icon.subtle")} />
			</Button>

			{/* Retain visual chrome without exposing an empty settings control. */}
			{settingsIconOnly || (!hasSettingsProperties && !hasSettingsMenu) ? (
				<span
					aria-hidden="true"
					className="inline-flex size-8 shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-4 [&_svg]:shrink-0"
					data-static-settings-icon=""
				>
					<SettingsIcon label="" color="currentColor" />
				</span>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={(
							<Button
								aria-label="Settings"
								className="[&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-selected"
								size="icon"
								type="button"
								variant="ghost"
							/>
						)}
					>
						<SettingsIcon label="" color="currentColor" />
					</DropdownMenuTrigger>
					{/* Taller than the primitive's 328px cap so route actions below the nine
					   properties stay in view; still bounded by the space on screen. */}
					<DropdownMenuContent align="end" className="max-h-[min(480px,var(--available-height,480px))] w-64">
						{hasSettingsProperties ? (
							<DropdownMenuGroup>
								{/* Base UI requires the label to live inside its group. */}
								<DropdownMenuLabel>Properties</DropdownMenuLabel>
								{settingsDesignVariants.map((variant) => (
									<DropdownMenuCheckboxItem
										indicatorPlacement="end"
										checked={designVariants[variant.id]}
										key={variant.id}
										onCheckedChange={(checked) => {
											setDesignVariant(variant.id, checked);
										}}
									>
										{variant.label}
									</DropdownMenuCheckboxItem>
								))}
								{/* Route actions close the Properties group, below a separator. */}
								{hasSettingsMenu ? (
									<>
										<DropdownMenuSeparator />
										{settingsMenuItems?.map(renderSettingsMenuItem)}
									</>
								) : null}
							</DropdownMenuGroup>
						) : hasSettingsMenu ? (
							<DropdownMenuGroup>{settingsMenuItems?.map(renderSettingsMenuItem)}</DropdownMenuGroup>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			{/* Profile and theme */}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={(
						<Button
							aria-label="Profile menu"
							data-current-user-id={currentUser.id}
							size="icon"
							type="button"
							variant="ghost"
						>
							<Avatar label={currentUser.name} size="sm">
								<AvatarImage src={currentUser.avatarSrc} alt={`${currentUser.name} avatar`} />
								<AvatarFallback>{currentUser.initials ?? currentUser.name.slice(0, 3)}</AvatarFallback>
							</Avatar>
						</Button>
					)}
				/>
				<DropdownMenuContent align="end" aria-label="Profile settings" className="min-w-44 w-44">
					<ThemeToggle appearance="menu-item" label="Theme" />
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
