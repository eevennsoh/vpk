"use client";

import type React from "react";
import {
	Fragment,
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	ChartBrushHandleOverlay,
	renderChartBrushHandle,
} from "./chart-brush-handle";
import {
	ChartBrushSelectionOverlay,
	type ChartBrushSelectionPattern,
} from "./chart-brush-selection-overlay";
import {
	type BrushDirection,
	type BrushDomainBounds,
	type BrushInitialPosition,
	type BrushingType,
	type BrushMoveMode,
	type BrushPoint,
	type BrushState,
	beginBrushDrag,
	beginBrushSelect,
	brushHandleRects,
	brushSelectionRect,
	createBrushState,
	dragBrush,
	endBrush,
	idleBrushState,
	resizeBrushByKeyboard,
} from "./chart-brush-state";
import {
	ChartBrushTrackOverlay,
	type ChartBrushTrackOverlayStyle,
} from "./chart-brush-track-overlay";
import { chartCssVars, useChartStable } from "./chart-context";
import { localPoint } from "./local-point";

type Bounds = BrushDomainBounds;
type ChartXScale = ReturnType<typeof useChartStable>["xScale"];

interface BrushMargin {
	top: number;
	left: number;
	right: number;
	bottom: number;
}

const ZERO_MARGIN: BrushMargin = { top: 0, left: 0, right: 0, bottom: 0 };

const DEFAULT_SELECTED_BOX_STYLE: React.SVGProps<SVGRectElement> = {
	fill: "transparent",
	fillOpacity: 0,
	stroke: chartCssVars.brushBorder,
	strokeWidth: 1,
};

interface BrushInteractionProps {
	xScale: ChartXScale;
	controlled: boolean;
	children: (extent: BrushState["extent"]) => React.ReactNode;
	width: number;
	height: number;
	brushDirection: BrushDirection;
	handleSize: number;
	initialBrushPosition?: BrushInitialPosition;
	/** Offset subtracted from the SVG pointer position when a selection starts. */
	startMargin: BrushMargin;
	moveMode: BrushMoveMode;
	selectedBoxStyle: React.SVGProps<SVGRectElement>;
	onChange: (bounds: Bounds | null) => void;
	onBrushEnd: (bounds: Bounds | null) => void;
}

interface ActiveBrushDrag {
	pointerId: number;
	target: Element;
	pageX: number;
	pageY: number;
	/** SVG-space pointer position at pointer down. */
	local: BrushPoint;
}

function toDomain(state: BrushState, scale: ChartXScale): Bounds | null {
	const { x0, x1 } = state.extent;
	return x0 < 0 || x1 < 0 ? null : {
		x0: scale.invert(x0).getTime(),
		x1: scale.invert(x1).getTime(),
	};
}

/**
 * Hand-written replacement for `@visx/brush` `Brush`: one transparent hit rect
 * for the track (draw a new selection, or move the current one), the visible
 * selection rect, and the two edge handles. Pointer capture replaces visx's
 * window listeners; `chart-brush-state.ts` holds the parity rules.
 */
