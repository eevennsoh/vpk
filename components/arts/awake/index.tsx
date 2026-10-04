"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-chain-state-updates -- Related state fields are updated together to preserve atomic UI transitions and avoid partial interaction states.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.
// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.
// oxlint-disable react-doctor/prefer-module-scope-static-value -- These values are intentionally colocated with the component/demo contract for readability and token context.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import * as React from "react";

import { useTheme } from "@/components/utils/theme-wrapper";
import Bands from "@/components/website/demos/visual/shaders/bands";
import LiquidGradient from "@/components/visual/liquid-gradient";
import Particles from "@/components/website/demos/visual/shaders/particles";
import Rings from "@/components/website/demos/visual/shaders/rings";
import Noise, {
	type NoiseBlendMode,
} from "@/components/website/demos/visual/shaders/noise";
import WaveGradient from "@/components/website/demos/visual/shaders/wave-gradient";

import { Footer } from "@/components/ui-custom/footer";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlassTabs } from "@/components/visual/glass-tabs";
import { Kbd } from "@/components/ui/kbd";
import {
	GLASS_TABS_SQUIRCLE_STYLE,
} from "@/components/visual/glass-tabs-motion";
import { Cctv } from "@/components/animate-ui/icons/cctv";
import { Spinner } from "@/components/ui/spinner";
import {
	ReturnIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { flushSync } from "react-dom";

import { CityRailEditor } from "./city-popover";
import { DigitDisplay, FlipText } from "./digit-display";
import { getRandomShaderConfig, type ShaderConfig } from "./shader-config";
import { useCities } from "./use-cities";
import { useCurrentWeather } from "./use-current-weather";
import { type LocationClock, useLocationClock } from "./use-location-clock";
import {
	type WakeLockStatus,
	useWakeLock,
	WAKE_LOCK_VISIBLE_TAB_MESSAGE,
} from "./use-wake-lock";
import { WeatherIcon } from "./weather-icon";
import {
	WidgetCard,
	WidgetGridOverlay,
} from "./widget-card";
import { motionEase } from "@/lib/motion";

// Pool of preloaded <audio> elements keyed by src. Reusing the same element
// across calls means:
//  1. The first successful playback after a user gesture "unlocks" that
//     element for the rest of the session, so subsequent hover-triggered
//     plays (which the browser would otherwise block as not-user-initiated)
//     keep working.
//  2. We don't pay the network/decode cost on every hover tick.
const audioPool = new Map<string, HTMLAudioElement>();

function getPooledAudio(src: string): HTMLAudioElement {
	let audio = audioPool.get(src);
	if (!audio) {
		audio = new Audio(src);
		audio.preload = "auto";
		audioPool.set(src, audio);
	}
	return audio;
}

// Browser autoplay policies block `<audio>.play()` until the page has
// received a "user activation" gesture (click, keydown, pointerdown,
// touchstart). Hover events (mousemove / pointerenter) DO NOT count, so
// the very first hover after a fresh page load can't play anything.
//
// To make hover sounds reliable from the very first interaction, we
// install one-time listeners for the gesture types the browser DOES
// recognize. On the first such gesture we play+pause every pooled
// `<audio>` element with volume 0 — that single user-initiated play
// unlocks each element for the rest of the session, after which
// non-gesture-initiated `.play()` calls (e.g. hover) work as expected.
let audioUnlocked = false;
function unlockAllAudio() {
	if (audioUnlocked) return;
	audioUnlocked = true;
	for (const audio of audioPool.values()) {
		const previousVolume = audio.volume;
		audio.volume = 0;
		audio
			.play()
			.then(() => {
				audio.pause();
				audio.currentTime = 0;
				audio.volume = previousVolume;
			})
			.catch(() => {
				// Restore volume even on failure so the next genuine play
				// uses the right level.
				audio.volume = previousVolume;
			});
	}
}

function ensureAudioUnlockListener() {
	if (typeof window === "undefined") return;
	if ((window as unknown as { __vpkAudioUnlockBound?: boolean }).__vpkAudioUnlockBound) {
		return;
	}
	(window as unknown as { __vpkAudioUnlockBound?: boolean }).__vpkAudioUnlockBound = true;
	const handler = () => {
		unlockAllAudio();
		window.removeEventListener("pointerdown", handler, true);
		window.removeEventListener("keydown", handler, true);
		window.removeEventListener("touchstart", handler, true);
	};
	// Capture phase + once-style cleanup so we hear the first gesture
	// regardless of whether downstream handlers stop propagation.
	window.addEventListener("pointerdown", handler, true);
	window.addEventListener("keydown", handler, true);
	window.addEventListener("touchstart", handler, true);
}

// Install the unlock listener at module-load time (client only) so the
// FIRST gesture anywhere on the page primes the pool — even if the user
// hovers the slider before triggering any other code path that calls
// playSound. Without this, the listener wouldn't bind until the first
// hover, and hovers themselves don't count as user activation.
if (typeof window !== "undefined") {
	ensureAudioUnlockListener();
}

function playSound(src: string, volume = 0.5) {
	if (typeof window === "undefined") return;
	ensureAudioUnlockListener();
	const audio = getPooledAudio(src);
	audio.volume = Math.max(0, Math.min(1, volume));
	// Rewind so rapid re-triggers (hover scrub across ticks) actually
	// re-play instead of being swallowed because the element is already
	// mid-playback.
	try {
		audio.currentTime = 0;
	} catch {
		// Some browsers throw if metadata isn't loaded yet — safe to skip.
	}
	audio.play().catch(() => {
		// Most failures here are NotAllowedError before the user has
		// produced a qualifying gesture (click/keydown/pointerdown/
		// touchstart). The capture-phase unlock listener installed at
		// module load primes every pooled element on the first such
		// gesture, after which subsequent hover-only plays succeed for
		// the rest of the session.
	});
}

export interface WeatherProps {
	className?: string;
}

type WeatherThemeMode = "location" | "system" | "light" | "dark";

const THEME_MODE_ORDER: WeatherThemeMode[] = [
	"location",
	"system",
	"light",
	"dark",
];

const THEME_MODE_STORAGE_KEY = "weather-theme-mode";

function isWeatherThemeMode(value: string | null): value is WeatherThemeMode {
	return (
		value === "location" ||
		value === "system" ||
		value === "light" ||
		value === "dark"
	);
}

function formatTemperature(value: number | null): string {
	if (value === null || Number.isNaN(value)) return "--";
	return `${Math.round(value)}`;
}

// Match the GlassTabs internal elastic constants so the wake-lock button
// thins/translates in lockstep with the shell. Keep these in sync with
// `MAX_SHELL_STRETCH_PX` / `MAX_SHELL_THIN_RATIO` in
// `components/visual/glass-tabs-motion.ts`.
const WAKE_BUTTON_MAX_SHELL_STRETCH_PX = 32;
const WAKE_BUTTON_MAX_THIN_RATIO = 0.14;
// When the shell stretches LEFT (negative `shellStretch`), the wake-lock
// button gets sympathetically tugged left by this fraction of the stretch
// magnitude — softer than the shell's own translation so the button
// reads as "pulled along" rather than "rigidly attached".
const WAKE_BUTTON_LEFT_PULL_RATIO = 0.35;

function ThemeControl({
	mode,
	onChange,
	isVisible,
	keyboardSelectionPulseKey,
	wakeLock,
	cutoutFillColor,
	cutoutIconFilter,
	noiseColor,
	noiseOpacity,
	noiseBlendMode,
}: {
	mode: WeatherThemeMode;
	onChange: (mode: WeatherThemeMode) => void;
	isVisible: boolean;
	keyboardSelectionPulseKey: number;
	wakeLock: {
		isSupported: boolean;
		isEnabled: boolean;
		isActive: boolean;
		status: WakeLockStatus;
		statusMessage: string | null;
		error: string | null;
		onToggle: () => void;
		buttonRef?: React.RefObject<HTMLButtonElement | null>;
	};
	cutoutFillColor: string;
	// Tuned for the small (16×16) wake-lock eye icon — see
	// `cutoutIconFilterSmall` in the parent component for the rationale on
	// why we don't reuse the hero `cutoutIconFilter` at this size.
	cutoutIconFilter: string;
	noiseColor: string;
	noiseOpacity: number;
	noiseBlendMode: NoiseBlendMode;
}) {
	const [isFocusWithin, setIsFocusWithin] = React.useState(false);
	// Signed pixel offset matching the live `shellStretch` of the GlassTabs
	// container: positive when stretched RIGHT (button moves right with the
	// shell's growing edge), negative when stretched LEFT (button is
	// gently tugged leftward by a fraction of the magnitude).
	const wakeButtonStretchX = useMotionValue(0);
	// Vertical thinning factor mirroring the GlassTabs `shellScaleY` so the
	// button squashes/un-squashes in lockstep with the shell.
	const wakeButtonScaleY = useMotionValue(1);
	// Mirrors the GlassTabs whole-pill magnet drift (`parentSpringX/Y`)
	// so the wake-lock button physically follows the pill as it drifts
	// toward the cursor.
	const wakeButtonMagnetX = useMotionValue(0);
	const wakeButtonMagnetY = useMotionValue(0);
	// Composite X = stretch offset + magnet drift.
	const wakeButtonX = useTransform(
		[wakeButtonStretchX, wakeButtonMagnetX],
		([stretch, magnet]) => (stretch as number) + (magnet as number),
	);
	const options: { value: WeatherThemeMode; label: string }[] = [
		{ value: "location", label: "Location" },
		{ value: "system", label: "System" },
		{ value: "light", label: "Light" },
		{ value: "dark", label: "Dark" },
	];
	const isThemeChromeVisible = isVisible || isFocusWithin;

	return (
		<div
			className="absolute left-1/2 top-4 z-20 -translate-x-1/2"
			style={{ pointerEvents: isThemeChromeVisible ? "auto" : "none" }}
		>
			<motion.div
				animate={isThemeChromeVisible
					? { opacity: 1, filter: "blur(0px)", transform: "scale(1) translateY(0px)" }
					: { opacity: 0, filter: "blur(16px)", transform: "scale(0.82) translateY(-16px)" }
				}
				initial={{ opacity: 0, filter: "blur(16px)", transform: "scale(0.82) translateY(-16px)" }}
				transition={{ duration: 0.35, ease: motionEase.out }}
				aria-hidden={!isThemeChromeVisible}
				inert={!isThemeChromeVisible}
				style={{
					transformOrigin: "top center",
					willChange: "opacity, filter, transform",
				}}
				onFocusCapture={() => {
					setIsFocusWithin(true);
				}}
				onBlurCapture={(event) => {
					const nextTarget = event.relatedTarget;
					if (
						nextTarget instanceof HTMLElement &&
						event.currentTarget.contains(nextTarget)
					) {
						return;
					}
					setIsFocusWithin(false);
				}}
			>
				{/*
				 * Position GlassTabs in a relative container so the wake-lock
				 * button can hang off the right edge using absolute positioning.
				 * This keeps the tabs perfectly centered on the page.
				 */}
				<div className="relative">
					<GlassTabs
						aria-label="Theme"
						options={options}
						value={mode}
						onChange={(value) => {
							playSound("/sound/click-003.mp3");
							onChange(value);
						}}
						onHover={() => {
							playSound("/sound/click-003.mp3");
						}}
						keyboardSelectionPulseKey={keyboardSelectionPulseKey}
						onShellStretchChange={(stretchPx) => {
							// Mirror the GlassTabs shell stretch so the
							// wake-lock button stays visually attached to
							// the shell — matching the shell's right-edge
							// translation when stretched RIGHT, and being
							// gently tugged LEFT when the shell stretches
							// the other way (softer than the shell to
							// preserve a sense of elastic linkage rather
							// than a rigid bond).
							if (stretchPx >= 0) {
								wakeButtonStretchX.set(stretchPx);
							} else {
								wakeButtonStretchX.set(stretchPx * WAKE_BUTTON_LEFT_PULL_RATIO);
							}
							const ratio = Math.min(
								Math.abs(stretchPx) / WAKE_BUTTON_MAX_SHELL_STRETCH_PX,
								1,
							);
							wakeButtonScaleY.set(1 - ratio * WAKE_BUTTON_MAX_THIN_RATIO);
						}}
						onParentMagnetChange={(xPx, yPx) => {
							// Ride along with the whole-pill magnet drift
							// so the wake-lock button physically follows
							// the GlassTabs as it leans toward the
							// pointer.
							wakeButtonMagnetX.set(xPx);
							wakeButtonMagnetY.set(yPx);
						}}
					/>
					<motion.div
						className="absolute left-full top-1/2 ml-2 -translate-y-1/2"
						style={{
							x: wakeButtonX,
							y: wakeButtonMagnetY,
							scaleY: wakeButtonScaleY,
							// Anchor the squash to the vertical centerline
							// so the button thins symmetrically (matching
							// the shell's `transformOrigin: center`).
							transformOrigin: "center",
						}}
						>
							<WakeLockControl
								isTabbable={isThemeChromeVisible}
								isSupported={wakeLock.isSupported}
								isEnabled={wakeLock.isEnabled}
								isActive={wakeLock.isActive}
								status={wakeLock.status}
								statusMessage={wakeLock.statusMessage}
								error={wakeLock.error}
								onToggle={wakeLock.onToggle}
								buttonRef={wakeLock.buttonRef}
								cutoutFillColor={cutoutFillColor}
								cutoutIconFilter={cutoutIconFilter}
								noiseColor={noiseColor}
							noiseOpacity={noiseOpacity}
							noiseBlendMode={noiseBlendMode}
						/>
					</motion.div>
					</div>
				</motion.div>
			</div>
		);
}

function WakeLockControl({
	isTabbable,
	isSupported,
	isEnabled,
	isActive,
	status,
	statusMessage,
	error,
	onToggle,
	buttonRef,
	cutoutFillColor,
	cutoutIconFilter,
	noiseColor,
	noiseOpacity,
	noiseBlendMode,
}: {
	isTabbable: boolean;
	isSupported: boolean;
	isEnabled: boolean;
	isActive: boolean;
	status: WakeLockStatus;
	statusMessage: string | null;
	error: string | null;
	onToggle: () => void;
	buttonRef?: React.RefObject<HTMLButtonElement | null>;
	cutoutFillColor: string;
	cutoutIconFilter: string;
	noiseColor: string;
	noiseOpacity: number;
	noiseBlendMode: NoiseBlendMode;
}) {
	const disabled = !isSupported;
	const labelOn = "Allow screen to sleep";
	const labelOff = "Keep screen awake";
	const inlineStatusMessage = status === "waiting-for-visible" ? statusMessage : null;
	const tooltip = disabled
		? "Keep awake is not supported in this browser"
		: error ?? inlineStatusMessage ?? (isEnabled ? labelOn : labelOff);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger
					render={
						<motion.button
							type="button"
							role="switch"
							aria-checked={isEnabled}
							aria-label={tooltip}
							ref={buttonRef}
							disabled={disabled}
							whileTap={{ scale: 0.82 }}
							transition={{ type: "spring", duration: 0.4, bounce: 0.55 }}
							// Keep this in the Tab order only while the theme
							// chrome is intentionally revealed.
							tabIndex={isTabbable ? 0 : -1}
							onClick={(event) => {
								// Toggle-off uses the same dismiss cue as
								// pressing Escape in the city manager; toggle-on
								// uses the lighter click-001 tap sound.
								onToggle();
								// Pointer users can drop back to scene-level
								// shortcuts immediately after clicking. Keyboard
								// users should keep focus here so Tab continues
								// forward to the slider.
								if (event.detail > 0) {
									event.currentTarget.blur();
								}
							}}
							className={cn(
								// Clear squircle button — no opaque fill,
								// no LiquidGlass refractive shell. The
								// squircle clip alone defines the button's
								// shape, so when toggled on the Rings shader
								// reads through the clip without being washed
								// out by a translucent overlay. A 1px subtle
								// border traces the squircle outline so the
								// shape stays visible against any backdrop —
								// this replaces the border that the
								// LiquidGlass shell used to draw.
								"relative flex size-9 items-center justify-center overflow-hidden",
								// Border traces the squircle outline only in the
								// off state — when toggled on, the Rings shader
								// fills the squircle and the border would
								// compete with the lit surface.
								!isEnabled && "border border-border",
								// Keep the icon at the same subtle weight on
								// hover/active — no darkening — so the only
								// hover affordance is the squircle/shader
								// surface itself responding under the pointer.
								"transition-colors duration-normal",
								"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
								"disabled:cursor-not-allowed disabled:opacity-50",
								// Off-state icon color. When ON the icon switches
								// to `cutoutFillColor` (`var(--ds-surface)`) via
								// inline style so it reads like a hole punched
								// through the shader card, matching the time
								// digits and weather icon on the time card.
								!isEnabled && "text-icon-subtlest",
							)}
							style={{
								...GLASS_TABS_SQUIRCLE_STYLE,
								willChange: "transform",
							}}
							data-active={isActive ? "true" : undefined}
							data-error={error ? "true" : undefined}
						>
							{/*
							 * When toggled on, render the Rings shader behind
							 * the icon so the "keep awake" state reads as a
							 * lively, focused gradient at this small size.
							 * The Rings shader has tighter, higher-contrast
							 * features than LiquidGradient, so it stays
							 * visible inside the 36×36 squircle without the
							 * LiquidGlass shell washing it out.
							 */}
							{isEnabled ? (
								<span
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 overflow-hidden"
									style={GLASS_TABS_SQUIRCLE_STYLE}
								>
									<Rings
										className="h-full w-full"
										lensScale={4}
										ringSpacing={2.5}
										speed={0.25}
										ringWarpStrength={1.5}
										ringDispersion={0.2}
										edgeDisp={0.6}
										ephemeralAmp={0.06}
									/>
									<Noise
										className="absolute inset-0"
										opacity={noiseOpacity}
										grainSize={140}
										seed={7}
										color={noiseColor}
										blendMode={noiseBlendMode}
										borderRadius={0}
									/>
								</span>
							) : null}
							{isEnabled ? (
								<span
									aria-hidden="true"
									className="relative inline-flex items-center justify-center"
									style={{ filter: cutoutIconFilter }}
								>
									<Cctv
										size={16}
										className="size-4"
										style={{ color: cutoutFillColor }}
										animate
										loop
										loopDelay={800}
									/>
								</span>
							) : (
								<Cctv size={16} className="relative size-4" />
							)}
						</motion.button>
					}
				/>
				<TooltipContent sideOffset={8}>{tooltip}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function WeatherKeyboardHints({
	isVisible,
	isEditing,
	showWakeShortcut,
}: {
	isVisible: boolean;
	isEditing: boolean;
	showWakeShortcut: boolean;
}) {
	return (
		<div className="absolute bottom-0 left-1/2 z-20 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 px-4">
			<motion.div
				animate={isVisible
					? { opacity: 1, filter: "blur(0px)" }
					: { opacity: 0, filter: "blur(16px)" }
				}
				initial={{ opacity: 0, filter: "blur(16px)" }}
				transition={{ duration: 0.35, ease: motionEase.out }}
				style={{
					willChange: "opacity, filter",
					pointerEvents: isVisible ? "auto" : "none",
				}}
			>
				<Footer
					hideIcon
					// Bumped sm:gap-1 (4 px) → sm:gap-2 (8 px) so each
					// shortcut group has more breathing room now that the
					// `•` bullet separators are gone. The wrap layout uses
					// `gap-x-2 gap-y-1` to match.
					className="flex-wrap justify-center gap-x-2 gap-y-1 sm:flex-nowrap sm:gap-2"
					style={{ fontFamily: "'JetBrains Mono', monospace" }}
					>
						{/* All keyboard hints use the shadcn `Kbd` primitive
						    (`bg-muted text-muted-foreground rounded-sm px-1`) for
						    consistent styling with the rest of the app — see
						    /components/ui/kbd. The wrapping <span>s keep the
						    flex-col / flex-row responsive label layout. */}
						{/* Bullet glyph (`•`) separators removed — the
						    Footer's flex `gap-x-2 gap-y-1` rhythm already
						    visually separates each shortcut group, so the
						    bullets were redundant chrome. The aria-hidden
						    placeholder spans preserve the EXACT same flex
						    item count + gap math (each "•" was a flex item
						    that contributed `gap-x-2`); replacing them with
						    empty zero-width spans keeps the spacing rhythm
						    identical without rendering any glyph. */}
						{!isEditing ? (
							<>
								<span className="inline-flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1">
									<span className="inline-flex items-center gap-0.5">
										<Kbd className="font-sans">←</Kbd> <Kbd className="font-sans">→</Kbd>
									</span>
									<span>theme</span>
								</span>
							</>
						) : null}
						<span className="inline-flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1">
							<span className="inline-flex items-center gap-0.5">
								<Kbd className="font-sans">↑</Kbd> <Kbd className="font-sans">↓</Kbd>
							</span>
							<span>city</span>
					</span>
					<span className="inline-flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1">
						<Kbd className="font-sans">
							<ReturnIcon className="size-3.5 text-icon-subtlest" />
						</Kbd>
						update
						</span>
						{showWakeShortcut ? (
							<span className="inline-flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1">
								<Kbd className="font-sans">w</Kbd>
								<span>awake</span>
							</span>
						) : null}
						{isEditing ? (
							<span className="inline-flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1">
								<Kbd className="font-sans">ESC</Kbd> to cancel
							</span>
					) : null}
				</Footer>
			</motion.div>
		</div>
	);
}

// `CityRailEditor` subtracts this many pixels (TRACK_INSET) from the
// `width` prop internally to derive the visible rail width. Re-export
// the value here so we can compensate when sizing the slider to match
// the Humidity card width directly beneath it in the 2×2 grid.
const CITY_RAIL_TRACK_INSET = 24;

interface ResponsiveSizes {
	sliderWidth: number;
	timeWidth: number;
	humidityWidth: number;
	temperatureWidth: number;
	pillHeight: number;
	gridCellSize: number;
	timeFontPx: number;
	humidityFontPx: number;
	temperatureFontPx: number;
	weatherIconSize: number;
	labelFontPx: number;
	footnoteFontPx: number;
	labelInsetPx: number;
}

// Layout anchors describe the *target* sizes the design was authored
// against at three reference container widths. Between (and outside) those
// anchors we linearly interpolate every numeric value so the layout grows
// fluidly with whatever space the component actually has, instead of
// snapping at hard CSS breakpoints.
//
// `containerWidth` is the width of the cards row (the parent of all four
// pills + the slider), measured at runtime via `ResizeObserver`.
interface SizeAnchor extends ResponsiveSizes {
	containerWidth: number;
}

// 2×2 grid anchors — used while the container is narrow enough that the
// horizontal 4-card layout cannot fit. The container width here is the
// width of one *row* of the 2×2 grid (slider + time, or humidity + temp).
const GRID_ANCHOR_SMALL: SizeAnchor = {
	containerWidth: 320,
	sliderWidth: 110,
	timeWidth: 196,
	humidityWidth: 110,
	temperatureWidth: 196,
	pillHeight: 220,
	gridCellSize: 8,
	timeFontPx: 48,
	humidityFontPx: 44,
	temperatureFontPx: 48,
	weatherIconSize: 36,
	labelFontPx: 9,
	footnoteFontPx: 11,
	labelInsetPx: 16,
};

const GRID_ANCHOR_LARGE: SizeAnchor = {
	containerWidth: 484, // 170 + 12 (gap) + 300 + small breathing room
	sliderWidth: 170,
	timeWidth: 300,
	humidityWidth: 170,
	temperatureWidth: 300,
	pillHeight: 320,
	gridCellSize: 12,
	timeFontPx: 80,
	humidityFontPx: 72,
	temperatureFontPx: 80,
	weatherIconSize: 56,
	labelFontPx: 10,
	footnoteFontPx: 12,
	labelInsetPx: 28,
};

// Horizontal anchors — used while the container is wide enough for the
// row layout (slider + time + humidity + temperature in a single row).
// The container width here is the width of the entire row.
const ROW_ANCHOR_SMALL: SizeAnchor = {
	// 170 + 300 + 170 + 300 + 3*12 (gaps) = 976. Use a slightly smaller
	// number so we begin the row layout the moment it can geometrically
	// fit, then start scaling values up from there.
	containerWidth: 940,
	sliderWidth: 170,
	timeWidth: 300,
	humidityWidth: 170,
	temperatureWidth: 300,
	pillHeight: 320,
	gridCellSize: 12,
	timeFontPx: 80,
	humidityFontPx: 72,
	temperatureFontPx: 80,
	weatherIconSize: 56,
	labelFontPx: 10,
	footnoteFontPx: 12,
	labelInsetPx: 28,
};

const ROW_ANCHOR_LARGE: SizeAnchor = {
	// 200 + 400 + 200 + 400 + 3*12 (gaps) = 1236.
	containerWidth: 1236,
	sliderWidth: 200,
	timeWidth: 400,
	humidityWidth: 200,
	temperatureWidth: 400,
	pillHeight: 380,
	gridCellSize: 14,
	timeFontPx: 96,
	humidityFontPx: 88,
	temperatureFontPx: 96,
	weatherIconSize: 72,
	labelFontPx: 11,
	footnoteFontPx: 13,
	labelInsetPx: 40,
};

// Below this container width we drop back to the 2×2 grid layout.
// Must be >= ROW_ANCHOR_SMALL.containerWidth (940) so the cards never
// overflow their parent in row mode — otherwise `overflow-hidden` on the
// outer container clips the leftmost card (the city slider).
const ROW_LAYOUT_MIN_WIDTH = ROW_ANCHOR_SMALL.containerWidth;

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function clamp01(t: number): number {
	if (t < 0) return 0;
	if (t > 1) return 1;
	return t;
}

function interpolateSizes(
	a: SizeAnchor,
	b: SizeAnchor,
	width: number,
): ResponsiveSizes {
	const span = b.containerWidth - a.containerWidth;
	const t = span <= 0 ? 0 : clamp01((width - a.containerWidth) / span);
	const mix = (key: keyof ResponsiveSizes) =>
		lerp(a[key] as number, b[key] as number, t);
	return {
		sliderWidth: mix("sliderWidth"),
		timeWidth: mix("timeWidth"),
		humidityWidth: mix("humidityWidth"),
		temperatureWidth: mix("temperatureWidth"),
		pillHeight: mix("pillHeight"),
		gridCellSize: mix("gridCellSize"),
		timeFontPx: mix("timeFontPx"),
		humidityFontPx: mix("humidityFontPx"),
		temperatureFontPx: mix("temperatureFontPx"),
		weatherIconSize: mix("weatherIconSize"),
		labelFontPx: mix("labelFontPx"),
		footnoteFontPx: mix("footnoteFontPx"),
		labelInsetPx: mix("labelInsetPx"),
	};
}

interface FluidLayout {
	sizes: ResponsiveSizes;
	layout: "grid" | "row";
}

function computeFluidLayout(containerWidth: number): FluidLayout {
	if (containerWidth >= ROW_LAYOUT_MIN_WIDTH) {
		// Row layout: grow from ROW_ANCHOR_SMALL up to ROW_ANCHOR_LARGE.
		// `interpolateSizes` clamps `t` to [0, 1], so once the container
		// width exceeds `ROW_ANCHOR_LARGE.containerWidth` we cap at the
		// large anchor — the design stops scaling on very wide monitors
		// instead of growing unbounded.
		return {
			layout: "row",
			sizes: interpolateSizes(
				ROW_ANCHOR_SMALL,
				ROW_ANCHOR_LARGE,
				containerWidth,
			),
		};
	}
	// 2×2 grid layout — interpolate between the two grid anchors using
	// the per-row width (which is roughly half the available container
	// width once we factor in inner gaps).
	const rowWidth = containerWidth;
	return {
		layout: "grid",
		sizes: interpolateSizes(
			GRID_ANCHOR_SMALL,
			GRID_ANCHOR_LARGE,
			rowWidth,
		),
	};
}

function useFluidWeatherLayout(): {
	measureRef: React.RefObject<HTMLDivElement | null>;
	layout: FluidLayout;
} {
	// We measure the *available* width by attaching the observer to a
	// zero-height sentinel element that fills the parent. This avoids any
	// feedback loop where the cards' own intrinsic widths feed back into
	// the layout decision.
	const measureRef = React.useRef<HTMLDivElement | null>(null);
	// Default to the largest row layout on first paint to match the
	// historical desktop look and avoid a flash on first measurement.
	const [layout, setLayout] = React.useState<FluidLayout>(() =>
		computeFluidLayout(ROW_ANCHOR_LARGE.containerWidth),
	);

	React.useEffect(() => {
		const node = measureRef.current;
		if (!node || typeof ResizeObserver === "undefined") return;
		const update = (width: number) => {
			setLayout((prev) => {
				const next = computeFluidLayout(width);
				// Avoid spamming React with no-op state updates from
				// sub-pixel resize ticks.
				if (
					prev.layout === next.layout &&
					Math.abs(prev.sizes.timeWidth - next.sizes.timeWidth) < 0.5 &&
					Math.abs(prev.sizes.pillHeight - next.sizes.pillHeight) < 0.5
				) {
					return prev;
				}
				return next;
			});
		};
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				update(entry.contentRect.width);
			}
		});
		observer.observe(node);
		// Prime with the current width so we don't wait for the first
		// resize event after mount.
		update(node.getBoundingClientRect().width);
		return () => observer.disconnect();
	}, []);

	return { measureRef, layout };
}

