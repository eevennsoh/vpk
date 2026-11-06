"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow, type Node, type NodeProps, type Viewport } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { ThemeSelector } from "@/components/utils/theme-wrapper";
import { previews } from "./previews";

const STORAGE_KEY = "vpk:agent-selector-canvas:v1";
const LIMIT = 100000;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
type PreviewData = { name: string; previewId: string };
type PreviewNode = Node<PreviewData, "preview">;
type Saved = { version: 1; viewport: Viewport; positions: Record<string, { x: number; y: number }> };

function readLayout(): Saved | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw || raw.length > 10000) return null;
		const value: unknown = JSON.parse(raw);
		if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("viewport" in value) || !value.viewport || typeof value.viewport !== "object") return null;
		const viewport = value.viewport;
		if (!("x" in viewport) || !("y" in viewport) || !("zoom" in viewport) || !finite(viewport.x) || !finite(viewport.y) || !finite(viewport.zoom)) return null;
		const positions: Saved["positions"] = {};
		if ("positions" in value && value.positions && typeof value.positions === "object") {
			for (const preview of previews) {
				if (!(preview.id in value.positions)) continue;
				const position: unknown = Reflect.get(value.positions, preview.id);
				if (position && typeof position === "object" && "x" in position && "y" in position && finite(position.x) && finite(position.y)) positions[preview.id] = { x: clamp(position.x, -LIMIT, LIMIT), y: clamp(position.y, -LIMIT, LIMIT) };
			}
		}
		return { version: 1, viewport: { x: clamp(viewport.x, -LIMIT, LIMIT), y: clamp(viewport.y, -LIMIT, LIMIT), zoom: clamp(viewport.zoom, 0.35, 2) }, positions };
	} catch { return null; }
}

function Preview({ id, data }: NodeProps<PreviewNode>) {
	const { setNodes, getNodes, getViewport } = useReactFlow<PreviewNode>();
	const [copied, setCopied] = useState(false);
	const [copyUnavailable, setCopyUnavailable] = useState(false);
	const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveFrame = useRef<number | null>(null);
	useEffect(() => () => {
		if (copyTimer.current !== null) clearTimeout(copyTimer.current);
		if (saveFrame.current !== null) cancelAnimationFrame(saveFrame.current);
	}, []);
	const entry = previews.find((preview) => preview.id === data.previewId);
	if (!entry) return null;
	const Component = entry.component;
	return (
		<div style={{ width: entry.width }}>
			<div className="mb-2 flex items-center gap-2 text-sm font-medium text-text-subtle">
				<button className="canvas-handle cursor-default rounded-sm px-1 focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Move ${data.name}`} title="Drag or use arrow keys to move" onKeyDown={(event) => {
					const delta = event.shiftKey ? 50 : 10;
					const moves: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
					const move = moves[event.key];
					if (!move) return;
					event.preventDefault(); event.stopPropagation();
					setNodes((nodes) => nodes.map((node) => node.id === id ? { ...node, position: { x: clamp(node.position.x + move[0], -LIMIT, LIMIT), y: clamp(node.position.y + move[1], -LIMIT, LIMIT) } } : node));
					if (saveFrame.current !== null) cancelAnimationFrame(saveFrame.current);
					saveFrame.current = requestAnimationFrame(() => {
						saveFrame.current = null;
						try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, viewport: getViewport(), positions: Object.fromEntries(getNodes().map((node) => [node.id, node.position])) })); } catch { /* Storage is optional. */ }
					});
				}}>⠿</button>
				{copyUnavailable ? <span className="select-text">{data.name}</span> : <button className="nodrag text-left focus-visible:outline-2 focus-visible:outline-ring" title="Copy name" onClick={async () => {
					try { await navigator.clipboard.writeText(data.name); setCopied(true); if (copyTimer.current !== null) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 1500); } catch { setCopyUnavailable(true); }
				}}>{data.name}</button>}
				<span role="status" className="text-xs">{copied ? "Copied" : ""}</span>
			</div>
			<div className="nodrag" onWheelCapture={(event) => {
				if (event.ctrlKey || event.metaKey || !(event.target instanceof HTMLElement)) return;
				let element: HTMLElement | null = event.target;
				while (element && element !== event.currentTarget) {
					const style = getComputedStyle(element);
					const canScrollY = /(auto|scroll)/.test(style.overflowY) && (event.deltaY < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight - 1);
					const canScrollX = /(auto|scroll)/.test(style.overflowX) && (event.deltaX < 0 ? element.scrollLeft > 0 : element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
					if ((event.deltaY && canScrollY) || (event.deltaX && canScrollX)) { event.stopPropagation(); return; }
					element = element.parentElement;
				}
			}}><Component /></div>
		</div>
	);
}

const nodeTypes = { preview: Preview };

