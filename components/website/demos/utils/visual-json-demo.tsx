"use client";

import { useId, useMemo, useState } from "react";
import { JsonEditor, DiffView, type JsonValue } from "@visual-json/react";
import type { JsonSchema } from "@visual-json/core";
import type { Spec } from "@json-render/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXAMPLE_SPECS } from "@/lib/json-render/demos";
import { JsonRenderView } from "@/lib/json-render/renderer";

const SAMPLE_DATA: JsonValue = {
	name: "Alex Morgan",
	email: "alex.morgan@example.com",
	age: 32,
	active: true,
	role: "admin",
	preferences: {
		theme: "dark",
		language: "en",
		notifications: {
			email: true,
			push: false,
			sms: false,
		},
	},
	tags: ["engineering", "frontend", "design-systems"],
	projects: [
		{
			id: "PRJ-001",
			name: "Design System",
			status: "active",
			priority: 1,
		},
		{
			id: "PRJ-002",
			name: "Visual Editor",
			status: "planned",
			priority: 2,
		},
	],
};

const SAMPLE_SCHEMA: JsonSchema = {
	type: "object",
	properties: {
		name: { type: "string", description: "Full name of the user" },
		email: { type: "string", format: "email", description: "Email address" },
		age: { type: "number", minimum: 0, maximum: 150, description: "Age in years" },
		active: { type: "boolean", description: "Whether the account is active" },
		role: {
			type: "string",
			enum: ["admin", "editor", "viewer"],
			description: "User role",
		},
		preferences: {
			type: "object",
			description: "User preferences",
			properties: {
				theme: { type: "string", enum: ["light", "dark", "system"] },
				language: { type: "string" },
				notifications: {
					type: "object",
					properties: {
						email: { type: "boolean" },
						push: { type: "boolean" },
						sms: { type: "boolean" },
					},
				},
			},
		},
		tags: {
			type: "array",
			items: { type: "string" },
			description: "User tags",
		},
		projects: {
			type: "array",
			description: "Assigned projects",
			items: {
				type: "object",
				properties: {
					id: { type: "string" },
					name: { type: "string" },
					status: { type: "string", enum: ["active", "planned", "completed", "archived"] },
					priority: { type: "number", minimum: 1, maximum: 5 },
				},
				required: ["id", "name"],
			},
		},
	},
	required: ["name", "email"],
};

const SPEC_OPTIONS = EXAMPLE_SPECS.map((s) => ({ id: s.id, name: s.name }));

function LiveSpecEditor() {
	const [selectedSpecId, setSelectedSpecId] = useState(EXAMPLE_SPECS[0].id);
	const initialSpec = useMemo(
		() => EXAMPLE_SPECS.find((s) => s.id === selectedSpecId)?.spec ?? EXAMPLE_SPECS[0].spec,
		[selectedSpecId],
	);
	const [specValue, setSpecValue] = useState<JsonValue>(initialSpec as unknown as JsonValue);

	const renderedSpec = useMemo(() => specValue as unknown as Spec, [specValue]);

	function handleSpecChange(id: string) {
		setSelectedSpecId(id);
		const spec = EXAMPLE_SPECS.find((s) => s.id === id)?.spec ?? EXAMPLE_SPECS[0].spec;
		setSpecValue(spec as unknown as JsonValue);
	}

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<p className="text-sm text-muted-foreground">
					Edit a json-render spec with Visual JSON and see the rendered UI update live.
				</p>
				<select
					className="ml-auto shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
					value={selectedSpecId}
					onChange={(e) => handleSpecChange(e.target.value)}
				>
					{SPEC_OPTIONS.map((opt) => (
						<option key={opt.id} value={opt.id}>
							{opt.name}
						</option>
					))}
				</select>
			</div>
			<div className="flex gap-4">
				<div className="w-1/2 overflow-hidden rounded-xl border bg-card">
					<JsonEditor
						value={specValue}
						onChange={setSpecValue}
						height={560}
						treeShowValues
					/>
				</div>
				<div className="w-1/2 overflow-auto rounded-xl border bg-card p-4" style={{ maxHeight: 560 }}>
					<JsonRenderView spec={renderedSpec} />
				</div>
			</div>
		</section>
	);
}

export default function VisualJsonDemo() {
	const headingId = useId();
	const [value, setValue] = useState<JsonValue>(SAMPLE_DATA);
	const [originalValue] = useState<JsonValue>(SAMPLE_DATA);

	return (
		<section aria-labelledby={headingId} className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
			<header className="flex flex-col gap-3">
				<h1 id={headingId} className="text-2xl font-semibold">Visual JSON</h1>
				<p className="text-sm text-muted-foreground">
					Schema-aware, embeddable JSON editor with tree navigation, form editing, and diff comparison.
				</p>
			</header>

			<Tabs defaultValue="editor" className="flex flex-col gap-4">
				<TabsList>
					<TabsTrigger value="editor">Editor</TabsTrigger>
					<TabsTrigger value="schema">Schema-aware</TabsTrigger>
					<TabsTrigger value="diff">Diff View</TabsTrigger>
					<TabsTrigger value="readonly">Read-only</TabsTrigger>
					<TabsTrigger value="live-spec">Live Spec Editor</TabsTrigger>
				</TabsList>

				<TabsContent value="editor">
					<section className="flex flex-col gap-3">
						<p className="text-sm text-muted-foreground">
							Full editor with tree sidebar, form editing, drag-and-drop, and keyboard navigation.
						</p>
						<div className="overflow-hidden rounded-xl border bg-card">
							<JsonEditor
								value={value}
								onChange={setValue}
								height={520}
							/>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="schema">
					<section className="flex flex-col gap-3">
						<p className="text-sm text-muted-foreground">
							With a JSON Schema attached, the editor validates input, shows descriptions, and provides enum dropdowns.
						</p>
						<div className="overflow-hidden rounded-xl border bg-card">
							<JsonEditor
								value={value}
								onChange={setValue}
								schema={SAMPLE_SCHEMA}
								editorShowDescriptions
								height={520}
							/>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="diff">
					<section className="flex flex-col gap-3">
						<p className="text-sm text-muted-foreground">
							Side-by-side comparison of the original data vs. your edits. Make changes in the Editor tab to see diffs here.
						</p>
						<div className="overflow-hidden rounded-xl border bg-card p-4">
							<DiffView
								originalJson={originalValue}
								currentJson={value}
							/>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="readonly">
					<section className="flex flex-col gap-3">
						<p className="text-sm text-muted-foreground">
							Read-only mode for inspecting JSON without allowing edits.
						</p>
						<div className="overflow-hidden rounded-xl border bg-card">
							<JsonEditor
								value={value}
								readOnly
								treeShowValues
								treeShowCounts
								height={520}
							/>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="live-spec">
					<LiveSpecEditor />
				</TabsContent>
			</Tabs>
		</section>
	);
}
