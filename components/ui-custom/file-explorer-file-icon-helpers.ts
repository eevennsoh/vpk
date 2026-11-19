import {
	getBuiltInSpriteSheet,
	type FileTreeBuiltInIconSet,
	type FileTreeIcons,
} from "@pierre/trees";

export type FileExplorerIcons = FileTreeIcons;

export const fileExplorerIconColorStyles: Readonly<Record<string, string>> = {
	astro: "text-icon-accent-purple",
	babel: "text-icon-accent-yellow",
	bash: "text-icon-accent-green",
	biome: "text-icon-accent-blue",
	bootstrap: "text-icon-accent-purple",
	browserslist: "text-icon-accent-yellow",
	bun: "text-icon-accent-gray",
	c: "text-icon-accent-blue",
	claude: "text-icon-accent-orange",
	cpp: "text-icon-accent-blue",
	css: "text-icon-accent-purple",
	database: "text-icon-accent-purple",
	default: "text-icon-accent-gray",
	docker: "text-icon-accent-blue",
	eslint: "text-icon-accent-purple",
	font: "text-icon-accent-gray",
	git: "text-icon-accent-orange",
	go: "text-icon-accent-teal",
	graphql: "text-icon-accent-magenta",
	html: "text-icon-accent-orange",
	image: "text-icon-accent-magenta",
	javascript: "text-icon-accent-yellow",
	json: "text-icon-accent-orange",
	markdown: "text-icon-accent-green",
	mcp: "text-icon-accent-teal",
	nextjs: "text-icon-accent-gray",
	npm: "text-icon-accent-red",
	oxc: "text-icon-accent-teal",
	postcss: "text-icon-accent-red",
	prettier: "text-icon-accent-teal",
	python: "text-icon-accent-blue",
	react: "text-icon-accent-teal",
	ruby: "text-icon-accent-red",
	rust: "text-icon-accent-orange",
	sass: "text-icon-accent-magenta",
	stylelint: "text-icon-accent-gray",
	svelte: "text-icon-accent-red",
	svg: "text-icon-accent-orange",
	svgo: "text-icon-accent-green",
	swift: "text-icon-accent-orange",
	table: "text-icon-accent-teal",
	tailwind: "text-icon-accent-teal",
	terraform: "text-icon-accent-purple",
	text: "text-icon-accent-gray",
	typescript: "text-icon-accent-blue",
	vite: "text-icon-accent-purple",
	vscode: "text-icon-accent-blue",
	vue: "text-icon-accent-green",
	wasm: "text-icon-accent-purple",
	webpack: "text-icon-accent-blue",
	yml: "text-icon-accent-red",
	zig: "text-icon-accent-orange",
	zip: "text-icon-accent-orange",
};

export function getFileExplorerIconSet(icons: FileExplorerIcons | undefined): FileTreeBuiltInIconSet | "none" {
	if (!icons) {
		return "complete";
	}
	if (typeof icons === "string") {
		return icons;
	}
	if (icons.set) {
		return icons.set;
	}
	return icons.spriteSheet || icons.remap || icons.byFileName || icons.byFileNameContains || icons.byFileExtension
		? "none"
		: "complete";
}

export function getFileExplorerIconSpriteSheet(icons: FileExplorerIcons = "complete"): string {
	const iconSet = getFileExplorerIconSet(icons);
	return `${getBuiltInSpriteSheet(iconSet)}${typeof icons === "object" ? (icons.spriteSheet ?? "") : ""}`;
}
