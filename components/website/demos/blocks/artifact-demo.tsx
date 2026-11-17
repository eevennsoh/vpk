"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import {
	Artifact,
	ArtifactAction,
	ArtifactActions,
	ArtifactCard,
	ArtifactClose,
	ArtifactContent,
	ArtifactDescription,
	ArtifactHeader,
	ArtifactPanel,
	ArtifactTitle,
	type ArtifactDocument,
} from "@/components/blocks/artifact";
import { useArtifactAnnotations } from "@/components/ui-custom/hooks/use-artifact-annotations";
import { CodeBlock } from "@/components/ui/code-block";
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CopyIcon, DownloadIcon, PlayIcon, RefreshCwIcon, ShareIcon } from "@/components/ui/vpk-icons";

const dijkstraCode = `# Dijkstra's Algorithm implementation
import heapq

def dijkstra(graph, start):
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    heap = [(0, start)]
    visited = set()

    while heap:
        current_distance, current_node = heapq.heappop(heap)
        if current_node in visited:
            continue
        visited.add(current_node)

        for neighbor, weight in graph[current_node].items():
            distance = current_distance + weight
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                heapq.heappush(heap, (distance, neighbor))

    return distances

# Example graph
graph = {
    'A': {'B': 1, 'C': 4},
    'B': {'A': 1, 'C': 2, 'D': 5},
    'C': {'A': 4, 'B': 2, 'D': 1},
    'D': {'B': 5, 'C': 1}
}

print(dijkstra(graph, "A"))`;

const dijkstraCodeV2 = `# Dijkstra's Algorithm — optimized with early exit
import heapq

def dijkstra(graph, start, target=None):
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    previous = {node: None for node in graph}
    heap = [(0, start)]
    visited = set()

    while heap:
        current_distance, current_node = heapq.heappop(heap)
        if current_node in visited:
            continue
        visited.add(current_node)

        # Early exit if we reached the target
        if target and current_node == target:
            break

        for neighbor, weight in graph[current_node].items():
            distance = current_distance + weight
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous[neighbor] = current_node
                heapq.heappush(heap, (distance, neighbor))

    return distances, previous

def shortest_path(graph, start, target):
    distances, previous = dijkstra(graph, start, target)
    path = []
    current = target
    while current is not None:
        path.append(current)
        current = previous[current]
    return list(reversed(path)), distances[target]

graph = {
    'A': {'B': 1, 'C': 4},
    'B': {'A': 1, 'C': 2, 'D': 5},
    'C': {'A': 4, 'B': 2, 'D': 1},
    'D': {'B': 5, 'C': 1}
}

path, cost = shortest_path(graph, 'A', 'D')
print(f"Shortest path: {' -> '.join(path)} (cost: {cost})")`;

const now = new Date().toISOString();
const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

function createMockDocument(): ArtifactDocument {
	return {
		id: "demo-artifact-1",
		title: "Dijkstra's Algorithm",
		kind: "code",
		versions: [
			{
				id: "v1",
				content: dijkstraCode,
				title: "Dijkstra's Algorithm",
				changeLabel: "Initial implementation",
				createdAt: fiveMinAgo,
			},
			{
				id: "v2",
				content: dijkstraCodeV2,
				title: "Dijkstra's Algorithm",
				changeLabel: "Added early exit & path reconstruction",
				createdAt: now,
			},
		],
		createdAt: fiveMinAgo,
		updatedAt: now,
	};
}

const SPLIT_BREAKPOINT = 800;

