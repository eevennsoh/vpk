import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const MOTION_HARNESS_PATH = "hooks/use-extraction-reduced-motion.ts";
export const MOTION_HARNESS_SOURCE = `"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
	const media = window.matchMedia(query);
	media.addEventListener("change", notify);
	return () => media.removeEventListener("change", notify);
};
const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => null;

export function useReducedMotion(): boolean | null {
	return useSyncExternalStore<boolean | null>(subscribe, getSnapshot, getServerSnapshot);
}
`;

function filesIn(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		if (entry.isSymbolicLink() || entry.name === "node_modules") return [];
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? filesIn(file)
			: entry.isFile() && /\.[cm]?[jt]sx?$/u.test(file) ? [file] : [];
	});
}

export function prepareHydrationSafeMotion(targetDir) {
	const edits = [];
	for (const directory of ["app", "components", "hooks", "lib"]) {
		for (const file of filesIn(path.join(targetDir, directory))) {
			const original = fs.readFileSync(file, "utf8");
			const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true);
			const replacements = [];
			for (const node of source.statements) {
				if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)
					|| node.moduleSpecifier.text !== "motion/react") continue;
				const clause = node.importClause;
				if (!clause || clause.isTypeOnly || !clause.namedBindings
					|| !ts.isNamedImports(clause.namedBindings)) continue;
				const moving = clause.namedBindings.elements.filter(item =>
					!item.isTypeOnly && (item.propertyName ?? item.name).text === "useReducedMotion");
				if (!moving.length) continue;
				const remaining = clause.namedBindings.elements.filter(item => !moving.includes(item));
				const imports = [];
				if (clause.name) imports.push(clause.name.getText(source));
				if (remaining.length) imports.push(`{ ${remaining.map(item => item.getText(source)).join(", ")} }`);
				const replacement = [
					...(imports.length ? [`import ${imports.join(", ")} from "motion/react";`] : []),
					`import { ${moving.map(item => item.getText(source)).join(", ")} } from "@/${MOTION_HARNESS_PATH.replace(/\.ts$/u, "")}";`,
				].join("\n");
				replacements.push({ start: node.getStart(source), end: node.end, replacement });
			}
			if (!replacements.length) continue;
			let updated = original;
			for (const edit of replacements.reverse()) {
				updated = updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
			}
			edits.push({ file, updated });
		}
	}
	if (!edits.length) return [];
	const harness = path.join(targetDir, MOTION_HARNESS_PATH);
	if (fs.existsSync(harness) && fs.readFileSync(harness, "utf8") !== MOTION_HARNESS_SOURCE) {
		throw new Error(`Refusing to overwrite an existing extraction harness: ${MOTION_HARNESS_PATH}`);
	}
	fs.mkdirSync(path.dirname(harness), { recursive: true });
	fs.writeFileSync(harness, MOTION_HARNESS_SOURCE);
	for (const edit of edits) fs.writeFileSync(edit.file, edit.updated);
	return edits.map(edit => path.relative(targetDir, edit.file)).sort();
}
