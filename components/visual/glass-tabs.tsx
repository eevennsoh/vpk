"use client";

import { DecorativeFonts } from "./decorative-fonts";

import { motion, useMotionValueEvent } from "motion/react";
import {
	useCallback,
	useEffect,
	useState,
	type CSSProperties,
} from "react";

import LiquidGlass from "@/components/website/demos/visual/shaders/liquid-glass";
import { cn } from "@/lib/utils";

import {
	GLASS_TABS_PILL_GLASS_PROPS,
	GLASS_TABS_PILL_TINT_GRADIENT,
	GLASS_TABS_SHELL_GLASS_PROPS,
	GLASS_TABS_SQUIRCLE_STYLE,
	useGlassTabsMotion,
} from "./glass-tabs-motion";

const GLASS_TABS_FOCUS_RING_STYLE = {
	...GLASS_TABS_SQUIRCLE_STYLE,
	border: "1px solid var(--ds-border-focused)",
	boxShadow:
		"0 0 0 3px color-mix(in srgb, var(--ds-border-focused) 24%, transparent)",
} satisfies CSSProperties;

export interface GlassTabsOption<TValue extends string> {
	value: TValue;
	label: string;
}

export interface GlassTabsProps<TValue extends string> {
	options: ReadonlyArray<GlassTabsOption<TValue>>;
	value: TValue;
	onChange: (value: TValue) => void;
	onHover?: (value: TValue) => void;
	keyboardSelectionPulseKey?: number;
	"aria-label"?: string;
	className?: string;
	style?: CSSProperties;
	onShellStretchChange?: (stretchPx: number) => void;
	/**
	 * Fires whenever the magnet spring (the whole-pill drift triggered by
	 * pointer proximity) updates. Emits the current `(x, y)` translation
	 * in pixels relative to the natural pill position. Useful when an
	 * external sibling element needs to ride along with the pill's
	 * magnetic motion (e.g. an icon button anchored to the pill's edge).
	 */
	onParentMagnetChange?: (xPx: number, yPx: number) => void;
}

