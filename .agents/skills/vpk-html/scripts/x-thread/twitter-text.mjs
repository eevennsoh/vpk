// twitter-text v3 weighted counter for vpk-html x-thread pages (browser- and Node-safe).
//
// Port of twitter/twitter-text (https://github.com/twitter/twitter-text) at commit
// 30e2430d90cff3b46393ea54caf511441983c260: js/src/parseTweet.js, extractUrlsWithIndices.js,
// hasInvalidCharacters.js, lib/idna.js, lib/getCharacterWeight.js and regexp/*, with
// config/v3.json inlined as X_TEXT_CONFIG.
//
// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
// except in compliance with the License. You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software distributed under the
// License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific language governing permissions
// and limitations under the License.
//
// Changes (vpk-html, 2026): one ESM module whose only import is the TLD data; regexes are
// assembled from template literals instead of regexSupplant; the punycode dependency is replaced
// by a minimal RFC 3492 encoder that only measures label lengths (lib/idna.js semantics); the
// twemoji-parser regex is replaced by the Unicode RGI_Emoji property (v flag) with a u-flag
// fallback, keeping twemoji-parser's (MIT) keycap and text-presentation rule. Private top-level
// names carry a TT_/tt prefix because bundle.mjs concatenates modules into one scope.

import { GTLDS, CCTLDS } from "./tlds.mjs";

export const X_TEXT_CONFIG = Object.freeze({
	version: 3,
	maxWeightedTweetLength: 280,
	scale: 100,
	defaultWeight: 200,
	emojiParsingEnabled: true,
	transformedURLLength: 23,
	ranges: Object.freeze([
		Object.freeze({ start: 0, end: 4351, weight: 100 }),
		Object.freeze({ start: 8192, end: 8205, weight: 100 }),
		Object.freeze({ start: 8208, end: 8223, weight: 100 }),
		Object.freeze({ start: 8242, end: 8247, weight: 100 }),
	]),
});

const ttEscape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest first, so a TLD never loses to its own prefix inside the alternation.
const ttAlternation = list => [...list].sort((a, b) => b.length - a.length || (a < b ? 1 : -1)).map(ttEscape).join("|");

