/*
 * review/schema: the executable schema for vpk-review/1 and vpk-revisions/1
 * (ws1 contracts C2-C4). There is no JSON Schema file (ws1 section 3): these
 * normalizers are the schema, and review-loop.md prints the types.
 *
 * normalizeReview fails open per record: a bad reviewer, comment or decision is
 * dropped with an issue string, and only a schema or doc-id mismatch rejects
 * the whole review (CLI exit 2 and 3).
 *
 * Serialized module (ws1 4.6): named function imports and export function
 * declarations only, no module-level state, plain ASCII.
 */

import { fnv1a32, mulberry32, normalizeWhitespace } from "./text.mjs";
import { scanSecrets } from "../secret-scan.mjs";

export function reviewSchemaId() {
	return "vpk-review/1";
}

export function reviewLimits() {
	return {
		reviewers: 64,
		comments: 2000,
		decisions: 200,
		extBytes: 16384,
		name: 60,
		initials: 3,
		title: 300,
		sourceName: 260,
		body: 8000,
		quote: 2000,
		quoteContext: 32,
		blockText: 160,
		cssPath: 400,
		nodePath: 64,
		headingPath: 3,
		headingText: 160,
		sectionId: 128,
		question: 300,
		decisionValues: 50,
		decisionValue: 2000,
		layoutRule: 80,
		label: 80,
		summary: 400,
		addresses: 500,
		registryEntries: 20,
		removed: 50,
		removedExcerpt: 120,
		storageBytes: 1572864,
	};
}

// A float source in [0, 1): seeded (mulberry32 over fnv1a32(seed)) when a seed is
// given, otherwise crypto.getRandomValues, otherwise Math.random.
export function createRandom(seed) {
	if (seed !== undefined && seed !== null && seed !== "") return mulberry32(fnv1a32(String(seed)));
	const cryptoApi = globalThis.crypto;
	if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
		return function next() {
			const buffer = new Uint32Array(1);
			cryptoApi.getRandomValues(buffer);
			return buffer[0] / 4294967296;
		};
	}
	return Math.random;
}

// Comment ids are c_<time36>_<random>; reviewer ids u_<random>; request ids q_<random>.
export function createId(kind, options = {}) {
	const random = typeof options.random === "function" ? options.random : createRandom();
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	const pick = (length) => {
		let out = "";
		for (let index = 0; index < length; index++) out += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
		return out;
	};
	if (kind === "c" || kind === "comment") {
		const now = Number.isFinite(options.now) ? options.now : Date.now();
		const stamp = Math.max(0, Math.floor(now)).toString(36).padStart(4, "0").slice(-12);
		return "c_" + stamp + "_" + pick(8);
	}
	if (kind === "u" || kind === "reviewer") return "u_" + pick(10);
	if (kind === "q" || kind === "request") return "q_" + pick(10);
	throw new TypeError("createId: unknown id kind " + String(kind));
}

// Stamp-minted block id: [a-z][a-z0-9]{5}, unique against `taken` (a Set) when given.
export function createBlockId(random, taken) {
	const next = typeof random === "function" ? random : createRandom();
	const letters = "abcdefghijklmnopqrstuvwxyz";
	const alphabet = letters + "0123456789";
	for (let attempt = 0; attempt < 10000; attempt++) {
		let id = letters[Math.floor(next() * letters.length) % letters.length];
		for (let index = 0; index < 5; index++) id += alphabet[Math.floor(next() * alphabet.length) % alphabet.length];
		if (!taken || !taken.has(id)) return id;
	}
	throw new Error("createBlockId: could not find a free id");
}

// Document id: 12 characters of [a-z0-9], minted once by --inject-review.
export function createDocId(random) {
	const next = typeof random === "function" ? random : createRandom();
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	let id = "";
	for (let index = 0; index < 12; index++) id += alphabet[Math.floor(next() * alphabet.length) % alphabet.length];
	return id;
}

export function isDocId(value) {
	return typeof value === "string" && /^[a-z0-9]{8,32}$/.test(value);
}

// Widened grammar (R17): stamp-minted ids, IR-derived ids (x-post:p3, posts.p3,
// xtpost3) and the reserved virtual sub-part form fig:<id>/part:<part>.
export function isBlockId(value) {
	return typeof value === "string" && /^[a-z][a-z0-9:._/-]{1,63}$/.test(value);
}

