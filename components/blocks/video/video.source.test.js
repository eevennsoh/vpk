const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Video is registered as a block in every catalog surface", () => {
	assert.match(readProjectFile("app/data/components.ts"), /blockComponent\("video", "Video"\)/u);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("video", "Video"\)/u,
	);
	assert.match(readDetailCategorySource("blocks"), /video: VIDEO_DETAIL,/u);
	assert.match(
		readWebsiteRegistrySource(),
		/video: dynamic\(\(\) => import\("\.\/demos\/blocks\/video-demo"\)/u,
	);
});

test("the shipped sample video asset exists under public/", () => {
	assert.ok(
		fs.existsSync(path.join(process.cwd(), "public/videos/debug-video.mp4")),
		"public/videos/debug-video.mp4 is missing; the block's sample rows would 404",
	);
});

test("every sample video row points at an asset that exists on disk", () => {
	const source = readProjectFile("components/blocks/video/data/sample-videos.ts");
	const sources = [...source.matchAll(/src: "(\/videos\/[^"]+)"/gu)].map((match) => match[1]);

	assert.ok(sources.length > 0, "expected at least one sample video src");
	for (const src of sources) {
		assert.ok(
			fs.existsSync(path.join(process.cwd(), "public", src)),
			`sample video src ${src} has no file under public/`,
		);
	}
});

test("artifact rows are derived from the video records so a row cannot drift from its file", () => {
	const source = readProjectFile("components/blocks/video/data/sample-videos.ts");

	assert.match(source, /VIDEO_ARTIFACT_ROWS: readonly ArtifactListItem\[\] = SAMPLE_VIDEO_ARTIFACTS\.map/u);
	assert.match(source, /rowActionLabel: "Play"/u);
});

test("the block triggers the player from an artifact list row, not a bespoke list", () => {
	const source = readProjectFile("components/blocks/video/page.tsx");

	assert.match(source, /import \{ ArtifactList \} from "@\/components\/ui-custom\/artifact-list";/u);
	assert.match(source, /const video = findVideoArtifact\(item\.id\);/u);
});

test("open state and content lifetime are separate so the popup keeps its frame while closing", () => {
	const page = readProjectFile("components/blocks/video/page.tsx");

	// Regression: a single `activeVideo` driving `open` unmounted the player the
	// instant it went null, so the dialog spent its 200ms exit as a collapsed box
	// whose title had fallen back to "Video preview".
	assert.match(page, /const \[activeVideo, setActiveVideo\] = useState<VideoArtifact \| null>\(null\);/u);
	assert.match(page, /const \[isPreviewOpen, setIsPreviewOpen\] = useState\(false\);/u);
	assert.match(page, /open=\{isPreviewOpen\}/u);
	assert.match(page, /onOpenChange=\{setIsPreviewOpen\}/u);
	assert.match(page, /onClosed=\{\(\) => setActiveVideo\(null\)\}/u);
	assert.doesNotMatch(
		page,
		/open=\{activeVideo !== null\}/u,
		"deriving `open` from the content again would reintroduce the collapse-mid-fade bug",
	);
});

test("the preview dialog unmounts the player after the exit so audio cannot keep playing", () => {
	const source = readProjectFile("components/blocks/video/components/video-preview-dialog.tsx");

	// Unmount is deferred to onOpenChangeComplete rather than dropped entirely:
	// Base UI fires it immediately when there is no transition, so reduced-motion
	// users still get the unmount that stops playback.
	assert.match(source, /onOpenChangeComplete=\{\(isOpen\) => \{/u);
	assert.match(source, /if \(!isOpen\) onClosed\(\);/u);
	assert.match(source, /\{video \? \(/u);
	assert.doesNotMatch(
		source,
		/keepMounted/u,
		"keeping the dialog mounted would leave a hidden <video> playing after close",
	);
});

test("player auto-hide motion is token-sourced and honors reduced motion", () => {
	const source = readProjectFile("components/blocks/video/components/video-player.tsx");

	assert.match(
		source,
		/\[--media-control-transition-in:opacity_var\(--duration-normal\)_var\(--ease-out-practical\)\]/u,
	);
	assert.match(
		source,
		/\[--media-control-transition-out:opacity_var\(--duration-fast\)_var\(--ease-in\)\]/u,
	);
	assert.match(source, /motion-reduce:\[--media-control-transition-in:none\]/u);
	assert.match(source, /motion-reduce:\[--media-control-transition-out:none\]/u);
});

test("the media element carries an accessible name", () => {
	const source = readProjectFile("components/blocks/video/components/video-player.tsx");

	assert.match(source, /aria-label=\{label\}/u);
	assert.match(source, /slot="media"/u);
});
