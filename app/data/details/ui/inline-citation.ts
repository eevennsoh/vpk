import type { ComponentDetail } from "@/app/data/component-detail-types";

export const INLINE_CITATION_DETAIL: ComponentDetail = {
	description:
		"A source that sits in the sentence it supports. Built on Hover Card with a keyboard-focusable secondary Button trigger, an optional carousel for several sources, and source links that open in a new tab.",
	usage: `import {
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
} from "@/components/ui/inline-citation";

<InlineCitationCard>
  <InlineCitationCardTrigger sources={[url]} />
  <InlineCitationCardBody className="w-64 p-2.5">
    <InlineCitationSource title={title} url={url} description={description} />
  </InlineCitationCardBody>
</InlineCitationCard>

// AI SDK: a source-url part is the citation. Set sendSources: true on
// toUIMessageStreamResponse(), then read the parts. title is optional;
// fall back to the URL's hostname.
const sources = message.parts.filter((part) => part.type === "source-url");`,
	props: [
		{
			name: "sources",
			type: "string[]",
			required: true,
			description: "Array of source URLs displayed on InlineCitationCardTrigger. The first URL hostname (without www.) is the button label; additional sources show as a +N count.",
		},
		{
			name: "delay",
			type: "number",
			default: "10",
			description: "InlineCitationCardTrigger hover delay in milliseconds before the card opens.",
		},
		{
			name: "closeDelay",
			type: "number",
			default: "100",
			description: "InlineCitationCardTrigger delay in milliseconds before the card closes after the pointer leaves.",
		},
		{
			name: "title",
			type: "string",
			description: "Source title displayed in InlineCitationSource.",
		},
		{
			name: "url",
			type: "string",
			description: "Source URL linked from InlineCitationSource by hostname. The link opens in a new tab and announces \"(opens in a new tab)\" to screen readers.",
		},
		{
			name: "description",
			type: "string",
			description: "Brief source description displayed in InlineCitationSource.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional CSS classes applied to any sub-component.",
		},
	],
	subComponents: [
		{ name: "InlineCitation", description: "Root inline container grouping text and citation badge." },
		{ name: "InlineCitationText", description: "Text span that highlights on group hover." },
		{ name: "InlineCitationCard", description: "HoverCard root that owns the open state." },
		{ name: "InlineCitationCardTrigger", description: "HoverCardTrigger rendered as a secondary compact Button (keyboard-focusable), showing the hostname and source count from the sources prop." },
		{ name: "InlineCitationCardBody", description: "HoverCardContent panel (w-80, no padding, so carousel items own their spacing)." },
		{ name: "InlineCitationCarousel", description: "Carousel wrapper with internal API context for multi-source navigation." },
		{ name: "InlineCitationCarouselContent", description: "Carousel content container." },
		{ name: "InlineCitationCarouselItem", description: "Individual carousel slide for a single source." },
		{ name: "InlineCitationCarouselHeader", description: "Navigation header with prev/next buttons and index indicator." },
		{ name: "InlineCitationCarouselIndex", description: "Position indicator displaying current/total (e.g., 1/3)." },
		{ name: "InlineCitationCarouselButtons", description: "ButtonGroup wrapper that joins the prev/next navigation arrows into a connected control." },
		{ name: "InlineCitationCarouselPrev", description: "Previous source navigation button." },
		{ name: "InlineCitationCarouselNext", description: "Next source navigation button." },
		{ name: "InlineCitationSource", description: "Source title, description, and a hostname link to the URL that opens in a new tab." },
		{ name: "InlineCitationQuote", description: "Blockquote for source excerpts with left border styling." },
	],
	examples: [
		{ title: "With carousel", description: "Multi-source citation with carousel navigation, descriptions, and a quote.", demoSlug: "inline-citation-demo-with-carousel" },
		{ title: "Basic", description: "Inline citation trigger without a hover card body, showing the +N source count.", demoSlug: "inline-citation-demo-basic" },
		{ title: "Single source", description: "Single-source citation with description and quote excerpt.", demoSlug: "inline-citation-demo-single-source" },
	],
};
