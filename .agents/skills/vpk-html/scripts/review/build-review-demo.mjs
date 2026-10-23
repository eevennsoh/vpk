#!/usr/bin/env node
/*
 * review/build-review-demo: builds assets/demos/demo-review-loop.html in memory (ws1 4.17).
 *
 *   node .agents/skills/vpk-html/scripts/review/build-review-demo.mjs --check   # exit 1 on drift (sandbox OK)
 *   node .agents/skills/vpk-html/scripts/review/build-review-demo.mjs --write   # unsandboxed (writes under .agents/skills)
 *
 * Steps (deterministic): read demo-implementation-plan.html; insert two decision fieldsets at
 * fixed string anchors; stamp with seed "demo-review-loop" and no ledger (r1); edit two blocks
 * and stamp r2 against the r1 ledger, addressing one comment; embed
 * scripts/review/fixtures/demo-review.json; inject the runtime; apply the ws0 runtime pipeline,
 * so the result equals the committed file after --refresh-library.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { injectReviewRuntime } from "./inject.mjs";
import { setEmbeddedReviewText } from "./markup.mjs";
import { createRandom, normalizeReview } from "./schema.mjs";
import { stampDocument } from "./stamp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "../..");
export const DEMO_SOURCE = path.join(SKILL, "assets/demos/demo-implementation-plan.html");
export const DEMO_TARGET = path.join(SKILL, "assets/demos/demo-review-loop.html");
export const DEMO_FIXTURE = path.join(HERE, "fixtures/demo-review.json");
export const DEMO_SEED = "demo-review-loop";
export const R1_TIME = "2026-10-11T08:00:00.000Z";
export const R2_TIME = "2026-10-12T08:00:00.000Z";
/** The fixture comment that r2 addresses (its block changes in r2). */
export const DEMO_ADDRESSED = Object.freeze(["c_mgm1a001_demo0001"]);

const ROLLOUT_ANCHOR = "Nothing is user-visible until slice&nbsp;4.</p>\n";
const ROLLOUT_DECISION = `
      <fieldset class="vpk-decision" data-vpk-decision="rollout">
        <legend>How should slice 4 reach users?</legend>
        <label><input type="radio" name="rollout" value="ramp" checked> Ramp: internal first, then 10% &rarr; 100% over three days</label>
        <label><input type="radio" name="rollout" value="all-at-once"> All at once when slice 4 lands <small>simpler, no flag ramp</small></label>
      </fieldset>
`;
const EDITING_ANCHOR = "      <div class=\"open-q\">\n";
const EDITING_DECISION = `      <fieldset class="vpk-decision" data-vpk-decision="editing">
        <legend>Can people edit a comment after posting it?</legend>
        <label><input type="radio" name="editing" value="delete-only" checked> No, delete and repost for v1</label>
        <label><input type="radio" name="editing" value="edit"> Yes, with an <code>edited_at</code> column and an "edited" label</label>
      </fieldset>
`;
// r2: two blocks change (the milestones intro and the mention-risk mitigation).
const R2_EDITS = [
	["Ship in four slices, each independently reviewable and each behind the flag.", "Ship in four slices, each independently reviewable, each behind the flag, and each with its own rollback note."],
	["Resolve mentions against workspace members only, at write time, and store the resolved user ids", "Resolve mentions against workspace members only, at write time, skip code spans, and store the resolved user ids"],
];

function replaceOnce(html, needle, replacement, label) {
	const at = html.indexOf(needle);
	if (at < 0 || html.indexOf(needle, at + needle.length) >= 0) throw new Error(`build-review-demo: anchor for ${label} must appear exactly once`);
	return html.slice(0, at) + replacement + html.slice(at + needle.length);
}

export function insertDemoDecisions(html) {
	let out = replaceOnce(html, ROLLOUT_ANCHOR, ROLLOUT_ANCHOR + ROLLOUT_DECISION, "the rollout decision");
	out = replaceOnce(out, EDITING_ANCHOR, EDITING_DECISION + EDITING_ANCHOR, "the editing decision");
	return out.replace(/<title>[^<]*<\/title>/, "<title>Review loop: Comment threads on task cards</title>");
}

// r1: decisions inserted, then stamped with the demo seed (no ledger). The seed goes in as an
// explicit stream: `seed` alone is scoped to the document text, which would re-id the fixture.
export function demoRevision1() {
	const source = fs.readFileSync(DEMO_SOURCE, "utf8");
	return stampDocument(insertDemoDecisions(source), { random: createRandom(DEMO_SEED), reviewable: true, timestamp: R1_TIME, label: "Initial version" });
}

export function demoRevision2Html(r1Html) {
	let out = r1Html;
	for (const [from, to] of R2_EDITS) out = replaceOnce(out, from, to, `the r2 edit "${from.slice(0, 24)}"`);
	return out;
}

// r2: the two edits stamped against the r1 ledger; `addresses` are comment ids.
export function demoRevision2(r1, addresses) {
	return stampDocument(demoRevision2Html(r1.html), { ledger: r1.ledger, random: createRandom(DEMO_SEED), reviewable: true, timestamp: R2_TIME, label: "Address review round 1", summary: "Rollback notes per slice; mention detection skips code spans.", addresses });
}

export function readDemoReview() {
	const raw = JSON.parse(fs.readFileSync(DEMO_FIXTURE, "utf8"));
	const { review, issues } = normalizeReview(raw);
	if (!review || issues.length) throw new Error(`build-review-demo: fixture issues: ${issues.join("; ")}`);
	return review;
}

/** The demo HTML, in memory and deterministic. */
export async function buildReviewDemo() {
	const review = readDemoReview();
	const r1 = demoRevision1();
	const r2 = demoRevision2(r1, DEMO_ADDRESSED);
	const embedded = setEmbeddedReviewText(r2.html, { ...review, doc: { ...review.doc, id: r2.docId, revision: r2.revision } });
	const { applyRuntimePipeline } = await import("../runtime/pipeline.mjs");
	return applyRuntimePipeline(injectReviewRuntime(embedded), { filePath: DEMO_TARGET });
}

async function main() {
	const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--check") ? "check" : null;
	if (!mode) {
		console.error("Usage: build-review-demo.mjs --check | --write");
		process.exitCode = 1;
		return;
	}
	const html = await buildReviewDemo();
	const rel = path.relative(process.cwd(), DEMO_TARGET);
	const current = fs.existsSync(DEMO_TARGET) ? fs.readFileSync(DEMO_TARGET, "utf8") : null;
	if (mode === "check") {
		if (current === html) console.log(`✓ ${rel} is up to date`);
		else {
			console.error(`✗ ${rel} drifted from build-review-demo.mjs (run --write, unsandboxed)`);
			process.exitCode = 1;
		}
		return;
	}
	if (current === html) {
		console.log(`✓ ${rel} unchanged`);
		return;
	}
	fs.writeFileSync(DEMO_TARGET, html);
	console.log(`✓ wrote ${rel} (${Buffer.byteLength(html).toLocaleString("en-US")} B)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
