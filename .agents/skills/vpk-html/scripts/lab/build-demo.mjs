#!/usr/bin/env node
// vpk-lab · build assets/demos/demo-motion-case-study.html end to end (references/media-pipeline.md, Demo):
// template + demo copy + assets/lab/fixtures/demo.content.json (render-case-study) → capture the fixture
// (rehearsal-target.capture.mjs, hold 0–6 s) → encode (preset film) → embed (poster, provenance) → runtime pipeline.
//
//   node .agents/skills/vpk-html/scripts/lab/build-demo.mjs [--content <content.json>] [--film <film.mp4>]   # unsandboxed:
//        Playwright, ffmpeg and cwebp; writes the demo under .agents/skills/ and capture records under output/
//   node .agents/skills/vpk-html/scripts/lab/build-demo.mjs --check    # structural: no browser, no ffmpeg
//
// --film skips the capture and embeds a supplied MP4 (the supplied-film path). --check passes when a film is embedded,
// the lab block is current, the IR-owned parts match the content, and everything outside the embed-owned parts
// (video, film data, provenance, thumbnails) equals a fresh assembly.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveRepoRoot } from "../repo-root.mjs";
import { buildTemplateHtml } from "./build-template.mjs";
import { checkLabHtml } from "./kit.mjs";
import { applyCaseStudy, caseStudyDrift, contentOf, renderCaseStudy } from "./render-case-study.mjs";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEMO_PATH = path.join(SKILL, "assets", "demos", "demo-motion-case-study.html");
export const DEMO_CONTENT = path.join(SKILL, "assets", "lab", "fixtures", "demo.content.json");
const SPEC = path.join(SKILL, "assets", "lab", "fixtures", "rehearsal-target.capture.mjs");
const esc = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Copy for every template placeholder outside the IR-rendered regions. Arrays fill repeated tokens in order. */
export const DEMO_COPY = Object.freeze({
	DOC_TITLE: "Three throws, one clock · motion case study demo", AUTHOR: "vpk-html", KEYWORDS: "motion case study, film, cue sheet, Gantt, lab, easing, spring",
	DESCRIPTION: "A motion case study demo: a six-second film captured frame by frame from a rehearsal fixture, with a cue sheet, a Gantt and an easing lab on one clock.",
	"Case study · project · moment": "Case study · vpk-html demo · the card throw",
	"One or two sentences: what shipped, and what this page lets the reader check.": "One card throw, eased three ways and captured one frame at a time from its own clock. Every time on this page reads that clock, so you can check each beat against the film.",
	Author: "vpk-html", "role on the work": "fixture, capture and page", "when and from which sources this was written": "built from assets/lab/fixtures by scripts/lab/build-demo.mjs",
	"Film heading": "Six seconds, three easings",
	"What the film shows and how it was captured: from the running work, one frame at a time through its own clock, or a supplied recording.": "The film was not recorded in real time. The capture held the fixture's rehearsal clock at each of 181 times, let it paint, and photographed it, so every frame is exact.",
	"Brief heading": "Which throw reads as a release?",
	"The problem as it was posed, in the asker's words where you have them.": "The same card travels the same arc three times. Only the easing of the throw changes, and the question is which one makes the card look thrown rather than moved.",
	"The question, and the section that answers it.": ["Does the easing change what the throw means? The film and the cue sheet answer it.", "Can the landing hide a weak throw? The lab answers it."],
	"Process heading": "Three days on one clock", "How the work unfolded, and what each row of the timeline records.": "Each row is one day of the fixture's making; filter by theme to follow one thread.",
	"Run-of-show heading": "One clock, every cue", "How one clock drives every beat. Click the chart or a cue to send the film there.": "Each throw starts two seconds after the last, and every beat is an offset on the same clock. Click the chart or a cue to send the film there.",
	"Lab section heading": "Scrub one throw", "What the lab lets the reader try, and which real maths it runs.": "The lab runs the fixture's own maths. Scrub the clock, then switch the curve and watch where the card is at the same time.",
	"One or two sentences on what the reader should notice while scrubbing.": "Scrub to 0.70 s and switch curves: outBold has covered 60% of the way, vpkOut about half, and inOut has barely left the pile.",
	"Engineering heading": "Why one clock", Decision: ["Pure functions", "Held capture"],
	"What was decided, and the constraint that forced it.": ["Every pose is a function of the clock, so the film, the lab and the Gantt can never disagree.", "Frames are held, not recorded, so a slow machine cannot drop or smear a frame."],
	"What did not make it": "What did not make it", "Who made it": "Who made it", Name: ["Design", "Engineering"], Role: ["the throw and its three easings", "the fixture, the capture and this page"],
	"Source: code, history, channel or document, with dates": "assets/lab/fixtures/rehearsal-target.html, the capture fixture",
	"Film provenance: media/embed.mjs fills this line.": "Film provenance: written by media/embed.mjs when the film is embedded.",
	"Speaker note: the one sentence to open with, then scroll to the film.": "One card, three easings, one clock.",
	"Speaker note: play the film once without talking, then step the key beat frame by frame.": "Play it once, then step the first landing with the full stop key.",
	"Speaker note: the decision that shaped everything after.": "The only variable is the throw's easing.",
	"Speaker note: filter to one theme to tell the story of the decisions.": "Filter to Review to see how the comparison was made.",
	"Speaker note: click two cues to show the film jumping; every beat is a function of one clock.": "Click the second and third throws to compare them.",
	"Speaker note: scrub to the middle of the throw, then switch the curve.": "Stop at 0.70 s and switch curves.",
	"Speaker note: walk the layers bottom to top.": "Clock, maths, capture: bottom to top.",
	"Speaker note: turn over the discard that taught the most.": "Turn over the linear throw.",
	"Speaker note: thank the people by name.": "Credits.",
});

