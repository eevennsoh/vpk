#!/usr/bin/env node
/*
 * content-ir: contract sidecar, content schemas, fact coverage and content islands (ws6 §5.2,
 * integration K10/R8). A contract plus a coverage check, not a renderer; the coverage
 * algorithm is adapted from kami's content.py (MIT). CLI: build.mjs --check-content.
 * Sidecar <slug>.content.json = { type, lang, brief, content? }; the in-file island
 * <script type="application/json" data-vpk-content="<type>"> holds the same `content`.
 * `type` is a stem of references/schemas/*.json; each schema belongs to its template owner.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findJsonIslands, parseJsonIsland } from "./json-island.mjs";
import { caseStudyContentIssues } from "./lab/render-case-study.mjs";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const ENVELOPE_KEYS = ["type", "lang", "brief", "content"];
const ENGINE_FIGURES = new Set(["iso-kit", "anatomy-hero"]);
const COVERAGE_MAX_CHARS = 80;

function deepFreeze(value) {
	if (value && typeof value === "object") Object.values(value).forEach(deepFreeze);
	return Object.freeze(value);
}

const text = (maxLength, minLength = 1) => ({ type: "string", minLength, maxLength });
const textList = (maxItems, maxLength) => ({ type: "array", maxItems, items: text(maxLength) });
const choice = (...values) => ({ type: "string", enum: values });
const int = (minimum, maximum) => ({ type: "integer", minimum, maximum });
const record = (properties, required = []) => ({ type: "object", additionalProperties: false, required, properties });

export const FIGURE_ENGINE_IDS = Object.freeze(["none", "iso-kit", "anatomy-hero", "both"]);
export const FIGURE_ROOT_ENGINES = Object.freeze(["static", "iso-kit", "anatomy-hero"]);
export const BRIEF_FORMATS = Object.freeze(["html", "pdf", "landing", "github", "artifacts", "gist", "mp4"]);

export const BRIEF_SCHEMA = deepFreeze(record({
	reader_job: record({ quick_read: text(240), deep_audit: text(240) }, ["quick_read", "deep_audit"]),
	template: text(80),
	formats: { type: "array", minItems: 1, maxItems: 7, items: choice(...BRIEF_FORMATS) },
	acceptance_checks: { type: "array", minItems: 1, maxItems: 100, items: text(240) },
	audience: text(240),
	length_target: text(120),
	viewport: record({ width: int(320, 3840), height: int(320, 3000) }, ["width", "height"]),
	size_budget_kb: int(10, 20000),
	figure_engine: choice(...FIGURE_ENGINE_IDS),
	figure_engine_source: choice("user", "default"),
	figures: { type: "array", maxItems: 40, items: record({
		id: { type: "string", pattern: "^[a-z][a-z0-9-]{0,39}$" }, kind: choice("chart", "diagram", "illustration", "explainer", "film", "lab"),
		engine: choice(...FIGURE_ROOT_ENGINES), job: text(240), tier: choice("figure", "hero"),
	}, ["id", "kind", "engine", "job"]) },
	review: record({ runtime: { type: "boolean" } }, ["runtime"]),
	publish: { type: "array", maxItems: 2, items: choice("artifacts", "gist") },
	narrative: text(800),
	required_facts: textList(100, 240), preserve: textList(100, 240), assumptions: textList(100, 240), explicit_deviations: textList(100, 240),
	required_assets: textList(100, 500), evidence: textList(100, 500),
	target: record({ surface: text(240), viewport: text(40), theme: choice("light", "dark"), state: text(240), element: text(240) }),
}, ["reader_job", "template", "formats", "acceptance_checks"]));

// In-file rules beyond the schema, owned by the template's workstream (R8). A hook module
// is required once its template exists; until then the island gets schema checks only.
export const CONTENT_TYPE_HOOKS = deepFreeze({
	"x-thread": { template: "x-thread.html", module: "./x-thread/check.mjs", check: "checkThreadHtml" },
	"motion-case-study": { template: "motion-case-study.html", module: "./lab/render-case-study.mjs", check: "checkCaseStudyHtml" },
});

// Sidecar `content` rules beyond the schema: (content) → [{ severity, path, message }].
export const CONTRACT_HOOKS = Object.freeze({
	document(content) {
		const seen = new Map();
		const findings = [];
		for (const [index, fact] of (Array.isArray(content?.facts) ? content.facts : []).entries()) {
			const label = typeof fact?.label === "string" ? fact.label.trim().toLowerCase() : "";
			if (label && seen.has(label)) findings.push({ severity: "warning", path: `content.facts[${index}].label`, message: `duplicate fact label "${fact.label}" (first at facts[${seen.get(label)}])` });
			else if (label) seen.set(label, index);
		}
		return findings;
	},
	"motion-case-study": caseStudyContentIssues,
});

export const SCHEMA_KEYWORDS = Object.freeze(["type", "enum", "required", "properties", "additionalProperties", "items", "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "pattern", "x-coverage", "$comment", "$schema", "$id", "title", "description"]);

export class ContentUsageError extends Error {}

const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const joinPath = (at, key) => (at ? `${at}.${key}` : String(key));
const finding = (rule, severity, at, message) => ({ rule, severity, path: at, message });
const relPath = file => (file ? path.relative(process.cwd(), file).split(path.sep).join("/") || "." : null);
const typeOf = value => (value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value);
const hasError = items => items.some(item => item.severity === "error");

export function schemaKeywordIssues(schema, at = "$") {
	if (!isPlainObject(schema)) return [`${at}: schema node must be an object`];
	const issues = Object.keys(schema).filter(key => !SCHEMA_KEYWORDS.includes(key)).map(key => `${at}: unsupported schema keyword "${key}"`);
	if (schema["x-coverage"] !== undefined && !["skip", "verbatim"].includes(schema["x-coverage"])) issues.push(`${at}: x-coverage must be "skip" or "verbatim"`);
	for (const [key, child] of Object.entries(isPlainObject(schema.properties) ? schema.properties : {})) issues.push(...schemaKeywordIssues(child, `${at}.properties.${key}`));
	if (schema.items !== undefined) issues.push(...schemaKeywordIssues(schema.items, `${at}.items`));
	if (isPlainObject(schema.additionalProperties)) issues.push(...schemaKeywordIssues(schema.additionalProperties, `${at}.additionalProperties`));
	return issues;
}

export function validateNode(value, schema, at = "") {
	if (!isPlainObject(schema)) return [];
	const label = at || "(root)";
	const errors = [];
	const add = (message, where = label) => errors.push({ path: where, message });
	if (schema.type !== undefined) {
		const types = [].concat(schema.type);
		const actual = typeOf(value);
		if (!types.some(type => type === actual || (type === "number" && actual === "integer"))) return [{ path: label, message: `expected ${types.join(" or ")}, got ${actual}` }];
	}
	if (Array.isArray(schema.enum) && !schema.enum.includes(value)) add(`must be one of: ${schema.enum.join(", ")}`);
	if (typeof value === "string") {
		const length = [...value.trim()].length;
		if (schema.minLength !== undefined && length < schema.minLength) add(`must be at least ${schema.minLength} characters (trimmed)`);
		if (schema.maxLength !== undefined && length > schema.maxLength) add(`must be at most ${schema.maxLength} characters (has ${length})`);
		if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) add(`must match ${schema.pattern}`);
	}
	if (typeof value === "number") {
		if (schema.minimum !== undefined && value < schema.minimum) add(`must be ≥ ${schema.minimum}`);
		if (schema.maximum !== undefined && value > schema.maximum) add(`must be ≤ ${schema.maximum}`);
	}
	if (Array.isArray(value)) {
		if (schema.minItems !== undefined && value.length < schema.minItems) add(`must have at least ${schema.minItems} items`);
		if (schema.maxItems !== undefined && value.length > schema.maxItems) add(`must have at most ${schema.maxItems} items`);
		if (schema.items) value.forEach((item, index) => errors.push(...validateNode(item, schema.items, `${at}[${index}]`)));
	}
	if (isPlainObject(value)) {
		for (const key of Array.isArray(schema.required) ? schema.required : []) if (!Object.hasOwn(value, key)) add("is required", joinPath(at, key));
		const properties = isPlainObject(schema.properties) ? schema.properties : {};
		for (const [key, child] of Object.entries(value)) {
			if (Object.hasOwn(properties, key)) errors.push(...validateNode(child, properties[key], joinPath(at, key)));
			else if (schema.additionalProperties === false) add("is not an allowed field", joinPath(at, key));
			else if (isPlainObject(schema.additionalProperties)) errors.push(...validateNode(child, schema.additionalProperties, joinPath(at, key)));
		}
	}
	return errors;
}

export function contentSchemaTypes(skillRoot = SKILL_ROOT, fileSystem = fs) {
	const dir = path.join(skillRoot, "references", "schemas");
	if (!fileSystem.existsSync(dir)) return [];
	return fileSystem.readdirSync(dir).filter(name => name.endsWith(".json")).map(name => name.slice(0, -5)).sort();
}

export function loadSchema(type, { skillRoot = SKILL_ROOT, fileSystem = fs } = {}) {
	const rel = `references/schemas/${type}.json`;
	const file = path.join(skillRoot, rel);
	if (!/^[a-z][a-z0-9-]*$/.test(String(type)) || !fileSystem.existsSync(file)) return { schema: null, issues: [`no schema ${rel}`] };
	try {
		const schema = JSON.parse(fileSystem.readFileSync(file, "utf8"));
		return { schema, issues: schemaKeywordIssues(schema).map(issue => `${rel} ${issue}`) };
	} catch (error) {
		return { schema: null, issues: [`${rel} is not valid JSON: ${error.message}`] };
	}
}

export function readFigureEngineMeta(html) {
	const tag = (String(html).match(/<meta\b[^>]*>/gi) ?? []).find(candidate => /\bname\s*=\s*["']vpk-figure-engine["']/i.test(candidate));
	return tag === undefined ? null : (/\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1].trim() ?? "");
}

export function briefContractIssues(brief, { type = "document", skillRoot = SKILL_ROOT, fileSystem = fs, html = null } = {}) {
	const issues = [];
	const error = (at, message) => issues.push(finding("content.brief", "error", at, message));
	if (!isPlainObject(brief)) return issues;
	const figures = Array.isArray(brief.figures) ? brief.figures.filter(isPlainObject) : [];
	const engines = new Set(figures.map(figure => figure.engine));
	const formats = Array.isArray(brief.formats) ? brief.formats : [];
	const engine = brief.figure_engine;
	if (typeof brief.template === "string") {
		const file = brief.template.endsWith(".html") ? brief.template : `${brief.template}.html`;
		if (path.basename(file) !== file || !fileSystem.existsSync(path.join(skillRoot, "assets", "templates", file))) error("brief.template", `B1: template ${file} does not exist in assets/templates/`);
		if (type !== "document" && file.slice(0, -5) !== type) error("brief.template", `B8: a "${type}" sidecar must use ${type}.html, not ${file}`);
	}
	if (!formats.includes("html")) error("brief.formats", "B2: formats must include html");
	for (const target of Array.isArray(brief.publish) ? brief.publish : []) if (!formats.includes(target)) error("brief.publish", `B3: publish target ${target} is missing from formats`);
	const hasEngineFigures = [...engines].some(id => ENGINE_FIGURES.has(id));
	if (hasEngineFigures && (engine === undefined || engine === "none")) error("brief.figure_engine", "B4: iso-kit or anatomy-hero figures need figure_engine iso-kit, anatomy-hero or both");
	const excluded = { "iso-kit": "anatomy-hero", "anatomy-hero": "iso-kit" }[engine];
	if (excluded && engines.has(excluded)) error("brief.figure_engine", `B5: figure_engine ${engine} excludes ${excluded} figures`);
	if (engine === "both" && !(engines.has("iso-kit") && engines.has("anatomy-hero"))) error("brief.figure_engine", "B5: figure_engine both needs at least one iso-kit and one anatomy-hero figure");
	// B6 is retired: a document may carry several anatomy heroes.
	if (brief.figure_engine_source === "default" && !(Array.isArray(brief.assumptions) && brief.assumptions.length > 0)) {
		issues.push(finding("content.brief", "warning", "brief.assumptions", "B7: a defaulted figure engine must be listed in assumptions"));
	}
	const ids = new Map();
	figures.forEach((figure, index) => {
		if (figure.tier !== undefined && figure.engine !== "anatomy-hero") error(`brief.figures[${index}].tier`, "tier applies only to anatomy-hero figures");
		if (typeof figure.id === "string" && ids.has(figure.id)) error(`brief.figures[${index}].id`, `duplicate figure id "${figure.id}" (first at figures[${ids.get(figure.id)}])`);
		else ids.set(figure.id, index);
	});
	if (typeof html === "string") {
		const meta = readFigureEngineMeta(html);
		if (meta !== null && (engine ?? "none") !== meta) error("brief.figure_engine", `B9: brief.figure_engine is "${engine ?? "none"}" but the HTML records <meta name="vpk-figure-engine" content="${meta}">`);
		if (meta === null && hasEngineFigures) error("brief.figure_engine", "B9: the brief plans engine figures; record the engine: <meta name=\"vpk-figure-engine\" content=\"…\">");
	}
	return issues;
}

export function validateEnvelope(envelope, { skillRoot = SKILL_ROOT, fileSystem = fs, html = null } = {}) {
	const findings = [];
	const contract = (at, message) => findings.push(finding("content.contract", "error", at, message));
	if (!isPlainObject(envelope)) return { type: null, schema: null, findings: [finding("content.contract", "error", "(root)", "sidecar must be a JSON object { type, lang, brief, content? }")] };
	for (const key of Object.keys(envelope)) if (!ENVELOPE_KEYS.includes(key)) contract(key, "is not an allowed field (type, lang, brief, content)");
	for (const key of ["type", "lang", "brief"]) if (!Object.hasOwn(envelope, key)) contract(key, "is required");
	const types = contentSchemaTypes(skillRoot, fileSystem);
	const type = types.includes(envelope.type) ? envelope.type : null;
	if (Object.hasOwn(envelope, "type") && !type) contract("type", `unknown content type ${JSON.stringify(envelope.type)}; known: ${types.join(", ") || "none"}`);
	if (Object.hasOwn(envelope, "lang") && !(typeof envelope.lang === "string" && LANG_PATTERN.test(envelope.lang))) contract("lang", "must be a language tag such as en or en-GB");
	if (Object.hasOwn(envelope, "brief")) {
		for (const issue of validateNode(envelope.brief, BRIEF_SCHEMA, "brief")) findings.push(finding("content.brief", "error", issue.path, issue.message));
		findings.push(...briefContractIssues(envelope.brief, { type: type ?? "document", skillRoot, fileSystem, html }));
	}
	const { schema = null, issues = [] } = type ? loadSchema(type, { skillRoot, fileSystem }) : {};
	issues.forEach(issue => contract("type", issue));
	if (schema && Object.hasOwn(envelope, "content")) {
		for (const issue of validateNode(envelope.content, schema, "content")) contract(issue.path, issue.message);
		for (const item of CONTRACT_HOOKS[type]?.(envelope.content) ?? []) findings.push(finding("content.hook", item.severity, item.path, item.message));
	}
	return { type, schema, findings };
}

const ENTITIES = { amp: 38, lt: 60, gt: 62, quot: 34, apos: 39, nbsp: 160, ensp: 8194, emsp: 8195, thinsp: 8201, shy: 173, mdash: 8212, ndash: 8211, minus: 8722, middot: 183, bull: 8226, hellip: 8230, plusmn: 177, times: 215, divide: 247, deg: 176, micro: 181, le: 8804, ge: 8805, ne: 8800, asymp: 8776, rarr: 8594, larr: 8592, uarr: 8593, darr: 8595, harr: 8596, lsquo: 8216, rsquo: 8217, ldquo: 8220, rdquo: 8221, laquo: 171, raquo: 187, prime: 8242, Prime: 8243, copy: 169, reg: 174, trade: 8482, sect: 167, para: 182, euro: 8364, pound: 163, yen: 165, cent: 162, frac12: 189, frac14: 188, frac34: 190, sup2: 178, sup3: 179 };
const INLINE_TAGS = "a|abbr|b|bdi|bdo|cite|code|data|del|dfn|em|i|ins|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var|wbr";
const collapse = value => String(value).replace(/\s+/g, " ").trim();

function decodeEntities(value) {
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, name) => {
		if (name[0] !== "#") return Object.hasOwn(ENTITIES, name) ? String.fromCodePoint(ENTITIES[name]) : whole;
		const code = name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
		return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
	});
}

// Visible text: the HTML minus head, script, style, template, noscript, comments, speaker
// notes and simple [hidden] elements. Inline tags join their text; block tags separate it.
export function visibleText(html) {
	let body = String(html).replace(/<!--[\s\S]*?-->/g, " ").replace(/<head\b[\s\S]*?<\/head\s*>/gi, " ");
	for (const tag of ["script", "style", "template", "noscript"]) body = body.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " ");
	body = body
		.replace(/<aside\b[^>]*\bclass\s*=\s*["'][^"']*\bspeaker-notes\b[^"']*["'][^>]*>[\s\S]*?<\/aside\s*>/gi, " ")
		.replace(/<([a-z][a-z0-9-]*)\b[^>]*\shidden(?=[\s>=/])[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
		.replace(new RegExp(`</?(?:${INLINE_TAGS})\\b[^>]*>`, "gi"), "")
		.replace(/<[^>]+>/g, " ");
	return collapse(decodeEntities(body));
}

function leafValues(value, out = []) {
	if (typeof value === "string" || typeof value === "number") out.push(value);
	else if (Array.isArray(value)) value.forEach(item => leafValues(item, out));
	else if (isPlainObject(value)) Object.values(value).forEach(item => leafValues(item, out));
	return out;
}

export function islandStrings(html) {
	const strings = [];
	for (const island of findJsonIslands(String(html), "data-vpk-content")) {
		try { strings.push(...leafValues(parseJsonIsland(island.raw)).filter(leaf => typeof leaf === "string")); } catch { /* reported by checkIslands */ }
	}
	return strings;
}

