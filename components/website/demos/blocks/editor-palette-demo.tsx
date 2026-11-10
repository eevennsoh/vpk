"use client";

import EditorPalette from "@/components/blocks/editor-palette/page";

export default function EditorPaletteDemo() {
	return (
		<div className="flex w-full justify-center p-6">
			<EditorPalette />
		</div>
	);
}

export function EditorPaletteNested() {
	return (
		<div className="flex w-full justify-center p-6">
			<EditorPalette rowVariant="with-byline" variant="nested" />
		</div>
	);
}

export function EditorPaletteFlat() {
	return (
		<div className="flex w-full justify-center p-6">
			<EditorPalette variant="flat" />
		</div>
	);
}

export function EditorPaletteSearch() {
	return (
		<div className="flex w-full justify-center p-6">
			<EditorPalette variant="search" searchCategory="tool" showLiveEditor={false} />
		</div>
	);
}
