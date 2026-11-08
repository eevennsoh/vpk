#!/usr/bin/env node

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function loadShared() {
	return import("./shared.mjs");
}

function cssRuleBlock(source, selector) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m").exec(source);
	assert.ok(match, `missing CSS rule: ${selector}`);
	return match[1];
}

function cssDeclaration(block, property) {
	const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`${escaped}:\\s*([^;]+);`).exec(block);
	assert.ok(match, `missing CSS declaration: ${property}`);
	return match[1].trim();
}

test("addMainLandmark closes after body content when head contains a script", async () => {
	const { addMainLandmark } = await loadShared();
	const html = `<!doctype html>
<html>
<head>
<script src="/head.js"></script>
</head>
<body class="doc">
<section>Visible content</section>
<script src="/body.js"></script>
</body>
</html>`;

	const result = addMainLandmark(html);
	const headScript = result.indexOf(`<script src="/head.js"></script>`);
	const bodyOpen = result.indexOf(`<body class="doc">`);
	const mainOpen = result.indexOf("<main>");
	const visibleContent = result.indexOf("<section>Visible content</section>");
	const mainClose = result.indexOf("</main>");
	const bodyScript = result.indexOf(`<script src="/body.js"></script>`);

	assert.ok(headScript < bodyOpen, "fixture should keep the head script before body");
	assert.ok(bodyOpen < mainOpen, "main opens inside body");
	assert.ok(mainOpen < visibleContent, "main wraps visible body content");
	assert.ok(visibleContent < mainClose, "main closes after visible body content");
	assert.ok(mainClose < bodyScript, "body scripts stay outside the main landmark");
});

test("addMainLandmark closes before body end when no body script exists", async () => {
	const { addMainLandmark } = await loadShared();
	const result = addMainLandmark("<html><body><article>Report</article></body></html>");

	assert.match(result, /<body>\n<main><article>Report<\/article>\n<\/main><\/body>/);
});

test("addMainLandmark is idempotent — a document with <main> is unchanged", async () => {
	const { addMainLandmark } = await loadShared();
	const once = addMainLandmark("<html><body><article>Report</article></body></html>");
	const twice = addMainLandmark(once);
	assert.equal(twice, once, "re-running addMainLandmark must not double-wrap");
});

test("addLabeledMainLandmark wraps content and sets the aria-label", async () => {
	const { addLabeledMainLandmark } = await loadShared();
	const result = addLabeledMainLandmark(
		`<html><body>\n<section>Demo</section>\n<script src="/x.js"></script></body></html>`,
		"curated demo",
	);
	assert.match(result, /<main aria-label="curated demo">/, "labeled main carries the aria-label");
	const mainClose = result.indexOf("</main>");
	const bodyScript = result.indexOf(`<script src="/x.js"></script>`);
	assert.ok(mainClose >= 0 && mainClose < bodyScript, "main closes before the trailing body script");
});

test("addLabeledMainLandmark is idempotent", async () => {
	const { addLabeledMainLandmark } = await loadShared();
	const once = addLabeledMainLandmark("<html><body><article>Demo</article></body></html>", "demo");
	const twice = addLabeledMainLandmark(once, "demo");
	assert.equal(twice, once, "re-running addLabeledMainLandmark must not double-wrap");
});

test("rewriteKamiColors maps raw kami hex to vpk semantic aliases", async () => {
	const { rewriteKamiColors } = await import("./kami-color-map.mjs");
	const out = rewriteKamiColors("color: #f5f4ed; background: #141413;");
	assert.match(out, /var\(--paper\)/, "kami parchment maps to --paper");
	assert.match(out, /var\(--ink\)/, "kami ink maps to --ink");
	assert.doesNotMatch(out, /#f5f4ed|#141413/, "no raw kami literals remain");
});

test("buildStylesCssFromTokens emits the shared motion contract", async () => {
	const { buildStylesCssFromTokens } = await loadShared();
	const css = buildStylesCssFromTokens();

	assert.match(css, /--ease-out:\s*cubic-bezier\(0\.16,1,0\.3,1\);/);
	assert.match(css, /--ease-in-out:\s*cubic-bezier\(0\.65,0,0\.35,1\);/);
	assert.match(css, /--vpk-dur-enter:\s*140ms;/);
	assert.match(css, /@keyframes vpk-enter/);
	assert.match(css, /@keyframes vpk-slide-in/);
	assert.match(css, /@keyframes vpk-chart-draw/);
	assert.match(css, /@keyframes vpk-chart-grow/);
	assert.match(css, /@keyframes vpk-chart-focal-pulse/);
	assert.match(css, /\.vpk-chart-draw[\s\S]*stroke-dasharray:\s*var\(--vpk-draw-length, 1\);/);
	assert.match(css, /\.vpk-chart-grow[\s\S]*transform-origin:\s*center bottom;/);
	assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vpk-chart-draw[\s\S]*stroke-dashoffset:\s*0 !important;/);
	assert.match(css, /transform:\s*var\(--vpk-slide-enter-from, translateX\(24px\)\);/);
	assert.match(css, /transform:\s*var\(--vpk-slide-enter-to, translateX\(0\)\);/);
	assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*--vpk-enter-y:\s*0px;/);
	assert.match(css, /@media print[\s\S]*animation:\s*none !important;/);
	assert.doesNotMatch(css, /(^|[^-])ease-in(?!-)/i);
	assert.doesNotMatch(css, /--grid-(?:background|dot|line|major|dot-gap)/);

	const enterDuration = Number(css.match(/--vpk-dur-enter:\s*(\d+)ms;/)?.[1]);
	assert.ok(enterDuration <= 300, "entrance duration stays under 300ms");
});