export function ArtifactDemoCodePreview() {
	const [isOpen, setIsOpen] = useState(false);
	const [artifactDocument] = useState(createMockDocument);
	const [draftContent, setDraftContent] = useState(artifactDocument.versions[1]?.content ?? "");
	const [mode, setMode] = useState<"preview" | "edit">("preview");
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>("v2");
	const [cursorMode, setCursorMode] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const shellRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
	const [artifactOrigin, setArtifactOrigin] = useState({
		left: 0,
		top: 0,
		width: 320,
		height: 96,
	});

	const {
		annotations,
		pendingSelection,
		addComment,
		dismissSelection,
		removeAnnotation,
		clearAnnotations,
		refreshPositions,
	} = useArtifactAnnotations({
		active: cursorMode && isOpen,
		documentId: artifactDocument.id,
		documentKind: artifactDocument.kind,
		documentVersionId: selectedVersionId,
		containerRef: contentRef,
	});

	useEffect(() => {
		const shellElement = shellRef.current;
		if (!shellElement || typeof ResizeObserver === "undefined") {
			return;
		}

		const updateBounds = () => {
			setShellSize((prev) => {
				const width = shellElement.clientWidth;
				const height = shellElement.clientHeight;
				return prev.width === width && prev.height === height
					? prev
					: { width, height };
			});
		};

		updateBounds();
		const observer = new ResizeObserver(() => {
			updateBounds();
		});
		observer.observe(shellElement);
		return () => observer.disconnect();
	}, []);

	const shouldSplit = isOpen && shellSize.width >= SPLIT_BREAKPOINT;

	const handleOpen = useCallback(() => {
		const cardElement = cardRef.current;
		const shellElement = shellRef.current;
		if (cardElement && shellElement) {
			const cardRect = cardElement.getBoundingClientRect();
			const shellRect = shellElement.getBoundingClientRect();
			setArtifactOrigin({
				left: Math.max(cardRect.left - shellRect.left, 16),
				top: Math.max(cardRect.top - shellRect.top, 16),
				width: Math.min(Math.max(cardRect.width, 260), 420),
				height: Math.min(Math.max(cardRect.height, 40), 140),
			});
		}
		setIsOpen(true);
	}, []);

	const handleClose = useCallback(() => {
		setIsOpen(false);
		setCursorMode(false);
		clearAnnotations();
	}, [clearAnnotations]);

	const handleVersionChange = useCallback((versionId: string | null) => {
		setSelectedVersionId(versionId);
		const version = artifactDocument.versions.find((v) => v.id === versionId);
		if (version) {
			setDraftContent(version.content);
		}
		setMode("preview");
		refreshPositions();
	}, [artifactDocument.versions, refreshPositions]);

	const handleSave = useCallback(async () => {
		setMode("preview");
	}, []);

	const handleDelete = useCallback(async () => {
		handleClose();
	}, [handleClose]);

	const artifactPanel = (
		<ArtifactPanel
				annotations={annotations}
				contentRef={contentRef}
				cursorMode={cursorMode}
				document={artifactDocument}
			draftContent={draftContent}
			mode={mode}
			onAddComment={addComment}
			onClose={handleClose}
			onCursorModeChange={setCursorMode}
			onDelete={handleDelete}
			onDismissSelection={dismissSelection}
			onDraftChange={setDraftContent}
			onModeChange={setMode}
			onRemoveAnnotation={removeAnnotation}
			onSave={handleSave}
			onVersionChange={handleVersionChange}
			pendingSelection={pendingSelection}
			selectedVersionId={selectedVersionId}
		/>
	);

	const cardPane = (
		<div className="h-full overflow-auto p-4">
			<div ref={cardRef}>
				<ArtifactCard
					kind="code"
					onOpen={handleOpen}
					previewContent={dijkstraCode}
					title="Dijkstra's Algorithm"
				/>
			</div>
		</div>
	);

	return (
		<div ref={shellRef} className="relative h-[600px] w-full overflow-hidden rounded-lg border">
			{shouldSplit ? (
				<ResizablePanelGroup className="h-full w-full" orientation="horizontal">
					<ResizablePanel defaultSize={400} id="demo-chat" minSize={250}>
						{cardPane}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={500} id="demo-artifact" minSize={300}>
						{artifactPanel}
					</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				cardPane
			)}
			<AnimatePresence>
				{!shouldSplit && isOpen ? (
							<motion.div
								key="artifact-panel"
								animate={{
									opacity: 1,
									x: 0,
									y: 0,
									width: shellSize.width || "100%",
									height: shellSize.height || "100%",
									borderRadius: 0,
									transition: {
										delay: 0,
										type: "spring",
										stiffness: 300,
										damping: 30,
									},
								}}
								className="absolute top-0 left-0 z-40 flex h-full flex-col overflow-hidden border-border bg-background md:border-l"
								exit={{
									opacity: 0,
									scale: 0.5,
									transition: {
										delay: 0.1,
										type: "spring",
										stiffness: 600,
										damping: 30,
									},
								}}
								initial={{
									opacity: 1,
									x: artifactOrigin.left,
									y: artifactOrigin.top,
									width: artifactOrigin.width,
									height: artifactOrigin.height,
									borderRadius: 32,
								}}
							>
								{artifactPanel}
							</motion.div>
						) : null}
			</AnimatePresence>
		</div>
	);
}

