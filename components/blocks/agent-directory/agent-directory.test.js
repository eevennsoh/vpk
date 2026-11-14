const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Agent Directory cards render the shared EntityCardAgentCard with overlay elevation", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const entityAgentSource = readProjectFile("components/ui-custom/entity-card/agent.tsx");

	// Cards are delegated to the shared ui-custom component — no inlined shell duplication.
	assert.match(source, /EntityCardAgentCard,[\s\S]*EntityCardAgentExpandedCard,[\s\S]*from "@\/components\/ui-custom\/entity-card";/u);
	assert.match(source, /function AgentCard\(\{ agent, onSelectAgent, publisher \}: Readonly<AgentCardProps>\)/u);
	assert.match(source, /const \[moreMenuOpen, setMoreMenuOpen\] = useState\(false\);/u);
	assert.match(source, /<EntityCardAgentCard[\s\S]*active=\{moreMenuOpen\}[\s\S]*avatarSrc=\{getDirectoryCardAvatarSrc\(agent\)\}[\s\S]*insetLogo=\{isBorderlessHexagonAgent\(agent\)\}/u);
	assert.match(source, /chatCount=\{agent\.chatCount\}/u);
	assert.match(source, /feedbackCount=\{agent\.feedbackCount\}/u);
	assert.match(source, /rating=\{agent\.rating\}/u);
	assert.match(source, /verified=\{agent\.verified\}/u);
	assert.doesNotMatch(source, /syntheticRating/u);
	assert.doesNotMatch(source, /syntheticChats/u);
	assert.doesNotMatch(source, /syntheticFeedback/u);
	assert.match(source, /className="hover:border-transparent"/u);
	assert.match(source, /onSelect=\{selectAgent\}/u);
	assert.match(source, /<DirectoryCardMoreMenu[\s\S]*onOpenChange=\{setMoreMenuOpen\}[\s\S]*open=\{moreMenuOpen\}/u);
	assert.match(source, /aria-pressed=\{open \|\| undefined\}/u);
	assert.match(entityAgentSource, /logoName\?: AtlassianLogoName;/u);
	assert.match(entityAgentSource, /size=\{logoName === "atlassian" \? "xsmall" : "medium"\}/u);
	assert.doesNotMatch(source, /AgentDirectoryCard/u);
	assert.doesNotMatch(source, /AGENT_CARD_OVERLAY_SHADOW/u);
	assert.match(source, /import \{ AnimatePresence, cubicBezier, motion, useReducedMotion \} from "motion\/react";/u);

	// Self-contained third-party marks render in a borderless hexagon, inset to 16x16.
	assert.match(source, /const BORDERLESS_HEXAGON_AGENT_IDS: ReadonlySet<string> = new Set\(\["google-drive", "slack", "notion"\]\);/u);
	assert.match(source, /function isBorderlessHexagonAgent\(agent: AgentBrowserAgent\): boolean/u);
	assert.match(source, /return BORDERLESS_HEXAGON_AGENT_IDS\.has\(agent\.id\);/u);
	// Borderless agents swap to their purpose-built 16px tile on the card.
	assert.match(source, /function getDirectoryCardAvatarSrc\(agent: AgentBrowserAgent\): string \| undefined/u);
	assert.match(source, /return `\/3p\/\$\{agent\.id\}\/16-borderless\.svg`;/u);

	// The hover/elevation/keyboard contract now lives in the shared shell + agent wrapper.
	const shell = readProjectFile("components/ui-custom/entity-card/card.tsx");
	const interaction = readProjectFile("components/ui-custom/entity-card/use-card-interaction.ts");
	const agentWrapper = readProjectFile("components/ui-custom/entity-card/variants.tsx");
	const entityAgent = readProjectFile("components/ui-custom/entity-card/agent.tsx");

	assert.match(interaction, /token\("elevation\.shadow\.overlay"\)/u);
	assert.match(interaction, /boxShadow: OVERLAY_SHADOW/u);
	assert.doesNotMatch(interaction, /scale: 1\.006/u);
	assert.match(interaction, /type: "spring",[\s\S]*bounce: 0\.16,[\s\S]*visualDuration: 0\.22/u);
	assert.match(shell, /group\/card relative flex h-full w-full flex-col gap-3 rounded-md bg-surface-overlay p-4/u);
	assert.match(shell, /after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-md after:border after:transition-colors/u);
	assert.match(shell, /after:border-border hover:after:border-transparent has-\[\[data-slot=card-directory-select\]:focus-visible\]:after:border-transparent/u);
	// Focus styling keys off the overlay select button's focus-visible (#709): the shared
	// shell no longer makes the whole card a role="button", so nested controls stay valid.
	assert.match(shell, /has-\[\[data-slot=card-directory-select\]:focus-visible\]:ring-3 has-\[\[data-slot=card-directory-select\]:focus-visible\]:ring-ring\/50/u);
	assert.match(shell, /willChange: "transform"/u);
	assert.doesNotMatch(shell, /role="button"/u);
	assert.match(shell, /data-slot="card-directory-select"[\s\S]*type="button"/u);
	assert.match(shell, /whileTap: interactive \? tapAnimation : undefined/u);

	assert.match(agentWrapper, /<EntityCardShell active=\{active\} className=\{cn\("gap-4", className\)\}/u);
	assert.match(agentWrapper, /action=\{moreAction\}/u);
	assert.match(agentWrapper, /onMoreActions=\{onMoreActions\}/u);
	assert.match(agentWrapper, /<EntityCardAgent\b/u);
	assert.match(entityAgent, /shape="hexagon"/u);
	assert.match(entityAgent, /<EntityCardMoreButton active=\{active\}/u);
	assert.match(entityAgent, /<div className="flex flex-col gap-2">[\s\S]*<EntityCardHeader[\s\S]*<EntityCardDescription>/u);
	assert.match(entityAgent, /<EntityCardByline/u);
	assert.match(entityAgent, /StarUnstarredIcon/u);
	assert.match(entityAgent, /AiChatIcon/u);

	assert.doesNotMatch(shell, /hover:-translate-y/u);
	assert.doesNotMatch(shell, /hover:shadow-2xl/u);
});

