#!/usr/bin/env node
/* build-demos — unified demo builder. Merges the former rescue-demos.mjs (curated
 * vpk-native demos) and build-landing-demos.mjs (landing mock previews) under one
 * dispatch. Logic is verbatim from both; only name collisions were renamed
 * (writeDemo→curatedWriteDemo, addMainLandmark→curatedAddMainLandmark on the
 * curated side) and the local path consts swapped for the shared TEMPLATES/DEMOS.
 *
 *   node scripts/build-demos.mjs            # both flows
 *   node scripts/build-demos.mjs --curated  # curated vpk-native demos
 *   node scripts/build-demos.mjs --landing  # landing mock previews
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { DEMOS, DIAGRAMS, TEMPLATES, ensureFaviconLinks } from "./shared.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===================== landing flow (was build-landing-demos.mjs) ===================== */
const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/g;

const inlineDemoSvg = `<svg viewBox="0 0 620 220" aria-label="Landing demo separation flow" xmlns="http://www.w3.org/2000/svg">
	<rect x="20" y="44" width="160" height="72" rx="6" fill="var(--surface-sunken)" stroke="var(--rule-strong)"/>
	<rect x="230" y="44" width="160" height="72" rx="6" fill="var(--ill-tone1)" stroke="var(--focal)"/>
	<rect x="440" y="44" width="160" height="72" rx="6" fill="var(--surface-sunken)" stroke="var(--rule-strong)"/>
	<path d="M180 80h50M390 80h50" fill="none" stroke="var(--focal)" stroke-width="2"/>
	<text x="100" y="75" fill="var(--ink)" font-family="Geist Mono, monospace" font-size="13" text-anchor="middle">raw sources</text>
	<text x="100" y="95" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" text-anchor="middle">templates and diagrams</text>
	<text x="310" y="75" fill="var(--focal)" font-family="Geist Mono, monospace" font-size="13" text-anchor="middle">mock previews</text>
	<text x="310" y="95" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" text-anchor="middle">filled landing demos</text>
	<text x="520" y="75" fill="var(--ink)" font-family="Geist Mono, monospace" font-size="13" text-anchor="middle">authoring flow</text>
	<text x="520" y="95" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" text-anchor="middle">copy and fill source</text>
</svg>`;