export function ArtifactDemoImagePreview() {
	const [isOpen, setIsOpen] = useState(false);
	const imageUrl = "https://picsum.photos/seed/artifact/1280/800";
	const contentRef = useRef<HTMLDivElement>(null);
	const shellRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
	const [artifactOrigin, setArtifactOrigin] = useState({
		left: 0,
		top: 0,
		width: 320,
		height: 96,
	});

	const imageDocument: ArtifactDocument = {
		id: "demo-image-1",
		title: "Generated Landscape",
		kind: "image",
		versions: [
			{
				id: "img-v1",
				content: imageUrl,
				title: "Generated Landscape",
				changeLabel: "Generated image",
				createdAt: now,
			},
		],
		createdAt: now,
		updatedAt: now,
	};

	const [draftContent, setDraftContent] = useState(imageUrl);
	const [mode, setMode] = useState<"preview" | "edit">("preview");
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>("img-v1");

	useEffect(() => {
		const shellElement = shellRef.current;
		if (!shellElement || typeof ResizeObserver === "undefined") {
			return;
		}

		const updateBounds = () => {
			setShellSize((prev) => {
				const width = shellElement.clientWidth;
				const height = shellElement.clientHeight;
				return prev.width === width && prev.height === height
					? prev
					: { width, height };
			});
		};

		updateBounds();
		const observer = new ResizeObserver(() => {
			updateBounds();
		});
		observer.observe(shellElement);
		return () => observer.disconnect();
	}, []);

	const shouldSplit = isOpen && shellSize.width >= SPLIT_BREAKPOINT;

	const handleOpen = useCallback(() => {
		const cardElement = cardRef.current;
		const shellElement = shellRef.current;
		if (cardElement && shellElement) {
			const cardRect = cardElement.getBoundingClientRect();
			const shellRect = shellElement.getBoundingClientRect();
			setArtifactOrigin({
				left: Math.max(cardRect.left - shellRect.left, 16),
				top: Math.max(cardRect.top - shellRect.top, 16),
				width: Math.min(Math.max(cardRect.width, 260), 420),
				height: Math.min(Math.max(cardRect.height, 40), 140),
			});
		}
		setIsOpen(true);
	}, []);

	const artifactPanel = (
		<ArtifactPanel
			contentRef={contentRef}
			document={imageDocument}
			draftContent={draftContent}
			mode={mode}
			onClose={() => setIsOpen(false)}
			onDelete={async () => setIsOpen(false)}
			onDraftChange={setDraftContent}
			onModeChange={setMode}
			onSave={async () => setMode("preview")}
			onVersionChange={setSelectedVersionId}
			selectedVersionId={selectedVersionId}
		/>
	);

	const cardPane = (
		<div className="h-full overflow-auto p-4">
			<div ref={cardRef}>
				<ArtifactCard
					kind="image"
					onOpen={handleOpen}
					previewContent={imageUrl}
					title="Generated Landscape"
				/>
			</div>
		</div>
	);

	return (
		<div ref={shellRef} className="relative h-[500px] w-full overflow-hidden rounded-lg border">
			{shouldSplit ? (
				<ResizablePanelGroup className="h-full w-full" orientation="horizontal">
					<ResizablePanel defaultSize={400} id="demo-img-chat" minSize={250}>
						{cardPane}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={500} id="demo-img-artifact" minSize={300}>
						{artifactPanel}
					</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				cardPane
			)}
			<AnimatePresence>
				{!shouldSplit && isOpen ? (
							<motion.div
								key="image-artifact-panel"
								animate={{
									opacity: 1,
									x: 0,
									y: 0,
									width: shellSize.width || "100%",
									height: shellSize.height || "100%",
									borderRadius: 0,
									transition: {
										delay: 0,
										type: "spring",
										stiffness: 300,
										damping: 30,
									},
								}}
								className="absolute top-0 left-0 z-40 flex h-full flex-col overflow-hidden border-border bg-background md:border-l"
								exit={{
									opacity: 0,
									scale: 0.5,
									transition: {
										delay: 0.1,
										type: "spring",
										stiffness: 600,
										damping: 30,
									},
								}}
								initial={{
									opacity: 1,
									x: artifactOrigin.left,
									y: artifactOrigin.top,
									width: artifactOrigin.width,
									height: artifactOrigin.height,
									borderRadius: 32,
								}}
							>
								{artifactPanel}
							</motion.div>
						) : null}
			</AnimatePresence>
		</div>
	);
}

