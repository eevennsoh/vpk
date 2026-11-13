"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PreviewExcalidrawScene } from "@/components/projects/shared/lib/generative-widget";

interface ExcalidrawPreviewProps {
	scene: PreviewExcalidrawScene;
	className?: string;
	heightClassName?: string;
}

interface ExcalidrawModule {
	Excalidraw: ComponentType<Record<string, unknown>>;
	restoreAppState: typeof import("@excalidraw/excalidraw").restoreAppState;
	restoreElements: typeof import("@excalidraw/excalidraw").restoreElements;
}

export function ExcalidrawPreview({
	scene,
	className,
	heightClassName = "h-[320px]",
}: Readonly<ExcalidrawPreviewProps>): ReactNode {
	const [mod, setMod] = useState<ExcalidrawModule | null>(null);

	useEffect(() => {
		let cancelled = false;
		import("@/components/projects/shared/components/excalidraw-runtime")
			.then((m) => {
				if (!cancelled) {
					setMod({ Excalidraw: m.Excalidraw, restoreAppState: m.restoreAppState, restoreElements: m.restoreElements });
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					console.error("Unable to load Excalidraw preview", error);
				}
			});
		return () => { cancelled = true; };
	}, []);

	if (!mod) {
		return (
			<div className={cn("overflow-hidden rounded-md border border-border bg-background", heightClassName, className)} />
		);
	}

	const { Excalidraw, restoreAppState, restoreElements } = mod;

	const initialData = {
		...(scene.type ? { type: scene.type } : {}),
		...(scene.version !== undefined ? { version: scene.version } : {}),
		...(scene.source ? { source: scene.source } : {}),
		elements: restoreElements(scene.elements as never[], null),
		appState: restoreAppState({
			viewModeEnabled: true,
			...(scene.appState ?? {}),
		}, null),
		...(scene.files ? { files: scene.files } : {}),
		scrollToContent: true,
	};

	return (
		<div className={cn("overflow-hidden rounded-md border border-border bg-background", heightClassName, className)}>
			<Excalidraw
				initialData={initialData}
				isCollaborating={false}
				viewModeEnabled
				UIOptions={{
					canvasActions: {
						changeViewBackgroundColor: false,
						clearCanvas: false,
						export: false,
						loadScene: false,
						saveToActiveFile: false,
						saveAsImage: false,
						toggleTheme: false,
					},
				}}
			/>
		</div>
	);
}