export function isCommentId(value) {
	return typeof value === "string" && /^c_[a-z0-9]{4,12}_[a-z0-9]{4,12}$/.test(value);
}

export function isReviewerId(value) {
	return typeof value === "string" && /^u_[a-z0-9]{6,16}$/.test(value);
}

export function isRevisionId(value) {
	return typeof value === "string" && /^r[1-9][0-9]{0,5}$/.test(value);
}

export function isRequestId(value) {
	return typeof value === "string" && /^q_[a-z0-9]{6,16}$/.test(value);
}

export function isIsoTimestamp(value) {
	return typeof value === "string"
		&& /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/.test(value)
		&& !Number.isNaN(Date.parse(value));
}

export function nowIso() {
	return new Date().toISOString();
}

export function createEmptyReview(options = {}) {
	return {
		schema: reviewSchemaId(),
		doc: {
			id: String(options.docId ?? ""),
			revision: isRevisionId(options.revision) ? options.revision : "r1",
			title: normalizeWhitespace(options.title ?? "").slice(0, reviewLimits().title),
		},
		reviewers: [],
		comments: [],
		decisions: [],
	};
}

// Default initials: first and last word initials, or the first character of a single word.
export function initialsFor(name) {
	const words = normalizeWhitespace(name).split(" ").filter(Boolean);
	if (words.length === 0) return "?";
	const first = Array.from(words[0])[0] || "?";
	if (words.length === 1) return first.toUpperCase();
	const last = Array.from(words[words.length - 1])[0] || "";
	return (first + last).toUpperCase();
}

// Display tone 0-5 (grayscale-safe; ws1 4.7).
export function toneFor(id) {
	return fnv1a32(String(id ?? "")) % 6;
}

export function normalizeReviewer(raw, issues = [], label = "reviewer") {
	const limits = reviewLimits();
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		issues.push(label + ": not an object");
		return null;
	}
	if (!isReviewerId(raw.id)) {
		issues.push(label + ": invalid id");
		return null;
	}
	let name = normalizeWhitespace(typeof raw.name === "string" ? raw.name : "");
	if (!name) {
		issues.push(label + " " + raw.id + ": missing name");
		return null;
	}
	if (name.length > limits.name) {
		issues.push(label + " " + raw.id + ": name truncated to " + limits.name + " characters");
		name = name.slice(0, limits.name).trim();
	}
	let initials = (typeof raw.initials === "string" ? raw.initials : "").replace(/\s+/g, "");
	if (!initials) initials = initialsFor(name);
	const initialChars = Array.from(initials);
	if (initialChars.length > limits.initials) {
		issues.push(label + " " + raw.id + ": initials truncated to " + limits.initials + " characters");
		initials = initialChars.slice(0, limits.initials).join("");
	}
	let tone = raw.tone;
	if (!(Number.isInteger(tone) && tone >= 0 && tone <= 5)) {
		if (tone !== undefined) issues.push(label + " " + raw.id + ": invalid tone");
		tone = toneFor(raw.id);
	}
	let updatedAt = raw.updatedAt;
	if (!isIsoTimestamp(updatedAt)) {
		if (updatedAt !== undefined) issues.push(label + " " + raw.id + ": invalid updatedAt");
		updatedAt = "1970-01-01T00:00:00.000Z";
	}
	return { id: raw.id, name, initials, tone, updatedAt };
}

