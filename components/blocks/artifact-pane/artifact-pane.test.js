const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const BLOCK_SOURCE = fs.readFileSync(path.join(__dirname, "index.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "artifact-details-demo.tsx"), "utf8");
const AGENTS_FIELD_SOURCE = fs.readFileSync(path.join(__dirname, "artifact-agents-field.tsx"), "utf8");
const LABELS_FIELD_SOURCE = fs.readFileSync(path.join(__dirname, "artifact-labels-field.tsx"), "utf8");
const PARENT_FIELD_SOURCE = fs.readFileSync(path.join(__dirname, "artifact-parent-field.tsx"), "utf8");
const PROJECT_FIELD_SOURCE = fs.readFileSync(path.join(__dirname, "artifact-project-field.tsx"), "utf8");
const DATE_FIELD_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "jira-work-item", "experimental", "components", "detail-field-editors.tsx"),
	"utf8",
);
const SUGGESTION_MENU_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "ui-custom", "rich-text-editor", "suggestion-menu.tsx"),
	"utf8",
);
const METADATA_RAIL_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "jira-work-item", "experimental", "components", "metadata-rail.tsx"),
	"utf8",
);
const EXPERIMENTAL_V2_DETAILS_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "jira-work-item", "experimental-v2", "components", "details-tab.tsx"),
	"utf8",
);

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Artifact Pane owns independently collapsible sections", () => {
	assert.match(BLOCK_SOURCE, /export function ArtifactPane\(/u);
	assert.match(BLOCK_SOURCE, /sections: readonly ArtifactPaneSectionItem\[\];/u);
	assert.doesNotMatch(BLOCK_SOURCE, /showCountSeparators/u);
	assert.match(BLOCK_SOURCE, /showSeparators\?: boolean;/u);
	assert.match(BLOCK_SOURCE, /borderless \? "overflow-visible bg-transparent" : "overflow-hidden border border-border"/u);
	assert.match(
		BLOCK_SOURCE,
		/style=\{borderless \? style : \{ backgroundColor: token\("elevation\.surface"\), \.\.\.style \}\}/u,
	);
	assert.doesNotMatch(
		BLOCK_SOURCE,
		/style=\{\{ backgroundColor: token\("elevation\.surface"\), \.\.\.style \}\}/u,
	);
	assert.match(BLOCK_SOURCE, /<Collapsible onOpenChange=\{onOpenChange\} open=\{open\}>/u);
	assert.match(BLOCK_SOURCE, /function CollapsedSectionCount\(\{[\s\S]*count: number \| string/u);
	// Counts sit beside the title with gap-1.5 — no unicode middle-dot sibling.
	assert.doesNotMatch(BLOCK_SOURCE, /typeof count === "number" \|\| \/\^\\d\+\(\?:\\\/\\d\+\)\?\$\/u\.test\(count\)/u);
	assert.doesNotMatch(BLOCK_SOURCE, /function CollapsedSectionCount[\s\S]*·/u);
	assert.match(BLOCK_SOURCE, /<span className=\{COLLAPSED_COUNT_CLASS_NAME\}>\{count\}<\/span>/u);
	assert.match(BLOCK_SOURCE, /className="flex min-w-0 items-center gap-1\.5 text-xs font-medium leading-4 text-text-subtle/u);
	assert.match(BLOCK_SOURCE, /data-slot="artifact-pane-section-title"/u);
	assert.doesNotMatch(BLOCK_SOURCE, /font\.heading\.xxsmall/u);
	assert.doesNotMatch(BLOCK_SOURCE, /return `· \$\{count\}`/u);
	assert.doesNotMatch(BLOCK_SOURCE, /labeled counts[\s\S]*stay verbatim|render as provided/u);
	// Collapsed count stays mounted in a 0fr→1fr slot so open↔closed doesn't reflow the title.
	assert.match(
		BLOCK_SOURCE,
		/count !== undefined \? \([\s\S]*<CollapsedSectionCount count=\{count\} \/>/u,
	);
	assert.match(BLOCK_SOURCE, /COLLAPSED_COUNT_SLOT_CLASSNAME =[\s\S]*grid min-w-0 transition-\[grid-template-columns,opacity\]/u);
	assert.match(BLOCK_SOURCE, /open \? "grid-cols-\[0fr\] opacity-0" : "grid-cols-\[1fr\] opacity-100"/u);
	assert.doesNotMatch(BLOCK_SOURCE, /!open && count !== undefined \? <CollapsedSectionCount count=\{count\} \/> : null/u);
	assert.match(BLOCK_SOURCE, /openSectionIds\?: ReadonlySet<string>/u);
	assert.match(BLOCK_SOURCE, /onOpenSectionIdsChange\?: \(openSectionIds: ReadonlySet<string>\) => void/u);
	assert.match(BLOCK_SOURCE, /const isControlled = openSectionIdsProp !== undefined/u);
	assert.doesNotMatch(
		BLOCK_SOURCE,
		/setUncontrolledOpenSectionIds\(\(current\) => \{[\s\S]*onOpenSectionIdsChange/u,
	);
	assert.match(
		BLOCK_SOURCE,
		/const next = apply\(uncontrolledOpenSectionIds\);[\s\S]*setUncontrolledOpenSectionIds\(next\);[\s\S]*onOpenSectionIdsChange\?\.\(next\)/u,
	);
	assert.match(BLOCK_SOURCE, /new Set\(sections\.filter\(\(section\) => section\.defaultOpen\)/u);
	assert.doesNotMatch(BLOCK_SOURCE, /showCountSeparator/u);
	assert.match(BLOCK_SOURCE, /showSeparators = true/u);
	// Separators stay mounted and collapse via grid-rows so they don't snap with content height.
	assert.match(BLOCK_SOURCE, /showSeparators && index > 0 \? \([\s\S]*SECTION_SEPARATOR_SLOT_CLASSNAME[\s\S]*open \|\| previousOpen \? "grid-rows-\[1fr\]" : "grid-rows-\[0fr\]"[\s\S]*className="px-3 py-1\.5"[\s\S]*<Separator \/>/u);
	assert.doesNotMatch(BLOCK_SOURCE, /showSeparators && index > 0 && \(open \|\| previousOpen\)/u);
	assert.match(BLOCK_SOURCE, /import ChevronRightIcon from "@atlaskit\/icon\/core\/chevron-right"/u);
	assert.match(BLOCK_SOURCE, /import \{ motion, useReducedMotion \} from "motion\/react"/u);
	assert.match(BLOCK_SOURCE, /const prefersReducedMotion = useReducedMotion\(\);/u);
	assert.match(BLOCK_SOURCE, /<motion\.span[\s\S]*animate=\{\{ rotate: open \? 90 : 0 \}\}/u);
	assert.match(BLOCK_SOURCE, /initial=\{false\}/u);
	assert.match(BLOCK_SOURCE, /style=\{\{ willChange: "transform" \}\}/u);
	assert.match(BLOCK_SOURCE, /prefersReducedMotion \? \{ duration: 0 \} : \{ duration: 0\.15, ease: motionEase\.inOut \}/u);
	assert.match(BLOCK_SOURCE, /<ChevronRightIcon label="" size="small" \/>/u);
	assert.match(BLOCK_SOURCE, /headerAction\?: Readonly<\{[\s\S]*label: string;[\s\S]*onClick\?: \(\) => void;[\s\S]*appearance\?: "icon" \| "label";[\s\S]*reveal\?: "hover" \| "open";/u);
	assert.match(BLOCK_SOURCE, /className="group\/header flex w-full items-center gap-2 px-3 py-3"/u);
	assert.match(BLOCK_SOURCE, /<SettingsIcon label="" size="small" \/>/u);
	assert.match(BLOCK_SOURCE, /aria-label=\{headerAction\.label\}/u);
	assert.match(BLOCK_SOURCE, /showHeaderAction = Boolean\(headerAction\)/u);
	assert.match(BLOCK_SOURCE, /headerActionOpenReveal = headerAction\?\.reveal === "open"/u);
	assert.match(BLOCK_SOURCE, /headerAction\.appearance === "label"/u);
	assert.match(BLOCK_SOURCE, /size="compact"[\s\S]*variant="outline"[\s\S]*\{headerAction\.label\}/u);
	assert.match(BLOCK_SOURCE, /HEADER_ACTION_HOVER_REVEAL_CLASSNAME =[\s\S]*pointer-events-none opacity-0 transition-opacity duration-fast ease-out-practical group-hover\/header:pointer-events-auto group-hover\/header:opacity-100 group-has-\[:focus-visible\]\/header:pointer-events-auto group-has-\[:focus-visible\]\/header:opacity-100 motion-reduce:transition-none/u);
	assert.match(BLOCK_SOURCE, /HEADER_ACTION_HOVER_SLOT_CLASSNAME =[\s\S]*grid shrink-0 grid-cols-\[0fr\][\s\S]*group-hover\/header:grid-cols-\[1fr\][\s\S]*group-has-\[:focus-visible\]\/header:grid-cols-\[1fr\]/u);
	// Chevron uses 0fr→1fr expand (not opacity) so always-visible Fix all sits flush
	// right, then slides left on hover — same language as check-row Fix.
	assert.match(BLOCK_SOURCE, /HEADER_CHEVRON_HOVER_SLOT_CLASSNAME =[\s\S]*grid shrink-0 grid-cols-\[0fr\][\s\S]*duration-normal[\s\S]*group-hover\/header:grid-cols-\[1fr\][\s\S]*group-has-\[:focus-visible\]\/header:grid-cols-\[1fr\]/u);
	// reveal:"open" Fix all stays mounted in a 0fr slot when collapsed (no unmount pop).
	assert.match(BLOCK_SOURCE, /HEADER_ACTION_OPEN_REVEAL_SLOT_CLASSNAME =[\s\S]*grid shrink-0 transition-\[grid-template-columns\] duration-normal ease-in-out/u);
	assert.match(BLOCK_SOURCE, /headerActionHoverReveal \? HEADER_ACTION_HOVER_REVEAL_CLASSNAME : null/u);
	assert.match(BLOCK_SOURCE, /headerActionOpenReveal \? \(\s*<div[\s\S]*HEADER_ACTION_OPEN_REVEAL_SLOT_CLASSNAME[\s\S]*open \? "grid-cols-\[1fr\]" : "grid-cols-\[0fr\]"/u);
	assert.match(BLOCK_SOURCE, /className="flex shrink-0 items-center"[\s\S]*HEADER_CHEVRON_HOVER_SLOT_CLASSNAME/u);
	// Disclosure body uses Base UI panel height CSS vars (no snap open/close).
	assert.match(BLOCK_SOURCE, /COLLAPSED_COUNT_SLOT_CLASSNAME =[\s\S]*transition-\[grid-template-columns,opacity\] duration-normal ease-in-out/u);
	assert.match(BLOCK_SOURCE, /DISCLOSURE_CONTENT_CLASSNAME =[\s\S]*h-\(--collapsible-panel-height\)[\s\S]*transition-\[height,opacity\] duration-normal ease-in-out[\s\S]*data-starting-style:h-0[\s\S]*data-ending-style:h-0[\s\S]*motion-reduce:transition-none/u);
	assert.doesNotMatch(BLOCK_SOURCE, /data-ending-style:duration-fast|data-ending-style:ease-in/u);
	assert.match(BLOCK_SOURCE, /SECTION_SEPARATOR_SLOT_CLASSNAME =[\s\S]*transition-\[grid-template-rows\] duration-normal ease-in-out/u);
	assert.match(BLOCK_SOURCE, /<CollapsibleContent className=\{DISCLOSURE_CONTENT_CLASSNAME\}>/u);
	assert.match(BLOCK_SOURCE, /className="ml-2 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"/u);
	assert.doesNotMatch(BLOCK_SOURCE, /absolute top-1\/2 right-8/u);
	assert.match(BLOCK_SOURCE, /<TooltipContent positionerClassName="z-\[502\]">\{headerAction\.label\}<\/TooltipContent>/u);
	assert.doesNotMatch(BLOCK_SOURCE, /Chevron(?:Up|Down)Icon/u);
	assert.match(BLOCK_SOURCE, /flex min-w-0 flex-1 items-center gap-1\.5/u);
	assert.match(BLOCK_SOURCE, /focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/u);
	// Chevron visibility is width-collapse, not opacity fade (avoids reserved gap after Fix all).
	assert.doesNotMatch(BLOCK_SOURCE, /motion\.span[\s\S]*opacity-0 transition-opacity[\s\S]*group-hover\/header:opacity-100/u);
	assert.match(BLOCK_SOURCE, /text-text-subtle group-hover\/header:text-text group-has-\[:focus-visible\]\/header:text-text/u);
	// Regression: header actions revealed on :focus-within stayed visible after the
	// pointer left, because clicking the disclosure button keeps DOM focus inside
	// the group. Only :focus-visible (keyboard focus) may pin them open.
	assert.doesNotMatch(BLOCK_SOURCE, /group-focus-within\/header:/u);
	assert.doesNotMatch(BLOCK_SOURCE, /hover:bg-surface-hovered/u);
	assert.match(BLOCK_SOURCE, /sections\.map\(\(section, index\) =>/u);
	assert.match(BLOCK_SOURCE, /index === 0 \? "pt-1\.5" : null/u);
	assert.match(BLOCK_SOURCE, /index === sections\.length - 1 \? "pb-1\.5" : null/u);
	assert.doesNotMatch(BLOCK_SOURCE, /gap-3 rounded-md px-3 py-3/u);
	assert.doesNotMatch(BLOCK_SOURCE, /border-b border-border/u);
	assert.doesNotMatch(BLOCK_SOURCE, /index > 0 \? "border-t border-border"/u);
	assert.doesNotMatch(BLOCK_SOURCE, /Tabs|TabTrigger|defaultTab/u);
});

test("Artifact Pane disclosure triggers have no unicode middle-dot in visible or accessible text", () => {
	const v3RailSource = readProjectFile(
		"components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-details-rail.tsx",
	);
	const v3ChecksListSource = readProjectFile(
		"components/blocks/pull-request/components/pull-request-checks-list.tsx",
	);
	const v3MetadataRailSource = readProjectFile(
		"components/blocks/jira-work-item/experimental-v3/components/metadata-rail.tsx",
	);
	const v2RailSource = readProjectFile(
		"components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-details-rail.tsx",
	);

	// Collapsed count is the value only; title-row gap-1.5 owns spacing (Subtasks pattern).
	assert.doesNotMatch(BLOCK_SOURCE, /showCountSeparators/u);
	assert.doesNotMatch(BLOCK_SOURCE, /function CollapsedSectionCount[\s\S]*·/u);
	assert.doesNotMatch(BLOCK_SOURCE, /<span aria-hidden[\s\S]{0,80}·/u);
	assert.match(BLOCK_SOURCE, /<span className=\{COLLAPSED_COUNT_CLASS_NAME\}>\{count\}<\/span>/u);
	assert.match(
		BLOCK_SOURCE,
		/className="flex min-w-0 items-center gap-1\.5 text-xs font-medium leading-4 text-text-subtle/u,
	);
	// Count stays in the accessibility tree while collapsed (aria-hidden only when open).
	assert.match(
		BLOCK_SOURCE,
		/aria-hidden=\{open \? true : undefined\}[\s\S]*<CollapsedSectionCount count=\{count\} \/>/u,
	);

	// CI checks / Commits counts are labeled ratios or numbers — they must not embed `·`.
	assert.match(v3ChecksListSource, /function ChecksSectionTitle[\s\S]*CI checks[\s\S]*text-text-subtlest[\s\S]*\{passed\}\/\{total\}/u);
	assert.doesNotMatch(v3RailSource, /checksCollapsedCount/u);
	assert.match(v3RailSource, /title: "Commits",\s*count: data\.commits\.length,/u);
	assert.doesNotMatch(v3RailSource, /title: "Commits"[\s\S]{0,120}·/u);
	assert.doesNotMatch(v2RailSource, /checksCollapsedCount =[\s\S]*·/u);
	assert.match(v2RailSource, /title: "Commits",\s*count: data\.commits\.length,/u);

	// Work-item Subtasks already used spacing-only counts; keep that and don't reintroduce a local middot.
	assert.match(
		v3MetadataRailSource,
		/count: `\$\{doneSubtasks\}\/\$\{subtasks\.length\}`[\s\S]*title: <SubtasksSectionTitle/u,
	);
	assert.doesNotMatch(v3MetadataRailSource, /Subtasks[\s\S]{0,200}·/u);
});

test("Artifact Pane property rows follow the Jira Session Flyout layout pattern", () => {
	assert.match(BLOCK_SOURCE, /export function ArtifactPanePropertyRow\(/u);
	assert.match(BLOCK_SOURCE, /editable = true/u);
	assert.match(BLOCK_SOURCE, /<span aria-hidden className="grid size-4 place-items-center text-icon-subtlest">/u);
	assert.doesNotMatch(BLOCK_SOURCE, /<span aria-hidden className="grid size-4 place-items-center text-icon-subtle">/u);
	assert.match(BLOCK_SOURCE, /className="grid min-h-8 min-w-0[^"]*items-center/u);
	assert.match(BLOCK_SOURCE, /"flex min-h-8 min-w-0 items-center text-text/u);
	assert.doesNotMatch(BLOCK_SOURCE, /(?:grid|flex) (?:h|min-h)-6 min-w-0/u);
	assert.match(BLOCK_SOURCE, /grid-cols-\[16px_84px_minmax\(0,1fr\)\]/u);
	assert.match(BLOCK_SOURCE, /\[&_\[data-slot=avatar\]\]:size-6/u);
	assert.match(BLOCK_SOURCE, /\[&_\[data-slot=avatar-group-count\]\]:size-6/u);
	assert.match(BLOCK_SOURCE, /\[&_\[data-slot=tile\]\]:size-6/u);
	assert.doesNotMatch(BLOCK_SOURCE, /\[&_\[data-slot=(?:avatar|avatar-group-count|tile)\]\]:size-4/u);
	assert.match(BLOCK_SOURCE, /editable[\s\S]*"-ml-2 rounded-md transition-colors duration-normal ease-out-practical hover:bg-bg-neutral-subtle-hovered motion-reduce:transition-none"/u);
	assert.match(
		BLOCK_SOURCE,
		/has-\[:focus-visible\]:relative has-\[:focus-visible\]:z-10 has-\[:focus-visible\]:bg-bg-input[\s\S]*has-\[button\[data-popup-open\]\]:relative has-\[button\[data-popup-open\]\]:z-10 has-\[button\[data-popup-open\]\]:bg-bg-input/u,
	);
	assert.match(BLOCK_SOURCE, /\[&>button\]:focus-visible:ring-0!/u);
	assert.doesNotMatch(BLOCK_SOURCE, /editable[\s\S]*"-m[xr]-2 rounded-md/u);
	assert.doesNotMatch(BLOCK_SOURCE, /py-0\.5 transition-colors/u);
	assert.match(BLOCK_SOURCE, /\[&>button\]:m-0!/u);
	assert.match(BLOCK_SOURCE, /\[&>button\]:min-h-8!/u);
	assert.match(BLOCK_SOURCE, /\[&>button\]:w-full!/u);
	assert.match(BLOCK_SOURCE, /\[&>button\]:px-2!/u);
});

test("Artifact Pane header action slots expose descendant-owned focus indicators", () => {
	assert.match(
		BLOCK_SOURCE,
		/headerActionOpenReveal \? \([\s\S]*className="min-w-0 overflow-hidden has-\[:focus-visible\]:overflow-visible"[\s\S]*\{headerActionControl\}/u,
	);
	assert.match(
		BLOCK_SOURCE,
		/HEADER_ACTION_HOVER_SLOT_CLASSNAME[\s\S]*className="min-w-0 overflow-hidden has-\[:focus-visible\]:overflow-visible"[\s\S]*\{headerActionControl\}/u,
	);
});

test("Artifact Pane remains standalone from the Jira work-item metadata rail", () => {
	assert.doesNotMatch(METADATA_RAIL_SOURCE, /components\/blocks\/artifact-pane/u);
	assert.match(METADATA_RAIL_SOURCE, /<Tabs defaultValue="details">/u);
	assert.match(METADATA_RAIL_SOURCE, /<TabsTrigger value="automation">Automation<\/TabsTrigger>/u);
});

test("Jira work-item v2 reuses the Artifact Pane parent-field owner", () => {
	assert.match(EXPERIMENTAL_V2_DETAILS_SOURCE, /import \{ ArtifactParentField \} from "@\/components\/blocks\/artifact-pane\/artifact-parent-field"/u);
	assert.match(EXPERIMENTAL_V2_DETAILS_SOURCE, /<ArtifactParentField onChange=\{\(key\) => onChange\(\{ parent: key \}\)\} value=\{draft\.parent\} \/>/u);
	assert.doesNotMatch(EXPERIMENTAL_V2_DETAILS_SOURCE, /ParentRowField/u);
});

test("Artifact Pane calendars are never narrower than their date triggers", () => {
	assert.match(DATE_FIELD_SOURCE, /className="w-auto min-w-\(--anchor-width\) p-2"/u);
});

test("Artifact Pane demo provides editable, avatar-rich metadata fields", () => {
	assert.match(DEMO_SOURCE, /useState<ArtifactMetadata>\(INITIAL_METADATA\)/u);
	assert.match(DEMO_SOURCE, /<ArtifactPanePropertyRow editable=\{false\}[\s\S]*?label="Status">/u);
	assert.match(DEMO_SOURCE, /import ProjectStatusIcon from "@atlaskit\/icon\/core\/project-status"/u);
	assert.match(DEMO_SOURCE, /icon=\{<ProjectStatusIcon label="" size="small" \/>\} label="Status"/u);
	assert.doesNotMatch(DEMO_SOURCE, /StatusInformationIcon/u);
	assert.match(DEMO_SOURCE, /<StatusPill[\s\S]*<ArtifactProjectField[\s\S]*<PersonRowField/u);
	assert.match(DEMO_SOURCE, /ariaLabel="Change reporter"/u);
	assert.match(DEMO_SOURCE, /import \{ ArtifactPaneAgentsField \} from "@\/components\/blocks\/artifact-pane\/artifact-agents-field"/u);
	assert.match(DEMO_SOURCE, /<ArtifactPaneAgentsField/u);
	assert.match(AGENTS_FIELD_SOURCE, /export function ArtifactPaneAgentsField/u);
	assert.match(AGENTS_FIELD_SOURCE, /trailing: value\.includes\(agent\.id\) \? <CheckIcon className="size-4 text-icon-subtle" \/> : undefined/u);
	assert.match(AGENTS_FIELD_SOURCE, /selectedItemIds=\{new Set\(value\)\}/u);
	assert.doesNotMatch(SUGGESTION_MENU_SOURCE, /isChosen && "[^"]*bg-bg-selected/u);
	assert.match(AGENTS_FIELD_SOURCE, /<AvatarGroup[\s\S]*<AgentAvatarVisual[\s\S]*sizePx=\{24\}/u);
	assert.doesNotMatch(AGENTS_FIELD_SOURCE, /sizePx=\{16\}/u);
	assert.match(AGENTS_FIELD_SOURCE, /leadingVisual: \([\s\S]*<AgentAvatarVisual[\s\S]*brandName=\{agent\.brandName\}[\s\S]*sizePx=\{24\}/u);
	assert.doesNotMatch(AGENTS_FIELD_SOURCE, /\? \{ kind: "third-party", name: agent\.brandName \}/u);
	assert.match(SUGGESTION_MENU_SOURCE, /leadingVisual\?: ReactNode;/u);
	assert.match(SUGGESTION_MENU_SOURCE, /aria-multiselectable=\{selectedItemIds \? true : undefined\}/u);
	assert.match(SUGGESTION_MENU_SOURCE, /aria-selected=\{listMode \? undefined : isChosen \?\? isSelected\}/u);
	assert.match(SUGGESTION_MENU_SOURCE, /role=\{listMode \? undefined : "option"\}/u);
	assert.match(SUGGESTION_MENU_SOURCE, /const visual = item\.leadingVisual \? \([\s\S]*item\.leadingVisual/u);
	assert.doesNotMatch(AGENTS_FIELD_SOURCE, /avatarClassName="[^"]*ring-/u);
	assert.doesNotMatch(AGENTS_FIELD_SOURCE, /label=\{agent\.name\}/u);
	assert.match(DEMO_SOURCE, /<PriorityRowField[\s\S]*<DateRowField[\s\S]*<ArtifactParentField[\s\S]*<ArtifactLabelsField/u);
	assert.match(DEMO_SOURCE, /import \{ ArtifactParentField \} from "@\/components\/blocks\/artifact-pane\/artifact-parent-field"/u);
	assert.match(PARENT_FIELD_SOURCE, /export function ArtifactParentField/u);
	assert.match(PARENT_FIELD_SOURCE, /import \{ Tag \} from "@\/components\/ui\/tag"/u);
	assert.match(PARENT_FIELD_SOURCE, /const ARTIFACT_EPIC_COLORS:[\s\S]*"RFP-100": "purple"[\s\S]*"RFP-102": "blue"[\s\S]*"RFP-103": "green"/u);
	assert.match(PARENT_FIELD_SOURCE, /function ArtifactEpicIcon\(\)[\s\S]*<Icon[\s\S]*aria-hidden[\s\S]*render=\{<EpicIcon color="currentColor" label="" size="medium" spacing="none" \/>\}/u);
	assert.doesNotMatch(PARENT_FIELD_SOURCE, /function ArtifactEpicIcon\(\)[\s\S]*className="size-/u);
	assert.match(PARENT_FIELD_SOURCE, /function ArtifactEpicMenuIcon\(\{ color \}: Readonly<\{ color: ArtifactEpicColor \}>\)[\s\S]*<IconTile[\s\S]*as="span"[\s\S]*icon=\{<ArtifactEpicIcon \/>\}[\s\S]*size="small"[\s\S]*variant=\{color\}/u);
	assert.doesNotMatch(PARENT_FIELD_SOURCE, /function ArtifactEpicMenuIcon\([\s\S]*className="text-current"/u);
	assert.match(PARENT_FIELD_SOURCE, /icon: null,[\s\S]*leadingVisual: <ArtifactEpicMenuIcon color=\{artifactEpicColor\(option\.key\)\} \/>/u);
	assert.match(PARENT_FIELD_SOURCE, /<Tag[\s\S]*className="max-w-full self-center"[\s\S]*color=\{artifactEpicColor\(selected\.key\)\}[\s\S]*elemBefore=\{<ArtifactEpicIcon \/>\}[\s\S]*\{selected\.summary\}/u);
	assert.doesNotMatch(PARENT_FIELD_SOURCE, /\{selected\.key\} \{selected\.summary\}/u);
	assert.match(PARENT_FIELD_SOURCE, /\[&_\.rich-text-command-menu-item:hover\]:bg-bg-neutral-subtle-hovered!/u);
	assert.doesNotMatch(DEMO_SOURCE, /<ParentRowField/u);
	assert.doesNotMatch(DEMO_SOURCE, /<LabelsRowField/u);
	assert.match(DEMO_SOURCE, /METADATA_PEOPLE/u);
	assert.match(AGENTS_FIELD_SOURCE, /BOARD_AGENTS/u);
	assert.match(DEMO_SOURCE, /import \{ ArtifactProjectField \} from "@\/components\/blocks\/artifact-pane\/artifact-project-field"/u);
	assert.match(PROJECT_FIELD_SOURCE, /export function ArtifactProjectField/u);
	assert.match(PROJECT_FIELD_SOURCE, /PROJECT_AVATAR_SRCS[\s\S]*"esm-rfp-response": "\/avatar-project\/rocket\.svg"/u);
	assert.match(PROJECT_FIELD_SOURCE, /<Tile aria-hidden className="p-0" isSnug/u);
	// Full-bleed 24px tile (`p-0` + isSnug) + gap-2 = true 8px avatar→name gap.
	assert.match(
		PROJECT_FIELD_SOURCE,
		/selected \? \([\s\S]*className="flex min-w-0 items-center gap-2"[\s\S]*<ProjectAvatar/u,
	);
	assert.match(PROJECT_FIELD_SOURCE, /<ProjectAvatar name=\{selected\.name\} src=\{selected\.avatarSrc\} \/>/u);
	assert.match(PROJECT_FIELD_SOURCE, /icon: null,[\s\S]*visual: \{ kind: "avatar", shape: "square", src: project\.avatarSrc \}/u);
	assert.match(DEMO_SOURCE, /className="mt-1 self-start text-xs leading-5 text-text-subtle underline-offset-2 hover:underline focus-visible:underline"/u);
	assert.doesNotMatch(DEMO_SOURCE, /self-start[^"]*text-link/u);
	assert.doesNotMatch(DEMO_SOURCE, /See less[\s\S]*text-sm font-medium/u);
});

test("Artifact Pane labels use colored tags in the field and grouped picker", () => {
	assert.match(LABELS_FIELD_SOURCE, /import DeleteIcon from "@atlaskit\/icon\/core\/delete"/u);
	assert.match(LABELS_FIELD_SOURCE, /import \{ Tag, TagGroup, type TagColor \} from "@\/components\/ui\/tag"/u);
	assert.match(LABELS_FIELD_SOURCE, /const LABEL_COLORS = \["blue", "green", "purple", "orange", "teal", "magenta", "yellow"\]/u);
	assert.match(LABELS_FIELD_SOURCE, /const allLabels = Array\.from\(new Set\(\[\.\.\.value, \.\.\.LABEL_OPTIONS\]\)\);/u);
	assert.match(LABELS_FIELD_SOURCE, /const visibleLabels = allLabels\.filter/u);
	assert.match(LABELS_FIELD_SOURCE, /<Tag className="self-center justify-self-start" color=\{labelColor\(label\)\}/u);
	assert.match(LABELS_FIELD_SOURCE, /className="rich-text-command-menu-heading"/u);
	assert.match(LABELS_FIELD_SOURCE, /group\/label-option grid-cols-\[minmax\(0,1fr\)_24px\]!/u);
	assert.match(LABELS_FIELD_SOURCE, /hover:bg-bg-neutral-subtle-hovered! focus-visible:bg-bg-neutral-subtle-hovered!/u);
	assert.match(LABELS_FIELD_SOURCE, /group-hover\/label-option:text-icon-danger group-hover\/label-option:opacity-100/u);
	assert.match(LABELS_FIELD_SOURCE, /group-focus-visible\/label-option:text-icon-danger group-focus-visible\/label-option:opacity-100/u);
	assert.match(LABELS_FIELD_SOURCE, /<DeleteIcon label="" size="small" \/>/u);
	assert.match(LABELS_FIELD_SOURCE, /aria-label=\{selected \? `Remove \$\{label\}` : `Add \$\{label\}`\}/u);
	assert.match(LABELS_FIELD_SOURCE, /aria-multiselectable="true"/u);
	assert.match(LABELS_FIELD_SOURCE, /<PopoverContent[\s\S]*aria-label="Edit labels"/u);
	assert.match(LABELS_FIELD_SOURCE, /aria-label="Search labels"[\s\S]*className="rich-text-command-menu-list"[\s\S]*role="listbox"/u);
	assert.doesNotMatch(LABELS_FIELD_SOURCE, /className="rich-text-command-menu rich-text-command-menu-borderless"[\s\S]{0,80}role="listbox"/u);
	assert.match(LABELS_FIELD_SOURCE, /<DetailValueTrigger aria-label="Edit labels" className="py-1\.5!" \/>/u);
	assert.match(LABELS_FIELD_SOURCE, /heading="Selected"/u);
	assert.match(LABELS_FIELD_SOURCE, /heading="More labels"/u);
	assert.match(LABELS_FIELD_SOURCE, /const canCreateCustomLabel = customLabel\.length > 0/u);
	assert.match(LABELS_FIELD_SOURCE, /heading="New label" labels=\{\[customLabel\]\}/u);
	assert.match(LABELS_FIELD_SOURCE, /else if \(canCreateCustomLabel\) \{[\s\S]*createCustomLabel\(customLabel\);/u);
	assert.doesNotMatch(LABELS_FIELD_SOURCE, /No labels found/u);
	assert.match(LABELS_FIELD_SOURCE, /aria-selected=\{selected\}/u);
});

test("Artifact Pane is registered as a documented block", () => {
	assert.match(readProjectFile("app/data/components.ts"), /blockComponent\("artifact-pane", "Artifact Pane"\)/u);
	assert.match(readProjectFile("app/data/component-manifest.ts"), /blockComponent\("artifact-pane", "Artifact Pane"\)/u);
	assert.match(readProjectFile("app/data/details/blocks.ts"), /"artifact-pane": ARTIFACT_PANE_DETAIL/u);
	assert.match(readProjectFile("components/website/registry/blocks.ts"), /"artifact-pane": dynamic\(/u);
	assert.ok(fs.existsSync(path.join(process.cwd(), "components/website/demos/blocks/artifact-pane-demo.tsx")));
});

test("Artifact Pane labels picker fades its list once scrolled", () => {
	// The picker hand-rolls the command-menu markup, so it does not inherit the
	// `data-list-scrolled` bookkeeping that RichTextSuggestionMenu applies. Both
	// halves of the shared hook must be wired, or a long label list clips hard
	// under the search header instead of fading.
	assert.match(LABELS_FIELD_SOURCE, /useCommandMenuScrollMask/u);
	assert.match(LABELS_FIELD_SOURCE, /const \{ listProps, menuProps \} = useCommandMenuScrollMask\(\);/u);
	// menuProps supplies data-list-scrolled on the menu root; listProps supplies
	// the ref + onScroll on the scroller.
	assert.match(LABELS_FIELD_SOURCE, /className="rich-text-command-menu rich-text-command-menu-borderless"[\s\S]*\{\.\.\.menuProps\}/u);
	assert.match(LABELS_FIELD_SOURCE, /className="rich-text-command-menu-list"[\s\S]*\{\.\.\.listProps\}/u);
});

test("editable property rows draw the shared input focus ring", () => {
	const focusRingSource = readProjectFile("components/ui/focus-ring.ts");

	// 1px solid focus line + 3px halo at 50%, matching Input/InputGroup. Drawn
	// with ring + ring-offset (two stacked box-shadows) instead of a border so
	// these borderless rows keep their geometry on focus.
	assert.match(focusRingSource, /FOCUS_RING_HAS_VISIBLE[\s\S]*ring-offset-1 has-\[:focus-visible\]:ring-offset-ring/u);
	assert.match(focusRingSource, /FOCUS_RING_POPUP_OPEN[\s\S]*ring-offset-1 has-\[button\[data-popup-open\]\]:ring-offset-ring/u);

	assert.match(BLOCK_SOURCE, /FOCUS_RING_HAS_VISIBLE,\n\s+FOCUS_RING_POPUP_OPEN,/u);
});

test("editable property rows key their focus ring off :focus-visible, not :focus-within", () => {
	// The popover restores focus to its trigger on close, so `:focus-within`
	// leaves the ring and background stuck on after a click-outside dismissal.
	assert.doesNotMatch(BLOCK_SOURCE, /focus-within:ring/u);
	assert.doesNotMatch(BLOCK_SOURCE, /focus-within:bg-/u);
	assert.match(BLOCK_SOURCE, /has-\[:focus-visible\]:bg-bg-input/u);
});
