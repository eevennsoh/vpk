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

export interface RightNavigationSettingsMenuItem {
	description?: string;
	disabled?: boolean;
	elemBefore?: ReactNode;
	id: string;
	label: string;
	onSelect: () => void;
	variant?: "default" | "destructive";
}

interface RightNavigationActionsProps {
	showRovoAction: boolean;
	isChatOpen: boolean;
	onToggleChat: () => void;
	settingsDesignVariantIds?: readonly DesignVariantId[];
	settingsIconOnly?: boolean;
	settingsMenuItems?: ReadonlyArray<RightNavigationSettingsMenuItem>;
}

// The shared cluster of right-side actions, rendered both inline (wide widths)
// and inside the "…" overflow popover (narrow widths). Returns a fragment so the
// caller owns the flex container in either context.
export function RightNavigationActions({
	showRovoAction,
	isChatOpen,
	onToggleChat,
	settingsDesignVariantIds,
	settingsIconOnly = false,
	settingsMenuItems,
}: Readonly<RightNavigationActionsProps>) {
	const hasSettingsMenu = Boolean(settingsMenuItems && settingsMenuItems.length > 0);
	const { designVariants, setDesignVariant } = useDesignVariants();
	const settingsDesignVariants = settingsDesignVariantIds === undefined
		? DESIGN_VARIANTS
		: DESIGN_VARIANTS.filter((variant) => settingsDesignVariantIds.includes(variant.id));

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

			{/* Fixed-presentation routes retain the visual chrome without exposing
			    a control that cannot do anything. */}
			{settingsIconOnly ? (
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
					<DropdownMenuContent align="end" className="w-64">
						<DropdownMenuGroup>
							{/* Base UI requires group parts (the label) to live inside the
							    group that owns them, so the label is nested here. */}
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
						</DropdownMenuGroup>
						{hasSettingsMenu ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									{settingsMenuItems?.map((item) => (
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
									))}
								</DropdownMenuGroup>
							</>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			{/* Theme toggle */}
			<ThemeToggle />

			{/* Profile */}
			<div className="flex size-8 items-center justify-center">
				<Avatar size="sm">
					<AvatarImage src="/avatar-user/venn/venn.png" alt="Venn avatar" />
					<AvatarFallback>VN</AvatarFallback>
				</Avatar>
			</div>
		</>
	);
}
