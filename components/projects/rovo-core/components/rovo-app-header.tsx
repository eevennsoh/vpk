"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import EditIcon from "@atlaskit/icon/core/edit";
import ShapesIcon from "@atlaskit/icon/core/shapes";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { RovoAgentBackButton } from "@/components/projects/rovo-core/components/rovo-agent-back-button";
import { RovoAppBrand } from "@/components/projects/rovo-core/components/rovo-app-brand";

export interface RovoAppHeaderArtifactMenuItem {
	id: string;
	typeLabel: string;
	title: string;
}

export interface RovoAppHeaderCoreProps {
	artifactMenuItems?: ReadonlyArray<RovoAppHeaderArtifactMenuItem>;
	onNewChat?: () => void;
	onOpenDocument?: (documentId: string) => void;
	isArtifactOpen?: boolean;
	moreMenuContentClassName?: string;
	moreMenuFooter?: ReactNode;
}

export function RovoAppHeaderCore({
	artifactMenuItems,
	onNewChat,
	onOpenDocument,
	isArtifactOpen,
	moreMenuContentClassName,
	moreMenuFooter,
}: Readonly<RovoAppHeaderCoreProps>) {
	const hasArtifacts = artifactMenuItems && artifactMenuItems.length > 0;

	return (
		<header className={cn("flex items-center gap-3 px-3 py-3", isArtifactOpen && "border-b border-border")}>
			<RovoAgentBackButton />
			<RovoAppBrand />

			<div className="min-h-px min-w-px flex-1" />

			<div className="flex items-center gap-1">
				{hasArtifacts ? (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={(
								<Button
									aria-label="Artifacts"
									size="icon"
									type="button"
									variant="ghost"
								/>
							)}
						>
							<Icon aria-hidden render={<ShapesIcon label="" />} />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuGroup>
								<DropdownMenuLabel>
									{artifactMenuItems.length === 1 ? "Saved artifact" : `${artifactMenuItems.length} saved artifacts`}
								</DropdownMenuLabel>
								{artifactMenuItems.map((artifact) => (
									<DropdownMenuItem
										onClick={() => onOpenDocument?.(artifact.id)}
										description={artifact.typeLabel}
										key={artifact.id}
									>
										{artifact.title}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
				<Button
					aria-label="New chat"
					size="icon"
					variant="ghost"
					onClick={onNewChat}
				>
					<Icon aria-hidden render={<EditIcon label="" />} />
				</Button>
				{moreMenuFooter ? (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button aria-label="More" size="icon" type="button" variant="ghost" />}
						>
							<Icon aria-hidden render={<ShowMoreHorizontalIcon label="" />} />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className={moreMenuContentClassName}>
							{moreMenuFooter}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
		</header>
	);
}
