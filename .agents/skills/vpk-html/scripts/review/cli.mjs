/*
 * review/cli: the agent-side review commands, reached through build.mjs (ws1 4.15, C7, C8).
 *
 *   build.mjs --inject-review <file.html>... [--seed <s>] [--ledger <path> | --no-ledger] [--new-doc-id]
 *   build.mjs --review <review.json|reviewed.html>... <artifact.html> [--format md|json] [--include-resolved] [--out <file>] [--force-doc] [--browser]
 *   build.mjs --stamp <artifact.html> [--from <previous.html|ledger.json>] [--revision-label <t>] [--summary <t>] [--addresses <c_ids,...|review files>...] [--no-revision] [--seed <s>] [--ledger <path> | --no-ledger] [--force-doc]
 *   build.mjs --embed-review <review.json|reviewed.html>... <artifact.html> [--force-doc]
 *   build.mjs --strip-review <file.html> [--out <clean.html>] [--all]
 *
 * Exit codes: 0 ok · 1 usage or IO · 2 schema/validation or no <head> · 3 doc id mismatch
 * (--force-doc overrides) · 4 a writing command targets assets/templates/**.
 * Writes under .agents/skills/ need an unsandboxed shell. linkedom and esbuild load lazily.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonIsland } from "../json-island.mjs";
import { weightWarnings } from "../media/size-budget.mjs";
import { resolveRepoRoot } from "../repo-root.mjs";
import { buildTextIndex, headingPathFor, resolveAnchor } from "./anchor.mjs";
import { resolveInBrowser } from "./browser-resolve.mjs";
import { hasDecisionBlocks, hasReviewRuntime, injectReviewRuntime, removeReviewRuntime, runtimeBytes } from "./inject.mjs";
import { reviewMarkdown, taskCommand } from "./markdown.mjs";
import { findReviewIsland, readIslandJson, readMetaContent, setEmbeddedReviewText } from "./markup.mjs";
import { addressedIndex, capIssues, commentStatus, mergeReviewsReport, threadsFrom } from "./merge.mjs";
import { createEmptyReview, isCommentId, isDocId, normalizeReview, nowIso, reviewLimits } from "./schema.mjs";
import { applyEdits, collectBlocks, LEDGER_SCHEMA, ledgerPathFor, normalizeLedger, parseDocument, readRegistry, ReviewError, scanStartTags, serializeLedger, stampDocument, syncLiteVariant } from "./stamp.mjs";
import { normalizeWhitespace } from "./text.mjs";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const REVIEW_COMMANDS = new Set(["--inject-review", "--review", "--stamp", "--embed-review", "--strip-review"]);
const WRITING_COMMANDS = new Set(["--inject-review", "--stamp", "--embed-review", "--strip-review"]);
const VALUE_FLAGS = new Set(["--seed", "--ledger", "--format", "--out", "--from", "--revision-label", "--summary", "--addresses"]);
const BOOLEAN_FLAGS = new Set(["--no-ledger", "--new-doc-id", "--include-resolved", "--force-doc", "--browser", "--no-revision", "--all"]);

/** True when argv holds a review command as a whole token (never a prefix such as --include-review). */
export function isReviewCommand(argv) {
	return Array.isArray(argv) && argv.some(token => REVIEW_COMMANDS.has(token));
}

export function parseReviewArgs(argv) {
	const list = Array.isArray(argv) ? argv.slice() : [];
	const command = list.find(token => REVIEW_COMMANDS.has(token));
	if (!command) throw new ReviewError("no review command (expected one of --inject-review, --review, --stamp, --embed-review, --strip-review)", 1);
	const args = { command, files: [], addresses: [], flags: {} };
	for (let index = 0; index < list.length; index++) {
		const token = list[index];
		if (token === command) continue;
		if (VALUE_FLAGS.has(token)) {
			const value = list[++index];
			if (value === undefined || value.startsWith("--")) throw new ReviewError(`${token} needs a value`, 1);
			if (token === "--addresses") {
				args.addresses.push(value);
				while (list[index + 1] !== undefined && !list[index + 1].startsWith("--")) args.addresses.push(list[++index]);
			} else args.flags[token.slice(2)] = value;
		} else if (BOOLEAN_FLAGS.has(token)) args.flags[token.slice(2)] = true;
		else if (token.startsWith("--")) throw new ReviewError(`unknown option ${token}`, 1);
		else args.files.push(token);
	}
	if (args.flags.format && !["md", "json"].includes(args.flags.format)) throw new ReviewError("--format must be md or json", 1);
	return args;
}

