"use client"

import { useId } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { useReducedMotion } from "motion/react"

import { ExperimentalSpinner } from "@/components/ui/spinner-experimental"
import { cn } from "@/lib/utils"

const spinnerVariants = cva(
	"pointer-events-none shrink-0",
	{
		variants: {
			size: {
				xs: "size-3",
				sm: "size-3.5",
				default: "size-4",
				lg: "size-5",
				xl: "size-6",
			},
			variant: {
				default: "text-icon-subtlest",
				experimental: "text-icon!",
				inherit: "",
				invert: "text-background",
				rainbow: "",
			},
		},
		defaultVariants: {
			size: "default",
			variant: "default",
		},
	}
)

interface SpinnerProps
	extends VariantProps<typeof spinnerVariants> {
	className?: string
	label?: string
	/** Deterministic offset into the animation loop, used to desynchronise nearby spinners. */
	phaseOffsetMs?: number
	/** Experimental only. Contracts the six dots to a small inner ring, then expands them with varied opacity. */
	pulse?: boolean
	style?: React.CSSProperties
}

/**
 * The tail is shortest at the start/end of its loop, so equal geometric bands
 * underexpose the colors at that seam. These shares compensate for the mask's
 * full 1.2-second cycle so each color contributes roughly equal visible area.
 */
const ROVO_RAINBOW_BANDS = [
	{ color: "#FCA700", share: 0.3, start: 0 },
	{ color: "#6A9A23", share: 0.18, start: 0.3 },
	{ color: "#1868DB", share: 0.21, start: 0.48 },
	{ color: "#AF59E1", share: 0.31, start: 0.69 },
] as const

const SPINNER_RADIUS = 20
const SPINNER_CIRCUMFERENCE = 2 * Math.PI * SPINNER_RADIUS
const SPINNER_LOOP_DURATION_MS = 1200

function normalizeSpinnerPhaseOffsetMs(phaseOffsetMs: number): number {
	if (!Number.isFinite(phaseOffsetMs)) return 0
	return ((Math.round(phaseOffsetMs) % SPINNER_LOOP_DURATION_MS) + SPINNER_LOOP_DURATION_MS)
		% SPINNER_LOOP_DURATION_MS
}

function Spinner({
	className,
	size = "default",
	variant = "default",
	label = "Loading",
	phaseOffsetMs = 0,
	pulse = false,
	style,
}: Readonly<SpinnerProps>) {
	const spinnerId = useId()
	const shouldReduceMotion = useReducedMotion()
	const isRainbow = variant === "rainbow"
	const tailMaskId = `${spinnerId}-tail`
	const normalizedPhaseOffsetMs = normalizeSpinnerPhaseOffsetMs(phaseOffsetMs)
	const negativePhaseOffset = normalizedPhaseOffsetMs > 0
		? `-${normalizedPhaseOffsetMs}ms`
		: undefined
	const tailAnimations = shouldReduceMotion ? null : (
		<>
			<animate
				attributeName="stroke-dasharray"
				begin={negativePhaseOffset}
				calcMode="spline"
				dur="1.2s"
				keySplines="0.4 0 0 1;0.4 0 0 1"
				keyTimes="0;0.5;1"
				repeatCount="indefinite"
				values="1 200;89 200;89 200"
			/>
			<animate
				attributeName="stroke-dashoffset"
				begin={negativePhaseOffset}
				calcMode="spline"
				dur="1.2s"
				keySplines="0.4 0 0 1;0.4 0 0 1"
				keyTimes="0;0.5;1"
				repeatCount="indefinite"
				values="0;-35;-124"
			/>
		</>
	)

	if (variant === "experimental") {
		return (
			<ExperimentalSpinner
				className={cn(spinnerVariants({ size, variant }), className)}
				label={label}
				pulse={pulse}
				style={style}
			/>
		)
	}

	return (
		<svg
			data-slot="spinner"
			role="status"
			aria-label={label}
			viewBox="0 0 50 50"
			fill="none"
			className={cn(spinnerVariants({ size, variant }), className)}
			style={{
				...style,
				animation: shouldReduceMotion
					? undefined
					: "spin calc(var(--duration-slowest) * 2) var(--ease-linear) infinite",
				animationDelay: shouldReduceMotion ? undefined : negativePhaseOffset,
				transformOrigin: "center",
				willChange: shouldReduceMotion ? undefined : "transform",
			}}
		>
			{isRainbow ? (
				<>
					<defs>
						<mask
							height="50"
							id={tailMaskId}
							maskUnits="userSpaceOnUse"
							width="50"
							x="0"
							y="0"
						>
							<circle
								cx="25"
								cy="25"
								fill="none"
								r={SPINNER_RADIUS}
								stroke="white"
								strokeDasharray="56 200"
								strokeDashoffset="0"
								strokeLinecap="round"
								strokeWidth="4"
								transform="rotate(-90 25 25)"
							>
								{tailAnimations}
							</circle>
						</mask>
					</defs>
					<g mask={`url(#${tailMaskId})`}>
						{ROVO_RAINBOW_BANDS.map((band) => {
							const segmentLength = SPINNER_CIRCUMFERENCE * band.share

							return (
								<circle
									cx="25"
									cy="25"
									fill="none"
									key={band.color}
									r={SPINNER_RADIUS}
									stroke={band.color}
									strokeDasharray={`${segmentLength} ${SPINNER_CIRCUMFERENCE - segmentLength}`}
									strokeDashoffset={-SPINNER_CIRCUMFERENCE * band.start}
									strokeLinecap="butt"
									strokeWidth="4"
									transform="rotate(-90 25 25)"
								/>
							)
						})}
					</g>
				</>
			) : (
				<circle
					cx="25"
					cy="25"
					fill="none"
					r={SPINNER_RADIUS}
					stroke="currentColor"
					strokeDasharray="56 200"
					strokeDashoffset="0"
					strokeLinecap="round"
					strokeWidth="4"
					transform="rotate(-90 25 25)"
				>
					{tailAnimations}
				</circle>
			)}
		</svg>
	)
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export { Spinner, spinnerVariants, type SpinnerProps }
