"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { resolveHtmlPageSrc } from "@/components/blocks/html-selector/lib/page-path";

const HtmlSelectorLazy = dynamic(
	() => import("@/components/blocks/html-selector").then((mod) => ({
		default: mod.HtmlSelector,
	})),
	{ ssr: false },
);

// /html?page=assets/demos/<demo>.html opens a catalog demo; in development,
// /html?page=local/<artifacts/vpk-html|output/vpk-html*>/…html opens a local artifact (ws1 §4.14).
export default function HtmlDemo() {
	const isDevelopment = process.env.NODE_ENV === "development";
	const src = resolveHtmlPageSrc(useSearchParams().get("page"), { allowLocal: isDevelopment });
	return isDevelopment ? (
		<HtmlSelectorLazy src={src} title="vpk-html index" />
	) : (
		<iframe
			src={src}
			title="vpk-html index"
			className="h-dvh min-h-0 w-full border-0 bg-surface"
		/>
	);
}
