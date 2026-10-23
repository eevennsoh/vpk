"use client";

import { useCallback } from "react";
import type { ReactNode, RefObject } from "react";
import DevicesIcon from "@atlaskit/icon/core/devices";
import DownloadIcon from "@atlaskit/icon/core/download";
import PrinterIcon from "@atlaskit/icon/core/printer";
import ShareIcon from "@atlaskit/icon/core/share";
import ThemeIcon from "@atlaskit/icon/core/theme";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
	getHtmlDownloadFileName,
	getJsonErrorMessage,
	getVpkHtmlArtifactApiPath,
} from "@/components/blocks/html-selector/lib/artifact-actions";
import { isLocalArtifactPage } from "@/components/blocks/html-selector/lib/page-path";
import { useArtifactTheme } from "../hooks/use-artifact-theme";
import { useArtifactNotes } from "../hooks/use-artifact-notes";
import type { AgentId, HtmlSelectorNotification } from "../lib/types";
import { ArtifactNotesPopover } from "./artifact-notes-popover";
import { ArtifactPublishDialog } from "./artifact-publish-dialog";
import { ArtifactVideoDialog } from "./artifact-video-dialog";

const LOCAL_PUBLISH_HINT = "Publish artifacts with build.mjs --publish (runs the preflight scan)";

interface ArtifactActionBarProps {
	agent: AgentId;
	className?: string;
	iframeRef: RefObject<HTMLIFrameElement | null>;
	onNotify: (notification: HtmlSelectorNotification) => void;
	pagePath: string;
	repoRoot?: string;
}

async function getAssetErrorMessage(response: Response): Promise<string> {
	try {
		const payload = await response.json() as { error?: unknown; details?: unknown };
		return getJsonErrorMessage(payload, "Failed to download artifact.");
	} catch {
		return "Failed to download artifact.";
	}
}

function ToolbarTooltip({
	children,
	content,
}: Readonly<{
	children: ReactNode;
	content: string;
}>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<span className="inline-flex">{children}</span>} />
			<TooltipContent side="bottom">{content}</TooltipContent>
		</Tooltip>
	);
}

export function ArtifactActionBar({
	agent,
	className,
	iframeRef,
	onNotify,
	pagePath,
	repoRoot,
}: Readonly<ArtifactActionBarProps>) {
	const isArtifactPage = pagePath !== "srcdoc";
	const isLocalPage = isLocalArtifactPage(pagePath);
	const notesState = useArtifactNotes(pagePath, onNotify);
	const {
		cycleTheme,
		themeChoice: artifactThemeChoice,
		themeLabel: artifactThemeLabel,
		themeMode: artifactThemeMode,
	} = useArtifactTheme({
		iframeRef,
		onNotify,
		pagePath,
	});

	const handlePrint = useCallback(() => {
		try {
			const frameWindow = iframeRef.current?.contentWindow;
			if (!frameWindow) {
				onNotify({ type: "error", message: "Artifact frame is not ready." });
				return;
			}
			frameWindow.focus();
			frameWindow.print();
		} catch (error) {
			onNotify({ type: "error", message: error instanceof Error ? error.message : String(error) });
		}
	}, [iframeRef, onNotify]);

	const handleDownload = useCallback(async () => {
		if (!isArtifactPage) {
			onNotify({ type: "error", message: "Download is available for saved vpk-html artifacts." });
			return;
		}

		try {
			const response = await fetch(getVpkHtmlArtifactApiPath(pagePath), { cache: "no-store" });
			if (!response.ok) {
				throw new Error(await getAssetErrorMessage(response));
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = getHtmlDownloadFileName(pagePath);
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			onNotify({ type: "success", message: "Downloaded artifact HTML." });
		} catch (error) {
			onNotify({ type: "error", message: error instanceof Error ? error.message : String(error) });
		}
	}, [isArtifactPage, onNotify, pagePath]);

	return (
		<div
			className={cn(
				"pointer-events-none absolute top-3 right-3 z-[150] flex max-w-[calc(100%-1.5rem)] justify-end",
				className,
			)}
		>
			<TooltipProvider>
				<div
					data-artifact-control-bar=""
					data-artifact-color-mode={artifactThemeMode}
					className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 rounded-lg p-1"
				>
					<ToolbarTooltip content="Print or save as PDF">
						<Button
							type="button"
							variant="ghost"
							size="icon-compact"
							onClick={handlePrint}
							title="Print or save as PDF"
							aria-label="Print or save as PDF"
						>
							<PrinterIcon label="" />
						</Button>
					</ToolbarTooltip>
					<ToolbarTooltip content={isArtifactPage ? "Download current HTML" : "Download is available for saved vpk-html artifacts."}>
						<Button
							type="button"
							variant="ghost"
							size="icon-compact"
							onClick={() => {
								void handleDownload();
							}}
							disabled={!isArtifactPage}
							title={isArtifactPage ? "Download current HTML" : "Download is available for saved vpk-html artifacts."}
							aria-label="Download current HTML"
						>
							<DownloadIcon label="" />
						</Button>
					</ToolbarTooltip>
					<ArtifactNotesPopover
						disabled={!isArtifactPage}
						error={notesState.error}
						isDirty={notesState.isDirty}
						loadNotes={notesState.loadNotes}
						notes={notesState.notes}
						saveNotes={notesState.saveNotes}
						setNotes={notesState.setNotes}
						status={notesState.status}
					/>
					<ArtifactVideoDialog
						agent={agent}
						disabled={!isArtifactPage}
						loadNotes={notesState.loadNotes}
						notes={notesState.notes}
						onNotify={onNotify}
						pagePath={pagePath}
						repoRoot={repoRoot}
					/>
					{isLocalPage ? (
						<ToolbarTooltip content={LOCAL_PUBLISH_HINT}>
							<Button
								type="button"
								variant="ghost"
								size="icon-compact"
								disabled
								title={LOCAL_PUBLISH_HINT}
								aria-label="Publish to GitHub Gist"
							>
								<ShareIcon label="" />
							</Button>
						</ToolbarTooltip>
					) : (
						<ArtifactPublishDialog
							disabled={!isArtifactPage}
							onNotify={onNotify}
							pagePath={pagePath}
						/>
					)}
					<ToolbarTooltip content={artifactThemeLabel}>
						<Button
							type="button"
							variant="ghost"
							size="icon-compact"
							onClick={cycleTheme}
							aria-label={artifactThemeLabel}
							className="ml-1"
						>
							{artifactThemeChoice === "system" ? <DevicesIcon label="" /> : <ThemeIcon label="" />}
						</Button>
					</ToolbarTooltip>
				</div>
			</TooltipProvider>
		</div>
	);
}