test("quality gate command surface includes focal and tidy audit gates", async () => {
	const { loadThresholds } = await import("./gates.mjs");
	const thresholds = loadThresholds();
	const buildSource = fs.readFileSync(path.join(__dirname, "build.mjs"), "utf8");

	assert.equal(thresholds.focal.maxFocalElements, 1);
	assert.equal(thresholds.motionBudget.maxDurationMs, 300);
	assert.equal(thresholds.captionEcho.minSharedWords, 3);
	assert.match(buildSource, /--check-focal/);
	assert.match(buildSource, /--check-motion-budget/);
	assert.match(buildSource, /--check-caption-echo/);
});

test("enhancement scroll fades are scoped to the active page container region", () => {
	const source = fs.readFileSync(path.join(__dirname, "inject-enhancements.mjs"), "utf8");

	assert.match(source, /left:\s*var\(--vpkh-scroll-fade-left,\s*0\);/);
	assert.match(source, /width:\s*var\(--vpkh-scroll-fade-width,\s*100vw\);/);
	assert.match(source, /\.vpkh-scroll-fade\[data-visible="true"\]/);
	assert.match(source, /const scrollFades = new Map\(\);/);
	assert.match(source, /function readScrollRegionCandidate\(selector\)/);
	assert.match(source, /const selectors = \["\.site-container", "\.page", "\.sheet", "\.doc-page", "\.document-page", "\.post-content", "\.site-column-main", "main", "body"\];/);
	assert.match(source, /for \(const selector of selectors\) \{[\s\S]*const region = readScrollRegionCandidate\(selector\);[\s\S]*if \(region\) return region;/);
	assert.match(source, /return \{ left: 0, width: window\.innerWidth \};/);
	assert.match(source, /const candidate = document\.querySelector\(selector\);/);
	assert.match(source, /function setScrollFade\(edge, visible, region\)/);
	assert.match(source, /function pollScrollFades\(\)/);
	assert.match(source, /document\.addEventListener\("scroll", scheduleScrollUpdate, \{ passive: true, capture: true \}\);/);
	assert.match(source, /window\.setInterval\(pollScrollFades, 250\);/);
	assert.doesNotMatch(source, /html\.vpkh-has-scroll\.vpkh-show-top \.vpkh-scroll-fade/);
});

test("enhancement control chrome uses ink text and 34px theme toggle", () => {
	const source = fs.readFileSync(path.join(__dirname, "inject-enhancements.mjs"), "utf8");
	const root = cssRuleBlock(source, ":root");
	const themeToggle = cssRuleBlock(source, ".vpk-theme-toggle");

	assert.equal(cssDeclaration(root, "--vpk-control-text"), "var(--ink)");
	assert.equal(cssDeclaration(themeToggle, "width"), "34px");
	assert.equal(cssDeclaration(themeToggle, "height"), "34px");
});

test("module index heading and rows keep matching gap", () => {
	const source = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
	const heading = cssRuleBlock(source, ".module-index-heading");
	const post = cssRuleBlock(source, ".module-index-post");

	assert.equal(cssDeclaration(heading, "gap"), "5px");
	assert.equal(cssDeclaration(post, "gap"), "5px");
});

// Every `property: value` declaration in `css` with the stack of enclosing at-rule preludes
// (`@media ...`, `@supports ...`) it sits in. Comments are dropped first; plain rule blocks do not
// extend the stack, so only conditional-group at-rules appear in `context`.
function declarationsWithContext(css, property) {
	const found = [];
	const stack = [];
	let prelude = "";
	const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === "{") {
			stack.push(prelude.trim().startsWith("@") ? prelude.trim() : "");
			prelude = "";
		} else if (char === "}") {
			stack.pop();
			prelude = "";
		} else if (char === ";") {
			const declaration = prelude.trim();
			if (declaration.startsWith(`${property}:`)) found.push({ value: declaration.slice(property.length + 1).trim(), context: stack.filter(Boolean) });
			prelude = "";
		} else {
			prelude += char;
		}
	}
	return found;
}