function collectLeaves(value, schema, at, out) {
	if (schema?.["x-coverage"] === "skip") out.skipped += leafValues(value).length;
	else if (typeof value === "string") {
		const plain = collapse(value.replace(/<\/?(?:q|code|em)\b[^>]*>/gi, ""));
		if (plain && [...plain].length > COVERAGE_MAX_CHARS && schema?.["x-coverage"] !== "verbatim") out.skipped += 1;
		else if (plain) out.leaves.push({ path: at, candidates: [plain] });
	} else if (typeof value === "number" && Number.isFinite(value)) {
		out.leaves.push({ path: at, candidates: [...new Set([String(value), value.toLocaleString("en-US")])] });
	} else if (Array.isArray(value)) {
		value.forEach((item, index) => collectLeaves(item, schema?.items, `${at}[${index}]`, out));
	} else if (isPlainObject(value)) {
		for (const [key, child] of Object.entries(value)) {
			const childSchema = schema?.properties?.[key] ?? (isPlainObject(schema?.additionalProperties) ? schema.additionalProperties : undefined);
			collectLeaves(child, childSchema, joinPath(at, key), out);
		}
	}
}

// Alphanumeric boundaries: "62%" does not match "162%", and "99" does not match "99.1".
function holds(haystack, needle) {
	const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const before = /^[\p{L}\p{N}]/u.test(needle) ? "(?<![\\p{L}\\p{N}])(?<!\\p{N}[.,])" : "";
	const after = /[\p{L}\p{N}]$/u.test(needle) ? "(?![\\p{L}\\p{N}])(?![.,]\\p{N})" : "";
	return new RegExp(`${before}${escaped}${after}`, "u").test(haystack);
}

