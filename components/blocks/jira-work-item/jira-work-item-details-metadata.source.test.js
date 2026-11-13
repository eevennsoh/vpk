const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

// Details-metadata draft/picker contracts split from jira-work-item.source.test.js
// so the parent file stays inside its recorded file-size growth budget.

const BLOCK_DIR = __dirname;

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

let detailsTabPromise;
let detailFieldEditorsPromise;

function loadBlockModule(relativePath, harnessName) {
	return esbuild
		.build({
			entryPoints: [path.join(BLOCK_DIR, relativePath)],
			bundle: true,
			format: "cjs",
			loader: { ".css": "empty" },
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			write: false,
		})
		.then((result) => loadCjsModuleFromText(result.outputFiles[0].text, harnessName));
}

function loadDetailsTabModule() {
	if (!detailsTabPromise) {
		detailsTabPromise = loadBlockModule("experimental/components/details-tab.tsx", "jira-work-item-details-tab-harness.cjs");
	}
	return detailsTabPromise;
}

function loadDetailFieldEditorsModule() {
	if (!detailFieldEditorsPromise) {
		detailFieldEditorsPromise = loadBlockModule(
			"experimental/components/detail-field-editors.tsx",
			"jira-work-item-detail-field-editors-harness.cjs",
		);
	}
	return detailFieldEditorsPromise;
}

test("details metadata draft preserves editable work item fields without aliasing labels", async () => {
	const { seedMetadataDraft } = await loadDetailsTabModule();
	const assignee = { id: "maya", name: "Maya Chen", avatarUrl: "/avatar-user/maya.png" };
	const reporter = { id: "david", name: "David Hsieh", avatarUrl: "/avatar-user/david.png" };
	const labels = ["security", "rfp"];

	const draft = seedMetadataDraft({
		assignee,
		dueDate: "not-a-date",
		labels,
		parent: { code: "RFP-42" },
		priority: "High",
		reporter,
		startDate: "2026-07-14",
		status: "Review",
	});

	assert.equal(draft.status, "Review");
	assert.equal(draft.priority, "High");
	assert.equal(draft.assignee, assignee);
	assert.equal(draft.reporter, reporter);
	assert.equal(draft.startDate.toISOString(), "2026-07-14T00:00:00.000Z");
	assert.equal(draft.dueDate, undefined);
	assert.equal(draft.parent, "RFP-42");
	assert.deepEqual(draft.labels, labels);
	assert.notEqual(draft.labels, labels);
	assert.equal(draft.atlassianProject, null);
});

test("details metadata draft and status variants use board lifecycle defaults", async () => {
	const [{ seedMetadataDraft }, { STATUS_PHASES, statusVariant }] = await Promise.all([
		loadDetailsTabModule(),
		loadDetailFieldEditorsModule(),
	]);

	const draft = seedMetadataDraft({});

	assert.equal(draft.status, STATUS_PHASES[0]);
	assert.equal(draft.priority, "Medium");
	assert.deepEqual(draft.labels, []);
	assert.equal(statusVariant(STATUS_PHASES[0]), "neutral");
	assert.equal(statusVariant(STATUS_PHASES[1]), "information");
	assert.equal(statusVariant(STATUS_PHASES.at(-1)), "success");
	assert.equal(statusVariant("Unmapped external status"), "neutral");
	assert.equal(statusVariant("In review"), "information");
});

test("details metadata searchable pickers reuse the editor palette shell and keep Agents agent-only", async () => {
	const editorsSource = readBlockFile("experimental/components/detail-field-editors.tsx");
	const detailsSource = readBlockFile("experimental/components/details-tab.tsx");
	const { filterMetadataSearchItems } = await loadDetailFieldEditorsModule();
	const items = [
		{ id: "maya", label: "Maya Chen", description: "Proposal manager", icon: null },
		{ id: "jordan", label: "Jordan Lee", description: "Account executive", icon: null },
	];

	assert.deepEqual(
		filterMetadataSearchItems(items, "  ACCOUNT ").map((item) => item.id),
		["jordan"],
	);
	assert.match(editorsSource, /<RichTextCommandMenuSearchField/u);
	assert.match(editorsSource, /<RichTextSuggestionMenu/u);
	assert.match(editorsSource, /className=\{cn\("rich-text-command-menu-borderless", className\)\}/u);
	assert.match(editorsSource, /METADATA_PICKER_POPOVER_CLASS[\s\S]*bg-transparent[\s\S]*shadow-none/u);
	assert.match(editorsSource, /METADATA_PICKER_POSITIONER_CLASS = "z-\[700\]"/u);
	assert.match(editorsSource, /METADATA_PICKER_SIDE_OFFSET = 8/u);
	assert.match(
		editorsSource,
		/PersonRowField[\s\S]*sideOffset=\{METADATA_PICKER_SIDE_OFFSET\}/u,
	);
	const editorsV2Source = readBlockFile("experimental-v2/components/detail-field-editors.tsx");
	assert.match(editorsV2Source, /METADATA_PICKER_SIDE_OFFSET = 8/u);
	assert.match(
		editorsV2Source,
		/PersonRowField[\s\S]*sideOffset=\{METADATA_PICKER_SIDE_OFFSET\}/u,
	);
	assert.doesNotMatch(editorsSource, /rich-text-command-menu-embedded/u);
	assert.doesNotMatch(editorsSource, /CommandInput|CommandItem|CommandList/u);
	assert.match(detailsSource, /<MetadataSearchPicker/u);
	assert.match(detailsSource, /className=\{METADATA_PICKER_POPOVER_CLASS\}/u);
	assert.equal(
		(`${editorsSource}\n${detailsSource}`.match(/positionerClassName=\{METADATA_PICKER_POSITIONER_CLASS\}/gu) ?? []).length,
		8,
	);
	assert.doesNotMatch(`${editorsSource}\n${detailsSource}`, /positionerClassName="z-\[502\]"/u);
	assert.doesNotMatch(detailsSource, /CommandInput|CommandItem|CommandList/u);
	assert.match(editorsSource, /const agents = CREW_ROSTER\.filter\(\(member\) => member\.kind === "agent"\);/u);
	assert.doesNotMatch(editorsSource, /Search people and agents|CommandGroup heading="People"/u);
});
