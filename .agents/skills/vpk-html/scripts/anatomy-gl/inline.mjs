// anatomy-gl/inline — the anatomy-gl engine's page blocks (figure-engines.md § 11). The anatomy collection's WebGL
// figures (afterburner, tokamak, …) draw their fire, plasma, arcs and water with fragment shaders in the vendored
// anatomy-figures package; no SVG kit can reproduce them, so the page runs the vendored figures themselves:
//   <style data-vpk-anatomy-gl-css> in <head>: the plate around each figure (the iso kit's ruled frame and caption);
//   <!-- vpk-anatomy-gl:start --><script data-vpk-anatomy-gl-runtime>…</script><!-- vpk-anatomy-gl:end --> before
//     </body>: one esbuild bundle of only the figures the page shows, plus the boot below.
// The vendored files (./vendor/dist, MIT, Copyright (c) 2026 Ryan) are bundled as they are. The vpk visual style comes in
// through upstream's own token API: render(host, { theme, tokens }) sets each --anatomy-* property on the figure, and the
// tokens below point them at vpk-html's ramp (plates, hairlines, mono text) and its one orange accent, so a figure follows
// the page's light and dark theme and its lit part is the iso kit's accent. The shaders keep upstream's colours: flame,
// plasma and Cherenkov light are the effect itself. esbuild is pinned by the lockfile, so the block is deterministic.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ACCENT_FACES, ACCENT_TOKENS_CSS } from "../iso/accent.mjs";
import { ANATOMY_GL_FIGURES, anatomyGlFigure } from "./figures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ELEMENTS = path.join(HERE, "vendor/dist/element");

export const ANATOMY_GL_RUNTIME_ID = "anatomy-gl";
export const ANATOMY_GL_START = `<!-- vpk-${ANATOMY_GL_RUNTIME_ID}:start -->`;
export const ANATOMY_GL_END = `<!-- vpk-${ANATOMY_GL_RUNTIME_ID}:end -->`;
export const ANATOMY_GL_NOTICE = "/* vpk anatomy-gl runtime · WebGL figures from anatomy-figures 0.1.0 (MIT, Copyright (c) 2026 Ryan, github.com/wheresryan22/anatomy-figures), vendored unmodified · see scripts/anatomy-gl/NOTICE.md in the vpk-html skill */";

const line = pct => `color-mix(in srgb, var(--ill-line) ${pct}%, var(--paper))`;
// upstream token → vpk token, per theme. Upstream's shade-0…3 run darkest to lightest below the face; the iso kit's sides
// are tone 1 (near) and tone 2 (far) in light, and tone 1 / the sunken surface under a tone-2 top in dark (illustrations.md § 4).
const SHARED = {
	"--anatomy-card": "var(--paper)",
	"--anatomy-paper": "var(--paper)",
	"--anatomy-page": "var(--surface-sunken)",
	"--anatomy-hi": "var(--ill-line)",
	"--anatomy-mid": line(60),
	"--anatomy-lo": line(38),
	"--anatomy-faint": line(20),
	"--anatomy-lit": "var(--ill-accent)",
	"--anatomy-lit-top": ACCENT_FACES.top,
	"--anatomy-lit-shade": ACCENT_FACES.light,
	"--anatomy-text": "var(--ink)",
	"--anatomy-strong": "var(--headline)",
	"--anatomy-muted": "var(--muted-text)",
	"--anatomy-mono": "var(--font-mono)",
};
export const ANATOMY_GL_TOKENS = Object.freeze({
	light: Object.freeze({
		...SHARED,
		"--anatomy-face": "var(--surface-raised)",
		"--anatomy-top": "var(--surface-raised)",
		"--anatomy-shade-0": "var(--ill-tone2)",
		"--anatomy-shade-1": "color-mix(in srgb, var(--ill-tone2) 50%, var(--ill-tone1))",
		"--anatomy-shade-2": "var(--ill-tone1)",
		"--anatomy-shade-3": "color-mix(in srgb, var(--ill-tone1) 50%, var(--surface-raised))",
	}),
	dark: Object.freeze({
		...SHARED,
		"--anatomy-face": "var(--ill-tone1)",
		"--anatomy-top": "var(--ill-tone2)",
		"--anatomy-shade-0": "var(--surface-sunken)",
		"--anatomy-shade-1": "color-mix(in srgb, var(--surface-sunken) 60%, var(--ill-tone1))",
		"--anatomy-shade-2": "color-mix(in srgb, var(--surface-sunken) 30%, var(--ill-tone1))",
		"--anatomy-shade-3": "var(--ill-tone1)",
	}),
});

