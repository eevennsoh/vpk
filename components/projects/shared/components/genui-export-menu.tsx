"use client";

import { useState, useCallback } from "react";
import type { Spec } from "@json-render/react";
import type { GenerativeContentType } from "@/components/projects/shared/lib/generative-widget";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import DownloadIcon from "@atlaskit/icon/core/download";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

export type ExportFormat = "pdf" | "png" | "react-code";

interface FormatOption {
	format: ExportFormat;
	label: string;
}

const ALL_FORMATS: readonly FormatOption[] = [
	{ format: "pdf", label: "PDF" },
	{ format: "png", label: "Image" },
	{ format: "react-code", label: "Code" },
];

const DOCUMENT_TYPES = new Set<GenerativeContentType>([
	"text", "page", "table", "work-item", "board", "translation", "calendar", "feed", "ui", "other",
]);
const CHART_TYPES = new Set<GenerativeContentType>([
	"chart", "chart-bar", "chart-line", "chart-area", "chart-pie", "chart-radar", "chart-scatter",
]);
const MESSAGE_TYPES = new Set<GenerativeContentType>(["message"]);

function getAvailableFormats(contentType: GenerativeContentType): ExportFormat[] {
	if (CHART_TYPES.has(contentType)) return ["pdf", "png", "react-code"];
	if (MESSAGE_TYPES.has(contentType)) return ["pdf", "react-code"];
	if (contentType === "code") return ["react-code"];
	if (contentType === "image") return ["png"];
	if (DOCUMENT_TYPES.has(contentType)) return ["pdf", "png", "react-code"];
	return ["pdf", "png", "react-code"];
}

interface GenuiExportMenuProps {
	readonly spec: Spec;
	readonly title?: string;
	readonly contentType: GenerativeContentType;
	readonly state?: Record<string, unknown>;
}

export function GenuiExportMenu({ spec, title, contentType, state }: GenuiExportMenuProps) {
	const [exporting, setExporting] = useState<ExportFormat | null>(null);

	const availableFormats = getAvailableFormats(contentType);
	const formatOptions = ALL_FORMATS.filter((f) => availableFormats.includes(f.format));

	const handleExport = useCallback(async (format: ExportFormat) => {
		setExporting(format);
		try {
			const response = await fetch("/api/genui-export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					spec,
					format,
					title: title ?? "export",
					state,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => "unknown error");
				console.error("[genui-export] HTTP", response.status, errorText);
				return;
			}

			const blob = await response.blob();
			const disposition = response.headers.get("content-disposition");
			const filenameMatch = disposition?.match(/filename="([^"]+)"/);
			const filename = filenameMatch?.[1] ?? `export.${format === "react-code" ? "tsx" : format}`;

			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			link.click();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error("[genui-export] Download failed:", error);
		} finally {
			setExporting(null);
		}
	}, [spec, title, state]);

	if (formatOptions.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						className="h-8 min-w-0 flex-shrink-0 gap-1.5 px-3 text-sm"
						disabled={exporting !== null}
					/>
				}
			>
				<DownloadIcon label="" size="small" />
				{exporting ? "Exporting..." : "Export"}
				<ChevronDownIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{formatOptions.map((option) => (
					<DropdownMenuItem
						key={option.format}
						disabled={exporting !== null}
						onClick={() => handleExport(option.format)}
					>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