test("B2 decision 14: the view() section reveal never applies under prefers-reduced-motion: reduce", async () => {
	const { buildMotionCssBlock } = await loadShared();
	const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
	for (const [label, css] of [["buildMotionCssBlock()", buildMotionCssBlock()], ["styles.css", styles]]) {
		const timelines = declarationsWithContext(css, "animation-timeline");
		assert.ok(timelines.length >= 1, `${label} still declares the scroll-driven section reveal`);
		for (const { value, context } of timelines) {
			assert.equal(value, "view()", `${label}: the only animation-timeline is view()`);
			assert.ok(context.includes("@media (prefers-reduced-motion: no-preference)"), `${label}: view() is declared outside @media (prefers-reduced-motion: no-preference): ${JSON.stringify(context)}`);
			assert.ok(context.includes("@supports (animation-timeline: view())"), `${label}: view() keeps its @supports guard`);
		}
	}
	// The helper sees an unguarded declaration (control), so the assertions above can fail.
	assert.deepEqual(declarationsWithContext("a { animation-timeline: view(); }", "animation-timeline"), [{ value: "view()", context: [] }]);
	assert.deepEqual(declarationsWithContext("@media (prefers-reduced-motion: reduce) { a { animation-timeline: view(); } }", "animation-timeline"), [{ value: "view()", context: ["@media (prefers-reduced-motion: reduce)"] }]);
});

test("github publishing helpers derive stable repo names and validate repo specs", async () => {
	const { deriveRepoName, parseRepoSpec } = await import("./github-pages.mjs");

	assert.equal(deriveRepoName("artifacts/vpk-html/Symphony Explainer/symphony-explainer.html"), "symphony-explainer");
	assert.equal(deriveRepoName("artifacts/vpk-html/!!!/index.html"), "index");
	assert.deepEqual(parseRepoSpec("eevennsoh/symphony-explainer"), {
		owner: "eevennsoh",
		name: "symphony-explainer",
		fullName: "eevennsoh/symphony-explainer",
	});
	assert.throws(() => parseRepoSpec("symphony-explainer"), /owner\/name/);
});

test("github publishing command surface is documented in build and skill docs", () => {
	const skillRoot = path.join(__dirname, "..");
	const buildSource = fs.readFileSync(path.join(__dirname, "build.mjs"), "utf8");
	const skillDoc = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");

	assert.match(buildSource, /--github <file>/);
	assert.match(buildSource, /--repo owner\/name/);
	assert.match(skillDoc, /\/vpk-html --github/);
	assert.match(skillDoc, /GitHub Pages/);
});