const ChartBrushInteraction = memo(function ChartBrushInteraction({
	xScale,
	controlled,
	children,
	width,
	height,
	brushDirection,
	handleSize,
	initialBrushPosition,
	startMargin,
	moveMode,
	selectedBoxStyle,
	onChange,
	onBrushEnd,
}: BrushInteractionProps) {
	const stage = useMemo(
		() => ({ width, height, direction: brushDirection }),
		[width, height, brushDirection]
	);
	const externalState = useMemo(
		() => createBrushState(stage, initialBrushPosition),
		[stage, initialBrushPosition],
	);
	const positionSignature = [
		controlled, width, height, brushDirection,
		externalState.extent.x0, externalState.extent.x1,
	].join(":");
	const [positionSource, setPositionSource] = useState(positionSignature);
	const [state, setState] = useState(externalState);
	if (positionSource !== positionSignature) {
		setPositionSource(positionSignature);
		if (!state.isBrushing) setState(externalState);
	}
	const extent = controlled ? externalState.extent : state.extent;
	const stateRef = useRef(state);
	useLayoutEffect(() => {
		stateRef.current = controlled && !state.isBrushing ? externalState : state;
	}, [controlled, externalState, state]);
	const dragRef = useRef<ActiveBrushDrag | null>(null);
	const moveTimerRef = useRef<number | null>(null);
	const pendingMoveRef = useRef<{ pageX: number; pageY: number } | null>(null);

	// Latest props for the next pointer animation frame.
	const latestRef = useRef({ stage, xScale, onChange });
	useLayoutEffect(() => {
		latestRef.current = { stage, xScale, onChange };
	});

	useEffect(
		() => () => {
			if (moveTimerRef.current) {
				cancelAnimationFrame(moveTimerRef.current);
			}
		},
		[]
	);

	const commitState = useCallback((next: BrushState) => {
		stateRef.current = next;
		setState(next);
	}, []);

	const startDrag = useCallback(
		(
			event: React.PointerEvent<Element>,
			next: BrushState,
			local: BrushPoint
		) => {
			const target = event.target as Element;
			try {
				target.setPointerCapture(event.pointerId);
			} catch {
				// Pointer already gone (synthetic event); moves still bubble here.
			}
			dragRef.current = {
				pointerId: event.pointerId,
				target,
				pageX: event.pageX,
				pageY: event.pageY,
				local,
			};
			commitState(next);
			onChange(toDomain(next, xScale));
		},
		[commitState, onChange, xScale]
	);

	// Which drag starts is decided by DOM hit-testing, as in visx: the overlay
	// draws a new selection, the selection rect moves it, a handle resizes.
	const handleOverlayPointerDown = useCallback(
		(event: React.PointerEvent<SVGRectElement>) => {
			if (dragRef.current) {
				return;
			}
			const point = localPoint(event) ?? { x: 0, y: 0 };
			const next = beginBrushSelect(stateRef.current, {
				x: point.x - startMargin.left,
				y: point.y - startMargin.top,
			});
			startDrag(event, next, point);
		},
		[startDrag, startMargin.left, startMargin.top]
	);

	const handleDragPointerDown = useCallback(
		(
			type: Exclude<BrushingType, "select">,
			event: React.PointerEvent<Element>
		) => {
			if (dragRef.current) {
				return;
			}
			const point = localPoint(event) ?? { x: 0, y: 0 };
			startDrag(event, beginBrushDrag(stateRef.current, type), point);
		},
		[startDrag]
	);

	const applyOffset = useCallback(
		(offset: BrushPoint) => {
			const latest = latestRef.current;
			const current = stateRef.current;
			if (!current.isBrushing) {
				return;
			}
			const next = dragBrush(current, offset, latest.stage, moveMode);
			commitState(next);
			latest.onChange(toDomain(next, latest.xScale));
		},
		[commitState, moveMode]
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<Element>) => {
			const drag = dragRef.current;
			if (!drag || event.pointerId !== drag.pointerId) {
				return;
			}
			if (moveMode === "local") {
				const point = localPoint(event) ?? { x: 0, y: 0 };
				applyOffset({ x: point.x - drag.local.x, y: point.y - drag.local.y });
				return;
			}
			pendingMoveRef.current = { pageX: event.pageX, pageY: event.pageY };
			if (moveTimerRef.current) return;
			moveTimerRef.current = requestAnimationFrame(() => {
				moveTimerRef.current = null;
				const pending = pendingMoveRef.current;
				const active = dragRef.current;
				if (!(pending && active)) {
					return;
				}
				applyOffset({
					x: pending.pageX - active.pageX,
					y: pending.pageY - active.pageY,
				});
			});
		},
		[applyOffset, moveMode]
	);

	const handlePointerEnd = useCallback(
		(event: React.PointerEvent<Element>) => {
			const drag = dragRef.current;
			if (!drag || event.pointerId !== drag.pointerId) {
				return;
			}
			if (moveTimerRef.current) {
				cancelAnimationFrame(moveTimerRef.current);
				moveTimerRef.current = null;
			}
			const pending = pendingMoveRef.current;
			if (pending && moveMode === "window") {
				applyOffset({ x: pending.pageX - drag.pageX, y: pending.pageY - drag.pageY });
			}
			pendingMoveRef.current = null;
			const result = endBrush(stateRef.current, moveMode);
			if (result) {
				commitState(result.state);
			}
			dragRef.current = null;
			try {
				if (drag.target.hasPointerCapture(drag.pointerId)) {
					drag.target.releasePointerCapture(drag.pointerId);
				}
			} catch {
				// Element already detached.
			}
			if (!result) {
				return;
			}
			onBrushEnd(toDomain(result.state, xScale));
			for (let i = 0; i < result.changeCount; i++) {
				onChange(toDomain(result.state, xScale));
			}
		},
		[applyOffset, commitState, moveMode, onBrushEnd, onChange, xScale]
	);

	// visx resets on a double-click of the overlay (not the selection).
	const handleOverlayDoubleClick = useCallback(() => {
		const next = idleBrushState();
		commitState(next);
		onChange(toDomain(next, xScale));
	}, [commitState, onChange, xScale]);

	const selection = brushSelectionRect(extent);
	const isBrushActive = extent.x0 >= 0 && extent.x1 >= 0;
	const { brushingType } = state;
	const selectionLocked = state.isBrushing || state.activeHandle !== null;
	const fill = "transparent";

	// Same tree as visx 4.0.0 BaseBrush (Group > overlay Drag, BrushSelection,
	// right / left BrushHandle), including the transparent "dragging" rects
	// each @visx/drag <Drag> adds while its drag is in progress. Moves and
	// pointer-up reach the group through pointer capture on the pressed target.
	return (
		<g
			className="visx-group visx-brush"
			onLostPointerCapture={handlePointerEnd}
			onPointerCancel={handlePointerEnd}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerEnd}
			transform="translate(0, 0)"
		>
			{isBrushActive ? children(extent) : null}
			{/* Attribute objects keep visx's attribute order in the DOM. */}
			{brushingType === "select" ? <rect {...{ width, height, fill }} /> : null}
			<rect
				{...{
					className: "visx-bar visx-brush-overlay",
					fill,
					x: 0,
					y: 0,
					width,
					height,
					onDoubleClick: handleOverlayDoubleClick,
					onPointerDown: handleOverlayPointerDown,
					style: { cursor: "crosshair", touchAction: "pan-y" },
				}}
			/>
			{brushingType === "move" ? (
				<rect {...{ width: selection.width, height: selection.height, fill }} />
			) : null}
			{isBrushActive ? <g>
				{brushingType === "move" ? (
					<rect {...{ width, height, fill, style: { cursor: "move" } }} />
				) : null}
				<rect
					{...{
						...selection,
						className: "visx-brush-selection",
						onPointerDown: (event: React.PointerEvent<SVGRectElement>) =>
							handleDragPointerDown("move", event),
						style: {
							pointerEvents: selectionLocked ? "none" : "all",
							cursor: "move",
						},
						...selectedBoxStyle,
					}}
				/>
			</g> : null}
			{(isBrushActive ? brushHandleRects(extent, handleSize, height) : []).map((handle) => (
				<Fragment key={`handle-${handle.type}`}>
					{brushingType === handle.type ? (
						<rect {...{ width, height, fill }} />
					) : null}
					<g>
						{brushingType === handle.type ? (
							<rect
								{...{ fill, width, height, style: { cursor: "ew-resize" } }}
							/>
						) : null}
						<g
							aria-label={handle.type === "left" ? "Selection start" : "Selection end"}
							aria-orientation="horizontal"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round((handle.type === "left" ? extent.x0 : extent.x1) / Math.max(1, width) * 100)}
							className="outline-none [&:focus-visible>rect]:stroke-ring [&:focus-visible>rect]:stroke-2"
							onKeyDown={(event) => {
								const next = resizeBrushByKeyboard(stateRef.current, handle.type, event.key, stage);
								if (!next) return;
								event.preventDefault();
								commitState(next);
								const domain = toDomain(next, xScale);
								onChange(domain);
								onBrushEnd(domain);
							}}
							onPointerDown={(event) =>
								handleDragPointerDown(handle.type, event)
							}
							role="slider"
							tabIndex={0}
						>
							{renderChartBrushHandle({
								x: handle.x,
								y: handle.y,
								width: handle.width,
								height: handle.height,
								className: `visx-brush-handle-${handle.type}`,
								isBrushActive,
							})}
						</g>
					</g>
				</Fragment>
			))}
		</g>
	);
});

