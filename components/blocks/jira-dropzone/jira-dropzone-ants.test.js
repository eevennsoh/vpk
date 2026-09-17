const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
	JIRA_DROPZONE_ANTS_CLASS,
	JIRA_DROPZONE_ANTS_DASHARRAY,
	JIRA_DROPZONE_ANTS_PERIOD_PX,
	JIRA_DROPZONE_ANTS_STROKE_CLASS,
} = require("./lib/jira-dropzone-ants.ts");

const DROPZONE = readFileSync(path.join(__dirname, "jira-dropzone.tsx"), "utf8");
const STROKE = readFileSync(path.join(__dirname, "jira-dropzone-ants-stroke.tsx"), "utf8");
const PAGE = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const CREATE_WELL = readFileSync(
	path.join(__dirname, "../jira-kanban/experimental/components/create-work-item-drop-zone.tsx"),
	"utf8",
);
const GLOBALS = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const DETAIL = readFileSync(
	path.join(process.cwd(), "app/data/details/blocks/jira-dropzone.ts"),
	"utf8",
);

test("ants keep the existing dashed well chrome and only move the stroke", () => {
	assert.equal(JIRA_DROPZONE_ANTS_CLASS, "jira-dropzone-ants");
	assert.equal(JIRA_DROPZONE_ANTS_STROKE_CLASS, "jira-dropzone-ants-stroke");
	assert.equal(JIRA_DROPZONE_ANTS_DASHARRAY, "3 3");
	assert.equal(JIRA_DROPZONE_ANTS_PERIOD_PX, 6);
	assert.match(
		DROPZONE,
		/export const JIRA_DROPZONE_WELL_CHROME_CLASS = "rounded-lg border border-dashed";/u,
	);
	assert.match(
		DROPZONE,
		/selected\s*\n\t\t\t\t\t\? "border-border-selected bg-bg-selected text-text-selected"\n\t\t\t\t\t: "border-border bg-surface text-text-subtlest"/u,
	);
	assert.match(DROPZONE, /marching \? JIRA_DROPZONE_ANTS_CLASS : null/u);
	assert.match(DROPZONE, /marching \? <JiraDropzoneAntsStroke selected=\{selected\} \/> : null/u);
	assert.match(DROPZONE, /const marching = active && ants && !shouldReduceMotion;/u);
	assert.doesNotMatch(DROPZONE, /border-transparent|jiraDropzoneAntsChromeClass/u);
	assert.doesNotMatch(STROKE, /strokeWidth="2"|filter=|glow/u);
});

test("JiraDropzone defaults ants on and the create well inherits that default", () => {
	assert.match(DROPZONE, /ants = true/u);
	assert.match(DROPZONE, /data-jira-dropzone-ants=\{ants \? "on" : "off"\}/u);
	assert.match(
		CREATE_WELL,
		/ants = true[\s\S]*<JiraDropzone[\s\S]*ants=\{ants\}/u,
	);
});

test("the catalog switch defaults ants on and can turn them off", () => {
	assert.match(PAGE, /const \[ants, setAnts\] = useState\(true\)/u);
	assert.match(PAGE, /id="jira-dropzone-ants"/u);
	assert.match(PAGE, /label="Marching ants"/u);
	assert.match(PAGE, /<JiraDropzone[\s\S]*ants=\{ants\}/u);
	assert.match(DETAIL, /name: "ants"/u);
	assert.match(DETAIL, /default: "true"/u);
});

test("ants utility offsets the 1px stroke and freezes it when motion is reduced", () => {
	assert.match(GLOBALS, /@utility jira-dropzone-ants \{/u);
	assert.match(GLOBALS, /@utility jira-dropzone-ants-stroke \{/u);
	assert.match(GLOBALS, /stroke-dashoffset: -6px;/u);
	assert.match(GLOBALS, /stroke-dasharray: 3 3;/u);
	assert.match(GLOBALS, /stroke-width: 1px;/u);
	assert.match(
		GLOBALS,
		/animation: jira-dropzone-ants var\(--duration-slowest\) var\(--ease-linear\) infinite/u,
	);
	assert.match(
		GLOBALS,
		/@media \(prefers-reduced-motion: reduce\) \{\s*animation: none;\s*visibility: hidden;/u,
	);
	const antsBlock = GLOBALS.slice(
		GLOBALS.indexOf("/* Dropzone well:"),
		GLOBALS.indexOf("@utility jira-dropzone-ants-stroke {") + 800,
	);
	assert.doesNotMatch(antsBlock, /repeating-linear-gradient/u);
	assert.doesNotMatch(antsBlock, /&::before/u);
});
