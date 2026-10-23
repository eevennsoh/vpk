/*
 * review/merge: deterministic merging of vpk-review/1 values (ws1 4.13).
 *
 * mergeReviews is pure, commutative, associative and idempotent: every field is
 * an independent join over a total order, so the result never depends on input
 * order or grouping. Inputs are normalized reviews (schema.normalizeReview).
 *   - reviewers: union by id, last-writer-wins by updatedAt;
 *   - comments: union by id; immutable creation fields; per-field LWW registers
 *     (body/bodyAt, status/statusAt/statusBy, deleted/deletedAt, anchor/anchorAt);
 *     sentAt is the maximum; tombstones win ties, so only a newer undelete revives;
 *   - decisions: keyed key|reviewerId, LWW value/updatedAt, monotonic seen;
 *   - ties break on the greater canonical JSON.
 *
 * Serialized module (ws1 4.6): named function imports and export function
 * declarations only, no module-level state, plain ASCII.
 */

import { reviewLimits, reviewSchemaId } from "./schema.mjs";

// JSON with sorted object keys and undefined members dropped.
export function canonicalJson(value) {
	if (Array.isArray(value)) return "[" + value.map((entry) => (entry === undefined ? "null" : canonicalJson(entry))).join(",") + "]";
	if (value && typeof value === "object") {
		const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
		return "{" + keys.map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
	}
	const json = JSON.stringify(value);
	return json === undefined ? "null" : json;
}

// Total order used by every register: time first (missing = oldest), then the
// greater canonical JSON of the register value. True when `a` wins.
export function registerWins(timeA, timeB, valueA, valueB) {
	const parse = (value) => {
		if (typeof value !== "string") return -Infinity;
		const time = Date.parse(value);
		return Number.isNaN(time) ? -Infinity : time;
	};
	const a = parse(timeA);
	const b = parse(timeB);
	if (a !== b) return a > b;
	return canonicalJson(valueA) >= canonicalJson(valueB);
}

export function mergeReviewerRecords(a, b) {
	if (!a) return b ? { ...b } : null;
	if (!b) return { ...a };
	return { ...(registerWins(a.updatedAt, b.updatedAt, a, b) ? a : b) };
}

export function mergeCommentRecords(a, b) {
	if (!a) return b ? mergeCommentRecords(b, b) : null;
	if (!b) return mergeCommentRecords(a, a);
	const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
	const fixed = (record) => [record.id, record.parentId, record.kind, record.authorId, record.createdAt, record.revision, record.layout ?? null, record.decisionKey ?? null];
	const base = registerWins(null, null, fixed(a), fixed(b)) ? a : b;
	const body = registerWins(a.bodyAt, b.bodyAt, [a.body, a.bodyAt], [b.body, b.bodyAt]) ? a : b;
	const status = registerWins(a.statusAt, b.statusAt, [a.status, a.statusAt ?? null, a.statusBy ?? null], [b.status, b.statusAt ?? null, b.statusBy ?? null]) ? a : b;
	const tomb = (record) => [record.deleted ? 1 : 0, record.deletedAt ?? null];
	const deleted = registerWins(a.deletedAt, b.deletedAt, tomb(a), tomb(b)) ? a : b;
	const anchor = registerWins(a.anchorAt, b.anchorAt, [a.anchor ?? null, a.anchorAt ?? null], [b.anchor ?? null, b.anchorAt ?? null]) ? a : b;
	const sent = registerWins(a.sentAt, b.sentAt, a.sentAt ?? null, b.sentAt ?? null) ? a.sentAt : b.sentAt;
	const out = {
		id: base.id,
		parentId: base.parentId,
		kind: base.kind,
		authorId: base.authorId,
		createdAt: base.createdAt,
		revision: base.revision,
		body: body.body,
		bodyAt: body.bodyAt,
		status: status.status,
	};
	if (status.statusAt !== undefined) out.statusAt = status.statusAt;
	if (status.statusBy !== undefined) out.statusBy = status.statusBy;
	out.deleted = deleted.deleted === true;
	if (deleted.deletedAt !== undefined) out.deletedAt = deleted.deletedAt;
	out.anchor = anchor.anchor ? copy(anchor.anchor) : null;
	if (anchor.anchorAt !== undefined) out.anchorAt = anchor.anchorAt;
	if (base.layout !== undefined) out.layout = copy(base.layout);
	if (base.decisionKey !== undefined) out.decisionKey = base.decisionKey;
	if (sent !== undefined) out.sentAt = sent;
	return out;
}

