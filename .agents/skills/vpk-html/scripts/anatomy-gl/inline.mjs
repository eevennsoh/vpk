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
const PLATE_CSS = `.vpk-anatomy-gl-plate { display: block !important; margin: 0; text-align: start !important; }
.vpk-anatomy-gl-frame { border: 1px solid var(--rule); background: var(--paper); }
.vpk-anatomy-gl-host { display: block; width: 100%; min-height: 320px; }
.vpk-anatomy-gl-plate > figcaption { max-width: 72ch; text-align: left; }`;
export const anatomyGlStyleTag = () => `<style data-vpk-anatomy-gl-css>\n${ACCENT_TOKENS_CSS}\n${PLATE_CSS}\n</style>`;

export function anatomyGlPlate({ slug, indent = "\t\t" }) {
	const figure = anatomyGlFigure(slug);
	if (!figure) throw new Error(`unknown anatomy-gl figure: ${slug}`);
	return [
		`<figure class="vpk-anatomy-gl-plate" id="vpk-anatomy-gl-${slug}" data-vpk-engine="anatomy-gl" data-vpk-figure="an-${slug}" data-vpk-camera="45 30" data-vpk-block data-vpkh-no-lightbox>`,
		`\t<div class="vpk-anatomy-gl-frame" data-vpk-review-ignore><div class="vpk-anatomy-gl-host" data-vpk-anatomy-gl="${slug}" aria-label="${escapeAttr(figure.summary)}"></div></div>`,
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

// The boot: mount every host on its figure with the page theme's tokens, and remount when the theme flips (scripts/theme.mjs
// writes data-theme on <html>). render() returns a teardown that loses the figure's WebGL contexts, so a remount never leaks one.
const BOOT = `const VPK_TOKENS = ${JSON.stringify(ANATOMY_GL_TOKENS)};
const pageTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const mounted = new Map();
const mountAll = () => {
	const theme = pageTheme();
	for (const host of document.querySelectorAll("[data-vpk-anatomy-gl]")) {
		const render = FIGURES[host.dataset.vpkAnatomyGl];
		if (!render) continue;
		const prev = mounted.get(host);
		if (prev && prev.theme === theme) continue;
		prev?.stop?.();
		mounted.set(host, { theme, stop: render(host, { theme, tokens: VPK_TOKENS[theme] }) });
	}
};
const start = () => {
	mountAll();
	new MutationObserver(mountAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
};
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once: true }) : start();`;

function entrySource(slugs) {
	const imports = slugs.map((slug, i) => `import { render as r${i} } from ${JSON.stringify(path.join(ELEMENTS, `${slug}.js`))};`);
	const table = slugs.map((slug, i) => `${JSON.stringify(slug)}: r${i}`).join(", ");
	return `${imports.join("\n")}\nconst FIGURES = { ${table} };\n${BOOT}\n`;
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