// The on-disk spelling of a path: realpath.native of the deepest existing ancestor (it returns
// the canonical case on case-insensitive volumes, where plain realpathSync keeps the caller's),
// plus the segments that do not exist yet.
export function canonicalPath(target) {
	let head = path.resolve(target);
	const tail = [];
	for (;;) {
		try {
			return path.join(fs.realpathSync.native(head), ...tail);
		} catch {
			const parent = path.dirname(head);
			if (parent === head) return path.resolve(target);
			tail.unshift(path.basename(head));
			head = parent;
		}
	}
}

// Writing commands refuse SKILL/assets/templates/** (templates stay review-free).
export function isTemplatePath(file, skillRoot = SKILL_ROOT) {
	const relative = path.relative(canonicalPath(path.join(skillRoot, "assets", "templates")), canonicalPath(file));
	return !relative.startsWith("..") && !path.isAbsolute(relative);
}

// The /html?page=local/... URL for files under the dev-only local roots, else null.
export function localPageUrl(file, repoRoot = resolveRepoRoot()) {
	if (!repoRoot) return null;
	const relative = path.relative(repoRoot, path.resolve(file)).split(path.sep).join("/");
	if (!/^(?:artifacts\/vpk-html|output\/vpk-html[a-z0-9-]*)\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(relative)) return null;
	return `/html?page=local/${relative}`;
}

function readText(file) {
	try {
		return fs.readFileSync(file, "utf8");
	} catch (error) {
		throw new ReviewError(`cannot read ${file}: ${error.code || error.message}`, 1);
	}
}

function readLedgerFile(file) {
	if (!fs.existsSync(file)) return null;
	try {
		return normalizeLedger(JSON.parse(readText(file)));
	} catch (error) {
		if (error instanceof ReviewError) throw error;
		throw new ReviewError(`ledger ${file}: ${error.message}`, 2);
	}
}

// A ledger rebuilt from a previous HTML (--from <previous.html>).
export function ledgerFromHtml(html) {
	const docId = readMetaContent(html, "vpk-doc-id");
	if (!isDocId(docId)) throw new ReviewError("--from: the previous file has no vpk-doc-id meta", 2);
	const { blocks, islands } = collectBlocks(html);
	const { registry } = readRegistry(html);
	const ledger = { schema: LEDGER_SCHEMA, docId, revision: readMetaContent(html, "vpk-doc-revision") || "r1", reviewable: hasReviewRuntime(html), updatedAt: nowIso(), blocks, islands };
	if (registry.entries.length) ledger.registry = registry;
	return normalizeLedger(ledger);
}