export function normalizeAnchor(raw, issues = [], label = "anchor") {
	const limits = reviewLimits();
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== "object" || Array.isArray(raw)) {
		issues.push(label + ": not an object");
		return null;
	}
	const isCount = (value) => Number.isInteger(value) && value >= 0;
	const point = (value) => {
		if (!value || typeof value !== "object" || !Array.isArray(value.path) || !isCount(value.offset)) return null;
		if (value.path.length > limits.nodePath || !value.path.every(isCount)) return null;
		return { path: value.path.slice(), offset: value.offset };
	};
	const anchor = { blockId: null };
	if (raw.blockId !== null && raw.blockId !== undefined) {
		if (isBlockId(raw.blockId)) anchor.blockId = raw.blockId;
		else issues.push(label + ": invalid blockId");
	}
	if (raw.endBlockId !== undefined && raw.endBlockId !== null) {
		if (isBlockId(raw.endBlockId)) anchor.endBlockId = raw.endBlockId;
		else issues.push(label + ": invalid endBlockId");
	}
	if (raw.blockTag !== undefined) {
		if (typeof raw.blockTag === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(raw.blockTag)) anchor.blockTag = raw.blockTag;
		else issues.push(label + ": invalid blockTag");
	}
	if (raw.blockHash !== undefined) {
		if (typeof raw.blockHash === "string" && /^[a-z0-9]{1,16}$/.test(raw.blockHash)) anchor.blockHash = raw.blockHash;
		else issues.push(label + ": invalid blockHash");
	}
	if (raw.blockText !== undefined) {
		if (typeof raw.blockText === "string") {
			anchor.blockText = raw.blockText.length > limits.blockText ? raw.blockText.slice(0, limits.blockText) : raw.blockText;
			if (raw.blockText.length > limits.blockText) issues.push(label + ": blockText truncated");
		} else issues.push(label + ": invalid blockText");
	}
	if (raw.quote !== undefined && raw.quote !== null) {
		const quote = raw.quote;
		if (!quote || typeof quote !== "object" || typeof quote.exact !== "string" || quote.exact.length === 0) {
			issues.push(label + ": invalid quote");
		} else if (quote.exact.length > limits.quote) {
			issues.push(label + ": quote longer than " + limits.quote + " characters dropped");
		} else {
			const prefix = typeof quote.prefix === "string" ? quote.prefix : "";
			const suffix = typeof quote.suffix === "string" ? quote.suffix : "";
			anchor.quote = {
				exact: quote.exact,
				prefix: prefix.length > limits.quoteContext ? prefix.slice(-limits.quoteContext) : prefix,
				suffix: suffix.length > limits.quoteContext ? suffix.slice(0, limits.quoteContext) : suffix,
			};
		}
	}
	if (raw.position !== undefined && raw.position !== null) {
		const position = raw.position;
		if (position && isCount(position.start) && isCount(position.end) && position.end >= position.start) {
			anchor.position = { start: position.start, end: position.end };
		} else issues.push(label + ": invalid position");
	}
	if (raw.css !== undefined && raw.css !== null) {
		const css = raw.css;
		const start = css && point(css.start);
		const end = css && point(css.end);
		if (css && typeof css.path === "string" && css.path.length > 0 && css.path.length <= limits.cssPath && start && end) {
			anchor.css = { path: css.path, start, end };
		} else issues.push(label + ": invalid css path");
	}
	if (raw.headingPath !== undefined) {
		if (Array.isArray(raw.headingPath) && raw.headingPath.every((entry) => typeof entry === "string")) {
			anchor.headingPath = raw.headingPath
				.map((entry) => normalizeWhitespace(entry).slice(0, limits.headingText))
				.filter(Boolean)
				.slice(-limits.headingPath);
		} else issues.push(label + ": invalid headingPath");
	}
	if (raw.sectionId !== undefined && raw.sectionId !== null) {
		if (typeof raw.sectionId === "string" && raw.sectionId.length > 0 && raw.sectionId.length <= limits.sectionId && !/\s/.test(raw.sectionId)) anchor.sectionId = raw.sectionId;
		else issues.push(label + ": invalid sectionId");
	}
	if (!anchor.blockId && !anchor.quote && !anchor.css) {
		issues.push(label + ": no block id, quote or css path");
		return null;
	}
	return anchor;
}