interface WeatherTimeCardProps {
	timezone: string;
	sizes: ResponsiveSizes;
	gridColor: string;
	gridBlendMode: "multiply" | "screen";
	noiseBlendMode: NoiseBlendMode;
	noiseOpacity: number;
	noiseColor: string;
	shaderTextClass: string;
	shaderLabelColor: string;
	shaderFootnoteColor: string;
	cutoutFillColor: string;
	cutoutTextShadow: string;
	debossTextShadow: string;
	shader: ShaderConfig;
	particlesSpeedRef: React.RefObject<number>;
}

type SharedWeatherClockProps = Omit<WeatherTimeCardProps, "timezone"> & {
	clock: LocationClock;
};

function WeatherTimeCard({
	clock,
	sizes,
	gridColor,
	gridBlendMode,
	noiseBlendMode,
	noiseOpacity,
	noiseColor,
	shaderTextClass,
	shaderLabelColor,
	shaderFootnoteColor,
	cutoutFillColor,
	cutoutTextShadow,
	debossTextShadow,
	shader,
	particlesSpeedRef,
}: SharedWeatherClockProps) {
	return (
		<WidgetCard
			className="flex flex-col"
			style={{ width: sizes.timeWidth, height: sizes.pillHeight }}
			background={
				<>
					<LiquidGradient
						className="h-full w-full"
						colors={shader.timeColors}
						{...shader.time}
					/>
					{/*
					 * Particles must live in the SAME stacking context as the
					 * gradient for `mix-blend-mode: soft-light` to see the
					 * gradient as a backdrop. The overlay slot creates its
					 * own stacking context via `z-10`, which isolates blend
					 * modes — blending there would compose against empty
					 * space and render as an opaque rectangle.
					 *
					 * bgColor is 50% gray (soft-light neutral), so empty
					 * canvas pixels are identity over the gradient and only
					 * star pixels brighten it — no per-star halos.
					 */}
					<div
						aria-hidden="true"
						className="absolute inset-0"
						style={{ mixBlendMode: "soft-light" }}
					>
						<Particles
							className="h-full w-full"
							{...shader.particles}
							speedRef={particlesSpeedRef}
						/>
					</div>
				</>
			}
			overlay={
				<>
					<WidgetGridOverlay
						color={gridColor}
						blendMode={gridBlendMode}
						opacity={0.42}
						cellSize={sizes.gridCellSize}
					/>
					<Noise
						className="absolute inset-0"
						opacity={noiseOpacity}
						grainSize={140}
						seed={7}
						color={noiseColor}
						blendMode={noiseBlendMode}
					/>
				</>
			}
		>
			<div className={cn("relative flex h-full flex-col items-center justify-center", shaderTextClass)}>
				<span
					className="absolute font-mono uppercase tracking-[0.3em]"
					style={{
						color: shaderLabelColor,
						top: sizes.labelInsetPx,
						fontSize: sizes.labelFontPx,
						textShadow: debossTextShadow,
					}}
				>
					Time
				</span>
					<div
						className="flex flex-col items-center gap-0"
						style={{
							// Ark-ES display glyphs render visually higher in
							// their em-box than DotGothic16/Bitcount (used in
							// humid/temp), so nudge the time stack down a
							// touch to optically align with the other tiles.
							// Proportional to the responsive font size so the
							// offset tracks across breakpoints.
							transform: `translateY(${sizes.timeFontPx * 0.06}px)`,
						}}
					>
						<DigitDisplay
							weight={180}
							tracking={-0.04}
							style={{
								color: cutoutFillColor,
								lineHeight: 0.92,
								fontFamily: "var(--font-ark-es)",
								fontSize: sizes.timeFontPx,
								textShadow: cutoutTextShadow,
							}}
						>
							{clock.hours}
						</DigitDisplay>
						<DigitDisplay
							weight={180}
							tracking={-0.04}
							style={{
								color: cutoutFillColor,
								lineHeight: 0.92,
								fontFamily: "var(--font-ark-es)",
								fontSize: sizes.timeFontPx,
								textShadow: cutoutTextShadow,
							}}
						>
							{clock.minutes}
						</DigitDisplay>
					</div>
				<span
					className="absolute font-mono tabular-nums"
					style={{
						color: shaderFootnoteColor,
						fontFamily: "'DotGothic16', sans-serif",
						bottom: sizes.labelInsetPx,
						fontSize: sizes.footnoteFontPx,
						textShadow: debossTextShadow,
					}}
				>
					: <FlipText text={clock.seconds} />
				</span>
			</div>
		</WidgetCard>
	);
}

