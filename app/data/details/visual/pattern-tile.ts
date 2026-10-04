import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PATTERN_TILE_DETAIL: ComponentDetail = {
		description: "VPK CSS background pattern tile generator with 21 pattern types, two-color palette, blend/fill controls, grid stroke customization, and optional tile animation.",
		importStatement: `import PatternTile from "@/components/website/demos/visual/pattern-tile";`,
		usage: `<PatternTile
	patternType="grid"
	front="#FFFFFF"
	back="#22DDDD"
	scale={10}
	stroke={{ style: "dashed", width: 1, dash: 6, gap: 6 }}
	fill="tile"
/>`,
		props: [
			{ name: "patternType", type: `"grid" | "wave-lines" | "clouds" | "wiggle" | "groovy" | "plus" | "circles" | "rectangles" | "lines" | "lines-vertical" | "diagonal" | "diagonal-two" | "blocks" | "wave" | "zigzag" | "polka" | "rhombus" | "stars" | "stars-two" | "paper" | "crosses"`, default: `"wave-lines"`, description: "Pattern preset used to build the CSS background image." },
			{ name: "front", type: "string", default: `"#FFFFFF"`, description: "Foreground pattern color." },
			{ name: "back", type: "string", default: `"#22DDDD"`, description: "Background color. Can be `transparent`." },
			{ name: "scale", type: "number", default: "10", description: "Size multiplier for the generated pattern tiles." },
			{ name: "gridAlignment", type: `"edge" | "balanced"`, default: `"edge"`, description: "For tiled stroke grids, balanced fits whole cells to the surface and places lines at cell centers, giving equal half-cell spacing at opposite edges." },
			{ name: "stroke", type: `{ style?: "solid" | "dashed"; width?: number; dash?: number; gap?: number; dashArray?: string; dashOffset?: number; lineCap?: "butt" | "round" | "square"; lineJoin?: "miter" | "round" | "bevel"; miterLimit?: number }`, description: "Optional grid stroke settings. When `patternType=\"grid\"`, customizes solid or dashed stroke rendering; `dashArray` accepts CSS stroke-dasharray values and overrides `dash`/`gap`." },
			{ name: "radius", type: "number", default: "0", description: "Border radius applied to the pattern surface." },
			{ name: "opacity", type: "number", default: "1", description: "Overall pattern opacity." },
			{ name: "blendMode", type: `"normal" | "darken" | "multiply" | "color-burn" | "lighten" | "screen" | "plus-lighter" | "color-dodge" | "overlay" | "soft-light" | "hard-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity"`, default: `"normal"`, description: "CSS background blend mode. `normal` lets pattern-specific defaults apply." },
			{ name: "fill", type: `"fill" | "fit" | "stretch" | "tile"`, default: `"tile"`, description: "How the generated background image fills the container." },
			{ name: "position", type: `"top-left" | "top-center" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom-center" | "bottom-right"`, default: `"center"`, description: "Background position for non-tile fills." },
			{ name: "shouldAnimate", type: "boolean", default: "false", description: "Enables looping background-position animation for animatable tiled patterns." },
			{ name: "direction", type: `"left" | "right" | "top" | "bottom"`, default: `"left"`, description: "Scroll direction for non-wiggle animated patterns." },
			{ name: "diagonal", type: "boolean", default: "true", description: "Diagonal direction toggle for wiggle animation." },
			{ name: "duration", type: "number", default: "5", description: "Animation loop duration in seconds." },
			{ name: "className", type: "string", description: "Optional class names applied to the pattern surface." },
			{ name: "style", type: "React.CSSProperties", description: "Inline styles merged onto the pattern surface." },
		],
	};