export function coverageIssues(content, schema, html) {
	const out = { leaves: [], skipped: 0 };
	collectLeaves(content, schema, "content", out);
	const haystack = [visibleText(html), ...islandStrings(html).map(collapse)].join(" \n ");
	// Fallback for values split across elements ("62" | "%"): drop whitespace next to symbols,
	// keep it between two alphanumerics so word boundaries survive.
	const tighten = value => collapse(value).replace(/ (?=[^\p{L}\p{N}])|(?<=[^\p{L}\p{N}]) /gu, "");
	const tight = tighten(haystack);
	const findings = out.leaves
		.filter(leaf => !leaf.candidates.some(candidate => holds(haystack, candidate) || holds(tight, tighten(candidate))))
		.map(leaf => finding("content.coverage", "error", leaf.path, `"${leaf.candidates[0]}" does not appear in the HTML`));
	return { checked: out.leaves.length, skipped: out.skipped, findings };
}

function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (isPlainObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
	return JSON.stringify(value);
}

async function runHook(type, hook, html, { skillRoot, fileSystem, importModule }) {
	const at = `island[${type}]`;
	const moduleFile = path.resolve(skillRoot, "scripts", hook.module);
	if (!fileSystem.existsSync(moduleFile)) {
		return fileSystem.existsSync(path.join(skillRoot, "assets", "templates", hook.template))
			? [finding("content.island", "error", at, `validator ${hook.module} not found for ${type}`)]
			: [finding("content.island", "info", at, `validator ${hook.module} lands with ${hook.template}; schema checks only`)];
	}
	const check = (await importModule(moduleFile))?.[hook.check];
	if (typeof check !== "function") return [finding("content.island", "error", at, `${hook.module} does not export ${hook.check}`)];
	const result = (await check(String(html))) ?? {};
	const findings = [
		...(result.errors ?? []).map(message => finding("content.island", "error", at, String(message))),
		...(result.warnings ?? []).map(message => finding("content.island", "warning", at, String(message))),
	];
	if (result.ok === false && !hasError(findings)) findings.push(finding("content.island", "error", at, `${hook.check} reported a failure`));
	return findings;
}

