"use client";

import { RovoCursorTrackingIcon } from "@/components/projects/shared/components/rovo-cursor-tracking-icon";
import { LiveWaveform } from "@/components/ui-custom/live-waveform";
import { RovoCursor } from "@/components/ui-custom/rovo-cursor";
import { useTheme } from "@/components/utils/theme-wrapper";
import { LiquidMetal } from "@/components/visual/liquid-metal";
import { ROVO_WAVEFORM_COLOR_CSS_VARS } from "@/lib/rovo-colors";
import { cn } from "@/lib/utils";
import AudioWaveformIcon from "@atlaskit/icon-lab/core/audio-waveform";

/**
 * Soft top highlight + bottom shadow so flat glyphs read as embossed on the
 * chrome face (voice icon idle glyph + the cursor-rail tracking icon).
 */
const EMBOSS_FILTER =
	"drop-shadow(0 -0.5px 0 rgba(255,255,255,0.65)) drop-shadow(0 0.75px 0.75px rgba(0,0,0,0.35))";

interface CursorVoiceControlProps {
	/** Whether cursor (clicky) mode is on. */
	clickyActive: boolean;
	/** Whether a realtime voice session is connected (connecting/listening/speaking). */
	voiceActive: boolean;
	/** Whether the mic is actively capturing the user's speech. */
	listening: boolean;
	/** Whether the dispatched team is now working — swaps the cursor glyph to the rainbow painting cursor. */
	working: boolean;
	micStream: MediaStream | null;
	onToggleCursor: () => void;
	onToggleVoice: () => void;
	/** Forwarded onto the voice button so the parent can measure its rect (the orbit's center). */
	voiceButtonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * The Cursors art's always-visible cursor + voice rail.
 *
 * The voice button is a liquid-metal chrome circle (the repo's `LiquidMetal`
 * component); its idle glyph and the cursor-rail tracking icon wear a subtle
 * emboss so flat glyphs read as pressed into the chrome. The active segment
 * has a dark (neutral-bold) background that grows right-to-left to cover the
 * cursor when cursor mode turns on. Once the team is `working`, the cursor
 * glyph becomes the rainbow painting cursor (the team itself now renders as
 * 3D orbiting satellites around the voice button — see `CursorSceneOrbit` —
 * not as a rail reveal).
 */
export function CursorVoiceControl({
	clickyActive,
	voiceActive,
	listening,
	working,
	micStream,
	onToggleCursor,
	onToggleVoice,
	voiceButtonRef,
}: Readonly<CursorVoiceControlProps>) {
	const { actualTheme } = useTheme();

	return (
		<div className="relative flex h-9 w-[68px] items-center justify-center overflow-hidden rounded-lg">
			<span aria-hidden="true" className="absolute inset-0 rounded-lg bg-bg-neutral" />
			{/* Dark background pinned to the right (voice) button. Turning on cursor mode
			    grows its width leftward so it extends to cover the cursor too. */}
			<span
				aria-hidden="true"
				className={cn(
					"absolute top-0.5 right-0.5 bottom-0.5 rounded-md bg-bg-neutral-bold shadow-sm transition-[width] duration-medium ease-in-out motion-reduce:transition-none",
					clickyActive || working ? "w-16" : "w-8",
				)}
			/>
			<div className="relative z-10 flex h-8 w-16 shrink-0 items-center gap-0">
				<button
					type="button"
					aria-label="Rovo cursor"
					aria-pressed={clickyActive}
					onClick={onToggleCursor}
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent p-0 outline-none transition-colors hover:opacity-90 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
						clickyActive ? "text-text-inverse" : "text-icon-subtle",
					)}
				>
					{working ? (
						<RovoCursor state="painting" size={20} />
					) : (
						<span className="inline-flex" style={{ filter: EMBOSS_FILTER }}>
							<RovoCursorTrackingIcon active={clickyActive} />
						</span>
					)}
				</button>
				{/* variant="button" (not "circle") — the circle variant forces a true
				    circle and ignores borderRadius; the video reference is a rounded
				    square. The chrome ring paints over the wrapper's own face, so the
				    face background lives here (mirrors liquid-metal-demo's host). */}
				<LiquidMetal
					variant="button"
					preset="silver"
					theme={actualTheme}
					borderRadius={6}
					strength={0.9}
					ringCssPx={2.5}
					normalizeHostStyles={false}
					className="relative isolate inline-flex size-8 shrink-0 items-center justify-center overflow-hidden bg-surface-raised shadow-sm"
				>
					<button
						ref={voiceButtonRef}
						type="button"
						aria-label={voiceActive ? "Stop live voice" : "Start live voice"}
						aria-pressed={voiceActive}
						onClick={onToggleVoice}
						className="flex size-full shrink-0 items-center justify-center overflow-hidden rounded-md p-0 text-icon outline-none transition-colors hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80"
					>
						{voiceActive ? (
							<span className="flex h-full w-4 shrink-0 items-center">
								<LiveWaveform
									active={listening}
									barColor="currentColor"
									barColors={[...ROVO_WAVEFORM_COLOR_CSS_VARS]}
									barCount={4}
									barGap={2}
									barHeightScale={1}
									barOpacityMax={1}
									barOpacityMin={1}
									barWidth={2}
									barRadius={0}
									className="min-h-0 min-w-0 flex-1"
									fadeEdges={false}
									fftSize={512}
									height="100%"
									mediaStream={listening ? micStream : null}
									mode="static"
									processing={voiceActive && !listening}
									sensitivity={2.4}
									smoothingTimeConstant={0.35}
								/>
							</span>
						) : (
							<span className="inline-flex" style={{ filter: EMBOSS_FILTER }}>
								<AudioWaveformIcon label="" />
							</span>
						)}
					</button>
				</LiquidMetal>
			</div>
		</div>
	);
}
