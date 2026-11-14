const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ARTIFACT_SOURCE = fs.readFileSync(path.join(__dirname, "artifact.tsx"), "utf8");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Artifact is registered as a website block in all four registries", () => {
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("artifact"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("artifact"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ ArtifactCard \} from "@\/components\/blocks\/artifact";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/artifact: dynamic\(\(\) => import\("\.\/demos\/blocks\/artifact-demo"\)/u,
	);
});

test("ArtifactCard presents html artifacts as PDFs with acronym casing", () => {
	assert.match(ARTIFACT_SOURCE, /html: "PDF"/u);
	assert.match(ARTIFACT_SOURCE, /function formatArtifactKindActionLabel\(kindLabel: string\): string/u);
	assert.match(ARTIFACT_SOURCE, /\? kindLabel\s*: kindLabel\.toLowerCase\(\);/u);
	assert.match(ARTIFACT_SOURCE, /const actionKindLabel = formatArtifactKindActionLabel\(kindLabel\);/u);
	assert.match(
		ARTIFACT_SOURCE,
		/resolvedOpenCtaLabel = openCtaLabel \?\? `Open \$\{actionKindLabel\}`/u,
	);
	assert.doesNotMatch(ARTIFACT_SOURCE, /html: "HTML report"/u);
	assert.doesNotMatch(ARTIFACT_SOURCE, /Open \$\{kindLabel\.toLowerCase\(\)\}/u);
});

test("ArtifactCard preview footer does not add a second border stroke", () => {
	assert.match(
		ARTIFACT_SOURCE,
		/<GenerativeCardFooter className="border-t-0 bg-transparent pt-0">/u,
	);
});

test("ArtifactPanel uses the Rovo Canvas version-history treatment instead of a select trigger", () => {
	assert.match(ARTIFACT_SOURCE, /function ArtifactVersionHistoryPanel/u);
	assert.match(
		ARTIFACT_SOURCE,
		/<TooltipTrigger[\s\S]*render=\{[\s\S]*<Button[\s\S]*aria-label="Version history"[\s\S]*aria-pressed=\{shouldShowVersionHistory \? true : undefined\}[\s\S]*<ClockIcon className="size-4" \/>/u,
	);
	assert.match(
		ARTIFACT_SOURCE,
		/<ArtifactVersionHistoryPanel[\s\S]*document=\{document\}[\s\S]*onVersionChange=\{onVersionChange\}[\s\S]*selectedVersionId=\{selectedVersion\?\.id \?\? null\}/u,
	);
	assert.match(
		ARTIFACT_SOURCE,
		/onClick=\{\(\) => onVersionChange\(version\.id\)\}/u,
	);
	assert.doesNotMatch(ARTIFACT_SOURCE, /SelectTrigger/u);
	assert.doesNotMatch(ARTIFACT_SOURCE, /aria-label="Artifact version"/u);
});

test("ArtifactPanel reuses Intl formatters across version history rows", () => {
	assert.match(
		ARTIFACT_SOURCE,
		/const ARTIFACT_VERSION_HISTORY_GROUP_DATE_FORMATTER = new Intl\.DateTimeFormat\("en-US", \{ dateStyle: "medium" \}\);/u,
	);
	assert.match(
		ARTIFACT_SOURCE,
		/const ARTIFACT_VERSION_HISTORY_TIMESTAMP_FORMATTER = new Intl\.DateTimeFormat\("en-US", \{[\s\S]*dateStyle: "medium",[\s\S]*timeStyle: "short",[\s\S]*\}\);/u,
	);
	assert.match(
		ARTIFACT_SOURCE,
		/return ARTIFACT_VERSION_HISTORY_GROUP_DATE_FORMATTER\.format\(date\);/u,
	);
	assert.match(
		ARTIFACT_SOURCE,
		/return ARTIFACT_VERSION_HISTORY_TIMESTAMP_FORMATTER\.format\(date\);/u,
	);
	assert.doesNotMatch(
		ARTIFACT_SOURCE,
		/return new Intl\.DateTimeFormat\("en-US"/u,
	);
});

test("ArtifactPanel renders annotations through the shared annotation layer", () => {
	assert.match(ARTIFACT_SOURCE, /export function ArtifactAnnotationLayer/u);
	assert.match(
		ARTIFACT_SOURCE,
		/<ArtifactAnnotationLayer[\s\S]*annotations=\{annotations\}[\s\S]*onAddComment=\{onAddComment\}[\s\S]*onDismissSelection=\{onDismissSelection\}[\s\S]*onRemoveAnnotation=\{onRemoveAnnotation\}[\s\S]*pendingSelection=\{pendingSelection\}/u,
	);
	assert.match(
		ARTIFACT_SOURCE,
		/function PendingAnnotationPopover/u,
	);
});
