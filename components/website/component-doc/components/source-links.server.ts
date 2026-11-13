import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { ExternalLinkDefinition } from "@/app/data/component-detail-types";

export interface DocImportReference {
	path: string;
	links: Array<{ label: "Bitbucket" | "GitHub"; href: string }>;
}

export function getDocImportReferences(importPath: string): DocImportReference[] {
	return importPath.split("\n").map(path => path.trim()).filter(Boolean).map((path): DocImportReference => {
		if (!path.startsWith("@/")) return { path, links: [] };
		const relativePath = path.slice(2);
		const candidates = [relativePath, ...[".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"].map(extension => relativePath + extension)];
		const sourcePath = candidates.find(candidate => statSync(resolve(candidate), { throwIfNoEntry: false }));
		if (!sourcePath) return { path, links: [] };
		const sourceKind = statSync(resolve(sourcePath)).isDirectory() ? "tree" : "blob";
		const encodedPath = sourcePath.split("/").map(encodeURIComponent).join("/");
		return {
			path,
			links: [
				{ label: "Bitbucket", href: `https://bitbucket.org/atlassian/vpk/src/main/${encodedPath}` },
				{ label: "GitHub", href: `https://github.com/eevennsoh/vpk/${sourceKind}/main/${encodedPath}` },
			],
		};
	});
}

export function getDocReferenceLinks(links: ExternalLinkDefinition[] = []): ExternalLinkDefinition[] {
	return links.filter(link => !link.label.includes("@atlaskit/")
		&& !["atlassian.design", "atlaskit.atlassian.com"].includes(new URL(link.url).hostname));
}
