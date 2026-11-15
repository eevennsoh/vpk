export interface PropDefinition {
	name: string;
	type: string;
	default?: string;
	required?: boolean;
	description: string;
}

export interface SubComponentDoc {
	name: string;
	description: string;
	props?: PropDefinition[];
}

export interface ExampleDefinition {
	title: string;
	id?: string;
	description?: string;
	demoSlug: string;
	badge?: { label: string; variant: string };
	/**
	 * Section heading for long example lists. Consecutive examples with the same group render
	 * under one heading (with its own anchor); ungrouped examples render without one.
	 */
	group?: string;
}

export interface ExternalLinkDefinition {
	label: string;
	url: string;
}

export type DemoContentWidth = "fit" | "full";
/**
 * Examples support one extra mode beyond the shared widths. `"bleed"` renders
 * an example in the same edge-to-edge frame the Preview section uses, so a wide
 * demo (a board, a three-column timeline) is exactly as wide in both places.
 * `"full"` only stretches content inside the standard shell, which keeps that
 * shell's 24px inset — a deliberate contract other components rely on.
 */
export type DemoExamplesContentWidth = DemoContentWidth | "bleed";
export type DemoPreviewHeight = "fixed" | "fit" | "default";

export interface DemoLayout {
	previewContentWidth?: DemoContentWidth;
	previewHeight?: DemoPreviewHeight;
	examplesContentWidth?: DemoExamplesContentWidth;
	/**
	 * `"near-viewport"` mounts each example only when it scrolls near the viewport, and keeps
	 * it mounted afterwards. Opt in for pages whose examples are expensive to mount all at
	 * once (the chart gallery mounts 77 recharts charts); the default mounts every example.
	 */
	examplesMount?: "eager" | "near-viewport";
}

export interface ComponentDetail {
	description: string;
	/** Exported API name when the display name uses different capitalization. */
	apiName?: string;
	importStatement?: string;
	usage?: string;
	props?: PropDefinition[];
	subComponents?: SubComponentDoc[];
	examples?: ExampleDefinition[];
	demoLayout?: DemoLayout;
	adsUrl?: string;
	adsLinks?: ExternalLinkDefinition[];
}
