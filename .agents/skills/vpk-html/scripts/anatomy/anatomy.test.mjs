// ws4b anatomy suite (spec ws4b section 7.2). Phase P1 (ws4b-F) landed T1, the vendored half of T2b and
// the K12 camera-module checks; ws4b-A (P2) adds T2-T12: tokens, CSS, kit subset, runtime script, truth
// model, audit, sanitizers, CLI, runtime step and the ws1 round trip. Run:
//   OPENSSL_CONF=/dev/null node --test .agents/skills/vpk-html/scripts/anatomy/anatomy.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { CAMERA_TOLERANCE, FIGURE_CAMERA, cameraAttr, parseCameraAttr, sameCamera } from "../figures/camera.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(HERE, "vendor");
const PINNED_COMMIT = "dbf697a527bbf7d358668e1557cb1e35ff725d46";
const VENDORED_FILES = ["LICENSE", "kit/iso-kit.mjs", "kit/lathe.mjs", "kit/tube.mjs", "kit/audit.mjs", "scripts/line-ends.mjs"];

function readVendorManifest() {
	return JSON.parse(fs.readFileSync(path.join(VENDOR, "VENDOR.json"), "utf8"));
}

function listFiles(directory, prefix = "") {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		return entry.isDirectory() ? listFiles(path.join(directory, entry.name), relative) : [relative];
	});
}

const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("T1 vendor integrity: VENDOR.json pins the upstream commit, licence and file list", () => {
	const manifest = readVendorManifest();
	assert.equal(manifest.name, "anatomy");
	assert.equal(manifest.repo, "github.com/wheresryan22/anatomy");
	assert.equal(manifest.license, "MIT");
	assert.equal(manifest.copyright, "Copyright (c) 2026 Ryan");
	assert.equal(manifest.hash, "sha256");
	assert.match(manifest.commit, /^[0-9a-f]{40}$/, "the commit is a full sha, never a branch");
	assert.equal(manifest.commit, PINNED_COMMIT);
	assert.match(manifest.notice, /MIT License, Copyright \(c\) 2026 Ryan/);
	assert.deepEqual(Object.keys(manifest.files).sort(), [...VENDORED_FILES].sort());
});

test("T1 vendor integrity: every vendored file matches its sha256 and nothing else is in the folder", () => {
	const manifest = readVendorManifest();
	for (const [file, hash] of Object.entries(manifest.files)) {
		assert.match(hash, /^[0-9a-f]{64}$/, `${file} hash`);
		assert.equal(sha256(path.join(VENDOR, file)), hash, `${file} differs from the pinned upstream copy; re-vendor the folder whole (ws4b section 7.1 V1)`);
	}
	const present = listFiles(VENDOR).sort();
	assert.deepEqual(present, [...VENDORED_FILES, "VENDOR.json"].sort(), "the vendor folder holds only the pinned files and VENDOR.json");
});

test("T1 vendor integrity: LICENSE is the upstream MIT text", () => {
	const license = fs.readFileSync(path.join(VENDOR, "LICENSE"), "utf8");
	assert.match(license, /MIT License/);
	assert.match(license, /Copyright \(c\) 2026 Ryan/);
	assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});

test("T1 vendor integrity: vendored modules import only each other", () => {
	for (const file of VENDORED_FILES.filter(name => name.endsWith(".mjs"))) {
		const source = fs.readFileSync(path.join(VENDOR, file), "utf8");
		for (const [, specifier] of source.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)) {
			assert.ok(specifier.startsWith("./"), `${file} imports ${specifier}`);
			const target = path.posix.join(path.posix.dirname(file), specifier);
			assert.ok(VENDORED_FILES.includes(target), `${file} imports ${target}, which is not vendored`);
		}
	}
});

test("T2b vendored camera: the kit defaults equal FIGURE_CAMERA (45/30, edges at 26.57 degrees)", async () => {
	const kit = await import(pathToFileURL(path.join(VENDOR, "kit/iso-kit.mjs")).href);
	assert.equal(kit.AZIMUTH, 45);
	assert.equal(kit.ELEVATION, 30);
	assert.deepEqual({ azimuth: kit.AZIMUTH, elevation: kit.ELEVATION }, { ...FIGURE_CAMERA });
	const projection = { scale: 1, origin: [0, 0] };
	const [x, y] = kit.iso([1, 0, 0], projection);
	assert.ok(Math.abs((Math.atan2(y, x) * 180) / Math.PI - 26.565) < 0.01, "the x axis runs at 26.57 degrees on screen");
	const fitted = kit.fitProjection([[0, 0, 0], [10, 10, 10]], 600, 380, {});
	assert.equal(fitted.azimuth, FIGURE_CAMERA.azimuth);
	assert.equal(fitted.elevation, FIGURE_CAMERA.elevation);
});

test("K12 camera: FIGURE_CAMERA is frozen at 45/30 and the module is free to import", () => {
	assert.deepEqual({ ...FIGURE_CAMERA }, { azimuth: 45, elevation: 30 });
	assert.equal(Object.isFrozen(FIGURE_CAMERA), true);
	assert.equal(CAMERA_TOLERANCE, 1e-6);
	const source = fs.readFileSync(path.join(HERE, "..", "figures", "camera.mjs"), "utf8");
	assert.doesNotMatch(source, /^\s*import\b/m, "camera.mjs has no imports (R28)");
});

test("K12 camera: cameraAttr writes the shortest decimal form", () => {
	assert.equal(cameraAttr(), "45 30");
	assert.equal(cameraAttr(FIGURE_CAMERA), "45 30");
	assert.equal(cameraAttr({ azimuth: 45, elevation: 35.26 }), "45 35.26");
	assert.equal(cameraAttr({ azimuth: 90, elevation: 0 }), "90 0");
	assert.equal(cameraAttr({ azimuth: 90, elevation: 90 }), "90 90");
	assert.equal(cameraAttr({ azimuth: -0, elevation: 30.5 }), "0 30.5");
	assert.equal(cameraAttr({ azimuth: 45.000001, elevation: 30 }), "45.000001 30");
	for (const bad of [{}, { azimuth: 45 }, { azimuth: Number.NaN, elevation: 30 }, { azimuth: 45, elevation: Infinity }, { azimuth: 45, elevation: 91 }, { azimuth: 361, elevation: 30 }, { azimuth: "45", elevation: "30" }]) {
		assert.throws(() => cameraAttr(bad), RangeError, JSON.stringify(bad));
	}
});

test("K12 camera: parseCameraAttr inverts cameraAttr and rejects anything else", () => {
	assert.deepEqual(parseCameraAttr("45 30"), { azimuth: 45, elevation: 30 });
	assert.deepEqual(parseCameraAttr("  45\t35.26 "), { azimuth: 45, elevation: 35.26 });
	assert.deepEqual(parseCameraAttr("1e1 -3e1"), { azimuth: 10, elevation: -30 });
	for (const camera of [FIGURE_CAMERA, { azimuth: 45, elevation: 35.26 }, { azimuth: 90, elevation: 0 }, { azimuth: 90, elevation: 90 }, { azimuth: 12.345678, elevation: -7.5 }]) {
		assert.deepEqual(parseCameraAttr(cameraAttr(camera)), { ...camera });
	}
	assert.equal(Object.is(parseCameraAttr("-0 30").azimuth, 0), true, "-0 normalises to 0");
	for (const bad of ["", "45", "45 30 2.1 300 190", "45,30", "45, 30", "0x2d 30", "45 30deg", "45 NaN", "45 Infinity", "45 95", "400 30", "a b"]) {
		assert.equal(parseCameraAttr(bad), null, JSON.stringify(bad));
	}
	for (const bad of [null, undefined, 45, ["45", "30"], { azimuth: 45, elevation: 30 }]) assert.equal(parseCameraAttr(bad), null);
});