function WeatherDateSummary({
	clock,
}: {
	clock: LocationClock;
}) {
	const weekdayShort = clock.isReady
		? clock.weekday.slice(0, 3).toUpperCase()
		: "---";
	const monthShort = clock.isReady
		? clock.month.slice(0, 3).toUpperCase()
		: "---";

	return (
		<div
			className="text-text-subtle relative z-10 flex items-center gap-2 text-[13px] uppercase tracking-[0.36em] transition-colors duration-slow"
			style={{ fontFamily: "'BBH Bartle', sans-serif" }}
		>
			<span>{weekdayShort}</span>
			<span style={{ fontSize: 16 }}>—</span>
			<span>
				{monthShort} {clock.isReady ? clock.day : "--"}
			</span>
		</div>
	);
}

function SelectedWeatherClock({
	timezone,
	sizes,
	gridColor,
	gridBlendMode,
	noiseBlendMode,
	noiseOpacity,
	noiseColor,
	shaderTextClass,
	shaderLabelColor,
	shaderFootnoteColor,
	cutoutFillColor,
	cutoutTextShadow,
	debossTextShadow,
	shader,
	particlesSpeedRef,
	timeClassName,
	dateClassName,
	onFooterAnimationComplete,
}: WeatherTimeCardProps & {
	timeClassName?: string;
	dateClassName?: string;
	onFooterAnimationComplete?: () => void;
}) {
	const clock = useLocationClock(timezone);

	return (
		<>
			<motion.div
				className={timeClassName}
				initial={{ opacity: 0, filter: "blur(16px)", scale: 0.5, y: 140 }}
				animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }}
				transition={{
					scale: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.2 },
					y: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.2 },
					filter: { duration: 0.5, ease: motionEase.out, delay: 0.2 },
					opacity: { duration: 0.4, ease: motionEase.out, delay: 0.2 },
				}}
				style={{ willChange: "opacity, filter, transform" }}
			>
				<WeatherTimeCard
					clock={clock}
					sizes={sizes}
					gridColor={gridColor}
					gridBlendMode={gridBlendMode}
					noiseBlendMode={noiseBlendMode}
					noiseOpacity={noiseOpacity}
					noiseColor={noiseColor}
					shaderTextClass={shaderTextClass}
					shaderLabelColor={shaderLabelColor}
					shaderFootnoteColor={shaderFootnoteColor}
					cutoutFillColor={cutoutFillColor}
					cutoutTextShadow={cutoutTextShadow}
					debossTextShadow={debossTextShadow}
					shader={shader}
					particlesSpeedRef={particlesSpeedRef}
				/>
			</motion.div>

			<motion.div
				className={dateClassName}
				initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
				animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
				transition={{ type: "spring", stiffness: 160, damping: 14, mass: 0.5, delay: 0.44 }}
				style={{ willChange: "opacity, filter, transform" }}
				onAnimationComplete={onFooterAnimationComplete}
			>
				<WeatherDateSummary clock={clock} />
			</motion.div>
		</>
	);
}