test("user render docs route generated HTML into per-slug artifact folders", () => {
	const docs = [
		"SKILL.md",
		"README.md",
		"CHEATSHEET.md",
		"references/brand-profile.md",
		"references/landing.md",
		"references/pdf-export.md",
		"references/production.md",
		"references/contract.md",
		"references/publish.md",
	];
	const skillRoot = path.join(__dirname, "..");

	for (const relativePath of docs) {
		const source = fs.readFileSync(path.join(skillRoot, relativePath), "utf8");
		assert.match(source, /artifacts\/vpk-html\//, `${relativePath} should use the durable vpk-html artifact root`);
		assert.doesNotMatch(source, /docs\/html\/(?:<slug>|my-doc)\.html/, `${relativePath} should not revive the legacy flat docs/html render path`);
	}
});

test("presentation injector detects decks and is idempotent", async () => {
	const { isDeck, retrofitDeck } = await import("./presentation.mjs");
	const html = `<!doctype html><html><head><style>:root { color-scheme: light dark; }</style></head><body><main><section class="slide"><h1>One</h1></section><section class="slide"><h1>Two</h1></section></main></body></html>`;

	assert.equal(isDeck(html), true);
	const once = retrofitDeck(html);
	const twice = retrofitDeck(once);
	assert.equal(twice, once, "deck retrofit is idempotent");
	assert.match(once, /data-vpk-motion="deck"/);
	assert.match(once, /data-vpk-presentation-runtime/);
	assert.match(once, /--vpk-slide-rest-transform:\s*translate\(-50%, -50%\) scale\(var\(--vpk-slide-scale, 1\)\);/);
	assert.match(once, /transform:\s*var\(--vpk-slide-rest-transform\);/);
	assert.match(once, /:not\(\[data-vpk-deck-ready="true"\]\) \.slide:first-of-type/);
	assert.match(once, /document\.body\.dataset\.vpkDeckReady = 'true'/);
	assert.match(once, /presenterWindow\?\.postMessage/);
	assert.match(once, /presenterWindow = window\.open/);
	assert.match(once, /data-vpk-slide-prev/);
	assert.match(once, /data-vpk-slide-next/);
	assert.match(once, /vpk-nav-counter/);
	assert.match(once, /data-vpk-progress-arc/);
	assert.match(once, /\.vpk-slide-counter,[\s\S]*\.docnav-controls\s*\{[\s\S]*gap:\s*4px;[\s\S]*padding:\s*4px;[\s\S]*right:\s*var\(--vpk-pager-right, 24px\);/);
	assert.match(once, /\.vpk-slide-counter button,[\s\S]*\.docnav-controls button\s*\{[\s\S]*height:\s*24px;[\s\S]*width:\s*24px;/);
	assert.match(once, /\.vpk-nav-counter,[\s\S]*\.docnav-counter\s*\{[\s\S]*font-size:\s*11px;[\s\S]*min-width:\s*40px;/);
	assert.match(once, /\.vpk-nav-next-wrap\s*\{[\s\S]*height:\s*24px;[\s\S]*width:\s*24px;/);
	assert.match(once, /stroke-dasharray: var\(--vpk-progress-circumference, 72\.26\);/);
	assert.match(once, /viewBox="0 0 24 24"/);
	assert.match(once, /data-vpk-progress-arc cx="12" cy="12" r="11\.5"/);
	assert.match(once, /width=\\"12\\" height=\\"12\\"/);
	assert.match(once, /opacity:\s*0;/);
	assert.match(once, /const progress = slides\.length <= 1 \? 0 : index \/ \(slides\.length - 1\);/);
	assert.match(once, /arc\.style\.opacity = progress <= 0 \? '0' : '1';/);
	assert.match(once, /stroke-dashoffset 180ms var\(--ease-out\)/);
	assert.doesNotMatch(once, /viewBox="0 0 44 44"/);
	assert.doesNotMatch(once, /vpk-nav-progress__track/);
	assert.match(once, /aria-live="polite"/);
	assert.match(once, /contenteditable="true" role="textbox" aria-label="Speaker notes"/);
	assert.match(once, /\.speaker-notes\s*\{[\s\S]*display:\s*none\s*!important/);
	assert.doesNotMatch(once, /[ \t]+$/m);

	const stale = `<!doctype html><html><head><style>:root { color-scheme: light dark; }
/* vpk presentation mode */
@media screen {
	body[data-vpk-motion="deck"] .slide {
		display: none;
		left: 50%;
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%) scale(var(--vpk-slide-scale, 1));
		transform-origin: center center;
	}
}
</style></head><body data-vpk-motion="deck"><main><section class="slide"><h1>One</h1></section><section class="slide"><h1>Two</h1></section></main><script data-vpk-presentation-runtime>
(() => {
	function broadcast(payload) {
		try { window.opener?.postMessage({ source: 'vpk-deck', ...payload }, '*'); } catch { /* noop */ }
	}
	broadcast({ type: 'state' });
})();
</script></body></html>`;
	const refreshed = retrofitDeck(stale);
	assert.equal((refreshed.match(/vpk presentation mode/g) || []).length, 1);
	assert.equal((refreshed.match(/data-vpk-presentation-runtime/g) || []).length, 1);
	assert.match(refreshed, /--vpk-slide-rest-transform:\s*translate\(-50%, -50%\) scale\(var\(--vpk-slide-scale, 1\)\);/);
	assert.match(refreshed, /presenterWindow\?\.postMessage/);
	assert.match(refreshed, /data-vpk-progress-arc/);
	assert.doesNotMatch(refreshed, /window\.opener\?\.postMessage/);

	const existingNotes = [
		`<!doctype html><html><head><style></style></head><body><main><section class="slide"><h1>One</h1>`,
		"  ",
		`<aside class="speaker-notes" aria-hidden="true">Existing note</aside>`,
		`</section><section class="slide"><h1>Two</h1></section></main></body></html>`,
	].join("\n");
	assert.doesNotMatch(retrofitDeck(existingNotes), /[ \t]+$/m);
});

test("document nav retrofit is idempotent and skips decks", async () => {
	const { retrofitDocumentNav } = await import("./presentation.mjs");
	const doc = `<!doctype html><html><head><style></style></head><body><main><section><h2>One</h2></section><section><h2>Two</h2></section></main></body></html>`;
	const deck = `<!doctype html><html><body><main><section class="slide"></section><section class="slide"></section></main></body></html>`;

	const once = retrofitDocumentNav(doc);
	assert.equal(retrofitDocumentNav(once), once);
	assert.match(once, /data-vpk-motion="document"/);
	assert.match(once, /data-vpk-docnav-runtime/);
	assert.match(once, /className = 'docnav-controls'/);
	assert.match(once, /vpk presentation mode/);
	assert.match(once, /data-vpk-progress-arc/);
	assert.match(once, /viewBox="0 0 24 24"/);
	assert.match(once, /data-vpk-progress-arc cx="12" cy="12" r="11\.5"/);
	assert.match(once, /const progress = targets\.length <= 1 \? 0 : activeIndex \/ \(targets\.length - 1\);/);
	assert.match(once, /arc\.style\.opacity = progress <= 0 \? '0' : '1';/);
	assert.match(once, /presenter-section-/);
	assert.match(once, /contenteditable="true" role="textbox" aria-label="Speaker notes"/);
	assert.match(once, /BroadcastChannel\('vpk-deck'\)/);
	assert.match(once, /is-docnav-active/);
	assert.match(once, /\.vpk-slide-counter,[\s\S]*\.docnav-controls\s*\{[\s\S]*z-index:\s*2147483001;/);
	// Pager uses the shared control palette + inline @atlaskit SVG arrows (no HTML entities).
	assert.match(once, /background: var\(--vpk-control-surface, color-mix\(in srgb, var\(--paper\) 88%, transparent\)\)/);
	assert.match(once, /border: 1px solid var\(--vpk-control-border, var\(--rule\)\)/);
	assert.match(once, /right: var\(--vpk-pager-right, 24px\);/);
	assert.match(once, /color: var\(--vpk-control-text, var\(--muted-text\)\)/);
	assert.doesNotMatch(once, /&uarr;|&darr;/);
	assert.match(once, /M8\.75 15V3\.56/);
	assert.match(once, /currentColor/);
	assert.doesNotMatch(once, /viewBox="0 0 44 44"/);
	assert.doesNotMatch(once, /vpk-nav-progress__track/);
	assert.doesNotMatch(once, /data-vpk-docnav-style/);
	assert.equal(retrofitDocumentNav(deck), deck);
});

test("document nav retrofit leaves data-vpk-docnav=off bodies unchanged", async () => {
	const { buildDocNavJs, retrofitDocumentNav } = await import("./presentation.mjs");
	const html = `<!doctype html><html><head><style></style></head><body data-vpk-motion="document" data-vpk-docnav="off"><main><section><h2>One</h2></section><section><h2>Two</h2></section></main></body></html>`;
	assert.equal(retrofitDocumentNav(html), html);
	assert.equal(retrofitDocumentNav(html.replace(`data-vpk-docnav="off"`, "data-vpk-docnav='off'")), html.replace(`data-vpk-docnav="off"`, "data-vpk-docnav='off'"));
	// A page that already carries the runtime still opts out at run time.
	assert.match(buildDocNavJs(), /document\.body\.matches\('\[data-vpk-docnav\]:not\(\[data-vpk-docnav="off"\]\)'\)/);
});

test("deck retrofit removes only legacy bare deck scripts, never a runtime block after a bare script", async () => {
	const { retrofitDeck } = await import("./presentation.mjs");
	const isoBlock = `<!-- vpk-iso:start -->\n<script data-vpk-iso-runtime>\n(() => { const io = new IntersectionObserver(() => {}); io.disconnect(); })();\n</script>\n<!-- vpk-iso:end -->`;
	const slides = `<main><section class="slide"><h1>One</h1></section><section class="slide"><h1>Two</h1></section></main>`;
	const deck = `<!doctype html><html><head><style></style></head><body>${slides}\n<script>\nwindow.deckBoot = 1;\n</script>\n${isoBlock}\n</body></html>`;
	const out = retrofitDeck(deck);
	assert.ok(out.includes(isoBlock), "the iso runtime block after a bare <script> survives");
	assert.match(out, /<script>\nwindow\.deckBoot = 1;\n<\/script>/);
	const legacy = `<!doctype html><html><head><style></style></head><body>${slides}\n<script>\ndocument.querySelector('.slide').scrollIntoView();\n</script>\n${isoBlock}\n</body></html>`;
	const cleaned = retrofitDeck(legacy);
	assert.doesNotMatch(cleaned, /<script>\s*document\.querySelector\('\.slide'\)\.scrollIntoView/);
	assert.ok(cleaned.includes(isoBlock), "removing the legacy deck script keeps the runtime block");
});

test("presentation CSS hides speaker notes for decks and docnav without duplicating note text", async () => {
	const { retrofitDeck, retrofitDocumentNav } = await import("./presentation.mjs");
	const deck = `<!doctype html><html><head><style>:root { color-scheme: light dark; }</style></head><body><main><section class="slide"><h1>One</h1><aside class="speaker-notes" aria-hidden="true">Deck private note</aside></section><section class="slide"><h1>Two</h1></section></main></body></html>`;
	const doc = `<!doctype html><html><head><style>:root { color-scheme: light dark; }</style></head><body><main><section><h2>One</h2><p>Visible copy.</p><aside class="speaker-notes" aria-hidden="true">Doc private note</aside></section><section><h2>Two</h2><p>More visible copy.</p></section></main></body></html>`;

	const deckOut = retrofitDeck(deck);
	const docOut = retrofitDocumentNav(doc);

	for (const output of [deckOut, docOut]) {
		assert.match(output, /\.speaker-notes\s*\{[\s\S]*display:\s*none\s*!important/);
		assert.match(output, /@media print\s*\{[\s\S]*\.speaker-notes,[\s\S]*display:\s*none\s*!important/);
	}

	assert.equal((deckOut.match(/Deck private note/g) || []).length, 1);
	assert.equal((docOut.match(/Doc private note/g) || []).length, 1);
	assert.match(docOut, /<aside class="speaker-notes" aria-hidden="true">Doc private note<\/aside>/);
	assert.doesNotMatch(docOut, /Doc private note[\s\S]*Doc private note/);
});

test("theme runtime injector is idempotent and applies before the shared style block", async () => {
	const { retrofitThemeRuntime } = await import("./theme.mjs");
	const html = `<!doctype html><html><head><style>:root { color-scheme: light dark; }</style></head><body><main><section>Report</section></main></body></html>`;
	const once = retrofitThemeRuntime(html);
	const twice = retrofitThemeRuntime(once);

	assert.equal(twice, once, "theme runtime must not duplicate on repeated generation");
	assert.ok(once.indexOf("data-vpk-theme-init") < once.indexOf("<style>"), "theme init runs before CSS paint");
	assert.match(once, /localStorage\.getItem\(key\)/);
	assert.match(once, /vpk-html-theme/);
	assert.match(once, /data-vpk-theme-runtime/);
	assert.match(once, /data-vpk-theme-toggle/);
	// Theme toggle is icon-only: the @atlaskit contrast glyph, no visible "theme" text label.
	assert.match(once, /M8 1\.5a6\.5 6\.5 0 1 0 0 13/);
	assert.doesNotMatch(once, /vpk-theme-toggle__label">theme/);
	assert.match(once, /removeAttribute\("aria-pressed"\)/);
	assert.doesNotMatch(once, /setAttribute\("aria-pressed"/);
});

test("icons.mjs inlines @atlaskit glyphs as pure-HTML svg (viewBox 16, currentColor)", async () => {
	const { inlineIcon } = await import("./icons.mjs");
	const up = inlineIcon("arrow-up", { label: "Up" });
	assert.match(up, /^<svg /);
	assert.match(up, /viewBox="0 0 16 16"/);
	assert.match(up, /fill="currentColor"/);
	assert.match(up, /role="img" aria-label="Up"/);
	assert.match(up, /<path[^>]*d="M8\.75 15V3\.56/);
	// Decorative by default (aria-hidden, no role) and no React import in the output.
	assert.match(inlineIcon("theme"), /aria-hidden="true"/);
	assert.doesNotMatch(inlineIcon("theme"), /import|dangerouslySetGlyph/);
	assert.throws(() => inlineIcon("definitely-not-a-real-icon-xyz"));
});

test("inject-runtime CLI refreshes theme and presentation runtimes idempotently", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-html-runtime-"));
	const fixture = path.join(tmp, "artifact.html");
	const buildScript = path.join(__dirname, "build.mjs");

	try {
		fs.writeFileSync(fixture, `<!doctype html><html><head><style>:root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style></head><body><main><section><h2>One</h2><p>Visible copy.</p></section><section><h2>Two</h2><p>More visible copy.</p></section></main></body></html>`);

		const first = execFileSync(process.execPath, [buildScript, "--inject-runtime", fixture], { encoding: "utf8" });
		const once = fs.readFileSync(fixture, "utf8");
		const second = execFileSync(process.execPath, [buildScript, "--inject-runtime", fixture], { encoding: "utf8" });
		const twice = fs.readFileSync(fixture, "utf8");

		assert.match(first, /1 changed, 0 unchanged/);
		assert.match(second, /0 changed, 1 unchanged/);
		assert.equal(twice, once);
		assert.match(once, /data-vpk-theme-init/);
		assert.match(once, /data-vpk-theme-runtime/);
		assert.match(once, /data-vpk-docnav-runtime/);
		assert.match(once, /vpk presentation mode/);
		assert.match(once, /data-vpk-progress-arc/);
		assert.equal((once.match(/<!-- vpkh-enhance:begin -->/g) || []).length, 1, "artifacts get exactly one enhancement block");
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("check-html enforces the SMIL starter contract", async () => {
	const { validateHtmlString } = await import("./check-html.mjs");
	const base = `<!doctype html><html><head><style>@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AA==); } :root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style></head><body><main><svg aria-label="demo"><animateTransform attributeName="transform" type="translate" begin="indefinite"/></svg></main></body></html>`;

	assert.match(
		validateHtmlString(base).failures.join("\n"),
		/data-vpk-smil-starter/,
	);
	assert.match(
		validateHtmlString(base.replace('begin="indefinite"', 'begin="0s"')).failures.join("\n"),
		/begin="indefinite"/,
	);
	assert.match(
		validateHtmlString(base.replace(/<animateTransform[^>]*\/>/, '<animate attributeName="width" from="0" to="10" begin="0s" dur="200ms" fill="freeze"/>')).failures.join("\n"),
		/is not gated/,
	);
});

test("check-html flags decorative side stripes while allowing hairline separators", async () => {
	const { collectBorderStripeIssues } = await import("./check-html.mjs");

	assert.deepEqual(
		collectBorderStripeIssues(`<style>.ok { border-left: 1.5px solid var(--rule-strong); }</style>`),
		[],
	);
	assert.match(
		collectBorderStripeIssues(`<style>.bad { border-left: 2px solid var(--danger); }</style>`).join("\n"),
		/side-border stripes over 1\.6px/,
	);
	assert.match(
		collectBorderStripeIssues(`<div style="border-right-width: 0.14rem; border-right-style: solid;"></div>`).join("\n"),
		/border-right-width sets right border/,
	);
	assert.match(
		collectBorderStripeIssues(`<style>.bad { border-width: 0 2px 0 1px; }</style>`).join("\n"),
		/border-width sets right border/,
	);
});

test("check-html enforces the Algebrica SVG grammar", async () => {
	const { collectColorTokenIssues, collectSvgGrammarIssues } = await import("./check-html.mjs");
	const valid = `<svg aria-label="ok" fill="none"><path d="M0 0h10" stroke="var(--focal)" stroke-width="2"/><text x="0" y="12" fill="var(--ill-ink50)" font-family="Geist Mono, monospace">label</text></svg>`;
	const animatedInteractive = `<svg class="vpk-chart" data-vpk-chart aria-label="chart" fill="none" viewBox="0 0 120 80">
		<g data-series="alpha" aria-label="Alpha">
			<path class="vpk-chart-draw" style="--vpk-draw-length: 120; --vpk-stagger-index: 1;" d="M10 60 L50 30 L100 20" stroke="var(--focal)" stroke-width="2" fill="none" transform="translate(0 0)"/>
			<circle class="vpk-chart-reveal" data-vpk-point data-series="alpha" tabindex="0" role="button" aria-label="Alpha point" aria-describedby="chart-tooltip" data-tooltip="Alpha · 10" cx="100" cy="20" r="4" fill="var(--focal)" stroke="var(--paper)" stroke-width="1.5"/>
			<text x="104" y="24" fill="var(--ill-ink50)" font-family="Geist Mono, monospace">10</text>
		</g>
		<script data-vpk-chart-runtime>document.currentScript.closest("svg").setAttribute("data-ready","true");</script>
	</svg>`;
	assert.deepEqual(collectSvgGrammarIssues(valid), []);
	assert.deepEqual(collectSvgGrammarIssues(animatedInteractive), []);

	assert.match(
		collectSvgGrammarIssues(valid.replace('stroke="var(--focal)"', 'stroke="#0c66e4"')).join("\n"),
		/grayscale figure tokens/,
	);
	assert.match(
		collectSvgGrammarIssues(valid.replace("</svg>", "<linearGradient id=\"g\"></linearGradient></svg>")).join("\n"),
		/gradients, filters, or drop shadows/,
	);
	assert.match(
		collectSvgGrammarIssues(animatedInteractive.replace("</svg>", "<linearGradient id=\"g\"></linearGradient></svg>")).join("\n"),
		/gradients, filters, or drop shadows/,
	);
	assert.match(
		collectSvgGrammarIssues(valid.replace("Geist Mono, monospace", "Charlie Text")).join("\n"),
		/SVG font-family must resolve to Geist Mono/,
	);
	assert.match(
		collectSvgGrammarIssues(valid.replace('stroke-width="2"', 'stroke-width="3"')).join("\n"),
		/stroke-width "3" must be numeric within 0.5-2.5/,
	);
	assert.match(
		collectSvgGrammarIssues(valid.replace("var(--focal)", "var(--accent)")).join("\n"),
		/must not use accent or link tokens/,
	);
	assert.deepEqual(
		collectSvgGrammarIssues(valid.replace("<svg ", "<svg data-vpk-external-asset ")),
		[],
	);
	assert.deepEqual(
		collectColorTokenIssues(valid.replace("<svg ", "<svg data-vpk-external-asset ").replace('stroke="var(--focal)"', 'stroke="#0c66e4"')),
		[],
	);
});

test("v2 agent tooling surface", () => {
	const help = execFileSync(process.execPath, [path.join(__dirname, "build.mjs"), "--help"], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	for (const flag of ["--doctor", "--check-content", "--playbook", "--screenshot", "--publish <artifacts|gist>", "--include-review", "--allow-local-paths", "--confirm", "--inject-review", "--review <review.json|reviewed.html>", "--stamp", "--embed-review", "--strip-review", "--check-iso", "--build-hero", "--check-figures", "scripts/lab/kit.mjs", "scripts/lab/render-case-study.mjs", "scripts/media/capture.mjs", "scripts/media/encode.mjs", "scripts/media/embed.mjs"]) {
		assert.ok(help.includes(flag), `--help lists ${flag}`);
	}
});

test("SKILL.md workflow skeleton", () => {
	const skill = fs.readFileSync(path.join(__dirname, "..", "SKILL.md"), "utf8");
	const phases = [...skill.matchAll(/^## Phase ([A-Z]): (.+)$/gm)].map(match => [match[1], match[2].trim()]);
	assert.deepEqual(phases, [
		["A", "Frame"],
		["B", "Reference"],
		["C", "Draft"],
		["D", "Figure"],
		["E", "Verify"],
		["F", "Deliver"],
	]);
	// The body of one phase: from its heading line to the next H2.
	const phase = letter => skill.split(/^## Phase /m).find(chunk => chunk.startsWith(`${letter}: `)).split(/^## /m)[0].replace(/^.*\n/, "");
	for (const letter of ["A", "B", "C", "D", "E", "F"]) assert.match(phase(letter), /^Completion criterion:\n- \[ \] /m, `phase ${letter} ends with checkable completion criteria`);
	for (const letter of ["B", "E"]) assert.match(phase(letter), /^\*\*Stop\.\*\* Show /m, `phase ${letter} stops to show frames`);
	const lock = phase("A");
	assert.match(lock, /If you ask, stop and wait for the answer/);
	assert.ok(lock.includes("references/contract.md#figure-engine"), "Frame routes the engine question to its owner");
	assert.ok(!lock.includes("**iso kit**"), "the engine options live only in contract.md");
	const contract = fs.readFileSync(path.join(__dirname, "..", "references", "contract.md"), "utf8");
	const engine = contract.split(/^## Figure engine$/m)[1].split(/^## /m)[0];
	for (const option of ["iso kit", "anatomy hero", "both"]) assert.ok(engine.includes(`**${option}**`), `the engine question offers ${option}`);
	assert.ok(engine.includes("values and the `both` rule live in [figure engines](figure-engines.md)"), "the engine meta values have one owner");
	assert.ok(!engine.includes(`<meta name="vpk-figure-engine"`), "contract.md holds no copy of the meta enum");
	assert.ok(fs.readFileSync(path.join(__dirname, "..", "references", "figure-engines.md"), "utf8").includes(`<meta name="vpk-figure-engine" content="none|iso-kit|anatomy-hero|both|hairline|anatomy-gl">`));
	assert.match(engine, /With nobody to ask \([^)]*\), use the iso kit/);
	assert.match(engine, /needs it\. There\s+is no part or size cap, and a page may carry several\./);
	assert.match(engine, /When you ask, say which planned figure each option would draw and what the\s+others become\. With the anatomy hero alone, the other figures are static\s+diagrams\./);
	assert.ok(!/[;] /.test(engine.slice(engine.indexOf("- **iso kit**"), engine.indexOf("When you ask, say"))), "the engine options use full stops, not semicolons");
	const done = contract.split(/^## Definition of done$/m)[1].split(/^## /m)[0];
	assert.equal(done.match(/^\d+\. /gm).length, 6, "the definition of done has six items");
	assert.ok(phase("F").includes("references/contract.md#definition-of-done"), "Deliver routes the reply to the definition of done");
});

test("P4 cycle 2 item 1: a question turn still ends with the one-line contract", () => {
	const contract = fs.readFileSync(path.join(__dirname, "..", "references", "contract.md"), "utf8");
	const budget = contract.split(/^## Question budget$/m)[1].split(/^## /m)[0].replace(/\s+/g, " ");
	assert.ok(budget.includes("When you ask, end the message with the rest of the contract as one line in the usual format (all seven fields, including the length/viewport target and the verification commands), with the engine marked open."), "the question budget says what the contract line looks like on a question turn");
	assert.ok(budget.indexOf("When you ask") < budget.indexOf("When nothing needs asking"), "the question-turn rule comes before the no-question rule");
});

test("P4 items 1, 8, 14: engineering shells open <main> before the masthead and carry no provenance footer", () => {
	const dir = path.join(__dirname, "..", "assets", "templates");
	const shells = fs.readdirSync(dir).filter(name => name.endsWith(".html")).map(name => [name, fs.readFileSync(path.join(dir, name), "utf8")]).filter(([, html]) => html.includes('class="masthead"') && html.includes('class="stat"'));
	assert.ok(shells.length >= 20, `found the engineering shells (${shells.length})`);
	for (const [name, html] of shells) {
		const main = html.indexOf("<main>");
		assert.ok(main >= 0 && main < html.indexOf('<header class="masthead">'), `${name}: <main> opens before the masthead`);
		assert.ok(main < html.indexOf('<div class="stat"'), `${name}: the stat strip is inside <main>`);
		assert.ok(html.indexOf("</main>") > html.indexOf("Acceptance checklist") || !html.includes("Acceptance checklist"), `${name}: main closes after the shell content`);
		assert.equal(html.split("<main>").length - 1, 1, `${name}: one main landmark`);
		assert.match(html, /<div class="stat"[^>]*>\s*<div data-vpk-block>/, `${name}: stat cells are review blocks`);
		assert.ok(!html.includes('<footer class="source">'), `${name}: no reader-visible provenance footer`);
		assert.ok(!html.includes("local offline template-edit contract"), `${name}: no author jargon in reader copy`);
		assert.match(html.slice(0, 600), /Pattern reference: https:\/\//, `${name}: the head comment keeps the pattern reference`);
	}
});