test("K12 camera: sameCamera compares within 1e-6", () => {
	assert.equal(sameCamera(FIGURE_CAMERA, parseCameraAttr("45 30")), true);
	assert.equal(sameCamera(FIGURE_CAMERA, { azimuth: 45 + 5e-7, elevation: 30 - 5e-7 }), true);
	assert.equal(sameCamera(FIGURE_CAMERA, { azimuth: 45 + 2e-6, elevation: 30 }), false);
	assert.equal(sameCamera(FIGURE_CAMERA, { azimuth: 45, elevation: 35.26 }), false);
	assert.equal(sameCamera(FIGURE_CAMERA, parseCameraAttr("garbage")), false);
	assert.equal(sameCamera(null, FIGURE_CAMERA), false);
	assert.equal(sameCamera(FIGURE_CAMERA, { azimuth: 45.4, elevation: 30 }, 0.5), true);
});

/* ============ ws4b-A (P2): T2–T12 ============ */

const SKILL = path.resolve(HERE, "..", "..");
const STYLES = fs.readFileSync(path.join(SKILL, "styles.css"), "utf8");
const BUILD_HERO = path.join(HERE, "build-hero.mjs");
const FIXTURE_MODULE = path.join(HERE, "fixtures", "carriage.hero.mjs");
const DIAL_MODULE = path.join(HERE, "examples", "dial-indicator.hero.mjs");
const load = rel => import(pathToFileURL(path.join(HERE, rel)).href);
const count = (text, needle) => text.split(needle).length - 1;
const MINIMAL_HEAD = `<style>@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AA==); } :root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style>`;
const page = (body, head = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}${MINIMAL_HEAD}</head><body><main><h1>Fixture</h1><p>Visible copy.</p>\n${body}\n</main></body></html>`;
const EMPTY_REGION = `<!-- vpk-anatomy-hero:start id="carriage" src="_figures/carriage.hero.mjs" --><!-- vpk-anatomy-hero:end id="carriage" -->`;

const memo = new Map();
const once = (key, make) => (memo.has(key) ? memo.get(key) : memo.set(key, make()).get(key));
const fixtureBuild = () => once("fixture", async () => (await load("hero.mjs")).buildHero(await import(pathToFileURL(FIXTURE_MODULE).href), { audit: true, src: "_figures/carriage.hero.mjs" }));
const dialBuild = () => once("dial", async () => (await load("hero.mjs")).buildHero(await import(pathToFileURL(DIAL_MODULE).href), { audit: true, src: "dial.hero.mjs" }));

// Hex colours of a theme block in styles.css: light is :root, dark is [data-theme="dark"].
function themeColor(token, theme) {
	const block = theme === "dark" ? STYLES.slice(STYLES.indexOf('[data-theme="dark"] {')) : STYLES;
	const hex = block.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
	assert.ok(hex, `${token} in the ${theme} block of styles.css`);
	return hex;
}

function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test("T2 tokens: the map covers the 29 vendored properties with existing grayscale vpk tokens", async () => {
	const { ANATOMY_TOKEN_MAP, ANATOMY_DARK_TOKEN_MAP, FIGURE_FACE_ROLES, FORBIDDEN_TONES } = await load("tokens.mjs");
	const { ISO_CSS } = await import(pathToFileURL(path.join(VENDOR, "kit/iso-kit.mjs")).href);
	const upstream = [...ISO_CSS.slice(ISO_CSS.indexOf(".iso{"), ISO_CSS.indexOf("}")).matchAll(/--anatomy-([\w-]+):/g)].map(match => match[1]);
	assert.equal(upstream.length, 29);
	assert.deepEqual(Object.keys(ANATOMY_TOKEN_MAP), upstream, "same names, same order as the vendored .iso{} block");
	for (const map of [ANATOMY_TOKEN_MAP, ANATOMY_DARK_TOKEN_MAP]) {
		for (const [name, value] of Object.entries(map)) {
			assert.doesNotMatch(value, /#|rgb\(|hsl\(/i, name);
			for (const [, token] of value.matchAll(/var\((--[\w-]+)/g)) {
				assert.ok(token === "--vpk-figure-stroke" || new RegExp(`^\\s*${token}:`, "m").test(STYLES), `${name} uses ${token}, which styles.css does not declare`);
			}
		}
	}
	assert.ok(Object.keys(ANATOMY_DARK_TOKEN_MAP).every(name => name in ANATOMY_TOKEN_MAP));
	assert.deepEqual(FORBIDDEN_TONES, ["red", "green", "blue"]);
	for (const tone of FORBIDDEN_TONES) assert.equal(ANATOMY_TOKEN_MAP[tone], "var(--ill-line)");
	assert.deepEqual([ANATOMY_TOKEN_MAP.halo, ANATOMY_TOKEN_MAP["halo-opacity"], ANATOMY_TOKEN_MAP.lift], ["transparent", "0", "none"]);
	const resolved = theme => Object.fromEntries(Object.keys(ANATOMY_TOKEN_MAP).map(name => [name, (theme === "dark" && ANATOMY_DARK_TOKEN_MAP[name]) || ANATOMY_TOKEN_MAP[name]]));
	for (const theme of ["light", "dark"]) {
		const map = resolved(theme);
		const roles = FIGURE_FACE_ROLES[theme];
		assert.equal(map.face, roles.top, `${theme} face`);
		assert.equal(map.top, roles.top, `${theme} top`);
		assert.equal(map["shade-3"], roles.sideNear, `${theme} near side`);
		assert.equal(map["shade-2"], roles.sideFar, `${theme} far side`);
		assert.equal(map["shade-0"], roles.sideDeep, `${theme} deepest side`);
		// K13: tops lightest in both themes, then the near side, then the far side.
		const [top, near, far] = [roles.top, roles.sideNear, roles.sideFar].map(value => luminance(themeColor(value.match(/var\((--[\w-]+)\)/)[1], theme)));
		assert.ok(top > near && near > far, `${theme}: luminance top ${top.toFixed(3)} > near ${near.toFixed(3)} > far ${far.toFixed(3)}`);
	}
});

test("T2b camera: createKit().camera fits with the shared 45/30 camera", async () => {
	const { createKit } = await load("hero.mjs");
	const kit = createKit();
	assert.equal(kit.camera.AZIMUTH, FIGURE_CAMERA.azimuth);
	assert.equal(kit.camera.ELEVATION, FIGURE_CAMERA.elevation);
	const fitted = kit.camera.fit([[0, 0, 0], [10, 10, 10]], 600, 380, { pad: 20, azimuth: 42, elevation: 44 });
	assert.deepEqual([fitted.azimuth, fitted.elevation], [45, 30], "a hero cannot override the shared camera through fit()");
	assert.throws(() => kit.fadeLineSvg([[0, 0], [1, 1]]), /fadeLineSvg uses a gradient; use fadedSvg/);
});

test("T3 CSS: scoped, token-only, halo-free, and flow/pulse only on request", async () => {
	const { anatomyCss, parseCssBlocks, scopeIsoCss, HERO_SCOPE } = await load("css.mjs");
	const { collectColorTokenIssues } = await import(pathToFileURL(path.join(HERE, "..", "check-html.mjs")).href);
	const css = anatomyCss();
	assert.deepEqual(collectColorTokenIssues(page("", `<style>\n${css}\n</style>`)), []);
	assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
	assert.doesNotMatch(css, /blur\(|stroke-width:\.4\b|stroke-width:\.45/);
	assert.doesNotMatch(css, /data-(?:tone|mark)="(?:red|green|blue)"/);
	assert.doesNotMatch(css, /animation\s*:/, "no animation without flags (the motion-budget gate scans style text)");
	assert.match(css, /\.iso-halo\{display:none\}/);
	const selectors = blocks => blocks.flatMap(({ prelude, body }) => (prelude.startsWith("@media") ? selectors(parseCssBlocks(body)) : prelude.startsWith("@keyframes") ? [] : prelude.split(",")));
	for (const selector of selectors(parseCssBlocks(css.replace(/\/\*[\s\S]*?\*\//, "")))) {
		assert.ok(selector.trim().startsWith(HERO_SCOPE) || selector.trim().startsWith(`[data-theme="dark"] ${HERO_SCOPE}`), `unscoped selector ${selector}`);
	}
	for (const block of parseCssBlocks(css.replace(/\/\*[\s\S]*?\*\//, ""))) {
		if (/\.iso-dots\b/.test(block.prelude)) assert.doesNotMatch(block.body, /(^|[;\s])opacity:/, `${block.prelude} keeps print-safe fill-opacity`);
	}
	assert.match(css, /\.iso-dots circle\{[^}]*fill-opacity:\.32/);
	assert.match(css, new RegExp(`\\[data-theme="dark"\\] ${HERO_SCOPE.replace(/[[\]().=" -]/g, "\\$&")}\\{--anatomy-face:var\\(--ill-tone2\\)`));
	for (const override of [".iso-figure{display:block", ".iso-legend{text-align:left;max-width:none}", ".iso-plate{border:1px solid var(--rule)", ".iso-stage{touch-action:pan-y}"]) assert.ok(css.includes(override), override);
	assert.match(css, /@media print\{[^\n]*\.iso-plate-corner\[data-corner="hint"\]\{display:none\}[^\n]*\.iso-face-text\{display:none\}/);
	// Round-4 budget fix: what ships is the vendored CSS minus exactly the declarations the overrides make dead (a
	// property an override sets on the same selector at the same level, or an offset on a corner they make static).
	assert.ok(css.includes(".iso-plate-corner{position:static"), "the corners are static, so their offsets are inert");
	const leaves = rules => rules.flatMap(rule => {
		const [{ prelude, body }] = parseCssBlocks(rule);
		return prelude.startsWith("@media") ? parseCssBlocks(body).map(inner => [`${prelude} ${inner.prelude}`, inner.body]) : [[prelude, body]];
	});
	const split = body => body.split(";").filter(Boolean);
	const full = leaves(scopeIsoCss({ flow: true, pulse: true }));
	const pruned = leaves(scopeIsoCss({ flow: true, pulse: true, prune: true }));
	const dropped = [];
	let next = 0;
	for (const [prelude, body] of full) {
		const all = split(body);
		const kept = pruned[next]?.[0] === prelude && split(pruned[next][1]).every(item => all.includes(item)) ? split(pruned[next++][1]) : [];
		assert.deepEqual(kept, all.filter(item => kept.includes(item)), `${prelude}: kept declarations stay in order`);
		dropped.push(...all.filter(item => !kept.includes(item)).map(item => `${prelude.replaceAll(`${HERO_SCOPE} `, "")} ${item}`));
	}
	assert.equal(next, pruned.length, "every shipped vendored rule comes from the vendored CSS");
	assert.ok(anatomyCss({ flow: true, pulse: true }).includes(scopeIsoCss({ flow: true, pulse: true, prune: true }).join("\n")), "anatomyCss ships the pruned rules");
	assert.deepEqual(dropped, [
		".iso-svg width:100%",
		".iso-figure margin:32px 0 36px",
		".iso-plate border-radius:0",
		".iso-plate box-shadow:0 0 0 1px var(--anatomy-mid)",
		".iso-plate-corner position:absolute",
		".iso-plate-corner line-height:1",
		'.iso-plate-corner[data-corner="fig"] top:0',
		'.iso-plate-corner[data-corner="fig"] left:0',
		'.iso-plate-corner[data-corner="title"] top:0',
		'.iso-plate-corner[data-corner="title"] right:0',
		'.iso-plate-corner[data-corner="hint"] bottom:0',
		'.iso-plate-corner[data-corner="hint"] left:0',
		'.iso-plate-corner[data-corner="readout"] right:0',
		'.iso-plate-corner[data-corner="readout"] bottom:0',
		'@media (max-width:560px) .iso-plate-corner[data-corner="hint"] bottom:18px',
	]);
	const flow = anatomyCss({ flow: true });
	assert.equal(count(flow, "@keyframes iso-flow"), 1);
	assert.equal(count(flow, "animation:iso-flow"), 1);
	assert.doesNotMatch(flow, /iso-pulse/);
	assert.match(flow, /prefers-reduced-motion:reduce\)\{[^}]*\[data-flow\]\{animation:none\}/);
	const pulse = anatomyCss({ pulse: true });
	assert.match(pulse, /@keyframes iso-pulse\{0%,100%\{fill-opacity:\.18\}/, "pulse keyframes are print-safe too");
	assert.doesNotMatch(pulse, /iso-flow/);
	assert.equal(anatomyCss(), anatomyCss(), "deterministic");
});

test("T4 kit subset: 53 of 70 declarations, parse-clean, and the same maths as the vendored kit", async () => {
	const { kitDeclarations, kitRuntimeNames, kitRuntimeSource, RUNTIME_EXCLUDE } = await load("runtime.mjs");
	assert.equal(kitDeclarations().length, 70);
	assert.equal(RUNTIME_EXCLUDE.length, 17);
	assert.equal(kitRuntimeNames().length, 53);
	const source = kitRuntimeSource();
	assert.doesNotMatch(source, /<svg|Gradient|ISO_CSS|#[0-9a-f]{3,8}\b/i);
	const subset = new Function(`${source}\nreturn { ${kitRuntimeNames().join(", ")} };`)();
	const vendored = await import(pathToFileURL(path.join(VENDOR, "kit/iso-kit.mjs")).href);
	let seed = 7;
	const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 200 - 100;
	const P = vendored.fitProjection([[-60, -30, -12], [60, 30, 40]], 480, 300, { pad: 24 });
	for (let index = 0; index < 50; index++) {
		const point = [random(), random(), random()];
		const plan = { x: random(), y: random(), w: 4 + Math.abs(random()) / 4, d: 4 + Math.abs(random()) / 4, r: 1 };
		const [x, y, h] = [random(), random(), 1 + Math.abs(random()) / 10];
		assert.deepEqual(subset.iso(point, P), vendored.iso(point, P));
		assert.equal(subset.translateAlong(P, point), vendored.translateAlong(P, point));
		assert.equal(subset.lineOnTop([x, y], [y, x], h, P), vendored.lineOnTop([x, y], [y, x], h, P));
		assert.equal(subset.slabOf(plan, h, h, P, 4, 0.5).outline, vendored.slabOf(plan, h, h, P, 4, 0.5).outline);
		assert.equal(subset.cylinder(x, y, h, 0, h, P, 20).fill, vendored.cylinder(x, y, h, 0, h, P, 20).fill);
	}
});

function stubWindow({ loop = null, heroes = [] } = {}) {
	const calls = { raf: 0, io: 0, warn: [] };
	const document = { readyState: "complete", querySelectorAll: selector => (selector.includes("anatomy-hero") ? heroes : []), addEventListener() {}, createElement: () => ({ setAttribute() {}, style: {} }) };
	const win = {
		document,
		console: { warn: message => calls.warn.push(message), error() {}, log() {} },
		performance: { now: () => 1000 },
		setTimeout: () => 0,
		clearTimeout() {},
		requestAnimationFrame: () => ((calls.raf += 1), 1),
		cancelAnimationFrame() {},
		IntersectionObserver: class { constructor() { calls.io += 1; } observe() {} unobserve() {} disconnect() {} },
		matchMedia: () => ({ matches: false, addEventListener() {} }),
		addEventListener() {},
		removeEventListener() {},
	};
	win.self = win;
	win.window = win;
	if (loop) win.vpkFrameLoop = loop;
	return { win, calls };
}

const scriptBody = html => html.replace(/^<script[^>]*>\n?/, "").replace(/<\/script>$/, "");

test("T5 runtime script: valid markup, no name clashes, and only three globals", async () => {
	const { anatomyRuntimeScript, kitRuntimeNames, frameLoopSource, mountRuntimeSource } = await load("runtime.mjs");
	const { collectColorTokenIssues, collectSvgGrammarIssues } = await import(pathToFileURL(path.join(HERE, "..", "check-html.mjs")).href);
	const script = anatomyRuntimeScript();
	assert.deepEqual(collectColorTokenIssues(page(script)), []);
	assert.deepEqual(collectSvgGrammarIssues(page(script)), []);
	// Top-level names come from the indented module sources (the inlined mount and loop sources drop indentation).
	const topLevel = source => [...source.matchAll(/^(?:export )?(?:async )?(?:function|const|let|class) (\w+)/gm)].map(match => match[1]);
	const mountNames = topLevel(fs.readFileSync(path.join(HERE, "mount-runtime.mjs"), "utf8"));
	assert.deepEqual(mountNames, ["follow", "spring", "settle", "smooth", "burst", "createAnatomyRuntime"]);
	assert.ok(mountRuntimeSource().includes("function createAnatomyRuntime(win, loop, kit)") && !/^export /m.test(mountRuntimeSource()));
	const loopNames = topLevel(fs.readFileSync(path.join(HERE, "..", "runtime", "frame-loop.mjs"), "utf8"));
	assert.deepEqual(loopNames, ["FRAME_LOOP_VERSION", "createFrameLoop", "getFrameLoop"]);
	assert.ok(frameLoopSource().startsWith("const FRAME_LOOP_VERSION = 1;") && !/^[\t ]|^\/\/|^export /m.test(frameLoopSource()), "the loop is inlined without comments, indentation or exports");
	const names = [...kitRuntimeNames(), ...loopNames, ...mountNames, "kit"];
	assert.equal(new Set(names).size, names.length, `repeated top-level names: ${names.filter((name, index) => names.indexOf(name) !== index)}`);

	const fresh = stubWindow();
	const before = new Set(Object.keys(fresh.win));
	vm.runInNewContext(scriptBody(script), fresh.win);
	assert.deepEqual(Object.keys(fresh.win).filter(key => !before.has(key)).sort(), ["vpkAnatomy", "vpkAnatomyQueue", "vpkFrameLoop"]);
	for (const leaked of ["iso", "ring", "slabOf", "translateAlong", "createAnatomyRuntime", "createFrameLoop"]) assert.equal(leaked in fresh.win, false, `${leaked} leaked`);
	assert.equal(fresh.win.vpkAnatomy.version, 1);
	assert.equal(Object.isFrozen(fresh.win.vpkAnatomy), true);
	assert.equal(typeof fresh.win.vpkAnatomy.kit.iso, "function");

	const registered = [];
	const loop = { register: (...args) => (registered.push(args), { wake() {}, unregister() {} }), reducedMotion: () => false, onReducedMotionChange: () => () => {} };
	const shared = stubWindow({ loop });
	vm.runInNewContext(scriptBody(script), shared.win);
	assert.equal(shared.win.vpkFrameLoop, loop, "an existing vpkFrameLoop is reused, never replaced");
	assert.deepEqual([shared.calls.raf, shared.calls.io], [0, 0], "the runtime never calls rAF or new IntersectionObserver itself");
});

// K26 (decision 18e): every stage handler ignores an event whose composedPath() holds a [data-vpk-review-ui] node.
// A fake slider hero records its stage listeners; each one is called with a foreign event (it must do nothing at
// all) and with an ordinary one (it must act), so a handler added without the guard cannot slip through.
test("T5b K26: every stage handler ignores events from the review UI and acts on ordinary ones", async () => {
	const { anatomyRuntimeScript } = await load("runtime.mjs");
	const seen = { writes: 0, wakes: 0, clears: 0, prevented: 0 };
	const listeners = [];
	const rect = { left: 0, top: 0, width: 100, height: 100 };
	const stage = {
		addEventListener: (name, fn) => listeners.push([name, fn]),
		setAttribute: () => (seen.writes += 1),
		matches: () => false,
		closest: () => null,
		querySelector: () => svg,
	};
	const svg = { getBoundingClientRect: () => rect };
	const island = { textContent: JSON.stringify({ P: { origin: [0, 0] }, control: { role: "slider", min: 0, max: 10, step: 1, rest: 5, pointer: { axis: "x", from: 0, to: 1 }, tour: { stops: [5, 1], dwell: 2, delay: 1, resume: 3 } }, data: {} }) };
	const root = { getAttribute: name => (name === "data-vpk-figure" ? "t5b" : null), querySelector: selector => (selector === "[data-vpk-anatomy-data]" ? island : selector === ".iso-stage" ? stage : null) };
	const loop = { register: () => ({ wake: () => (seen.wakes += 1), unregister() {} }), reducedMotion: () => false, onReducedMotionChange: () => () => {} };
	const { win } = stubWindow({ loop, heroes: [root] });
	win.vpkAnatomyQueue = [];
	win.clearTimeout = () => (seen.clears += 1);
	vm.runInNewContext(scriptBody(anatomyRuntimeScript()), win);
	assert.deepEqual(listeners.map(([name]) => name).sort(), ["blur", "focus", "keydown", "pointercancel", "pointerdown", "pointerenter", "pointerleave", "pointermove", "pointerup"]);
	const review = { matches: selector => selector === "[data-vpk-review-ui]" };
	const event = (name, path) => ({ type: name, key: "End", clientX: 90, clientY: 50, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, composedPath: () => path, preventDefault: () => (seen.prevented += 1) });
	const snapshot = () => JSON.stringify(seen);
	for (const [name, handler] of listeners) {
		const before = snapshot();
		handler(event(name, [review, stage]));
		assert.equal(snapshot(), before, `${name}: a review-UI event changed the hero`);
		handler(event(name, [stage]));
		assert.notEqual(snapshot(), before, `${name}: an ordinary event did nothing, so the guard proves nothing`);
	}
});

test("T6 truth model: the stamped readout and ARIA come from present(model(rest)), and the serialized functions agree", async () => {
	for (const [file, build] of [[FIXTURE_MODULE, fixtureBuild], [DIAL_MODULE, dialBuild]]) {
		const mod = await import(pathToFileURL(file).href);
		const built = await build();
		const { input } = mod.hero.stage;
		const presented = mod.present(mod.model(input.rest, mod.data), mod.data);
		const escape = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		assert.ok(built.fragment.includes(`data-readout>${escape(presented.readout)}</span>`), `${mod.hero.id} readout`);
		const stage = built.fragment.match(/<div class="iso-stage"[^>]*>/)[0];
		assert.match(stage, new RegExp(`aria-valuetext="${escape(presented.valueText).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
		assert.match(stage, new RegExp(`aria-valuemin="${input.min}" aria-valuemax="${input.max}" aria-valuenow="${input.rest}"`));
		const live = built.fragment.match(/<script data-vpk-anatomy-live="[^"]+">([\s\S]*?)<\/script>/)[1];
		for (const name of ["model", "present", "live"]) assert.ok(live.includes(`${name}: ${mod[name].toString()}`), `${mod.hero.id} serializes ${name} verbatim`);
		const revive = fn => new Function(`return (${fn.toString()});`)();
		const [model, present] = [revive(mod.model), revive(mod.present)];
		const sandbox = vm.createContext(Object.freeze(Object.create(null)));
		const isolated = vm.runInContext(`({ model: ${mod.model.toString()}, present: ${mod.present.toString()} })`, sandbox);
		const data = JSON.parse(JSON.stringify(mod.data));
		for (let index = 0; index <= 49; index++) {
			const value = input.min + ((input.max - input.min) * index) / 49;
			const expected = mod.model(value, mod.data);
			assert.deepEqual(model(value, data), expected);
			assert.deepEqual(mod.model(value, mod.data), expected, "pure: two calls agree");
			assert.deepEqual(present(expected, data), mod.present(expected, mod.data));
			assert.deepEqual(JSON.parse(JSON.stringify(isolated.present(isolated.model(value, data), data))), mod.present(expected, mod.data), "no closure or global beyond built-ins");
		}
	}
});

test("T6b truth model: data that JSON would alter is rejected by name, so build and the live model read the same values", async () => {
	const { buildHero, jsonSafetyIssue } = await load("hero.mjs");
	const base = await import(pathToFileURL(FIXTURE_MODULE).href);
	class Gauge {}
	const cycle = { name: "loop" };
	cycle.self = cycle;
	const cases = [
		[{ limit: Infinity }, /data\.limit is Infinity, which JSON writes as null/],
		[{ floor: -Infinity }, /data\.floor is -Infinity/],
		[{ gain: NaN }, /data\.gain is NaN/],
		[{ zero: -0 }, /data\.zero is -0, which JSON writes as 0/],
		[{ gap: undefined }, /data\.gap is undefined/],
		[{ list: [1, undefined, 3] }, /data\.list\[1\] is undefined/],
		[{ f() { return 1; } }, /data\.f is a function/],
		[{ mark: Symbol("m") }, /data\.mark is a symbol/],
		[{ n: 1n }, /data\.n is a BigInt/],
		[{ when: new Date(0) }, /data\.when is a Date; use plain objects/],
		[{ table: new Map([["a", 1]]) }, /data\.table is a Map/],
		[{ tags: new Set([1]) }, /data\.tags is a Set/],
		[{ gauge: new Gauge() }, /data\.gauge is a Gauge/],
		[{ samples: new Float32Array(2) }, /data\.samples is a Float32Array/],
		[{ "two words": { deep: [{ at: NaN }] } }, /data\["two words"\]\.deep\[0\]\.at is NaN/],
		[{ sparse: Object.assign(new Array(3), { 0: 1, 2: 3 }) }, /data\.sparse is an array with holes/],
		[{ [Symbol("hidden")]: 1 }, /data has symbol keys/],
		[{ cycle }, /data\.cycle\.self is a cycle/],
	];
	for (const [extra, message] of cases) {
		await assert.rejects(buildHero({ ...base, data: { ...base.data, ...extra } }), error => message.test(error.message) && /data must be JSON-safe: /.test(error.message), String(message));
	}
	const shared = { at: 4, w: 2 };
	const accepted = { ...base.data, a: shared, b: shared, none: null, nested: [[0, 1.5], ["x", true]], bare: Object.assign(Object.create(null), { k: 1 }) };
	assert.equal(jsonSafetyIssue(accepted), null, "shared references, null, nested arrays and null-prototype objects are JSON-safe");
	const built = await buildHero({ ...base, data: accepted });
	const island = JSON.parse(built.fragment.match(/<script type="application\/json" data-vpk-anatomy-data>([\s\S]*?)<\/script>/)[1]);
	assert.deepEqual(island.data, { ...accepted, bare: { k: 1 } }, "the island holds the data exactly as written");
	for (const value of [0, 1.25, -3, "", "text", true, false, null, [], {}]) assert.equal(jsonSafetyIssue(value), null, JSON.stringify(value));
});

const islandOf = built => JSON.parse(built.fragment.match(/<script type="application\/json" data-vpk-anatomy-data>([\s\S]*?)<\/script>/)[1]);

test("T6c tour: omitted timings reach the island as the 6.3 defaults, and bad stops or timings are rejected by name", async () => {
	const { buildHero, islandTour, TOUR_DEFAULTS } = await load("hero.mjs");
	const base = await import(pathToFileURL(FIXTURE_MODULE).href);
	const withTour = tour => ({ ...base, hero: { ...base.hero, stage: { ...base.hero.stage, tour } } });
	assert.deepEqual({ ...TOUR_DEFAULTS }, { dwell: 2.2, delay: 1.4, resume: 3.6 }, "spec 6.3: delay [1.4 s], dwell [2.2 s], resume [3.6 s]");
	assert.ok(Object.isFrozen(TOUR_DEFAULTS));

	// Rule 1: the island always carries dwell, delay and resume, so the runtime never reads an omitted field.
	const stops = [27, 13];
	const defaulted = [
		[{ stops }, { stops, dwell: 2.2, delay: 1.4, resume: 3.6 }],
		[{ stops, dwell: 2.2, delay: 1.4 }, { stops, dwell: 2.2, delay: 1.4, resume: 3.6 }],
		[{ stops, delay: 1.4, resume: 3.6 }, { stops, delay: 1.4, resume: 3.6, dwell: 2.2 }],
		[{ stops, dwell: undefined, delay: 0, resume: 0 }, { stops, dwell: 2.2, delay: 0, resume: 0 }],
		[{ stops: [40], dwell: 0.5, delay: 2, resume: 9 }, { stops: [40], dwell: 0.5, delay: 2, resume: 9 }],
	];
	for (const [tour, expected] of defaulted) {
		const { control } = islandOf(await buildHero(withTour(tour)));
		assert.deepEqual(control.tour, expected, `island tour for ${JSON.stringify(tour)}`);
		for (const name of ["dwell", "delay", "resume"]) assert.ok(Number.isFinite(control.tour[name]), `${name} is a finite number`);
	}
	for (const tour of [undefined, null]) assert.equal(islandOf(await buildHero(withTour(tour))).control.tour, null, `no tour for ${tour}`);
	const full = base.hero.stage.tour;
	assert.equal(JSON.stringify(islandTour(full)), JSON.stringify(full), "a tour that names every field keeps its key order");
	assert.equal(JSON.stringify(islandOf(await fixtureBuild()).control.tour), JSON.stringify(full), "so existing islands serialize unchanged");
	assert.notEqual(islandTour(full), full, "the module's tour is copied, never mutated");

	// Rule 2: an empty or non-array stops list and non-finite or negative timings fail the build by name.
	const rejected = [
		[[27, 13], /stage\.tour must be an object \{ stops, dwell\?, delay\?, resume\? \} or null, got 27,13/],
		[5, /stage\.tour must be an object .* got 5/],
		[true, /stage\.tour must be an object .* got true/],
		[{}, /stage\.tour\.stops must be a non-empty array of inputs; omit stage\.tour for no tour/],
		[{ stops: [] }, /stage\.tour\.stops must be a non-empty array/],
		[{ stops: 27 }, /stage\.tour\.stops must be a non-empty array/],
		[{ stops: { 0: 27, length: 1 } }, /stage\.tour\.stops must be a non-empty array/],
		[{ stops: [27, "13"] }, /tour stop "13" is not a finite number/],
		[{ stops: [27, NaN] }, /tour stop NaN is not a finite number/],
		[{ stops: [27, null] }, /tour stop null is not a finite number/],
		[{ stops: [27, 99] }, /tour stop 99 is outside \[0, 40\]/],
		[{ stops: [-1] }, /tour stop -1 is outside \[0, 40\]/],
		[{ stops, dwell: 0 }, /stage\.tour\.dwell must be a finite number of seconds > 0, got 0/],
		[{ stops, dwell: -2.2 }, /stage\.tour\.dwell must be a finite number of seconds > 0, got -2\.2/],
		[{ stops, dwell: NaN }, /stage\.tour\.dwell must be .* got NaN/],
		[{ stops, dwell: Infinity }, /stage\.tour\.dwell must be .* got Infinity/],
		[{ stops, delay: -0.5 }, /stage\.tour\.delay must be a finite number of seconds ≥ 0, got -0\.5/],
		[{ stops, delay: Infinity }, /stage\.tour\.delay must be .* got Infinity/],
		[{ stops, delay: "1.4" }, /stage\.tour\.delay must be .* got "1\.4"/],
		[{ stops, resume: -3.6 }, /stage\.tour\.resume must be a finite number of seconds ≥ 0, got -3\.6/],
		[{ stops, resume: NaN }, /stage\.tour\.resume must be .* got NaN/],
		[{ stops, resume: null }, /stage\.tour\.resume must be .* got null/],
		[{ stops, resume: 4n }, /stage\.tour\.resume must be .* got 4n/],
	];
	for (const [tour, message] of rejected) {
		await assert.rejects(buildHero(withTour(tour)), error => message.test(error.message) && /^anatomy hero carriage: /.test(error.message), String(message));
	}
});

test("T6d slider extras: bigStep and pointer values the runtime would misread are rejected by name", async () => {
	const { buildHero } = await load("hero.mjs");
	const base = await import(pathToFileURL(FIXTURE_MODULE).href);
	const withStage = stage => ({ ...base, hero: { ...base.hero, stage: { ...base.hero.stage, ...stage } } });
	const withBigStep = bigStep => withStage({ input: { ...base.hero.stage.input, bigStep } });

	// Accepted: the fixture as written, an omitted bigStep (5 steps), no pointer, a reversed or y-axis pointer.
	const accepted = [
		[withBigStep(undefined), control => control.bigStep === base.hero.stage.input.step * 5],
		[withBigStep(0.5), control => control.bigStep === 0.5],
		[withStage({ pointer: undefined }), control => control.pointer === null],
		[withStage({ pointer: null }), control => control.pointer === null],
		[withStage({ pointer: { axis: "y", from: 0.9, to: 0.1 } }), control => control.pointer.axis === "y" && control.pointer.from === 0.9],
		[withStage({ pointer: { axis: "x", from: 0, to: 1 } }), control => control.pointer.to === 1],
	];
	for (const [mod, ok] of accepted) {
		const { control } = islandOf(await buildHero(mod));
		assert.ok(ok(control), JSON.stringify({ bigStep: control.bigStep, pointer: control.pointer }));
	}
	assert.equal(JSON.stringify(islandOf(await fixtureBuild()).control), JSON.stringify(islandOf(await buildHero(base)).control), "valid islands serialize unchanged");

	const rejected = [
		[withBigStep("16"), /input\.bigStep must be a finite number > 0 \(omit it for 5 steps\), got "16"/],
		[withBigStep(-10), /input\.bigStep must be .* got -10/],
		[withBigStep(0), /input\.bigStep must be .* got 0/],
		[withBigStep(NaN), /input\.bigStep must be .* got NaN/],
		[withBigStep(Infinity), /input\.bigStep must be .* got Infinity/],
		[withBigStep(null), /input\.bigStep must be .* got null/],
		[withStage({ pointer: "x" }), /stage\.pointer must be an object \{ axis, from, to \} or null, got "x"/],
		[withStage({ pointer: [0.15, 0.85] }), /stage\.pointer must be an object .* got 0\.15,0\.85/],
		[withStage({ pointer: { axis: "x" } }), /stage\.pointer\.from must be a fraction of the drawing in \[0, 1\], got undefined/],
		[withStage({ pointer: { from: 0.15, to: 0.85 } }), /stage\.pointer\.axis must be "x" or "y", got undefined/],
		[withStage({ pointer: { axis: "z", from: 0.15, to: 0.85 } }), /stage\.pointer\.axis must be "x" or "y", got "z"/],
		[withStage({ pointer: { axis: "x", from: 0.15, to: "0.85" } }), /stage\.pointer\.to must be .* got "0\.85"/],
		[withStage({ pointer: { axis: "x", from: 90, to: 510 } }), /stage\.pointer\.from must be a fraction of the drawing in \[0, 1\], got 90/],
		[withStage({ pointer: { axis: "x", from: -0.1, to: 0.85 } }), /stage\.pointer\.from must be .* got -0\.1/],
		[withStage({ pointer: { axis: "x", from: 0.15, to: NaN } }), /stage\.pointer\.to must be .* got NaN/],
		[withStage({ pointer: { axis: "x", from: 0.5, to: 0.5 } }), /stage\.pointer\.from and stage\.pointer\.to must differ, both are 0\.5/],
	];
	for (const [mod, message] of rejected) {
		await assert.rejects(buildHero(mod), error => message.test(error.message) && /^anatomy hero carriage: /.test(error.message), String(message));
	}
});

// Module scope for T6e: a model or present that reads it builds in Node but throws in the page.
const T6E_OFFSET = 3;

test("T6e truth model: a model or present that reads module scope or a Node global fails the build by name", async () => {
	const { buildHero } = await load("hero.mjs");
	const base = await import(pathToFileURL(FIXTURE_MODULE).href);
	const fixtureState = (input, data) => {
		const cx = data.from + input;
		const block = data.blocks.findIndex(b => cx + b.at <= data.probe && data.probe <= cx + b.at + b.w);
		return { travel: input, cx, block, height: block < 0 ? 0 : data.blocks[block].h };
	};
	const rejected = [
		// The verifier's closure probe: the model reads a module-level constant.
		[{ model: (input, data) => ({ travel: input, cx: data.from + input + T6E_OFFSET * 0, block: -1, height: 0 }) }, /the serialized model throws at input 27: ReferenceError: T6E_OFFSET is not defined/],
		[{ model: (input, data) => fixtureState(input, data) }, /the serialized model throws at input 27: ReferenceError: fixtureState is not defined/],
		[{ present: state => ({ ...base.present(state) }) }, /the serialized present throws at input 27: ReferenceError: base is not defined/],
		// A Node global the page does not have: the same call gives another state in the page.
		[{ model: (input, data) => ({ travel: input, cx: data.from + input, block: typeof process === "object" ? -1 : 0, height: 0 }) }, /the serialized model gives a different state at input 27/],
		// A present that reads a Node global: the page's readout loses the suffix the stamped one has.
		[{ present: state => ({ readout: `travel ${state.travel}`, valueText: `Travel ${state.travel}${typeof Buffer === "function" ? " (node)" : ""}` }) }, /the serialized present gives a different readout at input 27/],
	];
	for (const [overrides, message] of rejected) {
		await assert.rejects(buildHero(await variant(overrides)), error => message.test(error.message) && /^anatomy hero carriage: .*may read only their arguments, built-ins and their own locals, and must be pure$/.test(error.message), String(message));
	}
	// The serialized slider is replayed at its ends and between them, not only at rest.
	const endOnly = { model: (input, data) => (input === 40 ? fixtureState(input, data) : { travel: input, cx: data.from + input, block: -1, height: 0 }) };
	await assert.rejects(buildHero(await variant(endOnly)), /the serialized model throws at input 40: ReferenceError: fixtureState is not defined/);
	// Nothing is serialized for a static figure without live(), so its model may read module scope.
	const still = await buildHero(await variant({ hero: { ...base.hero, stage: { role: "img", label: base.hero.stage.label, input: { rest: 27 } } }, live: undefined, model: (input, data) => fixtureState(input, data) }));
	assert.equal(/data-vpk-anatomy-live/.test(still.fragment), false);
	// The shipped fixture and dial pass unchanged (T6 proves their serialized parity on 50 inputs).
	assert.equal((await buildHero(base, { src: "_figures/carriage.hero.mjs" })).fragment, (await fixtureBuild()).fragment);
});

test("T7 audit: the 12-part fixture audits clean in under 5 s", async () => {
	const built = await fixtureBuild();
	assert.equal(built.parts, 12);
	assert.equal(built.audit.failures, 0, built.audit.report);
	assert.ok(built.audit.ms < 5000, `${built.audit.ms} ms`);
});

async function variant(overrides) {
	const base = await import(pathToFileURL(FIXTURE_MODULE).href);
	return { ...base, ...overrides };
}

test("T8 markup sanitizer: each banned construct throws a named message", async () => {
	const { buildHero, createKit } = await load("hero.mjs");
	const base = await import(pathToFileURL(FIXTURE_MODULE).href);
	const withMarkup = extra => variant({ build: (kit, ctx) => ({ ...base.build(kit, ctx), after: [extra] }) });
	const cases = [
		['<path class="iso-line" data-tone="red" d="M0 0L1 1"/>', /status hue tone/],
		["<path class='iso-line' data-tone='green' d='M0 0L1 1'/>", /status hue tone/],
		["<path class=iso-line data-mark=blue d='M0 0L1 1'/>", /status hue tone/],
		["<path d='M0 0L1 1' data-tone=red>", /status hue tone/],
		['<path class="iso-halo" d="M0 0L1 1"/>', /halo/],
		["<defs><linearGradient id=\"g\"></linearGradient></defs>", /gradient/],
		['<path d="M0 0L1 1" style="filter:blur(4px)"/>', /filter: inside a style attribute/],
		["<path d='M0 0L1 1' style='stroke-width:1;filter:blur(4px)'/>", /filter: inside a style attribute/],
		["<path d='M0 0L1 1' style=filter:blur(4px) />", /filter: inside a style attribute/],
		['<g data-part="carriage" transform="translate(4 2)"></g>', /transform= at rest outside \.iso-face-text/],
		['<g opacity="0.5"><path d="M0 0L1 1"/></g>', /opacity= attribute/],
		// Print forces opacity 1 and transform none on style declarations too.
		['<g style="opacity:.4"><path d="M0 0L1 1"/></g>', /opacity: or transform: inside a style attribute/],
		["<g data-part='carriage' style='transform: translate(4px, 2px)'></g>", /opacity: or transform: inside a style attribute/],
	];
	for (const [markup, message] of cases) await assert.rejects(buildHero(await withMarkup(markup)), message, markup);
	// Whole tone values only, and style declarations print keeps, pass (as in check-html H3/H4).
	for (const markup of ['<path data-tone="redwood" d="M0 0L1 1"/>', "<path data-tone=blueprint d='M0 0L1 1'/>", '<path style="stroke-width:1.1;fill-opacity:.5;transform-origin:center;--pulse-at:137ms" d="M0 0L1 1"/>']) {
		await assert.doesNotReject(buildHero(await withMarkup(markup)), markup);
	}
	await assert.rejects(buildHero(await variant({ build: kit => kit.fadeLineSvg([[0, 0], [10, 10]]) })), /fadeLineSvg uses a gradient; use fadedSvg/);
	const faded = createKit().fadedSvg([["M0 0L1 1", 0.5], ["M1 1L2 2", 1]], { tone: "lo" });
	assert.match(faded, /<g stroke-opacity="0\.50">/);
	assert.doesNotMatch(faded, /\sopacity=/);
	const text = createKit().faceTextSvg("matrix(1 0 0 1 0 0)", "0.01");
	assert.doesNotThrow(() => (createKit(), text), "face text keeps its transform");
});

test("T9 script sanitizer: live sources that would trip check-html or own a loop are rejected", async () => {
	const { buildHero } = await load("hero.mjs");
	const cases = [
		["return '</script>';", /<\/script/],
		["return '#a1b2c3';", /raw colour/],
		["return '{{x}}';", /\{\{/],
		["return 'rgb(1, 2, 3)';", /raw colour/],
		["return '<svg>';", /<svg/],
		["return '<button>';", /<button/],
		["requestAnimationFrame(() => {});", /requestAnimationFrame/],
		["new IntersectionObserver(() => {});", /IntersectionObserver/],
		["setInterval(() => {}, 10);", /setInterval/],
		["document.addEventListener('keydown', () => {});", /document\.addEventListener/],
	];
	for (const [body, message] of cases) await assert.rejects(buildHero(await variant({ live: new Function("ctx", body) })), message, body);
	const { validateHtmlString } = await import(pathToFileURL(path.join(HERE, "..", "check-html.mjs")).href);
	const hostile = await buildHero(await variant({ data: { ...(await import(pathToFileURL(FIXTURE_MODULE).href)).data, note: "#123 {{x}} rgb(0,0,0) </script>" } }));
	assert.match(hostile.fragment, /\\u0023123 \\u007b\\u007bx\\u007d\\u007d rgb\\u00280,0,0\\u0029 \\u003c\/script\\u003e/);
	const { refreshAnatomyRuntime } = await load("runtime.mjs");
	const html = refreshAnatomyRuntime(page(hostile.fragment, '<meta name="vpk-figure-engine" content="anatomy-hero">'));
	assert.deepEqual(validateHtmlString(html).failures, []);
});

function tempArtifact(html) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-anatomy-"));
	fs.mkdirSync(path.join(dir, "_figures"));
	fs.copyFileSync(FIXTURE_MODULE, path.join(dir, "_figures", "carriage.hero.mjs"));
	const file = path.join(dir, "fixture.html");
	fs.writeFileSync(file, html);
	return file;
}

const runCli = (...args) => spawnSync(process.execPath, [BUILD_HERO, ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });

test("T10 build-hero CLI: idempotent insert, stale detection and ws1 id carry-over", async () => {
	const { buildHeroFile } = await load("build-hero.mjs");
	const file = tempArtifact(page(EMPTY_REGION));
	const first = await buildHeroFile(file);
	assert.equal(first.changed, true);
	const html = fs.readFileSync(file, "utf8");
	assert.equal(count(html, "<style data-vpk-anatomy-css>"), 1);
	assert.ok(html.indexOf("<style data-vpk-anatomy-css>") < html.indexOf("</head>"), "CSS block in <head>");
	assert.equal(count(html, "<script data-vpk-anatomy-runtime>"), 1);
	assert.equal(count(html, "<!-- vpk-anatomy-hero:start"), 1);
	assert.equal(count(html, "<script data-vpk-anatomy-live="), 1);
	assert.equal(count(html, '<meta name="vpk-figure-engine" content="anatomy-hero">'), 1, "R4: the meta is inserted when absent");
	assert.equal((await buildHeroFile(file)).changed, false, "a second run changes nothing");
	const clean = runCli(file, "--check");
	assert.equal(clean.status, 0, clean.stdout + clean.stderr);

	fs.writeFileSync(file, html.replace(">Fig 1<", ">Fig 9<"));
	const stale = runCli(file, "--check");
	assert.equal(stale.status, 1, stale.stdout);
	assert.match(stale.stdout, /is stale: rebuild with/);

	const stamped = html.replace(/(<div data-vpk-engine="anatomy-hero"[^>]*)>/, '$1 data-vpk-id="k7f3qa" data-vpk-revision="r2">');
	fs.writeFileSync(file, stamped);
	assert.equal((await buildHeroFile(file)).changed, false, "a stamped root rebuilds byte-exact");
	const after = fs.readFileSync(file, "utf8");
	assert.match(after, /data-vpkh-no-lightbox data-vpk-id="k7f3qa" data-vpk-revision="r2">/);
	const region = after.match(/<!-- vpk-anatomy-hero:start[\s\S]*?<!-- vpk-anatomy-hero:end[^>]*-->/)[0];
	assert.equal(count(region, "data-vpk-id="), 1, "no other data-vpk-id inside the region");
	assert.equal(runCli(file, "--check").status, 0);
	assert.equal(fs.readFileSync(file, "utf8").includes(" data-vpk-id='"), false);
	const meta = after.replace('content="anatomy-hero"', 'content="both"');
	fs.writeFileSync(file, meta);
	await buildHeroFile(file);
	assert.match(fs.readFileSync(file, "utf8"), /<meta name="vpk-figure-engine" content="both">/, "R4: an existing meta is never overwritten");
	assert.equal(runCli("--audit-only", FIXTURE_MODULE).status, 0);
	assert.equal(runCli().status, 2, "usage");

	// Unmatched markers are a validation error (exit 1, file untouched), never "no regions"; build.mjs delegates.
	const START = '<!-- vpk-anatomy-hero:start id="carriage" src="_figures/carriage.hero.mjs" -->';
	const END = '<!-- vpk-anatomy-hero:end id="carriage" -->';
	const broken = [
		["start without end", START, /✗ anatomy hero carriage: H6 start marker without a matching <!-- vpk-anatomy-hero:end id="carriage" -->/],
		["misspelled end", `${START}<!-- vpk-anatomy-hero:stop id="carriage" -->`, /H6 unknown marker <!-- vpk-anatomy-hero:stop[\s\S]*✗ anatomy hero carriage: H6 start marker without a matching/],
		["end without start", END, /✗ anatomy hero carriage: H6 end marker without a start marker/],
		["nested start", `${START}${START}${END}${END}`, /H6 start marker inside the unclosed region carriage[\s\S]*H6 end marker without a start marker/],
		["duplicate id", `${START}${END}\n${START}${END}`, /✗ anatomy hero carriage: H2 more than one region with id "carriage"/],
	];
	for (const [label, body, message] of broken) {
		const target = tempArtifact(page(body));
		const before = fs.readFileSync(target, "utf8");
		for (const args of [[target], [target, "--check"], [target, "--audit"]]) {
			const result = runCli(...args);
			assert.equal(result.status, 1, `${label} ${args.slice(1).join(" ")}: ${result.stdout}${result.stderr}`);
			assert.match(result.stderr, message, label);
			assert.doesNotMatch(result.stdout, /no vpk-anatomy-hero regions/, label);
		}
		const delegated = spawnSync(process.execPath, [path.join(HERE, "..", "build.mjs"), "--build-hero", target], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
		assert.equal(delegated.status, 1, `${label} via build.mjs: ${delegated.stdout}${delegated.stderr}`);
		const figures = spawnSync(process.execPath, [path.join(HERE, "..", "figures", "check-figures.mjs"), target, "--strict"], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
		assert.equal(figures.status, 1, `${label} --check-figures --strict: ${figures.stdout}`);
		assert.match(figures.stdout, /H6 /, label);
		assert.equal(fs.readFileSync(target, "utf8"), before, `${label}: nothing written`);
	}
});

test("T10b build-hero --audit: a failing audit writes nothing and prints no check mark (decision 18b)", async () => {
	const { buildHeroFile } = await load("build-hero.mjs");
	// The probe arm lifted off its post: the audit reports one unsupported solid, and the SVG is unchanged.
	const source = fs.readFileSync(FIXTURE_MODULE, "utf8");
	const lifted = source.replace('A.slab(arm, 32, 4, { name: "probe" }, 3)', 'A.slab(arm, 60, 4, { name: "probe" }, 3)');
	assert.notEqual(lifted, source, "the mutation applies");
	const file = tempArtifact(page(EMPTY_REGION));
	fs.writeFileSync(path.join(path.dirname(file), "_figures", "carriage.hero.mjs"), lifted);
	const before = fs.readFileSync(file, "utf8");
	const failed = await buildHeroFile(file, { audit: true });
	assert.equal(failed.ok, false);
	assert.equal(failed.written, false);
	assert.ok(failed.auditFailures > 0, "the lifted arm fails the audit");
	assert.equal(fs.readFileSync(file, "utf8"), before, "the document is untouched");
	for (const args of [[file, "--audit"], [file, "--audit", "--json"]]) {
		const run = runCli(...args);
		assert.equal(run.status, 1, run.stdout + run.stderr);
		assert.doesNotMatch(run.stdout, /✓/, "no check mark on a failed audit");
		assert.equal(fs.readFileSync(file, "utf8"), before, `${args.slice(1).join(" ")}: nothing written`);
	}
	assert.match(runCli(file, "--audit").stdout, /✗ .*fixture\.html: not written \(audit failed: \d+ problems?\)/);
	const delegated = spawnSync(process.execPath, [path.join(HERE, "..", "build.mjs"), "--build-hero", file, "--audit"], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	assert.equal(delegated.status, 1, delegated.stdout + delegated.stderr);
	assert.doesNotMatch(delegated.stdout, /✓/);
	assert.equal(fs.readFileSync(file, "utf8"), before, "build.mjs --build-hero --audit: nothing written");
	// Without --audit the audit never runs, so the same module still builds, and a clean --audit still writes.
	assert.equal((await buildHeroFile(file)).written, true);
	const clean = tempArtifact(page(EMPTY_REGION));
	const ok = runCli(clean, "--audit");
	assert.equal(ok.status, 0, ok.stdout + ok.stderr);
	assert.match(ok.stdout, /audit passed[\s\S]*✓ wrote /);
	assert.match(fs.readFileSync(clean, "utf8"), /vpk-anatomy-hero:start/);
});

test("T11 runtime step: in place, idempotent, removed with the last hero, and within budget", async () => {
	const { refreshAnatomyRuntime, anatomyCssBlock, anatomyRuntimeBlock, ANATOMY_BLOCKS_BUDGET_BYTES } = await load("runtime.mjs");
	const { anatomyHeroStep } = await import(pathToFileURL(path.join(HERE, "..", "runtime", "anatomy-hero.mjs")).href);
	const { validateHtmlString } = await import(pathToFileURL(path.join(HERE, "..", "check-html.mjs")).href);
	const { collectFigureEngineIssues } = await import(pathToFileURL(path.join(HERE, "..", "figures", "check-figures.mjs")).href);
	assert.deepEqual([anatomyHeroStep.id, [...anatomyHeroStep.kinds], anatomyHeroStep.budgetBytes], ["anatomy-hero", ["template", "demo", "illustration", "artifact"], 40960]);
	assert.equal("build" in anatomyHeroStep, false, "two blocks, not one marked block (pipeline T-P5 skips it)");
	// Every flag pair a hero can reach (kit L(…, { flow: true }) and D(…, { pulse: true })); the worst case is both.
	for (const flags of [{}, { flow: true }, { pulse: true }, { flow: true, pulse: true }]) {
		const blocks = Buffer.byteLength(anatomyCssBlock(flags)) + Buffer.byteLength(anatomyRuntimeBlock());
		assert.ok(blocks <= ANATOMY_BLOCKS_BUDGET_BYTES, `${JSON.stringify(flags)}: ${blocks} B > ${ANATOMY_BLOCKS_BUDGET_BYTES} B`);
	}
	const built = await fixtureBuild();
	const source = page(built.fragment, '<meta name="vpk-figure-engine" content="anatomy-hero">');
	const once = anatomyHeroStep.apply(source);
	assert.equal(anatomyHeroStep.apply(once), once, "idempotent");
	assert.ok(once.indexOf("<style data-vpk-anatomy-css>") < once.indexOf("</head>"));
	assert.ok(once.indexOf("<script data-vpk-anatomy-runtime>") > once.indexOf("<!-- vpk-anatomy-hero:end"));
	assert.deepEqual(validateHtmlString(once).failures, []);
	assert.deepEqual(collectFigureEngineIssues(once), { failures: [], warnings: [] });
	const moved = once.replace("<p>Visible copy.</p>", "<p>Visible copy, edited.</p>");
	assert.equal(anatomyHeroStep.apply(moved), moved, "blocks are replaced in place, never moved");
	const stale = once.replace(anatomyRuntimeBlock(), anatomyRuntimeBlock().replace("version: 1", "version: 0"));
	assert.equal(anatomyHeroStep.apply(stale), once, "a stale block is rewritten in place");
	const gone = refreshAnatomyRuntime(once.replace(/<!-- vpk-anatomy-hero:start[\s\S]*?<!-- vpk-anatomy-hero:end[^>]*-->\n?/, ""));
	assert.equal(count(gone, "vpk-anatomy-css"), 0);
	assert.equal(count(gone, "vpk-anatomy-runtime"), 0);
	assert.equal(refreshAnatomyRuntime(page("")), page(""), "inert without heroes");
});

test("T12 ws1 round trip: a block comment on the hero root resolves exact after a rebuild", async t => {
	const stampPath = path.join(HERE, "..", "review", "stamp.mjs");
	if (!fs.existsSync(stampPath)) return t.skip("ws1 review/stamp.mjs is not present yet");
	const { stampBlocks, parseDocument } = await import(pathToFileURL(stampPath).href);
	const { buildTextIndex, createBlockAnchor, resolveAnchor } = await import(pathToFileURL(path.join(HERE, "..", "review", "anchor.mjs")).href);
	const { buildHeroFile } = await load("build-hero.mjs");
	const file = tempArtifact(page(EMPTY_REGION));
	await buildHeroFile(file);
	const stamped = stampBlocks(fs.readFileSync(file, "utf8"), { seed: "anatomy-t12" });
	const rootTag = stamped.html.match(/<div data-vpk-engine="anatomy-hero"[^>]*>/)[0];
	const id = rootTag.match(/data-vpk-id="([^"]+)"/)?.[1];
	assert.ok(id, "ws1 stamps the hero root (data-vpk-block / data-vpk-engine)");
	const region = stamped.html.match(/<!-- vpk-anatomy-hero:start[\s\S]*?<!-- vpk-anatomy-hero:end[^>]*-->/)[0];
	assert.equal(count(region, "data-vpk-id="), 1, "data-vpk-review-ignore keeps the plate, SVG and legend unstamped");
	const doc = parseDocument(stamped.html);
	const anchor = createBlockAnchor(buildTextIndex(doc.querySelector("main")), doc.querySelector(`[data-vpk-id="${id}"]`));
	fs.writeFileSync(file, stamped.html);
	assert.equal((await buildHeroFile(file)).changed, false, "rebuild keeps the stamped root byte-exact");
	const rebuilt = fs.readFileSync(file, "utf8");
	const restamped = stampBlocks(rebuilt, { seed: "anatomy-t12-again", ledger: { blocks: stamped.blocks } });
	assert.equal(restamped.html.match(/<div data-vpk-engine="anatomy-hero"[^>]*>/)[0], rootTag, "re-stamping is a no-op for the root id");
	const after = parseDocument(restamped.html);
	assert.equal(resolveAnchor(buildTextIndex(after.querySelector("main")), anchor).status, "exact");
});