const documentDemos = [
	{
		source: "one-pager",
		target: "demo-one-pager",
		replacements: [
			["{{DOC_TITLE}}", "Landing Demo Separation Brief"],
			["{{AUTHOR}}", "vpk-html Maintainers"],
			["{{DESCRIPTION}}", "Filled one-page mock that previews the vpk-html landing contract without exposing raw template placeholders."],
			["{{KEYWORDS}}", "vpk-html, demo catalog, templates, landing"],
			["{{EYEBROW - e.g. Proposal / Report / Exec Summary}}", "Internal Brief"],
			["{{Document headline - verb-led, fits in two lines, bookish.}}", "Landing demos should be filled, source templates should stay reusable."],
			["{{One-line subtitle or the single sharpest claim.}}", "The catalog is for previewing finished shapes; authoring sources stay in templates and diagrams."],
			["{{YYYY.MM.DD}}", "2026.05.12"],
			["{{VERSION / STATUS}}", "Mock preview"],
			["{{~30-40 words. The one paragraph that sets the whole document's tone. Use <span class=\"hl\">ink emphasis</span> on the sharpest claim or number. Everything below is in service of this.}}", "The landing page now links to <span class=\"hl\">filled mock previews</span> instead of raw placeholder-bearing sources. Authors can still copy templates from the documented source tables when they need a reusable starting point."],
			["{{Key quote / critical note / the single takeaway that must not be missed.}}", "Preview files are demos. Source files are authoring materials. The landing page should never blur those roles."],
			["{{CONFIDENTIALITY - internal / public / draft}}", "LOCAL DEMO"],
			["{{PAGE / CONTACT}}", "1 of 1 - vpk-html"],
			["{{Section one}}", "What changes"],
			["{{Section two}}", "Why it matters"],
		],
		sequences: [
			["{{NUMBER}}", ["44", "39", "5", "0"]],
			["{{LABEL}}", ["landing mock demos", "diagram/chart previews", "document previews", "raw landing links"]],
			["{{One or two sentences expanding the claim.}}", ["Every landing row points at an `assets/demos/demo-*.html` file with representative content already filled in. The reusable source templates remain available through documentation and direct file paths."]],
			["{{One or two sentences.}}", ["This prevents visible `{{...}}` tokens from appearing when a user opens a demo from the catalog. It also keeps diagram primitives cleanly separated from landing previews."]],
			["{{Short bullet: a data point, observation, or judgment.}}", ["Five base document rows now use explicit mock demo files."]],
			["{{Short bullet with <span class=\"hl\">key figure</span>.}}", ["All <span class=\"hl\">39 diagram and chart primitives</span> now have demo counterparts."]],
			["{{Short bullet.}}", [
				"Documentation tables still point at source templates for actual authoring.",
				"The landing regression test fails if a row points back into templates or diagrams.",
				"Intentional literal-brace demos still opt in with the existing data attribute.",
				"Each generated mock is validated through the shared offline HTML checker.",
			]],
			["{{STAGE_TITLE}}", ["Separate", "Preview", "Guard"]],
			["{{One-line explanation.}}", [
				"Move landing navigation away from raw source files.",
				"Add filled mock HTML for every source-shaped landing row.",
				"Assert the contract in a Node test so it does not drift.",
			]],
		],
	},
	{
		source: "long-doc",
		target: "demo-long-doc",
		replacements: [
			["{{DOC_TITLE}}", "Landing Demo Separation Runbook"],
			["{{Document title<br>can span two lines}}", "Landing demo<br>separation runbook"],
			["{{AUTHOR}}", "vpk-html Maintainers"],
			["{{AUTHOR / TEAM}}", "vpk-html Maintainers"],
			["{{DATE}}", "2026.05.12"],
			["{{DESCRIPTION}}", "Long-form mock preview explaining how landing demos stay separate from reusable vpk-html templates and diagrams."],
			["{{KEYWORDS}}", "vpk-html, landing, mock demos, templates, diagrams"],
			["{{EYEBROW - e.g. Technical Report / Annual Review / White Paper}}", "Technical Note"],
			["{{One-line subtitle - what this is and who it's for.}}", "A mock long document for maintainers reviewing the demo catalog contract."],
			["{{Version 1.0}}", "v1.0"],
			["{{YYYY.MM}}", "2026.05"],
			["{{PUBLISHER / ORGANIZATION}}", "Venn Prototype Kit"],
			["{{Problem summary - one sentence that states why this document exists.}}", "Landing rows used to blur finished demos and reusable source files, so catalog clicks could expose authoring placeholders."],
			["{{Solution summary - one sentence that states the recommended move.}}", "Keep the catalog pointed at filled mock previews while templates and diagrams remain documented authoring sources."],
			["{{Two or three sentences opening the whole thesis. Use <span class=\"hl\">ink emphasis</span> to grab attention on the sharpest claim. A reader of only this paragraph should understand what the document argues.}}", "The vpk-html landing page is a catalog of finished shapes, not a shelf of raw authoring sources. Moving every raw link to a <span class=\"hl\">filled mock preview</span> makes the first click representative while preserving the template workflow for real documents."],
			["{{List the three core questions as actual questions - so the reader can decide in ten seconds whether to read on.}}", "Which landing rows exposed raw sources? Where should reusable authoring files continue to live? What test prevents template placeholders from leaking back into the demo path?"],
			["{{Three to five lines describing the status quo. Use <span class=\"hl\">specific figures</span> rather than adjectives.}}", "The catalog now carries five document mock rows and thirty-nine diagram/chart rows. Source files may contain reusable placeholder tokens, but browse-time demo rows should open filled previews."],
			["{{State the problem specifically. Use a callout to emphasize a key observation:}}", "The landing route made the source/template distinction invisible. A user could click a catalog row and see raw curly-brace tokens that were correct for authoring but wrong for a demo."],
			["{{TERM}}", "demo separation"],
			["{{SOURCE / PERSON}}", "vpk-html implementation note"],
			["{{TITLE}}", "Landing Demo Separation"],
			["{{If the reader does one thing, what is it? Specific enough to start Monday morning.}}", "When adding a landing row, link to `assets/demos/demo-*.html`; when documenting the authoring workflow, point to `assets/templates/` or `assets/diagrams/`."],
			["{{Chapter intro - what this chapter is solving, why it matters. One or two sentences.}}", "This pass separates browse-time previews from authoring-time sources. The source files remain reusable; the landing page now opens filled artifacts only."],
			["{{A paragraph with data: <span class=\"hl\">specific numbers or ratios</span>.}}", "The landing set now includes <span class=\"hl\">44 landing-only mocks</span>: five document previews and thirty-nine diagram/chart previews. Existing real demos remain unchanged and continue to validate through `check-html.mjs`."],
			["{{A short quoted line or key observation. Different in tone from the body so the reader gets a breath.}}", "A template with curly braces is healthy. A landing demo with unresolved curly braces is noise."],
			["{{Spread heading - what this figure proves}}", "Landing links now stop at demos"],
			["{{INSERT DIAGRAM SVG}}", inlineDemoSvg],
			["{{One-line caption that names what the reader is looking at.}}", "The landing route now points at filled mock previews while source files stay in the authoring route."],
			["{{Figure description}}", "Flow from raw source files to mock previews and then to the documented authoring workflow."],
			["{{Prose that walks the reader through the diagram. Reference parts of the figure by name, not by location (\"the left half\" rots when the layout changes).}}", "Raw source files contain reusable structure and placeholder syntax. Mock previews fill those shapes with representative content. Documentation keeps the authoring source paths visible for agents that need to copy and fill a template."],
			["{{Chapter intro - a one-line summary of the conclusion, then the recommendations below.}}", "Keep the landing catalog demo-only and keep source tables authoring-only."],
			["{{Describe the methodology. Code or formula examples welcome:}}", "`index.html` is parsed for every `.demo-row` href. The regression test rejects `assets/templates/` and `assets/diagrams/`, verifies each linked file exists, then validates the target with `check-html.mjs`."],
			["{{A quoted passage - user interview, expert perspective, or cited source.}}", "\"The landing page should show mock previews, not the raw template syntax needed by authors.\" - implementation brief"],
			["{{definition}}", "demo separation"],
			["{{DIMENSION_1}}", "Route"],
			["{{DIMENSION_2}}", "Contract"],
			["{{GAP}}", "Future landing rows need the same demo-first path discipline."],
		],
		sequences: [
			["{{Takeaway 1 - a quantified conclusion in one line.}}", ["Forty-four landing mock targets now cover document and diagram/chart previews."]],
			["{{Takeaway 2 - an insight backed by data.}}", ["The landing page can validate every row without allowing source-template links."]],
			["{{Takeaway 3 - a forward-looking judgment.}}", ["The next source file added to vpk-html should receive a demo file before it appears in the catalog."]],
			["{{VAL}}", ["5", "39", "44", "0", "1", "28", "2026.05", "100%"]],
			["{{Chapter intro.}}", [
				"The document rows now map to one-pager, long-doc, letter, slides, and changelog mock files in `assets/demos/`.",
				"The diagram rows now map to mock preview files named `demo-diagram-*.html`.",
				"The docs continue to list raw source paths because the authoring workflow still starts there.",
			]],
			["{{A paragraph.}}", [
				"The landing page is optimized for browsing. It should answer: what does this artifact type feel like when filled?",
				"The template and diagram folders are optimized for authoring. They should preserve placeholder syntax so agents know what to replace.",
				"Those jobs are adjacent but not interchangeable. Mixing them made the demo catalog look unfinished even though the source files were correct.",
				"The new test encodes the split so future edits fail fast when a raw source path re-enters the landing route.",
			]],
			["{{Conclusion 1.}}", ["A catalog row should never expose unresolved source placeholders."]],
			["{{Conclusion 2.}}", ["A template file should stay reusable and placeholder-bearing."]],
			["{{Conclusion 3.}}", ["A diagram primitive should be copied into documents, not treated as its own finished demo."]],
			["{{Concrete, executable recommendations tied to the conclusions.}}", ["Add a `demo-*` file before adding a new landing row. Keep source-route changes in `SKILL.md`, `CHEATSHEET.md`, or `README.md`, not in the landing catalog."]],
			["{{Acknowledgement paragraph.}}", ["This mock is intentionally local and factual: it demonstrates the catalog contract without inventing product metrics or external claims."]],
			["{{Reference 1}}", ["vpk-html SKILL.md route tables"]],
			["{{Reference 2}}", ["landing-links.test.js regression guard"]],
		],
	},
	{
		source: "letter",
		target: "demo-letter",
		replacements: [
			["{{LETTER_SUBJECT}}", "Landing demo separation review"],
			["{{AUTHOR}}", "vpk-html Maintainers"],
			["{{DESCRIPTION}}", "Filled letter mock for the vpk-html landing catalog."],
			["{{KEYWORDS}}", "vpk-html, letter, demo, template separation"],
			["{{SENDER_NAME}}", "Ari Chen"],
			["{{SENDER_ADDRESS / DEPARTMENT / ORGANIZATION}}", "VPK Design Systems"],
			["{{EMAIL}}", "ari@example.local"],
			["{{PHONE}}", "+1 555 0100"],
			["{{DATE, e.g. April 18, 2026}}", "May 12, 2026"],
			["{{RECIPIENT_NAME_OR_TITLE}}", "VPK Maintainers"],
			["{{RECIPIENT_ORG / DEPARTMENT}}", "Document tooling review"],
			["{{One-sentence subject line: what this letter is about.}}", "Request to keep landing demos separate from reusable source templates."],
			["{{Dear {{NAME}},}}", "Dear maintainers,"],
			["{{Paragraph 4 (optional): close. Express anticipation, gratitude, or a courteous sign-off line.}}", "Please treat this as the expected catalog behavior for future vpk-html additions. A new source template should not appear on the landing page until it has a filled mock preview beside it."],
			["{{Closing - \"Best regards,\" / \"Sincerely,\" / \"Warm regards,\"}}", "Best regards,"],
			["{{HANDWRITTEN_NAME_OR_SIGNATURE}}", "Ari Chen"],
			["{{TITLE · DEPARTMENT}}", "Design Systems Engineer"],
			["{{DATE (optional restatement)}}", "May 12, 2026"],
			["{{List - ① Attachment 1 · ② Attachment 2}}", "Attachment 1 - landing-links regression guard; Attachment 2 - filled demo file list."],
		],
		sequences: [
			["{{Paragraph 4 (optional): close. Express anticipation, gratitude, or a courteous sign-off line.}}", ["Please treat this as the expected catalog behavior for future vpk-html additions. A new source template should not appear on the landing page until it has a filled mock preview beside it."]],
		],
	},
	{
		source: "slides",
		target: "demo-slides",
		replacements: [
			["{{Page Title}}", "Landing Demo Separation"],
			["{{Project}}", "vpk-html"],
			["{{Author}}", "VPK Maintainers"],
			["{{Date}}", "2026.05.12"],
			["{{Title}}", "Landing demos use filled mock previews"],
			["{{Subtitle}}", "Reusable templates and diagrams stay in their source folders."],
			["{{Section}}", "Catalog contract"],
			["{{Key takeaway or bottom-line conclusion}}", "Every landing row should open a demo file, not a raw source file."],
			["{{Lead paragraph}}", "The landing catalog is a browse surface. It should show representative filled content while the documented authoring workflow points agents to reusable placeholders."],
			["{{Left heading}}", "Before"],
			["{{Left body}}", "Raw template and diagram files opened directly from the landing page, exposing placeholder syntax."],
			["{{Right heading}}", "After"],
			["{{Right body}}", "Landing rows open filled mock files under `assets/demos/`, while docs still reference raw sources."],
		],
		sequences: [
			["{{Module title}}", ["Document mocks", "Diagram mocks", "Regression guard"]],
			["{{Module body}}", [
				"One-pager, long-doc, letter, slides, and changelog now have filled landing previews.",
				"Thirty-nine inline diagram/chart primitives now have matching `demo-diagram-*` previews.",
				"`landing-links.test.js` rejects raw source folders and validates every linked file.",
			]],
			["{{Dimension}}", ["Document rows", "Diagram rows", "Raw source links"]],
			["{{Value}}", ["5", "39", "0"]],
			["{{Note}}", ["Authoring route tables remain unchanged in the skill documentation.", "Literal brace demos must opt in with `data-vpk-literal-double-braces=\"true\"`.", "Run `check-html.mjs` before publishing new demo files."]],
			["{{Body content}}", ["Source templates still keep their placeholders. That is correct for authoring and wrong for the landing demo path."]],
		],
	},
	{
		source: "changelog",
		target: "demo-changelog",
		replacements: [
			["{{PROJECT_NAME}}", "vpk-html"],
			["{{VERSION}}", "2026.05.12"],
			["{{RELEASE_NAME}}", "Landing Demo Separation"],
			["{{RELEASE_DATE}}", "May 12, 2026"],
			["{{AUTHOR}}", "vpk-html Maintainers"],
			["{{DESCRIPTION}}", "Filled changelog mock for the vpk-html landing demo catalog."],
			["{{KEYWORDS}}", "vpk-html, changelog, demo catalog, templates"],
			["{{PROJECT_URL}}", "file://vpk-html/index.html"],
			["{{One-line project description.}}", "Offline HTML artifact templates for polished local documents and diagrams."],
			["{{One-line release highlight.}}", "Landing rows now open filled mock previews instead of raw placeholder-bearing sources."],
			["{{New feature 1: one-line description.}}", "Added explicit mock demo files for five base document templates."],
			["{{New feature 2: one-line description.}}", "Added mock preview files for all thirty-nine inline diagram and chart primitives."],
			["{{New feature 3: one-line description.}}", "Updated the landing copy and row labels to describe the demo-only path."],
			["{{Fix 1: one-line description.}}", "Removed direct landing links to `assets/templates/`."],
			["{{Fix 2: one-line description.}}", "Removed direct landing links to `assets/diagrams/`."],
			["{{Fix 3: one-line description.}}", "Added a regression test that validates every landing target with `check-html.mjs`."],
			["{{Breaking change description.}}", "None for the authoring workflow. Source templates and diagram primitives remain in place."],
			["{{Thank contributors, e.g. \"Thanks to @user1, @user2 for their contributions.\"}}", "Thanks to the local VPK maintainers for keeping demos and source templates clearly separated."],
		],
	},
];

