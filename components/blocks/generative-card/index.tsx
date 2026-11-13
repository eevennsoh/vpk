"use client";

import type { ComponentProps, ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { createContext, memo, use, useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { GenerativeCardBulgeCanvas, type DistortionTintMode } from "./generative-card-bulge-canvas";
import { GenerativeCardShimmerBorder } from "./generative-card-shimmer-border";

type GenerativeCardContextValue = {
	expanded: boolean;
	setExpanded: (next: boolean) => void;
};

const GenerativeCardContext = createContext<GenerativeCardContextValue | null>(null);

function useGenerativeCardContext(optional: true): GenerativeCardContextValue | null;
function useGenerativeCardContext(optional?: false): GenerativeCardContextValue;
function useGenerativeCardContext(optional = false) {
	const context = use(GenerativeCardContext);

	if (context === null && !optional) {
		throw new Error("GenerativeCard components must be used within <GenerativeCard>.");
	}

	return context;
}

export type GenerativeCardProps = ComponentProps<typeof Card> & {
	defaultExpanded?: boolean;
	expanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
	/** When true, plays a one-shot WebGL bulge+fringe entrance animation on mount. */
	animate?: boolean;
	/** Duration of the entrance animation in milliseconds. @default 2000 */
	animateDuration?: number;
	/** Maximum WebGL displacement scale (higher = more dramatic distortion). @default 100 */
	animateDistortionScale?: number;
	/** Maximum blur amount applied inside the moving band. @default 8 */
	animateBlur?: number;
	/** Distortion radius mapped to moving band height (0-1). Higher values distort a thicker region. @default 0.4 */
	animateRadius?: number;
	/** Horizontal edge safety fade (0-0.08). Lower values reach closer to edges, higher values reduce edge artifacts. @default 0 */
	animateEdgeSafeX?: number;
	/** Sweep playback speed multiplier (higher = faster top-to-bottom pass). @default 1.35 */
	animateSpeed?: number;
	/** Smoothing applied to displacement scale updates (0-1). Higher reacts faster. @default 0.5 */
	animateScaleSmoothing?: number;
	/** Smoothing applied to vertical sweep movement (0-1). Higher reacts faster. @default 0.5 */
	animateSweepSmoothing?: number;
	/** Optional color tint applied inside the distortion band. */
	animateTintMode?: DistortionTintMode;
	/** Optional solid tint color applied inside the distortion band (used when tint mode is "solid"). */
	animateTintColor?: string;
	/** Opacity strength of the distortion tint (0-1). @default 0 */
	animateTintStrength?: number;
	/** Border effect: "shimmer" for uniform gradient, "trace" for Linear-style comet arc, false to disable. */
	borderEffect?: "shimmer" | "trace" | false;
	/** Duration of the border effect animation in milliseconds. */
	borderEffectDuration?: number;
	/** Trace only — angular width of the visible arc in degrees. @default 90 */
	borderEffectArcWidth?: number;
};

export const GenerativeCard = memo(function GenerativeCard({
	className,
	defaultExpanded = true,
	expanded,
	onExpandedChange,
	animate = false,
	animateDuration,
	animateDistortionScale,
	animateBlur,
	animateRadius,
	animateEdgeSafeX,
	animateSpeed,
	animateScaleSmoothing,
	animateSweepSmoothing,
	animateTintMode,
	animateTintColor,
	animateTintStrength,
	borderEffect = false,
	borderEffectDuration,
	borderEffectArcWidth,
	children,
	...props
}: Readonly<GenerativeCardProps>) {
	const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
	const isControlled = expanded !== undefined;
	const isExpanded = isControlled ? expanded : uncontrolledExpanded;

	const setExpanded = useCallback(
		(next: boolean) => {
			if (!isControlled) {
				setUncontrolledExpanded(next);
			}
			onExpandedChange?.(next);
		},
		[isControlled, onExpandedChange],
	);

	const contextValue = useMemo<GenerativeCardContextValue>(
		() => ({ expanded: isExpanded, setExpanded }),
		[isExpanded, setExpanded],
	);

	const cardRef = useRef<HTMLDivElement>(null);
	const distortionTargetRef = useRef<HTMLDivElement>(null);
	const [phase, setPhase] = useState<"animating" | "done">(
		animate ? "animating" : "done",
	);

	const handleComplete = useCallback(() => {
		setPhase("done");
	}, []);

	const needsWrapper = animate || borderEffect;

	const card = (
		<GenerativeCardContext value={contextValue}>
			{/* `p-0`/`gap-0` zero the base Card padding + flex gap, but the
			    `data-[size=sm]:py-3` / `data-[size=sm]:gap-3` variants are separate
			    tailwind-merge groups, so they survive and (by specificity) re-add
			    vertical padding + a 12px gap between header and the collapsed body
			    on sm cards. Zero the variants too so only the header sets height. */}
			<Card ref={cardRef} className={cn("w-full gap-0 p-0 data-[size=sm]:py-0 data-[size=sm]:gap-0", needsWrapper ? undefined : className)} {...props}>
				{animate ? (
					<div ref={distortionTargetRef} className="relative">
						{children}
					</div>
				) : children}
			</Card>
		</GenerativeCardContext>
	);

	if (!needsWrapper) return card;

	const borderEffectNode = borderEffect ? (
		<GenerativeCardShimmerBorder
			variant={borderEffect}
			duration={borderEffectDuration}
			arcWidth={borderEffectArcWidth}
		/>
	) : null;

	return (
		<div className={cn("relative", className)} style={{ isolation: "isolate" }}>
			<div
				style={{
					pointerEvents: phase === "done" ? "auto" : "none",
				}}
			>
				{card}
			</div>
			{borderEffectNode}
			{phase === "animating" ? (
				<GenerativeCardBulgeCanvas
					cardRef={distortionTargetRef}
					duration={animateDuration}
					maxDisplacementScale={animateDistortionScale}
					maxBlur={animateBlur}
					bandHeight={animateRadius}
					edgeSafeX={animateEdgeSafeX}
					speed={animateSpeed}
					scaleSmoothing={animateScaleSmoothing}
					sweepSmoothing={animateSweepSmoothing}
					tintMode={animateTintMode}
					tintColor={animateTintColor}
					tintStrength={animateTintStrength}
					onComplete={handleComplete}
				/>
			) : null}
		</div>
	);
});

export type GenerativeCardHeaderProps = Omit<ComponentProps<typeof CardHeader>, "title"> & {
	leading: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	showToggle?: boolean;
	expandLabel?: string;
	collapseLabel?: string;
	expanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
};

export const GenerativeCardHeader = memo(function GenerativeCardHeader({
	className,
	title,
	description,
	leading,
	action,
	showToggle = true,
	expandLabel = "Expand card details",
	collapseLabel = "Collapse card details",
	expanded,
	onExpandedChange,
	...props
}: Readonly<GenerativeCardHeaderProps>) {
	const context = useGenerativeCardContext(true);
	const isExpanded = expanded ?? context?.expanded ?? true;
	const setExpanded = onExpandedChange ?? context?.setExpanded;
	const shouldShowToggle = showToggle && typeof setExpanded === "function";

	return (
		<CardHeader className={cn("items-center gap-x-3 gap-y-0 px-4 py-3", isExpanded ? "border-b" : null, className)} {...props}>
			<div className="flex min-w-0 items-center gap-3">
				{leading}
				<div className="min-w-0 flex-1">
					<CardTitle className="truncate text-sm leading-5 font-semibold">{title}</CardTitle>
					{description ? (
						<CardDescription className="line-clamp-2 text-xs leading-4">
							{description}
						</CardDescription>
					) : null}
				</div>
			</div>
			{action || shouldShowToggle ? (
				<CardAction className="self-center">
					<div className="flex items-center gap-1">
						{action}
						{shouldShowToggle ? (
							<Button
								variant="ghost"
								size="icon"
								type="button"
								className="text-text-subtle"
								aria-label={isExpanded ? collapseLabel : expandLabel}
								onClick={() => setExpanded(!isExpanded)}
							>
								<span
									className="transition-transform duration-medium ease-in-out"
									style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
								>
									<ChevronRightIcon label="" size="small" />
								</span>
							</Button>
						) : null}
					</div>
				</CardAction>
			) : null}
		</CardHeader>
	);
});

export type GenerativeCardBodyProps = ComponentProps<"div">;

export const GenerativeCardBody = memo(function GenerativeCardBody({
	className,
	...props
}: Readonly<GenerativeCardBodyProps>) {
	const { expanded } = useGenerativeCardContext();

	return (
		<div
			className="grid transition-[grid-template-rows] duration-medium ease-in-out"
			style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
		>
			<div className="overflow-hidden">
				<div className={cn(className)} {...props} />
			</div>
		</div>
	);
});

export type GenerativeCardContentProps = ComponentProps<typeof CardContent>;

export const GenerativeCardContent = memo(function GenerativeCardContent({
	className,
	...props
}: Readonly<GenerativeCardContentProps>) {
	return <CardContent className={cn("px-4 py-4", className)} {...props} />;
});

export type GenerativeCardPreviewProps = ComponentProps<"div">;

export const GenerativeCardPreview = memo(function GenerativeCardPreview({
	className,
	...props
}: Readonly<GenerativeCardPreviewProps>) {
	return (
		<div
			className={cn(
				"flex h-[298px] w-full items-center justify-center overflow-hidden rounded-md bg-surface p-3 text-xs text-text-subtlest",
				className,
			)}
			{...props}
		/>
	);
});

export type GenerativeCardFooterProps = ComponentProps<typeof CardFooter> & {
	/** Optional primary action rendered to the right of children (e.g. a "Send" button). */
	action?: ReactNode;
};

export const GenerativeCardFooter = memo(function GenerativeCardFooter({
	className,
	action,
	children,
	...props
}: Readonly<GenerativeCardFooterProps>) {
	return (
		<CardFooter
			className={cn("justify-end gap-2 px-4 py-4", className)}
			{...props}
		>
			{children}
			{action}
		</CardFooter>
	);
});

export type { DistortionTintMode };