export interface ChartBrushSelection {
	start: Date;
	end: Date;
}

export interface ChartBrushProps {
	/** Callback when brush selection ends. Domain is the selected time range. */
	onSelectionChange?: (domain: ChartBrushSelection | null) => void;
	/** Brush direction. Default: "horizontal" for time range selection. */
	brushDirection?: "horizontal" | "vertical" | "both";
	/** Fill style for the selected region. Default: chart segment style. */
	selectedBoxStyle?: React.SVGProps<SVGRectElement>;
	/** Initial selection so the brush overlay is visible on load (e.g. first 50% of range). */
	initialSelection?: ChartBrushSelection | null;
	/** Controlled window. `null` clears it; omit to manage the selection internally. */
	selection?: ChartBrushSelection | null;
	/** Use window move events for brush (can fix coordinate offset when SVG is in transformed container). Default: true for brush-in-strip. */
	useWindowMoveEvents?: boolean;
	/** Backdrop blur on dimmed track (0–5 px). Default: 1.5 */
	blurPx?: number;
	/** Fade dimmed regions at the outer track edges. Default: true */
	fadeOuterEdges?: boolean;
	/** Optional pattern overlay inside the brush selection window. */
	selectionPattern?: ChartBrushSelectionPattern;
}

interface ChartBrushInnerProps extends ChartBrushTrackOverlayStyle {
	brushDirection?: ChartBrushProps["brushDirection"];
	selectedBoxStyle?: ChartBrushProps["selectedBoxStyle"];
	initialSelection?: ChartBrushProps["initialSelection"];
	controlled: boolean;
	useWindowMoveEvents?: ChartBrushProps["useWindowMoveEvents"];
	xScale: ReturnType<typeof useChartStable>["xScale"];
	innerWidth: number;
	innerHeight: number;
	margin: ReturnType<typeof useChartStable>["margin"];
	onBrushPreview?: (bounds: Bounds | null) => void;
	onBrushCommit: (bounds: Bounds | null) => void;
	selectionPattern?: ChartBrushSelectionPattern;
}

