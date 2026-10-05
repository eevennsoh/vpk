import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.svg', '.d.ts']);
const hash = value => createHash('sha256').update(value).digest('hex');
function walk(root, skip = new Set()) {
	if (!fs.existsSync(root)) return [];
	return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
		if (skip.has(entry.name) || entry.isSymbolicLink()) return [];
		const file = path.join(root, entry.name);
		return entry.isDirectory() ? walk(file, skip) : [file];
	});
}
function runtimeFiles(root) {
	return ['app', 'components', 'hooks', 'lib', 'backend', 'rovo'].flatMap(directory =>
		walk(path.join(root, directory), new Set(['node_modules', 'public', 'output', ...(directory === 'backend' ? ['data'] : [])]))
	).filter(file => textExtensions.has(path.extname(file)) && !/\.(?:test|spec|fixture)\.[^.]+$/.test(file)).sort();
}
export function audit(root, { keep = [] } = {}) {
	root = path.resolve(root);
	const ts = createRequire(path.join(root, 'package.json'))('typescript');
	const publicRoot = path.join(root, 'public');
	const assets = walk(publicRoot);
	const assetSet = new Set(assets);
	const kept = new Map();
	const inputs = new Map();
	const queue = [];
	const warnings = new Set();
	function retain(file, reason) {
		if (!file.startsWith(publicRoot + path.sep) || !assetSet.has(file) || kept.has(file)) return;
		kept.set(file, reason);
		queue.push(file);
	}
	function reference(value, owner, dynamic = false) {
		if (!value || /^(?:https?:|data:|blob:|#|\/\/)/.test(value)) return;
		value = value.split(/[?#]/)[0];
		let file;
		if (value.startsWith('@/public/')) file = path.join(root, value.slice(2));
		else if (value.startsWith('/')) file = path.join(publicRoot, value.slice(1));
		else if (owner.startsWith(publicRoot + path.sep) || value.includes('public/')) file = path.resolve(path.dirname(owner), value);
		else return;
		file = path.resolve(file);
		if (!assetSet.has(file) && !value.startsWith('@/public/') && value.includes('%')) {
			try { file = path.resolve(decodeURIComponent(file)); } catch { warnings.add(`Invalid encoded asset path in ${path.relative(root, owner)}`); }
		}
		if (file === publicRoot && dynamic) {
			warnings.add(`Unbounded public asset path in ${path.relative(root, owner)}; all public files retained`);
			for (const asset of assets) retain(asset, 'unbounded runtime path');
			return;
		}
		if (!file.startsWith(publicRoot + path.sep)) return;
		if (assetSet.has(file)) retain(file, path.relative(root, owner));
		else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
			for (const asset of assets) if (asset.startsWith(file + path.sep)) retain(asset, `directory reference in ${path.relative(root, owner)}`);
		} else if (dynamic) {
			const directory = value.endsWith('/') ? file : path.dirname(file);
			for (const asset of assets) if (asset.startsWith(directory + path.sep)) retain(asset, `dynamic path in ${path.relative(root, owner)}`);
		} else {
			for (const ext of ['.d.ts', '.ts', '.tsx', '.js', '.json']) if (assetSet.has(file + ext)) retain(file + ext, path.relative(root, owner));
		}
	}
	function read(file) {
		const contents = fs.readFileSync(file);
		inputs.set(path.relative(root, file), hash(contents));
		return contents.toString();
	}
	function scan(file) {
		if (!textExtensions.has(path.extname(file))) return;
		const text = read(file);
		if (/\.[cm]?[jt]sx?$/.test(file)) {
			const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
			function visit(node) {
				if (ts.isCallExpression(node) && /(?:^|\.)(?:join|resolve)$/.test(node.expression.getText(source))) {
					const at = node.arguments.findIndex(arg => ts.isStringLiteral(arg) && arg.text === 'public');
					if (at !== -1 && at < node.arguments.length - 1) {
						const parts = [];
						for (const arg of node.arguments.slice(at + 1)) {
							if (!ts.isStringLiteral(arg)) break;
							parts.push(arg.text);
						}
						reference('/' + parts.join('/') + (parts.length < node.arguments.length - at - 1 ? '/' : ''), file, true);
					}
				}
				const comparison = node.parent && ts.isCallExpression(node.parent) && /\.(?:includes|startsWith|endsWith)$/.test(node.parent.expression.getText(source));
				const concatenated = node.parent && ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken;
				if (!comparison && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) reference(node.text, file, concatenated);
				if (!comparison && ts.isTemplateExpression(node)) reference(node.head.text, file, true);
				ts.forEachChild(node, visit);
			}
			visit(source);
		} else {
			for (const match of text.matchAll(/["'`]([^"'`<>\n]+)["'`]|url\(\s*([^\s)]+)\s*\)/g)) reference(match[1] ?? match[2], file);
		}
	}
	const sourceFiles = runtimeFiles(root);
	for (const file of sourceFiles) scan(file);
	// Node's backend font loader uses path.join with separate directory segments.
	for (const file of assets) if (file.startsWith(path.join(publicRoot, 'fonts') + path.sep)) retain(file, 'frontend and backend font loaders');
	for (const prefix of keep) {
		if (prefix === '/' || prefix === 'public/') for (const asset of assets) retain(asset, 'explicit public root retention');
		else reference(prefix.startsWith('/') ? prefix : '/' + prefix.replace(/^public\//, ''), path.join(root, 'asset-audit-keep'));
	}
	for (let i = 0; i < queue.length; i++) scan(queue[i]);
	const describe = file => ({ path: path.relative(root, file), bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) });
	const removed = assets.filter(file => !kept.has(file)).map(describe);
	const retained = assets.filter(file => kept.has(file)).map(file => ({...describe(file), reason:kept.get(file)}));
	return { version:1, root, sourceFiles:sourceFiles.map(file=>path.relative(root,file)), warnings:[...warnings], inputs:Object.fromEntries(inputs), removed, retained, summary:{ beforeBytes:assets.reduce((sum,f)=>sum+fs.statSync(f).size,0), afterBytes:retained.reduce((sum,f)=>sum+f.bytes,0), removedBytes:removed.reduce((sum,f)=>sum+f.bytes,0), removedCount:removed.length, retainedCount:retained.length } };
}
function checkedPath(root, relative) {
	if (path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid asset audit path');
	let cursor = root;
	for (const part of relative.split('/')) {
		cursor = path.join(cursor, part);
		if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Asset audit refuses symbolic links');
	}
	return cursor;
}
export function applyAudit(manifest) {
	if (manifest.version !== 1) throw new Error('Unsupported asset audit');
	const root = fs.realpathSync(manifest.root);
	if (!fs.existsSync(path.join(root, '.vpk-source.json'))) throw new Error('Asset pruning requires an extracted target with .vpk-source.json; never prune VPK source');
	if (JSON.stringify(runtimeFiles(root).map(file=>path.relative(root,file))) !== JSON.stringify(manifest.sourceFiles)) throw new Error('Source file inventory changed after review');
	const reviewedAssets = [...manifest.retained, ...manifest.removed].map(item=>item.path).sort();
	if (JSON.stringify(walk(path.join(root,'public')).map(file=>path.relative(root,file)).sort()) !== JSON.stringify(reviewedAssets)) throw new Error('Public file inventory changed after review');
	for (const [relative, expected] of Object.entries(manifest.inputs)) if (hash(fs.readFileSync(checkedPath(root, relative))) !== expected) throw new Error(`Source changed after review: ${relative}`);
	for (const item of manifest.removed) {
		if (!item.path.startsWith('public/') || item.path.split('/').includes('..')) throw new Error('Invalid public asset path');
		const file = checkedPath(root, item.path);
		if (hash(fs.readFileSync(file)) !== item.sha256) throw new Error(`Asset changed after review: ${item.path}`);
	}
	for (const item of manifest.removed) {
		const file = checkedPath(root, item.path);
		if (hash(fs.readFileSync(file)) !== item.sha256) throw new Error(`Asset changed during apply: ${item.path}`);
		fs.unlinkSync(file);
	}
	console.log(JSON.stringify(manifest.summary, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [mode, file, output] = process.argv.slice(2);
	if (mode === '--apply') applyAudit(JSON.parse(fs.readFileSync(file)));
	else if (mode === '--plan' && file && output) {
		const extra=process.argv.slice(5), keep=[];
		for (let i=0; i<extra.length; i++) {if (extra[i] !== '--keep' || !extra[i+1]) throw new Error('Expected --keep <public path>'); keep.push(extra[++i]);}
		const plan=audit(file, {keep});fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({summary:plan.summary,warnings:plan.warnings},null,2));
	}
	else throw new Error('Usage: audit-public-assets.mjs --plan <project> <manifest> [--keep /runtime-directory] | --apply <manifest>');
}
