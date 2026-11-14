"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossIcon from "@atlaskit/icon/core/cross";
import { PersonalGraphNeuralCanvas } from "@/components/arts/personal-graph/personal-graph-neural-canvas";
import {
	NEURAL_GRAPH_COLOR_TOKEN_OPTIONS,
	getNeuralGraphColorTokenOption,
} from "@/components/arts/personal-graph/lib/neural-graph/colors";
import {
	DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS,
	clampNeuralGraphInteractionSettings,
	type NeuralGraphInteractionSettings,
} from "@/components/arts/personal-graph/lib/neural-graph/interaction-dynamics";
import {
	NEURAL_GRAPH_PARAM_SECTIONS,
	clampNeuralGraphParams,
	type NeuralGraphLayoutShape,
	type NeuralGraphParams,
	type NeuralGraphNodeShape,
} from "@/components/arts/personal-graph/lib/neural-graph/params";
import {
	DEFAULT_NEURAL_RAY_SOUND_SETTINGS,
	clampNeuralRaySoundSettings,
	type NeuralRaySoundSettings,
} from "@/components/arts/personal-graph/lib/neural-graph/ray-sound";
import {
	createNeuralGraphStore,
	getDefaultNeuralGraphSelectedNodeId,
	type NeuralGraphStore,
} from "@/components/arts/personal-graph/lib/neural-graph/store";
import type { NeuralGraphLabelStrategy, NeuralGraphThemeMode } from "@/components/arts/personal-graph/lib/neural-graph/renderer";
import type {
	VaultEdgeKind,
	VaultExplorer,
	VaultNode,
	VaultNodeKind,
} from "@/components/arts/personal-graph/lib/personal-graph-types";
import { Button } from "@/components/ui/button";
import { GUI } from "@/components/utils/gui";
import {
	ROVO_GRAPH_COLORS,
	ROVO_GRAPH_DEFAULT_PARAMS,
} from "@/components/website/demos/visual/graph-defaults";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface GraphProps extends Omit<ComponentProps<"div">, "children"> {
	background?: "default" | "transparent";
	explorer?: VaultExplorer | null;
	initialParams?: Partial<NeuralGraphParams>;
	initialSelectedNodeId?: string | null;
	isLoading?: boolean;
	labelStrategy?: NeuralGraphLabelStrategy;
	onParamsChange?: (params: NeuralGraphParams) => void;
	onSelectedNodeIdChange?: (nodeId: string | null) => void;
	interactionSettings?: Partial<NeuralGraphInteractionSettings>;
	params?: NeuralGraphParams;
	rayOriginBottomOffset?: number;
	raySoundSettings?: Partial<NeuralRaySoundSettings>;
	selectedNodeId?: string | null;
	allowEmptySelection?: boolean;
	showSelectionOverlay?: boolean;
	showControls?: boolean;
	store?: NeuralGraphStore;
	themeMode?: NeuralGraphThemeMode;
	variant?: "demo" | "fill";
}

interface GraphNodeDefinition {
	bodyPreview: string;
	color: string;
	id: string;
	kind: VaultNodeKind;
	relativePath: string;
	title: string;
}

interface GraphEdgeDefinition {
	kind?: VaultEdgeKind;
	label: string;
	source: string;
	target: string;
}

const GRAPH_COLOR_SELECT_OPTIONS = NEURAL_GRAPH_COLOR_TOKEN_OPTIONS.map((option) => ({
	value: option.value,
	label: option.label,
	description: option.lightHex,
	meta: option.token,
	swatch: option.value,
}));

function getGraphColorSelectValue(value: string, fallback: string): string {
	return getNeuralGraphColorTokenOption(value)?.value
		?? getNeuralGraphColorTokenOption(fallback)?.value
		?? NEURAL_GRAPH_COLOR_TOKEN_OPTIONS[0].value;
}

const NODE_SHAPE_OPTIONS = [
	{ value: "circle", label: "Circle" },
	{ value: "square", label: "Square" },
] as const satisfies ReadonlyArray<{ value: NeuralGraphNodeShape; label: string }>;

const LAYOUT_SHAPE_OPTIONS = [
	{ value: "radialCluster", label: "Radial cluster" },
	{ value: "cone", label: "Cone" },
] as const satisfies ReadonlyArray<{ value: NeuralGraphLayoutShape; label: string }>;

const GENERATED_AT = "2026-04-30T00:00:00.000Z";