const TT_GTLD = `(?:(?:${ttAlternation(GTLDS)})(?=[^0-9a-zA-Z@+-]|$))`;
const TT_CCTLD = `(?:(?:${ttAlternation(CCTLDS)})(?=[^0-9a-zA-Z@+-]|$))`;
const TT_PUNYCODE_TLD = "(?:xn--[\\-0-9a-z]+)";
const TT_INVALID = "\\uFFFE\\uFEFF\\uFFFF";
const TT_DIRECTIONAL = "\\u202A-\\u202E\\u061C\\u200E\\u200F\\u2066\\u2067\\u2068\\u2069";
const TT_SPACES = "\\x09-\\x0D\\x20\\x85\\xA0\\u1680\\u180E\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000";
const TT_PUNCT = "\\!'#%&'\\(\\)*\\+,\\\\\\-\\.\\/:;<=>\\?@\\[\\]\\^_{|}~\\$";
const TT_LATIN_ACCENTS = "\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\xFF\\u0100-\\u024F\\u0253\\u0254\\u0256\\u0257\\u0259\\u025B\\u0263\\u0268\\u026F\\u0272\\u0289\\u028B\\u02BB\\u0300-\\u036F\\u1E00-\\u1EFF";
const TT_CYRILLIC = "\\u0400-\\u04FF";
const TT_DOMAIN_CHAR = `[^${TT_PUNCT}${TT_SPACES}${TT_INVALID}${TT_DIRECTIONAL}]`;
const TT_SUBDOMAIN = `(?:(?:${TT_DOMAIN_CHAR}(?:[_-]|${TT_DOMAIN_CHAR})*)?${TT_DOMAIN_CHAR}\\.)`;
const TT_DOMAIN_NAME = `(?:(?:${TT_DOMAIN_CHAR}(?:-|${TT_DOMAIN_CHAR})*)?${TT_DOMAIN_CHAR}\\.)`;
const TT_DOMAIN = `(?:${TT_SUBDOMAIN}*${TT_DOMAIN_NAME}(?:${TT_GTLD}|${TT_CCTLD}|${TT_PUNYCODE_TLD}))`;
const TT_PATH_CHARS = `[a-z${TT_CYRILLIC}0-9!\\*';:=\\+,\\.\\$\\/%#\\[\\]\\-\\u2013_~@\\|&${TT_LATIN_ACCENTS}]`;
const TT_BALANCED_PARENS = `\\((?:${TT_PATH_CHARS}+|(?:${TT_PATH_CHARS}*\\(${TT_PATH_CHARS}+\\)${TT_PATH_CHARS}*))\\)`;
// No outer group, as upstream splices in .source: in TT_URL_PATH a bare "(...)" is its own alternative.
const TT_PATH_ENDING = `[\\+\\-a-z${TT_CYRILLIC}0-9=_#\\/${TT_LATIN_ACCENTS}]|(?:${TT_BALANCED_PARENS})`;
const TT_URL_PATH = `(?:(?:${TT_PATH_CHARS}*(?:${TT_BALANCED_PARENS}${TT_PATH_CHARS}*)*${TT_PATH_ENDING})|(?:@${TT_PATH_CHARS}+\\/))`;
const TT_QUERY_CHARS = "[a-z0-9!?\\*'@\\(\\);:&=\\+\\$\\/%#\\[\\]\\-_\\.,~|]";
const TT_QUERY_ENDING = "[a-z0-9\\-_&=#\\/]";
const TT_PRECEDING = `(?:[^A-Za-z0-9@\\uFF20$#\\uFF03${TT_INVALID}]|[${TT_DIRECTIONAL}]|^)`;
// Groups: 1 whole, 2 preceding, 3 URL, 4 protocol, 5 domain, 6 port, 7 path, 8 query.
const TT_EXTRACT_URL = new RegExp(`((${TT_PRECEDING})((https?:\\/\\/)?(${TT_DOMAIN})(?::([0-9]+))?(\\/${TT_URL_PATH}*)?(\\?${TT_QUERY_CHARS}*${TT_QUERY_ENDING})?))`, "gi");
const TT_ASCII_DOMAIN_SOURCE = `(?:(?:[\\-a-z0-9${TT_LATIN_ACCENTS}]+)\\.)+(?:${TT_GTLD}|${TT_CCTLD}|${TT_PUNYCODE_TLD})`;
const TT_ASCII_DOMAIN = new RegExp(TT_ASCII_DOMAIN_SOURCE, "gi");
const TT_HAS_ASCII_DOMAIN = new RegExp(TT_ASCII_DOMAIN_SOURCE, "i");
const TT_TCO_URL = new RegExp(`^https?:\\/\\/t\\.co\\/([a-z0-9]+)(?:\\?${TT_QUERY_CHARS}*${TT_QUERY_ENDING})?`, "i");
const TT_INVALID_PRECEDING_NO_PROTOCOL = /[-_./]$/;
const TT_INVALID_CHARS = new RegExp(`[${TT_INVALID}]`);
const TT_DEFAULT_PROTOCOL = "https://";
const TT_MAX_URL_LENGTH = 4096;
const TT_MAX_TCO_SLUG_LENGTH = 40;
const TT_MAX_LABEL_LENGTH = 63;
// punycode.toASCII also splits on the ideographic, fullwidth and halfwidth full stops.
const TT_LABEL_SEPARATORS = new RegExp("[\\u3002\\uFF0E\\uFF61]");

