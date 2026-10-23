// Two gate measurers in happy-dom. Caption-echo (P4 item 23): repeated and short words never inflate the shared
// count, and an SVG title or aria-label echo needs the shared words to cover most of the caption. Motion-budget
// (P4 item 25): the shared house style is skipped, so only authored motion warns. The measurers run in the page in
// production (runGates serialises them); here they run against a happy-dom document.
import assert from "node:assert/strict";
import test from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { loadThresholds, measureCaptionEcho, measureMotionBudget } from "./gates.mjs";

const thresholds = loadThresholds().captionEcho;

/** Findings for one figure under an optional heading. */
async function echoes({ heading = "", label = "", title = "", caption }) {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	try {
		const svgTitle = title ? `<title>${title}</title>` : "";
		const aria = label ? ` aria-label="${label}"` : "";
		document.body.innerHTML = `<main><section>${heading ? `<h2>${heading}</h2>` : ""}<figure><svg viewBox="0 0 10 10" role="img"${aria}>${svgTitle}<rect width="4" height="4"></rect></svg><figcaption>${caption}</figcaption></figure></section></main>`;
		return measureCaptionEcho(thresholds);
	} finally {
		await GlobalRegistrator.unregister();
	}
}

const LABEL = "Isometric three-tier cache stack. CDN above app cache above database. The app cache is focal; on explode the app cache lifts first.";

test("thresholds carry the 60% caption coverage beside the 3 shared words", () => {
	assert.equal(thresholds.minSharedWords, 3);
	assert.equal(thresholds.minCaptionCoverage, 0.6);
});

test("a caption that names its subject but adds a fact is not an echo of a long aria-label", async () => {
	const findings = await echoes({ label: LABEL, caption: "The app cache is the focal tier. It serves reads before the database sees them." });
	assert.deepEqual(findings, []);
});

test("a caption that restates the aria-label or the svg title still warns", async () => {
	const restated = await echoes({ label: LABEL, caption: "Isometric three-tier cache stack: CDN above app cache above database." });
	assert.equal(restated.length, 1);
	assert.match(restated[0], /^caption echoes "Isometric three-tier cache stack/);
	const titled = await echoes({ title: "Three-tier cache stack with CDN, app cache and database", caption: "Three-tier cache stack with CDN, app cache and database" });
	assert.equal(titled.length, 1);
});

test("a repeated word counts once", async () => {
	const findings = await echoes({ label: "Cache layer: cache hit, cache miss, cache fill", caption: "Cache hit rate stays high" });
	assert.deepEqual(findings, [], "cache and hit are 2 distinct shared words, below 3");
});

test("words of 2 characters or fewer never count", async () => {
	const findings = await echoes({ heading: "Cache on CDN or DB", caption: "Cache on CDN or DB nodes" });
	assert.deepEqual(findings, [], "only cache and cdn are content words");
});

test("a heading echo still needs only the 3 shared words", async () => {
	const findings = await echoes({ heading: "Cache stack layers explained", caption: "Cache stack layers shown" });
	assert.equal(findings.length, 1);
	assert.match(findings[0], /^caption echoes "Cache stack layers explained"/);
});

/** Motion-budget findings for a document whose head holds the given style blocks. */
async function slow(...styles) {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	try {
		document.head.innerHTML = styles.map(css => `<style>${css}</style>`).join("");
		document.body.innerHTML = "<main></main>";
		return measureMotionBudget(loadThresholds().motionBudget);
	} finally {
		await GlobalRegistrator.unregister();
	}
}

test("motion-budget skips the shared house style and the presentation CSS but still flags authored motion", async () => {
	const house = [
		"/* vpk-shared:start */\n.chart { animation: vpk-chart-draw 640ms ease both; }\n/* vpk-shared:end */",
		"/* vpk-algebrica-v2:start */\n.card { transition: opacity 520ms; }\n/* vpk-algebrica-v2:end */",
	].join("\n");
	const presentation = "/* vpk presentation mode */\nbody[data-vpk-docnav] main > section { transition: opacity 560ms, transform 420ms; }\n";
	assert.deepEqual(await slow(`${house}\n.mine { color: red; }\n${presentation}`), [], "only house CSS is slow");
	const mine = await slow(`${house}\n.hero { transition: transform 900ms ease; }\n${presentation}`);
	assert.equal(mine.length, 1);
	assert.match(mine[0], /^style block #1: 900ms exceeds 300ms motion budget$/);
	assert.equal((await slow(".a { animation: spin 1.2s linear infinite; }")).length, 1, "seconds convert to milliseconds");
});