export function normalizeComment(raw, issues = [], label = "comment") {
	const limits = reviewLimits();
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		issues.push(label + ": not an object");
		return null;
	}
	if (!isCommentId(raw.id)) {
		issues.push(label + ": invalid id");
		return null;
	}
	const named = label + " " + raw.id;
	const parentId = raw.parentId === undefined || raw.parentId === null ? null : raw.parentId;
	if (parentId !== null && (!isCommentId(parentId) || parentId === raw.id)) {
		issues.push(named + ": invalid parentId");
		return null;
	}
	if (!["text", "block", "decision", "layout", "doc"].includes(raw.kind)) {
		issues.push(named + ": invalid kind");
		return null;
	}
	if (!isReviewerId(raw.authorId)) {
		issues.push(named + ": invalid authorId");
		return null;
	}
	if (!isIsoTimestamp(raw.createdAt)) {
		issues.push(named + ": invalid createdAt");
		return null;
	}
	if (!isRevisionId(raw.revision)) {
		issues.push(named + ": invalid revision");
		return null;
	}
	if (typeof raw.body !== "string") {
		issues.push(named + ": body is not a string");
		return null;
	}
	let body = raw.body;
	if (body.length > limits.body) {
		issues.push(named + ": body truncated to " + limits.body + " characters");
		body = body.slice(0, limits.body);
	}
	const comment = {
		id: raw.id,
		parentId,
		kind: raw.kind,
		authorId: raw.authorId,
		createdAt: raw.createdAt,
		revision: raw.revision,
		body,
		bodyAt: isIsoTimestamp(raw.bodyAt) ? raw.bodyAt : raw.createdAt,
		status: "open",
	};
	if (raw.bodyAt !== undefined && !isIsoTimestamp(raw.bodyAt)) issues.push(named + ": invalid bodyAt");
	if (raw.status === "open" || raw.status === "resolved") comment.status = raw.status;
	else if (raw.status !== undefined) issues.push(named + ": invalid status");
	if (raw.statusAt !== undefined) {
		if (isIsoTimestamp(raw.statusAt)) comment.statusAt = raw.statusAt;
		else issues.push(named + ": invalid statusAt");
	}
	if (raw.statusBy !== undefined) {
		if (isReviewerId(raw.statusBy)) comment.statusBy = raw.statusBy;
		else issues.push(named + ": invalid statusBy");
	}
	comment.deleted = raw.deleted === true;
	if (raw.deleted !== undefined && typeof raw.deleted !== "boolean") issues.push(named + ": invalid deleted flag");
	if (raw.deletedAt !== undefined) {
		if (isIsoTimestamp(raw.deletedAt)) comment.deletedAt = raw.deletedAt;
		else issues.push(named + ": invalid deletedAt");
	}
	comment.anchor = normalizeAnchor(raw.anchor, issues, named + " anchor");
	if (raw.anchorAt !== undefined) {
		if (isIsoTimestamp(raw.anchorAt)) comment.anchorAt = raw.anchorAt;
		else issues.push(named + ": invalid anchorAt");
	}
	if (raw.layout !== undefined) {
		const layout = raw.layout;
		if (layout && typeof layout === "object" && typeof layout.rule === "string" && layout.rule && layout.rule.length <= limits.layoutRule && Number.isFinite(layout.viewportWidth) && layout.viewportWidth > 0) {
			const clean = { rule: layout.rule };
			if (layout.axis === "horizontal" || layout.axis === "vertical") clean.axis = layout.axis;
			if (Number.isFinite(layout.overflowPx)) clean.overflowPx = layout.overflowPx;
			clean.viewportWidth = layout.viewportWidth;
			comment.layout = clean;
		} else issues.push(named + ": invalid layout");
	}
	if (raw.decisionKey !== undefined) {
		if (typeof raw.decisionKey === "string" && /^[a-z][a-z0-9-]{0,40}$/.test(raw.decisionKey)) comment.decisionKey = raw.decisionKey;
		else issues.push(named + ": invalid decisionKey");
	}
	if (raw.sentAt !== undefined) {
		if (isIsoTimestamp(raw.sentAt)) comment.sentAt = raw.sentAt;
		else issues.push(named + ": invalid sentAt");
	}
	return comment;
}

export function normalizeDecision(raw, issues = [], label = "decision") {
	const limits = reviewLimits();
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		issues.push(label + ": not an object");
		return null;
	}
	if (typeof raw.key !== "string" || !/^[a-z][a-z0-9-]{0,40}$/.test(raw.key)) {
		issues.push(label + ": invalid key");
		return null;
	}
	if (!isReviewerId(raw.reviewerId)) {
		issues.push(label + " " + raw.key + ": invalid reviewerId");
		return null;
	}
	const named = label + " " + raw.key + "|" + raw.reviewerId;
	const values = (input, field) => {
		if (input === undefined) return [];
		if (!Array.isArray(input) || !input.every((entry) => typeof entry === "string")) {
			issues.push(named + ": invalid " + field);
			return [];
		}
		if (input.length > limits.decisionValues || input.some((entry) => entry.length > limits.decisionValue)) {
			issues.push(named + ": " + field + " truncated");
		}
		return input.slice(0, limits.decisionValues).map((entry) => entry.slice(0, limits.decisionValue));
	};
	let question = normalizeWhitespace(typeof raw.question === "string" ? raw.question : "");
	if (question.length > limits.question) {
		issues.push(named + ": question truncated");
		question = question.slice(0, limits.question);
	}
	const value = values(raw.value, "value");
	const defaultValue = values(raw.defaultValue, "defaultValue");
	const same = value.length === defaultValue.length && value.every((entry, index) => entry === defaultValue[index]);
	const decision = {
		key: raw.key,
		reviewerId: raw.reviewerId,
		question,
		value,
		defaultValue,
		changed: typeof raw.changed === "boolean" ? raw.changed : !same,
		seen: raw.seen === true,
	};
	if (raw.seenAt !== undefined) {
		if (isIsoTimestamp(raw.seenAt)) decision.seenAt = raw.seenAt;
		else issues.push(named + ": invalid seenAt");
	}
	if (isIsoTimestamp(raw.updatedAt)) decision.updatedAt = raw.updatedAt;
	else {
		issues.push(named + ": invalid updatedAt");
		decision.updatedAt = "1970-01-01T00:00:00.000Z";
	}
	return decision;
}

