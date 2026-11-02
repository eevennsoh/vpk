import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TWG_LOADER_DETAIL: ComponentDetail = {
	description:
		"The Teamwork Graph branded loading indicator. Four brand-colored dots burst out from the center, then a multi-color snake continuously draws between them while the logo rotates through patterns. Ported from the Atlassian Teamwork Graph microsite LoadingSpinner; it mirrors the @atlaskit/spinner size API and respects reduced-motion preferences.",
	usage: `import { TWGLoader } from "@/components/ui-custom/twg-loader";

<TWGLoader />
<TWGLoader size="large" label="Loading Teamwork Graph" />`,
	props: [
		{
			name: "size",
			type: '"small" | "medium" | "large" | "xlarge"',
			default: '"medium"',
			description: "Visual size (16 / 24 / 32 / 64px). Mirrors @atlaskit/spinner.",
		},
		{
			name: "active",
			type: "boolean",
			default: "true",
			description: "Spins the branded snake while true. When false, the rings ease into a static subtle graph and stay there until loading starts again.",
		},
		{
			name: "label",
			type: "string",
			default: '"Loading"',
			description: "Accessible label announced to assistive technology while the logo is spinning.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the wrapping element.",
		},
		{
			name: "testId",
			type: "string",
			description: "Optional test id applied to the wrapping element.",
		},
	],
	examples: [
		{ title: "Sizes", description: "Preset sizes from small through xlarge.", demoSlug: "twg-loader-demo-sizes" },
		{ title: "On dark surface", description: "Rendered against the microsite's dark page chrome.", demoSlug: "twg-loader-demo-on-dark" },
	],
};
