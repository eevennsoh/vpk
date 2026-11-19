import type { ComponentDetail } from "@/app/data/component-detail-types";

export const DISTORTION_WAVES_DETAIL: ComponentDetail = {
	description: "Distortion wave from Jakub Antalik's distortion-waves (libraries.dev/waves). A colourful WebGL2 front opens from a button, an edge or an avatar and carries one view into another, bending the live DOM with a soft swell, progressive blur, chromatic aberration, a glowing rim and drifting dots. Vertical, horizontal and center types each ship tuned defaults; every timing, lens, edge and dot number is adjustable. Falls back to a crossfade without WebGL2 or under reduced motion.",
	importStatement: `import { DistortionWave } from "@/components/visual/distortion-waves";`,
	usage: `const [paid, setPaid] = useState(false);
const payButton = useRef<HTMLButtonElement>(null);

<DistortionWave
	revealed={paid}
	source={payButton}
	revealedContent={<Summary />}
	overlay={
		<Button ref={payButton} onClick={() => setPaid(true)}>
			Pay now
		</Button>
	}
	className="w-[360px] overflow-hidden rounded-3xl"
>
	<Cart />
</DistortionWave>`,
	demoLayout: { previewContentWidth: "full", previewHeight: "fit" },
	examples: [
		{ title: "Vertical", description: "Rises from a checkout button and leaves a receipt behind.", demoSlug: "distortion-waves-demo-vertical" },
		{ title: "Horizontal", description: "Sweeps right from a tall tab on the left edge.", demoSlug: "distortion-waves-demo-horizontal" },
		{ title: "Center", description: "A ring that opens from an avatar.", demoSlug: "distortion-waves-demo-center" },
		{ title: "Sunset palette", description: "The vertical wave with the sunset palette.", demoSlug: "distortion-waves-demo-sunset" },
		{ title: "Single view", description: "No revealedContent: play() carries the card into itself and onFinish confirms the save.", demoSlug: "distortion-waves-demo-single-view" },
	],
	props: [
		{ name: "children", type: "React.ReactNode", description: "The first view the wave passes over. Give it an opaque background." },
		{ name: "revealedContent", type: "React.ReactNode", description: "The view the wave leaves behind. Without it the wave carries children into themselves." },
		{ name: "overlay", type: "React.ReactNode", description: "Stays above both views, unbent: the button that starts the wave, a close control. Its children take clicks." },
		{ name: "revealed", type: "boolean", description: "true sends the wave out; false runs it back, faster, into the source. Omit to drive the wave with play() alone." },
		{ name: "type", type: `"vertical" | "horizontal" | "center"`, default: `"vertical"`, description: "Front shape and the tuned defaults that go with it." },
		{ name: "source", type: "Element | RefObject<Element> | Rect", description: "Where the wave opens from. Defaults to the button last pressed inside the element." },
		{ name: "focus", type: "{ x: number; y: number } | null", description: "Point the front leans toward, in the element's CSS pixels. Defaults to the last press on the source." },
		{ name: "palette", type: `"colorful" | "green" | "ocean" | "sunset" | "mono" | string | Palette`, description: "Wave colours: a named palette, one #RRGGBB colour, or explicit colours. Defaults to the type's own." },
		{ name: "waveStyle", type: "Partial<WaveStyle>", description: "Overrides over the type defaults: timing (travel, anticipation, returnSpeed…), lens (amplitude, lensWidth, aberration, blur…), edges (rimWidth, hairline*…) and dots (particleCount, particleSize…). Lengths are points of a 393 × 852 screen." },
		{ name: "scale", type: `number | "auto"`, default: `"auto"`, description: "CSS pixels per point. Auto sizes the wave to the element." },
		{ name: "cornerRadius", type: "number", description: "Radius the edge colour follows. Defaults to the element's border radius." },
		{ name: "scrub", type: "number | null", description: "Holds the wave at this progress, 0–1, instead of playing." },
		{ name: "live", type: `boolean | "animations"`, default: "true", description: "Whether the picture follows the views while the wave is out. \"animations\" also follows CSS animations, at a cost." },
		{ name: "capture", type: "boolean | CaptureFunction", default: "true", description: "How the element is pictured for the lens. false draws the colour alone." },
		{ name: "prewarm", type: "boolean", default: "true", description: "Take the first picture when the browser is idle after mount." },
		{ name: "resolution", type: "number", description: "Canvas pixels per CSS pixel. Defaults to the display's." },
		{ name: "reducedMotion", type: `"system" | "always" | "never"`, default: `"system"`, description: "When to crossfade instead of running the wave." },
		{ name: "onFinish", type: "(revealed: boolean) => void", description: "Called once the wave has left and the edges have cleared. Not called for a reversed run." },
		{ name: "ref", type: "React.Ref<DistortionWaveHandle>", description: "Imperative handle: play({ source, focus }), reverse(), reset(), prepare()." },
	],
};