// Reads a review input (JSON or reviewed HTML) into a normalized review for docId.
// Nothing is capped here (cap: false): every caller merges with
// mergeReviewsReport, which caps by priority and reports what it leaves out.
export function readReviewInput(file, docId, { forceDoc = false } = {}) {
	const text = readText(file);
	let raw;
	try {
		if (/^\s*[[{]/.test(stripBom(text))) raw = parseJsonIsland(stripBom(text));
		else {
			const island = findReviewIsland(text);
			if (!island) throw new ReviewError(`${file}: no embedded review (data-vpk-review island) found`, 2);
			raw = parseJsonIsland(island.text);
		}
	} catch (error) {
		if (error instanceof ReviewError) throw error;
		throw new ReviewError(`${file}: ${error.message}`, 2);
	}
	if (forceDoc && raw && typeof raw === "object" && raw.doc && typeof raw.doc === "object" && isDocId(docId)) raw = { ...raw, doc: { ...raw.doc, id: docId } };
	const result = normalizeReview(raw, { docId: isDocId(docId) ? docId : undefined, cap: false });
	if (result.rejected === "doc") throw new ReviewError(`${file}: ${result.issues[0]} (use --force-doc to override)`, 3);
	if (!result.review) throw new ReviewError(`${file}: ${result.issues.join("; ")}`, 2);
	return { review: result.review, issues: result.issues };
}

// Comment ids from --addresses values: ids, comma lists, or review files (their open root comments).
export function collectAddresses(values, docId, options = {}) {
	const ids = [];
	for (const value of values) {
		if (/\.(?:json|html?)$/i.test(value) && fs.existsSync(value)) {
			const { review } = readReviewInput(value, docId, options);
			for (const { root } of threadsFrom(review).threads) if (!root.deleted && root.status !== "resolved") ids.push(root.id);
			continue;
		}
		for (const part of value.split(",").map(item => item.trim()).filter(Boolean)) {
			if (!isCommentId(part)) throw new ReviewError(`--addresses: ${part} is not a comment id (c_…) or a review file`, 1);
			ids.push(part);
		}
	}
	return [...new Set(ids)];
}

// --strip-review --all: drops the doc metas and every data-vpk-id / data-vpk-revision(-kind) attribute.
export function stripReviewAttributes(html) {
	let out = html.replace(/\n[ \t]*<meta name="vpk-doc-(?:id|revision)" content="[^"]*">/g, "").replace(/<meta\b[^>]*\bname=["']vpk-doc-(?:id|revision)["'][^>]*>\s*/gi, "");
	const edits = [];
	for (const token of scanStartTags(out)) {
		for (const attr of token.attrs) {
			if (attr.name !== "data-vpk-id" && attr.name !== "data-vpk-revision" && attr.name !== "data-vpk-revision-kind") continue;
			let from = attr.start;
			while (from > token.start && /\s/.test(out[from - 1])) from--;
			edits.push({ start: from, end: attr.end, text: "" });
		}
	}
	out = applyEdits(out, edits);
	return out;
}

