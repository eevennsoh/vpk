"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { chartCssVars, useChartPortalContainer } from "../chart-context";

// Fan configuration
const FAN_RADIUS = 50;
const FAN_ANGLE = 160;

export interface ChartMarker {
	/** Date for this marker (will be matched to nearest data point) */
	/** Date for this marker (will be matched to nearest data point) */
	date: Date;
	/** Icon to display in the marker circle */
	/** Icon to display in the marker circle */
	icon: React.ReactNode;
	/** Title shown in tooltip */
	/** Title shown in tooltip */
	title: string;
	/** Optional description */
	/** Optional description */
	description?: string;
	/** Optional custom content for tooltip (overrides title/description) */
	/** Optional custom content for tooltip (overrides title/description) */
	content?: React.ReactNode;
	/** Optional color override for the marker circle */
	/** Optional color override for the marker circle */
	color?: string;
	/** Click handler */
	/** Click handler */
	onClick?: () => void;
	/** URL to navigate to when clicked */
	/** URL to navigate to when clicked */
	href?: string;
	/** Open href in new tab. Default: false */
	/** Open href in new tab. Default: false */
	target?: "_blank" | "_self";
}

export interface MarkerGroupProps {
	/** X position in pixels */
	/** X position in pixels */
	x: number;
	/** Y position (top of chart area) */
	/** Y position (top of chart area) */
	y: number;
	/** Markers at this position */
	/** Markers at this position */
	markers: ChartMarker[];
	/** Whether this marker group is currently hovered (via chart hover) */
	/** Whether this marker group is currently hovered (via chart hover) */
	isActive?: boolean;
	/** Size of each marker circle */
	/** Size of each marker circle */
	size?: number;
	/** Callback when marker group is hovered */
	/** Callback when marker group is hovered */
	onHover?: (markers: ChartMarker[] | null) => void;
	/** Reference to chart container for portal positioning */
	/** Reference to chart container for portal positioning */
	containerRef?: React.RefObject<HTMLDivElement | null>;
	/** Margin left offset from chart container */
	/** Margin left offset from chart container */
	marginLeft?: number;
	/** Margin top offset from chart container */
	/** Margin top offset from chart container */
	marginTop?: number;
	/** Delay before entrance animation starts */
	/** Delay before entrance animation starts */
	animationDelay?: number;
	/** Whether the marker should animate in */
	/** Whether the marker should animate in */
	animate?: boolean;
	/** Height of the vertical guide line below the marker */
	/** Height of the vertical guide line below the marker */
	lineHeight?: number;
	/** Whether to show the vertical guide line. Default: true */
	/** Whether to show the vertical guide line. Default: true */
	showLine?: boolean;
	/**
	 * Force the marker fan to open even when the user isn't hovering this
	 * group directly. Used by parent layers (e.g. a clustered marker layer)
	 * to fan out a cluster when the chart's main crosshair lands on one of
	 * the cluster's buckets.
	 */
	/**
	 * Force the marker fan to open even when the user isn't hovering this
	 * group directly. Used by parent layers (e.g. a clustered marker layer)
	 * to fan out a cluster when the chart's main crosshair lands on one of
	 * the cluster's buckets.
	 */
	forceOpen?: boolean;
	/**
	 * Make the icon `foreignObject` fill the entire circle (no 4px inset)
	 * so favicon-style icons sit edge-to-edge with the marker border.
	 */
	/**
	 * Make the icon `foreignObject` fill the entire circle (no 4px inset)
	 * so favicon-style icons sit edge-to-edge with the marker border.
	 */
	iconFill?: boolean;
	/**
	 * Override the marker circle's stroke color. Falls back to
	 * `chartCssVars.markerBorder` when not set.
	 */
	/**
	 * Override the marker circle's stroke color. Falls back to
	 * `chartCssVars.markerBorder` when not set.
	 */
	borderColor?: string;
	/**
	 * Marker circle stroke width in px. Default 1.5.
	 */
	/**
	 * Marker circle stroke width in px. Default 1.5.
	 */
	borderWidth?: number;
	/**
	 * Cap the number of markers rendered in the fan-out arc. The count
	 * badge still reflects the full cluster size. Without this, large
	 * clusters (e.g. 20+ spikes) collapse the fan angular spacing to
	 * essentially zero and the markers stack on top of each other.
	 */
	/**
	 * Cap the number of markers rendered in the fan-out arc. The count
	 * badge still reflects the full cluster size. Without this, large
	 * clusters (e.g. 20+ spikes) collapse the fan angular spacing to
	 * essentially zero and the markers stack on top of each other.
	 */
	maxFanned?: number;
	/**
	 * Fade this marker group when another cluster has focus. Used by
	 * parent layers to spotlight the active cluster.
	 */
	/**
	 * Fade this marker group when another cluster has focus. Used by
	 * parent layers to spotlight the active cluster.
	 */
	isMuted?: boolean;
}

