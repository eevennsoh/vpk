"use client";

import { ROVO_SHADER_COLOR_HEX } from "@/lib/rovo-colors";
import Noise, { type NoiseBlendMode } from "./shaders/noise";

const [PREVIEW_BLUE, PREVIEW_ORANGE, PREVIEW_PURPLE, PREVIEW_LIME] =
	ROVO_SHADER_COLOR_HEX;

const PREVIEW_BACKGROUND = `
	radial-gradient(circle at 18% 18%, ${PREVIEW_ORANGE} 0, transparent 28%),
	radial-gradient(circle at 78% 24%, ${PREVIEW_PURPLE} 0, transparent 30%),
	radial-gradient(circle at 54% 86%, ${PREVIEW_LIME} 0, transparent 26%),
	linear-gradient(135deg, ${PREVIEW_BLUE} 0%, #101214 58%, #050608 100%)
`;

const PREVIEW_SWATCHES = [
	"bg-blue-600",
	"bg-orange-300",
	"bg-purple-500",
	"bg-lime-400",
] as const;

type NoisePreviewSurfaceProps = Readonly<{
	opacity: number;
	grainSize: number;
	seed: number;
	color: string;
	blendMode: NoiseBlendMode;
}>;

export function NoisePreviewSurface({
	opacity,
	grainSize,
	seed,
	color,
	blendMode,
}: NoisePreviewSurfaceProps) {
	return (
		<div
			className="relative isolate w-full overflow-hidden bg-bg-neutral-bold text-text-inverse"
			style={{ height: 400, background: PREVIEW_BACKGROUND }}
		>
			<div className="relative z-10 grid h-full grid-cols-1 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.7fr)] sm:p-6">
				<div className="flex min-w-0 flex-col justify-end rounded-lg border border-border-inverse/20 bg-bg-neutral-bold/65 p-5 shadow-sm backdrop-blur-sm">
					<div className="grid grid-cols-4 gap-2">
						{PREVIEW_SWATCHES.map((className) => (
							<div
								key={className}
								className={`${className} h-12 rounded-md`}
							/>
						))}
					</div>
				</div>
				<div className="hidden min-w-0 grid-rows-3 gap-3 sm:grid">
					<div className="rounded-lg border border-border-inverse/20 bg-surface/85" />
					<div className="rounded-lg border border-border-inverse/20 bg-bg-neutral-bold/70" />
					<div className="rounded-lg border border-border-inverse/20 bg-primary/80" />
				</div>
			</div>
			<Noise
				className="absolute inset-0 z-20"
				opacity={opacity}
				grainSize={grainSize}
				seed={seed}
				color={color}
				blendMode={blendMode}
			/>
		</div>
	);
}