export function ArtifactDemoStreaming() {
	return (
		<ArtifactCard
			action="create"
			isStreaming
			kind="text"
			previewContent=""
			title="Project README"
		/>
	);
}

export function ArtifactDemoChip() {
	return (
		<ArtifactCard
			action="create"
			displayMode="chip"
			kind="sheet"
			onOpen={() => console.log("Open sheet artifact")}
			previewContent="| Name | Role | Status |\n|------|------|--------|\n| Alice | Engineer | Active |"
			title="Team Roster"
		/>
	);
}

export function ArtifactDemoCompound() {
	return (
		<Artifact className="w-full">
			<ArtifactHeader>
				<div>
					<ArtifactTitle>Dijkstra&apos;s Algorithm Implementation</ArtifactTitle>
					<ArtifactDescription>Updated 1 minute ago</ArtifactDescription>
				</div>
				<div className="flex items-center gap-2">
					<ArtifactActions>
						<ArtifactAction
							icon={PlayIcon}
							label="Run"
							onClick={() => console.log("Run")}
							tooltip="Run code"
						/>
						<ArtifactAction
							icon={CopyIcon}
							label="Copy"
							onClick={() => console.log("Copy")}
							tooltip="Copy to clipboard"
						/>
						<ArtifactAction
							icon={RefreshCwIcon}
							label="Regenerate"
							onClick={() => console.log("Regenerate")}
							tooltip="Regenerate content"
						/>
						<ArtifactAction
							icon={DownloadIcon}
							label="Download"
							onClick={() => console.log("Download")}
							tooltip="Download file"
						/>
						<ArtifactAction
							icon={ShareIcon}
							label="Share"
							onClick={() => console.log("Share")}
							tooltip="Share artifact"
						/>
					</ArtifactActions>
					<ArtifactClose />
				</div>
			</ArtifactHeader>
			<ArtifactContent className="p-0">
				<CodeBlock className="rounded-none ring-0">
					<HighlightedCodeContent code={dijkstraCode} language="python" lineNumbers />
				</CodeBlock>
			</ArtifactContent>
		</Artifact>
	);
}

export default function ArtifactDemo() {
	return <ArtifactDemoCodePreview />;
}
