const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const LAYOUT_SOURCE = fs.readFileSync(path.join(__dirname, "layout.tsx"), "utf8");
const COMPONENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../components/arts/rovo-fable/index.tsx"),
	"utf8",
);
const COMPONENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../data/component-manifest.ts"),
	"utf8",
);
const MANIFEST_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../data/component-manifest.ts"),
	"utf8",
);
const DETAILS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../data/details/arts.ts"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../components/website/demos/arts/rovo-fable-demo.tsx"),
	"utf8",
);
const HYPERFRAMES_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../public/arts/rovo-fable/hyperframes/index.html"),
	"utf8",
);
const HYPERFRAMES_ILLUSTRATIONS_DIR = path.join(
	__dirname,
	"../../../public/arts/rovo-fable/hyperframes/illustrations",
);
const FRAMES_DIR = path.join(
	__dirname,
	"../../../public/arts/rovo-fable/frames",
);
const FRAME_FILES = fs.readdirSync(FRAMES_DIR).filter((file) => file.endsWith(".png")).sort();
const ILLUSTRATION_FILES = fs
	.readdirSync(HYPERFRAMES_ILLUSTRATIONS_DIR)
	.filter((file) => file.endsWith(".svg"))
	.sort();

test("Rovo Fable route renders the art project directly", () => {
	assert.match(PAGE_SOURCE, /import RovoFable from "@\/components\/arts\/rovo-fable";/);
	assert.match(PAGE_SOURCE, /<RovoFable className="min-h-svh" \/>/);
	assert.match(LAYOUT_SOURCE, /import type \{ Metadata \} from "next";/);
	assert.match(LAYOUT_SOURCE, /getArtPageTitle\("rovo-fable"\)/);
	assert.match(LAYOUT_SOURCE, /export const metadata: Metadata = \{/);
	assert.match(LAYOUT_SOURCE, /title: `\$\{title\} — VPK`/);
});

test("Rovo Fable is registered as an arts project", () => {
	assert.match(COMPONENTS_SOURCE, /artComponent\("rovo-fable", "Rovo Fable"\)/);
	assert.match(MANIFEST_SOURCE, /artComponent\("rovo-fable", "Rovo Fable"\)/);
	assert.match(DETAILS_SOURCE, /"rovo-fable":/);
	assert.match(REGISTRY_SOURCE, /import\("\.\/demos\/arts\/rovo-fable-demo"\)/);
	assert.match(DEMO_SOURCE, /import RovoFable from "@\/components\/arts\/rovo-fable";/);
});

test("Rovo Fable embeds the HyperFrames glyph reel made from the uploaded symbol", () => {
	assert.match(COMPONENT_SOURCE, /src="\/arts\/rovo-fable\/rovo-fable\.mp4"/);
	assert.match(COMPONENT_SOURCE, /href="\/arts\/rovo-fable\/hyperframes\/index\.html"/);
	assert.match(COMPONENT_SOURCE, /src="\/arts\/rovo-fable\/symbol\.png"/);
	assert.deepEqual(FRAME_FILES, [
		"01-01-botanical.png",
		"02-02-postage.png",
		"03-03-spectral.png",
		"04-04-city-map.png",
		"05-05-mechanical.png",
		"06-06-coastline.png",
		"07-07-blueprint.png",
		"08-08-cyanotype.png",
		"09-09-root-network.png",
		"10-10-red-dot-grid.png",
		"11-11-fluorescent-cell.png",
		"12-12-xray-circuit.png",
		"13-13-antique-coin.png",
		"14-14-sheet-music.png",
		"15-15-specimen.png",
		"16-16-proof.png",
		"17-17-butterfly-specimen.png",
		"18-18-medieval-text.png",
	]);
	for (const frameFile of FRAME_FILES) {
		assert.ok(
			fs.statSync(path.join(FRAMES_DIR, frameFile)).size > 100_000,
			`${frameFile} should be a durable generated frame asset`,
		);
	}
	assert.match(HYPERFRAMES_SOURCE, /data-composition-id="rovo-fable"/);
	assert.match(HYPERFRAMES_SOURCE, /data-duration="16"/);
	assert.match(HYPERFRAMES_SOURCE, /data-width="1080"/);
	assert.match(HYPERFRAMES_SOURCE, /data-height="1080"/);
		assert.match(HYPERFRAMES_SOURCE, /\.opener \{[^}]+background: #fff/);
		assert.match(HYPERFRAMES_SOURCE, /\.opener-card \{[^}]+background: #fff/);
		assert.match(HYPERFRAMES_SOURCE, /\.flash \{[^}]+background: #fff/);
		assert.match(HYPERFRAMES_SOURCE, /\.final-card \{[^}]+background: #fff/);
		assert.match(HYPERFRAMES_SOURCE, /backgroundColor: "#fff"/);
		assert.match(HYPERFRAMES_SOURCE, /src="songs\.mp3"/);
		assert.match(HYPERFRAMES_SOURCE, /id="song"[^>]+data-duration="14\.95"/);
	assert.deepEqual(ILLUSTRATION_FILES, [
		"ai.svg",
		"brainstorm.svg",
		"chat.svg",
		"code.svg",
		"create.svg",
		"enhanced-smart-answer.svg",
		"help.svg",
		"megaphone.svg",
		"search.svg",
		"summarize.svg",
		"write.svg",
	].sort());
	assert.match(HYPERFRAMES_SOURCE, /const openerIllustrations = /);
	assert.match(HYPERFRAMES_SOURCE, /enhanced-smart-answer/);
	assert.doesNotMatch(HYPERFRAMES_SOURCE, /deep-research|ai-first-jira|mode|error/);
	assert.match(HYPERFRAMES_SOURCE, /illustrations\/'\s\+ item \+ '\.svg/);
	assert.doesNotMatch(HYPERFRAMES_SOURCE, /opener-name/);
	assert.match(HYPERFRAMES_SOURCE, /17-17-butterfly-specimen\.png/);
	assert.match(HYPERFRAMES_SOURCE, /18-18-medieval-text\.png/);
	assert.match(HYPERFRAMES_SOURCE, /const montageStart = 5/);
	assert.match(HYPERFRAMES_SOURCE, /const finalStart = 13/);
	assert.match(HYPERFRAMES_SOURCE, /id="montage"[^>]+data-duration="8"/);
	assert.match(HYPERFRAMES_SOURCE, /id="final-card"[^>]+data-start="13"[^>]+data-duration="3"/);
	assert.match(HYPERFRAMES_SOURCE, /shotStarts/);
	assert.match(HYPERFRAMES_SOURCE, /shotIntervals/);
	assert.match(HYPERFRAMES_SOURCE, /shotDurations/);
	assert.match(HYPERFRAMES_SOURCE, /id="final-logo"/);
	assert.match(HYPERFRAMES_SOURCE, /id="rovo-mask-left"/);
	assert.match(HYPERFRAMES_SOURCE, /id="rovo-mask-right"/);
	assert.match(HYPERFRAMES_SOURCE, /id="rovo-grad-left"/);
	assert.match(HYPERFRAMES_SOURCE, /id="rovo-grad-right"/);
	assert.match(HYPERFRAMES_SOURCE, /logo-gradient-sweep/);
	assert.match(HYPERFRAMES_SOURCE, /#rovo-grad-left-strip/);
	assert.match(HYPERFRAMES_SOURCE, /#rovo-grad-right-strip/);
	assert.doesNotMatch(HYPERFRAMES_SOURCE, /logo-facet-/);
	assert.doesNotMatch(HYPERFRAMES_SOURCE, /id="rovo-button"/);
	assert.doesNotMatch(HYPERFRAMES_SOURCE, /\.rovo-button/);
	assert.doesNotMatch(HYPERFRAMES_SOURCE, /\.shot::after/);
	assert.doesNotMatch(HYPERFRAMES_SOURCE, /\.grain/);
});