// Entrance + fanned + muted variants. `fanned` shrinks and dims the
// collapsed marker while its siblings are flying out in the portal, so
// users only see the fan and not a duplicate icon sitting underneath.
// `muted` fades non-active clusters when one cluster is being focused.
const markerEntranceVariants = {
	hidden: {
		scale: 0.85,
		opacity: 0,
		filter: "blur(2px)",
	},
	visible: {
		scale: 1,
		opacity: 1,
		filter: "blur(0px)",
	},
	fanned: {
		scale: 0.6,
		opacity: 0,
		filter: "blur(2px)",
	},
	muted: {
		scale: 1,
		opacity: 0.4,
		filter: "blur(0px)",
	},
};

export function MarkerGroup({
	x,
	y,
	markers,
	isActive = false,
	size = 32,
	onHover,
	containerRef,
	marginLeft = 0,
	marginTop = 0,
	animationDelay = 0,
	animate = true,
	lineHeight = 0,
	showLine = true,
	forceOpen = false,
	iconFill = false,
	borderColor,
	borderWidth = 1.5,
	maxFanned,
	isMuted = false,
}: MarkerGroupProps) {
	const reduceMotion = useReducedMotion();
	const groupId = useId();
	const [isHovered, setIsHovered] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const portalContainer = useChartPortalContainer(containerRef);
	const shouldFan = (isHovered || isFocused || forceOpen) && markers.length > 1;
	const hasMultiple = markers.length > 1;
	const firstMarker = markers[0];
	const isInteractive = hasMultiple || Boolean(firstMarker?.onClick || firstMarker?.href);
	const activateMarker = () => {
		if (hasMultiple) {
			setIsFocused((value) => !value);
		} else if (firstMarker?.onClick) {
			firstMarker.onClick();
		} else if (firstMarker?.href) {
			window.open(firstMarker.href, firstMarker.target ?? "_self", "noopener,noreferrer");
		}
	};
	const handleBlur = (event: React.FocusEvent) => {
		if (!(event.relatedTarget instanceof Element) || event.relatedTarget.closest(`[data-marker-group="${groupId}"]`) === null) {
			setIsFocused(false);
		}
	};
	const fannedMarkers =
		maxFanned === undefined ? markers : markers.slice(0, maxFanned);
	let currentVariant: "fanned" | "muted" | "visible" = "visible";
	if (shouldFan) {
		currentVariant = "fanned";
	} else if (isMuted) {
		currentVariant = "muted";
	}

	const getCirclePosition = (index: number, total: number) => {
		const startAngle = -90 - FAN_ANGLE / 2;
		const angleStep = total > 1 ? FAN_ANGLE / (total - 1) : 0;
		const angle = startAngle + index * angleStep;
		const radians = (angle * Math.PI) / 180;

		return {
			x: Math.cos(radians) * FAN_RADIUS,
			y: Math.sin(radians) * FAN_RADIUS,
		};
	};

	const handleMouseEnter = (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent chart from handling this event
		setIsHovered(true);
		onHover?.(markers);
	};

	const handleMouseLeave = (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent chart from handling this event
		setIsHovered(false);
		onHover?.(null);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent chart crosshair from moving while hovering markers
	};

	const portalX = x + marginLeft;
	const portalY = y + marginTop;

	return (
		<>
			{/* Position group - no interaction */}
			<g transform={`translate(${x}, ${y})`}>
				{/* Vertical guide line - non-interactive, rendered first (behind marker) */}
				{showLine && lineHeight > 0 ? (
					<m.line
						animate={{
							strokeOpacity: (() => {
								if (isHovered) {
									return 1;
								}
								if (isActive) {
									return 0;
								}
								return 0.6;
							})(),
						}}
						initial={{ strokeOpacity: 0.6 }}
						stroke={chartCssVars.markerBorder}
						strokeDasharray="4,4"
						strokeLinecap="round"
						strokeWidth={1}
						style={{ pointerEvents: "none" }}
						transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
						x1={0}
						x2={0}
						y1={size / 2 + 4}
						y2={lineHeight + Math.abs(y)}
					/>
				) : null}

				{/* Interactive marker group */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: Chart marker interaction */}
				<g
					aria-label={markers.map((marker) => marker.title).join(", ")}
					aria-description={firstMarker?.description}
					aria-expanded={hasMultiple ? shouldFan : undefined}
					className="outline-none focus-visible:outline-2 focus-visible:outline-ring"
					data-marker-group={groupId}
					onBlur={handleBlur}
					onClick={isInteractive ? activateMarker : undefined}
					onFocus={() => setIsFocused(true)}
					onKeyDown={(event) => {
						if (event.key === "Escape") setIsFocused(false);
						if (isInteractive && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							activateMarker();
						}
					}}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					onMouseMove={handleMouseMove}
					role={isInteractive ? "button" : "img"}
					style={{ cursor: isInteractive ? "pointer" : "default" }}
					tabIndex={isInteractive ? 0 : undefined}
				>
					<m.g
						animate={currentVariant}
						initial={animate && !reduceMotion ? "hidden" : currentVariant}
						transition={reduceMotion ? { duration: 0 } : {
							type: "spring",
							stiffness: 300,
							damping: 25,
							delay: animationDelay,
						}}
						variants={markerEntranceVariants}
					>
						{/* Hit area - covers marker circle with padding for count badge above */}
						<rect
							fill="transparent"
							height={size * 1.5}
							width={size * 1.5}
							x={-size * 0.75}
							y={-size}
						/>

						{/* Main marker */}
						<MarkerCircle
							borderColor={borderColor}
							borderWidth={borderWidth}
							color={markers[0]?.color}
							icon={markers[0]?.icon}
							iconFill={iconFill}
							size={size}
						/>

						{/* Count badge */}
						<AnimatePresence>
							{hasMultiple && !shouldFan ? (
								<m.g
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0, opacity: 0 }}
									initial={{ scale: 0, opacity: 0 }}
									transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 20 }}
								>
									<circle
										cx={size / 2 + 2}
										cy={-size / 2 - 2}
										r={9}
										style={{ fill: chartCssVars.badgeBackground }}
									/>
									<text
										dominantBaseline="central"
										fontSize={11}
										fontWeight={600}
										style={{ fill: chartCssVars.badgeForeground }}
										textAnchor="middle"
										x={size / 2 + 2}
										y={-size / 2 - 2}
									>
										{markers.length}
									</text>
								</m.g>
							) : null}
						</AnimatePresence>
					</m.g>
				</g>
			</g>

			{/* Portal for fanned circles */}
			{portalContainer ? createPortal(
					// biome-ignore lint/a11y/noStaticElementInteractions: Marker hover portal
					// biome-ignore lint/a11y/noNoninteractiveElementInteractions: Marker hover portal
					<div
						className="absolute"
						data-marker-group={groupId}
						inert={!shouldFan}
						onBlur={handleBlur}
						onFocus={() => setIsFocused(true)}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
						onMouseMove={handleMouseMove}
						role="presentation"
						style={{
							// Position the div so its center is at the marker position
							// The div covers the entire fan area to prevent mouseLeave when moving between markers
							left: portalX - (FAN_RADIUS + size / 2),
							top: portalY - (FAN_RADIUS + size / 2),
							width: FAN_RADIUS * 2 + size,
							height: FAN_RADIUS * 2 + size,
							zIndex: 100,
							pointerEvents: shouldFan ? "auto" : "none",
						}}
					>
						{/* Center point offset - all fanned markers are positioned relative to this */}
						<div
							className="absolute"
							style={{
								left: FAN_RADIUS + size / 2,
								top: FAN_RADIUS + size / 2,
							}}
						>
							<AnimatePresence mode="sync">
								{shouldFan ? fannedMarkers.map((marker, index) => {
										const position = getCirclePosition(
											index,
											fannedMarkers.length
										);
										return (
											<m.div
												animate={{
													x: position.x,
													y: position.y,
													scale: 1,
													opacity: 1,
												}}
												className="absolute"
												exit={{ x: 0, y: 0, scale: 0, opacity: 0 }}
												initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
												key={`fan-${marker.title}`}
												style={{
													width: size,
													height: size,
													left: -size / 2,
													top: -size / 2,
												}}
												transition={reduceMotion ? { duration: 0 } : {
													type: "spring",
													stiffness: 400,
													damping: 22,
													delay: index * 0.04,
												}}
											>
												<MarkerCircleHTML
													borderColor={borderColor}
													borderWidth={borderWidth}
													color={marker.color}
													href={marker.href}
													icon={marker.icon}
													iconFill={iconFill}
													isClickable={!!(marker.onClick || marker.href)}
												label={marker.title}
													onClick={marker.onClick}
													size={size}
													target={marker.target}
												/>
											</m.div>
										);
									}) : null}
							</AnimatePresence>

							<AnimatePresence>
								{shouldFan ? (
									<m.div
										animate={{ scale: 1, opacity: 0.5 }}
										className="absolute"
										exit={{ scale: 0, opacity: 0 }}
										initial={{ scale: 0, opacity: 0 }}
										style={{
											width: size * 0.5,
											height: size * 0.5,
											left: -size * 0.25,
											top: -size * 0.25,
										}}
										transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 20 }}
									>
										<div
											className="h-full w-full rounded-full"
											style={{ backgroundColor: chartCssVars.markerBorder }}
										/>
									</m.div>
								) : null}
							</AnimatePresence>
						</div>
					</div>,
					portalContainer
				) : null}
		</>
	);
}