export async function checkIslands(html, { sidecar = null, skillRoot = SKILL_ROOT, fileSystem = fs, hooks = CONTENT_TYPE_HOOKS, importModule = file => import(pathToFileURL(file).href) } = {}) {
	const findings = [];
	const islands = [];
	const known = contentSchemaTypes(skillRoot, fileSystem);
	for (const island of findJsonIslands(String(html), "data-vpk-content")) {
		const type = island.attrs["data-vpk-content"];
		const own = [];
		const error = message => own.push(finding("content.island", "error", `island[${type || "?"}]`, message));
		let value;
		if (!known.includes(type)) error(`unknown content type "${type}"; add references/schemas/${type || "<type>"}.json`);
		else {
			try { value = parseJsonIsland(island.raw); } catch (problem) { error(problem.message); }
		}
		if (value !== undefined) {
			const { schema, issues } = loadSchema(type, { skillRoot, fileSystem });
			issues.forEach(error);
			if (schema) validateNode(value, schema, "content").forEach(issue => error(`${issue.path} ${issue.message}`));
			if (islands.some(entry => entry.type === type)) error(`more than one data-vpk-content="${type}" island`);
			if (isPlainObject(sidecar) && sidecar.type !== type) error(`island type "${type}" does not match sidecar type "${sidecar.type}"`);
			else if (isPlainObject(sidecar) && !Object.hasOwn(sidecar, "content")) error("the sidecar has no content to compare with this island");
			else if (isPlainObject(sidecar) && canonicalJson(value) !== canonicalJson(sidecar.content)) error("island content differs from the sidecar content; re-render from <slug>.content.json");
		}
		findings.push(...own);
		islands.push({ type, ok: !hasError(own) });
	}
	for (const type of new Set(islands.map(island => island.type))) {
		if (!Object.hasOwn(hooks, type)) continue;
		const own = await runHook(type, hooks[type], html, { skillRoot, fileSystem, importModule });
		findings.push(...own);
		if (hasError(own)) islands.filter(island => island.type === type).forEach(island => { island.ok = false; });
	}
	return { islands, findings };
}

