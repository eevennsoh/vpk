"use client";

import { useState } from "react";
import { token } from "@/lib/tokens";
import { NavigationItem } from "../components/navigation-item";
import { NavigationItemWithHoverChevron } from "../components/navigation-item-with-hover-chevron";
import { Divider } from "../components/divider";
import { SpaceHeader } from "../components/space-header";
import { ContentTreeSection } from "../components/content-tree-section";
import { CURRENT_SPACE, CONFLUENCE_EXTERNAL_LINKS } from "../data/confluence-navigation";
import AppsIcon from "@atlaskit/icon/core/apps";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import ClockIcon from "@atlaskit/icon/core/clock";
import CommentIcon from "@atlaskit/icon/core/comment";
import GlobeIcon from "@atlaskit/icon/core/globe";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";
import PagesIcon from "@atlaskit/icon/core/pages";
import PersonAvatarIcon from "@atlaskit/icon/core/person-avatar";
import QuotationMarkIcon from "@atlaskit/icon/core/quotation-mark";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StarUnstarredIcon from "@atlaskit/icon/core/star-unstarred";

interface ConfluenceSidebarProps {
	selectedItem: string;
	onSelectItem: (item: string) => void;
}

export function ConfluenceSidebar({
	selectedItem,
	onSelectItem,
}: Readonly<ConfluenceSidebarProps>) {
	const [isContentExpanded, setIsContentExpanded] = useState(true);

	return (
		<>
			<NavigationItem
				icon={PersonAvatarIcon}
				label="For you"
				isSelected={selectedItem === "For you"}
				onClick={() => onSelectItem("For you")}
			/>
			<NavigationItem
				icon={ClockIcon}
				label="Recent"
				hasChevron
				onClick={() => onSelectItem("Recent")}
			/>
			<NavigationItem
				icon={StarUnstarredIcon}
				label="Starred"
				hasChevron
				onClick={() => onSelectItem("Starred")}
			/>
			<NavigationItem
				icon={GlobeIcon}
				label="Spaces"
				hasChevron
				onClick={() => onSelectItem("Spaces")}
			/>

			<Divider />

			<SpaceHeader name={CURRENT_SPACE.name} imageSrc={CURRENT_SPACE.imageSrc} />

			<div style={{ height: token("space.100") }} />

			<NavigationItem
				icon={LinkExternalIcon}
				label="Shortcuts"
				onClick={() => onSelectItem("Shortcuts")}
			/>

			<NavigationItemWithHoverChevron
				icon={PagesIcon}
				label="Content"
				isExpanded={isContentExpanded}
				hasActions={true}
				onClick={() => setIsContentExpanded((prev) => !prev)}
			/>

			{isContentExpanded ? <ContentTreeSection
					selectedItem={selectedItem}
					onSelectItem={onSelectItem}
				/> : null}

			<NavigationItemWithHoverChevron
				icon={QuotationMarkIcon}
				label="Blogs"
				isExpanded={false}
				onClick={() => {}}
			/>
			<NavigationItemWithHoverChevron
				icon={CommentIcon}
				label="Questions"
				isExpanded={false}
				onClick={() => {}}
			/>
			<NavigationItemWithHoverChevron
				icon={CalendarIcon}
				label="Calendars"
				isExpanded={false}
				onClick={() => {}}
			/>
			<NavigationItemWithHoverChevron
				icon={AppsIcon}
				label="Space apps"
				isExpanded={false}
				onClick={() => {}}
			/>

			<Divider />

			{CONFLUENCE_EXTERNAL_LINKS.map((link) => (
				<NavigationItem
					key={link.id}
					icon={link.icon}
					label={link.label}
					href={link.href}
					hasExternalLink
					onClick={() => onSelectItem(link.label)}
				/>
			))}

			<Divider />

			<NavigationItem
				icon={ShowMoreHorizontalIcon}
				label="More"
				onClick={() => onSelectItem("More")}
			/>
		</>
	);
}
