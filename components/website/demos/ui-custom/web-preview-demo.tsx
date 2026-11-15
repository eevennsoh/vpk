"use client";

import { useCallback, useState } from "react";
import {
	WebPreview,
	WebPreviewNavigation,
	WebPreviewNavigationButton,
	WebPreviewUrl,
	WebPreviewBody,
	WebPreviewConsole,
} from "@/components/ui-custom/web-preview";
import { ArrowLeftIcon as ArrowLeft, ArrowRightIcon as ArrowRight, ExternalLinkIcon as ExternalLink, MaximizeIcon as Maximize2, MousePointerClickIcon as MousePointerClick, RotateCwIcon as RotateCw } from "@/components/ui/vpk-icons";

// The backend runs one shared Chromium session, so only the External URL demo uses it; the others
// stay on the iframe engine so the catalog page's instances don't drive each other's navigation.
const EXAMPLE_URL = "https://www.theverge.com";

const SAMPLE_LOGS = [
	{ level: "log" as const, message: "Page loaded successfully", timestamp: new Date("2025-01-15T10:30:00") },
	{ level: "warn" as const, message: "Deprecated API usage detected", timestamp: new Date("2025-01-15T10:30:02") },
	{ level: "error" as const, message: "Failed to fetch resource: 404 Not Found", timestamp: new Date("2025-01-15T10:30:04") },
];

export function WebPreviewDemoBasic() {
	return (
		<WebPreview defaultUrl={EXAMPLE_URL} engine="iframe" className="h-[400px]">
			<WebPreviewNavigation>
				<WebPreviewNavigationButton action="back" tooltip="Back">
					<ArrowLeft className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="forward" tooltip="Forward">
					<ArrowRight className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="reload" tooltip="Reload">
					<RotateCw className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewUrl />
			</WebPreviewNavigation>
			<WebPreviewBody />
		</WebPreview>
	);
}

export function WebPreviewDemoWithConsole() {
	return (
		<WebPreview defaultUrl={EXAMPLE_URL} engine="iframe" className="h-[400px]">
			<WebPreviewNavigation>
				<WebPreviewNavigationButton action="back" tooltip="Back">
					<ArrowLeft className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="forward" tooltip="Forward">
					<ArrowRight className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="reload" tooltip="Reload">
					<RotateCw className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewUrl />
			</WebPreviewNavigation>
			<WebPreviewBody />
			<WebPreviewConsole logs={SAMPLE_LOGS} />
		</WebPreview>
	);
}

export function WebPreviewDemoFullscreen() {
	const [, setFullscreen] = useState(false);

	const handleToggleFullscreen = useCallback(
		() => setFullscreen((prev) => !prev),
		[]
	);

	return (
		<WebPreview defaultUrl={EXAMPLE_URL} engine="iframe" className="h-[400px]">
			<WebPreviewNavigation>
				<WebPreviewNavigationButton action="back" tooltip="Back">
					<ArrowLeft className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="forward" tooltip="Forward">
					<ArrowRight className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="reload" tooltip="Reload">
					<RotateCw className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewUrl />
				<WebPreviewNavigationButton tooltip="Select">
					<MousePointerClick className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton tooltip="Open in new tab">
					<ExternalLink className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton tooltip="Maximize" onClick={handleToggleFullscreen}>
					<Maximize2 className="size-4" />
				</WebPreviewNavigationButton>
			</WebPreviewNavigation>
			<WebPreviewBody />
		</WebPreview>
	);
}

export function WebPreviewDemoUrlChange() {
	const [lastUrl, setLastUrl] = useState(EXAMPLE_URL);

	return (
		<div className="flex w-full flex-col gap-3">
			<div className="text-sm text-muted-foreground">
				Last navigated URL: <code className="rounded bg-muted px-1 py-0.5">{lastUrl}</code>
			</div>
			<WebPreview defaultUrl={EXAMPLE_URL} engine="iframe" onUrlChange={setLastUrl} className="h-[400px]">
				<WebPreviewNavigation>
					<WebPreviewNavigationButton action="back" tooltip="Back">
						<ArrowLeft className="size-4" />
					</WebPreviewNavigationButton>
					<WebPreviewNavigationButton action="forward" tooltip="Forward">
						<ArrowRight className="size-4" />
					</WebPreviewNavigationButton>
					<WebPreviewNavigationButton action="reload" tooltip="Reload">
						<RotateCw className="size-4" />
					</WebPreviewNavigationButton>
					<WebPreviewUrl />
				</WebPreviewNavigation>
				<WebPreviewBody />
			</WebPreview>
		</div>
	);
}

export function WebPreviewDemoExternal() {
	return (
		<WebPreview defaultUrl="https://www.theverge.com" className="h-[400px]">
			<WebPreviewNavigation>
				<WebPreviewNavigationButton action="back" tooltip="Back">
					<ArrowLeft className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="forward" tooltip="Forward">
					<ArrowRight className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="reload" tooltip="Reload">
					<RotateCw className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewUrl />
			</WebPreviewNavigation>
			<WebPreviewBody />
		</WebPreview>
	);
}

export default function WebPreviewDemo() {
	const [, setFullscreen] = useState(false);

	const handleToggleFullscreen = useCallback(
		() => setFullscreen((prev) => !prev),
		[]
	);

	return (
		<WebPreview defaultUrl="/" onUrlChange={(url) => console.log("URL changed to:", url)} className="h-[400px]">
			<WebPreviewNavigation>
				<WebPreviewNavigationButton action="back" tooltip="Go back">
					<ArrowLeft className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="forward" tooltip="Go forward">
					<ArrowRight className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton action="reload" tooltip="Reload">
					<RotateCw className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewUrl />
				<WebPreviewNavigationButton tooltip="Select">
					<MousePointerClick className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton tooltip="Open in new tab">
					<ExternalLink className="size-4" />
				</WebPreviewNavigationButton>
				<WebPreviewNavigationButton tooltip="Maximize" onClick={handleToggleFullscreen}>
					<Maximize2 className="size-4" />
				</WebPreviewNavigationButton>
			</WebPreviewNavigation>
			<WebPreviewBody />
			<WebPreviewConsole logs={SAMPLE_LOGS} />
		</WebPreview>
	);
}