function CanvasContent() {
	const flow = useReactFlow<PreviewNode>();
	const canvasRef = useRef<HTMLDivElement>(null);
	const revealed = useRef(false);
	const nodesInitialized = useNodesInitialized();
	const [saved] = useState(readLayout);
	const [nodes] = useState<PreviewNode[]>(() => previews.map((preview) => ({ id: preview.id, type: "preview", position: saved?.positions[preview.id] ?? preview.position, dragHandle: ".canvas-handle", data: { name: preview.name, previewId: preview.id } })));
	const save = useCallback((nextViewport?: Viewport) => {
		try {
			const current = nextViewport ?? flow.getViewport();
			const viewport = { x: clamp(current.x, -LIMIT, LIMIT), y: clamp(current.y, -LIMIT, LIMIT), zoom: clamp(current.zoom, 0.35, 2) };
			const positions = Object.fromEntries(flow.getNodes().map((node) => [node.id, { x: clamp(node.position.x, -LIMIT, LIMIT), y: clamp(node.position.y, -LIMIT, LIMIT) }]));
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, viewport, positions }));
		} catch { /* Storage is optional. */ }
	}, [flow]);
	useEffect(() => {
		if (!nodesInitialized || !saved || revealed.current) return;
		const added = previews.find((preview) => !saved.positions[preview.id]);
		if (!added) return;
		const frame = requestAnimationFrame(() => {
			const canvas = canvasRef.current;
			const node = canvas?.querySelector<HTMLElement>(`[data-id="${added.id}"]`);
			if (!canvas || !node) return;
			const bounds = canvas.getBoundingClientRect();
			const item = node.getBoundingClientRect();
			const margin = 32;
			const dx = item.right > bounds.right - margin ? bounds.right - margin - item.right : item.left < bounds.left + margin ? bounds.left + margin - item.left : 0;
			const dy = item.bottom > bounds.bottom - margin ? bounds.bottom - margin - item.bottom : item.top < bounds.top + margin ? bounds.top + margin - item.top : 0;
			const viewport = flow.getViewport();
			revealed.current = true;
			if (dx || dy) void flow.setViewport({ ...viewport, x: clamp(viewport.x + dx, -LIMIT, LIMIT), y: clamp(viewport.y + dy, -LIMIT, LIMIT) });
			else save();
		});
		return () => cancelAnimationFrame(frame);
	}, [flow, nodesInitialized, saved, save]);
	useEffect(() => {
		const root = document.documentElement;
		const previous = root.style.overscrollBehaviorX;
		root.style.overscrollBehaviorX = "none";
		return () => { root.style.overscrollBehaviorX = previous; };
	}, []);
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.target !== canvas) return;
			const viewport = flow.getViewport();
			const offsets: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
			const offset = offsets[event.key];
			if (offset) { event.preventDefault(); void flow.setViewport({ ...viewport, x: clamp(viewport.x + offset[0], -LIMIT, LIMIT), y: clamp(viewport.y + offset[1], -LIMIT, LIMIT) }); }
			else if (event.key === "+" || event.key === "=") { event.preventDefault(); void flow.zoomIn(); }
			else if (event.key === "-") { event.preventDefault(); void flow.zoomOut(); }
		};
		canvas.addEventListener("keydown", onKeyDown);
		return () => canvas.removeEventListener("keydown", onKeyDown);
	}, [flow]);
	return (
		<div ref={canvasRef} role="region" className="relative h-dvh w-full cursor-default overflow-hidden bg-bg-neutral-subtle text-text focus-visible:outline-2 focus-visible:outline-ring [&_.react-flow__pane]:cursor-default! [&_.canvas-handle]:cursor-default!" aria-label="Agent selector canvas" aria-describedby="canvas-instructions" tabIndex={0}>
			<p id="canvas-instructions" className="sr-only">Use arrow keys to pan and plus or minus to zoom. Drag the handle or use its arrow keys to move a preview.</p>
			<ReactFlow<PreviewNode> defaultNodes={nodes} nodeTypes={nodeTypes} defaultViewport={saved?.viewport} fitView={!saved} fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.35} maxZoom={2} panOnDrag={[0, 1]} panOnScroll zoomOnScroll={false} zoomOnPinch zoomActivationKeyCode={["Meta", "Control"]} panActivationKeyCode="Space" zoomOnDoubleClick={false} nodesConnectable={false} elementsSelectable={false} deleteKeyCode={null} onMoveEnd={(_, viewport) => save(viewport)} onNodeDragStop={() => save()} proOptions={{ hideAttribution: true }} />
			<div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-lg">
				<Button size="compact" variant="ghost" onClick={() => { void flow.zoomOut(); }}>−<span className="sr-only">Zoom out</span></Button>
				<Button size="compact" variant="ghost" onClick={() => { void flow.zoomIn(); }}>+<span className="sr-only">Zoom in</span></Button>
				<Button size="compact" variant="ghost" onClick={() => { void flow.fitView({ padding: 0.2, maxZoom: 1 }); }}>Fit all</Button>
				<Button size="compact" variant="ghost" onClick={() => { void flow.setViewport({ x: 80, y: 80, zoom: 1 }); }}>Reset camera</Button>
				<ThemeSelector />
			</div>
		</div>
	);
}

export default function AgentSelectorCanvas() {
	return <ReactFlowProvider><CanvasContent /></ReactFlowProvider>;
}
