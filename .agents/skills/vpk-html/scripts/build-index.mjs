#!/usr/bin/env node
/*
 * build-index — the catalog index generator. index.html is regenerated only by the library
 * refresh (`build.mjs --refresh-library`), which passes buildIndexHtml() through the runtime
 * pipeline (docnav, fonts, theme, runtimes, enhancements) with sizes of the refreshed demos.
 * Running this script directly is an alias of that refresh. Edit SECTIONS, not index.html.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildFaviconLinkBlock, buildSharedCssBlock, ROOT } from "./shared.mjs";
import { retrofitThemeRuntime } from "./theme.mjs";

const DEMOS_DIR = path.join(ROOT, "assets", "demos");

const SECTIONS = [
	{
		id: "document-types",
		title: "Document types",
		items: [
			["demo-one-pager.html", "One-Pager"],
			["demo-long-doc.html", "Long Document"],
			["demo-letter.html", "Letter"],
			["demo-kaku.html", "Portfolio"],
			["demo-musk-resume.html", "Resume"],
			["demo-slides.html", "Slides"],
			["demo-tesla.html", "Equity Report"],
			["demo-changelog.html", "Changelog"],
			["demo-broadsheet.html", "Broadsheet Front Page"],
			["demo-annual-report.html", "Annual Report"],
			["demo-interview.html", "Interview"],
			["demo-lookbook.html", "Lookbook"],
			["demo-feature-essay.html", "Feature Essay"],
			["demo-motion-case-study.html", "Motion Case Study"],
			["demo-x-thread.html", "X Thread"],
		],
	},
	{
		id: "video",
		title: "Video",
		items: [
			["demo-video-landing-demo-separation.html", "Landing Demo Separation"],
		],
	},
	{
		id: "exploration",
		title: "Exploration and planning",
		items: [
			["demo-exploration-code-approaches.html", "Code Approaches"],
			["demo-exploration-visual-designs.html", "Visual Designs"],
			["demo-implementation-plan.html", "Implementation Plan"],
		],
	},
	{
		id: "review",
		title: "Code review and understanding",
		items: [
			["demo-code-review-pr.html", "Code Review"],
			["demo-pr-writeup.html", "PR Writeup"],
			["demo-code-understanding.html", "Code Understanding"],
			["demo-postgres-migration.html", "Postgres Migration"],
		],
	},
	{
		id: "design",
		title: "Design",
		items: [
			["demo-design-system.html", "Design System"],
			["demo-component-variants.html", "Component Variants"],
		],
	},
	{
		id: "prototyping",
		title: "Prototyping",
		items: [
			["demo-prototype-animation.html", "Animation Prototype"],
			["demo-prototype-interaction.html", "Interaction Prototype"],
		],
	},
	{
		id: "illustrations",
		title: "Illustrations and diagrams",
		items: [
			["demo-svg-illustrations.html", "SVG Illustrations"],
			["demo-flowchart-diagram.html", "Flowchart Diagram"],
			["demo-illustration-isometric-device.html", "Isometric Device"],
			["demo-illustration-exploded-assembly.html", "Exploded Assembly"],
			["demo-illustration-annotated-mechanism.html", "Annotated Mechanism"],
			["demo-illustration-hatched-cross-section.html", "Hatched Cross Section"],
			["demo-illustration-isometric-pipeline.html", "Isometric Pipeline"],
			["demo-illustration-iso-exploded-stack.html", "Exploded Stack (iso kit)"],
			["demo-anatomy-hero.html", "Anatomy Hero"],
			["demo-figure-engines.html", "Figure Engines"],
		],
	},
	{
		id: "generated-illustrations",
		title: "Generated illustrations (iso kit)",
		items: [
			["demo-illustration-gallery.html", "Illustration Gallery"],
			["demo-illustration-gallery-hairline-interfaces.html", "Hairline: Interfaces"],
			["demo-illustration-gallery-hairline-data.html", "Hairline: Data"],
			["demo-illustration-gallery-hairline-machines.html", "Hairline: Machines"],
			["demo-illustration-gallery-hairline-devices.html", "Hairline: Devices"],
			["demo-illustration-gallery-hairline-coding.html", "Hairline: Coding"],
			["demo-illustration-gallery-hairline-security.html", "Hairline: Security"],
			["demo-illustration-gallery-hairline-connectivity.html", "Hairline: Connectivity"],
			["demo-illustration-gallery-hairline-empty.html", "Hairline: Empty States"],
			["demo-illustration-gallery-hairline-marks.html", "Hairline: Marks"],
			["demo-illustration-gallery-anatomy-1.html", "Anatomy Collection, Part 1"],
			["demo-illustration-gallery-anatomy-2.html", "Anatomy Collection, Part 2"],
			["demo-illustration-gallery-anatomy-3.html", "Anatomy Collection, Part 3"],
			["demo-illustration-gallery-anatomy-4.html", "Anatomy Collection, Part 4"],
			["demo-illustration-iso-flatpack-shelf.html", "Flat-pack Shelf"],
			["demo-illustration-iso-phone-anatomy.html", "Phone Anatomy"],
			["demo-illustration-iso-cache-shelves.html", "Cache Tiers"],
			["demo-illustration-iso-parcel-tray.html", "Parcel Tray"],
			["demo-illustration-iso-turntable-anatomy.html", "Turntable Anatomy"],
			["demo-illustration-iso-card-stack-ui.html", "Card Anatomy"],
		],
	},
	{
		id: "decks",
		title: "Decks",
		items: [
			["demo-slide-deck.html", "Engineering Slide Deck"],
			["demo-agent-slides.html", "Agent Keynote"],
		],
	},
	{
		id: "research",
		title: "Research and learning",
		items: [
			["demo-research-feature-explainer.html", "Feature Explainer"],
			["demo-research-concept-explainer.html", "Concept Explainer"],
			["demo-rag-explainer.html", "RAG Explainer"],
		],
	},
	{
		id: "reports",
		title: "Reports",
		items: [
			["demo-status-report.html", "Weekly Status"],
			["demo-incident-report.html", "Incident Timeline"],
			["demo-q2-status.html", "Q2 Status Report"],
			["demo-auth-incident.html", "Auth Incident"],
		],
	},
	{
		id: "editors",
		title: "Custom editing interfaces",
		items: [
			["demo-editor-triage-board.html", "Ticket Triage Board"],
			["demo-editor-feature-flags.html", "Feature Flag Editor"],
			["demo-editor-prompt-tuner.html", "Prompt Tuner"],
			["demo-review-loop.html", "Review Loop"],
		],
	},
	{
		id: "diagrams",
		title: "Diagrams",
		items: [
			["demo-diagram-architecture.html", "Architecture"],
			["demo-diagram-flowchart.html", "Flowchart"],
			["demo-diagram-swimlane.html", "Swimlane"],
			["demo-diagram-state-machine.html", "State Machine"],
			["demo-diagram-timeline.html", "Timeline"],
			["demo-diagram-tree.html", "Tree"],
			["demo-diagram-layer-stack.html", "Layer Stack"],
			["demo-diagram-quadrant.html", "Quadrant"],
			["demo-diagram-venn.html", "Venn"],
		],
	},
	{
		id: "charts-distribution",
		title: "Charts - distributions",
		items: [
			["demo-diagram-box-plot.html", "Box Plot"],
			["demo-diagram-histogram.html", "Histogram"],
			["demo-diagram-ridgeline.html", "Ridgeline"],
			["demo-diagram-beeswarm.html", "Beeswarm"],
			["demo-diagram-dot-strip.html", "Dot Strip"],
			["demo-diagram-violin-plot.html", "Violin Plot"],
		],
	},
	{
		id: "charts-comparison",
		title: "Charts - comparison",
		items: [
			["demo-diagram-bar-chart.html", "Bar Chart"],
			["demo-diagram-slope-chart.html", "Slope Chart"],
			["demo-diagram-dumbbell.html", "Dumbbell"],
			["demo-diagram-lollipop.html", "Lollipop"],
			["demo-diagram-bullet.html", "Bullet"],
			["demo-diagram-population-pyramid.html", "Population Pyramid"],
			["demo-diagram-bump-chart.html", "Bump Chart"],
			["demo-diagram-isotype.html", "Isotype"],
		],
	},
	{
		id: "charts-time-series",
		title: "Charts - time series",
		items: [
			["demo-diagram-line-chart.html", "Line Chart"],
			["demo-diagram-annotated-line.html", "Annotated Line"],
			["demo-diagram-index-chart.html", "Index Chart"],
			["demo-diagram-small-multiples.html", "Small Multiples"],
			["demo-diagram-band-chart.html", "Band Chart"],
			["demo-diagram-stacked-area.html", "Stacked Area"],
			["demo-diagram-candlestick.html", "Candlestick"],
			["demo-diagram-waterfall.html", "Waterfall"],
			["demo-diagram-streamgraph.html", "Streamgraph"],
			["demo-diagram-horizon-chart.html", "Horizon Chart"],
			["demo-diagram-fan-chart.html", "Fan Chart"],
			["demo-diagram-priestley-timeline.html", "Priestley Timeline"],
			["demo-diagram-seismogram.html", "Seismogram"],
			["demo-diagram-gantt.html", "Gantt"],
		],
	},
	{
		id: "charts-parts-intensity",
		title: "Charts - parts and intensity",
		items: [
			["demo-diagram-donut-chart.html", "Donut Chart"],
			["demo-diagram-calendar-heatmap.html", "Calendar Heatmap"],
			["demo-diagram-matrix-heatmap.html", "Matrix Heatmap"],
			["demo-diagram-waffle.html", "Waffle"],
			["demo-diagram-grid-choropleth.html", "Grid Choropleth"],
			["demo-diagram-treemap.html", "Treemap"],
			["demo-diagram-marimekko.html", "Marimekko"],
			["demo-diagram-polar-area.html", "Polar Area"],
			["demo-diagram-sunburst.html", "Sunburst"],
			["demo-diagram-circle-packing.html", "Circle Packing"],
			["demo-diagram-hexbin.html", "Hexbin"],
			["demo-diagram-voronoi-treemap.html", "Voronoi Treemap"],
			["demo-diagram-contour-density.html", "Contour Density"],
			["demo-diagram-grid-cartogram.html", "Grid Cartogram"],
		],
	},
	{
		id: "charts-relationships",
		title: "Charts - relationships",
		items: [
			["demo-diagram-sankey.html", "Sankey"],
			["demo-diagram-arc-diagram.html", "Arc Diagram"],
			["demo-diagram-scatter.html", "Scatter"],
			["demo-diagram-connected-scatter.html", "Connected Scatter"],
			["demo-diagram-icicle.html", "Icicle"],
			["demo-diagram-parallel-coordinates.html", "Parallel Coordinates"],
			["demo-diagram-chord-diagram.html", "Chord Diagram"],
			["demo-diagram-upset-plot.html", "UpSet Plot"],
			["demo-diagram-edge-bundling.html", "Edge Bundling"],
			["demo-diagram-force-network.html", "Force Network"],
		],
	},
];

function escapeHtml(value) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// sizeOf(fileName) → bytes | null lets the library refresh label demos with their refreshed sizes.
function fileSizeMeta(fileName, sizeOf) {
	const filePath = path.join(DEMOS_DIR, fileName);
	const bytes = sizeOf ? sizeOf(fileName) : (fs.existsSync(filePath) ? fs.statSync(filePath).size : null);
	if (bytes == null) return "missing";
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function renderSidebar() {
	const nav = SECTIONS.map((section, index) => {
		const number = `${index + 1}.`;
		return `<a href="#${section.id}"><span>${number}</span>${escapeHtml(section.title)}</a>`;
	}).join("\n\t\t\t\t");

	return `<aside id="site-sidebar-right" aria-label="Catalog navigation">
	<div class="sidebar">
		<div class="sidebar__brand">
			<div>
				<div class="sidebar__title">vpk-html</div>
				<p>Offline editorial HTML artifacts.</p>
			</div>
		</div>
		<nav class="sidebar__section" aria-label="Catalog sections">
			<div class="sidebar-list">
				${nav}
			</div>
		</nav>
		<div class="sidebar__bottom-links" aria-label="Reference links">
			<a href="SKILL.md">Skill</a>
			<a href="README.md">Readme</a>
			<a href="CHEATSHEET.md">Cheatsheet</a>
		</div>
	</div>
</aside>`;
}

function renderSections(sizeOf) {
	return SECTIONS.map((section, sectionIndex) => {
		const rows = section.items.map(([fileName, label], itemIndex) => {
			const number = `${sectionIndex + 1}.${itemIndex + 1}`;
			const href = `assets/demos/${fileName}`;
			const meta = fileSizeMeta(fileName, sizeOf);
			return `<div class="module-index-post">
					<span class="module-index-number module-index-post__number">${number}</span>
					<div class="module-index-post__title"><a class="demo-row" href="${href}">${escapeHtml(label)}</a></div>
					<div class="in-review-item__count"><span class="module-index-post__views">${meta}</span></div>
				</div>`;
		}).join("\n");

		return `<section class="module-index-section demo-category" id="${section.id}" aria-labelledby="${section.id}-title">
			<div class="module-index-section-header demo-category-head">
				<div class="module-index-heading">
					<span class="module-index-number">${sectionIndex + 1}.</span>
					<h2 class="module-index-heading__title" id="${section.id}-title">${escapeHtml(section.title)}</h2>
				</div>
			</div>
			<div class="module-index-posts">
				${rows}
			</div>
		</section>`;
	}).join("\n");
}

export function buildIndexHtml({ sizeOf } = {}) {
	return retrofitThemeRuntime(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>vpk-html · Index</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="vpk-html reference index for offline Algebrica editorial HTML artifacts.">
<meta name="generator" content="vpk-html">
${buildFaviconLinkBlock()}
<style>
${buildSharedCssBlock()}

*,
*::before,
*::after {
	box-sizing: border-box;
}

html {
	background: var(--paper-background);
}

body {
	background: var(--paper-background);
	color: var(--ink);
	font-family: "Geist Mono Numeric", var(--font-body);
	font-size: 15px;
	line-height: 1.4;
	margin: 0;
	min-height: 100vh;
}

a {
	color: inherit;
	text-decoration-line: none;
}

a:hover {
	color: var(--ink);
}

.container {
	margin: 0 auto;
	max-width: 1130px;
	width: 1130px;
}

.site-container {
	display: flex;
	margin-bottom: 20px;
	min-height: 100vh;
}

#site-sidebar-right {
	flex: 0 0 330px;
	left: 0;
	max-width: 330px;
	position: fixed;
	top: 0;
	width: 330px;
	z-index: 10000;
}

.sidebar {
	background: var(--paper-background);
	border-right: 1px solid var(--rule);
	display: flex;
	flex-direction: column;
	height: 100vh;
	max-height: 100vh;
	overflow-y: auto;
	padding: 40px;
}

.sidebar__brand {
	align-items: center;
	display: flex;
	gap: 14px;
	margin-bottom: 40px;
}

.sidebar__title {
	color: var(--ink);
	font-size: 15px;
	font-weight: 600;
	margin-bottom: 2px;
}

.sidebar__brand p {
	color: var(--muted-text);
	font-size: 13px;
	line-height: 1.35;
	margin: 0;
}

.sidebar__section {
	border-bottom: 1px solid var(--rule);
	margin-bottom: 18px;
	padding-bottom: 20px;
}

.sidebar-list {
	font-size: 15px;
}

.sidebar-list a {
	align-items: center;
	color: var(--ink);
	display: flex;
	font-weight: 600;
	padding: 7px 0;
	text-decoration-line: none;
}

.sidebar-list a:hover {
	color: var(--meta-text);
}

.sidebar-list span {
	color: var(--muted-text);
	display: inline-block;
	font-family: var(--font-mono);
	font-size: 13px;
	margin-right: 10px;
	min-width: 32px;
}

.sidebar__bottom-links {
	color: var(--subtlest-text);
	font-size: 14px;
	margin-top: auto;
}

.sidebar__bottom-links a {
	color: var(--subtlest-text);
	display: block;
	margin-bottom: 10px;
	text-decoration-line: none;
}

.sidebar__bottom-links a:hover {
	color: var(--meta-text);
}

.site-column-main {
	flex-basis: 800px;
	margin-left: auto;
	margin-right: 0;
	position: relative;
}

main {
	padding: 54px 0 70px;
}

.hero {
}

.hero-intro {
	color: var(--muted-text);
	font-size: 15px;
	line-height: 1.5;
	margin: 0 0 50px;
	max-width: 500px;
}

.demo-contents {
}

.module-index__title {
	border-top: 0;
	color: var(--headline);
	font-family: var(--font-display);
	font-size: 36px;
	font-weight: 500;
	line-height: 1.2;
	margin: 0 0 30px;
	padding-top: 0;
}

.demo-category {
}

.demo-category:last-child {
}

.module-index-heading__title {
	color: var(--ink);
	font-size: 15px;
	font-weight: 600;
	line-height: 32px;
	margin: 0;
}

.module-index-post {
	border-top: 1px solid var(--rule);
}

.module-index-post:first-child {
	border-top: 0;
}

.demo-row {
	color: var(--ink);
	display: inline;
	text-decoration-line: underline;
	text-decoration-color: transparent;
	text-decoration-thickness: 1px;
	text-underline-offset: 4px;
}

.demo-row:hover,
.demo-row:focus-visible {
	text-decoration-color: currentColor;
}

.demo-row:focus-visible {
	border-radius: 2px;
	box-shadow: 0 0 0 2px var(--focus-ring);
	outline: 0;
}

@media (max-width: 1130px) {
	.container {
		max-width: 100%;
		width: 100%;
	}

	.site-container {
		display: block;
	}

	#site-sidebar-right {
		max-width: none;
		position: static;
		width: 100%;
	}

	.sidebar {
		border-bottom: 1px solid var(--rule);
		border-right: 0;
		height: auto;
		padding: 24px;
	}

	.sidebar-list {
		display: grid;
		gap: 2px 18px;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.site-column-main {
		margin: 10px;
		max-width: calc(100% - 20px);
		width: calc(100% - 20px);
	}

	main {
		padding-top: 20px;
	}

	.hero-intro {
		margin-left: 0;
	}
}

@media (max-width: 640px) {
	.sidebar-list {
		grid-template-columns: 1fr;
	}

	.module-index-post {
		align-items: flex-start;
	}
}
</style>
</head>
<body data-vpk-motion="document" data-vpk-chrome="catalog">
<div class="container">
	<div class="site-container">
		${renderSidebar()}
		<main class="site-column-main" aria-labelledby="catalog-title">
			<div class="module-index">
				<div class="module-index__title" id="catalog-title">Index</div>
				<p class="hero-intro">A compact catalog of document templates, technical diagrams, demos, and editing surfaces.</p>
				<div class="demo-contents" aria-label="Catalog groups">
					${renderSections(sizeOf)}
				</div>
			</div>
		</main>
	</div>
</div>
</body>
</html>
`);
}

// Alias CLI: writing index.html alone would drop its docnav and enhancement chrome.
async function main() {
	const { runLibraryRefreshCli } = await import("./runtime/pipeline.mjs");
	process.exitCode = await runLibraryRefreshCli({ script: "build-index.mjs", argv: process.argv.slice(2) });
}

function isMainModule() {
	try {
		return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
	} catch {
		return false;
	}
}

// Not awaited: pipeline.mjs imports this module, so its evaluation must finish first.
if (isMainModule()) {
	main().catch(error => { console.error(error); process.exitCode = 1; });
}