export default function Weather({
	className,
}: WeatherProps) {
	const { setTheme, actualTheme } = useTheme();
	const {
		isSupported: isWakeLockSupported,
		isEnabled: isWakeLockEnabled,
		isActive: isWakeLockActive,
		status: wakeLockStatus,
		statusMessage: wakeLockStatusMessage,
		error: wakeLockError,
		toggle: toggleWakeLock,
	} = useWakeLock();
	const [pointerViewportZone, setPointerViewportZone] = React.useState<"top" | "bottom" | null>(null);
	const [isPointerOverSlider, setIsPointerOverSlider] = React.useState(false);
	const [isThemeKeyboardVisible, setIsThemeKeyboardVisible] = React.useState(false);
	const [themeNavigationPulseKey, setThemeNavigationPulseKey] = React.useState(0);
	const [openCityManagerRequestKey, setOpenCityManagerRequestKey] = React.useState(0);
	const [isCityManagerOpen, setIsCityManagerOpen] = React.useState(false);
	const [cityNavigationPulseKey, setCityNavigationPulseKey] = React.useState(0);
	const [isEntranceAnimating, setIsEntranceAnimating] = React.useState(true);
	const wakeLockButtonRef = React.useRef<HTMLButtonElement>(null);
	const themeKeyboardVisibleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const {
		cities,
		selectedIndex,
		selected,
		setSelectedIndex,
		addCity,
		removeCity,
	} = useCities();
	// Shader params are ephemeral: a fresh random roll on mount, and a new
	// roll every time the selected city changes (covers explicit commit,
	// keyboard navigation, and hover-to-select via the rail). Nothing here
	// is persisted — reloading the page produces new values.
	const [shaderConfig, setShaderConfig] = React.useState<ShaderConfig>(
		getRandomShaderConfig,
	);
	const didInitialMount = React.useRef(false);
	React.useEffect(() => {
		if (!didInitialMount.current) {
			didInitialMount.current = true;
			return;
		}
		setShaderConfig(getRandomShaderConfig());
	}, [selected.id]);

	// Particles "warp drop-in": on mount and on every city cycle, the
	// particle speed starts fast (random in [0.6, 1.0]) and eases down
	// to 0.05 over 2s via ease-out-cubic. The Particles shader reads
	// from this ref every frame, so mutating `.current` updates the
	// animation without forcing a WebGL re-init.
	const particlesSpeedRef = React.useRef(0.05);
	React.useEffect(() => {
		const startSpeed = 0.6 + Math.random() * 0.4;
		const targetSpeed = 0.05;
		const durationMs = 2000;
		const t0 = performance.now();
		particlesSpeedRef.current = startSpeed;
		let rafId = 0;
		const tick = () => {
			const t = Math.min((performance.now() - t0) / durationMs, 1);
			const eased = 1 - Math.pow(1 - t, 3);
			particlesSpeedRef.current = startSpeed + (targetSpeed - startSpeed) * eased;
			if (t < 1) rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [selected.id]);

	const { measureRef, layout: fluidLayout } = useFluidWeatherLayout();
	const sizes = fluidLayout.sizes;
	const isRowLayout = fluidLayout.layout === "row";
	const sliderOverlapMarginBottom =
		!isRowLayout
			? -Math.round(sizes.pillHeight * 0.18)
			: 0;

	const weather = useCurrentWeather(
		selected.latitude,
		selected.longitude,
		selected.timezone,
	);

	// Local "weather theme mode" with an extra "location" option that
	// defers to whether the focused city is currently day or night.
	const [weatherMode, setWeatherMode] = React.useState<WeatherThemeMode>(
		"location",
	);

	// Hydrate weatherMode from localStorage once on the client to avoid
	// SSR/hydration mismatches.
	React.useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
			if (isWeatherThemeMode(stored)) {
				setWeatherMode(stored);
			}
		} catch {
			// ignore
		}
	}, []);

	const updateWeatherMode = React.useCallback((next: WeatherThemeMode) => {
		setWeatherMode(next);
		if (typeof window !== "undefined") {
			try {
				window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
			} catch {
				// ignore
			}
		}
	}, []);

	const handleWakeLockToggle = React.useCallback(() => {
		playSound(
			isWakeLockEnabled ? "/sound/click-004.mp3" : "/sound/click-001.mp3",
		);
		void toggleWakeLock();
	}, [isWakeLockEnabled, toggleWakeLock]);

	const revealThemeControlFromKeyboard = React.useCallback(() => {
		// Reveal the top chrome before Tab focus is resolved so the hidden
		// theme radios are eligible for the next keyboard step immediately.
		flushSync(() => {
			setIsThemeKeyboardVisible(true);
		});
		if (themeKeyboardVisibleTimeoutRef.current !== null) {
			clearTimeout(themeKeyboardVisibleTimeoutRef.current);
		}
		themeKeyboardVisibleTimeoutRef.current = setTimeout(() => {
			setIsThemeKeyboardVisible(false);
			themeKeyboardVisibleTimeoutRef.current = null;
		}, 1200);
	}, []);

	React.useEffect(() => {
		return () => {
			if (themeKeyboardVisibleTimeoutRef.current !== null) {
				clearTimeout(themeKeyboardVisibleTimeoutRef.current);
			}
		};
	}, []);

	// Drive the underlying ThemeWrapper based on the selected weatherMode.
	// "location" → derive light/dark from the focused city's `isDay`.
	// "system" / "light" / "dark" → pass through to the underlying theme.
	React.useEffect(() => {
		if (weatherMode === "location") {
			setTheme(weather.isDay ? "light" : "dark");
		} else {
			setTheme(weatherMode);
		}
	}, [weatherMode, weather.isDay, setTheme]);

	React.useEffect(() => {
		if (typeof window === "undefined") return;

		const isOverSlider = (target: EventTarget | null) => {
			if (!(target instanceof Element)) return false;
			return Boolean(target.closest('[role="slider"]'));
		};

		const handlePointerMove = (event: PointerEvent) => {
			setPointerViewportZone(
				event.clientY < window.innerHeight / 2 ? "top" : "bottom",
			);
			setIsPointerOverSlider(isOverSlider(event.target));
		};

		const handlePointerLeave = () => {
			setPointerViewportZone(null);
			setIsPointerOverSlider(false);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerleave", handlePointerLeave);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerleave", handlePointerLeave);
		};
	}, []);

	// Global weather-scene keyboard shortcuts:
	// left/right step through the theme, W toggles screen wake lock,
	// up/down move between cities, and Enter opens the city manager.
	// Text inputs and focused interactive controls keep their native
	// keyboard behavior.
	React.useEffect(() => {
		if (typeof window === "undefined") return;

		const isTypingTarget = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement)) return false;
			const tag = target.tagName;
			return (
				tag === "INPUT" ||
				tag === "TEXTAREA" ||
				tag === "SELECT" ||
				target.isContentEditable
			);
		};

		const isSliderTarget = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement)) return false;
			return (
				target.getAttribute("role") === "slider" ||
				Boolean(target.closest('[role="slider"]'))
			);
		};

		const isInteractiveTarget = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement)) return false;
			return Boolean(target.closest("button, a, [role='button'], [role='radio']"));
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (isEntranceAnimating) return;
			const target = event.target;
			const typingTarget = isTypingTarget(target);
			const sliderTarget = isSliderTarget(target);
			const interactiveTarget = isInteractiveTarget(target);
			const normalizedKey = event.key.toLowerCase();
			const hasShortcutModifier = event.metaKey || event.ctrlKey || event.altKey;

			if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				if (typingTarget || sliderTarget || interactiveTarget) return;

				event.preventDefault();
				revealThemeControlFromKeyboard();
				const currentIndex = THEME_MODE_ORDER.indexOf(weatherMode);
				const safeIndex = currentIndex === -1 ? 0 : currentIndex;
				const delta = event.key === "ArrowLeft" ? -1 : 1;
				const nextIndex = Math.max(
					0,
					Math.min(safeIndex + delta, THEME_MODE_ORDER.length - 1),
				);
				if (nextIndex === safeIndex) {
					return;
				}
				playSound("/sound/click-003.mp3", 1);
				setThemeNavigationPulseKey((current) => current + 1);
				updateWeatherMode(THEME_MODE_ORDER[nextIndex]);
				return;
			}

			if (event.key === "ArrowUp" || event.key === "ArrowDown") {
				if (
					typingTarget ||
					sliderTarget ||
					interactiveTarget ||
					isCityManagerOpen
				) {
					return;
				}

				const delta = event.key === "ArrowUp" ? 1 : -1;
				const nextSelectedIndex = Math.max(
					0,
					Math.min(selectedIndex + delta, cities.length - 1),
				);
				if (nextSelectedIndex === selectedIndex) {
					return;
				}

				event.preventDefault();
				playSound("/sound/click-002.mp3", 1);
				setSelectedIndex(nextSelectedIndex);
				setCityNavigationPulseKey((current) => current + 1);
				return;
			}

			if (normalizedKey === "w") {
				if (
					event.repeat ||
					hasShortcutModifier ||
					typingTarget ||
					sliderTarget ||
					interactiveTarget ||
					isCityManagerOpen ||
					!isWakeLockSupported
				) {
					return;
				}

				event.preventDefault();
				revealThemeControlFromKeyboard();
				handleWakeLockToggle();
				if (wakeLockButtonRef.current) {
					animate(wakeLockButtonRef.current, { scale: [0.82, 1] }, { type: "spring", duration: 0.4, bounce: 0.55 });
				}
				return;
			}

			if (event.key === "Enter") {
				if (
					typingTarget ||
					sliderTarget ||
					interactiveTarget ||
					isCityManagerOpen
				) {
					return;
				}

				event.preventDefault();
				setOpenCityManagerRequestKey((current) => current + 1);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		isEntranceAnimating,
		isCityManagerOpen,
		isWakeLockEnabled,
		isWakeLockSupported,
		cities.length,
		handleWakeLockToggle,
		selectedIndex,
		setSelectedIndex,
		weatherMode,
		revealThemeControlFromKeyboard,
		updateWeatherMode,
	]);

	const isDarkTheme = actualTheme === "dark";
	const noiseBlendMode: NoiseBlendMode = isDarkTheme
		? "soft-light"
		: "multiply";
	const noiseOpacity = 0.3;
	const noiseColor = "var(--ds-text)";
	const gridColor = "color-mix(in srgb, var(--ds-text-inverse) 18%, transparent)";
	const gridBlendMode = isDarkTheme ? "multiply" : "screen";
	const shaderTextClass = "text-text-inverse";
	const shaderLabelColor = "color-mix(in srgb, var(--ds-text-inverse) 72%, transparent)";
	const shaderFootnoteColor = "color-mix(in srgb, var(--ds-text-inverse) 60%, transparent)";
	const cutoutFillColor = "var(--ds-surface)";
	const cutoutShadowColor = isDarkTheme
		? "rgb(0 0 0 / 0.36)"
		: "rgb(0 0 0 / 0.24)";
	const cutoutHighlightColor = isDarkTheme
		? "rgb(255 255 255 / 0.16)"
		: "rgb(255 255 255 / 0.12)";
	const cutoutAmbientColor = isDarkTheme
		? "rgb(0 0 0 / 0.2)"
		: "rgb(0 0 0 / 0.12)";

	// Small labels stay lightly debossed on the card surface. The hero
	// numerals and icon use the page background color so they read like
	// holes punched through the card rather than raised embossing.
	const debossTextShadow =
		"0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 38%, transparent), 0 -1px 0 color-mix(in srgb, var(--ds-text) 32%, transparent)";
	const cutoutTextShadow = [
		`-0.75px -0.75px 0 ${cutoutShadowColor}`,
		`0.75px 0.75px 0 ${cutoutHighlightColor}`,
		`1.5px 1.5px 3px ${cutoutAmbientColor}`,
	].join(", ");
	const cutoutIconFilter = [
		`drop-shadow(-0.75px -0.75px 0 ${cutoutShadowColor})`,
		`drop-shadow(0.75px 0.75px 0 ${cutoutHighlightColor})`,
		`drop-shadow(1.5px 1.5px 3px ${cutoutAmbientColor})`,
	].join(" ");
	// Smaller-scale variant for the 16×16 wake-lock eye icon. The hero
	// `cutoutIconFilter` is calibrated for the ~120px temperature glyphs
	// and the larger weather icon — at 16px those same offsets cover ~10%
	// of the silhouette and read as a heavy emboss against the busy Rings
	// shader. Halve the geometry, soften the highlight/shadow alphas, and
	// shrink the ambient blur so the icon sits *into* the squircle as a
	// subtle deboss instead of bulging.
	const cutoutShadowColorSmall = isDarkTheme
		? "rgb(0 0 0 / 0.28)"
		: "rgb(0 0 0 / 0.18)";
	const cutoutHighlightColorSmall = isDarkTheme
		? "rgb(255 255 255 / 0.12)"
		: "rgb(255 255 255 / 0.09)";
	const cutoutAmbientColorSmall = isDarkTheme
		? "rgb(0 0 0 / 0.14)"
		: "rgb(0 0 0 / 0.08)";
	const cutoutIconFilterSmall = [
		`drop-shadow(-0.4px -0.4px 0 ${cutoutShadowColorSmall})`,
		`drop-shadow(0.4px 0.4px 0 ${cutoutHighlightColorSmall})`,
		`drop-shadow(0.75px 0.75px 1.25px ${cutoutAmbientColorSmall})`,
	].join(" ");

	const temperature = formatTemperature(weather.temperatureCelsius);

	const [awakeElapsed, setAwakeElapsed] = React.useState(0);
	const awakeElapsedMsRef = React.useRef(0);
	const awakeSessionStartedAtRef = React.useRef<number | null>(null);
	const [isWakeLockReturnReminderVisible, setIsWakeLockReturnReminderVisible] = React.useState(false);
	const wakeLockReturnReminderTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const previousWakeLockStatusRef = React.useRef(wakeLockStatus);
	const isWakeLockTimerRunning =
		isWakeLockEnabled &&
		isWakeLockActive &&
		!isWakeLockReturnReminderVisible;

	const scheduleWakeLockReturnReminder = React.useCallback(() => {
		setIsWakeLockReturnReminderVisible(true);
		if (wakeLockReturnReminderTimeoutRef.current !== null) {
			clearTimeout(wakeLockReturnReminderTimeoutRef.current);
		}
		wakeLockReturnReminderTimeoutRef.current = setTimeout(() => {
			setIsWakeLockReturnReminderVisible(false);
			wakeLockReturnReminderTimeoutRef.current = null;
		}, 3000);
	}, []);

	React.useEffect(() => {
		const previousStatus = previousWakeLockStatusRef.current;
		previousWakeLockStatusRef.current = wakeLockStatus;

		if (!isWakeLockEnabled) {
			if (wakeLockReturnReminderTimeoutRef.current !== null) {
				clearTimeout(wakeLockReturnReminderTimeoutRef.current);
				wakeLockReturnReminderTimeoutRef.current = null;
			}
			setIsWakeLockReturnReminderVisible(false);
			return;
		}

		if (
			previousStatus === "waiting-for-visible" &&
			wakeLockStatus === "active" &&
			isWakeLockActive
		) {
			scheduleWakeLockReturnReminder();
			return;
		}

		if (wakeLockStatus !== "active" && isWakeLockReturnReminderVisible) {
			if (wakeLockReturnReminderTimeoutRef.current !== null) {
				clearTimeout(wakeLockReturnReminderTimeoutRef.current);
				wakeLockReturnReminderTimeoutRef.current = null;
			}
			setIsWakeLockReturnReminderVisible(false);
		}
	}, [isWakeLockActive, isWakeLockEnabled, isWakeLockReturnReminderVisible, scheduleWakeLockReturnReminder, wakeLockStatus]);

	React.useEffect(() => {
		return () => {
			if (wakeLockReturnReminderTimeoutRef.current !== null) {
				clearTimeout(wakeLockReturnReminderTimeoutRef.current);
			}
		};
	}, []);

	React.useEffect(() => {
		if (!isWakeLockEnabled) {
			awakeSessionStartedAtRef.current = null;
			awakeElapsedMsRef.current = 0;
			setAwakeElapsed(0);
			return;
		}

		if (!isWakeLockTimerRunning) {
			if (awakeSessionStartedAtRef.current !== null) {
				awakeElapsedMsRef.current += Date.now() - awakeSessionStartedAtRef.current;
				awakeSessionStartedAtRef.current = null;
			}
			setAwakeElapsed(Math.floor(awakeElapsedMsRef.current / 1000));
			return;
		}

		awakeSessionStartedAtRef.current = Date.now();
		const tick = () => {
			const sessionStartedAt = awakeSessionStartedAtRef.current;
			const sessionElapsedMs =
				sessionStartedAt === null ? 0 : Date.now() - sessionStartedAt;
			setAwakeElapsed(
				Math.floor((awakeElapsedMsRef.current + sessionElapsedMs) / 1000),
			);
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => {
			clearInterval(id);
			if (awakeSessionStartedAtRef.current !== null) {
				awakeElapsedMsRef.current += Date.now() - awakeSessionStartedAtRef.current;
				awakeSessionStartedAtRef.current = null;
			}
		};
	}, [isWakeLockEnabled, isWakeLockTimerRunning]);

	const awakeHours = String(Math.floor(awakeElapsed / 3600)).padStart(2, "0");
	const awakeMinutes = String(Math.floor((awakeElapsed % 3600) / 60)).padStart(2, "0");
	const awakeSeconds = String(awakeElapsed % 60).padStart(2, "0");
	const wakeLockWarning = isWakeLockEnabled && !isWakeLockActive
		? wakeLockStatus === "waiting-for-visible"
			? wakeLockStatusMessage
			: wakeLockError
		: isWakeLockReturnReminderVisible
			? WAKE_LOCK_VISIBLE_TAB_MESSAGE
		: null;

	const cityTitleContent = (
		<div className="text-text relative flex flex-col items-center text-center">
			<AnimatePresence initial={false}>
				{wakeLockWarning ? (
					<motion.span
						key="awake-warning"
						role="status"
						aria-live="polite"
						// Plain inline text — no yellow pill chrome
						// (border / bg / rounded-full / padding stripped).
						// Matches the awake-timer counter underneath in
						// color (`text-text`) and motion. The reminder
						// auto-dismisses after 3 s via the
						// `wakeLockReturnReminderTimeoutRef` timeout above.
						className="text-text absolute bottom-full mb-2 inline-flex max-w-[20rem] text-center text-[11px]/[15px]"
						initial={{ opacity: 0, filter: "blur(12px)", y: 8 }}
						animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
						exit={{ opacity: 0, filter: "blur(12px)", y: 8 }}
						transition={{ duration: 0.35, ease: motionEase.out }}
						style={{
							fontFamily: "'DotGothic16', sans-serif",
							letterSpacing: "0.04em",
							willChange: "opacity, filter, transform",
						}}
					>
						{wakeLockWarning}
					</motion.span>
				) : isWakeLockEnabled ? (
					<motion.span
						key="awake-timer"
						className="text-text absolute bottom-full mb-2 tabular-nums tracking-[0.08em]"
						initial={{ opacity: 0, filter: "blur(12px)", y: 8 }}
						animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
						exit={{ opacity: 0, filter: "blur(12px)", y: 8 }}
						transition={{ duration: 0.35, ease: motionEase.out }}
						style={{
							fontFamily: "'Bitcount Grid Single', sans-serif",
							fontSize: 20,
							fontWeight: 300,
							willChange: "opacity, filter, transform",
						}}
					>
						<FlipText text={awakeHours} />
						<span className="text-text-disabled">:</span>
						<FlipText text={awakeMinutes} />
						<span className="text-text-disabled">:</span>
						<FlipText text={awakeSeconds} />
					</motion.span>
				) : null}
			</AnimatePresence>
			<span
				className="text-[15px] font-medium uppercase tracking-[0.36em]"
				style={{
					letterSpacing: "0.36em",
					fontFamily: "'BBH Bartle', sans-serif",
				}}
			>
				{selected.name}
			</span>
		</div>
	);
	const cityRailEditor = (
		<CityRailEditor
			cities={cities}
			selectedIndex={selectedIndex}
			setSelectedIndex={setSelectedIndex}
			addCity={addCity}
			openRequestKey={openCityManagerRequestKey}
			onOpenChange={setIsCityManagerOpen}
			keyboardNavigationPulseKey={cityNavigationPulseKey}
			removeCity={removeCity}
			height={sizes.pillHeight}
			// CityRailEditor subtracts a 24px TRACK_INSET internally to
			// derive the visible rail width, so we add it back here to
			// make the slider's visible pill match the Humidity card
			// width directly underneath it in the 2×2 grid.
			width={sizes.sliderWidth + CITY_RAIL_TRACK_INSET}
		/>
	);

	return (
		<div
			ref={measureRef}
			className={cn(
				"bg-surface text-text relative isolate flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 pt-6 pb-0 transition-[background-color,color] duration-slow sm:gap-10 sm:pt-8 lg:gap-14",
				className,
			)}
		>
			<ThemeControl
				mode={weatherMode}
				onChange={updateWeatherMode}
				isVisible={
					isThemeKeyboardVisible ||
					(pointerViewportZone === "top" && !isPointerOverSlider)
				}
				keyboardSelectionPulseKey={themeNavigationPulseKey}
				wakeLock={{
					isSupported: isWakeLockSupported,
					isEnabled: isWakeLockEnabled,
					isActive: isWakeLockActive,
					status: wakeLockStatus,
					statusMessage: wakeLockStatusMessage,
					error: wakeLockError,
					onToggle: handleWakeLockToggle,
					buttonRef: wakeLockButtonRef,
				}}
				cutoutFillColor={cutoutFillColor}
				// Pass the small-scale cutout filter — the wake-lock eye
				// icon is 16×16, so the hero `cutoutIconFilter` (sized for
				// the ~120px temperature numerals and the larger weather
				// icon) reads as an oversized emboss against the busy
				// Rings shader at this footprint.
				cutoutIconFilter={cutoutIconFilterSmall}
				noiseColor={noiseColor}
				noiseOpacity={noiseOpacity}
				noiseBlendMode={noiseBlendMode}
			/>

				{isEntranceAnimating ? (
					<motion.div
						initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						transition={{ type: "spring", stiffness: 120, damping: 14, mass: 0.7 }}
						style={{ willChange: "opacity, filter, transform" }}
					>
						{cityTitleContent}
					</motion.div>
				) : (
					cityTitleContent
				)}

			<div
				className={cn(
					"relative z-10 justify-center",
					// Top-align in the 2×2 grid so the slider and the time
					// card share the same top edge — the slider's negative
					// `marginBottom` (used to overlap the HUMID card below)
					// would otherwise interact with `items-center` and push
					// the slider down inside its row track. In the row
					// layout we use an explicit 4-column grid so the cards
					// stay on one row and the date strip gets its own
					// centered second row. Mirror the parent stack's
					// responsive vertical gap so the title->cards spacing
					// matches the cards->date spacing.
					isRowLayout
						? "grid grid-cols-[auto_auto_auto_auto] items-center justify-center gap-x-3 gap-y-6 sm:gap-y-10 lg:gap-y-14"
						: "grid grid-cols-[auto_auto] items-start gap-2",
				)}
				>
					<SelectedWeatherClock
						timezone={selected.timezone}
						sizes={sizes}
						gridColor={gridColor}
						gridBlendMode={gridBlendMode}
						noiseBlendMode={noiseBlendMode}
						noiseOpacity={noiseOpacity}
						noiseColor={noiseColor}
						shaderTextClass={shaderTextClass}
						shaderLabelColor={shaderLabelColor}
						shaderFootnoteColor={shaderFootnoteColor}
						cutoutFillColor={cutoutFillColor}
						cutoutTextShadow={cutoutTextShadow}
						debossTextShadow={debossTextShadow}
						shader={shaderConfig}
						particlesSpeedRef={particlesSpeedRef}
						timeClassName={isRowLayout ? "col-start-2 row-start-1" : "col-start-2 row-start-1"}
						dateClassName={cn(
							isRowLayout
								? "col-span-4 row-start-2 flex justify-center"
								: "col-span-2 row-start-3 mt-4 flex justify-center sm:mt-8",
						)}
						onFooterAnimationComplete={() => setIsEntranceAnimating(false)}
					/>

				<motion.div
					className={isRowLayout ? "col-start-3 row-start-1" : "col-start-1 row-start-2"}
					initial={{ opacity: 0, filter: "blur(16px)", scaleY: 0, y: 80 }}
					animate={{ opacity: 1, filter: "blur(0px)", scaleY: 1, y: 0 }}
					transition={{
						scaleY: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.3 },
						y: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.3 },
						filter: { duration: 0.5, ease: motionEase.out, delay: 0.3 },
						opacity: { duration: 0.4, ease: motionEase.out, delay: 0.3 },
					}}
					style={{ transformOrigin: "bottom center", willChange: "opacity, filter, transform" }}
				>
					<WidgetCard
						className="flex flex-col"
						style={{ width: sizes.humidityWidth, height: sizes.pillHeight }}
						background={
							<Bands
								className="h-full w-full"
								colors={shaderConfig.colors}
								{...shaderConfig.humidity}
							/>
						}
						overlay={
							<>
								<WidgetGridOverlay
									color={gridColor}
									blendMode={gridBlendMode}
									opacity={0.42}
									cellSize={sizes.gridCellSize}
								/>
								<Noise
									className="absolute inset-0"
									opacity={noiseOpacity}
									grainSize={140}
									seed={13}
									color={noiseColor}
									blendMode={noiseBlendMode}
								/>
							</>
						}
					>
						<div className={cn("relative flex h-full flex-col items-center justify-center", shaderTextClass)}>
							<span
								className="absolute font-mono uppercase tracking-[0.3em]"
								style={{
									color: shaderLabelColor,
									top: sizes.labelInsetPx,
									fontSize: sizes.labelFontPx,
									textShadow: debossTextShadow,
								}}
							>
								Humid %
							</span>
							<div className="flex flex-col items-center gap-0">
									{weather.humidity === null ? (
										<div
											className="flex items-center justify-center"
											style={{
												width: sizes.humidityFontPx * 0.7,
												height: sizes.humidityFontPx * 0.7,
												color: cutoutFillColor,
											}}
										>
											<Spinner className="size-full" label="Loading humidity" />
										</div>
									) : (
										String(Math.round(weather.humidity)).split("").map((digit, i) => (
											<DigitDisplay
												key={i}
												weight={400}
												tracking={-0.04}
												style={{
													color: cutoutFillColor,
													lineHeight: 0.92,
													fontFamily: "'DotGothic16', sans-serif",
													fontSize: sizes.humidityFontPx,
													textShadow: cutoutTextShadow,
												}}
											>
												{digit}
											</DigitDisplay>
										))
									)}
								</div>
							<span
								className="absolute"
								style={{
									color: shaderFootnoteColor,
									fontFamily: "'DotGothic16', sans-serif",
									bottom: sizes.labelInsetPx,
									fontSize: sizes.footnoteFontPx + 1,
									textShadow: debossTextShadow,
								}}
							>
								湿度
							</span>
						</div>
					</WidgetCard>
				</motion.div>

				<motion.div
					className={isRowLayout ? "col-start-4 row-start-1" : "col-start-2 row-start-2"}
					initial={{ opacity: 0, filter: "blur(16px)", scale: 0.5, y: 140 }}
					animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }}
					transition={{
						scale: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.4 },
						y: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.4 },
						filter: { duration: 0.5, ease: motionEase.out, delay: 0.4 },
						opacity: { duration: 0.4, ease: motionEase.out, delay: 0.4 },
					}}
					style={{ willChange: "opacity, filter, transform" }}
				>
					<WidgetCard
						className="flex flex-col"
						style={{ width: sizes.temperatureWidth, height: sizes.pillHeight }}
						background={
							<WaveGradient
								className="h-full w-full"
								colors={shaderConfig.colorsTuple}
								{...shaderConfig.temperature}
							/>
						}
						overlay={
							<>
								<WidgetGridOverlay
									color={gridColor}
									blendMode={gridBlendMode}
									opacity={0.42}
									cellSize={sizes.gridCellSize}
								/>
								<Noise
									className="absolute inset-0"
									opacity={noiseOpacity}
									grainSize={140}
									seed={7}
									color={noiseColor}
									blendMode={noiseBlendMode}
								/>
							</>
						}
					>
						<div className={cn("relative flex h-full flex-col items-center justify-center", shaderTextClass)}>
							<span
								className="absolute font-mono uppercase tracking-[0.3em]"
								style={{
									color: shaderLabelColor,
									top: sizes.labelInsetPx,
									fontSize: sizes.labelFontPx,
									textShadow: debossTextShadow,
								}}
							>
								Temp °C
							</span>
							<div className="flex flex-col items-center gap-0">
									{weather.temperatureCelsius === null ? (
										<div
											className="flex items-center justify-center"
											style={{
												width: sizes.temperatureFontPx * 0.7,
												height: sizes.temperatureFontPx * 0.7,
												color: cutoutFillColor,
											}}
										>
											<Spinner className="size-full" label="Loading temperature" />
										</div>
									) : (
										<>
											<DigitDisplay
												weight={200}
												tracking={-0.04}
												style={{
													color: cutoutFillColor,
													lineHeight: 0.92,
													fontFamily: "'Bitcount Grid Single', sans-serif",
													fontSize: sizes.temperatureFontPx,
													textShadow: cutoutTextShadow,
												}}
											>
												{temperature}
											</DigitDisplay>
											<div
												className="-mt-1 flex items-center gap-1"
												style={{ filter: cutoutIconFilter }}
											>
												<WeatherIcon
													weatherCode={weather.weatherCode}
													isDay={weather.isDay}
													size={sizes.weatherIconSize}
													style={{ color: cutoutFillColor }}
												/>
											</div>
										</>
									)}
								</div>
							<span
								className="absolute"
								style={{
									color: shaderFootnoteColor,
									fontFamily: "'DotGothic16', sans-serif",
									bottom: sizes.labelInsetPx,
									fontSize: sizes.footnoteFontPx + 1,
									textShadow: debossTextShadow,
								}}
							>
								温度
							</span>
						</div>
					</WidgetCard>
				</motion.div>

				{isEntranceAnimating ? (
					<motion.div
						className={isRowLayout ? "order-1" : "col-start-1 row-start-1"}
						initial={{ opacity: 0, filter: "blur(16px)", scaleY: 0, y: 80 }}
						animate={{ opacity: 1, filter: "blur(0px)", scaleY: 1, y: 0 }}
						transition={{
							scaleY: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.1 },
							y: { type: "spring", stiffness: 180, damping: 12, mass: 0.6, delay: 0.1 },
							filter: { duration: 0.5, ease: motionEase.out, delay: 0.1 },
							opacity: { duration: 0.4, ease: motionEase.out, delay: 0.1 },
						}}
						style={{
							marginBottom: sliderOverlapMarginBottom,
							transformOrigin: "bottom center",
							pointerEvents: "none",
						}}
					>
						{cityRailEditor}
					</motion.div>
				) : (
					<div
						// IMPORTANT: do NOT add `relative z-N` (or any
						// stacking-context-creating CSS) to this wrapper. The
						// slider's `LiquidGlass` shell uses
						// `backdrop-filter: url(#filter)` to displace whatever
						// is painted *behind* it (the chromatic-dispersion
						// effect). `backdrop-filter` only samples content from
						// the slider's own ancestor stacking contexts — the
						// moment this wrapper becomes its own stacking context
						// (`position: relative; z-index: …`,
						// `will-change: transform`, `transform`, `filter`,
						// `isolation: isolate`, etc.), the HUMID card sibling
						// below the slider gets clipped out of the backdrop
						// snapshot and only the page background is refracted.
						// Keep the settled wrapper layout-only so the glass can
						// sample the overlapping HUMID card beneath it.
						className={isRowLayout ? "col-start-1 row-start-1" : "col-start-1 row-start-1"}
						style={{ marginBottom: sliderOverlapMarginBottom }}
					>
						{cityRailEditor}
					</div>
				)}
			</div>

			<WeatherKeyboardHints
				isVisible={pointerViewportZone === "bottom"}
				isEditing={isCityManagerOpen}
				showWakeShortcut={!isCityManagerOpen && isWakeLockSupported}
			/>
		</div>
	);
}