export function mergeDecisionRecords(a, b) {
	if (!a) return b ? mergeDecisionRecords(b, b) : null;
	if (!b) return mergeDecisionRecords(a, a);
	const register = (record) => [record.value, record.defaultValue, record.changed, record.question, record.updatedAt];
	const side = registerWins(a.updatedAt, b.updatedAt, register(a), register(b)) ? a : b;
	const seenTimes = [a, b].filter((record) => record.seen && typeof record.seenAt === "string").map((record) => record.seenAt);
	const out = {
		key: side.key,
		reviewerId: side.reviewerId,
		question: side.question,
		value: side.value.slice(),
		defaultValue: side.defaultValue.slice(),
		changed: side.changed,
		seen: a.seen === true || b.seen === true,
	};
	if (seenTimes.length) out.seenAt = seenTimes.reduce((min, value) => (registerWins(min, value, min, value) ? value : min));
	out.updatedAt = side.updatedAt;
	return out;
}

// Merges normalized reviews for one document. Reviews for other doc ids are
// skipped; without options.docId the smallest doc id present is used.
export function mergeReviews(reviews, options = {}) {
	return mergeReviewsReport(reviews, options).review;
}

// mergeReviews plus what the caps left out: { review, dropped: { comments,
// commentIds, decisions, reviewers, mine, ids } }. Over a cap (comments,
// decisions, reviewers), the records of options.reviewerId (the reader) take
// places first, then the ids in options.keep (the caller's working set: comment
// ids, "key|reviewerId" decision keys, reviewer ids), then the oldest others, so
// an import never evicts a record the reader already has. mine counts the
// reader's records left out; ids lists every record left out.
export function mergeReviewsReport(reviews, options = {}) {
	const limits = reviewLimits();
	const list = (Array.isArray(reviews) ? reviews : [reviews]).filter((review) => review && review.doc && typeof review.doc.id === "string");
	const ids = [...new Set(list.map((review) => review.doc.id))].sort();
	const docId = options.docId || ids[0] || "";
	const inputs = list.filter((review) => review.doc.id === docId);
	const revisionNumber = (value) => Number(String(value || "r0").slice(1)) || 0;
	let doc = null;
	const reviewers = new Map();
	const comments = new Map();
	const decisions = new Map();
	const ext = new Map();
	for (const review of inputs) {
		const candidate = { id: docId, revision: review.doc.revision, title: review.doc.title || "" };
		if (review.doc.sourceName) candidate.sourceName = review.doc.sourceName;
		if (!doc) doc = candidate;
		else {
			const a = revisionNumber(candidate.revision);
			const b = revisionNumber(doc.revision);
			if (a > b || (a === b && canonicalJson(candidate) > canonicalJson(doc))) doc = candidate;
		}
		for (const reviewer of review.reviewers || []) reviewers.set(reviewer.id, mergeReviewerRecords(reviewers.get(reviewer.id), reviewer));
		for (const comment of review.comments || []) comments.set(comment.id, mergeCommentRecords(comments.get(comment.id), comment));
		for (const decision of review.decisions || []) {
			const key = decision.key + "|" + decision.reviewerId;
			decisions.set(key, mergeDecisionRecords(decisions.get(key), decision));
		}
		if (review.ext && typeof review.ext === "object") {
			for (const [key, value] of Object.entries(review.ext)) {
				if (!ext.has(key) || canonicalJson(value) > canonicalJson(ext.get(key))) ext.set(key, value);
			}
		}
	}
	const byTime = (a, b) => {
		const left = Date.parse(a.createdAt);
		const right = Date.parse(b.createdAt);
		if (left !== right) return left < right ? -1 : 1;
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	};
	const me = options.reviewerId;
	const keep = new Set(options.keep || []);
	const cut = [];
	// Over a cap: the reader's records first, then the caller's working set
	// (options.keep), then the rest in order; what does not fit is reported.
	const fit = (records, max, idOf, mine, order, extra) => {
		const sorted = records.slice().sort(order);
		if (sorted.length <= max) return sorted;
		const tier = (record) => (mine(record) ? 0 : keep.has(idOf(record)) || (extra && extra(record)) ? 1 : 2);
		const ranked = sorted.sort((a, b) => tier(a) - tier(b) || order(a, b));
		for (const record of ranked.slice(max)) cut.push({ id: idOf(record), mine: mine(record) && !!me });
		return ranked.slice(0, max).sort(order);
	};
	const keptComments = fit([...comments.values()], limits.comments, (comment) => comment.id, (comment) => comment.authorId === me, byTime);
	const commentIds = cut.map((entry) => entry.id);
	const decisionKey = (decision) => decision.key + "|" + decision.reviewerId;
	const keptDecisions = fit([...decisions.values()], limits.decisions, decisionKey, (decision) => decision.reviewerId === me, (a, b) => (a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.reviewerId < b.reviewerId ? -1 : a.reviewerId > b.reviewerId ? 1 : 0));
	const decisionsCut = cut.length - commentIds.length;
	const authors = new Set([...keptComments.map((comment) => comment.authorId), ...keptDecisions.map((decision) => decision.reviewerId)]);
	const merged = {
		schema: reviewSchemaId(),
		doc: doc || { id: docId, revision: "r1", title: "" },
		reviewers: fit([...reviewers.values()], limits.reviewers, (reviewer) => reviewer.id, (reviewer) => reviewer.id === me, (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0), (reviewer) => authors.has(reviewer.id)),
		comments: keptComments,
		decisions: keptDecisions,
	};
	if (ext.size) {
		merged.ext = {};
		for (const key of [...ext.keys()].sort()) merged.ext[key] = JSON.parse(JSON.stringify(ext.get(key)));
	}
	const mine = cut.filter((entry) => entry.mine).length;
	return { review: merged, dropped: { comments: commentIds.length, commentIds, decisions: decisionsCut, reviewers: cut.length - commentIds.length - decisionsCut, mine, ids: cut.map((entry) => entry.id) } };
}