interface MarkerCircleProps {
	icon: React.ReactNode;
	size: number;
	color?: string;
	onClick?: () => void;
	href?: string;
	target?: "_blank" | "_self";
	isClickable?: boolean;
	label?: string;
	/** Edge-to-edge icon (no 4px inset). */
	/** Edge-to-edge icon (no 4px inset). */
	iconFill?: boolean;
	/** Override circle stroke color. */
	/** Override circle stroke color. */
	borderColor?: string;
	/** Circle stroke width. */
	/** Circle stroke width. */
	borderWidth?: number;
}

function MarkerCircle({
	icon,
	size,
	color,
	iconFill = false,
	borderColor,
	borderWidth = 1.5,
}: MarkerCircleProps) {
	const inset = iconFill ? 0 : 4;
	return (
		<g>
			<circle cx={0} cy={2} fill="black" opacity={0.15} r={size / 2} />
			<circle
				cx={0}
				cy={0}
				fill={color || chartCssVars.markerBackground}
				r={size / 2}
				stroke={borderColor ?? chartCssVars.markerBorder}
				strokeWidth={borderWidth}
			/>
			<foreignObject
				height={size - inset * 2}
				width={size - inset * 2}
				x={-size / 2 + inset}
				y={-size / 2 + inset}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: chartCssVars.markerForeground,
						fontSize: size * 0.5,
						overflow: "hidden",
						borderRadius: "50%",
					}}
				>
					{icon}
				</div>
			</foreignObject>
		</g>
	);
}