const GRAPH_NODE_DEFINITIONS: GraphNodeDefinition[] = [
	{
		bodyPreview: "Signals from projects, pages, decisions, and people stitched into one living business map.",
		color: ROVO_GRAPH_COLORS.default,
		id: "teamwork-graph",
		kind: "synthesis",
		relativePath: "rovo/teamwork-graph.md",
		title: "Teamwork Graph",
	},
	{
		bodyPreview: "Natural-language answers grounded in the work graph rather than a detached chat history.",
		color: ROVO_GRAPH_COLORS.default,
		id: "rovo-chat",
		kind: "concept",
		relativePath: "rovo/chat.md",
		title: "Rovo Chat",
	},
	{
		bodyPreview: "A way to find the right artifact, owner, or decision across connected work systems.",
		color: ROVO_GRAPH_COLORS.default,
		id: "rovo-search",
		kind: "concept",
		relativePath: "rovo/search.md",
		title: "Rovo Search",
	},
	{
		bodyPreview: "Automated assistants that can inspect context, take action, and hand work back clearly.",
		color: ROVO_GRAPH_COLORS.default,
		id: "rovo-agents",
		kind: "concept",
		relativePath: "rovo/agents.md",
		title: "Rovo Agents",
	},
	{
		bodyPreview: "Issue state, ownership, sprint shape, and blockers feeding the graph as operational signal.",
		color: ROVO_GRAPH_COLORS.default,
		id: "jira-work",
		kind: "source",
		relativePath: "sources/jira-work.md",
		title: "Jira work",
	},
	{
		bodyPreview: "Plans, briefs, retros, and decisions that give the graph long-form team memory.",
		color: ROVO_GRAPH_COLORS.default,
		id: "confluence-pages",
		kind: "source",
		relativePath: "sources/confluence-pages.md",
		title: "Confluence pages",
	},
	{
		bodyPreview: "Shared outcomes that help Rovo understand why the work matters, not just what changed.",
		color: ROVO_GRAPH_COLORS.default,
		id: "project-goals",
		kind: "entity",
		relativePath: "work/project-goals.md",
		title: "Project goals",
	},
	{
		bodyPreview: "The people, owners, reviewers, and experts connected to each work artifact.",
		color: ROVO_GRAPH_COLORS.default,
		id: "team-owners",
		kind: "entity",
		relativePath: "work/team-owners.md",
		title: "Team owners",
	},
	{
		bodyPreview: "Recorded tradeoffs that let follow-up answers explain the path, not just the final result.",
		color: ROVO_GRAPH_COLORS.default,
		id: "decisions",
		kind: "concept",
		relativePath: "knowledge/decisions.md",
		title: "Decisions",
	},
	{
		bodyPreview: "Documents and discussion distilled into reusable context cards for quick recall.",
		color: ROVO_GRAPH_COLORS.default,
		id: "knowledge-cards",
		kind: "synthesis",
		relativePath: "knowledge/cards.md",
		title: "Knowledge cards",
	},
	{
		bodyPreview: "Customer notes, support themes, and requests that connect external need to internal work.",
		color: ROVO_GRAPH_COLORS.default,
		id: "customer-insights",
		kind: "raw",
		relativePath: "raw/customer-insights.md",
		title: "Customer insights",
	},
	{
		bodyPreview: "Near-real-time team discussion that helps identify emerging questions and unresolved blockers.",
		color: ROVO_GRAPH_COLORS.default,
		id: "team-signals",
		kind: "source",
		relativePath: "sources/team-signals.md",
		title: "Team signals",
	},
	{
		bodyPreview: "Milestones, risk, ownership, and launch readiness tied back to decisions and active work.",
		color: ROVO_GRAPH_COLORS.default,
		id: "release-plan",
		kind: "entity",
		relativePath: "work/release-plan.md",
		title: "Release plan",
	},
	{
		bodyPreview: "Signals from status pages, tickets, and postmortems connected to active remediation work.",
		color: ROVO_GRAPH_COLORS.default,
		id: "incident-context",
		kind: "raw",
		relativePath: "raw/incident-context.md",
		title: "Incident context",
	},
	{
		bodyPreview: "Reusable playbooks that connect prior decisions to the next best operational step.",
		color: ROVO_GRAPH_COLORS.default,
		id: "playbooks",
		kind: "synthesis",
		relativePath: "knowledge/playbooks.md",
		title: "Playbooks",
	},
	{
		bodyPreview: "A visible trail showing which sources shaped the answer and what should be checked next.",
		color: ROVO_GRAPH_COLORS.default,
		id: "grounded-response",
		kind: "concept",
		relativePath: "rovo/grounded-response.md",
		title: "Grounded response",
	},
];

