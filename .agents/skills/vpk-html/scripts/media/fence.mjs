// vpk-html media · input fence for embed.mjs (references/media-pipeline.md). An input must resolve (realpath) under
// the HTML's folder, <cwd>/output, the temp dir or an explicit --root; secret-looking names are refused, and so are
// files over 50 MB. Reports carry paths relative to the cwd, never absolute ones.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

/** Path segments that look like secrets: .env*, .ssh, .aws, .gnupg, .netrc, .npmrc, id_*, credentials*, secret(s), *.pem/.key/.p12/.pfx. */
export const SECRET_NAME = /(?:^|\/)(?:\.env[^/]*|\.ssh|\.aws|\.gnupg|\.netrc|\.npmrc|\.pgpass|id_[^/]*|credentials[^/]*|secrets?|[^/]*\.(?:pem|key|p12|pfx|keystore))(?:\/|$)/i;
export const MAX_INPUT_BYTES = 50 * 1024 * 1024;

export class FenceError extends Error {}

const posix = value => value.split(path.sep).join("/");
const inside = (child, root) => {
	const rel = path.relative(root, child);
	return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

/** Real paths of the allowed roots: the HTML's folder, <cwd>/output, the temp dir (pass `tmpdir: null` to drop it) and `roots`. */
export function fenceRoots({ htmlFile, cwd = process.cwd(), roots = [], tmpdir = os.tmpdir() } = {}) {
	const candidates = [htmlFile && path.dirname(path.resolve(cwd, htmlFile)), path.join(cwd, "output"), tmpdir, tmpdir && process.env.TMPDIR, ...roots.map(root => path.resolve(cwd, root))];
	const real = candidates.filter(Boolean).filter(dir => fs.existsSync(dir)).map(dir => fs.realpathSync(dir));
	return [...new Set(real)];
}

/** Check one input; returns `{ path, relative, bytes }` or throws FenceError naming the rule it broke. */
export function checkFencedInput(file, { roots, cwd = process.cwd(), maxBytes = MAX_INPUT_BYTES }) {
	const given = path.resolve(cwd, file);
	if (SECRET_NAME.test(posix(path.relative(cwd, given)))) throw new FenceError(`refused ${file}: the name looks like a secret`);
	if (!fs.existsSync(given)) throw new FenceError(`refused ${file}: no such file`);
	const real = fs.realpathSync(given);
	const root = roots.find(dir => inside(real, dir));
	if (!root) throw new FenceError(`refused ${file}: outside the allowed roots (the HTML's folder, output/, the temp dir, --root)`);
	if (SECRET_NAME.test(posix(path.relative(root, real)))) throw new FenceError(`refused ${file}: the name looks like a secret`);
	const stat = fs.statSync(real);
	if (!stat.isFile()) throw new FenceError(`refused ${file}: not a file`);
	if (stat.size > maxBytes) throw new FenceError(`refused ${file}: ${stat.size} B exceeds the ${maxBytes} B input cap`);
	return { path: real, relative: posix(path.relative(cwd, real)), bytes: stat.size };
}

/** First 12 hex digits of the SHA-256 of `buffer`. */
export function sha256_12(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

/** The manifest line embed prints for each input. */
export function describeEmbedded({ relative, bytes }, buffer) {
	return `embedded: ${relative} ${bytes} sha256:${sha256_12(buffer)}`;
}