// Punycode (RFC 3492) output length of one label, as punycode.toASCII would produce it.
function ttPunycodeLength(label) {
	if (!/[^\x00-\x7F]/.test(label)) return label.length;
	const points = Array.from(label, char => char.codePointAt(0));
	if (points.length > TT_MAX_LABEL_LENGTH) return TT_MAX_LABEL_LENGTH + 1; // "xn--" + one digit per point, at least
	const basic = points.filter(point => point < 0x80).length;
	let length = 4 + basic + (basic ? 1 : 0);
	let n = 128, delta = 0, bias = 72, handled = basic;
	while (handled < points.length) {
		let next = Infinity;
		for (const point of points) if (point >= n && point < next) next = point;
		delta += (next - n) * (handled + 1);
		n = next;
		for (const point of points) {
			if (point < n) delta += 1;
			if (point !== n) continue;
			let q = delta;
			for (let k = 36; ; k += 36) {
				const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
				if (q < t) break;
				length += 1;
				q = Math.floor((q - t) / (36 - t));
			}
			length += 1;
			bias = ttAdapt(delta, handled + 1, handled === basic);
			delta = 0;
			handled += 1;
		}
		delta += 1;
		n += 1;
	}
	return length;
}

function ttAdapt(delta, points, first) {
	let k = 0;
	delta = first ? Math.floor(delta / 700) : delta >> 1;
	delta += Math.floor(delta / points);
	for (; delta > 455; k += 36) delta = Math.floor(delta / 35);
	return Math.floor(k + (36 * delta) / (delta + 38));
}

// lib/idna.js toAscii: every label must encode to 1-63 characters. Like upstream, the length
// check below then uses the unencoded domain, so only label validity matters here.
function ttValidDomain(domain) {
	if (domain.startsWith("xn--") && !TT_HAS_ASCII_DOMAIN.test(domain)) return false;
	for (const label of domain.split(".")) {
		const parts = label.split(TT_LABEL_SEPARATORS);
		const encoded = parts.reduce((sum, part) => sum + ttPunycodeLength(part), parts.length - 1);
		if (encoded < 1 || encoded > TT_MAX_LABEL_LENGTH) return false;
	}
	return true;
}

export function extractUrlsWithIndices(text) {
	if (!text || !/\./.test(text)) return [];
	const urls = [];
	TT_EXTRACT_URL.lastIndex = 0;
	let match;
	while ((match = TT_EXTRACT_URL.exec(text))) {
		const before = match[2];
		let url = match[3];
		const protocol = match[4];
		const domain = match[5];
		const path = match[7];
		let end = TT_EXTRACT_URL.lastIndex;
		const start = end - url.length;
		if (!ttValidDomain(domain) || (protocol || TT_DEFAULT_PROTOCOL).length + url.length > TT_MAX_URL_LENGTH) continue;
		if (!protocol) {
			if (TT_INVALID_PRECEDING_NO_PROTOCOL.test(before)) continue;
			let last = null;
			let asciiEnd = 0;
			TT_ASCII_DOMAIN.lastIndex = 0;
			for (const ascii of domain.matchAll(TT_ASCII_DOMAIN)) {
				const asciiStart = domain.indexOf(ascii[0], asciiEnd);
				asciiEnd = asciiStart + ascii[0].length;
				last = { url: ascii[0], indices: [start + asciiStart, start + asciiEnd] };
				urls.push(last);
			}
			if (!last) continue;
			if (path) {
				const asciiUrl = last.url;
				last.url = url.replace(domain, () => asciiUrl);
				last.indices[1] = end;
			}
		} else {
			const tco = url.match(TT_TCO_URL);
			if (tco) {
				if (tco[1] && tco[1].length > TT_MAX_TCO_SLUG_LENGTH) continue;
				url = tco[0];
				end = start + url.length;
			}
			urls.push({ url, indices: [start, end] });
		}
	}
	return urls;
}

