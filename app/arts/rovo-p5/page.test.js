const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const LAYOUT_SOURCE = fs.readFileSync(path.join(__dirname, "layout.tsx"), "utf8");
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
const DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../components/website/demos/arts/rovo-p5-demo.tsx"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const VANITY_PAGE_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../rovo-p5/page.tsx"),
	"utf8",
);
const VANITY_LAYOUT_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../rovo-p5/layout.tsx"),
	"utf8",
);
const SIDEBAR_NAV_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../data/website-sidebar-nav.ts"),
	"utf8",
);

test("Rovo p5 route renders the art project directly", () => {
	assert.match(PAGE_SOURCE, /import RovoP5 from "@\/components\/arts\/rovo-p5";/);
	assert.match(PAGE_SOURCE, /<RovoP5 className="min-h-svh" \/>/);
	assert.match(LAYOUT_SOURCE, /import type \{ Metadata \} from "next";/);
	assert.match(LAYOUT_SOURCE, /getArtPageTitle\("rovo-p5"\)/);
	assert.match(LAYOUT_SOURCE, /export const metadata: Metadata = \{/);
	assert.match(LAYOUT_SOURCE, /title: `\$\{title\} — VPK`/);
});

test("Rovo p5 is registered as an arts project", () => {
	assert.match(COMPONENTS_SOURCE, /artComponent\("rovo-p5", "Rovo p5"\)/);
	assert.match(MANIFEST_SOURCE, /artComponent\("rovo-p5", "Rovo p5"\)/);
	assert.match(DETAILS_SOURCE, /"rovo-p5":/);
	assert.match(REGISTRY_SOURCE, /import\("\.\/demos\/arts\/rovo-p5-demo"\)/);
	assert.match(DEMO_SOURCE, /import RovoP5 from "@\/components\/arts\/rovo-p5";/);
});

test("the gallery keeps the lowercase p5 brand spelling", () => {
	// `getArtPageTitle` title-cases each slug segment, so the browser tab reads
	// "Rovo P5" while the catalog card keeps the brand spelling.
	assert.doesNotMatch(MANIFEST_SOURCE, /artComponent\("rovo-p5", "Rovo P5"\)/);
	assert.doesNotMatch(COMPONENTS_SOURCE, /artComponent\("rovo-p5", "Rovo P5"\)/);
});

test("Rovo p5 is reachable from a top-level /rovo-p5 URL", () => {
	// Matches the vanity routes `awake`, `cursors`, and `personal-graph` use,
	// so the art is shareable without the /arts/ prefix.
	assert.match(VANITY_PAGE_SOURCE, /loadDemoComponent\("rovo-p5", "arts"\)/);
	assert.match(VANITY_PAGE_SOURCE, /<Suspense>/);
	assert.match(VANITY_LAYOUT_SOURCE, /getArtPageTitle\("rovo-p5"\)/);
});

test("sidebar wayfinding is derived from the art manifest", () => {
	// The Arts section maps over ART_COMPONENTS, so registering the manifest
	// entry is what surfaces the nav link — nothing is hand-listed.
	assert.match(SIDEBAR_NAV_SOURCE, /title: "Arts"/);
	assert.match(
		SIDEBAR_NAV_SOURCE,
		/items: ART_COMPONENTS\.map\(\(component\) => \(\{[\s\S]*?href: `\/components\/arts\/\$\{component\.slug\}`/,
	);
});
