// Inputs are byte arrays: the only colour-like strings in this file are expected bytesToHex outputs, and
// hex test inputs are built from bytes at run time. DOM cases run in happy-dom (a direct devDependency).
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateHtmlString } from "../check-html.mjs";
import { LAB_FONT_VARS, LAB_TOKEN_VARS, SWATCH_REASON_MIN, alpha, bytesToHex, hexToBytes, mix, onTheme, readTokens, resetColorCache, resolveColor, swatches } from "./runtime/color.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, "..", "..");
const STYLES = fs.readFileSync(path.join(SKILL, "styles.css"), "utf8");
// Token expectations come from references/tokens.json (the ADS-sourced layer styles.css mirrors), as 8-digit hex.
const TOKENS = JSON.parse(fs.readFileSync(path.join(SKILL, "references", "tokens.json"), "utf8"));
const hex8 = (theme, key) => `${TOKENS[theme][key]}ff`;
const require = createRequire(import.meta.url);
const { GlobalRegistrator } = require("@happy-dom/global-registrator");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

before(() => {
	if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register({ url: "http://localhost/" });
});
after(() => GlobalRegistrator.unregister());
beforeEach(() => {
	document.documentElement.removeAttribute("data-theme");
	document.documentElement.removeAttribute("style");
	document.head.innerHTML = `<style>${STYLES}</style>`;
	document.body.innerHTML = "<main><p>Lab</p></main>";
	resetColorCache();
});

const chroma = hex => {
	const [r, g, b] = hexToBytes(hex);
	return Math.max(r, g, b) - Math.min(r, g, b);
};

test("bytesToHex writes 8-digit hex, defaulting alpha to opaque and clamping bytes", () => {
	assert.equal(bytesToHex([49, 47, 47, 255]), "#312f2fff");
	assert.equal(bytesToHex([49, 47, 47]), "#312f2fff");
	assert.equal(bytesToHex([300, -5, 127.6, 0]), "#ff008000");
	assert.equal(bytesToHex(new Uint8ClampedArray([1, 2, 3, 4])), "#01020304");
});

test("hexToBytes reads 3, 4, 6 and 8 digit forms and rejects everything else", () => {
	const full = bytesToHex([49, 47, 47, 128]);
	assert.deepEqual(hexToBytes(full), [49, 47, 47, 128]);
	assert.deepEqual(hexToBytes(full.slice(0, 7)), [49, 47, 47, 255]);
	const nibbles = [3, 2, 1, 8].map(n => n.toString(16));
	assert.deepEqual(hexToBytes(`#${nibbles.slice(0, 3).join("")}`), [0x33, 0x22, 0x11, 255]);
	assert.deepEqual(hexToBytes(`#${nibbles.join("")}`), [0x33, 0x22, 0x11, 0x88]);
	for (const bad of ["", "312f2f", `${full}0`, "var(--ink)", null, undefined]) assert.equal(hexToBytes(bad), null, String(bad));
});

test("alpha sets the alpha byte and mix blends sRGB bytes", () => {
	const ink = bytesToHex([49, 47, 47, 255]);
	assert.equal(alpha(ink, 0.5), "#312f2f80");
	assert.equal(alpha(ink, 2), "#312f2fff");
	assert.equal(alpha(ink, -1), "#312f2f00");
	assert.equal(alpha(ink.slice(0, 7), 0), "#312f2f00", "6-digit input");
	assert.equal(alpha("var(--ink)", 0.5), `${TOKENS.light.ink}80`, "custom properties resolve through the browser probe");
	assert.equal(alpha("not a colour", 0.5), null);
	const black = bytesToHex([0, 0, 0, 255]);
	const white = bytesToHex([255, 255, 255, 255]);
	assert.equal(mix(black, white, 0.5), "#808080ff");
	assert.equal(mix(black, white, 0), "#000000ff");
	assert.equal(mix(black, white, 7), "#ffffffff", "t is clamped");
	assert.equal(mix(black, "nope", 0.5), null);
});