// Both patterns try keycaps (with or without VS16) first. EMOJI_PATTERN then matches any RGI
// emoji sequence (ZWJ, modifiers, flags); the fallback, for engines without the v flag,
// approximates it with Extended_Pictographic chains (with tag-sequence subdivision flags) and
// regional-indicator pairs.
export const EMOJI_FALLBACK_PATTERN = new RegExp("[#*0-9]\\uFE0F?\\u20E3|\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier}|[\\u{E0020}-\\u{E007E}]+\\u{E007F})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?)*|\\p{Regional_Indicator}{2}", "gu");
export const EMOJI_PATTERN = (() => {
	try {
		return new RegExp("[#*0-9]\\uFE0F?\\u20E3|\\p{RGI_Emoji}", "gv");
	} catch {
		return EMOJI_FALLBACK_PATTERN;
	}
})();
// twemoji-parser: (c), (R), TM and the chess pawn count as emoji only when followed by VS16.
const TT_TEXT_DEFAULT_GLYPH = new RegExp("^[\\u00A9\\u00AE\\u2122\\u265F]$");

export function extractEmojiWithIndices(text, pattern = EMOJI_PATTERN) {
	const scan = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
	const found = [];
	if (!text) return found;
	scan.lastIndex = 0;
	let match;
	while ((match = scan.exec(text))) {
		if (!match[0]) scan.lastIndex += 1; // a caller pattern that can match empty must still advance
		else if (!TT_TEXT_DEFAULT_GLYPH.test(match[0])) found.push({ text: match[0], indices: [match.index, match.index + match[0].length] });
	}
	scan.lastIndex = 0;
	return found;
}

function ttCharacterWeight(code, config) {
	for (const range of config.ranges || []) if (code >= range.start && code <= range.end) return range.weight;
	return config.defaultWeight;
}

export function parseTweet(text = "", config = X_TEXT_CONFIG, { emojiPattern = EMOJI_PATTERN } = {}) {
	const source = typeof text === "string" ? text : String(text ?? "");
	const options = config && Object.keys(config).length ? config : X_TEXT_CONFIG;
	const { defaultWeight, emojiParsingEnabled, scale, maxWeightedTweetLength, transformedURLLength } = options;
	const normalized = source.normalize();
	const urlAt = new Map(extractUrlsWithIndices(normalized).map(entity => [entity.indices[0], entity]));
	const emojiAt = emojiParsingEnabled
		? new Map(extractEmojiWithIndices(normalized, emojiPattern).map(entity => [entity.indices[0], entity]))
		: new Map();
	const max = maxWeightedTweetLength * scale;
	let weighted = 0;
	let validDisplayIndex = 0;
	let valid = true;
	for (let index = 0; index < normalized.length; index++) {
		if (urlAt.has(index)) {
			weighted += transformedURLLength * scale;
			index += urlAt.get(index).url.length - 1;
		} else if (emojiAt.has(index)) {
			weighted += defaultWeight;
			index += emojiAt.get(index).text.length - 1;
		} else {
			const code = normalized.charCodeAt(index);
			const next = normalized.charCodeAt(index + 1);
			// Upstream weighs a surrogate pair by its low surrogate, which falls outside every range.
			if (index < normalized.length - 1 && code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) index += 1;
			weighted += ttCharacterWeight(normalized.charCodeAt(index), options);
		}
		if (valid) valid = !TT_INVALID_CHARS.test(normalized.substring(index, index + 1));
		if (valid && weighted <= max) validDisplayIndex = index;
	}
	weighted /= scale;
	valid = valid && weighted > 0 && weighted <= maxWeightedTweetLength;
	return {
		weightedLength: weighted,
		valid,
		permillage: Math.floor((weighted / maxWeightedTweetLength) * 1000),
		validRangeStart: 0,
		validRangeEnd: validDisplayIndex + (source.length - normalized.length),
		displayRangeStart: 0,
		displayRangeEnd: source.length > 0 ? source.length - 1 : 0,
	};
}

export function weightedLength(text) {
	return parseTweet(text).weightedLength;
}
