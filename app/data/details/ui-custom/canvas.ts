import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CANVAS_DETAIL: ComponentDetail = {
	description:
		"A pre-configured React Flow canvas optimized for AI workflow visualization. Provides sensible defaults (fitView, panOnScroll, selectionOnDrag) and renders a themed Background. Use with Node, Edge, Connection, Control, Panel, and Toolbar companion components.",
	usage: `import { Canvas } from "@/components/ui-custom/canvas";
import { Connection } from "@/components/ui-custom/connection";
import { Control } from "@/components/ui-custom/control";
import { Edge } from "@/components/ui-custom/edge";
import {
  Node, NodeHeader, NodeTitle, NodeDescription,
  NodeContent, NodeFooter,
} from "@/components/ui-custom/node";

<Canvas
  connectionLineComponent={Connection}
  edges={edges}
  edgeTypes={{ animated: Edge.Animated, temporary: Edge.Temporary }}
  nodes={nodes}
  nodeTypes={nodeTypes}
>
  <Control />
</Canvas>`,
	demoLayout: {
		previewContentWidth: "full",
		examplesContentWidth: "full",
	},
	props: [
		{
			name: "children",
			type: "ReactNode",
			description: "Child components rendered inside the canvas (Control, Panel, MiniMap, etc.).",
		},
		{
			name: "nodes",
			type: "Node[]",
			required: true,
			description: "Array of node objects with id, position, data, and optional type.",
		},
		{
			name: "edges",
			type: "Edge[]",
			required: true,
			description: "Array of edge objects with id, source, target, and optional type.",
		},
		{
			name: "nodeTypes",
			type: "Record<string, ComponentType>",
			description: "Map of custom node type renderers keyed by type name.",
		},
		{
			name: "edgeTypes",
			type: "Record<string, ComponentType>",
			description: "Map of custom edge type renderers keyed by type name.",
		},
		{
			name: "connectionLineComponent",
			type: "ConnectionLineComponent",
			description: "Custom component for rendering the connection line while dragging.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the ReactFlow container.",
		},
	],
	subComponents: [
		{ name: "Canvas", description: "Pre-configured ReactFlow wrapper with Background, fitView, panOnScroll, and selectionOnDrag defaults." },
	],
	examples: [
		{ title: "Workflow", description: "Full workflow canvas with six nodes, animated and temporary edges, and connection line.", demoSlug: "canvas-demo-workflow" },
		{ title: "Minimal", description: "Simple two-node input-to-output graph.", demoSlug: "canvas-demo-minimal" },
		{ title: "With controls", description: "Canvas with zoom, fit-view, and interactive toggle controls.", demoSlug: "canvas-demo-with-controls" },
		{ title: "With panel", description: "Canvas with an overlay status panel and controls.", demoSlug: "canvas-demo-with-panel" },
		{ title: "With toolbar", description: "Nodes with a bottom-positioned toolbar for edit, copy, and delete actions.", demoSlug: "canvas-demo-with-toolbar" },
		],
	};