function MarkerCircleHTML({
	icon,
	size,
	color,
	onClick,
	href,
	target = "_self",
	isClickable = false,
	label,
	iconFill = false,
	borderColor,
	borderWidth = 1.5,
}: MarkerCircleProps) {
	const reduceMotion = useReducedMotion();
	const hasAction = isClickable || onClick || href;
	const MarkerElement = hasAction ? m.button : m.div;
	const inset = iconFill ? 0 : 4;

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else if (href) {
			if (target === "_blank") {
				window.open(href, "_blank", "noopener,noreferrer");
			} else {
				window.location.href = href;
			}
		}
	};

	// Note: color and CSS vars must remain inline styles as they're dynamic
	return (
		<MarkerElement
			aria-label={label}
			role={hasAction ? undefined : "img"}
			className={cn(
				"relative flex size-full items-center justify-center rounded-full shadow-lg outline-none focus-visible:outline-2 focus-visible:outline-ring",
				hasAction && "cursor-pointer"
			)}
			onClick={hasAction ? handleClick : undefined}
			style={{
				backgroundColor: color || chartCssVars.markerBackground,
				border: `${borderWidth}px solid ${borderColor ?? chartCssVars.markerBorder}`,
				fontSize: size * 0.5,
				color: chartCssVars.markerForeground,
				padding: inset,
				overflow: "hidden",
			}}
			transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 17 }}
			whileHover={
				hasAction && !reduceMotion
					? { scale: 1.15, boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }
					: undefined
			}
			whileTap={hasAction && !reduceMotion ? { scale: 0.95 } : undefined}
			type={hasAction ? "button" : undefined}
		>
			{icon}
		</MarkerElement>
	);
}

MarkerGroup.displayName = "MarkerGroup";

export default MarkerGroup;