// vpk-revisions/1 (C4), fail-open per entry: entries sorted by revision number,
// duplicates dropped, capped to the newest 20.
export function normalizeRegistry(raw) {
	const limits = reviewLimits();
	const issues = [];
	const registry = { schema: "vpk-revisions/1", entries: [] };
	if (raw === null || raw === undefined) return { registry, issues, rejected: null };
	if (typeof raw !== "object" || Array.isArray(raw) || raw.schema !== "vpk-revisions/1") {
		issues.push("revisions: unknown schema " + JSON.stringify(raw && raw.schema));
		return { registry, issues, rejected: "schema" };
	}
	const entries = Array.isArray(raw.entries) ? raw.entries : [];
	if (!Array.isArray(raw.entries)) issues.push("revisions: entries is not an array");
	const seen = new Set();
	const clean = [];
	entries.forEach((entry, position) => {
		const named = "revision[" + position + "]";
		if (!entry || typeof entry !== "object" || !isRevisionId(entry.id)) {
			issues.push(named + ": invalid id");
			return;
		}
		if (seen.has(entry.id)) {
			issues.push(named + ": duplicate " + entry.id);
			return;
		}
		if (!isIsoTimestamp(entry.timestamp)) {
			issues.push(named + ": invalid timestamp");
			return;
		}
		seen.add(entry.id);
		const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
		const addresses = Array.isArray(entry.addresses) ? entry.addresses.filter(isCommentId) : [];
		if (Array.isArray(entry.addresses) && addresses.length !== entry.addresses.length) issues.push(named + ": invalid addresses dropped");
		const removed = Array.isArray(entry.removed)
			? entry.removed
				.filter((item) => item && isBlockId(item.id) && typeof item.tag === "string")
				.slice(0, limits.removed)
				.map((item) => ({ id: item.id, tag: item.tag.slice(0, 32), excerpt: String(item.excerpt ?? "").slice(0, limits.removedExcerpt) }))
			: [];
		const out = {
			id: entry.id,
			label: normalizeWhitespace(typeof entry.label === "string" ? entry.label : entry.id).slice(0, limits.label),
			timestamp: entry.timestamp,
		};
		if (typeof entry.summary === "string" && entry.summary.trim()) out.summary = normalizeWhitespace(entry.summary).slice(0, limits.summary);
		out.addresses = [...new Set(addresses)].slice(0, limits.addresses);
		out.changed = count(entry.changed);
		out.added = count(entry.added);
		if (entry.contentChanged === true) out.contentChanged = true;
		out.removed = removed;
		clean.push(out);
	});
	clean.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
	if (clean.length > limits.registryEntries) issues.push("revisions: capped to the newest " + limits.registryEntries + " entries");
	registry.entries = clean.slice(-limits.registryEntries);
	return { registry, issues, rejected: null };
}