const escapeText = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = text => escapeText(text).replace(/"/g, "&quot;");

// The plate: the iso kit's frame (a ruled box on the paper) around upstream's own plate, and the house caption below. The
// figure draws its corners (figure number, title, hint, live readout) itself; the frame only drops its outer card edge.
// The reserve is a light-DOM box at the figure's own ratio plus upstream's plate padding: it holds the plate's height until the
// figure first mounts (a shadow root hides light children), so lazily mounting a figure above the reader never moves the page.
const PLATE_CSS = `.vpk-anatomy-gl-plate { display: block !important; margin: 0; text-align: start !important; }
.vpk-anatomy-gl-frame { border: 1px solid var(--rule); background: var(--paper); }
.vpk-anatomy-gl-host { display: block; width: 100%; min-height: 320px; }
.vpk-anatomy-gl-reserve { box-sizing: content-box; padding: 52px 24px; }
@media (max-width: 560px) { .vpk-anatomy-gl-reserve { padding: 48px 12px 70px; } }
.vpk-anatomy-gl-plate > figcaption { max-width: 72ch; text-align: left; }`;
export const anatomyGlStyleTag = () => `<style data-vpk-anatomy-gl-css>\n${ACCENT_TOKENS_CSS}\n${PLATE_CSS}\n</style>`;

// The lit part's outline is hover only (as on an iso part): upstream strokes a lit solid's edge in --anatomy-lit at rest
// (.iso-solid[data-lit] > .iso-edge, (0,3,0)). This sheet, adopted into each figure's shadow root, gives that edge back its own
// tone (data-tone, the line every other part draws) at rest and the accent while the figure is hovered or holds focus. Lit
// lines, wires and pointers (data-tone="lit", no faces) keep the accent at rest: a stroke is all they have to show it.
const LIT_SOLID = ":is(.iso-solid, .ab-plate)[data-lit] > .iso-edge.iso-line";
export const ANATOMY_GL_LIT_CSS = [
	...["hi", "mid", "lo", "faint"].map(tone => `${LIT_SOLID}[data-tone="${tone}"] { stroke: var(--anatomy-${tone}); }`),
	`.iso-plate:is(:hover, :focus-within) ${LIT_SOLID} { stroke: var(--anatomy-lit); }`,
].join("\n");

export function anatomyGlPlate({ slug, indent = "\t\t" }) {
	const figure = anatomyGlFigure(slug);
	if (!figure) throw new Error(`unknown anatomy-gl figure: ${slug}`);
	return [
		`<figure class="vpk-anatomy-gl-plate" id="vpk-anatomy-gl-${slug}" data-vpk-engine="anatomy-gl" data-vpk-figure="an-${slug}" data-vpk-camera="45 30" data-vpk-block data-vpkh-no-lightbox>`,
		`\t<div class="vpk-anatomy-gl-frame" data-vpk-review-ignore><div class="vpk-anatomy-gl-host" data-vpk-anatomy-gl="${slug}" aria-label="${escapeAttr(figure.summary)}"><div class="vpk-anatomy-gl-reserve" style="aspect-ratio: ${figure.ratio}"></div></div></div>`,
		`\t<figcaption data-vpk-review-ignore>${escapeText(figure.caption)}</figcaption>`,
		"</figure>",
	].join(`\n${indent}`);
}

function loadEsbuild() {
	try {
		return createRequire(import.meta.url)("esbuild");
	} catch (error) {
		throw new Error(`the anatomy-gl runtime block needs esbuild (a repo devDependency); run pnpm install first (${error.message})`);
	}
}

// The boot: mount each host on its figure with the page theme's tokens, and remount when the theme flips (scripts/theme.mjs
// writes data-theme on <html>). render() returns a teardown that loses the figure's WebGL contexts, so a remount never leaks one.
// Lifecycle: a figure costs one or two WebGL contexts and a browser keeps about sixteen per renderer process (shared by every
// tab of that process), evicting the oldest past that, and upstream never recovers an evicted context. Mounting all ten at load
// (15 contexts) left a second tab or any other WebGL on the page to blank them for good. So a figure mounts only when it comes
// within MOUNT_MARGIN of the viewport and is torn down (its contexts released) once it is beyond the wider UNMOUNT_MARGIN; the
// gap keeps a figure from flickering at the edge, and a focused figure is never torn down. A figure whose context the browser
// takes anyway is remounted while it is near (a bounded number of times), or fresh the next time it comes near.
export const ANATOMY_GL_MOUNT_MARGIN = "100% 0px";
export const ANATOMY_GL_UNMOUNT_MARGIN = "200% 0px";
export const ANATOMY_GL_MAX_RECOVERIES = 3;
export const ANATOMY_GL_BOOT = `const VPK_TOKENS = ${JSON.stringify(ANATOMY_GL_TOKENS)};
const MOUNT_MARGIN = ${JSON.stringify(ANATOMY_GL_MOUNT_MARGIN)};
const UNMOUNT_MARGIN = ${JSON.stringify(ANATOMY_GL_UNMOUNT_MARGIN)};
const MAX_RECOVERIES = ${ANATOMY_GL_MAX_RECOVERIES};
const LIT_CSS = ${JSON.stringify(ANATOMY_GL_LIT_CSS)};
let litSheet = null;
const adoptLitCss = root => {
	if (!root || !("adoptedStyleSheets" in root) || typeof CSSStyleSheet !== "function") return;
	if (!litSheet) {
		litSheet = new CSSStyleSheet();
		litSheet.replaceSync(LIT_CSS);
	}
	if (!root.adoptedStyleSheets.includes(litSheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, litSheet];
};
const pageTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const figures = new Map();
const mount = host => {
	const figure = figures.get(host);
	figure.stop?.();
	figure.theme = pageTheme();
	figure.lost = false;
	figure.stop = figure.render(host, { theme: figure.theme, tokens: VPK_TOKENS[figure.theme] });
	adoptLitCss(host.shadowRoot);
	host.style.minHeight = "";
	if (!figure.listening && host.shadowRoot) {
		figure.listening = true;
		host.shadowRoot.addEventListener("webglcontextlost", () => {
			if (!figure.stop || figure.lost) return;
			figure.lost = true;
			if (figure.recoveries >= MAX_RECOVERIES) return;
			figure.recoveries++;
			setTimeout(() => figure.lost && figure.near && mount(host), 1000);
		}, true);
		// A figure kept because it held focus is released once focus leaves it, if it is still far.
		host.shadowRoot.addEventListener("focusout", () => setTimeout(() => figure.far && unmount(host)), true);
	}
};
const unmount = host => {
	const figure = figures.get(host);
	if (!figure.stop || host.shadowRoot?.activeElement) return;
	const stop = figure.stop;
	figure.stop = null;
	figure.lost = false;
	// Hold the figure's height while it is empty, so releasing a figure above the viewport never shifts the page.
	host.style.minHeight = host.offsetHeight + "px";
	stop();
};
const onThemeChange = () => {
	const theme = pageTheme();
	for (const [host, figure] of figures) if (figure.stop && figure.theme !== theme) mount(host);
};
const start = () => {
	const near = new IntersectionObserver(entries => {
		for (const entry of entries) {
			const figure = figures.get(entry.target);
			figure.near = entry.isIntersecting;
			if (figure.near && (!figure.stop || figure.lost)) mount(entry.target);
		}
	}, { rootMargin: MOUNT_MARGIN });
	const far = new IntersectionObserver(entries => {
		for (const entry of entries) {
			const figure = figures.get(entry.target);
			figure.far = !entry.isIntersecting;
			if (!figure.far) continue;
			figure.recoveries = 0;
			unmount(entry.target);
		}
	}, { rootMargin: UNMOUNT_MARGIN });
	for (const host of document.querySelectorAll("[data-vpk-anatomy-gl]")) {
		const render = FIGURES[host.dataset.vpkAnatomyGl];
		if (!render) continue;
		figures.set(host, { render, stop: null, theme: null, near: false, far: false, lost: false, listening: false, recoveries: 0 });
		near.observe(host);
		far.observe(host);
	}
	new MutationObserver(onThemeChange).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
};
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once: true }) : start();`;

function entrySource(slugs) {
	const imports = slugs.map((slug, i) => `import { render as r${i} } from ${JSON.stringify(path.join(ELEMENTS, `${slug}.js`))};`);
	const table = slugs.map((slug, i) => `${JSON.stringify(slug)}: r${i}`).join(", ");
	return `${imports.join("\n")}\nconst FIGURES = { ${table} };\n${ANATOMY_GL_BOOT}\n`;
}

export async function anatomyGlBundle(slugs) {
	const unknown = slugs.filter(slug => !anatomyGlFigure(slug));
	if (unknown.length) throw new Error(`unknown anatomy-gl figure(s): ${unknown.join(", ")}`);
	const result = await loadEsbuild().build({
		stdin: { contents: entrySource(slugs), resolveDir: HERE, sourcefile: "anatomy-gl-entry.mjs", loader: "js" },
		bundle: true,
		write: false,
		format: "iife",
		minifyWhitespace: true,
		legalComments: "none",
		charset: "utf8",
		logLevel: "silent",
	});
	return result.outputFiles[0].text.trim();
}

export async function anatomyGlRuntimeScript(slugs) {
	// "</script" inside a string would end the inline block early; escape it the standard way.
	const code = (await anatomyGlBundle(slugs)).replace(/<\/script/gi, "<\\/script");
	return `<script data-vpk-anatomy-gl-runtime>\n${ANATOMY_GL_NOTICE}\n${code}\n</script>`;
}

export const anatomyGlRuntimeBlock = async slugs => `${ANATOMY_GL_START}\n${await anatomyGlRuntimeScript(slugs)}\n${ANATOMY_GL_END}`;

export const ANATOMY_GL_SLUGS = Object.freeze(ANATOMY_GL_FIGURES.map(figure => figure.slug));
export const vendoredElementExists = slug => fs.existsSync(path.join(ELEMENTS, `${slug}.js`));