export function resolveContentPaths(first, second, { fileSystem = fs, cwd = process.cwd() } = {}) {
	if (!first) throw new ContentUsageError("--check-content requires <file.html|content.json> [<file.html>]");
	let [a, b] = [path.resolve(cwd, first), second ? path.resolve(cwd, second) : null];
	if (b && /\.json$/i.test(b) && /\.html?$/i.test(a)) [a, b] = [b, a];
	let sidecarPath = null;
	let htmlPath = null;
	let expectedSidecar = null;
	if (/\.html?$/i.test(a) && !b) {
		htmlPath = a;
		expectedSidecar = path.join(path.dirname(a), `${path.basename(a).replace(/\.html?$/i, "")}.content.json`);
		sidecarPath = fileSystem.existsSync(expectedSidecar) ? expectedSidecar : null;
	} else if (/\.json$/i.test(a) && (!b || /\.html?$/i.test(b))) {
		sidecarPath = a;
		const guess = path.join(path.dirname(a), `${path.basename(a, ".json").replace(/\.content$/, "")}.html`);
		htmlPath = b ?? (fileSystem.existsSync(guess) ? guess : null);
	} else {
		throw new ContentUsageError(`expected <file.html|content.json> [<file.html>], got: ${[first, second].filter(Boolean).join(" ")}`);
	}
	for (const file of [sidecarPath, htmlPath]) if (file && !fileSystem.existsSync(file)) throw new ContentUsageError(`file not found: ${relPath(file)}`);
	return { sidecarPath, htmlPath, expectedSidecar };
}

