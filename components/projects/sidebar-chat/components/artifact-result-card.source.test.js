const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ARTIFACT_RESULT_CARD_SOURCE = fs.readFileSync(
	path.join(__dirname, "artifact-result-card.tsx"),
	"utf8",
);

test("ArtifactResultCard reports dialog lifecycle around generated artifact previews", () => {
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/onDialogOpen\?: \(artifact: ArtifactResult\) => void;/,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/onDialogClose\?: \(artifact: ArtifactResult\) => void;/,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/<Dialog open=\{isOpen\} onOpenChange=\{handleOpenChange\}>/,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/if \(open\) \{\s*onDialogOpen\?\.\(artifact\);\s*\} else \{\s*onDialogClose\?\.\(artifact\);/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/const handleOpenArtifact = \(\) => \{/,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/handleOpenChange\(true\);/,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/onClick=\{\(\) => handleOpenChange\(false\)\}/,
	);
});

test("ArtifactResultCard opens HTML reports in an embedded Rovo Canvas dialog", () => {
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/import \{ ArtifactCard, ARTIFACT_KIND_LABELS, type ArtifactKind \} from "@\/components\/blocks\/artifact";/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/import \{ RovoCanvas, type RovoCanvasStatus, type RovoCanvasVersion, type RovoCanvasView \} from "@\/components\/blocks\/rovo-canvas\/page";/u,
	);
	assert.doesNotMatch(ARTIFACT_RESULT_CARD_SOURCE, /import RovoPage/u);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/const shouldOpenInRovoCanvas = artifact\.kind === "html";/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/window\.addEventListener\("rovo:open-canvas-artifact", handleCanvasLink\);/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/window\.setTimeout\(\(\) => \{\s*setIsCardExpanded\(false\);\s*if \(event\.defaultPrevented\) \{\s*return;\s*\}\s*handleOpenChange\(true\);/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/const openCanvasEvent = new CustomEvent\("rovo:open-canvas-artifact", \{[\s\S]*cancelable: true,[\s\S]*documentId: artifact\.documentId,[\s\S]*threadId: canvasThreadId,[\s\S]*source: "artifact-result-card",/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/if \(openCanvasEvent\.defaultPrevented\) \{\s*return;\s*\}/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/<RovoCanvas[\s\S]*open=\{isOpen\}[\s\S]*onOpenChange=\{handleOpenChange\}[\s\S]*kind="report"[\s\S]*views=\{canvasViews\}/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/const \[selectedVersionId, setSelectedVersionId\] = useState<string \| null>\(null\);/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/const selectedVersion = getSelectedDocumentVersion\(document, selectedVersionId\);[\s\S]*const selectedContent = selectedVersion\?\.content \?\? latestContent;/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/buildCanvasVersionHistory\(document, selectedVersionId\)/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/onVersionSelect=\{setSelectedVersionId\}[\s\S]*versionHistory=\{canvasVersionHistory\}/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/<ArtifactCard[\s\S]*displayMode="preview"[\s\S]*onOpen=\{handleOpenArtifact\}[\s\S]*previewSummary=\{document\?\.previewSummary \?\? undefined\}[\s\S]*versionNumber=\{document\?\.versions\.length \?\? 1\}/u,
	);
	assert.doesNotMatch(
		ARTIFACT_RESULT_CARD_SOURCE,
		/router\.push/u,
	);
	assert.doesNotMatch(
		ARTIFACT_RESULT_CARD_SOURCE,
		/Open in Canvas/u,
	);
});

test("ArtifactResultCard collapses the source card after moving an HTML report to canvas", () => {
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/const \[isCardExpanded, setIsCardExpanded\] = useState\(true\);/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/window\.dispatchEvent\(openCanvasEvent\);\s*setIsCardExpanded\(false\);\s*if \(openCanvasEvent\.defaultPrevented\) \{/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/window\.setTimeout\(\(\) => \{\s*setIsCardExpanded\(false\);\s*if \(event\.defaultPrevented\) \{\s*return;\s*\}\s*handleOpenChange\(true\);/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/<ArtifactCard[\s\S]*displayMode="preview"[\s\S]*expanded=\{isCardExpanded\}[\s\S]*onExpandedChange=\{setIsCardExpanded\}/u,
	);
});

test("ArtifactResultCard shows a text skeleton while the HTML report summary is loading", () => {
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/import \{ Skeleton \} from "@\/components\/ui\/skeleton";/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/function ArtifactResultCardPreviewSkeleton\(\): ReactNode/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/aria-label="Artifact preview loading"[\s\S]*<Skeleton className="h-4 w-full" \/>[\s\S]*<Skeleton className="h-4 w-full" \/>[\s\S]*<Skeleton className="h-4 w-3\/4" \/>/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/const isPreviewSummaryPending = shouldOpenInRovoCanvas && !document && !errorMessage;/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/<ArtifactCard[\s\S]*previewSummary=\{document\?\.previewSummary \?\? undefined\}[\s\S]*\{isPreviewSummaryPending \? <ArtifactResultCardPreviewSkeleton \/> : null\}[\s\S]*<\/ArtifactCard>/u,
	);
});

test("ArtifactResultCard can render a route-owned inline document without backend persistence", () => {
	assert.match(ARTIFACT_RESULT_CARD_SOURCE, /inlineDocument\?: RovoAppDocument;/u);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/if \(inlineDocument\) \{[\s\S]*setDocument\(inlineDocument\);[\s\S]*setIsLoading\(false\);[\s\S]*return;/u,
	);
	assert.match(
		ARTIFACT_RESULT_CARD_SOURCE,
		/if \(!isOpen && !shouldOpenInRovoCanvas\) \{/u,
	);
});