const FACTS = [["6.03 s", "of film on one rehearsal clock"], ["181", "frames, each held and photographed"], ["3", "easings for the same throw"], ["0.1 s", "for the landing spring to cover half its drop"]];

/** Fill the placeholders (strings everywhere; arrays in order of appearance). Throws when one stays unfilled. */
export function fillPlaceholders(html, copy = DEMO_COPY) {
	let out = html.replace(/<dl class="fact-strip">[\s\S]*?<\/dl>/, `<dl class="fact-strip">\n${FACTS.map(([dt, dd]) => `\t\t<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join("\n")}\n\t</dl>`);
	for (const [token, value] of Object.entries(copy)) {
		const values = Array.isArray(value) ? [...value] : null;
		out = out.split(`{{${token}}}`).reduce((acc, part, index) => (index === 0 ? part : `${acc}${esc(values ? values.shift() ?? "" : value)}${part}`), "");
	}
	const left = [...new Set(out.match(/\{\{[^}]+\}\}/g) ?? [])];
	if (left.length) throw new Error(`build-demo: unfilled placeholders: ${left.join(", ")}`);
	return out;
}

/** The demo before its film: template, copy, IR regions, island; no literal-braces opt-out. */
export async function assembleDemo({ content = JSON.parse(fs.readFileSync(DEMO_CONTENT, "utf8")) } = {}) {
	const ir = contentOf(content);
	const filled = applyCaseStudy(await buildTemplateHtml(), renderCaseStudy(content));
	const titled = filled.replace("{{Case study headline}}", esc(ir.title));
	return fillPlaceholders(titled).replace(/<html lang="en" data-vpk-literal-double-braces="true">/, '<html lang="en">');
}

/** Mask the parts embed owns (video tag, film data, provenance text, baked thumbs). */
export function outsideEmbed(html) {
	return html.replace(/<video\b[^>]*>/, "<video>").replace(/(data-vpk-film-data>)[\s\S]*?(<\/script>)/, "$1$2")
		.replace(/(data-vpk-film-provenance>)[^<]*/, "$1").replace(/<img class="vpk-cue-thumb"[^>]*>/g, "");
}

/** Structural check: string[] of problems (empty when current). */
export async function demoDrift(html, { content = JSON.parse(fs.readFileSync(DEMO_CONTENT, "utf8")) } = {}) {
	const { applyRuntimePipeline } = await import("../runtime/pipeline.mjs");
	const drift = [];
	if (!/<video\b[^>]*\ssrc="data:video\/mp4;base64,/.test(html)) drift.push("no embedded film");
	if (!checkLabHtml(html).ok) drift.push("lab block");
	drift.push(...caseStudyDrift(html, renderCaseStudy(content)));
	const fresh = applyRuntimePipeline(await assembleDemo({ content }), { filePath: DEMO_PATH, kind: "demo" });
	if (outsideEmbed(html) !== outsideEmbed(fresh)) drift.push("shell or copy (outside the embedded film)");
	return drift;
}

async function main(argv) {
	const value = flag => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : null);
	const contentFile = value("--content") ?? DEMO_CONTENT;
	const content = JSON.parse(fs.readFileSync(path.resolve(contentFile), "utf8"));
	const rel = path.relative(process.cwd(), DEMO_PATH);
	if (argv.includes("--check")) {
		const drift = fs.existsSync(DEMO_PATH) ? await demoDrift(fs.readFileSync(DEMO_PATH, "utf8"), { content }) : ["missing"];
		if (drift.length) console.error(`✗ ${rel}: ${drift.join(", ")}; run node .agents/skills/vpk-html/scripts/lab/build-demo.mjs (unsandboxed)`);
		else console.log(`✓ ${rel}: film embedded, lab block, regions, island and shell current`);
		return drift.length ? 1 : 0;
	}
	const repo = resolveRepoRoot() ?? process.cwd();
	const records = path.join(repo, "output", "vpk-html-capture", "demo-motion-case-study");
	fs.mkdirSync(records, { recursive: true });
	let film = value("--film");
	let manifest = null;
	if (!film) {
		const { loadCaptureSpec, normalizeSpec, runCapture } = await import("../media/capture.mjs");
		const spec = normalizeSpec(await loadCaptureSpec(SPEC), { specPath: SPEC, manifestDir: records });
		const capture = await runCapture(spec);
		console.log(`✓ captured ${capture.manifest.frames} frames → ${path.relative(process.cwd(), capture.ffconcat)}`);
		const { encodeFilm, encodeRecord } = await import("../media/encode.mjs");
		film = path.join(records, "film.mp4");
		const result = encodeFilm({ input: spec.framesDir, output: film, preset: "film" });
		fs.writeFileSync(path.join(records, "encode.json"), `${JSON.stringify(encodeRecord({ result, input: capture.ffconcat, output: film, cwd: repo }), null, "\t")}\n`);
		console.log(`✓ encoded ${result.bytes} B, ${result.probe.frames} frames, ${result.probe.duration.toFixed(3)} s`);
		manifest = capture.manifestPath;
	}
	fs.writeFileSync(DEMO_PATH, await assembleDemo({ content }));
	const { embedDocument } = await import("../media/embed.mjs");
	const embedded = await embedDocument({ htmlFile: DEMO_PATH, film, manifest, cwd: repo, roots: [records, path.dirname(path.resolve(film))], lite: "never" });
	embedded.lines.forEach(line => console.log(line));
	embedded.warnings.forEach(line => console.warn(`warn ${line}`));
	const { applyRuntimePipeline } = await import("../runtime/pipeline.mjs");
	const html = fs.readFileSync(DEMO_PATH, "utf8");
	const final = applyRuntimePipeline(html, { filePath: DEMO_PATH, kind: "demo" });
	if (final !== html) fs.writeFileSync(DEMO_PATH, final);
	console.log(`✓ wrote ${rel} (${Buffer.byteLength(final)} B)`);
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
