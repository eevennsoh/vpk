// anatomy-gl engine (figure-engines.md § 11): vendor integrity, the token map, the plate, the page block and the boot lifecycle.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { ANATOMY_GL_FIGURES } from "./figures.mjs";
import { ANATOMY_GL_BOOT, ANATOMY_GL_LIT_CSS, ANATOMY_GL_MAX_RECOVERIES, ANATOMY_GL_MOUNT_MARGIN, ANATOMY_GL_TOKENS, ANATOMY_GL_UNMOUNT_MARGIN, anatomyGlPlate, anatomyGlRuntimeBlock, anatomyGlStyleTag, vendoredElementExists } from "./inline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(HERE, "vendor");

test("vendored files match VENDOR.json byte for byte, and every figure has its element entry", () => {
	const record = JSON.parse(fs.readFileSync(path.join(VENDOR, "VENDOR.json"), "utf8"));
	for (const [file, hash] of Object.entries(record.files)) {
		assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(VENDOR, file))).digest("hex"), hash, file);
	}
	assert.deepEqual(record.figures, ANATOMY_GL_FIGURES.map(figure => figure.slug));
	for (const figure of ANATOMY_GL_FIGURES) assert.ok(vendoredElementExists(figure.slug), figure.slug);
});

test("the token map sets every --anatomy-* colour the figures read from vpk tokens only, in both themes", () => {
	const keys = ["--anatomy-card", "--anatomy-paper", "--anatomy-face", "--anatomy-top", "--anatomy-shade-0", "--anatomy-shade-1", "--anatomy-shade-2", "--anatomy-shade-3", "--anatomy-hi", "--anatomy-mid", "--anatomy-lo", "--anatomy-faint", "--anatomy-lit", "--anatomy-lit-top", "--anatomy-lit-shade", "--anatomy-text", "--anatomy-strong", "--anatomy-muted"];
	for (const theme of ["light", "dark"]) {
		const tokens = ANATOMY_GL_TOKENS[theme];
		for (const key of keys) assert.ok(tokens[key], `${theme} ${key}`);
		for (const [key, value] of Object.entries(tokens)) assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgba?\(/i, `${theme} ${key} is a token, not a raw colour`);
	}
	assert.equal(ANATOMY_GL_TOKENS.light["--anatomy-lit"], "var(--ill-accent)", "the lit part is the iso kit's accent");
	assert.match(anatomyGlStyleTag(), /--ill-accent:/, "the style tag declares the accent pair");
});

// Hover-only accent outline: a lit solid's edge draws its own tone at rest and the accent only while the plate is hovered or
// focused; the boot adopts the sheet into every figure's shadow root.
test("a lit solid's edge is neutral at rest and takes the accent only on hover or focus", () => {
	assert.match(ANATOMY_GL_LIT_CSS, /:is\(\.iso-solid, \.ab-plate\)\[data-lit\] > \.iso-edge\.iso-line\[data-tone="hi"\] \{ stroke: var\(--anatomy-hi\); \}/);
	for (const rule of ANATOMY_GL_LIT_CSS.split("\n").filter(line => line.includes("--anatomy-lit"))) assert.match(rule, /:is\(:hover, :focus-within\)/, `accent only on hover: ${rule}`);
	assert.match(ANATOMY_GL_BOOT, /adoptLitCss\(host\.shadowRoot\)/, "every mount adopts the sheet");
});

test("the plate is an anatomy-gl root with an accessible host, opted out of the lightbox", () => {
	const plate = anatomyGlPlate({ slug: "afterburner" });
	assert.match(plate, /data-vpk-engine="anatomy-gl"/);
	assert.match(plate, /data-vpk-anatomy-gl="afterburner"[^>]*aria-label="[^"]+"/);
	assert.match(plate, /data-vpkh-no-lightbox/);
	assert.throws(() => anatomyGlPlate({ slug: "nope" }), /unknown anatomy-gl figure/);
});