const GRAPH_EDGE_DEFINITIONS: GraphEdgeDefinition[] = [
	{ label: "grounds", source: "teamwork-graph", target: "rovo-chat" },
	{ label: "grounds", source: "teamwork-graph", target: "rovo-search" },
	{ label: "guides", source: "teamwork-graph", target: "rovo-agents" },
	{ label: "indexes", source: "jira-work", target: "teamwork-graph" },
	{ label: "indexes", source: "confluence-pages", target: "teamwork-graph" },
	{ label: "aligns", source: "project-goals", target: "jira-work" },
	{ label: "owns", source: "team-owners", target: "jira-work" },
	{ label: "records", source: "decisions", target: "confluence-pages" },
	{ label: "summarizes", source: "knowledge-cards", target: "confluence-pages" },
	{ label: "answers", source: "knowledge-cards", target: "rovo-chat" },
	{ label: "finds", source: "rovo-search", target: "knowledge-cards" },
	{ label: "acts", source: "rovo-agents", target: "playbooks" },
	{ label: "prepares", source: "release-plan", target: "project-goals" },
	{ label: "informs", source: "customer-insights", target: "project-goals", kind: "frontmatter_source" },
	{ label: "raises", source: "team-signals", target: "decisions" },
	{ label: "explains", source: "incident-context", target: "playbooks", kind: "frontmatter_source" },
	{ label: "cites", source: "grounded-response", target: "teamwork-graph" },
	{ label: "cites", source: "grounded-response", target: "decisions" },
	{ label: "routes", source: "rovo-agents", target: "team-owners" },
	{ label: "checks", source: "release-plan", target: "incident-context" },
];

const GRAPH_NODE_MARKER_CLASSES: Record<VaultNodeKind, string> = {
	concept: "rotate-45 rounded-xs",
	entity: "rounded-full",
	raw: "rounded-xs",
	source: "rounded-full",
	synthesis: "rotate-45 rounded-xs",
};

const GRAPH_KIND_COLORS: Record<VaultNodeKind, string> = {
	concept: ROVO_GRAPH_COLORS.default,
	entity: ROVO_GRAPH_COLORS.default,
	raw: ROVO_GRAPH_COLORS.default,
	source: ROVO_GRAPH_COLORS.default,
	synthesis: ROVO_GRAPH_COLORS.default,
};

const GRAPH_STAGE_STYLE = {
	backgroundColor: ROVO_GRAPH_COLORS.surface,
	border: `1px solid ${token("color.border")}`,
} satisfies CSSProperties;

const GRAPH_DETAILS_PANEL_STYLE = {
	backgroundColor: "color-mix(in srgb, var(--ds-surface-overlay) 94%, transparent)",
	boxShadow: token("elevation.shadow.overlay"),
	color: "var(--ds-text)",
} satisfies CSSProperties;

function GraphNodeMarker({
	className,
	kind,
}: Readonly<{
	className?: string;
	kind: VaultNodeKind;
}>) {
	return (
		<span
			aria-hidden="true"
			className={cn("inline-block size-2.5 shrink-0", GRAPH_NODE_MARKER_CLASSES[kind], className)}
			style={{ backgroundColor: GRAPH_KIND_COLORS[kind] }}
		/>
	);
}

function getSelectedGraphNode(explorer: VaultExplorer | null, selectedNodeId: string | null) {
	if (!explorer || !selectedNodeId) return null;
	return explorer.nodes.find((node) => node.id === selectedNodeId) ?? null;
}

function resolveGraphSelectedNodeId(
	rawSelectedNodeId: string | null,
	graphStore: NeuralGraphStore,
	fallbackSelectedNodeId: string | null,
	allowEmptySelection: boolean,
) {
	if (rawSelectedNodeId && graphStore.nodesById.has(rawSelectedNodeId)) return rawSelectedNodeId;
	if (allowEmptySelection) return null;
	return fallbackSelectedNodeId;
}

function getRelatedGraphNodes(explorer: VaultExplorer | null, node: VaultNode | null) {
	if (!explorer || !node) return [];
	const nodesById = new Map(explorer.nodes.map((candidate) => [candidate.id, candidate]));
	const relatedNodes = new Map<string, VaultNode>();

	for (const edge of explorer.edges) {
		const relatedId = edge.source === node.id ? edge.target : edge.target === node.id ? edge.source : null;
		const relatedNode = relatedId ? nodesById.get(relatedId) : null;
		if (relatedNode) {
			relatedNodes.set(relatedNode.id, relatedNode);
		}
	}

	return [...relatedNodes.values()].slice(0, 3);
}