function toDate(value: number | Date): Date {
	return value instanceof Date ? value : new Date(value);
}

const ChartBrushInner = memo(function ChartBrushInner({
	brushDirection = "horizontal",
	selectedBoxStyle,
	initialSelection,
	controlled,
	useWindowMoveEvents = true,
	xScale,
	innerWidth,
	innerHeight,
	margin,
	onBrushPreview,
	onBrushCommit,
	blurPx,
	fadeOuterEdges,
	selectionPattern,
}: ChartBrushInnerProps) {
	const start = initialSelection?.start.getTime();
	const end = initialSelection?.end.getTime();
	const initialBrushPosition = useMemo(() => {
		if (start === undefined || end === undefined) return undefined;
		const x0 = Math.max(0, Math.min(innerWidth, xScale(new Date(Math.min(start, end)))));
		const x1 = Math.max(0, Math.min(innerWidth, xScale(new Date(Math.max(start, end)))));
		return x1 > x0 ? {
			start: { x: x0, y: 0 },
			end: { x: x1, y: innerHeight },
		} : undefined;
	}, [start, end, xScale, innerWidth, innerHeight]);

	return (
		<g className="chart-brush">
			<ChartBrushInteraction
				brushDirection={brushDirection}
				controlled={controlled}
				handleSize={32}
				height={innerHeight}
				initialBrushPosition={initialBrushPosition}
				moveMode={useWindowMoveEvents ? "window" : "local"}
				onBrushEnd={onBrushCommit}
				onChange={onBrushPreview ?? onBrushCommit}
				selectedBoxStyle={selectedBoxStyle ?? DEFAULT_SELECTED_BOX_STYLE}
				startMargin={useWindowMoveEvents ? margin : ZERO_MARGIN}
				width={innerWidth}
				xScale={xScale}
			>
				{(extent) => (
					<>
						<ChartBrushTrackOverlay
							blurPx={blurPx}
							fadeOuterEdges={fadeOuterEdges}
							innerHeight={innerHeight}
							innerWidth={innerWidth}
							selectionX0={extent.x0}
							selectionX1={extent.x1}
						/>
						<ChartBrushSelectionOverlay
							innerHeight={innerHeight}
							innerWidth={innerWidth}
							pattern={selectionPattern}
							selectionX0={extent.x0}
							selectionX1={extent.x1}
						/>
						<ChartBrushHandleOverlay
							innerHeight={innerHeight}
							innerWidth={innerWidth}
							selectionX0={extent.x0}
							selectionX1={extent.x1}
						/>
					</>
				)}
			</ChartBrushInteraction>
		</g>
	);
});