test("the runtime block bundles only the figures asked for, offline, with the notice first", async () => {
	const one = await anatomyGlRuntimeBlock(["afterburner"]);
	assert.match(one, /^<!-- vpk-anatomy-gl:start -->\n<script data-vpk-anatomy-gl-runtime>\n\/\* vpk anatomy-gl runtime/);
	assert.match(one, /<!-- vpk-anatomy-gl:end -->$/);
	assert.doesNotMatch(one, /\bimport\s*\{|\bimport\(|https?:\/\/(?!www\.w3\.org)/, "no module imports or remote fetches survive bundling");
	assert.doesNotMatch(one.slice(one.indexOf("<script"), one.lastIndexOf("</script>")), /<\/script/i);
	assert.ok(one.includes("AFTERBURNER") || one.includes("afterburner"));
	assert.ok(!one.includes("TOKAMAK"), "tree-shaken: a one-figure page carries no other figure");
	await assert.rejects(() => anatomyGlRuntimeBlock(["nope"]), /unknown anatomy-gl figure/);
});

test("each figure record's ratio is its vendored entry's exported ratio, and the plate reserves that box before mounting", async () => {
	for (const figure of ANATOMY_GL_FIGURES) {
		const entry = await import(path.join(VENDOR, "dist/element", `${figure.slug}.js`));
		assert.equal(figure.ratio, entry.ratio, figure.slug);
		assert.ok(anatomyGlPlate({ slug: figure.slug }).includes(`class="vpk-anatomy-gl-reserve" style="aspect-ratio: ${figure.ratio}"`), figure.slug);
	}
	assert.ok(anatomyGlStyleTag().includes(".vpk-anatomy-gl-reserve { box-sizing: content-box; padding: 52px 24px; }"), "the reserve carries upstream's plate padding");
});

// Runs the real boot against stub figures, observers and hosts, so the lifecycle is proven without a GPU. The bug it guards:
// the boot mounted all ten figures at load (15 WebGL contexts, against a browser budget of about sixteen per renderer shared by
// every tab), so opening the page in a second tab evicted the first tab's contexts and its figures stayed blank for good.
function bootHarness() {
	const observers = [];
	const renders = [];
	const makeHost = slug => {
		const listeners = [];
		const host = { dataset: { vpkAnatomyGl: slug }, style: { minHeight: "" }, offsetHeight: 600, shadowRoot: null };
		host.fire = type => listeners.filter(l => l.type === type).forEach(l => l.fn());
		host.attach = () => {
			host.shadowRoot ??= { activeElement: null, addEventListener: (type, fn) => listeners.push({ type, fn }) };
		};
		return host;
	};
	const hosts = ["a", "b", "c"].map(makeHost);
	const FIGURES = Object.fromEntries(hosts.map(h => [h.dataset.vpkAnatomyGl, (host, options) => {
		host.attach();
		const record = { slug: host.dataset.vpkAnatomyGl, theme: options.theme, tokens: options.tokens, stopped: false };
		renders.push(record);
		return () => {
			record.stopped = true;
		};
	}]));
	const html = { dataset: { theme: "light" } };
	let themeObserver;
	const timers = [];
	const sandbox = {
		FIGURES,
		setTimeout: fn => timers.push(fn),
		document: { readyState: "complete", documentElement: html, querySelectorAll: () => hosts },
		IntersectionObserver: class {
			constructor(cb, opts) {
				this.cb = cb;
				this.margin = opts.rootMargin;
				observers.push(this);
			}
			observe() {}
		},
		MutationObserver: class {
			constructor(cb) {
				themeObserver = cb;
			}
			observe() {}
		},
	};
	vm.runInNewContext(`const FIGURES = this.FIGURES;\n${ANATOMY_GL_BOOT}`, sandbox);
	const [near, far] = observers;
	const runTimers = () => timers.splice(0).forEach(fn => fn());
	return {
		hosts, renders, timers, near, far, runTimers,
		live: () => renders.filter(r => !r.stopped).map(r => `${r.slug}:${r.theme}`).sort(),
		count: slug => renders.filter(r => r.slug === slug).length,
		enter: (observer, host, isIntersecting) => observer.cb([{ target: host, isIntersecting }]),
		flipTheme: theme => {
			html.dataset.theme = theme;
			themeObserver();
		},
	};
}

test("the boot mounts a figure only near the viewport and releases it once it is far, never all ten at load", () => {
	const t = bootHarness();
	assert.equal(t.near.margin, ANATOMY_GL_MOUNT_MARGIN);
	assert.equal(t.far.margin, ANATOMY_GL_UNMOUNT_MARGIN);
	assert.deepEqual(t.live(), [], "nothing mounts before it is observed near");
	const [a, b] = t.hosts;
	t.enter(t.near, a, true);
	assert.deepEqual(t.live(), ["a:light"]);
	assert.equal(t.renders[0].tokens["--anatomy-lit"], "var(--ill-accent)", "mounted with the vpk tokens");
	t.enter(t.near, a, false);
	assert.deepEqual(t.live(), ["a:light"], "between the margins it stays mounted (no flicker at the edge)");
	t.enter(t.far, a, false);
	assert.deepEqual(t.live(), [], "beyond the unmount margin its contexts are released");
	assert.equal(a.style.minHeight, "600px", "the emptied host holds its height");
	t.enter(t.near, a, true);
	assert.deepEqual(t.live(), ["a:light"], "it remounts when it comes back");
	assert.equal(a.style.minHeight, "", "and drops the held height");
	t.enter(t.near, b, true);
	b.shadowRoot.activeElement = {};
	t.enter(t.far, b, false);
	assert.deepEqual(t.live(), ["a:light", "b:light"], "a focused figure is never torn down");
	b.shadowRoot.activeElement = null;
	b.fire("focusout");
	t.runTimers();
	assert.deepEqual(t.live(), ["a:light"], "once focus leaves a far figure, it is released");
});

test("the boot remounts only live figures on a theme flip, and recovers a figure whose context the browser evicts", () => {
	const t = bootHarness();
	const [a, b] = t.hosts;
	t.enter(t.near, a, true);
	t.flipTheme("dark");
	assert.deepEqual(t.live(), ["a:dark"], "the live figure follows the theme; unmounted ones are not woken");
	t.enter(t.near, b, true);
	assert.deepEqual(t.live(), ["a:dark", "b:dark"], "a later mount takes the current theme");
	for (let i = 0; i < ANATOMY_GL_MAX_RECOVERIES + 2; i++) {
		a.fire("webglcontextlost");
		a.fire("webglcontextlost");
		t.runTimers();
	}
	assert.equal(t.count("a"), 2 + ANATOMY_GL_MAX_RECOVERIES, "one remount per loss, bounded");
	t.enter(t.near, b, false);
	b.fire("webglcontextlost");
	t.runTimers();
	assert.equal(t.count("b"), 1, "a figure that has scrolled off is not remounted on loss");
	t.enter(t.near, b, true);
	assert.equal(t.count("b"), 2, "it is remounted fresh when it comes near again");
});