function GraphDetailsPanel({
	explorer,
	node,
	onClose,
	onSelectNode,
}: Readonly<{
	explorer: VaultExplorer | null;
	node: VaultNode;
	onClose: () => void;
	onSelectNode: (nodeId: string) => void;
}>) {
	const relatedNodes = getRelatedGraphNodes(explorer, node);

	return (
		<aside
			aria-label="Graph node details"
			className="absolute right-4 top-4 z-20 w-[min(300px,calc(100%-32px))] rounded-md border p-4 backdrop-blur"
			style={GRAPH_DETAILS_PANEL_STYLE}
		>
			<div className="mb-4 flex items-start justify-between gap-3">
				<h2 className="line-clamp-2 text-sm font-semibold leading-5">{node.title}</h2>
				<Button
					aria-label="Close graph details"
					className="size-7 shrink-0 rounded-xs text-neutral-800 hover:bg-neutral-100"
					onClick={onClose}
					size="icon"
					variant="ghost"
				>
					<CrossIcon label="" />
				</Button>
			</div>
			<div className="grid gap-3 border-b border-neutral-950/15 pb-4 text-sm">
				<div className="flex items-center justify-between gap-3">
					<span className="text-neutral-600">Kind</span>
					<span className="flex items-center gap-2 font-medium">
						<GraphNodeMarker kind={node.kind} />
						{node.kind.replaceAll("_", " ")}
					</span>
				</div>
				<div className="flex items-center justify-between gap-3">
					<span className="text-neutral-600">Links</span>
					<span className="font-medium">{node.connectionCount}</span>
				</div>
			</div>
			<div className="border-b border-neutral-950/15 py-4">
				<div className="mb-2 text-sm text-neutral-600">Excerpt</div>
				<p className="line-clamp-4 text-sm leading-6 text-neutral-800">{node.bodyPreview || node.relativePath}</p>
			</div>
			{relatedNodes.length > 0 ? (
				<div className="pt-4">
					<div className="mb-2 text-sm text-neutral-600">Related pages</div>
					<div className="space-y-2">
						{relatedNodes.map((relatedNode) => (
							<button
								className="flex w-full items-center justify-between gap-3 rounded-xs border border-neutral-950/15 px-3 py-2 text-left text-sm text-neutral-950 transition-colors duration-normal ease-out hover:bg-neutral-100"
								key={relatedNode.id}
								onClick={() => onSelectNode(relatedNode.id)}
								style={{ backgroundColor: ROVO_GRAPH_COLORS.surface }}
								type="button"
							>
								<span className="flex min-w-0 items-center gap-2">
									<GraphNodeMarker kind={relatedNode.kind} />
									<span className="truncate">{relatedNode.title}</span>
								</span>
								<ChevronRightIcon label="" />
							</button>
						))}
					</div>
				</div>
			) : null}
		</aside>
	);
}

function countConnections(nodeId: string) {
	return GRAPH_EDGE_DEFINITIONS.filter((edge) => edge.source === nodeId || edge.target === nodeId).length;
}

function buildVisualGraphExplorer(): VaultExplorer {
	const nodes = GRAPH_NODE_DEFINITIONS.map((node) => {
		const connectionCount = countConnections(node.id);
		const wikiLinks = GRAPH_EDGE_DEFINITIONS
			.filter((edge) => edge.source === node.id)
			.map((edge) => edge.target);

		return {
			bodyPreview: node.bodyPreview,
			connectionCount,
			dangling: false,
			externalUrl: null,
			frontmatter: { graphColor: node.color, visual: "graph" },
			id: node.id,
			kind: node.kind,
			label: node.title,
			missing: false,
			path: null,
			provider: "vault" as const,
			relativePath: node.relativePath,
			size: Math.max(1, connectionCount),
			slug: node.id,
			title: node.title,
			updatedAt: GENERATED_AT,
			wikiLinks,
		};
	});
	const edges = GRAPH_EDGE_DEFINITIONS.map((edge, index) => {
		const kind = edge.kind ?? "wiki_link";
		return {
			id: `graph-edge-${index + 1}`,
			kind,
			label: edge.label,
			metadata: { visual: "graph" },
			relationKinds: [kind],
			source: edge.source,
			target: edge.target,
		};
	});

	return {
		edges,
		generatedAt: GENERATED_AT,
		nodes,
		stats: {
			danglingCount: 0,
			edgeCount: edges.length,
			nodeCount: nodes.length,
			rawCount: nodes.filter((node) => node.kind === "raw").length,
			wikiCount: nodes.filter((node) => node.kind !== "raw").length,
		},
	};
}

const VISUAL_GRAPH_EXPLORER = buildVisualGraphExplorer();

interface GraphControlsProps {
	defaultInteractionSettings: NeuralGraphInteractionSettings;
	defaultParams: NeuralGraphParams;
	defaultRaySoundSettings: NeuralRaySoundSettings;
	onChange: (params: NeuralGraphParams) => void;
	onInteractionChange: (settings: NeuralGraphInteractionSettings) => void;
	onRaySoundChange: (settings: NeuralRaySoundSettings) => void;
	interactionSettings: NeuralGraphInteractionSettings;
	params: NeuralGraphParams;
	raySoundSettings: NeuralRaySoundSettings;
}

