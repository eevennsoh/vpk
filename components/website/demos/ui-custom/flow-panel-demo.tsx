"use client";

import { Canvas } from "@/components/ui-custom/canvas";
import { Connection } from "@/components/ui-custom/connection";
import { Control } from "@/components/ui-custom/control";
import { Edge } from "@/components/ui-custom/edge";
import {
	Node,
	NodeContent,
	NodeDescription,
	NodeHeader,
	NodeTitle,
} from "@/components/ui-custom/node";
import { FlowPanel } from "@/components/ui-custom/flow-panel";
import { Lozenge } from "@/components/ui/lozenge";

// -- Shared data --

type DemoNodeData = {
	label: string;
	description: string;
	handles: { target: boolean; source: boolean };
	content: string;
};

function DemoNode({ data }: { data: DemoNodeData }) {
	return (
		<Node handles={data.handles}>
			<NodeHeader>
				<NodeTitle>{data.label}</NodeTitle>
				<NodeDescription>{data.description}</NodeDescription>
			</NodeHeader>
			<NodeContent>
				<p className="text-sm">{data.content}</p>
			</NodeContent>
		</Node>
	);
}

const nodeTypes = { demo: DemoNode };

const edgeTypes = {
	animated: Edge.Animated,
	temporary: Edge.Temporary,
};

const nodes = [
	{
		id: "input",
		type: "demo",
		position: { x: 0, y: 0 },
		data: {
			label: "Input",
			description: "Data source",
			handles: { source: true, target: false },
			content: "User query received",
		},
	},
	{
		id: "process",
		type: "demo",
		position: { x: 500, y: 0 },
		data: {
			label: "Process",
			description: "Transform data",
			handles: { source: true, target: true },
			content: "Analyzing and routing",
		},
	},
	{
		id: "output",
		type: "demo",
		position: { x: 1000, y: 0 },
		data: {
			label: "Output",
			description: "Result",
			handles: { source: false, target: true },
			content: "Response generated",
		},
	},
];

const edges = [
	{ id: "e1", source: "input", target: "process", type: "animated" },
	{ id: "e2", source: "process", target: "output", type: "animated" },
];

// ============================================================
// Demo: Status lozenge (default preview)
// ============================================================

export function FlowPanelDemoStatusLozenge() {
	return (
		<div className="h-[400px] w-full">
			<Canvas
				connectionLineComponent={Connection}
				edges={edges}
				edgeTypes={edgeTypes}
				nodes={nodes}
				nodeTypes={nodeTypes}
			>
				<Control />
				<FlowPanel position="top-right">
					<div className="flex items-center gap-2 px-2 py-1">
						<Lozenge variant="success">Running</Lozenge>
						<span className="text-xs text-muted-foreground">
							3 nodes &middot; 2 edges
						</span>
					</div>
				</FlowPanel>
			</Canvas>
		</div>
	);
}

// ============================================================
// Demo: Positions (panels in all six positions)
// ============================================================

export function FlowPanelDemoPositions() {
	return (
		<div className="h-[400px] w-full">
			<Canvas
				connectionLineComponent={Connection}
				edges={edges}
				edgeTypes={edgeTypes}
				nodes={nodes}
				nodeTypes={nodeTypes}
			>
				<FlowPanel position="top-left">
					<span className="px-2 py-1 text-xs">top-left</span>
				</FlowPanel>
				<FlowPanel position="top-center">
					<span className="px-2 py-1 text-xs">top-center</span>
				</FlowPanel>
				<FlowPanel position="top-right">
					<span className="px-2 py-1 text-xs">top-right</span>
				</FlowPanel>
				<FlowPanel position="bottom-left">
					<span className="px-2 py-1 text-xs">bottom-left</span>
				</FlowPanel>
				<FlowPanel position="bottom-center">
					<span className="px-2 py-1 text-xs">bottom-center</span>
				</FlowPanel>
				<FlowPanel position="bottom-right">
					<span className="px-2 py-1 text-xs">bottom-right</span>
				</FlowPanel>
			</Canvas>
		</div>
	);
}

// ============================================================
// Default export (shown as page preview)
// ============================================================

export default function FlowPanelDemo() {
	return <FlowPanelDemoStatusLozenge />;
}
