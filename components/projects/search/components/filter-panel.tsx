"use client";

import React, { useState } from "react";
import { token } from "@/lib/tokens";
import { PRODUCT_FILTERS, CATEGORY_FILTERS } from "../data/filter-data";


import FilterListItem from "./filter-list-item";
import FeedbackIcon from "@atlaskit/icon/core/feedback";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

interface FilterPanelProps {
	/** Currently selected filter ID */
	selectedFilter: string;
	/** Callback when a filter is selected */
	onFilterChange: (filterId: string) => void;
}

/**
 * Filter panel component showing product and category filters
 */
export default function FilterPanel({ selectedFilter, onFilterChange }: Readonly<FilterPanelProps>): React.ReactElement {
	const [showMoreProducts, setShowMoreProducts] = useState(false);

	const displayedProducts = showMoreProducts ? PRODUCT_FILTERS : PRODUCT_FILTERS.slice(0, 13);

	function handleShowMore(): void {
		setShowMoreProducts(true);
	}

	function handleShowMoreKeyDown(e: React.KeyboardEvent): void {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			setShowMoreProducts(true);
		}
	}

	return (
		<div
			style={{
				width: "100%",
				maxWidth: "264px",
				paddingTop: token("space.100"),
				paddingBottom: token("space.100"),
			}}
		>
			<div style={{ display: "flex", flexDirection: "column" }}>
				{/* Product Filters */}
				{displayedProducts.map((item) => (
					<FilterListItem
						key={item.id}
						item={item}
						isSelected={selectedFilter === item.id}
						onClick={() => onFilterChange(item.id)}
					/>
				))}

				{/* Show more button */}
				{!showMoreProducts ? <button
						type="button"
						onClick={handleShowMore}
						aria-label="Show more products"
						style={{
							display: "flex",
							alignItems: "center",
							gap: token("space.150"),
							padding: `${token("space.100")} ${token("space.250")}`,
							transition: "background-color 0.15s",
							background: "none",
							border: "none",
							width: "100%",
						}}
						className="hover:bg-bg-neutral-subtle-hovered"
						onKeyDown={handleShowMoreKeyDown}
					>
						<ShowMoreHorizontalIcon label="Show more" color="currentColor" />
						<span className="text-sm text-text">
							Show more
						</span>
					</button> : null}

				{/* Divider */}
				<div
					style={{
						height: "1px",
						backgroundColor: token("color.border"),
						margin: `${token("space.150")} 0`,
					}}
				/>

				{/* Category Filters */}
				{CATEGORY_FILTERS.map((item) => (
					<FilterListItem
						key={item.id}
						item={item}
						isSelected={selectedFilter === item.id}
						onClick={() => onFilterChange(item.id)}
					/>
				))}

				{/* Divider */}
				<div
					style={{
						height: "1px",
						backgroundColor: token("color.border"),
						margin: `${token("space.150")} 0`,
					}}
				/>

				{/* Footer link */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: token("space.100"),
						padding: `${token("space.200")} ${token("space.150")}`,
					}}
				>
					<FeedbackIcon label="Feedback" color="currentColor" />
					<div>
						<span className="text-sm text-text">
							Improve search{" "}
						</span>
						<span className="text-sm font-medium text-link">
							Give feedback
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