test("readTokens exposes grayscale and focal tokens only, as 8-digit hex, in both themes", () => {
	const light = readTokens();
	assert.ok(Object.isFrozen(light));
	assert.deepEqual(Object.keys(light), [...Object.keys(LAB_TOKEN_VARS), ...Object.keys(LAB_FONT_VARS)]);
	for (const status of ["success", "warning", "danger", "info"]) {
		assert.equal(status in light, false, `${status} must not reach canvas code`);
		assert.equal(Object.values(LAB_TOKEN_VARS).some(name => name.includes(status)), false);
	}
	for (const key of Object.keys(LAB_TOKEN_VARS)) {
		assert.match(String(light[key]), /^#[0-9a-f]{8}$/, key);
		assert.ok(chroma(light[key]) <= 12, `${key} is near-gray (chroma ${chroma(light[key])})`);
	}
	assert.equal(light.ink, hex8("light", "ink"));
	assert.equal(light.focal, hex8("light", "focal"));
	assert.match(light.mono, /Geist Mono/);
	assert.match(light.sans, /Geist/);
	document.documentElement.setAttribute("data-theme", "dark");
	const dark = readTokens();
	for (const key of Object.keys(LAB_TOKEN_VARS)) assert.ok(chroma(dark[key]) <= 12, `dark ${key} is near-gray`);
	assert.equal(dark.ink, hex8("dark", "ink"));
	assert.equal(dark.focal, hex8("dark", "focal"));
	assert.notEqual(dark.paper, light.paper);
	document.head.innerHTML = "";
	const bare = readTokens();
	assert.equal(bare.ink, null, "unset tokens read as null");
	assert.equal(bare.mono, "monospace", "fonts fall back to generic families");
});

test("resolveColor uses one hidden, generated probe outside <body>", () => {
	const before = document.body.innerHTML;
	assert.equal(resolveColor("var(--ill-line)"), hex8("light", "illLine"));
	assert.equal(resolveColor("var(--ill-line)"), hex8("light", "illLine"), "cached");
	assert.equal(resolveColor(bytesToHex([1, 2, 3, 4])), "#01020304", "hex needs no probe");
	assert.equal(resolveColor("definitely-not-a-colour"), null);
	assert.equal(resolveColor(""), null);
	assert.equal(resolveColor(undefined), null);
	const probes = document.querySelectorAll("[data-vpk-color-probe]");
	assert.equal(probes.length, 1);
	assert.equal(probes[0].parentElement.tagName, "HEAD");
	assert.equal(probes[0].hasAttribute("data-vpk-generated"), true);
	assert.equal(probes[0].getAttribute("aria-hidden"), "true");
	assert.equal(probes[0].hidden, true);
	assert.equal(document.body.innerHTML, before, "body is never written");
	resetColorCache();
	document.documentElement.setAttribute("data-theme", "dark");
	assert.equal(resolveColor("var(--ill-line)"), hex8("dark", "illLine"), "a new epoch re-resolves for the new theme");
	assert.equal(document.querySelectorAll("[data-vpk-color-probe]").length, 1, "the probe is reused, never duplicated");
});

test("swatches() returns product colour only inside a declared external-asset svg", () => {
	const blue = bytesToHex([24, 104, 219, 255]);
	const reason = "x".repeat(SWATCH_REASON_MIN);
	document.body.innerHTML = `<main><svg data-vpk-external-asset aria-hidden="true"><rect data-vpk-swatch fill="${blue}"/></svg></main>`;
	assert.deepEqual(swatches(), [], "no data-vpk-lab-swatches");
	document.body.innerHTML = `<main><svg data-vpk-external-asset data-vpk-lab-swatches="too short" aria-hidden="true"><rect data-vpk-swatch fill="${blue}"/></svg></main>`;
	assert.deepEqual(swatches(), [], "reason shorter than the minimum");
	document.body.innerHTML = `<main><svg data-vpk-lab-swatches="${reason}" aria-hidden="true"><rect data-vpk-swatch fill="${blue}"/></svg></main>`;
	assert.deepEqual(swatches(), [], "not an external asset");
	document.body.innerHTML = `<main><svg data-vpk-external-asset data-vpk-lab-swatches="Product palette for the Rovo confetti" aria-hidden="true"><rect data-vpk-swatch fill="${blue}"/><rect data-vpk-swatch fill="${bytesToHex([255, 128, 0, 255])}"/><rect data-vpk-swatch/></svg><i data-vpk-swatch fill="${blue}"></i></main>`;
	assert.deepEqual(swatches(), [blue, "#ff8000ff"]);
	assert.deepEqual(swatches("rect[data-vpk-swatch]:first-child"), [blue], "custom selector");
});

test("onTheme coalesces theme changes to one call per frame with fresh tokens, and writes nothing", async () => {
	readTokens();
	const html = document.documentElement;
	const bodyBefore = document.body.innerHTML;
	const headCount = document.head.children.length;
	const calls = [];
	const stop = onTheme(tokens => calls.push(tokens.ink));
	html.setAttribute("data-theme", "dark");
	html.setAttribute("data-vpk-theme-choice", "dark");
	await wait(80);
	assert.deepEqual(calls, [hex8("dark", "ink")], "two attribute changes in one frame, one call");
	html.style.setProperty("--unrelated-token", "1");
	await wait(80);
	assert.equal(calls.length, 1, "a style change that leaves the tokens alone calls nobody");
	html.style.setProperty("--ink", bytesToHex([10, 10, 10, 255]));
	await wait(80);
	assert.deepEqual(calls, [hex8("dark", "ink"), "#0a0a0aff"], "inline token overrides on <html> count as a theme change");
	html.setAttribute("data-theme", "light");
	html.removeAttribute("style");
	stop();
	await wait(80);
	assert.equal(calls.length, 2, "no calls after unsubscribing");
	assert.equal(document.body.innerHTML, bodyBefore);
	assert.equal(document.head.children.length, headCount, "no nodes added after the probe");
});

test("a throwing theme listener does not starve the others", async () => {
	const seen = [];
	const errors = [];
	// The page reports the listener's error as a window "error" event, as a browser does for microtasks.
	const onError = event => {
		errors.push(event.error?.message ?? event.message);
		event.preventDefault();
	};
	window.addEventListener("error", onError);
	const consoleError = console.error;
	console.error = () => {};
	const stopA = onTheme(() => {
		throw new Error("listener boom");
	});
	const stopB = onTheme(tokens => seen.push(tokens.ink));
	document.documentElement.setAttribute("data-theme", "dark");
	await wait(80);
	console.error = consoleError;
	window.removeEventListener("error", onError);
	stopA();
	stopB();
	assert.deepEqual(seen, [hex8("dark", "ink")]);
	assert.deepEqual(errors, ["listener boom"]);
});

// ---------- The lab block inlines core.mjs and color.mjs: the text must pass check-html and the block rules ----------

const RUNTIME = ["core", "color"].map(name => ({ name, source: fs.readFileSync(path.join(here, "runtime", `${name}.mjs`), "utf8") }));

function bundle(modules) {
	return modules.map(({ name, source }) => source.split("\n").map(line => {
		if (/^import \{[^}]*\} from "\.\/[\w-]+\.mjs";$/.test(line)) return "";
		if (/^\s*import\b/.test(line)) throw new Error(`${name}.mjs: unsupported import form: ${line}`);
		return line.replace(/^export (?=(?:async )?function|const|let|class)/, "");
	}).join("\n")).join("\n");
}

