"use client";

import { useEffect, useImperativeHandle, useRef, type ComponentProps, type Ref } from "react";
import { createMeshShader, createNamedropShader, createShader, playSweep, resolvePalette, type ShaderController, type SweepHandle, type SweepOptions } from "glimm";
import { cn } from "@/lib/utils";

export type GlimmRenderer = "sweep" | "mesh" | "namedrop";
export type GlimmSweepHandle = { play: (change?: () => void) => void; cancel: () => void };
export type GlimmSweepProps = Omit<ComponentProps<"div">, "ref"> & {
	options?: SweepOptions;
	renderer?: GlimmRenderer;
	feather?: number | "auto";
	ref?: Ref<GlimmSweepHandle>;
};

/** A contained decorative sweep. The change occurs at the configured midpoint. */
export function GlimmSweep({ children, className, options, renderer = "sweep", feather = "auto", ref, ...props }: GlimmSweepProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef<{ controller: ShaderController; handle: SweepHandle } | null>(null);

	useImperativeHandle(ref, () => {
		const cancel = () => {
			activeRef.current?.handle.cancel();
			activeRef.current?.controller.setAlpha(0);
			activeRef.current?.controller.destroy();
			activeRef.current?.controller.canvas.remove();
			activeRef.current = null;
		};
		return {
			cancel,
			play(change) {
				cancel();
				const root = rootRef.current;
				if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
					change?.();
					options?.onMidpoint?.();
					options?.onComplete?.();
					return;
				}
				const canvas = document.createElement("canvas");
				canvas.setAttribute("aria-hidden", "true");
				canvas.className = "pointer-events-none absolute inset-0 size-full";
				root.appendChild(canvas);
				const common = { canvas, palette: resolvePalette(options?.palette), direction: options?.direction, bandTight: options?.bandTight };
				const controller = renderer === "mesh" ? createMeshShader({ ...common, feather }) : renderer === "namedrop" ? createNamedropShader({ ...common, travelMode: 1 }) : createShader({ ...common, feather });
				if (!controller) {
					canvas.remove();
					change?.();
					options?.onMidpoint?.();
					options?.onComplete?.();
					return;
				}
				const handle = playSweep(controller, { ...options, onMidpoint: async () => { change?.(); await options?.onMidpoint?.(); } });
				activeRef.current = { controller, handle };
				void handle.done.then(() => {
					if (activeRef.current?.handle === handle) {
						controller.destroy();
						canvas.remove();
						activeRef.current = null;
					}
				});
			},
		};
	}, [feather, options, renderer]);

	useEffect(() => () => {
		activeRef.current?.handle.cancel();
		activeRef.current?.controller.destroy();
		activeRef.current?.controller.canvas.remove();
		activeRef.current = null;
	}, []);

	return <div ref={rootRef} className={cn("relative isolate overflow-hidden", className)} {...props}>
		{children}
	</div>;
}

export { GlimmProvider, GlimmScope, GlimmScope as Glimm, useGlimm, usePageEffect, supportsHtmlInCanvas } from "glimm/react";
export type { GlimmDefaults, GlimmScopeHandle, GlimmScopeHandle as GlimmHandle, GlimmScopeProps, GlimmScopeProps as GlimmProps, SweepOptions, Palette, PaletteName, Direction, EasingName } from "glimm/react";
export { ACCENTS, EASINGS, PALETTES, accentChain, accentPair, cubicBezier, shuffleAccentPalette } from "glimm";
export { GlimmScope as default } from "glimm/react";
