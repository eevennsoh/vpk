"use client";

import { useState, type ReactNode } from "react";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { JiraSidebar } from "@/components/blocks/product-sidebar/variants/jira";
import AppLayout from "@/components/projects/page";

import {
	JiraForYou,
	JiraForYouWorkspace,
	type JiraForYouItem,
} from "./index";

interface JiraForYouPageProps {
	onItemClick?: (item: JiraForYouItem) => void;
	onView?: (item: JiraForYouItem) => void;
	sections?: React.ComponentProps<typeof JiraForYou>["sections"];
	tabs?: React.ComponentProps<typeof JiraForYou>["tabs"];
}

export default function JiraForYouPage({
	onItemClick,
	onView,
	sections,
	tabs,
}: Readonly<JiraForYouPageProps> = {}) {
	return (
		<div className="rounded-lg bg-surface p-4 md:p-5">
			<JiraForYou onItemClick={onItemClick} onView={onView} sections={sections} tabs={tabs} />
		</div>
	);
}

interface JiraForYouShellProps {
	children?: ReactNode;
	defaultSelectedSidebarItem?: string;
	defaultSidebarOpen?: boolean;
	shellHeight?: "parent" | "viewport";
	showConversationHeaderBorder?: boolean;
}

/** Full Jira product chrome for the For You workspace. */
export function JiraForYouShell({
	children,
	defaultSelectedSidebarItem = "For you",
	defaultSidebarOpen = true,
	shellHeight = "viewport",
	showConversationHeaderBorder = true,
}: Readonly<JiraForYouShellProps>): React.ReactElement {
	const [selectedSidebarItem, setSelectedSidebarItem] = useState(defaultSelectedSidebarItem);

	return (
		<AppLayout
			chatPanelFlush
			defaultSidebarOpen={defaultSidebarOpen}
			hideFloatingRovo
			hideRovoAction
			product="jira"
			shellHeight={shellHeight}
			sidebarContent={(
				<JiraSidebar
					onSelectItem={setSelectedSidebarItem}
					selectedItem={selectedSidebarItem}
				/>
			)}
			topNavigationSearchAlignment="sidebar"
		>
			<section aria-label="For you" className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
				{children ?? (
					<JiraForYouWorkspace
						chrome="plain"
						className="h-full min-h-0 flex-1"
						showConversationHeaderBorder={showConversationHeaderBorder}
					/>
				)}
			</section>
		</AppLayout>
	);
}

export function JiraForYouWorkspacePreview() {
	return <RovoChatProvider><JiraForYouShell /></RovoChatProvider>;
}
