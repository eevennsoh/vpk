const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const STAGE_SOURCE = readFileSync(join(__dirname, "components/work-item-stage.tsx"), "utf8");
const HEADER_SOURCE = readFileSync(join(__dirname, "components/gallery-header-controls.tsx"), "utf8");
const STATE_SOURCE = readFileSync(join(__dirname, "data/work-item-states.ts"), "utf8");
const DIALOG_SOURCE = readFileSync(
	join(__dirname, "../../blocks/jira-work-item/experimental/components/experimental-work-item-dialog.tsx"),
	"utf8",
);
const COMPOSITION_SOURCE = readFileSync(
	join(__dirname, "../../blocks/jira-work-item/experimental/experimental-jira-work-item.tsx"),
	"utf8",
);
const FLOATING_SURFACE_SOURCE = readFileSync(
	join(__dirname, "../../blocks/jira-work-item/experimental/components/floating-session-surface.tsx"),
	"utf8",
);
const CONTROLLER_SOURCE = readFileSync(
	join(__dirname, "../../blocks/jira-work-item/experimental/use-jira-work-item-controller.ts"),
	"utf8",
);

test("ASX Work item opens the experimental Agent Sessions design from its state buttons", () => {
	assert.match(PAGE_SOURCE, /item\.id === "work-item"[\s\S]*<WorkItemStage controller=\{workItemController\} \/>/u);
	assert.match(PAGE_SOURCE, /<JiraGoldenJourneyV0HeaderControls \{\.\.\.headerControlProps\} \/>/u);
	assert.match(PAGE_SOURCE, /topBarCenterCompact=/u);
	assert.match(STAGE_SOURCE, /<ExperimentalJiraWorkItem/u);
	assert.match(STAGE_SOURCE, /const selectPreset = useCallback[\s\S]*setPreset\(nextPreset\);/u);
	assert.match(STAGE_SOURCE, /setLaunchId\(\(currentLaunchId\) => currentLaunchId \+ 1\);/u);
	assert.match(STAGE_SOURCE, /<ExperimentalJiraWorkItem[\s\S]*key=\{controller\.launchId\}/u);
	assert.match(STAGE_SOURCE, /presentation="inline"/u);
	assert.doesNotMatch(STAGE_SOURCE, /isOpen|setIsOpen|onClose=/u);
	assert.match(HEADER_SOURCE, /WORK_ITEM_STATES\.map\(\(option\) =>/u);
	assert.match(HEADER_SOURCE, /<ButtonGroup[\s\S]*variant="connected"/u);
	assert.match(HEADER_SOURCE, /size="compact"/u);
	assert.match(STAGE_SOURCE, /useState<JiraWorkItemExperimentalPreset>\("blank"\)/u);
	assert.match(HEADER_SOURCE, /selected: option\.value === workItemController\.preset/u);
	assert.match(HEADER_SOURCE, /aria-pressed:z-10/u);
	assert.match(HEADER_SOURCE, /border-l!/u);
	assert.doesNotMatch(STAGE_SOURCE, /<button/u);
	assert.doesNotMatch(STAGE_SOURCE, /Open work item/u);
});

test("ASX Work item renders a content-height inline surface with a viewport gutter", () => {
	const inlineIndex = DIALOG_SOURCE.indexOf('if (presentation === "inline")');
	const backdropIndex = DIALOG_SOURCE.indexOf("<Dialog.Backdrop");
	const inlineSource = DIALOG_SOURCE.slice(inlineIndex, backdropIndex);

	assert.ok(inlineIndex >= 0 && inlineIndex < backdropIndex);
	assert.match(inlineSource, /<section[\s\S]*aria-label=\{workItemTitle\}/u);
	assert.match(inlineSource, /max-h-full/u);
	assert.match(inlineSource, /w-full max-w-\[1200px\] shrink-0 outline-none/u);
	assert.doesNotMatch(inlineSource, /className="[^"]*(?:^|\s)h-full(?:\s|$)[^"]*"/u);
	assert.match(STAGE_SOURCE, /items-start justify-center overflow-hidden px-8 pt-4 pb-4/u);
	assert.match(DIALOG_SOURCE, /<ModalHeader[\s\S]*showClose=\{presentation !== "inline"\}[\s\S]*\/>/u);
});

test("ASX Work item portals its local Rovo surface to viewport coordinates", () => {
	assert.match(COMPOSITION_SOURCE, /<FloatingSessionSurface portalToViewport=\{presentation === "inline"\} \/>/u);
	assert.match(FLOATING_SURFACE_SOURCE, /createPortal\(surface, portalRoot\)/u);
	assert.match(FLOATING_SURFACE_SOURCE, /portalToViewport \? document\.body : null/u);
});

test("ASX Work item can jump between all requested presets", () => {
	assert.match(
		STATE_SOURCE,
		/label: "Empty", value: "blank"[\s\S]*label: "Suggestions", value: "empty"[\s\S]*label: "Running", value: "running"[\s\S]*label: "Done", value: "filled"/u,
	);
	assert.doesNotMatch(STAGE_SOURCE, /controls=/u);
	assert.match(HEADER_SOURCE, /workItemController\.selectPreset\(option\.value\)/u);
	assert.doesNotMatch(CONTROLLER_SOURCE, /hydrate-preset", preset: initialPreset/u);
});