function readText(file, fileSystem) {
	try { return fileSystem.readFileSync(file, "utf8"); } catch (error) { throw new ContentUsageError(`cannot read ${relPath(file)}: ${error.message}`); }
}

// checkContent(path[, htmlPath][, options]) or checkContent({ sidecarPath?, htmlPath?, ...options }).
// Usage problems (missing or unreadable files, bad arguments) throw ContentUsageError.
export async function checkContent(target, second, options = {}) {
	const objectForm = isPlainObject(target);
	const settings = objectForm ? target : isPlainObject(second) ? second : options;
	const first = objectForm ? target.sidecarPath ?? target.htmlPath : target;
	const other = objectForm ? (target.sidecarPath ? target.htmlPath : undefined) : isPlainObject(second) ? undefined : second;
	const { skillRoot = SKILL_ROOT, fileSystem = fs, cwd = process.cwd() } = settings;
	const { sidecarPath, htmlPath, expectedSidecar } = resolveContentPaths(first, other, { fileSystem, cwd });
	const html = htmlPath ? readText(htmlPath, fileSystem) : null;
	const findings = [];
	let envelope = null;
	let validated = { type: null, schema: null };
	if (sidecarPath) {
		const raw = readText(sidecarPath, fileSystem);
		try { envelope = JSON.parse(raw); } catch (error) { findings.push(finding("content.contract", "error", "(root)", `invalid JSON: ${error.message}`)); }
		if (envelope !== null) validated = validateEnvelope(envelope, { skillRoot, fileSystem, html });
		findings.push(...(validated.findings ?? []));
	} else if (htmlPath && /[/\\]artifacts[/\\]vpk-html[/\\]/.test(htmlPath)) {
		findings.push(finding("content.contract", "info", "sidecar", `no ${relPath(expectedSidecar)}; new documents record their contract there`));
	}
	const sidecar = isPlainObject(envelope) ? envelope : null;
	const { islands = [], findings: islandFindings = [] } = html === null ? {} : await checkIslands(html, { ...settings, skillRoot, fileSystem, sidecar });
	findings.push(...islandFindings);
	let coverage = { checked: 0, skipped: 0, findings: [] };
	if (html !== null && sidecar && Object.hasOwn(sidecar, "content") && validated.schema) coverage = coverageIssues(sidecar.content, validated.schema, html);
	findings.push(...coverage.findings);
	const budget = sidecar?.brief?.size_budget_kb;
	const bytes = html === null ? 0 : Buffer.byteLength(html);
	if (Number.isInteger(budget) && bytes > budget * 1024) findings.push(finding("content.size", "warning", "brief.size_budget_kb", `HTML is ${Math.round(bytes / 1024)} KB; the contract target is ${budget} KB`));
	return {
		ok: !hasError(findings),
		sidecar: relPath(sidecarPath),
		html: relPath(htmlPath),
		type: validated.type ?? (typeof sidecar?.type === "string" ? sidecar.type : null),
		mode: sidecarPath && htmlPath ? "full" : sidecarPath ? "contract-only" : "islands-only",
		islands,
		checked: coverage.checked,
		skipped: coverage.skipped,
		findings,
	};
}