const diagramDemos = [
	["architecture", "Architecture", {
		"{{System name}}": "Demo Catalog",
	}],
	["flowchart", "Flowchart", {
		"{{Question the flow answers}}": "Should this landing row open a source file?",
		"{{Describe input}}": "New catalog row",
		"{{Decision}}": "Has filled demo?",
		"{{Path taken}}": "Link demo file",
		"{{Alt path}}": "Create mock preview",
	}],
	["swimlane", "Swimlane", {
		"{{System name}}": "Landing Review",
	}],
	["state-machine", "State Machine", {
		"{{Component name}}": "Demo Row",
	}],
	["timeline", "Timeline", {
		"{{Project name}}": "Demo Separation",
	}],
	["tree", "Tree", {
		"{{System name}}": "vpk-html",
		"{{System}}": "Demo catalog",
		"{{Module A}}": "Source files",
		"{{Module B}}": "Landing previews",
		"{{Leaf 1}}": "one-pager",
		"{{Leaf 2}}": "long-doc",
		"{{Leaf 3}}": "letter",
		"{{Leaf 4}}": "slides",
		"{{Leaf 5}}": "diagrams",
	}],
	["layer-stack", "Layer Stack", {
		"{{System name}}": "vpk-html Landing",
	}],
	["quadrant", "Quadrant", {
		"{{X axis}}": "Demo fidelity",
		"{{Y axis}}": "Authoring reuse",
		"{{X axis · low to high}}": "low fidelity -> high fidelity",
		"{{Y axis · low to high}}": "single-use -> reusable",
		"{{Item A}}": "raw template",
		"{{Item B · focal}}": "filled demo",
		"{{Item C}}": "doc table",
		"{{Item D}}": "diagram primitive",
		"{{Item E}}": "landing row",
		"{{Item F}}": "source copy",
		"{{Item G}}": "mock preview",
		"{{Item H}}": "regression test",
	}],
	["venn", "Venn", {
		"{{Topic A}}": "Templates",
		"{{Topic B}}": "Demos",
		"{{Set A only}}": "Reusable placeholders",
		"{{Shared}}": "Shared layout language",
		"{{Set B only}}": "Filled preview content",
	}],
	["bar-chart", "Bar Chart", {
		"{{Chart Title}}": "Landing link targets by type",
		"{{Series A label}}": "Raw links",
		"{{Series B label}}": "Demo links",
		"{{Caption text. The darkest-ink focal series carries the primary argument. State the takeaway here, not a description of what is plotted.}}": "The darkest-ink demo-link series confirms every landing target is now a filled demo file.",
	}],
	["line-chart", "Line Chart", {
		"{{Chart Title}}": "Placeholder leakage over cleanup",
		"{{Line 1 label}}": "Raw-source exposure",
		"{{Line 2 label}}": "Demo coverage",
		"{{Caption text. The darkest-ink line carries the primary trend argument. State what the trend means, not what was plotted.}}": "The darkest-ink coverage line reaches full catalog coverage as raw source exposure drops to zero.",
	}],
	["donut-chart", "Donut Chart", {
		"{{Chart Title}}": "Landing catalog makeup",
		"{{CENTER LABEL}}": "19 mocks",
		"{{Category A}}": "documents",
		"{{Category B}}": "diagrams",
		"{{Category C}}": "reviews",
		"{{Category D}}": "reports",
		"{{Category E}}": "editors",
		"{{Category F}}": "decks",
		"{{Source / period}}": "vpk-html landing mock set",
		"{{Caption text. The darkest-ink segment is the focal category. Lead with the insight, not the breakdown.}}": "The darkest-ink mock segment covers all previously raw landing targets.",
	}],
	["candlestick", "Candlestick", {
		"{{Chart Title}}": "Demo coverage check",
		"{{D1}}": "start",
		"{{D6}}": "docs",
		"{{D11}}": "diagrams",
		"{{D16}}": "guard",
		"{{D20}}": "done",
		"{{Caption: e.g. \"20-day price action showing accumulation phase.\"}}": "Mock OHLC preview showing the landing cleanup moving from raw exposure to guarded demo coverage.",
	}],
	["waterfall", "Waterfall", {
		"{{Chart Title}}": "Raw landing links removed",
		"{{Start}}": "Raw links",
		"{{Cat A}}": "Docs",
		"{{Cat B}}": "Diagrams",
		"{{Cat C}}": "Existing demos",
		"{{Cat D}}": "Tests",
		"{{Cat E}}": "Final",
		"{{End}}": "Demo-only",
		"{{Caption: e.g. \"Revenue bridge from FY2024 to FY2025, showing growth drivers and headwinds.\"}}": "Waterfall preview showing how document and diagram mocks reduce raw landing exposure to zero.",
	}],
	["box-plot", "Box Plot", {}],
	["histogram", "Histogram", {}],
	["ridgeline", "Ridgeline", {}],
	["beeswarm", "Beeswarm", {}],
	["dot-strip", "Dot Strip", {}],
	["slope-chart", "Slope Chart", {}],
	["dumbbell", "Dumbbell", {}],
	["lollipop", "Lollipop", {}],
	["bullet", "Bullet", {}],
	["population-pyramid", "Population Pyramid", {}],
	["annotated-line", "Annotated Line", {}],
	["index-chart", "Index Chart", {}],
	["small-multiples", "Small Multiples", {}],
	["band-chart", "Band Chart", {}],
	["stacked-area", "Stacked Area", {}],
	["calendar-heatmap", "Calendar Heatmap", {}],
	["matrix-heatmap", "Matrix Heatmap", {}],
	["waffle", "Waffle", {}],
	["grid-choropleth", "Grid Choropleth", {}],
	["treemap", "Treemap", {}],
	["sankey", "Sankey", {}],
	["arc-diagram", "Arc Diagram", {}],
	["scatter", "Scatter", {}],
	["connected-scatter", "Connected Scatter", {}],
	["icicle", "Icicle", {}],
];