// One line for records a cap left out, or null. field: comments (default),
// decisions or reviewers.
export function capIssue(count, verb, field) {
	const name = field === "decisions" ? "decision answer" : field === "reviewers" ? "reviewer" : "comment";
	const max = reviewLimits()[field === "decisions" || field === "reviewers" ? field : "comments"];
	return count > 0 ? count + " " + name + (count === 1 ? "" : "s") + " " + (verb || "not loaded") + ": a review holds at most " + max.toLocaleString("en-US") + " " + name + "s" : null;
}

// The capIssue lines for every field of a dropped/left-out count map.
export function capIssues(counts, verb) {
	return ["comments", "decisions", "reviewers"].map((field) => capIssue((counts && counts[field]) || 0, verb, field)).filter(Boolean);
}

// Threads are one level deep: replies attach to the root of their parent chain.
// A reply whose chain reaches a missing comment is "loose" (shown under "Replies
// without a thread") until its root arrives. Deleted records are dropped unless
// options.includeDeleted; a deleted root stays when live replies hang off it.
export function threadsFrom(review, options = {}) {
	const includeDeleted = options.includeDeleted === true;
	const comments = ((review && review.comments) || []).slice();
	const byId = new Map(comments.map((comment) => [comment.id, comment]));
	const byTime = (a, b) => {
		const left = Date.parse(a.createdAt);
		const right = Date.parse(b.createdAt);
		if (left !== right) return left < right ? -1 : 1;
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	};
	comments.sort(byTime);
	const threads = new Map();
	const loose = [];
	for (const comment of comments) if (!comment.parentId) threads.set(comment.id, { root: comment, replies: [] });
	for (const comment of comments) {
		if (!comment.parentId) continue;
		let current = comment;
		const visited = new Set([comment.id]);
		while (current.parentId && byId.has(current.parentId) && !visited.has(current.parentId)) {
			current = byId.get(current.parentId);
			visited.add(current.id);
		}
		if (current.parentId) loose.push(comment);
		else threads.get(current.id).replies.push(comment);
	}
	const out = [];
	for (const thread of threads.values()) {
		const replies = includeDeleted ? thread.replies : thread.replies.filter((reply) => !reply.deleted);
		if (!includeDeleted && thread.root.deleted && replies.length === 0) continue;
		out.push({ root: thread.root, replies });
	}
	return { threads: out, loose: includeDeleted ? loose : loose.filter((reply) => !reply.deleted) };
}

// Map commentId -> { revision, timestamp } of the newest registry entry that
// lists the comment in `addresses`.
export function addressedIndex(registry) {
	const index = new Map();
	for (const entry of (registry && registry.entries) || []) {
		for (const id of entry.addresses || []) {
			const previous = index.get(id);
			if (!previous || Date.parse(entry.timestamp) >= Date.parse(previous.timestamp)) index.set(id, { revision: entry.id, timestamp: entry.timestamp });
		}
	}
	return index;
}

// resolved | addressed | open (ws1 4.11). `addressed` is a registry or an
// addressedIndex() map. A reopen after the addressing revision reads open again.
export function commentStatus(comment, addressed) {
	if (!comment) return "open";
	if (comment.status === "resolved") return "resolved";
	const index = addressed instanceof Map ? addressed : addressedIndex(addressed);
	const hit = index.get(comment.id);
	if (hit && (!comment.statusAt || Date.parse(comment.statusAt) < Date.parse(hit.timestamp))) return "addressed";
	return "open";
}

// The "mine" scope of Save reviewed copy and Download: only the reviewer's own
// comments (roots and replies), decisions and reviewer record.
export function filterOwn(review, reviewerId) {
	const out = { schema: review.schema, doc: { ...review.doc } };
	if (review.exportedAt !== undefined) out.exportedAt = review.exportedAt;
	if (review.exportedBy !== undefined) out.exportedBy = review.exportedBy;
	out.reviewers = (review.reviewers || []).filter((reviewer) => reviewer.id === reviewerId).map((reviewer) => ({ ...reviewer }));
	out.comments = (review.comments || []).filter((comment) => comment.authorId === reviewerId).map((comment) => JSON.parse(JSON.stringify(comment)));
	out.decisions = (review.decisions || []).filter((decision) => decision.reviewerId === reviewerId).map((decision) => JSON.parse(JSON.stringify(decision)));
	if (review.ext !== undefined) out.ext = JSON.parse(JSON.stringify(review.ext));
	return out;
}
