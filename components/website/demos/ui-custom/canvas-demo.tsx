"use client";

import { Canvas } from "@/components/ui-custom/canvas";
import { Connection } from "@/components/ui-custom/connection";
import { Control } from "@/components/ui-custom/control";
import { Edge } from "@/components/ui-custom/edge";
import {
	Node,
	NodeContent,
	NodeDescription,
	NodeFooter,
	NodeHeader,
	NodeTitle,
} from "@/components/ui-custom/node";
import { FlowPanel } from "@/components/ui-custom/flow-panel";
import { Toolbar } from "@/components/ui-custom/toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CopyIcon from "@atlaskit/icon/core/copy";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";

// -- Shared node type renderer --

type WorkflowNodeData = {
	label: string;
	description: string;
	handles: { target: boolean; source: boolean };
	content: string;
	footer: string;
};

function WorkflowNode({ data }: { data: WorkflowNodeData }) {
	return (
		<Node handles={data.handles}>
			<NodeHeader>
				<NodeTitle>{data.label}</NodeTitle>
				<NodeDescription>{data.description}</NodeDescription>
			</NodeHeader>
			<NodeContent>
				<p className="text-sm">{data.content}</p>
			</NodeContent>
			<NodeFooter>
				<p className="text-xs text-muted-foreground">{data.footer}</p>
			</NodeFooter>
		</Node>
	);
}

const workflowNodeTypes = { workflow: WorkflowNode };

const workflowEdgeTypes = {
	animated: Edge.Animated,
	temporary: Edge.Temporary,
};

// ============================================================
// Demo: Workflow (full Canvas with nodes, edges, connection line)
// ============================================================

const workflowNodes = [
	{
		id: "start",
		type: "workflow",
		position: { x: 0, y: 0 },
		data: {
			label: "Start",
			description: "Initialize workflow",
			handles: { source: true, target: false },
			content: "Triggered by user action at 09:30 AM",
			footer: "Status: Ready",
		},
	},
	{
		id: "process",
		type: "workflow",
		position: { x: 500, y: 0 },
		data: {
			label: "Process Data",
			description: "Transform input",
			handles: { source: true, target: true },
			content: "Validating 1,234 records and applying business rules",
			footer: "Duration: ~2.5s",
		},
	},
	{
		id: "decision",
		type: "workflow",
		position: { x: 1000, y: 0 },
		data: {
			label: "Decision Point",
			description: "Route based on conditions",
			handles: { source: true, target: true },
			content: "Evaluating: data.status === 'valid' && data.score > 0.8",
			footer: "Confidence: 94%",
		},
	},
	{
		id: "success",
		type: "workflow",
		position: { x: 1500, y: -200 },
		data: {
			label: "Success Path",
			description: "Handle success case",
			handles: { source: true, target: true },
			content: "1,156 records passed validation (93.7%)",
			footer: "Next: Send to production",
		},
	},
	{
		id: "error",
		type: "workflow",
		position: { x: 1500, y: 200 },
		data: {
			label: "Error Path",
			description: "Handle error case",
			handles: { source: true, target: true },
			content: "78 records failed validation (6.3%)",
			footer: "Next: Queue for review",
		},
	},
	{
		id: "complete",
		type: "workflow",
		position: { x: 2000, y: 0 },
		data: {
			label: "Complete",
			description: "Finalize workflow",
			handles: { source: false, target: true },
			content: "All records processed and routed successfully",
			footer: "Total time: 4.2s",
		},
	},
];

const workflowEdges = [
	{ id: "e1", source: "start", target: "process", type: "animated" },
	{ id: "e2", source: "process", target: "decision", type: "animated" },
	{ id: "e3", source: "decision", target: "success", type: "animated" },
	{ id: "e4", source: "decision", target: "error", type: "temporary" },
	{ id: "e5", source: "success", target: "complete", type: "animated" },
	{ id: "e6", source: "error", target: "complete", type: "temporary" },
];

export function CanvasDemoWorkflow() {
	return (
		<div className="h-[500px] w-full">
			<Canvas
				connectionLineComponent={Connection}
				edges={workflowEdges}
				edgeTypes={workflowEdgeTypes}
				nodes={workflowNodes}
				nodeTypes={workflowNodeTypes}
			/>
		</div>
	);
}

// ============================================================
// Demo: Minimal (simple two-node graph)
// ============================================================

const minimalNodes = [
	{
		id: "a",
		type: "workflow",
		position: { x: 0, y: 0 },
		data: {
			label: "Input",
			description: "Data source",
			handles: { source: true, target: false },
			content: "Raw user input",
			footer: "Type: text",
		},
	},
	{
		id: "b",
		type: "workflow",
		position: { x: 500, y: 0 },
		data: {
			label: "Output",
			description: "Result",
			handles: { source: false, target: true },
			content: "Processed response",
			footer: "Type: markdown",
		},
	},
];

const minimalEdges = [
	{ id: "e-ab", source: "a", target: "b", type: "animated" },
];

export function CanvasDemoMinimal() {
	return (
		<div className="h-[300px] w-full">
			<Canvas
				edges={minimalEdges}
				edgeTypes={workflowEdgeTypes}
				nodes={minimalNodes}
				nodeTypes={workflowNodeTypes}
			/>
		</div>
	);
}

// ============================================================
// Demo: With Controls (zoom/fit buttons)
// ============================================================

export function CanvasDemoWithControls() {
	return (
		<div className="h-[400px] w-full">
			<Canvas
				connectionLineComponent={Connection}
				edges={workflowEdges}
				edgeTypes={workflowEdgeTypes}
				nodes={workflowNodes}
				nodeTypes={workflowNodeTypes}
			>
				<Control />
			</Canvas>
		</div>
	);
}

// ============================================================
// Demo: With Panel (overlay info panel)
// ============================================================

export function CanvasDemoWithPanel() {
	return (
		<div className="h-[400px] w-full">
			<Canvas
				connectionLineComponent={Connection}
				edges={workflowEdges}
				edgeTypes={workflowEdgeTypes}
				nodes={workflowNodes}
				nodeTypes={workflowNodeTypes}
			>
				<Control />
				<FlowPanel position="top-right">
					<div className="flex items-center gap-2 px-2 py-1">
						<Badge variant="success">Running</Badge>
						<span className="text-xs text-muted-foreground">
							6 nodes &middot; 6 edges
						</span>
					</div>
				</FlowPanel>
			</Canvas>
		</div>
	);
}

// ============================================================
// Demo: With Toolbar (node-level actions)
// ============================================================

function ToolbarNode({ data }: { data: WorkflowNodeData }) {
	return (
		<Node handles={data.handles}>
			<Toolbar>
				<Button size="default" variant="ghost" aria-label="Edit">
					<EditIcon label="" />
				</Button>
				<Button size="default" variant="ghost" aria-label="Copy">
					<CopyIcon label="" />
				</Button>
				<Button size="default" variant="ghost" aria-label="Delete">
					<DeleteIcon label="" />
				</Button>
			</Toolbar>
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

const toolbarNodeTypes = { workflow: ToolbarNode };

export function CanvasDemoWithToolbar() {
	return (
		<div className="h-[400px] w-full">
			<Canvas
				connectionLineComponent={Connection}
				edges={minimalEdges}
				edgeTypes={workflowEdgeTypes}
				nodes={minimalNodes}
				nodeTypes={toolbarNodeTypes}
			/>
		</div>
	);
}

// ============================================================
// Default export (shown as page preview)
// ============================================================

export default function CanvasDemo() {
	return <CanvasDemoWorkflow />;
}
