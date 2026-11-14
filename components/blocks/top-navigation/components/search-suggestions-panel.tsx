"use client";

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useState,
	type CSSProperties,
	type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { token } from "@/lib/tokens";
import { RECENT_SEARCHES, RECENT_ITEMS } from "../data/search-data";
import FilterButtonBar from "./filter-button-bar";
import RecentSearchItem from "./recent-search-item";
import RecentItemCard from "./recent-item-card";
import SearchAllAppsFooter from "./search-all-apps-footer";

interface SearchSuggestionsPanelProps {
	anchorRef: RefObject<HTMLElement | null>;
	isVisible: boolean;
	onSearchAllApps?: () => void;
	onRecentItemClick?: (title: string) => void;
	onRecentSearchClick?: (query: string) => void;
	panelRef: RefObject<HTMLDivElement | null>;
}

export default function SearchSuggestionsPanel({
	anchorRef,
	isVisible,
	onSearchAllApps,
	onRecentItemClick,
	onRecentSearchClick,
	panelRef,
}: Readonly<SearchSuggestionsPanelProps>) {
	const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

	const updatePosition = useCallback(() => {
		const anchorElement = anchorRef.current;

		if (!anchorElement) {
			return;
		}

		const anchorRect = anchorElement.getBoundingClientRect();

		setPanelStyle({
			position: "fixed",
			top: `${anchorRect.bottom + 6}px`,
			left: `${anchorRect.left}px`,
			width: `${anchorRect.width}px`,
			zIndex: 1000,
		});
	}, [anchorRef]);

	useLayoutEffect(() => {
		if (!isVisible) {
			return;
		}

		updatePosition();
	}, [isVisible, updatePosition]);

	useEffect(() => {
		if (!isVisible) {
			return undefined;
		}

		updatePosition();

		const anchorElement = anchorRef.current;
		const resizeObserver = new ResizeObserver(() => {
			updatePosition();
		});

		if (anchorElement) {
			resizeObserver.observe(anchorElement);
		}

		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [anchorRef, isVisible, updatePosition]);

	if (!isVisible) {
		return null;
	}

	if (typeof document === "undefined" || !panelStyle) {
		return null;
	}

	return createPortal(
		<div ref={panelRef} style={panelStyle}>
			<div
				style={{
					width: "100%",
					maxHeight: "min(530px, calc(100vh - 72px))",
					backgroundColor: token("elevation.surface.overlay"),
					borderRadius: token("radius.xlarge"),
					boxShadow: token("elevation.shadow.overlay"),
					padding: "8px 0 0",
				}}
				className="flex flex-col overflow-hidden"
			>
				<FilterButtonBar />

				<div className="min-h-0 flex-1 overflow-y-auto">
					<div style={{ padding: "0 8px" }}>
						{RECENT_SEARCHES.map((search) => (
							<RecentSearchItem
								key={search}
								query={search}
								onClick={() => onRecentSearchClick?.(search)}
							/>
						))}
					</div>

					<div style={{ marginTop: "8px", padding: "0 8px" }}>
						<div
							style={{
								font: token("font.body.small"),
								fontWeight: token("font.weight.bold"),
								color: token("color.text.subtlest"),
								letterSpacing: "0.06em",
								padding: "8px 12px 4px",
							}}
						>
							RECENT
						</div>

						{RECENT_ITEMS.map((item) => (
							<RecentItemCard
								key={`${item.title}-${item.timestamp}`}
								title={item.title}
								metadata={item.metadata}
								timestamp={item.timestamp}
								onClick={() => onRecentItemClick?.(item.title)}
							/>
						))}
					</div>
				</div>

				<SearchAllAppsFooter onClick={onSearchAllApps} />
			</div>
		</div>,
		document.body,
	);
}
