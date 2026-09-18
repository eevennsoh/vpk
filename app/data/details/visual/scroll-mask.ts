import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SCROLL_MASK_DETAIL: ComponentDetail = {
		description: "Scrollable menu surface that fades overflow content only along edges with content scrolled past them while preserving a full-opacity scrollbar gutter. Always make the top fade shorter: it uses half the bottom fade depth so items disappear more abruptly, making the transition feel crisper and more natural.",
		importStatement: `import { ScrollMask } from "@/components/visual/scroll-mask";`,
		usage: `<ScrollMask
	header={<div>Workspace menu</div>}
	footer={<div>Actions</div>}
>
	{items.map((item) => (
		<button key={item.id} type="button">{item.label}</button>
	))}
</ScrollMask>`,
		props: [
			{ name: "children", type: "React.ReactNode", description: "Scrollable content rendered between the optional sticky header and footer." },
			{ name: "header", type: "React.ReactNode", description: "Optional sticky top content inside the scroll viewport." },
			{ name: "footer", type: "React.ReactNode", description: "Optional sticky bottom content inside the scroll viewport." },
			{ name: "fadeSize", type: "number | string", default: `"32px"`, description: "Height of the bottom fade band. The top fade is always half as tall (16px by default). Numbers resolve to pixels; CSS lengths and tokens retain the same ratio." },
			{ name: "edgeBlur", type: "boolean", default: "false", description: "Layer a progressive backdrop blur over the fade bands so overflow content softly blurs out toward the edges instead of only fading." },
			{ name: "scrollbarWidth", type: "number | string", default: `"10px"`, description: "Width reserved as a separate opaque mask track for the scrollbar gutter." },
			{ name: "viewportClassName", type: "string", description: "Class names applied to the masked scroll viewport." },
			{ name: "viewportStyle", type: "React.CSSProperties", description: "Inline styles merged onto the masked scroll viewport after the generated mask style." },
			{ name: "className", type: "string", description: "Class names applied to the outer menu surface." },
		],
	};
