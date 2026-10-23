#!/usr/bin/env node
/*
 * port-kami — re-skins kami's editorial sources into vpk-html's Algebrica
 * identity (Geist text + Geist Mono numerals/code). Consolidates the former port-templates.mjs, port-diagrams.mjs,
 * and port-demos.mjs into one CLI; layout, @page rules, SVG geometry, and
 * {{placeholders}} are preserved verbatim — only chrome (fonts, colors,
 * @font-face/theme blocks) changes, plus mode-specific identity overrides.
 *
 * Source: https://github.com/tw93/Kami (MIT)
 *
 * The committed templates and diagrams were edited after the original port, so a re-port is a
 * comparison tool: write to a scratch folder with --out and diff it. --in-place overwrites
 * committed assets and must be chosen explicitly.
 *
 * Usage:
 *   node scripts/port-kami.mjs --source <kami-checkout> --out <dir> [--templates] [--diagrams] [--demos]
 *   node scripts/port-kami.mjs --source <kami-checkout> --in-place [--templates] [--diagrams] [--demos]
 * Source resolution: --source, then $VPK_HTML_KAMI_SOURCE, then ~/.agents/skills/kami. Each mode
 * uses the first layout whose directory exists: repo (skills/kami/assets/…, site/assets/demos),
 * plugin (plugins/kami/skills/kami/assets/…), or an installed skill (assets/…). With no mode
 * flag, all three modes run. The source is checked before anything is written.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
	addLabeledMainLandmark,
	addMainLandmark,
	buildFontFaceBlock,
	ensureFaviconLinks,
	FONT_STACKS,
	readStylesCss,
	stripSelfReferentialCustomProperties,
	wrapSharedCss,
} from "./shared.mjs";
import { rewriteKamiColors } from "./kami-color-map.mjs";
import { isDeck, retrofitDeck, retrofitDocumentNav } from "./presentation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");

export const KAMI_SOURCE_ENV = "VPK_HTML_KAMI_SOURCE";
export const KAMI_LAYOUTS = [
	{ name: "repo", templates: "skills/kami/assets/templates", diagrams: "skills/kami/assets/diagrams", demos: "site/assets/demos" },
	{ name: "plugin", templates: "plugins/kami/skills/kami/assets/templates", diagrams: "plugins/kami/skills/kami/assets/diagrams", demos: "site/assets/demos" },
	{ name: "skill", templates: "assets/templates", diagrams: "assets/diagrams", demos: "assets/demos" },
];
const MODE_FLAGS = { "--templates": "templates", "--diagrams": "diagrams", "--demos": "demos" };
const ALL_MODES = ["templates", "diagrams", "demos"];

function isDirectory(target) {
	try {
		return fs.statSync(target).isDirectory();
	} catch {
		return false;
	}
}

function expandHome(target, home) {
	return target === "~" || target.startsWith("~/") ? path.join(home, target.slice(1)) : target;
}

export function parsePortKamiArgs(argv) {
	const result = { modes: [], source: undefined, out: undefined, inPlace: false, errors: [] };
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (arg in MODE_FLAGS) {
			if (!result.modes.includes(MODE_FLAGS[arg])) result.modes.push(MODE_FLAGS[arg]);
		} else if (arg === "--source" || arg === "--out") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) result.errors.push(`${arg} requires a path`);
			else result[arg.slice(2)] = value;
			index += 1;
		} else if (arg === "--in-place") {
			result.inPlace = true;
		} else {
			result.errors.push(`Unknown argument: ${arg}`);
		}
	}
	if (result.out && result.inPlace) result.errors.push("pass exactly one of --out <dir> or --in-place, not both");
	else if (!result.out && !result.inPlace) result.errors.push("pass exactly one of --out <dir> (recommended) or --in-place");
	if (result.modes.length === 0) result.modes = [...ALL_MODES];
	return result;
}

function layoutDirs(root) {
	const dirs = { templates: null, diagrams: null, demos: null };
	const layouts = { templates: null, diagrams: null, demos: null };
	for (const mode of ALL_MODES) {
		const layout = KAMI_LAYOUTS.find(candidate => isDirectory(path.join(root, candidate[mode])));
		if (layout) {
			dirs[mode] = path.join(root, layout[mode]);
			layouts[mode] = layout.name;
		}
	}
	return { dirs, layouts };
}

// → { root, tried, dirs: { templates, diagrams, demos }, layouts, error? }. An explicit --source never falls through.
export function resolveKamiSource({ source, env = process.env, home = os.homedir() } = {}) {
	const candidates = source ? [source] : [env?.[KAMI_SOURCE_ENV], path.join(home, ".agents/skills/kami")].filter(Boolean);
	const tried = candidates.map(candidate => path.resolve(expandHome(candidate, home)));
	const root = tried.find(isDirectory) ?? null;
	if (!root) {
		const error = source ? `--source ${tried[0]} does not exist` : "no Kami checkout found";
		return { root: null, tried, dirs: { templates: null, diagrams: null, demos: null }, layouts: { templates: null, diagrams: null, demos: null }, error };
	}
	return { root, tried, ...layoutDirs(root) };
}

function describeRoot(root) {
	if (!isDirectory(root)) return [`  ${root} (missing)`];
	return KAMI_LAYOUTS.map(layout => {
		const marks = ALL_MODES.map(mode => `${layout[mode]} ${isDirectory(path.join(root, layout[mode])) ? "✓" : "✗"}`);
		return `  ${root} (${layout.name} layout: ${marks.join(", ")})`;
	});
}

function preflightMessage(resolved, missingModes) {
	return [
		`port-kami: Kami source not found for ${missingModes.map(mode => `--${mode}`).join(", ")}.`,
		"Looked in:",
		...resolved.tried.flatMap(describeRoot),
		"Clone the upstream (MIT) and pass it explicitly:",
		"  git clone --depth 1 https://github.com/tw93/Kami ~/src/Kami",
		"  node .agents/skills/vpk-html/scripts/port-kami.mjs --source ~/src/Kami --out \"$TMPDIR/kami-port\"",
		"Committed vpk-html templates and diagrams were edited after the original port; diff the --out folder before using --in-place.",
	].join("\n");
}

/* ============================ shared plumbing ============================ */