test("Agent Directory experimental cards use the latest blocks/agent-card variants", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const card = readProjectFile("components/blocks/agent-card/components/agent-card.tsx");
	const cardParts = readProjectFile("components/blocks/agent-card/components/agent-card-parts.tsx");

	// The experimental browser renders the standalone agent-card block (aliased to
	// avoid clashing with the local default-card wrapper).
	assert.match(source, /import \{ AgentCard as ExperimentalDirectoryCard \} from "@\/components\/blocks\/agent-card";/u);

	// Built (normal) agents -> experimental-profile, with the more-menu kept.
	assert.match(source, /function ExperimentalProfileCard/u);
	assert.match(source, /<ExperimentalProfileCard agent=\{agent\} onSelectAgent=\{onSelectAgent\} \/>/u);
	assert.match(source, /variant="experimental-profile"/u);
	assert.match(source, /avatarSrc=\{getDirectoryCardAvatarSrc\(agent\)\}/u);
	assert.match(source, /insetLogo=\{isBorderlessHexagonAgent\(agent\)\}/u);
	assert.match(source, /logoName=\{agent\.logoName\}/u);
	assert.match(source, /moreAction=\{[\s\S]*<DirectoryCardMoreMenu[\s\S]*label=\{`More actions for \$\{agent\.name\}`\}[\s\S]*open=\{moreMenuOpen\}/u);
	assert.match(source, /active=\{moreMenuOpen\}/u);

	// Templates -> expanded, mapped 1:1 from the template agent shape.
	assert.match(source, /<ExperimentalDirectoryCard[\s\S]*variant="expanded"/u);
	assert.match(source, /capabilities=\{agent\.capabilities \?\? EMPTY_TEMPLATE_CAPABILITIES\}/u);

	// The card exposes the moreAction slot + active passthrough, and the cover
	// illustration clears on hover only when there is a more action to reveal.
	assert.match(card, /moreAction\?: ReactNode;/u);
	assert.match(card, /insetLogo\?: boolean;/u);
	assert.match(card, /logoName\?: AtlassianLogoName;/u);
	assert.match(card, /const EXPERIMENTAL_VERIFIED_ICON_CLASS_NAME = "text-white";/u);
	assert.match(card, /const displayStats = stats\.filter\(\(stat\) => !isRemixStat\(stat\)\);/u);
	assert.match(card, /function isLastUpdateStat\(stat: \{ label: string \}\): boolean/u);
	assert.match(card, /<ClockIcon label="" size="small" spacing="none" color="currentColor" \/>/u);
	assert.match(card, /formatAgentCardStatText\(stat\)/u);
	assert.match(card, /className="pointer-events-auto relative z-10 flex min-h-0 flex-auto flex-col gap-3 overflow-y-auto px-4 pt-4 pb-4 text-text \[scrollbar-gutter:stable\]"/u);
	assert.match(card, /const hasMoreAction = Boolean\(moreAction\) \|\| Boolean\(onMoreActions\);/u);
	assert.match(card, /hasMoreAction[\s\S]*group-hover\/card:opacity-0/u);
	assert.match(card, /\{moreAction \?\? \(onMoreActions \?/u);
	assert.match(cardParts, /className="absolute inset-0 z-0 cursor-pointer rounded-md outline-none"/u);
	assert.match(cardParts, /data-slot="agent-card-select"/u);
});

test("Agent Card expanded template uses the shared template detail body without a footer CTA", () => {
	const card = readProjectFile("components/blocks/agent-card/components/agent-card.tsx");
	const cardParts = readProjectFile("components/blocks/agent-card/components/agent-card-parts.tsx");
	const demo = readProjectFile("components/website/demos/blocks/agent-card-demo.tsx");
	const page = readProjectFile("components/blocks/agent-card/page.tsx");
	const details = readDetailCategorySource("blocks");
	const theme = readProjectFile("app/tailwind-theme.css");

	assert.match(card, /const expandedStats = stats\.slice\(0, 2\);/u);
	assert.match(card, /const showExpandedInlineStats = expandedStats\.length > 0 \|\| showRating \|\| showChats;/u);
	assert.match(cardParts, /hoverShadow\?: "default" \| "none";/u);
	assert.match(cardParts, /const hoverAnimation = hoverShadow === "default" \? \(\{ boxShadow: OVERLAY_SHADOW \} as const\) : undefined;/u);
	assert.match(card, /const EXPANDED_TICKET_TOP_MASK_IMAGE = \[/u);
	assert.match(card, /radial-gradient\(circle 8px at 0 100%, transparent 0 7\.5px, black 8px\)/u);
	assert.match(card, /const EXPANDED_TICKET_BOTTOM_MASK_IMAGE = \[/u);
	assert.match(card, /radial-gradient\(circle 8px at 0 0, transparent 0 7\.5px, black 8px\)/u);
	assert.match(card, /maskComposite: "intersect"/u);
	assert.match(card, /WebkitMaskComposite: "source-in"/u);
	assert.match(card, /maskImage: EXPANDED_TICKET_TOP_MASK_IMAGE/u);
	assert.match(card, /maskImage: EXPANDED_TICKET_BOTTOM_MASK_IMAGE/u);
	assert.match(card, /const EXPANDED_TICKET_SHADOW_MASK_IMAGE = \[/u);
	assert.match(card, /radial-gradient\(circle 8px at 0 var\(--agent-card-ticket-seam-y, 0px\), transparent 0 7\.5px, black 8px\)/u);
	assert.match(theme, /@utility agent-card-ticket-shadow \{[\s\S]*drop-shadow\(0 8px 12px rgb\(30 31 33 \/ 0\.15\)\);/u);
	assert.match(theme, /@utility agent-card-ticket-seam \{[\s\S]*&::before,[\s\S]*&::after[\s\S]*width: 8px;[\s\S]*height: 16px;[\s\S]*background: transparent;[\s\S]*border: 1px solid var\(--color-border\);[\s\S]*left: 0;[\s\S]*border-left: 0;[\s\S]*border-radius: 0 9999px 9999px 0;[\s\S]*right: 0;[\s\S]*border-right: 0;[\s\S]*border-radius: 9999px 0 0 9999px;/u);
	assert.doesNotMatch(theme, /agent-card-ticket-seam[\s\S]*background: var\(--color-surface\);/u);
	assert.doesNotMatch(theme, /agent-card-ticket-seam[\s\S]*filter: drop-shadow\(0 8px 12px rgb\(30 31 33 \/ 0\.15\)\);/u);
	assert.match(card, /const EXPANDED_TICKET_ELEVATION_CLASS_NAME = "agent-card-ticket-shadow";/u);
	assert.match(card, /const EXPANDED_TICKET_WRAPPER_CLASS_NAME = "relative flex min-h-0 flex-auto flex-col rounded-2xl";/u);
	assert.match(card, /const EXPANDED_TICKET_SHADOW_CLASS_NAME = cn\(/u);
	assert.match(card, /group-hover\/card:opacity-100 group-focus-within\/card:opacity-100/u);
	assert.match(card, /const EXPANDED_TICKET_SHADOW_STYLE = \{/u);
	assert.match(card, /maskImage: EXPANDED_TICKET_SHADOW_MASK_IMAGE/u);
	assert.match(card, /WebkitMaskImage: EXPANDED_TICKET_SHADOW_MASK_IMAGE/u);
	assert.match(card, /const EXPANDED_TICKET_TEAR_LINE_STYLE = \{/u);
	assert.match(card, /repeating-linear-gradient\(to right, black 0 6px, transparent 6px 16px\)/u);
	assert.match(card, /function AgentCardTicketSeam\(\)/u);
	assert.match(card, /data-slot="agent-card-ticket-seam"/u);
	assert.match(card, /style=\{\{ zIndex: 30 \}\}/u);
	assert.match(card, /className="agent-card-ticket-seam pointer-events-none relative h-0"/u);
	assert.match(card, /right-2 left-2 h-px bg-border[\s\S]*data-slot="agent-card-ticket-tear-line"[\s\S]*style=\{EXPANDED_TICKET_TEAR_LINE_STYLE\}/u);
	assert.doesNotMatch(card, /agent-card-ticket-cutout-left/u);
	assert.doesNotMatch(card, /agent-card-ticket-cutout-right/u);
	assert.match(card, /const ticketRef = useRef<HTMLDivElement \| null>\(null\);/u);
	assert.match(card, /const ticketHeaderRef = useRef<HTMLDivElement \| null>\(null\);/u);
	assert.match(card, /ticket\.style\.setProperty\("--agent-card-ticket-seam-y"/u);
	assert.match(card, /new ResizeObserver\(updateSeamOffset\)/u);
	assert.match(card, /<AgentCardTicketSeam \/>[\s\S]*data-slot="agent-card-scroll"/u);
	assert.match(card, /"gap-0 overflow-visible rounded-2xl bg-transparent p-0 after:rounded-2xl after:border-0 \[&_\[data-slot=agent-card-select\]\]:rounded-2xl"/u);
	assert.match(card, /hoverShadow="none"/u);
	assert.match(card, /data-slot="agent-card-ticket"/u);
	assert.match(card, /data-slot="agent-card-ticket" ref=\{ticketRef\}/u);
	assert.match(card, /className=\{cn\(EXPANDED_TICKET_SHADOW_CLASS_NAME, active && "opacity-100"\)\}[\s\S]*data-slot="agent-card-ticket-shadow"[\s\S]*data-slot="agent-card-ticket-shadow-shape"[\s\S]*style=\{EXPANDED_TICKET_SHADOW_STYLE\}/u);
	assert.match(card, /className="relative z-10 shrink-0" ref=\{ticketHeaderRef\}/u);
	assert.doesNotMatch(card, /EXPANDED_TICKET_PIECE_CLASS_NAME/u);
	assert.doesNotMatch(card, /EXPANDED_TICKET_SURFACE_CLASS_NAME/u);
	assert.match(card, /\[&_\[data-slot=agent-card-banner\]>div:first-child\]:mb-\[-1px\]/u);
	assert.match(card, /\[&_\[data-slot=agent-card-banner\]>div:first-child\]:h-\[49px\]/u);
	assert.match(card, /"relative z-10 overflow-hidden rounded-t-2xl border-x border-t border-border bg-surface [^"]*"[\s\S]*data-slot="agent-card-sticky-header"[\s\S]*style=\{EXPANDED_TICKET_TOP_STYLE\}/u);
	assert.match(card, /data-slot="agent-card-scroll"[\s\S]*style=\{EXPANDED_TICKET_BOTTOM_STYLE\}/u);
	assert.doesNotMatch(card, /EXPANDED_TICKET_SHAPE_CLASS_NAME/u);
	assert.doesNotMatch(card, /active && "border-transparent"/u);
	assert.match(card, /<AgentCardFooter className="mt-4">/u);
	assert.match(
		card,
		/if \(variant === "template"\)[\s\S]*<AgentCardSection label="Trusted by teammates">[\s\S]*<AvatarGroup className="items-center" label="Collaborators">[\s\S]*<Avatar key=\{person\.src\} size="sm">[\s\S]*<AvatarGroupCount>\+\{hiddenCollaboratorCount\}<\/AvatarGroupCount>[\s\S]*<AgentCardSection label="Works with">/u,
	);
	assert.match(
		card,
		/data-slot="agent-card-scroll"[\s\S]*style=\{EXPANDED_TICKET_BOTTOM_STYLE\}[\s\S]*<AgentCardSection label="Works with">/u,
	);
	assert.match(card, /<TWGAppstack animated=\{false\} className="justify-start" iconSize="small" maxVisible=\{7\} sources=\{sources\} \/>/u);
	assert.match(card, /<AgentCardSection label="Works with">/u);
	assert.match(card, /<AgentCardSection label="Skills">/u);
	assert.match(card, /<div className="py-1\.5">[\s\S]*<Separator \/>/u);
	assert.match(card, /<AgentCardCapabilities[\s\S]*items=\{capabilities\}[\s\S]*label=\{capabilitiesLabel\}[\s\S]*listClassName="gap-2"/u);
	assert.doesNotMatch(card, /const expandedDetailStyle/u);
	assert.doesNotMatch(card, /expandedScrollStyle/u);
	assert.doesNotMatch(card, /pointer-events-none absolute inset-0 flex items-center px-4 py-2 opacity-0/u);
	assert.match(demo, /collaborators=\{COLLABORATORS\}[\s\S]*variant="template"/u);
	assert.match(page, /collaborators=\{COLLABORATORS\}[\s\S]*variant="template"/u);
	assert.match(demo, /className="w-full max-w-\[376px\]"/u);
	assert.match(page, /className="w-full max-w-\[376px\]"/u);
	assert.match(details, /"agent-card": \{[\s\S]*demoLayout: \{ previewHeight: "fit" \}/u);
	assert.doesNotMatch(details, /stats \/ collaborators footer/u);
	assert.doesNotMatch(details, /hover "Use template" action/u);
});
