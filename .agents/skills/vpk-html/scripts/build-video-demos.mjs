#!/usr/bin/env node
/* build-video-demos — generates the browsable "Video" catalog demos: single-file
 * HTML pages that embed a rendered MP4 for offline browsing. Video is the last
 * mile of the export contract documented in references/video-export.md — a deck
 * is re-authored as a HyperFrames composition under assets/video/<slug>/ and
 * rendered to assets/demos/media/<slug>.mp4. These pages let the catalog link
 * to that rendered artifact.
 *
 * The page is bespoke (a media player, not a filled document template), so it is
 * built from scratch with the shared shell helpers exactly like build-index.mjs,
 * not by filling a template. The MP4 lives under assets/demos/media/ so the
 * backend catalog allowlist (assets/demos/**.{html,mp4,webm,mov}) serves it.
 *
 *   node scripts/build-video-demos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { buildFaviconLinkBlock, buildSharedCssBlock, DEMOS } from "./shared.mjs";
import { retrofitThemeRuntime } from "./theme.mjs";

// One entry per rendered video. `src`/`sourceDeck` are relative to the demo file
// in assets/demos/. `composition` is provenance text only (assets/video/ is not
// catalog-served, so it must not be a link). Metadata is stated by the renderer.
const VIDEOS = [
	{
		slug: "demo-video-landing-demo-separation",
		title: "Landing Demo Separation",
		eyebrow: "Rendered video",
		lead: "The five-slide Landing Demo Separation deck, re-authored as a HyperFrames composition and rendered to a single MP4 for offline browsing.",
		description: "vpk-html's browser presentation mode does not render MP4 — video is a conversion contract. The source deck's speaker notes become Kokoro-narrated audio, each scene dwells for its narration plus lead-in and tail, and the Algebrica editorial identity is carried across as literal token values. This page is the last mile of that contract: it embeds the rendered artifact so the catalog can link straight to it.",
		src: "media/landing-demo-separation.mp4",
		sourceDeck: "demo-slides.html",
		composition: "assets/video/landing-demo-separation/",
		meta: [
			["Duration", "1:22"],
			["Resolution", "1920 × 1080"],
			["Format", "MP4 · H.264"],
			["Size", "5.4 MB"],
		],
	},
];

const PAGE_CSS = `
body {
	background: var(--paper-background);
	color: var(--ink);
	font-family: var(--font-body);
	line-height: 1.5;
	margin: 0;
	min-height: 100vh;
}

.video-page {
	margin: 0 auto;
	max-width: 860px;
	padding: 72px 24px 96px;
}

.video-page__back {
	color: var(--muted-text);
	display: inline-block;
	font-family: var(--font-mono);
	font-size: 13px;
	margin-bottom: 40px;
	text-decoration: none;
}

.video-page__back:hover {
	color: var(--ink);
}

.video-page__eyebrow {
	color: var(--muted-text);
	font-family: var(--font-mono);
	font-size: 12px;
	letter-spacing: 0.08em;
	margin: 0 0 12px;
	text-transform: uppercase;
}

.video-page__title {
	color: var(--headline);
	font-family: var(--font-display);
	font-size: 40px;
	font-weight: 500;
	line-height: 1.15;
	margin: 0 0 16px;
}

.video-page__lead {
	color: var(--ink);
	font-size: 19px;
	line-height: 1.5;
	margin: 0 0 40px;
	max-width: 62ch;
}

.video-frame {
	background: var(--surface-raised);
	border: 1px solid var(--rule-strong);
	border-radius: 12px;
	overflow: hidden;
}

.video-frame video {
	display: block;
	height: auto;
	width: 100%;
}

.video-meta {
	border: 1px solid var(--rule);
	border-radius: 10px;
	display: grid;
	gap: 1px;
	grid-template-columns: repeat(4, 1fr);
	margin: 32px 0 0;
	overflow: hidden;
}

.video-meta__cell {
	background: var(--surface-raised);
	padding: 16px 18px;
}

.video-meta__label {
	color: var(--muted-text);
	font-family: var(--font-mono);
	font-size: 11px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
}

.video-meta__value {
	color: var(--ink);
	font-size: 16px;
	margin-top: 6px;
}

.video-page__body {
	color: var(--ink);
	font-size: 16px;
	line-height: 1.6;
	margin: 40px 0 0;
	max-width: 66ch;
}

.video-source {
	border-top: 1px solid var(--rule);
	margin-top: 44px;
	padding-top: 28px;
}

.video-source__title {
	color: var(--headline);
	font-family: var(--font-display);
	font-size: 20px;
	font-weight: 500;
	margin: 0 0 16px;
}

.video-source__list {
	display: grid;
	gap: 12px;
	margin: 0;
}

.video-source__row {
	align-items: baseline;
	display: grid;
	gap: 12px;
	grid-template-columns: 140px 1fr;
}

.video-source__key {
	color: var(--muted-text);
	font-family: var(--font-mono);
	font-size: 12px;
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

.video-source__val {
	color: var(--ink);
	font-size: 15px;
}

.video-source__val a {
	color: var(--ink);
	text-decoration: underline;
	text-decoration-color: var(--rule-strong);
	text-underline-offset: 3px;
}

.video-source__val a:hover {
	text-decoration-color: var(--focal);
}

.video-source__val code {
	font-family: var(--font-mono);
	font-size: 13px;
}

@media (max-width: 720px) {
	.video-meta {
		grid-template-columns: repeat(2, 1fr);
	}

	.video-source__row {
		grid-template-columns: 1fr;
		gap: 4px;
	}
}
`;

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function renderMeta(meta) {
	return meta
		.map(([label, value]) => `<div class="video-meta__cell">
				<div class="video-meta__label">${escapeHtml(label)}</div>
				<div class="video-meta__value">${escapeHtml(value)}</div>
			</div>`)
		.join("\n");
}

function buildVideoDemoHtml(video) {
	const html = `<!doctype html>
<html lang="en" data-vpk-landing-demo="true" data-vpk-demo-source="video:${escapeHtml(video.slug.replace(/^demo-video-/, ""))}">
<head>
<meta charset="utf-8">
<title>vpk-html · ${escapeHtml(video.title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(video.lead)}">
<meta name="generator" content="vpk-html">
${buildFaviconLinkBlock()}
<style>
${buildSharedCssBlock()}
${PAGE_CSS}
</style>
</head>
<body data-vpk-motion="document">
<main class="video-page" aria-label="${escapeHtml(video.title)} video">
	<a class="video-page__back" href="../../index.html">← vpk-html catalog</a>
	<p class="video-page__eyebrow">${escapeHtml(video.eyebrow)}</p>
	<h1 class="video-page__title">${escapeHtml(video.title)}</h1>
	<p class="video-page__lead">${escapeHtml(video.lead)}</p>
	<div class="video-frame">
		<video controls preload="metadata" playsinline src="${escapeHtml(video.src)}">
			Your browser does not support embedded video. Download the file at
			<a href="${escapeHtml(video.src)}">${escapeHtml(video.src)}</a>.
		</video>
	</div>
	<div class="video-meta">
${renderMeta(video.meta)}
	</div>
	<p class="video-page__body">${escapeHtml(video.description)}</p>
	<section class="video-source" aria-label="Source and provenance">
		<h2 class="video-source__title">Source</h2>
		<div class="video-source__list">
			<div class="video-source__row">
				<div class="video-source__key">Source deck</div>
				<div class="video-source__val"><a href="${escapeHtml(video.sourceDeck)}">${escapeHtml(video.sourceDeck)}</a></div>
			</div>
			<div class="video-source__row">
				<div class="video-source__key">Composition</div>
				<div class="video-source__val"><code>${escapeHtml(video.composition)}</code></div>
			</div>
			<div class="video-source__row">
				<div class="video-source__key">Export contract</div>
				<div class="video-source__val"><code>references/video-export.md</code></div>
			</div>
		</div>
	</section>
</main>
</body>
</html>
`;
	return retrofitThemeRuntime(html);
}

function main() {
	for (const video of VIDEOS) {
		const html = buildVideoDemoHtml(video);
		const target = path.join(DEMOS, `${video.slug}.html`);
		fs.writeFileSync(target, html, "utf8");
		console.log(`Built ${video.slug}.html`);
	}
	console.log(`Built ${VIDEOS.length} video demo${VIDEOS.length === 1 ? "" : "s"}.`);
}

main();