export function ChartBrush({
	onSelectionChange,
	brushDirection = "horizontal",
	selectedBoxStyle,
	initialSelection,
	selection,
	useWindowMoveEvents = true,
	blurPx,
	fadeOuterEdges,
	selectionPattern,
}: ChartBrushProps) {
	const { xScale, innerWidth, innerHeight, margin, isLoaded } =
		useChartStable();
	const defaultSelection = useMemo(() => {
		const domain = xScale.domain();
		const start = domain[0];
		const end = domain.at(-1);
		return start && end ? { start, end } : undefined;
	}, [xScale]);

	const boundsToSelection = useCallback(
		(bounds: Bounds | null): ChartBrushSelection | null => {
			if (
				!bounds ||
				typeof bounds.x0 === "undefined" ||
				typeof bounds.x1 === "undefined"
			) {
				return null;
			}
			const domain = xScale.domain();
			const min = domain[0]?.getTime() ?? Number.NEGATIVE_INFINITY;
			const max = domain.at(-1)?.getTime() ?? Number.POSITIVE_INFINITY;
			const start = new Date(Math.max(min, Math.min(max, toDate(bounds.x0).getTime())));
			const end = new Date(Math.max(min, Math.min(max, toDate(bounds.x1).getTime())));
			if (start.getTime() === end.getTime()) {
				return null;
			}
			return {
				start: start < end ? start : end,
				end: end > start ? end : start,
			};
		},
		[xScale]
	);

	const notifySelectionChange = useCallback(
		(bounds: Bounds | null) => {
			if (!onSelectionChange) {
				return;
			}
			onSelectionChange(boundsToSelection(bounds));
		},
		[onSelectionChange, boundsToSelection]
	);

	const handleBrushPreview = useCallback(
		(bounds: Bounds | null) => {
			notifySelectionChange(bounds);
		},
		[notifySelectionChange]
	);

	const handleBrushCommit = useCallback(
		(bounds: Bounds | null) => {
			notifySelectionChange(bounds);
		},
		[notifySelectionChange]
	);

	if (!isLoaded || innerWidth <= 0 || innerHeight <= 0) {
		return null;
	}

	return (
		<ChartBrushInner
			blurPx={blurPx}
			controlled={selection !== undefined}
			brushDirection={brushDirection}
			fadeOuterEdges={fadeOuterEdges}
			initialSelection={selection !== undefined ? selection : initialSelection ?? defaultSelection}
			innerHeight={innerHeight}
			innerWidth={innerWidth}
			margin={margin}
			onBrushCommit={handleBrushCommit}
			onBrushPreview={handleBrushPreview}
			selectedBoxStyle={selectedBoxStyle}
			selectionPattern={selectionPattern}
			useWindowMoveEvents={useWindowMoveEvents}
			xScale={xScale}
		/>
	);
}

ChartBrush.displayName = "ChartBrush";

export default ChartBrush;