const BLOCK_RULES = [
	[/#[0-9a-f]/i, "# followed by a hex digit"],
	[/\b(?:rgb|rgba|hsl|hsla)\(/i, "colour function"],
	[/<(?:button|svg|input|img|script)|<\/script/i, "tag-like text"],
	[/<!--|-->/, "comment marker"],
	[/(^|[^-])ease-in(?!-)/i, "bare ease-in"],
	[/\{\{/, "double brace"],
	[/var\(--ds-/, "ADS token reference"],
	[/\.repeat\(/, ".repeat("],
	[/"#"|'#'/, "hash string literal"],
	[/\$[&`'$]/, "replacement pattern"],
];

test("core + color bundle text passes check-html and the lab block rules", () => {
	const body = bundle(RUNTIME);
	for (const [pattern, rule] of BLOCK_RULES) assert.equal(pattern.test(body), false, `${rule}: ${body.match(pattern)?.[0]}`);
	assert.equal(body.split("`#${").length - 1, 1, "exactly one hex template (bytesToHex)");
	assert.equal(/^\s*(?:import|export)\b/m.test(body), false, "no import or export survives");
	const names = [...body.matchAll(/^(?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)].map(match => match[1]);
	assert.deepEqual(names.filter((name, index) => names.indexOf(name) !== index), [], "top-level names are unique across modules");
	const script = `(() => {\n"use strict";\n${body}\n})();`;
	assert.doesNotThrow(() => new Function(script), "the block parses as a classic script");
	const template = fs.readFileSync(path.join(SKILL, "assets", "templates", "feature-essay.html"), "utf8");
	const index = template.lastIndexOf("</body>");
	const html = `${template.slice(0, index)}<script data-vpk-lab-runtime>\n${script}\n</script>\n${template.slice(index)}`;
	const result = validateHtmlString(html, "feature-essay+lab-runtime");
	assert.deepEqual(result.failures, []);
	assert.equal(result.ok, true);
});

test("bundled core + color share one scope and work in a page", () => {
	const api = new Function(`"use strict";\n${bundle(RUNTIME)}\nreturn { alpha, mix, readTokens, clamp, EASE };`)();
	assert.equal(api.alpha(bytesToHex([49, 47, 47, 255]), 0.5), "#312f2f80");
	assert.equal(api.readTokens().ink, hex8("light", "ink"));
	assert.equal(api.EASE.in(1), 1);
});