function GraphControls({
	defaultInteractionSettings,
	defaultParams,
	defaultRaySoundSettings,
	onChange,
	onInteractionChange,
	onRaySoundChange,
	interactionSettings,
	params,
	raySoundSettings,
}: Readonly<GraphControlsProps>) {
	function updateParam(key: keyof NeuralGraphParams, value: number | string | boolean) {
		onChange(clampNeuralGraphParams({ ...params, [key]: value }));
	}

	function updateInteractionSettings(nextSettings: Partial<NeuralGraphInteractionSettings>) {
		onInteractionChange(clampNeuralGraphInteractionSettings({ ...interactionSettings, ...nextSettings }));
	}

	function updateRaySoundSettings(nextSettings: Partial<NeuralRaySoundSettings>) {
		onRaySoundChange(clampNeuralRaySoundSettings({ ...raySoundSettings, ...nextSettings }));
	}

	return (
		<GUI.Panel
			title="Graph controls"
			values={{
				...params,
				graphInteractionEnabled: interactionSettings.enabled,
				graphInteractionFlowBoost: interactionSettings.flowBoost,
				graphInteractionIntensity: interactionSettings.intensity,
				graphInteractionNodeSoundCooldownMs: interactionSettings.nodeSoundCooldownMs,
				graphInteractionNodeSoundEnabled: interactionSettings.nodeSoundEnabled,
				graphInteractionNodeSoundVolume: interactionSettings.nodeSoundVolume,
				graphInteractionRayEmphasis: interactionSettings.rayEmphasis,
				raySoundCooldownMs: raySoundSettings.cooldownMs,
				raySoundEnabled: raySoundSettings.enabled,
				raySoundPitchSpread: raySoundSettings.pitchSpread,
				raySoundVolume: raySoundSettings.volume,
			}}
		>
			<GUI.Section borderTop={false} title="Layout">
				<GUI.Select
					id="graph-layout-shape"
					label="Shape"
					value={params.layoutShape}
					options={LAYOUT_SHAPE_OPTIONS}
					onChange={(nextShape) => updateParam("layoutShape", nextShape)}
					valueKeys="layoutShape"
				/>
			</GUI.Section>

			{NEURAL_GRAPH_PARAM_SECTIONS.map((section) => (
				<GUI.Section
					borderTop={true}
					key={section.id}
					title={section.label}
				>
					{section.params.map((definition) => {
						if (definition.kind === "boolean") {
							const value = params[definition.key];
							return (
								<GUI.Toggle
									checked={value}
									id={`graph-${definition.key}`}
									key={definition.key}
									label={definition.label}
									onChange={(nextValue) => updateParam(definition.key, nextValue)}
								/>
							);
						}

						if (definition.kind === "color") {
							const value = params[definition.key];
							const defaultValue = defaultParams[definition.key];
							return (
								<GUI.Select
									id={`graph-${definition.key}`}
									key={definition.key}
									label={definition.label}
									description={definition.description}
									value={getGraphColorSelectValue(value, defaultValue)}
									defaultValue={getGraphColorSelectValue(defaultValue, defaultValue)}
									options={GRAPH_COLOR_SELECT_OPTIONS}
									valueKeys={definition.key}
									onChange={(nextColor) => updateParam(definition.key, nextColor)}
								/>
							);
						}

						const value = params[definition.key];
						const defaultValue = defaultParams[definition.key];
						return (
							<GUI.Control
								defaultValue={defaultValue}
								id={`graph-${definition.key}`}
								key={definition.key}
								label={definition.label}
								max={definition.max}
								min={definition.min}
								onChange={(nextValue) => updateParam(definition.key, nextValue)}
								step={definition.step}
								unit={definition.unit}
								value={value}
							/>
						);
					})}
				</GUI.Section>
			))}

			<GUI.Section borderTop title="Interaction">
				<GUI.Toggle
					checked={interactionSettings.enabled}
					id="graph-interaction-enabled"
					label="Interaction enabled"
					onChange={(nextEnabled) => updateInteractionSettings({ enabled: nextEnabled })}
					valueKeys="graphInteractionEnabled"
				/>
				<GUI.Control
					defaultValue={defaultInteractionSettings.intensity}
					id="graph-interaction-intensity"
					label="Interaction intensity"
					max={1.5}
					min={0}
					onChange={(nextIntensity) => updateInteractionSettings({ intensity: nextIntensity })}
					step={0.01}
					value={interactionSettings.intensity}
					valueKeys="graphInteractionIntensity"
				/>
				<GUI.Control
					defaultValue={defaultInteractionSettings.flowBoost}
					id="graph-interaction-flow-boost"
					label="Flow boost"
					max={1.5}
					min={0}
					onChange={(nextFlowBoost) => updateInteractionSettings({ flowBoost: nextFlowBoost })}
					step={0.01}
					value={interactionSettings.flowBoost}
					valueKeys="graphInteractionFlowBoost"
				/>
				<GUI.Control
					defaultValue={defaultInteractionSettings.rayEmphasis}
					id="graph-interaction-ray-emphasis"
					label="Ray emphasis"
					max={1.5}
					min={0}
					onChange={(nextRayEmphasis) => updateInteractionSettings({ rayEmphasis: nextRayEmphasis })}
					step={0.01}
					value={interactionSettings.rayEmphasis}
					valueKeys="graphInteractionRayEmphasis"
				/>
				<GUI.Toggle
					checked={interactionSettings.nodeSoundEnabled}
					id="graph-node-sound-enabled"
					label="Node sound enabled"
					onChange={(nextEnabled) => updateInteractionSettings({ nodeSoundEnabled: nextEnabled })}
					valueKeys="graphInteractionNodeSoundEnabled"
				/>
				<GUI.Control
					defaultValue={defaultInteractionSettings.nodeSoundVolume}
					id="graph-node-sound-volume"
					label="Node volume"
					max={1}
					min={0}
					onChange={(nextVolume) => updateInteractionSettings({ nodeSoundVolume: nextVolume })}
					step={0.01}
					value={interactionSettings.nodeSoundVolume}
					valueKeys="graphInteractionNodeSoundVolume"
				/>
				<GUI.Control
					defaultValue={defaultInteractionSettings.nodeSoundCooldownMs}
					id="graph-node-sound-cooldown"
					label="Node cooldown"
					max={240}
					min={0}
					onChange={(nextCooldown) => updateInteractionSettings({ nodeSoundCooldownMs: nextCooldown })}
					step={5}
					unit="ms"
					value={interactionSettings.nodeSoundCooldownMs}
					valueKeys="graphInteractionNodeSoundCooldownMs"
				/>
			</GUI.Section>

			<GUI.Section borderTop title="Ray sound">
				<GUI.Toggle
					checked={raySoundSettings.enabled}
					id="graph-ray-sound-enabled"
					label="Sound enabled"
					onChange={(nextEnabled) => updateRaySoundSettings({ enabled: nextEnabled })}
					valueKeys="raySoundEnabled"
				/>
				<GUI.Control
					defaultValue={defaultRaySoundSettings.volume}
					id="graph-ray-sound-volume"
					label="Volume"
					max={1}
					min={0}
					onChange={(nextVolume) => updateRaySoundSettings({ volume: nextVolume })}
					step={0.01}
					value={raySoundSettings.volume}
					valueKeys="raySoundVolume"
				/>
				<GUI.Control
					defaultValue={defaultRaySoundSettings.cooldownMs}
					id="graph-ray-sound-cooldown"
					label="Cooldown"
					max={240}
					min={0}
					onChange={(nextCooldown) => updateRaySoundSettings({ cooldownMs: nextCooldown })}
					step={5}
					unit="ms"
					value={raySoundSettings.cooldownMs}
					valueKeys="raySoundCooldownMs"
				/>
				<GUI.Control
					defaultValue={defaultRaySoundSettings.pitchSpread}
					id="graph-ray-sound-pitch-spread"
					label="Pitch spread"
					max={36}
					min={0}
					onChange={(nextPitchSpread) => updateRaySoundSettings({ pitchSpread: nextPitchSpread })}
					step={1}
					unit="st"
					value={raySoundSettings.pitchSpread}
					valueKeys="raySoundPitchSpread"
				/>
			</GUI.Section>

			<GUI.Section borderTop title="Node type colors">
				<GUI.Select
					id="graph-color-synthesis"
					label="Synthesis"
					description="Distilled outputs (graph, knowledge cards, playbooks)"
					value={getGraphColorSelectValue(params.colorSynthesis, defaultParams.colorSynthesis)}
					defaultValue={getGraphColorSelectValue(defaultParams.colorSynthesis, defaultParams.colorSynthesis)}
					options={GRAPH_COLOR_SELECT_OPTIONS}
					valueKeys="colorSynthesis"
					onChange={(nextColor) => updateParam("colorSynthesis", nextColor)}
				/>
				<GUI.Select
					id="graph-color-concept"
					label="Concept"
					description="Ideas and abstractions (chat, search, decisions)"
					value={getGraphColorSelectValue(params.colorConcept, defaultParams.colorConcept)}
					defaultValue={getGraphColorSelectValue(defaultParams.colorConcept, defaultParams.colorConcept)}
					options={GRAPH_COLOR_SELECT_OPTIONS}
					valueKeys="colorConcept"
					onChange={(nextColor) => updateParam("colorConcept", nextColor)}
				/>
				<GUI.Select
					id="graph-color-source"
					label="Source"
					description="External feeders (Jira, Confluence, signals)"
					value={getGraphColorSelectValue(params.colorSource, defaultParams.colorSource)}
					defaultValue={getGraphColorSelectValue(defaultParams.colorSource, defaultParams.colorSource)}
					options={GRAPH_COLOR_SELECT_OPTIONS}
					valueKeys="colorSource"
					onChange={(nextColor) => updateParam("colorSource", nextColor)}
				/>
				<GUI.Select
					id="graph-color-entity"
					label="Entity"
					description="Owners, goals, and named things"
					value={getGraphColorSelectValue(params.colorEntity, defaultParams.colorEntity)}
					defaultValue={getGraphColorSelectValue(defaultParams.colorEntity, defaultParams.colorEntity)}
					options={GRAPH_COLOR_SELECT_OPTIONS}
					valueKeys="colorEntity"
					onChange={(nextColor) => updateParam("colorEntity", nextColor)}
				/>
				<GUI.Select
					id="graph-color-raw"
					label="Raw"
					description="Unprocessed material (insights, incidents)"
					value={getGraphColorSelectValue(params.colorRaw, defaultParams.colorRaw)}
					defaultValue={getGraphColorSelectValue(defaultParams.colorRaw, defaultParams.colorRaw)}
					options={GRAPH_COLOR_SELECT_OPTIONS}
					valueKeys="colorRaw"
					onChange={(nextColor) => updateParam("colorRaw", nextColor)}
				/>
				<GUI.Select
					id="graph-node-color"
					label="Idle"
					description="Default node fill before hover or selection reveals type colors"
					value={getGraphColorSelectValue(params.nodeColor, defaultParams.nodeColor)}
					defaultValue={getGraphColorSelectValue(defaultParams.nodeColor, defaultParams.nodeColor)}
					options={GRAPH_COLOR_SELECT_OPTIONS}
					valueKeys="nodeColor"
					onChange={(nextColor) => updateParam("nodeColor", nextColor)}
				/>
			</GUI.Section>

			<GUI.Section borderTop title="Node style">
				<GUI.Select
					id="graph-node-shape"
					label="Node shape"
					value={params.nodeShape}
					options={NODE_SHAPE_OPTIONS}
					onChange={(nextShape) => updateParam("nodeShape", nextShape)}
				/>
			</GUI.Section>
		</GUI.Panel>
	);
}

