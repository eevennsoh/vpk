"use client";

import BoardIcon from "@atlaskit/icon/core/board";
import TableIcon from "@atlaskit/icon/core/table";

import { Icon } from "@/components/ui/icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type JiraDesignView = "board" | "list";

interface JiraDesignViewTabsProps {
	activeView: JiraDesignView;
	onViewChange: (view: JiraDesignView) => void;
}

export function JiraDesignViewTabs({
	activeView,
	onViewChange,
}: Readonly<JiraDesignViewTabsProps>): React.ReactElement {
	return (
		<Tabs
			onValueChange={(value) => {
				if (value === "board" || value === "list") {
					onViewChange(value);
				}
			}}
			value={activeView}
		>
			<TabsList className="h-9 w-full justify-start px-2" variant="line">
				<TabsTrigger className="flex-none" value="board">
					<Icon render={<BoardIcon label="" />} />
					Board
				</TabsTrigger>
				<TabsTrigger className="flex-none" value="list">
					<Icon render={<TableIcon label="" />} />
					List
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