// Strip every kami @font-face block and inject vpk-html's font-face + theme
// block once, just before :root (or right after <style>). Identical across the
// former template and demo porters.
function rewriteFontFaceBlocks(text, fontFaceBlock, themeBlock) {
	let out = text;
	out = out.replace(/@font-face\s*\{[\s\S]*?\}\s*/g, "");
	const injected = `${fontFaceBlock}\n\n${themeBlock}`;
	if (/:root\s*\{/.test(out)) {
		out = out.replace(/(:root\s*\{)/, `${injected}\n\n  $1`);
	} else if (/<style>/.test(out)) {
		out = out.replace(/<style>/, `<style>\n${injected}\n`);
	}
	return out;
}

/* ============================ templates mode ============================ */

const TEMPLATES = [
	{ source: "one-pager-en.html", slug: "one-pager" },
	{ source: "long-doc-en.html", slug: "long-doc" },
	{ source: "letter-en.html", slug: "letter" },
	{ source: "portfolio-en.html", slug: "portfolio" },
	{ source: "resume-en.html", slug: "resume" },
	{ source: "slides-weasy-en.html", slug: "slides" },
	{ source: "equity-report-en.html", slug: "equity-report" },
	{ source: "changelog-en.html", slug: "changelog" },
];

const VPK_OVERRIDES = `

  /* ===== vpk-html Algebrica editorial identity overrides ===== */

  html, body { background: var(--paper-background) !important; }

  /* Strip section chrome unless a component opts into raised-surface treatment. */
  .frame, .page, section, .card, .metric, .metric-card,
  .header, .hero, .cover, .doc-cover,
  .quote, .pull-quote, .callout, .verdict, .tag, .pill {
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  /* Preserve a single hairline border ONLY on tables (they need column rules). */
  table, th, td {
    border-color: var(--rule) !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  /* Hairline rule between sections — flat 1px, no inset, no shadow. */
  hr, .rule, .section-rule {
    background: var(--rule) !important;
    border: 0 !important;
    height: 1px !important;
  }

  body, p, li, dd, dt, blockquote, td, th, .body, .lead, .prose {
    font-family: "Geist Mono Numeric", var(--font-body) !important;
    font-size: 17px !important;
    line-height: 1.6 !important;
    color: var(--ink) !important;
  }
  h1, h2, h3, h4, h5, h6,
  .cover-title, .doc-title, .resume-name, .deck-cover .title,
  .hero h1, .title-block h1, .equity-header .ticker, .letter-subject,
  .section-title {
    font-family: var(--font-display) !important;
    font-size: 16px !important;
    line-height: 1.6 !important;
    font-weight: 500 !important;
    letter-spacing: 0 !important;
    color: var(--ink) !important;
    margin: 0 !important;
  }

  /* Masthead role: cover-title / first h1 carries the editorial title role. */
  .cover h1:first-child, .cover-title:first-child,
  .hero h1:first-child, .doc-title h1:first-child,
  .resume-name {
    font-family: var(--font-display) !important;
    color: var(--headline) !important;
    font-weight: 500 !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
  }

  /* Margin labels / eyebrows / figure tags: Geist Mono, 10-13px, quiet grayscale chrome. */
  .eyebrow, .label, .meta-mono, .kicker,
  .figure-tag, .margin-label, .fig-num, .stage-name {
    font-family: var(--font-body) !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    letter-spacing: 0 !important;
    text-transform: none !important;
    color: var(--muted-text) !important;
    font-weight: 400 !important;
  }

  /* Secondary metadata / captions: 14px, ink-muted. */
  .caption, .meta, .footnote, .annotation, .subtitle, .cover-sub, .cover-meta,
  .doc-meta, .release-meta, .stage-detail, .stage-meta {
    font-family: "Geist Mono Numeric", var(--font-body) !important;
    font-size: 14px !important;
    line-height: 22px !important;
    color: var(--muted-text) !important;
  }

  /* Links: ink by default, grayscale on interaction. */
  a, a:visited {
    color: var(--link) !important;
    text-decoration-line: underline !important;
    text-decoration-color: transparent !important;
    text-decoration-thickness: 1px !important;
    text-underline-offset: 4px !important;
    transition: color 180ms var(--ease-out), text-decoration-color 180ms var(--ease-out) !important;
  }
  a:hover {
    color: var(--ink) !important;
    text-decoration-color: currentColor !important;
  }
  a:focus-visible {
    border-radius: 2px !important;
    box-shadow: 0 0 0 2px var(--focus-ring) !important;
    outline: 0 !important;
    text-decoration-color: currentColor !important;
  }

  /* Emphasis: italic preferred; bold reserved for headings. */
  .hl, mark, strong { color: var(--ink) !important; background: var(--accent-soft) !important; font-weight: 500 !important; }
  em, i { font-style: italic !important; color: var(--ink) !important; }

  /* Dotted rule utility. */
  .dotted-rule, .vpk-dotted-rule {
    background-image: radial-gradient(circle, var(--ink) 1px, transparent 1px) !important;
    background-size: 8px 8px !important;
    background-repeat: repeat-x !important;
    background-position: 0 50% !important;
    background-color: transparent !important;
    border: 0 !important;
    height: 8px !important;
    margin: 32px 0 !important;
  }

  /* Drop cap on the first paragraph after a section break. */
  section > p:first-child::first-letter,
  .lead::first-letter,
  .cover + p::first-letter {
    font-family: var(--font-display) !important;
    color: var(--ink) !important;
    float: left !important;
    font-size: 36px !important;
    line-height: 1 !important;
    padding-right: 8px !important;
    padding-top: 4px !important;
    font-weight: 500 !important;
  }
`;

function rewriteFontStacksTemplates(text) {
	let out = text;
	out = out.replace(
		/Charter,\s*Georgia,\s*\n?\s*Palatino,\s*"Times New Roman",\s*serif/g,
		FONT_STACKS.sans,
	);
	out = out.replace(/Charter,\s*Georgia,\s*Palatino,\s*serif/g, FONT_STACKS.sans);
	out = out.replace(/Charter,\s*Georgia,\s*Palatino,\s*"Songti SC",\s*serif/g, FONT_STACKS.sans);
	out = out.replace(
		/"TsangerJinKai02"[^;]*serif/g,
		FONT_STACKS.body,
	);
	out = out.replace(/JetBrainsMono\.woff2/g, "GeistMono[wght].woff2");
	out = out.replace(/"JetBrains Mono",\s*"SF Mono",\s*Consolas,\s*monospace/g, FONT_STACKS.mono);
	out = out.replace(/"JetBrains Mono",\s*"SF Mono",\s*"Fira Code"[^;]*/g, FONT_STACKS.mono);
	return out;
}

function rewriteTemplateHeader(text, slug) {
	const friendly = slug.replace(/-/g, " ");
	const headerComment = `<!-- ==================================================================
     TEMPLATE · ${friendly} (vpk-html · Algebrica editorial identity)
     Ported from kami's editorial template library, restyled with the
     vpk-html semantic aliases: paper (var(--paper)), ink
     (var(--ink)), grayscale ink chrome (var(--accent)),
     status accents, and muted text (var(--muted-text)).
     Geist mastheads/body, Geist Mono numerals and labels.
     No section borders. No shadows. No grid. No rounded corners.
     Layout and double-curly placeholders preserved verbatim from kami.
     Source: https://github.com/tw93/Kami (MIT)
     Design language: Algebrica editorial grayscale
     ================================================================== -->`;
	let out = text;
	out = out.replace(/<!--[\s\S]*?-->\n?/, `${headerComment}\n`);
	if (/<meta\s+name="generator"/i.test(out)) {
		out = out.replace(/<meta\s+name="generator"\s+content="[^"]*"\s*\/?>/i, `<meta name="generator" content="vpk-html">`);
	} else {
		out = out.replace(/<meta\s+charset="[^"]*"\s*\/?>/i, match => `${match}\n<meta name="generator" content="vpk-html">`);
	}
	return out;
}

function transformTemplate(rawHtml, slug, fontFaceBlock, themeBlock) {
	let out = rawHtml;
	out = rewriteFontStacksTemplates(out);
	out = rewriteKamiColors(out);
	out = rewriteFontFaceBlocks(out, fontFaceBlock, themeBlock);
	out = stripSelfReferentialCustomProperties(out);
	out = rewriteTemplateHeader(out, slug);
	out = ensureFaviconLinks(out);
	out = out.replace(/<\/style>/, `${VPK_OVERRIDES}</style>`);
	out = addMainLandmark(out);
	out = isDeck(out) ? retrofitDeck(out, { speakerNotePlaceholders: slug === "slides" }) : retrofitDocumentNav(out);
	return out;
}

function portTemplates({ sourceDir, targetDir }) {
	fs.mkdirSync(targetDir, { recursive: true });
	const fontFaceBlock = buildFontFaceBlock();
	const themeBlock = wrapSharedCss(readStylesCss());
	let missing = [];
	for (const { source, slug } of TEMPLATES) {
		const sourcePath = path.join(sourceDir, source);
		const targetPath = path.join(targetDir, `${slug}.html`);
		if (!fs.existsSync(sourcePath)) {
			missing.push(source);
			console.warn(`skip ${slug} — ${source} not found in kami source`);
			continue;
		}
		const raw = fs.readFileSync(sourcePath, "utf8");
		fs.writeFileSync(targetPath, transformTemplate(raw, slug, fontFaceBlock, themeBlock), "utf8");
		console.log(`✓ template ${slug} (from ${source})`);
	}
	console.log(`Ported ${TEMPLATES.length - missing.length}/${TEMPLATES.length} templates → ${path.relative(process.cwd(), targetDir)}`);
	return { missing };
}

/* ============================ diagrams mode ============================ */

const DIAGRAM_FONT_REPLACEMENTS = [
	{ pattern: /Charter,\s*Georgia,\s*Palatino,\s*serif/g, replacement: FONT_STACKS.sans },
	{
		pattern:
			/'JetBrains Mono',\s*"SF Mono",\s*Consolas,\s*"TsangerJinKai02",\s*"Source Han Serif SC",\s*"Noto Serif CJK SC",\s*"Songti SC",\s*monospace/g,
		replacement: FONT_STACKS.mono,
	},
	{ pattern: /'JetBrains Mono',\s*monospace/g, replacement: "'Geist Mono', monospace" },
];

function buildDiagramHead() {
	return `<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

${wrapSharedCss(readStylesCss())}

  :root {
    --font-sans: ${FONT_STACKS.body};
    --font-mono: ${FONT_STACKS.mono};
    --font-display: ${FONT_STACKS.display};
  }

${buildFontFaceBlock()}

  body {
    background: var(--paper-background);
    color: var(--ink);
    font-family: "Geist Mono Numeric", var(--font-sans);
    font-size: 17px;
    line-height: 1.6;
    min-height: 100vh;
    padding: clamp(2rem, 4vw, 4rem);
  }

  .frame {
    margin: 0 auto;
    max-width: 1080px;
    padding: 0;
  }

  .eyebrow {
    color: var(--muted-text);
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.4;
    letter-spacing: 0;
    margin-bottom: 12px;
    text-transform: none;
  }

  h1 {
    color: var(--headline);
    font-family: var(--font-display);
    font-size: 16px;
    line-height: 1.8;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    margin-bottom: 24px;
  }

  svg { display: block; min-width: 860px; width: 100%; }

  .caption {
    border-top: 1px solid var(--rule);
    color: var(--muted-text);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 22px;
    margin-top: 24px;
    max-width: 60ch;
    padding-top: 16px;
  }
</style>`;
}

function rewriteDiagramFonts(text) {
	let out = text;
	for (const { pattern, replacement } of DIAGRAM_FONT_REPLACEMENTS) {
		out = out.replace(pattern, replacement);
	}
	return out;
}

function transformDiagram(rawHtml, slug, headBlock) {
	const sourceColored = rewriteKamiColors(rawHtml);
	const sourceFonted = rewriteDiagramFonts(sourceColored);
	const styled = sourceFonted.replace(/<style>[\s\S]*?<\/style>/, headBlock);
	const eyebrowReplaced = styled.replace(
		/<p class="eyebrow">[^<]*<\/p>/,
		`<p class="eyebrow">${slug.replace(/-/g, " ")} · vpk-html diagram</p>`,
	);
	const titleReplaced = eyebrowReplaced.replace(
		/<title>[^<]*<\/title>/,
		`<title>${slug.replace(/-/g, " ")} · vpk-html diagram</title>`,
	);
	const faviconed = ensureFaviconLinks(titleReplaced);
	const headerComment = `<!-- ==================================================================
     DIAGRAM · ${slug.replace(/-/g, " ")} (vpk-html palette)
     SVG primitive ported from kami's diagram library, restyled with the
     vpk-html identity: Geist headline/body, Geist Mono labels,
     token-only grayscale figure palette. Drop the <svg> block into a
     long-doc, portfolio, or design-system payload via section.trustedHtml.
     ================================================================== -->`;
	return faviconed
		.replace(/<body\b(?![^>]*\bdata-vpk-motion=)([^>]*)>/i, `<body$1 data-vpk-motion="document">`)
		.replace(/<!--[\s\S]*?-->\n?/, `${headerComment}\n`);
}

function portDiagrams({ sourceDir, targetDir }) {
	fs.mkdirSync(targetDir, { recursive: true });
	const headBlock = buildDiagramHead();
	const files = fs.readdirSync(sourceDir).filter(name => name.endsWith(".html"));
	for (const file of files) {
		const slug = file.replace(/\.html$/, "");
		const raw = fs.readFileSync(path.join(sourceDir, file), "utf8");
		fs.writeFileSync(path.join(targetDir, file), transformDiagram(raw, slug, headBlock), "utf8");
		console.log(`✓ diagram ${slug}`);
	}
	console.log(`Ported ${files.length} diagrams → ${path.relative(process.cwd(), targetDir)}`);
	return { count: files.length };
}

/* ============================ demos mode ============================ */

const DEMOS = [
	"demo-agent-slides.html",
	"demo-kaku.html",
	"demo-musk-resume.html",
	"demo-tesla.html",
];

const KAKU_HERO_FIGURE = `<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kaku terminal interface diagram with command output and AI recovery panel.">
      <rect x="0.5" y="0.5" width="479" height="319" fill="none" stroke="var(--rule)"/>
      <rect x="40" y="48" width="400" height="224" rx="8" fill="var(--surface-sunken)" stroke="var(--rule-strong)"/>
      <rect x="40" y="48" width="400" height="34" rx="8" fill="var(--ink)"/>
      <circle cx="62" cy="65" r="4" fill="var(--danger)"/>
      <circle cx="78" cy="65" r="4" fill="var(--warning)"/>
      <circle cx="94" cy="65" r="4" fill="var(--success)"/>
      <text x="240" y="69" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="10" fill="var(--inverse-text)">kaku</text>
      <text x="64" y="112" font-family="Geist Mono, ui-monospace, monospace" font-size="12" fill="var(--focal)">$ kaku ai</text>
      <text x="64" y="140" font-family="Geist Mono, ui-monospace, monospace" font-size="11" fill="var(--ink)">assistant.toml loaded</text>
      <text x="64" y="162" font-family="Geist Mono, ui-monospace, monospace" font-size="11" fill="var(--muted-text)">mode: command recovery</text>
      <rect x="246" y="104" width="154" height="82" rx="6" fill="var(--ill-tone1)" stroke="var(--focal)"/>
      <text x="323" y="134" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="11" fill="var(--focal)">AI recovery</text>
      <text x="323" y="156" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="9" fill="var(--muted-text)">explain and patch</text>
      <path d="M64 210h300" fill="none" stroke="var(--rule-strong)" stroke-width="1"/>
      <text x="64" y="236" font-family="Geist Mono, ui-monospace, monospace" font-size="10" fill="var(--muted-text)">Cmd + Shift + E applies the suggested command</text>
    </svg>`;

const KAKU_ACTION_FIGURE = `<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kaku workflow from shell command to assistant suggestion and confirmed action.">
      <rect x="0.5" y="0.5" width="479" height="319" fill="none" stroke="var(--rule)"/>
      <rect x="42" y="96" width="112" height="74" rx="6" fill="var(--surface-sunken)" stroke="var(--rule-strong)"/>
      <rect x="184" y="96" width="112" height="74" rx="6" fill="var(--ill-tone1)" stroke="var(--focal)"/>
      <rect x="326" y="96" width="112" height="74" rx="6" fill="var(--surface-sunken)" stroke="var(--rule-strong)"/>
      <path d="M154 133h30M296 133h30" fill="none" stroke="var(--focal)" stroke-width="2"/>
      <text x="98" y="126" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="12" fill="var(--ink)">shell</text>
      <text x="98" y="146" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="9" fill="var(--muted-text)">failed command</text>
      <text x="240" y="126" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="12" fill="var(--focal)">assistant</text>
      <text x="240" y="146" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="9" fill="var(--muted-text)">safe suggestion</text>
      <text x="382" y="126" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="12" fill="var(--ink)">apply</text>
      <text x="382" y="146" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="9" fill="var(--muted-text)">confirmed action</text>
      <text x="240" y="220" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-size="10" fill="var(--muted-text)">Kaku keeps the loop inside the command session.</text>
    </svg>`;

function rewriteFontStacksDemos(text) {
	let out = text;
	out = out.replace(/Charter,\s*Georgia,?\s*(Palatino,?\s*)?serif/g, FONT_STACKS.sans);
	out = out.replace(/Charter,\s*Georgia,\s*Palatino,\s*"Songti SC",\s*serif/g, FONT_STACKS.sans);
	out = out.replace(
		/"TsangerJinKai02",\s*"Source Han Serif SC",\s*"Noto Serif CJK SC",\s*"Songti SC",\s*"STSong",\s*Georgia,\s*serif/g,
		FONT_STACKS.body,
	);
	out = out.replace(
		/"TsangerJinKai02",\s*"Source Han Serif SC",\s*"Noto Serif CJK SC",\s*"Songti SC",\s*Georgia,\s*serif/g,
		FONT_STACKS.body,
	);
	out = out.replace(
		/"YuMincho",\s*"Yu Mincho",\s*"Hiragino Mincho ProN",\s*"Noto Serif CJK JP",\s*"Source Han Serif JP",\s*"TsangerJinKai02",\s*Georgia,\s*serif/g,
		FONT_STACKS.body,
	);
	out = out.replace(/"JetBrains Mono",\s*"SF Mono",\s*"Fira Code"[^;]*/g, FONT_STACKS.mono);
	out = out.replace(/"JetBrains Mono",\s*"SF Mono",\s*Consolas,\s*monospace/g, FONT_STACKS.mono);
	return out;
}

function rewriteDemoHeader(text, slug) {
	const headerComment = `<!-- ==================================================================
     DEMO · ${slug.replace(/^demo-/, "").replace(/-/g, " ")} (vpk-html palette)
     Ported from kami's curated demos library and restyled with the
     vpk-html identity: Geist display/body type, Geist Mono numbers,
     and Algebrica grayscale figure tokens. Layout, content, and SVG
     geometry are preserved verbatim from kami.
     Source: https://github.com/tw93/Kami
     ================================================================== -->`;
	let out = text;
	out = out.replace(/<!--[\s\S]*?-->\n?/, `${headerComment}\n`);
	out = out.replace(/<meta\s+name="generator"\s+content="[^"]*"\s*\/?>/i, `<meta name="generator" content="vpk-html">`);
	return out;
}

function rewriteDemoBodyAccent(text) {
	const gridOverride = `

  /* vpk-html identity overrides */
  html { background: var(--paper-background); }
  body {
    background: var(--paper-background);
  }
  /* Frame the document with vpk-html chrome when a kami .page or .frame exists */
  .page, .frame {
    border: 1px solid var(--rule-strong) !important;
    box-shadow: none !important;
  }
`;
	return text.replace(/<\/style>/, `${gridOverride}</style>`);
}

// Demo-mode landmark uses the labeled regex two-step variant (see shared.mjs).

function markDecorativeSvgs(html) {
	return html.replace(/<svg\b(?![^>]*\baria-(?:label|hidden|labelledby)=)([^>]*)>/gi, "<svg aria-hidden=\"true\"$1>");
}

function rewriteKakuImageTags(text) {
	const imageTagWithAlt = (altText) => new RegExp(`<${"img"}\\s+src="[^"]+"\\s+alt="${altText}"\\s*/?>`, "g");
	return text
		.replace(/\.contact-screenshot img/g, ".contact-screenshot svg")
		.replace(imageTagWithAlt("Kaku terminal interface"), KAKU_HERO_FIGURE)
		.replace(imageTagWithAlt("Kaku terminal in action"), KAKU_ACTION_FIGURE);
}

function transformDemo(rawHtml, slug, fontFaceBlock, themeBlock) {
	let out = rawHtml;
	out = rewriteFontStacksDemos(out);
	out = rewriteKamiColors(out);
	out = rewriteFontFaceBlocks(out, fontFaceBlock, themeBlock);
	out = rewriteDemoHeader(out, slug);
	out = ensureFaviconLinks(out);
	out = rewriteKakuImageTags(out);
	out = rewriteDemoBodyAccent(out);
	out = addLabeledMainLandmark(out, "vpk-html curated demo");
	out = markDecorativeSvgs(out);
	out = isDeck(out) ? retrofitDeck(out) : retrofitDocumentNav(out);
	return out;
}

function portDemos({ sourceDir, targetDir }) {
	fs.mkdirSync(targetDir, { recursive: true });
	const fontFaceBlock = buildFontFaceBlock();
	const themeBlock = wrapSharedCss(readStylesCss());
	let missing = [];
	for (const file of DEMOS) {
		const slug = file.replace(/\.html$/, "");
		const sourcePath = path.join(sourceDir, file);
		if (!fs.existsSync(sourcePath)) {
			missing.push(file);
			console.warn(`skip ${slug} — not found in kami source`);
			continue;
		}
		const raw = fs.readFileSync(sourcePath, "utf8");
		fs.writeFileSync(path.join(targetDir, file), transformDemo(raw, slug, fontFaceBlock, themeBlock), "utf8");
		console.log(`✓ demo ${slug}`);
	}
	console.log(`Ported ${DEMOS.length - missing.length}/${DEMOS.length} curated demos → ${path.relative(process.cwd(), targetDir)}`);
	return { missing };
}

/* ============================ main ============================ */

const RUNNERS = { templates: portTemplates, diagrams: portDiagrams, demos: portDemos };
const USAGE = "Usage: node .agents/skills/vpk-html/scripts/port-kami.mjs --source <kami-checkout> (--out <dir> | --in-place) [--templates] [--diagrams] [--demos]";

function main() {
	const args = parsePortKamiArgs(process.argv.slice(2));
	if (args.errors.length > 0) {
		for (const error of args.errors) console.error(`port-kami: ${error}`);
		console.error(USAGE);
		process.exitCode = 1;
		return;
	}
	// Preflight: resolve every selected mode before the first log line or write.
	const resolved = resolveKamiSource({ source: args.source });
	const missing = args.modes.filter(mode => !resolved.dirs[mode]);
	if (missing.length > 0) {
		console.error(preflightMessage(resolved, missing));
		process.exitCode = 1;
		return;
	}
	const targetRoot = args.inPlace ? path.join(SKILL_ROOT, "assets") : path.resolve(args.out);
	console.log(`Kami source: ${resolved.root} (${args.modes.map(mode => `${mode}: ${resolved.layouts[mode]} layout`).join(", ")})`);
	console.log("Inlining local Geist fonts as base64 data URIs…");
	for (const mode of args.modes) {
		try {
			RUNNERS[mode]({ sourceDir: resolved.dirs[mode], targetDir: path.join(targetRoot, mode) });
		} catch (error) {
			console.error(error.message);
			process.exitCode = 1;
		}
	}
	if (args.inPlace) console.log("⚠ overwrote committed assets — review git diff, then run build.mjs --refresh-library and --check-evals (upstream may add diagrams)");
}

function isMainModule() {
	try {
		return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === __filename;
	} catch {
		return false;
	}
}

if (isMainModule()) {
	main();
}

export { transformTemplate, transformDiagram, transformDemo };