export default function Graph({
	background = "transparent",
	className,
	explorer = VISUAL_GRAPH_EXPLORER,
	initialParams = ROVO_GRAPH_DEFAULT_PARAMS,
	initialSelectedNodeId = null,
	isLoading = false,
	labelStrategy = "default",
	interactionSettings: explicitInteractionSettings,
	onParamsChange,
	onSelectedNodeIdChange,
	params: controlledParams,
	rayOriginBottomOffset,
	raySoundSettings: explicitRaySoundSettings,
	selectedNodeId: controlledSelectedNodeId,
	allowEmptySelection = false,
	showSelectionOverlay = false,
	showControls = true,
	style,
	store: providedStore,
	themeMode,
	variant = "demo",
	...props
}: Readonly<GraphProps>) {
	const initialParamsRef = useRef(initialParams);
	const initialSelectedNodeIdRef = useRef(initialSelectedNodeId);
	const defaultParams = useMemo(() => clampNeuralGraphParams(initialParamsRef.current), []);
	const [uncontrolledParams, setUncontrolledParams] = useState<NeuralGraphParams>(() => defaultParams);
	const [uncontrolledSelectedNodeId, setUncontrolledSelectedNodeId] = useState<string | null>(initialSelectedNodeIdRef.current);
	const [demoInteractionSettings, setDemoInteractionSettings] = useState<NeuralGraphInteractionSettings>(() => DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS);
	const [demoRaySoundSettings, setDemoRaySoundSettings] = useState<NeuralRaySoundSettings>(() => DEFAULT_NEURAL_RAY_SOUND_SETTINGS);
	const isFillVariant = variant === "fill";
	const hasTransparentBackground = background === "transparent";
	const fillVariantBackgroundClass = hasTransparentBackground ? "bg-transparent" : "bg-surface";
	const previewBackgroundClass = isFillVariant ? fillVariantBackgroundClass : null;
	const canvasThemeMode = themeMode ?? (!isFillVariant && hasTransparentBackground ? "light" : undefined);
	const isParamsControlled = controlledParams !== undefined;
	const isSelectionControlled = controlledSelectedNodeId !== undefined;
	const rawParams = controlledParams ?? uncontrolledParams;
	const params = useMemo(() => clampNeuralGraphParams(rawParams), [rawParams]);
	const controlledRaySoundSettings = useMemo(
		() => explicitRaySoundSettings ? clampNeuralRaySoundSettings(explicitRaySoundSettings) : undefined,
		[explicitRaySoundSettings],
	);
	const controlledInteractionSettings = useMemo(
		() => explicitInteractionSettings ? clampNeuralGraphInteractionSettings(explicitInteractionSettings) : undefined,
		[explicitInteractionSettings],
	);
	const canvasRaySoundSettings = showControls ? demoRaySoundSettings : controlledRaySoundSettings;
	const canvasInteractionSettings = showControls ? demoInteractionSettings : controlledInteractionSettings;
	const graphStore = useMemo(() => providedStore ?? createNeuralGraphStore(explorer), [explorer, providedStore]);
	const fallbackSelectedNodeId = getDefaultNeuralGraphSelectedNodeId(graphStore);
	const rawSelectedNodeId = isSelectionControlled ? controlledSelectedNodeId ?? null : uncontrolledSelectedNodeId;
	const selectedNodeId = resolveGraphSelectedNodeId(
		rawSelectedNodeId,
		graphStore,
		fallbackSelectedNodeId,
		allowEmptySelection,
	);
	const selectedNode = useMemo(() => getSelectedGraphNode(explorer, selectedNodeId), [explorer, selectedNodeId]);

	useEffect(() => {
		if (rawSelectedNodeId === selectedNodeId) return;
		if (isSelectionControlled) {
			onSelectedNodeIdChange?.(selectedNodeId);
			return;
		}
		setUncontrolledSelectedNodeId(selectedNodeId);
	}, [isSelectionControlled, onSelectedNodeIdChange, rawSelectedNodeId, selectedNodeId]);

	const handleClearSelection = useCallback(() => {
		const nextSelectedNodeId = allowEmptySelection ? null : fallbackSelectedNodeId;
		if (!isSelectionControlled) {
			setUncontrolledSelectedNodeId(nextSelectedNodeId);
		}
		onSelectedNodeIdChange?.(nextSelectedNodeId);
	}, [allowEmptySelection, fallbackSelectedNodeId, isSelectionControlled, onSelectedNodeIdChange]);
	const handleSelectNode = useCallback((nodeId: string) => {
		if (!isSelectionControlled) {
			setUncontrolledSelectedNodeId(nodeId);
		}
		onSelectedNodeIdChange?.(nodeId);
	}, [isSelectionControlled, onSelectedNodeIdChange]);
	const handleParamsChange = useCallback((nextParams: NeuralGraphParams) => {
		const clampedParams = clampNeuralGraphParams(nextParams);
		if (!isParamsControlled) {
			setUncontrolledParams(clampedParams);
		}
		onParamsChange?.(clampedParams);
	}, [isParamsControlled, onParamsChange]);

	return (
		<div
			className={cn(
				isFillVariant ? "flex h-full w-full flex-col" : "mx-auto flex w-full max-w-4xl flex-col",
				className,
			)}
			data-visual-graph="true"
			style={{ gap: token("space.400"), ...style }}
			{...props}
		>
			<div
				className={cn(
					isFillVariant
						? "min-h-0 flex-1 overflow-hidden"
						: "relative w-full overflow-hidden rounded-lg border border-border",
					previewBackgroundClass,
				)}
				style={isFillVariant ? undefined : GRAPH_STAGE_STYLE}
			>
				<div
					className={cn(
						isFillVariant
							? "h-full min-h-0 overflow-hidden"
							: "relative h-[min(70svh,560px)] min-h-[440px] overflow-hidden",
						isFillVariant ? fillVariantBackgroundClass : null,
					)}
				>
					<div className="relative z-10 h-full">
						<PersonalGraphNeuralCanvas
							background={background}
							explorer={explorer}
							isLoading={isLoading}
							interactionSettings={canvasInteractionSettings}
							labelStrategy={labelStrategy}
							onClearSelection={handleClearSelection}
							onSelectNode={handleSelectNode}
							params={params}
							rayOriginBottomOffset={rayOriginBottomOffset}
							raySoundSettings={canvasRaySoundSettings}
							selectedNodeId={selectedNodeId}
							showSelectionOverlay={showSelectionOverlay}
							store={graphStore}
							themeMode={canvasThemeMode}
						/>
					</div>
				</div>
				{selectedNode && !isFillVariant && !showSelectionOverlay ? (
					<GraphDetailsPanel
						explorer={explorer}
						node={selectedNode}
						onClose={handleClearSelection}
						onSelectNode={handleSelectNode}
					/>
				) : null}
			</div>

			{showControls ? (
				<GraphControls
					defaultParams={defaultParams}
					defaultInteractionSettings={DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS}
					defaultRaySoundSettings={DEFAULT_NEURAL_RAY_SOUND_SETTINGS}
					onChange={handleParamsChange}
					onInteractionChange={setDemoInteractionSettings}
					onRaySoundChange={setDemoRaySoundSettings}
					interactionSettings={demoInteractionSettings}
					params={params}
					raySoundSettings={demoRaySoundSettings}
				/>
			) : null}
		</div>
	);
}