function stripBom(text) {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function lineOf(source, blockId) {
	if (!blockId) return null;
	for (const quote of ["\"", "'"]) {
		const offset = source.indexOf(`data-vpk-id=${quote}${blockId}${quote}`);
		if (offset >= 0) return source.slice(0, offset).split("\n").length;
	}
	return null;
}

// The decision blocks of an artifact as reviewMarkdown/tasks info.
export function decisionInfoFromDom(document, index) {
	const info = new Map();
	for (const fieldset of document.querySelectorAll("fieldset.vpk-decision[data-vpk-decision]")) {
		const key = fieldset.getAttribute("data-vpk-decision");
		if (info.has(key)) continue;
		const block = fieldset.closest("[data-vpk-id]");
		const blockId = block ? block.getAttribute("data-vpk-id") : null;
		const legend = fieldset.querySelector("legend");
		const options = {};
		for (const control of fieldset.querySelectorAll("input, option")) {
			if (control.localName === "option") options[control.getAttribute("value") ?? control.textContent] = normalizeWhitespace(control.textContent);
			else {
				const label = control.closest("label");
				if (!label) continue;
				const copy = label.cloneNode(true);
				for (const small of copy.querySelectorAll("small, [data-vpk-generated]")) small.remove();
				options[control.getAttribute("value") || "on"] = normalizeWhitespace(copy.textContent);
			}
		}
		const range = blockId ? index.blocks.get(blockId) : null;
		const heading = range ? headingPathFor(index, range.start).slice(-1) : [];
		info.set(key, { blockId, headingPath: heading, question: legend ? normalizeWhitespace(legend.textContent) : key, options, start: range ? range.start : undefined });
	}
	return info;
}

// The --review result: { markdown, tasks } for a merged review against the artifact source.
// `browser` (--browser, M2): Map commentId -> { status, blockId } resolved in Chromium; those statuses
// replace the static ones (the static pass still supplies offsets, lines and changed text).
export function buildReviewTasks(review, artifactHtml, { artifact = "artifact.html", includeResolved = false, now = nowIso(), browser = null } = {}) {
	const document = parseDocument(artifactHtml);
	const index = buildTextIndex(document.querySelector("main") || document.body);
	const { registry } = readRegistry(artifactHtml);
	const addressed = addressedIndex(registry);
	const currentRevision = readMetaContent(artifactHtml, "vpk-doc-revision") || review.doc.revision;
	const resolutions = new Map();
	for (const { root } of threadsFrom(review).threads) {
		if (root.deleted) continue;
		const fixed = root.anchor ? resolveAnchor(index, root.anchor) : { status: "exact", start: null, end: null, blockId: null };
		const live = browser && root.anchor ? browser.get(root.id) : null;
		const result = live ? { ...fixed, status: live.status, blockId: live.blockId || fixed.blockId || null } : fixed;
		const located = !["orphaned", "runtime"].includes(result.status);
		resolutions.set(root.id, {
			...result,
			line: located ? lineOf(artifactHtml, result.blockId) : null,
			// Level-aware (the runtime's headingPathFor pops sibling and deeper headings), so an h3
			// reads "h1 > h2 > h3", never two sibling h3s (G2.19 J1).
			headingPath: root.anchor ? (typeof result.start === "number" ? headingPathFor(index, result.start) : root.anchor.headingPath || []) : [],
			blockTag: root.anchor ? root.anchor.blockTag : undefined,
		});
	}
	const decisions = decisionInfoFromDom(document, index);
	const markdown = reviewMarkdown(review, { mode: "tasks", registry, currentRevision, resolutions, decisions, includeResolved, artifact, now });
	const reviewers = new Map(review.reviewers.map(reviewer => [reviewer.id, reviewer]));
	const who = id => {
		const reviewer = reviewers.get(id) || { id, name: "Unknown reviewer", initials: "?" };
		return { id: reviewer.id, name: reviewer.name, initials: reviewer.initials };
	};
	const counts = { open: 0, addressed: 0, resolved: 0, orphaned: 0, runtime: 0, decisions: 0, layout: 0 };
	const tasks = [];
	let n = 0;
	const byKey = new Map();
	for (const decision of review.decisions) {
		if (!byKey.has(decision.key)) byKey.set(decision.key, []);
		byKey.get(decision.key).push(decision);
	}
	const keys = [...byKey.keys()].sort((a, b) => ((decisions.get(a) || {}).start ?? Infinity) - ((decisions.get(b) || {}).start ?? Infinity) || (a < b ? -1 : 1));
	for (const key of keys) {
		const entry = decisions.get(key) || {};
		const answers = byKey.get(key);
		counts.decisions++;
		tasks.push({ n: ++n, type: "decision", key, blockId: entry.blockId ?? null, question: entry.question || answers[0].question || key, answers: answers.map(answer => ({ reviewerId: answer.reviewerId, value: answer.value, defaultValue: answer.defaultValue, changed: answer.changed, seen: answer.seen })) });
	}
	const group = root => {
		const resolution = resolutions.get(root.id) || {};
		if (root.kind === "doc" || !root.anchor) return [0, 0];
		if (resolution.status === "orphaned") return [3, 0];
		if (typeof resolution.start === "number") return [1, resolution.start];
		return [2, 0];
	};
	const threads = threadsFrom(review).threads.map((thread, position) => ({ thread, position, group: group(thread.root) }))
		.sort((a, b) => a.group[0] - b.group[0] || a.group[1] - b.group[1] || a.position - b.position);
	const openIds = [];
	for (const { thread } of threads) {
		const root = thread.root;
		if (root.deleted) continue;
		const status = commentStatus(root, addressed);
		if (status === "resolved" && !includeResolved) {
			counts.resolved++;
			continue;
		}
		const resolution = resolutions.get(root.id) || { status: "exact", blockId: null };
		counts[status]++;
		if (resolution.status === "orphaned") counts.orphaned++;
		if (resolution.status === "runtime") counts.runtime++;
		if (status === "open") openIds.push(root.id);
		if (root.kind === "layout" && root.layout) {
			counts.layout++;
			tasks.push({ n: ++n, type: "layout", commentId: root.id, rule: root.layout.rule, blockId: resolution.blockId ?? null, line: resolution.line ?? null, viewportWidth: root.layout.viewportWidth, ...(root.layout.overflowPx === undefined ? {} : { overflowPx: root.layout.overflowPx }) });
			continue;
		}
		tasks.push({
			n: ++n,
			type: "comment",
			commentId: root.id,
			status,
			anchorStatus: resolution.status,
			blockId: resolution.blockId ?? null,
			line: resolution.line ?? null,
			headingPath: resolution.headingPath || [],
			quote: root.anchor && root.anchor.quote ? root.anchor.quote.exact : null,
			body: root.body,
			author: who(root.authorId),
			replies: thread.replies.map(reply => ({ id: reply.id, author: who(reply.authorId), body: reply.body, createdAt: reply.createdAt })),
			createdAt: root.createdAt,
		});
	}
	const reviewedRevisions = [...new Set(review.comments.filter(comment => !comment.deleted).map(comment => comment.revision))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
	const json = {
		schema: "vpk-review-tasks/1",
		doc: { id: review.doc.id, title: review.doc.title, reviewedRevisions, currentRevision, artifact },
		reviewers: review.reviewers,
		counts,
		tasks,
		stampCommand: taskCommand({ artifact, addresses: openIds }),
	};
	return { markdown, tasks: json };
}

// Every CLI write goes through here, so ledgers, lite variants and --out targets are guarded too.
function write(file, text) {
	if (isTemplatePath(file)) throw new ReviewError(`refusing to write a template (${rel(file)}): templates never carry review markup`, 4);
	try {
		fs.writeFileSync(file, text);
	} catch (error) {
		throw new ReviewError(`cannot write ${file}: ${error.code || error.message}${error.code === "EPERM" ? " (writes under .agents/skills need an unsandboxed shell)" : ""}`, 1);
	}
}

function litePathFor(file) {
	return file.replace(/\.html?$/i, "") + ".lite.html";
}

function syncLite(file, html, ledger, io, forceDoc) {
	const lite = litePathFor(file);
	if (lite === file || !fs.existsSync(lite)) return false;
	const synced = syncLiteVariant(html, readText(lite), { ledger, forceDoc });
	write(lite, synced.html);
	io.out(`  lite variant synced (${path.basename(lite)})`);
	return true;
}

// Paths under the working directory print relative; anything outside prints absolute.
function rel(file) {
	const absolute = path.resolve(file);
	const relative = path.relative(process.cwd(), absolute);
	return !relative ? file : relative.startsWith("..") || path.isAbsolute(relative) ? absolute : relative;
}

function warnWeight(html, file, io) {
	for (const warning of weightWarnings(html, { label: rel(file) })) io.err(`warn ${warning}`);
}

function ledgerTarget(file, flags) {
	if (flags["no-ledger"]) return null;
	return flags.ledger ? path.resolve(flags.ledger) : ledgerPathFor(path.resolve(file));
}

function injectOne(file, flags, io) {
	const html = readText(file);
	const ledgerFile = ledgerTarget(file, flags);
	const ledger = ledgerFile ? readLedgerFile(ledgerFile) : null;
	const stamped = stampDocument(html, { ledger, seed: flags.seed, seedScope: path.basename(file), newDocId: flags["new-doc-id"] === true, forceDoc: flags["force-doc"] === true, reviewable: true, timestamp: io.now() });
	const out = injectReviewRuntime(stamped.html);
	if (out !== html) write(file, out);
	if (ledgerFile) write(ledgerFile, serializeLedger(stamped.ledger));
	const minted = stamped.stats.minted || 0;
	io.out(`✓ reviewable ${rel(file)} · doc ${stamped.docId} · ${stamped.stats.blocks} blocks (${minted} new) · ${stamped.revision} · runtime ${runtimeBytes().toLocaleString("en-US")} B${hasDecisionBlocks(out) ? " · decisions styled" : ""}${out === html ? " · unchanged" : ""}`);
	syncLite(path.resolve(file), out, stamped.ledger, io, flags["force-doc"] === true);
	const url = localPageUrl(file);
	if (url) io.out(`  open in VPK (dev): ${url}`);
	warnWeight(out, file, io);
}

function stampOne(file, args, io) {
	const flags = args.flags;
	const html = readText(file);
	const ledgerFile = ledgerTarget(file, flags);
	let ledger = null;
	if (flags.from) {
		const from = path.resolve(flags.from);
		ledger = /\.json$/i.test(from) ? readLedgerFile(from) : ledgerFromHtml(readText(from));
		if (!ledger) throw new ReviewError(`--from: ${flags.from} not found`, 1);
	} else if (ledgerFile) ledger = readLedgerFile(ledgerFile);
	if (!ledger) io.err("warn no ledger found: ids are kept and minted, but changes cannot be marked (pass --from <previous.html> or keep the .vpk-blocks.json next to the file)");
	const docId = readMetaContent(html, "vpk-doc-id") || (ledger ? ledger.docId : null);
	const addresses = collectAddresses(args.addresses, docId, { forceDoc: flags["force-doc"] === true });
	const most = reviewLimits().addresses;
	if (addresses.length > most) io.err(`warn ${addresses.length - most} of ${addresses.length} addressed comments not recorded: one revision lists at most ${most} (pass the rest as ids to the next --stamp)`);
	const reviewable = ledger ? ledger.reviewable || hasReviewRuntime(html) : hasReviewRuntime(html);
	const stamped = stampDocument(html, { ledger, seed: flags.seed, seedScope: path.basename(file), label: flags["revision-label"], summary: flags.summary, addresses, revision: flags["no-revision"] !== true, forceDoc: flags["force-doc"] === true, reviewable, timestamp: io.now() });
	let out = stamped.html;
	if (reviewable) out = injectReviewRuntime(out);
	if (out !== html) write(file, out);
	if (ledgerFile) write(ledgerFile, serializeLedger(stamped.ledger));
	const stats = stamped.stats;
	const parts = [`✓ stamped ${stats.blocks} blocks (${stats.minted || 0} new, ${stats.reided || 0} re-ided)`];
	if (stamped.entry) parts.push(`${stamped.entry.id}: ${stamped.entry.changed} changed, ${stamped.entry.added} added, ${stamped.entry.removed.length} removed${stamped.entry.contentChanged ? ", content data changed" : ""}`);
	else parts.push(`no changes (${stamped.revision})`);
	if (addresses.length) parts.push(`addresses ${addresses.length} comment${addresses.length === 1 ? "" : "s"}`);
	if (reviewable) parts.push("runtime refreshed");
	io.out(parts.join(" · "));
	syncLite(path.resolve(file), out, stamped.ledger, io, flags["force-doc"] === true);
	warnWeight(out, file, io);
}

async function reviewCommand(args, io) {
	if (args.files.length < 2) throw new ReviewError("--review needs at least one review file and the artifact (last)", 1);
	const artifactFile = args.files[args.files.length - 1];
	const artifactHtml = readText(artifactFile);
	const docId = readMetaContent(artifactHtml, "vpk-doc-id");
	if (!isDocId(docId)) throw new ReviewError(`${artifactFile} has no vpk-doc-id meta (run --inject-review first)`, 2);
	const forceDoc = args.flags["force-doc"] === true;
	const reviews = [];
	for (const input of args.files.slice(0, -1)) {
		const { review, issues } = readReviewInput(input, docId, { forceDoc });
		for (const issue of issues) io.err(`warn ${input}: ${issue}`);
		reviews.push(review);
	}
	const { review: merged, dropped } = mergeReviewsReport([createEmptyReview({ docId, revision: readMetaContent(artifactHtml, "vpk-doc-revision") || "r1", title: "" }), ...reviews], { docId });
	for (const line of capIssues(dropped, "left out of the tasks (the newest)")) io.err(`warn ${line}; split the review files into separate --review runs`);
	if (!merged.doc.title) merged.doc.title = (/<title>([^<]*)<\/title>/i.exec(artifactHtml) || [])[1] || docId;
	// --browser: statuses come from the live DOM in Chromium (runtime-rendered anchors read exact).
	const browser = args.flags.browser ? await resolveInBrowser(path.resolve(artifactFile), merged, { launch: io.launch }) : null;
	const { markdown, tasks } = buildReviewTasks(merged, artifactHtml, { artifact: rel(artifactFile), includeResolved: args.flags["include-resolved"] === true, now: io.now(), browser });
	const text = args.flags.format === "json" ? `${JSON.stringify(tasks, null, "\t")}\n` : markdown;
	if (args.flags.out) {
		write(args.flags.out, text);
		io.out(`✓ ${tasks.tasks.length} tasks → ${rel(args.flags.out)}`);
	} else io.raw(text);
}

function embedCommand(args, io) {
	if (args.files.length < 2) throw new ReviewError("--embed-review needs at least one review file and the artifact (last)", 1);
	const file = args.files[args.files.length - 1];
	const html = readText(file);
	const docId = readMetaContent(html, "vpk-doc-id");
	if (!isDocId(docId)) throw new ReviewError(`${file} has no vpk-doc-id meta (run --inject-review first)`, 2);
	const forceDoc = args.flags["force-doc"] === true;
	const reviews = args.files.slice(0, -1).map(input => readReviewInput(input, docId, { forceDoc }).review);
	let existing = null;
	try {
		existing = readIslandJson(html);
	} catch (error) {
		throw new ReviewError(`${file}: embedded review: ${error.message}`, 2);
	}
	if (existing) {
		const normalized = normalizeReview(existing, { docId, cap: false });
		if (normalized.review) reviews.unshift(normalized.review);
	}
	// The caps (comments, decision answers, reviewers) refuse the embed rather than
	// drop records, the file's own embedded ones included (B2 decision 10a).
	const { review: merged, dropped } = mergeReviewsReport(reviews, { docId });
	const over = capIssues(dropped, "would not fit");
	if (over.length) throw new ReviewError(`${rel(file)}: ${over.join("; ")}; nothing written`, 2);
	merged.doc.revision = readMetaContent(html, "vpk-doc-revision") || merged.doc.revision;
	const out = setEmbeddedReviewText(html, merged);
	if (out !== html) write(file, out);
	io.out(`✓ embedded ${merged.comments.length} comments from ${merged.reviewers.length} reviewers into ${rel(file)}${out === html ? " (unchanged)" : ""}`);
}

function stripCommand(args, io) {
	const file = args.files[0];
	if (!file || args.files.length > 1) throw new ReviewError("--strip-review takes one file", 1);
	const html = readText(file);
	let out = removeReviewRuntime(html, { all: args.flags.all === true });
	if (args.flags.all) out = stripReviewAttributes(out);
	const target = args.flags.out ? path.resolve(args.flags.out) : path.resolve(file);
	if (args.flags.out && isTemplatePath(target)) throw new ReviewError("refusing to write a template (assets/templates/**)", 4);
	write(target, out);
	io.out(`✓ ${args.flags.all ? "removed all review markup" : "removed the review runtime and embedded comments"} → ${rel(target)}`);
}

/**
 * Runs one review command. argv starts at (or contains) the command token. Returns the exit code.
 * io: { out(line), err(line), raw(text), now() } (defaults print to the console).
 */
export async function runReviewCli(argv, io = {}) {
	const streams = {
		out: io.out || (line => console.log(line)),
		err: io.err || (line => console.error(line)),
		raw: io.raw || (text => process.stdout.write(text)),
		now: io.now || (() => nowIso()),
		launch: io.launch,
	};
	try {
		const args = parseReviewArgs(argv);
		if (!args.files.length) throw new ReviewError(`${args.command} needs a file`, 1);
		const targets = !WRITING_COMMANDS.has(args.command) ? [] : args.command === "--inject-review" || args.command === "--strip-review" ? [...args.files] : args.command === "--stamp" ? [args.files[0]] : [args.files[args.files.length - 1]];
		for (const flag of ["ledger", "out"]) if (typeof args.flags[flag] === "string") targets.push(args.flags[flag]);
		for (const target of targets) if (isTemplatePath(target)) throw new ReviewError(`refusing to write a template (${rel(target)}): templates never carry review markup`, 4);
		if (args.command === "--inject-review") for (const file of args.files) injectOne(file, args.flags, streams);
		else if (args.command === "--stamp") {
			if (args.files.length > 1) throw new ReviewError("--stamp takes one artifact (pass review files with --addresses)", 1);
			stampOne(args.files[0], args, streams);
		} else if (args.command === "--review") await reviewCommand(args, streams);
		else if (args.command === "--embed-review") embedCommand(args, streams);
		else stripCommand(args, streams);
		return 0;
	} catch (error) {
		const code = error instanceof ReviewError ? error.exitCode : 1;
		streams.err(`✗ ${error.message}`);
		return code;
	}
}