// Normalizes a vpk-review/1 value. Returns { review, issues, rejected, capped }
// where rejected is null, "schema" (unknown schema or invalid doc) or "doc" (doc
// id differs from options.docId), and capped maps a field to the records its cap
// left out (also reported in issues). options.cap === false keeps every record
// for callers that merge next: mergeReviewsReport caps by priority and reports.
export function normalizeReview(raw, options = {}) {
	const limits = reviewLimits();
	const issues = [];
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return { review: null, issues: ["review: not an object"], rejected: "schema" };
	}
	if (raw.schema !== reviewSchemaId()) {
		return { review: null, issues: ["review: unknown schema " + JSON.stringify(raw.schema)], rejected: "schema" };
	}
	const doc = raw.doc;
	if (!doc || typeof doc !== "object" || !isDocId(doc.id)) {
		return { review: null, issues: ["review: invalid doc id"], rejected: "schema" };
	}
	if (options.docId && doc.id !== options.docId) {
		return { review: null, issues: ["review: doc id " + doc.id + " does not match " + options.docId], rejected: "doc" };
	}
	let revision = doc.revision;
	if (!isRevisionId(revision)) {
		issues.push("review: invalid doc revision");
		revision = "r1";
	}
	const review = {
		schema: reviewSchemaId(),
		doc: { id: doc.id, revision, title: normalizeWhitespace(typeof doc.title === "string" ? doc.title : "").slice(0, limits.title) },
	};
	if (typeof doc.sourceName === "string" && doc.sourceName) review.doc.sourceName = doc.sourceName.slice(0, limits.sourceName);
	if (raw.exportedAt !== undefined) {
		if (isIsoTimestamp(raw.exportedAt)) review.exportedAt = raw.exportedAt;
		else issues.push("review: invalid exportedAt");
	}
	if (raw.exportedBy !== undefined) {
		if (isReviewerId(raw.exportedBy)) review.exportedBy = raw.exportedBy;
		else issues.push("review: invalid exportedBy");
	}
	const capped = {};
	const collect = (input, field, max, normalize, keyOf) => {
		const out = [];
		const keys = new Set();
		if (input === undefined) return out;
		if (!Array.isArray(input)) {
			issues.push("review: " + field + " is not an array");
			return out;
		}
		input.forEach((entry, position) => {
			const record = normalize(entry, issues, field + "[" + position + "]");
			if (!record) return;
			const key = keyOf(record);
			if (keys.has(key)) {
				issues.push(field + "[" + position + "]: duplicate " + key);
				return;
			}
			keys.add(key);
			out.push(record);
		});
		if (out.length > max && options.cap !== false) {
			issues.push("review: " + field + " capped to " + max + " (" + (out.length - max) + " left out)");
			capped[field] = out.length - max;
			return out.slice(0, max);
		}
		return out;
	};
	review.reviewers = collect(raw.reviewers, "reviewers", limits.reviewers, normalizeReviewer, (record) => record.id);
	review.comments = collect(raw.comments, "comments", limits.comments, normalizeComment, (record) => record.id);
	review.decisions = collect(raw.decisions, "decisions", limits.decisions, normalizeDecision, (record) => record.key + "|" + record.reviewerId);
	if (raw.ext !== undefined) {
		if (raw.ext && typeof raw.ext === "object" && !Array.isArray(raw.ext)) {
			const json = JSON.stringify(raw.ext);
			const bytes = typeof json === "string" ? (typeof TextEncoder === "function" ? new TextEncoder().encode(json).length : json.length) : Infinity;
			if (bytes <= limits.extBytes) review.ext = JSON.parse(json);
			else issues.push("review: ext larger than " + limits.extBytes + " bytes dropped");
		} else issues.push("review: ext is not an object");
	}
	return { review, issues, rejected: null, capped };
}

// The detail of a `vpk:content-rendered` event (R18: { type, ids }): the content
// type that re-rendered and the block ids it re-emitted (C2 grammar, at most
// 2,000). Anything else yields { type: null, ids: [] }, which still re-indexes.
export function normalizeContentRendered(detail) {
	const raw = detail && typeof detail === "object" ? detail : {};
	const type = typeof raw.type === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(raw.type) ? raw.type : null;
	const ids = Array.isArray(raw.ids) ? [...new Set(raw.ids.filter(isBlockId))].slice(0, 2000) : [];
	return { type, ids };
}

// Secret-shaped text in live comment bodies and decision answers (ws6 C7); the
// runtime warns before export and send. Previews never contain the full match.
export function reviewSecretFindings(review) {
	const findings = [];
	for (const comment of (review && review.comments) || []) {
		if (comment.deleted) continue;
		for (const finding of scanSecrets(comment.body)) findings.push({ commentId: comment.id, label: finding.label, preview: finding.preview });
	}
	for (const decision of (review && review.decisions) || []) {
		for (const finding of scanSecrets(decision.value.join("\n"))) findings.push({ decisionKey: decision.key, reviewerId: decision.reviewerId, label: finding.label, preview: finding.preview });
	}
	return findings;
}