export function GlassTabs<TValue extends string>({
	options,
	value,
	onChange,
	onHover,
	keyboardSelectionPulseKey = 0,
	"aria-label": ariaLabel,
	className,
	style,
	onShellStretchChange,
	onParentMagnetChange,
}: Readonly<GlassTabsProps<TValue>>) {
	const [isFocusVisibleWithin, setIsFocusVisibleWithin] = useState(false);
	const {
		containerRef,
		groupId,
		handleContainerPointerMove,
		handleContainerPointerLeave,
		handleOptionClick,
		handleOptionKeyDown,
		handleOptionPointerEnter,
		hoverPillLeft,
		hoverPillOpacity,
		hoverPillWidth,
		hoveredIndex,
		labelMagnetX,
		labelMagnetY,
		parentSpringX,
		parentSpringY,
		pillLeft,
		pillWidth,
		selectedIndex,
		setButtonRef,
		shellOffsetX,
		shellScaleY,
		shellStretch,
		shellWidth,
	} = useGlassTabsMotion({
		options,
		value,
		onChange,
		onHover,
		keyboardSelectionPulseKey,
	});

	const containerStyle = style
		? { ...style, ...GLASS_TABS_SQUIRCLE_STYLE }
		: GLASS_TABS_SQUIRCLE_STYLE;

	const handleFocusCapture = useCallback(
		(event: React.FocusEvent<HTMLDivElement>) => {
			if (!(event.target instanceof HTMLElement)) return;
			setIsFocusVisibleWithin(event.target.matches(":focus-visible"));
		},
		[],
	);

	const handleBlurCapture = useCallback(
		(event: React.FocusEvent<HTMLDivElement>) => {
			const nextTarget = event.relatedTarget;
			if (
				nextTarget instanceof HTMLElement &&
				event.currentTarget.contains(nextTarget)
			) {
				setIsFocusVisibleWithin(nextTarget.matches(":focus-visible"));
				return;
			}
			setIsFocusVisibleWithin(false);
		},
		[],
	);

	useEffect(() => {
		if (!onShellStretchChange) return;
		onShellStretchChange(shellStretch.get());
	}, [onShellStretchChange, shellStretch]);
	useMotionValueEvent(shellStretch, "change", (value) => {
		onShellStretchChange?.(value);
	});

	useEffect(() => {
		if (!onParentMagnetChange) return;
		const emit = () => {
			onParentMagnetChange(parentSpringX.get(), parentSpringY.get());
		};
		emit();
	}, [onParentMagnetChange, parentSpringX, parentSpringY]);
	useMotionValueEvent(parentSpringX, "change", () => {
		onParentMagnetChange?.(parentSpringX.get(), parentSpringY.get());
	});
	useMotionValueEvent(parentSpringY, "change", () => {
		onParentMagnetChange?.(parentSpringX.get(), parentSpringY.get());
	});

	return (
		<motion.div
			className="inline-flex"
			style={{ x: parentSpringX, y: parentSpringY }}
		>
			<DecorativeFonts />
			<div
				ref={containerRef}
				role="radiogroup"
				aria-label={ariaLabel}
				className={cn(
					"relative inline-flex items-center isolate p-1",
					className,
				)}
				style={containerStyle}
				onPointerMove={handleContainerPointerMove}
				onPointerLeave={handleContainerPointerLeave}
				onFocusCapture={handleFocusCapture}
				onBlurCapture={handleBlurCapture}
			>
				<motion.div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 left-0 -z-10"
					style={{
						width: shellWidth,
						x: shellOffsetX,
						scaleY: shellScaleY,
						...GLASS_TABS_SQUIRCLE_STYLE,
					}}
				>
					<LiquidGlass
						{...GLASS_TABS_SHELL_GLASS_PROPS}
						width="100%"
						height="100%"
						className="pointer-events-none absolute inset-0"
						style={GLASS_TABS_SQUIRCLE_STYLE}
					/>
				</motion.div>

				<motion.div
					data-slot="glass-tabs-focus-ring"
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-20 transition-opacity duration-fast ease-out",
						isFocusVisibleWithin ? "opacity-100" : "opacity-0",
					)}
					style={{
						width: shellWidth,
						x: shellOffsetX,
						scaleY: shellScaleY,
					}}
				>
					<div className="absolute inset-0" style={GLASS_TABS_FOCUS_RING_STYLE} />
				</motion.div>

				<motion.div
					aria-hidden="true"
					className="pointer-events-none absolute top-1 bottom-1 z-0 overflow-hidden bg-surface-hovered"
					style={{
						left: hoverPillLeft,
						width: hoverPillWidth,
						opacity: hoverPillOpacity,
						...GLASS_TABS_SQUIRCLE_STYLE,
					}}
				/>

				<motion.div
					aria-hidden="true"
					className="pointer-events-none absolute top-1 bottom-1 z-0 overflow-hidden"
					style={{
						left: pillLeft,
						width: pillWidth,
						...GLASS_TABS_SQUIRCLE_STYLE,
					}}
				>
					<LiquidGlass
						{...GLASS_TABS_PILL_GLASS_PROPS}
						width="100%"
						height="100%"
						className="pointer-events-none absolute inset-0"
						style={GLASS_TABS_SQUIRCLE_STYLE}
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0"
						style={{
							// Keep a token-aware pastel base under the
							// rainbow tint so the selected pill stays soft
							// even when an ancestor fades its opacity.
							backgroundColor:
								"color-mix(in srgb, var(--ds-surface) 85%, transparent)",
							backgroundImage: GLASS_TABS_PILL_TINT_GRADIENT,
							...GLASS_TABS_SQUIRCLE_STYLE,
						}}
					/>
				</motion.div>

				{options.map((option, index) => {
					const isActive = index === selectedIndex;
					const isHovered = hoveredIndex === index;

					return (
						<button
							key={option.value}
							ref={(node) => {
								setButtonRef(index, node);
							}}
							id={`${groupId}-${option.value}`}
							type="button"
							role="radio"
							aria-checked={isActive}
							tabIndex={isActive ? 0 : -1}
							onClick={() => handleOptionClick(option)}
							onPointerEnter={() => handleOptionPointerEnter(index)}
							onKeyDown={(event) => handleOptionKeyDown(event, index)}
							className={cn(
								"relative z-10 px-2.5 py-1",
								"text-[11px] font-medium uppercase tracking-[0.2em]",
								"outline-none transition-colors duration-normal",
								isActive || isHovered ? "text-text" : "text-text-subtle",
							)}
							style={{
								...GLASS_TABS_SQUIRCLE_STYLE,
								fontFamily: "'DotGothic16', sans-serif",
							}}
						>
							<motion.span
								className="inline-block will-change-transform"
								style={{ x: labelMagnetX, y: labelMagnetY }}
							>
								{option.label}
							</motion.span>
						</button>
					);
				})}
			</div>
		</motion.div>
	);
}

export default GlassTabs;