export function formatContentReport(result) {
	const prefix = { error: "ERROR", warning: "WARN", info: "INFO" };
	const lines = result.findings.map(item => `${prefix[item.severity] ?? "WARN"}: ${item.rule} ${item.path}: ${item.message}`);
	const failed = rule => result.findings.some(item => item.severity === "error" && item.rule === rule);
	if (result.sidecar && !["content.contract", "content.brief", "content.hook"].some(failed)) lines.push(`OK: ${result.sidecar}: valid ${result.type} contract`);
	for (const island of result.islands) if (island.ok) lines.push(`OK: ${result.html}: ${island.type} island valid`);
	if (result.mode === "full" && result.checked + result.skipped > 0 && !failed("content.coverage")) {
		lines.push(`OK: ${result.html}: all ${result.checked} atomic content values present (${result.skipped} prose fields not held verbatim)`);
	}
	if (result.mode === "islands-only" && result.islands.length === 0 && result.ok) lines.push(`OK: ${result.html}: no content islands`);
	return lines.join("\n");
}

// Returns an exit code (never a Promise to assign): 0 clean or warnings, 1 errors, 2 usage.
export async function runCheckContent(args = {}, { log = console.log, error = console.error, ...options } = {}) {
	try {
		const result = await checkContent(args.file, args.html ?? undefined, options);
		log(args.json ? JSON.stringify(result, null, 2) : formatContentReport(result));
		return result.ok ? 0 : 1;
	} catch (problem) {
		if (!(problem instanceof ContentUsageError)) throw problem;
		error(problem.message);
		return 2;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const argv = process.argv.slice(2);
	const [file, html] = argv.filter(arg => !arg.startsWith("--"));
	process.exitCode = await runCheckContent({ file, html, json: argv.includes("--json") });
}
