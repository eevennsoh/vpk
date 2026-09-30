"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { token } from "@/lib/tokens";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import FilterIcon from "@atlaskit/icon/core/filter";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import SearchIcon from "@atlaskit/icon/core/search";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StatusWarningIcon from "@atlaskit/icon/core/status-warning";
import type { AvatarData } from "../data/avatars";

type BoardToolbarAvatar = AvatarData & {
	shape?: "circle" | "hexagon";
};

interface BoardToolbarProps {
	avatars: BoardToolbarAvatar[];
	onReset: () => void | Promise<void>;
}

export default function BoardToolbar({ avatars, onReset }: Readonly<BoardToolbarProps>) {
	const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	const handleResetDialogOpenChange = (open: boolean) => {
		if (isResetting) {
			return;
		}

		setIsResetDialogOpen(open);
	};

	const handleConfirmReset = async () => {
		setIsResetting(true);
		try {
			await onReset();
			setIsResetDialogOpen(false);
		} finally {
			setIsResetting(false);
		}
	};

	return (
		<div
			style={{
				paddingTop: token("space.200"),
				paddingBottom: token("space.200"),
				paddingInline: token("space.200"),
			}}
		>
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-4">
					<div
						className="search-field-wrapper"
						style={{
							width: "184px",
						}}
					>
						<InputGroup>
							<InputGroupAddon>
								<SearchIcon label="" />
							</InputGroupAddon>
							<InputGroupInput
								aria-label="Search RFPs"
								autoComplete="off"
								name="rfp-search"
								placeholder="Search RFPs"
								spellCheck={false}
								type="search"
							/>
						</InputGroup>
					</div>
					<div style={{ display: "flex", marginLeft: token("space.negative.050") }}>
						{avatars.slice(0, 4).map((avatar, index) => (
							<div key={`avatar-${index}`} style={{ marginLeft: token("space.negative.050") }}>
								<Avatar shape={avatar.shape ?? "circle"} size="sm">
									<AvatarImage src={avatar.src} alt={avatar.name} />
									<AvatarFallback>{avatar.name?.[0] ?? "?"}</AvatarFallback>
								</Avatar>
							</div>
						))}
						{avatars.length > 4 ? <div style={{ marginLeft: token("space.negative.050") }}>
								<Avatar size="sm">
									<AvatarFallback>{`+${avatars.length - 4}`}</AvatarFallback>
								</Avatar>
							</div> : null}
					</div>
					<Button variant="outline">
						<Icon render={<FilterIcon label="" />} />
						Filter
					</Button>
				</div>

				<div className="flex items-center gap-2">
					<AlertDialog open={isResetDialogOpen} onOpenChange={handleResetDialogOpenChange}>
						<AlertDialogTrigger render={<Button className="gap-2" variant="outline" />}>
							<RefreshIcon label="" size="small" />
							Reset demo
						</AlertDialogTrigger>
						<AlertDialogContent size="sm">
							<AlertDialogHeader>
								<AlertDialogMedia className="bg-bg-warning text-icon-warning">
									<StatusWarningIcon label="" />
								</AlertDialogMedia>
								<AlertDialogTitle>Reset demo?</AlertDialogTitle>
								<AlertDialogDescription>
									This restores the RFP board, generated report, attachments, and open panels to their starting state, and permanently deletes all Rovo chat history.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
								<AlertDialogAction
									isLoading={isResetting}
									onClick={() => void handleConfirmReset()}
									variant="warning"
								>
									Reset demo
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
					<Button className="gap-2" variant="outline">
						<span>Group: RFP stage</span>
						<ChevronDownIcon label="" size="small" />
					</Button>
					<Button aria-disabled aria-label="Customize" size="icon" variant="outline">
						<Icon render={<CustomizeIcon label="" />} />
					</Button>
					<Button aria-disabled aria-label="More board controls" size="icon" variant="outline">
						<Icon render={<ShowMoreHorizontalIcon label="" />} />
					</Button>
				</div>
			</div>
		</div>
	);
}
