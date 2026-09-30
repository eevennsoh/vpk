"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { token } from "@/lib/tokens";
import Link from "next/link";
import { NavigationItemActions } from "./navigation-item-actions";
import { NavigationItemProps } from "./types";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";

const PRIMARY_CONTROL_STYLE = {
	alignItems: "center",
	background: "transparent",
	border: 0,
	color: "inherit",
	cursor: "pointer",
	display: "flex",
	flex: 1,
	gap: token("space.025"),
	minWidth: 0,
	padding: 0,
	textAlign: "left",
	textDecoration: "none",
} satisfies CSSProperties;

export function NavigationItem({
	icon: Icon,
	label,
	href,
	isSelected = false,
	hasChevron = false,
	hasExternalLink = false,
	hasActions = false,
	onClick,
}: Readonly<NavigationItemProps>) {
	const [isHovered, setIsHovered] = useState(false);
	const [isFocusedWithin, setIsFocusedWithin] = useState(false);
	const isActionAreaVisible = isHovered || isFocusedWithin;

	const rowStyle = {
		display: "flex",
		alignItems: "center",
		padding: token("space.050"),
		borderRadius: token("radius.xsmall"),
		backgroundColor: isSelected ? token("color.background.selected") : "transparent",
		position: "relative",
		gap: token("space.025"),
		minHeight: "32px",
	} satisfies CSSProperties;

	const primaryContent = (
		<>
			{/* Icon */}
			<span
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "24px",
					height: "24px",
					marginLeft: token("space.025"),
				}}
			>
				<Icon label={label} color={isSelected ? token("color.icon.selected") : token("color.icon.subtle")} />
			</span>

			{/* Label */}
			<span
				style={{
					font: token("font.body"),
					fontWeight: token("font.weight.medium"),
					color: isSelected ? token("color.text.selected") : token("color.text.subtle"),
					flex: 1,
					paddingLeft: token("space.025"),
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{label}
			</span>

			{/* Right icons */}
			{(hasChevron || hasExternalLink) ? <span
					style={{
						display: "flex",
						alignItems: "center",
						gap: token("space.050"),
						marginRight: token("space.025"),
					}}
				>
					{hasChevron ? <ChevronRightIcon label="Expand" color={token("color.icon.subtle")} size="small" /> : null}
					{hasExternalLink ? <LinkExternalIcon label="External link" color={token("color.icon.subtle")} size="small" /> : null}
				</span> : null}
		</>
	);

	return (
		<div
			style={rowStyle}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onFocusCapture={() => setIsFocusedWithin(true)}
			onBlurCapture={(event) => {
				const nextTarget = event.relatedTarget;
				if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
					setIsFocusedWithin(false);
				}
			}}
		>
			{/* Selected indicator */}
			{isSelected ? <div
					style={{
						position: "absolute",
						left: 0,
						top: "50%",
						transform: "translateY(-50%)",
						width: "2px",
						height: "12px",
						backgroundColor: token("color.border.selected"),
						borderRadius: token("radius.xsmall"),
					}}
				/> : null}

			{href ? (
				<Link href={href} onClick={() => onClick?.()} style={PRIMARY_CONTROL_STYLE}>
					{primaryContent}
				</Link>
			) : (
				<button type="button" onClick={onClick} style={PRIMARY_CONTROL_STYLE}>
					{primaryContent}
				</button>
			)}

			{/* Actions */}
			{hasActions && isActionAreaVisible ? <NavigationItemActions label={label} /> : null}
		</div>
	);
}