function readSource(directory, slug) {
	return fs.readFileSync(path.join(directory, `${slug}.html`), "utf8");
}

/** A filled document demo has no placeholders left, so the template's literal-braces opt-out would only switch off
 * check-html's unresolved-placeholder check. Diagram demos keep it (retrofit marks them). */
function dropLiteralOptOut(slug, html) {
	return slug.startsWith("demo-diagram-") || /\{\{/.test(html) ? html : html.replace(' data-vpk-literal-double-braces="true"', "");
}

function writeDemo(slug, html) {
	fs.writeFileSync(path.join(DEMOS, `${slug}.html`), ensureFaviconLinks(dropLiteralOptOut(slug, html)), "utf8");
}

function replaceAll(html, replacements) {
	let out = html;
	for (const [from, to] of replacements) {
		out = out.split(from).join(to);
	}
	return out;
}

function replaceSequential(html, sequences = []) {
	let out = html;
	for (const [needle, values] of sequences) {
		const fallback = values[values.length - 1] ?? "";
		let index = 0;
		while (out.includes(needle)) {
			const value = values[index] ?? fallback;
			out = out.replace(needle, value);
			index += 1;
		}
	}
	return out;
}

function fallbackFor(token) {
	const label = token
		.slice(2, -2)
		.replace(/<[^>]+>/g, "")
		.replace(/["`]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const lower = label.toLowerCase();
	if (/(date|yyyy|month)/.test(lower)) return "2026.05.12";
	if (/(author|team|publisher|organization)/.test(lower)) return "vpk-html Maintainers";
	if (/keyword/.test(lower)) return "vpk-html, demo, mock preview";
	if (/(number|value|\bval\b|\bnn\b)/.test(lower)) return "42";
	if (/(title|headline|subject)/.test(lower)) return "Filled mock preview";
	if (/(caption|description)/.test(lower)) return "Representative mock content for the landing demo preview.";
	if (/reference/.test(lower)) return "Local vpk-html documentation";
	return "Filled mock content for the landing preview.";
}

function fillRemaining(html) {
	let out = html;
	const tokens = [...new Set(out.match(PLACEHOLDER_PATTERN) ?? [])];
	for (const token of tokens) {
		out = out.split(token).join(fallbackFor(token));
	}
	return out;
}

function ensureColorScheme(html) {
	if (/color-scheme:\s*light dark/.test(html)) return html;
	return html.replace(/(:root\s*\{)/, "$1\n\tcolor-scheme: light dark;");
}

function addMainLandmark(html, label) {
	if (/<main\b/i.test(html)) return html;
	return html
		.replace(/<body([^>]*)>/i, `<body$1>\n<main aria-label="${escapeAttribute(label)}">`)
		.replace(/(\s*)(<script\b|<\/body>)/i, `\n</main>$1$2`);
}

function markSvgAccessibility(html, title = null) {
	let first = true;
	return html.replace(/<svg\b(?![^>]*\baria-(?:label|hidden|labelledby)=)([^>]*)>/gi, (_, attrs) => {
		if (first && title) {
			first = false;
			return `<svg aria-label="${escapeAttribute(title)} mock diagram"${attrs}>`;
		}
		return `<svg aria-hidden="true"${attrs}>`;
	});
}

function markHtmlAsDemo(html, source) {
	if (/data-vpk-landing-demo=/.test(html)) return html;
	return html.replace(/<html\b([^>]*)>/i, `<html$1 data-vpk-landing-demo="true" data-vpk-demo-source="${source}">`);
}

function escapeAttribute(value) {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function assertNoPlaceholders(html, slug) {
	const match = /(\{\{|\}\})/.exec(html);
	if (match) {
		const line = html.slice(0, match.index).split("\n").length;
		throw new Error(`${slug} still contains placeholder braces near line ${line}`);
	}
}

function buildDocumentDemo(demo) {
	let html = readSource(TEMPLATES, demo.source);
	html = replaceAll(html, demo.replacements);
	html = replaceSequential(html, demo.sequences);
	html = fillRemaining(html);
	html = ensureColorScheme(html);
	html = addMainLandmark(html, "vpk-html mock preview");
	html = markSvgAccessibility(html);
	html = markHtmlAsDemo(html, `template:${demo.source}`);
	assertNoPlaceholders(html, demo.target);
	writeDemo(demo.target, html);
}

function buildDiagramDemo([source, title, replacementObject]) {
	const replacements = Object.entries(replacementObject);
	let html = readSource(DIAGRAMS, source);
	html = replaceAll(html, replacements);
	html = fillRemaining(html);
	html = ensureColorScheme(html);
	html = addMainLandmark(html, "vpk-html diagram mock preview");
	html = markSvgAccessibility(html, title);
	html = markHtmlAsDemo(html, `diagram:${source}`);
	assertNoPlaceholders(html, `demo-diagram-${source}`);
	writeDemo(`demo-diagram-${source}`, html);
}

function runLanding() {
	fs.mkdirSync(DEMOS, { recursive: true });
	for (const demo of documentDemos) buildDocumentDemo(demo);
	for (const demo of diagramDemos) buildDiagramDemo(demo);
	console.log(`Built ${documentDemos.length + diagramDemos.length} landing demo mocks from ${path.relative(process.cwd(), __dirname)}.`);
}

/* ===================== curated flow (was rescue-demos.mjs) ===================== */
function fill(html, replacements) {
	let out = html;
	for (const [from, to] of replacements) {
		if (!out.includes(from)) {
			console.warn(`  MISS: ${from.slice(0, 60)}…`);
			continue;
		}
		out = out.split(from).join(to);
	}
	return out;
}

function fillSeq(html, needle, values) {
	let out = html;
	for (const v of values) {
		const i = out.indexOf(needle);
		if (i < 0) break;
		out = out.slice(0, i) + v + out.slice(i + needle.length);
	}
	return out;
}

function readTemplate(slug) {
	return fs.readFileSync(path.join(TEMPLATES, `${slug}.html`), "utf8");
}

function curatedAddMainLandmark(html) {
	if (/<main\b/i.test(html)) return html;
	return html
		.replace(/<body([^>]*)>/i, `<body$1>\n<main aria-label="vpk-html demo">`)
		.replace(/(\s*)(<\/body>)/i, `\n</main>$1$2`);
}

function curatedWriteDemo(slug, html) {
	fs.writeFileSync(path.join(DEMOS, `${slug}.html`), ensureFaviconLinks(dropLiteralOptOut(slug, curatedAddMainLandmark(html))), "utf8");
}

/* ============ Q2 status — one-pager ============ */

function q2Status() {
	let h = readTemplate("one-pager");
	h = fill(h, [
		["{{DOC_TITLE}}", "Platform Team · Q2 2026 Status"],
		["{{AUTHOR}}", "Platform Team"],
		["{{DESCRIPTION}}", "Capacity ahead of plan, observability behind. Quarterly engineering review for the Platform team."],
		["{{KEYWORDS}}", "engineering, platform, status report, Q2 2026"],
		["{{EYEBROW - e.g. Proposal / Report / Exec Summary}}", "Quarterly Review · Q2 2026"],
		["{{Document headline - verb-led, fits in two lines, bookish.}}", "Capacity ahead of plan, observability behind."],
		["{{One-line subtitle or the single sharpest claim.}}", "Three of four committed milestones landed on time. Tracing rollout slipped to Q3 after the OTel collector saturated staging."],
		["{{YYYY.MM.DD}}", "2026.07.01"],
		["{{VERSION / STATUS}}", "Quarter close"],
		["{{~30-40 words. The one paragraph that sets the whole document's tone. Use <span class=\"hl\">ink emphasis</span> on the sharpest claim or number. Everything below is in service of this.}}", "API gateway v2 dropped p99 by <span class=\"hl\">35 percent</span> and unlocked $48k/mo of headroom. Distributed tracing slipped one quarter — the OTel collector pattern we chose did not scale past three services in staging."],
		["{{Key quote / critical note / the single takeaway that must not be missed.}}", "Capacity work delivered 28% additional headroom, ahead of the 15% target. Observability work needs a sidecar redesign before Q3 closes."],
		["{{CONFIDENTIALITY - internal / public / draft}}", "INTERNAL · Q2 CLOSE"],
		["{{PAGE / CONTACT}}", "1 of 1 · platform-team@"],
	]);
	h = fillSeq(h, "{{NUMBER}}", ["+28%", "-35%", "$48k", "+1 Q"]);
	h = fillSeq(h, "{{LABEL}}", ["capacity headroom", "p99 latency", "monthly cost saved", "tracing slip"]);
	h = h.replace("{{Section one}}", "What shipped");
	h = h.replace("{{Section two}}", "What slipped");
	h = fillSeq(h, "{{One or two sentences expanding the claim.}}", ["Three milestones landed on time. API gateway v2 went out cleanly, cost reporting caught $90k/yr of orphaned snapshots in month 1, and the failover playbook game-day-tested all 12 tier-0 services."]);
	h = fillSeq(h, "{{One or two sentences.}}", ["Distributed tracing rollout slipped from Q2 to Q3. OTel collector pattern saturated staging at 3 services; sidecar redesign in progress."]);
	h = fillSeq(h, "{{Short bullet: a data point, observation, or judgment.}}", ["API gateway v2: Kong → Rust, p99 480ms → 312ms, memory 2.1GB → 480MB per node."]);
	h = fillSeq(h, "{{Short bullet with <span class=\"hl\">key figure</span>.}}", ["Cost reporting caught <span class=\"hl\">$90k/yr</span> of orphaned RDS snapshots in month 1."]);
	h = fillSeq(h, "{{Short bullet.}}", [
		"Failover playbook tested for all 12 tier-0 services; MTTD 14m → 6m.",
		"OTel collector saturated above 3 services; tail sampling not enough.",
		"Sidecar deploy in progress; targeting 80% tier-0 coverage by end Q3.",
		"Carryover risk: if sidecar redesign slips again, escalate to staff review.",
	]);
	h = fillSeq(h, "{{STAGE_TITLE}}", ["Q2 close", "Sidecar redesign", "Multi-region failover"]);
	h = fillSeq(h, "{{One-line explanation.}}", [
		"Three of four committed milestones landed; tracing carried over.",
		"OTel sidecar deploy to 12 tier-0 services. Target end of Q3.",
		"Active-active us-east-1 + us-west-2 for the API tier. RTO 5 min.",
	]);
	// kami v1.7.4 added an optional, commented-out hero product-shot figure that
	// still carries {{...}} placeholders. This demo uses no screenshot, so drop
	// the whole optional block to keep the offline single-file check clean.
	h = h.replace(/<!-- Optional hero product shot[\s\S]*?-->\n?/, "");
	return h;
}

/* ============ Long-doc common fill helper ============ */

function fillLongDocCommon(h, demo) {
	const reps = [
		["{{One-line subtitle - what this is and who it's for.}}", demo.subtitle],
		["{{Version 1.0}}", demo.version],
		["{{YYYY.MM}}", demo.yearMonth],
		["{{PUBLISHER / ORGANIZATION}}", demo.publisher],
		["{{Problem summary - one sentence that states why this document exists.}}", demo.tldrProblem ?? demo.problem],
		["{{Solution summary - one sentence that states the recommended move.}}", demo.tldrSolution ?? demo.thesis],
		["{{Two or three sentences opening the whole thesis. Use <span class=\"hl\">ink emphasis</span> to grab attention on the sharpest claim. A reader of only this paragraph should understand what the document argues.}}", demo.thesis],
		["{{List the three core questions as actual questions - so the reader can decide in ten seconds whether to read on.}}", demo.questions],
		["{{Three to five lines describing the status quo. Use <span class=\"hl\">specific figures</span> rather than adjectives.}}", demo.statusQuo],
		["{{State the problem specifically. Use a callout to emphasize a key observation:}}", demo.problem],
		["{{TERM}}", demo.term],
		["{{SOURCE / PERSON}}", demo.sourcePerson],
		["{{TITLE}}", demo.title],
	];
	for (const [from, to] of reps) h = h.split(from).join(to);
	h = fillSeq(h, "{{Takeaway 1 - a quantified conclusion in one line.}}", [demo.takeaway1]);
	h = fillSeq(h, "{{Takeaway 2 - an insight backed by data.}}", [demo.takeaway2]);
	h = fillSeq(h, "{{Takeaway 3 - a forward-looking judgment.}}", [demo.takeaway3]);
	h = fillSeq(h, "{{Reference 1}}", [demo.ref1]);
	h = fillSeq(h, "{{Reference 2}}", [demo.ref2]);
	h = fillSeq(h, "{{VAL}}", demo.vals);
	return h;
}

/* ============ Postgres migration — long-doc ============ */

function postgresMigration() {
	let h = readTemplate("long-doc");
	h = fillLongDocCommon(h, {
		subtitle: "Online cutover of a tier-0 Postgres database, for platform engineers",
		version: "v1.0",
		yearMonth: "2026.05",
		publisher: "Platform Engineering",
		thesis: "Aurora pg16 GA in February 2026 enabled <span class=\"hl\">parallel VACUUM</span> and JSON-path indexing improvements we needed on reports-primary. We ran the cutover online via logical replication, with a 7-day rollback window, and observed <span class=\"hl\">zero parity mismatches</span> across 142 tables.",
		questions: "How do you cut over 1.8 TB of analytics data online? What does logical replication NOT capture, and how do you handle the gaps? When is it safe to decommission the old cluster?",
		statusQuo: "reports-primary was pg15.6 carrying <span class=\"hl\">1.8 TB</span> across 142 tables. Analytics workload, p99 query latency 480ms. Aurora pg16 was GA on 2026-02-14 with backwards-compatible client libraries.",
		problem: "pg15 EOL approaches in late 2027. Waiting risks an emergency upgrade; doing it online requires careful phasing to avoid disrupting the analytics workload that drives morning reporting.",
		term: "logical replication",
		sourcePerson: "Database Team retrospective",
		title: "Postgres 15 → 16 Migration",
		takeaway1: "Cutover took 47 minutes of perceived impact; zero parity mismatches across 142 tables.",
		takeaway2: "Logical replication caught up in 4h 22m; lag at flip was 1.4s (under 5s threshold).",
		takeaway3: "Same playbook should ship as a standard runbook for tier-0 pg upgrades.",
		ref1: "PostgreSQL 16 Release Notes — postgresql.org/docs/16/release-16.html",
		ref2: "Aurora pg16 Compatibility Matrix — docs.aws.amazon.com/AmazonRDS",
		vals: ["1.8 TB", "142", "4h 22m", "1.4s", "41s", "0", "7 days", "$2k"],
	});
	const reps = [
		["{{DOC_TITLE}}", "Postgres 15 → 16 Migration on reports-primary"],
		["{{Document title<br>can span two lines}}", "Postgres 15 → 16<br>on reports-primary"],
		["{{AUTHOR}}", "Database Team"],
		["{{AUTHOR / TEAM}}", "Database Team · Platform Eng"],
		["{{DATE}}", "2026.05.11"],
		["{{DESCRIPTION}}", "Online cutover of the reports-primary database from pg15 to pg16 using logical replication; 7-day rollback window."],
		["{{KEYWORDS}}", "postgres, migration, logical replication, database, platform"],
		["{{EYEBROW - e.g. Technical Report / Annual Review / White Paper}}", "Technical Report · Database Platform"],
		["{{If the reader does one thing, what is it? Specific enough to start Monday morning.}}", "When upgrading a tier-0 Postgres database, never combine a client-library upgrade with a server-version upgrade in the same deploy. Bisection cost during incidents is significant."],
		["{{Chapter intro - what this chapter is solving, why it matters. One or two sentences.}}", "The reports-primary database carried 1.8 TB of analytics-workload data on pg15.6. Aurora pg16 was GA in February; we wanted the JSON path indexing improvements and the parallel VACUUM enhancements. Doing this online (no scheduled downtime) was the headline constraint."],
		["{{A paragraph with data: <span class=\"hl\">specific numbers or ratios</span>.}}", "Logical replication caught up in <span class=\"hl\">4h 22m</span> for the initial sync across 142 tables. Replication lag at cutover was <span class=\"hl\">1.4s</span> — well under our 5s threshold. The traffic flip via PgBouncer drained the existing connection pool in <span class=\"hl\">41 seconds</span>."],
		["{{A short quoted line or key observation. Different in tone from the body so the reader gets a breath.}}", "Logical replication does not capture sequences. We almost forgot. Bullet-pointed reminders saved the cutover."],
	];
	for (const [from, to] of reps) h = h.split(from).join(to);
	h = fillSeq(h, "{{Chapter intro.}}", [
		"How we built the parallel pg16 cluster and copied schema before turning on replication.",
		"The cutover itself: traffic flip, sequence reconciliation, the 24-hour collision watch.",
		"What we'd do differently next time. Three lessons, one bullet each.",
	]);
	h = fillSeq(h, "{{Chapter intro - a one-line summary of the conclusion, then the recommendations below.}}", ["The migration succeeded because we separated the cluster-build, schema-copy, and traffic-flip phases. Each had its own gate. Each gate caught something."]);
	h = fillSeq(h, "{{A paragraph.}}", [
		"Cluster build was Terraform-managed: 3 instances, m6g.4xlarge. Build took 38 minutes including bootstrap. We deliberately matched the pg15 sizing so cost comparisons would stay clean post-cutover.",
		"Schema copy was a single `pg_dump --schema-only` followed by a single `psql -f` against pg16. We did NOT use `pg_dumpall` because it carries roles we wanted to manage separately via Terraform.",
		"Logical replication had two gotchas: sequences are not captured (we ran a post-flip sequence-max script), and large objects (LOs) need a separate pg_largeobject sync. We have no LOs, so that was a non-issue.",
		"Traffic flip via PgBouncer `RELOAD CONFIG` — connections drain naturally on next query. We watched the metrics for 90 minutes after flip before declaring success.",
	]);
	h = fillSeq(h, "{{Describe the methodology. Code or formula examples welcome:}}", ["Row-parity check across all 142 tables, sample 1000 rows per table, compare md5(row::text). Run pre-cutover, post-cutover, and again 24h later. Zero mismatches across all three runs."]);
	h = fillSeq(h, "{{A quoted passage - user interview, expert perspective, or cited source.}}", ["\"The reason this worked is that we never had to make a decision under time pressure. Every gate had a pre-defined fail-back, and the fail-back was test-driven.\" — postmortem retrospective notes, week of 2026-05-11"]);
	h = h.split("{{definition}}").join("logical replication");
	h = fillSeq(h, "{{Conclusion 1.}}", ["Online cutovers are possible at 1.8 TB scale, but only with phase-gated tooling."]);
	h = fillSeq(h, "{{Conclusion 2.}}", ["Logical replication's blind spots (sequences, LOs) are real but well-documented — pre-checks catch them."]);
	h = fillSeq(h, "{{Conclusion 3.}}", ["Keeping the old cluster warm for 7 days cost ~$2k. Cheap insurance."]);
	h = fillSeq(h, "{{Concrete, executable recommendations tied to the conclusions.}}", ["Adopt this 5-phase template (cluster, schema, replication, parity, flip) as standard procedure for tier-0 pg upgrades. Codify in `runbooks/pg-upgrade.md`."]);
	h = fillSeq(h, "{{Acknowledgement paragraph.}}", ["Thanks to the on-call rotation who watched metrics through the 90-minute canary, and to the analytics team for shifting their morning queries to the post-flip window."]);
	h = fillSeq(h, "{{DIMENSION_1}}", ["Phases"]);
	h = fillSeq(h, "{{DIMENSION_2}}", ["Gate"]);
	h = h.split("{{GAP}}").join("Sequence reconciliation script is bespoke; should land in shared tooling next cycle.");
	return h;
}

/* ============ RAG explainer — long-doc ============ */

function ragExplainer() {
	let h = readTemplate("long-doc");
	h = fillLongDocCommon(h, {
		subtitle: "Why retrieve before generate, for engineers new to the AI platform",
		version: "v1.0",
		yearMonth: "2026.05",
		publisher: "AI Platform",
		thesis: "RAG is the cheapest path to a knowledge-grounded LLM feature. It costs less than retraining, fewer tokens than full priming, and produces <span class=\"hl\">citable answers</span> as a side effect — which is exactly what auditability requires.",
		questions: "When should you use RAG instead of retraining? What does \"retrieval quality\" actually mean? Why are citations a free win, not extra effort?",
		statusQuo: "The AI platform serves <span class=\"hl\">12 RAG-backed features</span> across 6 product teams. Average retrieval latency is sub-50ms; average answer latency is under 1.8s end-to-end.",
		problem: "Engineers default to model retraining for knowledge problems because RAG infrastructure looks intimidating. It isn't — the chunking and indexing pieces are the only places where care matters.",
		term: "retrieval-augmented generation",
		sourcePerson: "Lewis et al. (2020)",
		title: "Retrieval-Augmented Generation",
		takeaway1: "RAG cuts inference cost by 100x vs full-corpus priming on typical knowledge bases.",
		takeaway2: "Citation chains drop audit time per query from minutes to seconds.",
		takeaway3: "Reranking models will arrive on the platform in Q3; current cosine-only retrieval is acceptable for most queries.",
		ref1: "Lewis et al. — Retrieval-Augmented Generation for Knowledge-Intensive NLP (arXiv:2005.11401)",
		ref2: "AI Platform — RAG runbook in internal wiki",
		vals: ["~500", "1024-dim", "4-8", "50ms", "1.8s", "12", "6", "100x"],
	});
	const reps = [
		["{{DOC_TITLE}}", "Retrieval-Augmented Generation"],
		["{{Document title<br>can span two lines}}", "Retrieval-Augmented<br>Generation"],
		["{{AUTHOR}}", "AI Platform"],
		["{{AUTHOR / TEAM}}", "AI Platform"],
		["{{DATE}}", "2026.05.11"],
		["{{DESCRIPTION}}", "Why retrieve before you generate. RAG explainer for engineers new to the AI platform."],
		["{{KEYWORDS}}", "RAG, retrieval, embeddings, AI platform, LLM"],
		["{{EYEBROW - e.g. Technical Report / Annual Review / White Paper}}", "Feature Explainer · AI Platform"],
		["{{If the reader does one thing, what is it? Specific enough to start Monday morning.}}", "Before adding a knowledge-heavy feature to your service, ask whether RAG would let you skip a model retrain. Most of the time, the answer is yes."],
		["{{Chapter intro - what this chapter is solving, why it matters. One or two sentences.}}", "A retrieval-augmented generation system fetches relevant documents from a vector store before asking a language model to answer. The model sees only what's relevant, not the whole corpus, and grounds its answer in citations the user can verify."],
		["{{A paragraph with data: <span class=\"hl\">specific numbers or ratios</span>.}}", "Passing <span class=\"hl\">4 KB</span> of retrieved context costs less than priming with the full <span class=\"hl\">400 KB</span> knowledge base. Embedding lookup is <span class=\"hl\">sub-50ms</span>; the model never reads the whole corpus per request."],
		["{{A short quoted line or key observation. Different in tone from the body so the reader gets a breath.}}", "Every claim can be traced back to a source document. That's what makes the system auditable."],
	];
	for (const [from, to] of reps) h = h.split(from).join(to);
	h = fillSeq(h, "{{Chapter intro.}}", [
		"How the four-stage pipeline fits together: index, retrieve, augment, generate.",
		"Where RAG is the right answer — and where it isn't.",
		"What the team is building next on top of RAG.",
	]);
	h = fillSeq(h, "{{Chapter intro - a one-line summary of the conclusion, then the recommendations below.}}", ["RAG is cheaper than retraining and more auditable than priming. Adopt it whenever the knowledge is citable."]);
	h = fillSeq(h, "{{A paragraph.}}", [
		"Indexing: documents are chunked (≈500 tokens each), embedded with a 1024-dim model, and written to a vector store with their source URLs as metadata.",
		"Retrieval: each user query is embedded and cosine-similarity-matched. Top-k chunks (typically 4–8) come back with source URLs attached.",
		"Augmentation: retrieved chunks slot into the model's prompt as a system-message block with `[1]`, `[2]` citation indices.",
		"Generation: the model answers using only the augmented context and cites the chunks it relied on by index. The UI links each citation back to the source URL.",
	]);
	h = fillSeq(h, "{{Describe the methodology. Code or formula examples welcome:}}", ["score(chunk, query) = cosine(embedding(chunk), embedding(query)). Top-k retrieved by descending score. Optional rerank pass with a cross-encoder model adds latency but improves precision on ambiguous queries."]);
	h = fillSeq(h, "{{A quoted passage - user interview, expert perspective, or cited source.}}", ["\"The model sees less context but gets the right context.\" — Lewis et al., \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" (arXiv:2005.11401, 2020)"]);
	h = h.split("{{definition}}").join("retrieval-augmented generation");
	h = fillSeq(h, "{{Conclusion 1.}}", ["RAG is the right fit when knowledge changes faster than model retraining."]);
	h = fillSeq(h, "{{Conclusion 2.}}", ["Auditability is RAG's underrated property — citation chains are valuable even when the model is right."]);
	h = fillSeq(h, "{{Conclusion 3.}}", ["Chunk quality dominates retrieval quality. Spend time on chunking strategy before tuning the model."]);
	h = fillSeq(h, "{{Concrete, executable recommendations tied to the conclusions.}}", ["Default to RAG for any feature that consults a knowledge base. Default to a model retrain only when the knowledge needs to be implicit in the model's reasoning."]);
	h = fillSeq(h, "{{Acknowledgement paragraph.}}", ["Thanks to the platform team for the vector-store infra and to early-adopter teams who reported on retrieval quality during the pilot."]);
	h = fillSeq(h, "{{DIMENSION_1}}", ["Stage"]);
	h = fillSeq(h, "{{DIMENSION_2}}", ["Latency budget"]);
	h = h.split("{{GAP}}").join("Reranking model not yet in production; currently using cosine similarity only.");
	return h;
}

/* ============ Auth incident — long-doc ============ */

function authIncident() {
	let h = readTemplate("long-doc");
	h = fillLongDocCommon(h, {
		subtitle: "47-minute outage post-mortem, for engineering org-wide",
		version: "v1.0",
		yearMonth: "2026.05",
		publisher: "Incident Response · Auth Engineering",
		thesis: "On 2026-05-04 the auth service failed 88% of token-issue requests for 47 minutes. Root cause was a <span class=\"hl\">combined-change deploy</span> — a dependency upgrade and a config change shipping together. The fix is process, not technology.",
		questions: "What exactly went wrong, and how did we find out? How did read-only fallback bridge the gap? What process change prevents this combined-change pattern from recurring?",
		statusQuo: "Pre-incident error rate on the token-issue endpoint was <span class=\"hl\">0.04%</span>. The auth service had no canary stage; deploys were all-or-nothing. Read-only fallback was available but had never been exercised in production.",
		problem: "We shipped a Redis client upgrade (3.1.0 → 3.2.0) AND a cache eviction policy change in the same deploy. Both were independently safe; together they exceeded the upstream timeout budget by ~1.7 seconds.",
		term: "combined-change deploy",
		sourcePerson: "Incident commander, 2026-05-04",
		title: "Auth Outage 2026-05-04 · Post-Mortem",
		takeaway1: "47 minutes of outage. 24,000 sessions terminated; 312,000 login attempts failed.",
		takeaway2: "Read-only fallback engaged in 6 minutes and brought severity from SEV-1 to SEV-2.",
		takeaway3: "Splitting dependency upgrades from config changes prevents the entire class of failure.",
		ref1: "Internal incident channel transcript, 2026-05-04",
		ref2: "Redis 3.2.0 changelog — see SET timeout behavior change",
		vals: ["0.04%", "88%", "90s", "6m", "47m", "24,000", "312,000", "$0"],
	});
	const reps = [
		["{{DOC_TITLE}}", "Auth outage · 2026-05-04"],
		["{{Document title<br>can span two lines}}", "Auth outage<br>2026-05-04"],
		["{{AUTHOR}}", "Incident Response"],
		["{{AUTHOR / TEAM}}", "Incident Response · Auth Engineering"],
		["{{DATE}}", "2026.05.05"],
		["{{DESCRIPTION}}", "47-minute outage on the authentication service caused by a misconfigured cache eviction policy. Post-mortem with timeline + action items."],
		["{{KEYWORDS}}", "incident, post-mortem, authentication, cache, eviction policy"],
		["{{EYEBROW - e.g. Technical Report / Annual Review / White Paper}}", "Post-Mortem · 2026-05-04"],
		["{{If the reader does one thing, what is it? Specific enough to start Monday morning.}}", "Never ship a dependency upgrade and a config change in the same deploy on a tier-0 service. The 15 minutes we spent bisecting could have been the 15 minutes we spent rolling back."],
		["{{Chapter intro - what this chapter is solving, why it matters. One or two sentences.}}", "On 2026-05-04 at 14:18 UTC the authentication service began returning 503 errors for 88 percent of token-issue requests. Read-only fallback engaged at 14:24. Full resolution at 15:05. Estimated impact: 24,000 sessions terminated, 312,000 login attempts failed."],
		["{{A paragraph with data: <span class=\"hl\">specific numbers or ratios</span>.}}", "Error rate jumped from <span class=\"hl\">0.04%</span> to <span class=\"hl\">88%</span> within 90 seconds of deploy. Read-only fallback brought severity from SEV-1 to SEV-2 within <span class=\"hl\">6 minutes</span>. Rollback to v2.40 completed at 15:02; all metrics nominal by 15:04."],
		["{{A short quoted line or key observation. Different in tone from the body so the reader gets a breath.}}", "The bisection cost would have been zero if dependency upgrades and config changes shipped separately."],
	];
	for (const [from, to] of reps) h = h.split(from).join(to);
	h = fillSeq(h, "{{Chapter intro.}}", [
		"Timeline: deploy at 14:16, impact at 14:18, page at 14:19:30, fallback at 14:24, rollback decision at 14:48, full resolution at 15:05.",
		"Root cause: Redis 3.2.0's stricter SET-with-TTL timeout, combined with a cache eviction policy change from LRU to TTL-based.",
		"Action items: split deploys (P0), auth canary stage (P0), Redis timeout audit (P1), dep-review checklist (P2).",
	]);
	h = fillSeq(h, "{{Chapter intro - a one-line summary of the conclusion, then the recommendations below.}}", ["Combined-change deploys on tier-0 services are the single most damaging anti-pattern in our pipeline. The fix is process, not technology."]);
	h = fillSeq(h, "{{A paragraph.}}", [
		"At 14:16 UTC, auth-service v2.41.0 rolled out to all production nodes. The deploy included a Redis client upgrade (3.1.0 → 3.2.0) AND a cache eviction policy change from LRU to TTL-based. Two changes in one deploy.",
		"At 14:18 UTC, the token-issue endpoint error rate jumped from 0.04% to 88%. Read endpoints were unaffected. The on-call engineer was paged at 14:19:30.",
		"At 14:24 UTC, read-only fallback engaged. Cached tokens continued to validate; new sign-ins still failed. Severity was reduced from SEV-1 to SEV-2.",
		"At 14:48 UTC, after 24 minutes of bisection, we rolled back v2.41 to v2.40 across all nodes. Full resolution at 15:05 UTC. Total outage: 47 minutes.",
	]);
	h = fillSeq(h, "{{Describe the methodology. Code or formula examples welcome:}}", ["The new Redis client (3.2.0) introduced a stricter timeout policy for SET-with-TTL: ~1.8s p99 vs ~80ms previously. The new eviction policy meant ~40% of token-issue paths now wrote to Redis with a TTL parameter. The combination produced upstream timeouts → 503s."]);
	h = fillSeq(h, "{{A quoted passage - user interview, expert perspective, or cited source.}}", ["\"We had documented the Redis client behavior change in our dependency-review template. The reviewer noted it but didn't flag it as a behavioral risk.\" — incident review notes, 2026-05-04"]);
	h = h.split("{{definition}}").join("combined-change deploy");
	h = fillSeq(h, "{{Conclusion 1.}}", ["Two changes shipping together cost us ~15 minutes of bisection during peak impact."]);
	h = fillSeq(h, "{{Conclusion 2.}}", ["Read-only fallback worked exactly as designed and bought us the time to think."]);
	h = fillSeq(h, "{{Conclusion 3.}}", ["The dep-review process needs a 'behavioral changes' section, not just version-diff scanning."]);
	h = fillSeq(h, "{{Concrete, executable recommendations tied to the conclusions.}}", ["P0: dep upgrades and config changes ship in separate deploys on tier-0. P0: auth-service deploys must canary 5% for 10 min. P1: audit all Redis calls for explicit timeout handling. P2: dep-review checklist gains a behavioral-changes section."]);
	h = fillSeq(h, "{{Acknowledgement paragraph.}}", ["Thanks to the incident commander for keeping the channel calm and to the engineer who proposed the rollback decision at 14:33 — earlier than I would have called it."]);
	h = fillSeq(h, "{{DIMENSION_1}}", ["Timeline"]);
	h = fillSeq(h, "{{DIMENSION_2}}", ["Impact"]);
	h = h.split("{{GAP}}").join("No canary stage existed for auth-service deploys. P0 action item to add one by 2026-05-25.");
	return h;
}

/* ============ main ============ */

function clearOldJson(slug) {
	const p = path.join(DEMOS, `${slug}.json`);
	if (fs.existsSync(p)) fs.unlinkSync(p);
}

function runCurated() {
	const builds = [
		["demo-postgres-migration", postgresMigration],
		["demo-rag-explainer", ragExplainer],
		["demo-q2-status", q2Status],
		["demo-auth-incident", authIncident],
	];

	for (const [slug, builder] of builds) {
		console.log(`Rescuing ${slug}…`);
		const html = builder();
		curatedWriteDemo(slug, html);
		clearOldJson(slug);
	}

	console.log(`Rescued ${builds.length} demos as filled-template HTML.`);
}

/* ===================== dispatch ===================== */

function main() {
	const args = process.argv.slice(2);
	const curated = args.includes("--curated");
	const landing = args.includes("--landing");
	const both = !curated && !landing;
	if (curated || both) runCurated();
	if (landing || both) runLanding();
}

main();
