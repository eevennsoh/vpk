"use client";

import { Suspense, createElement, type ComponentType, use, useRef } from "react";
import { token } from "@/lib/tokens";
import type { DemoLayout, ExampleDefinition } from "@/app/data/component-detail-types";
import {
	loadVariantDemoComponents,
	type DemoCategory,
} from "@/components/website/demo-registry-loader";
import { Lozenge } from "@/components/ui/lozenge";
import { AnchorLinkButton, DocSection } from "./doc-section";
import { DemoPreviewShell } from "./demo-preview-shell";
import { resolveExamplesShellLayout } from "./preview-layout";
import { exampleGroupId, toExampleRows } from "./example-groups";
import { useNearViewport } from "./use-near-viewport";

/** Map example badge variant (Badge-style names) to Lozenge variant. */
const badgeVariantToLozenge: Record<string, "neutral" | "success" | "danger" | "information" | "discovery" | "warning"> = {
	neutral: "neutral",
	success: "success",
	danger: "danger",
	information: "information",
	discovery: "discovery",
	warning: "warning",
	secondary: "neutral",
	default: "neutral",
	info: "information",
};

function slugify(name: string) {
	return name.replace(/\s+/g, "-").toLowerCase();
}

function ExampleGroupHeading({ group }: Readonly<{ group: string }>) {
	const id = exampleGroupId(group);
	return (
		<div id={id} className="group flex items-center gap-1">
			<h3 style={{ font: token("font.heading.small"), color: token("color.text"), margin: 0 }}>{group}</h3>
			<AnchorLinkButton id={id} label={group} />
		</div>
	);
}

interface DocExamplesProps {
	examples: ExampleDefinition[];
	category: DemoCategory;
	demoLayout?: DemoLayout;
}

function ExampleSkeleton() {
	return (
		<div
			style={{
				display: "flex",
				width: "100%",
				alignItems: "center",
				justifyContent: "center",
				minHeight: 120,
			}}
		>
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: 8,
					backgroundColor: token("color.background.neutral"),
					animation: "pulse 2s ease-in-out infinite",
				}}
			/>
		</div>
	);
}

function ExampleItem({
	category,
	example,
	Demo,
	demoLayout,
}: Readonly<{ category: DemoCategory; example: ExampleDefinition; Demo: ComponentType; demoLayout?: DemoLayout }>) {
	const id = example.id ?? slugify(example.title);
	const shell = resolveExamplesShellLayout(category, demoLayout);
	// Examples under a group heading sit one heading level below it.
	const Heading = example.group ? "h4" : "h3";
	const containerRef = useRef<HTMLDivElement>(null);
	const shouldMount = useNearViewport(containerRef, demoLayout?.examplesMount === "near-viewport");
	return (
		<div
			ref={containerRef}
			id={id}
			className="group"
			style={{
				display: "flex",
				flexDirection: "column",
				gap: token("space.150"),
			}}
		>
			<div>
				<div className="flex items-center gap-1">
					<Heading
						style={{
							fontSize: "14px",
							fontWeight: 600,
							color: token("color.text"),
							margin: 0,
						}}
					>
						{example.title}
						{example.badge ? (
							<Lozenge
								variant={badgeVariantToLozenge[example.badge.variant] ?? "neutral"}
								className="ml-2 align-middle"
							>
								{example.badge.label}
							</Lozenge>
						) : null}
					</Heading>
					<AnchorLinkButton id={id} label={example.title} />
				</div>
				{example.description ? <p
						style={{
							fontSize: "13px",
							color: token("color.text.subtle"),
							margin: 0,
							marginTop: token("space.050"),
						}}
					>
						{example.description}
					</p> : null}
			</div>
			<DemoPreviewShell
				contentWidth={shell.contentWidth}
				fullPage={shell.fullPage}
				fitContent={shell.fitContent}
			>
				{shouldMount ? (
					<Suspense fallback={<ExampleSkeleton />}>
						{createElement(Demo)}
					</Suspense>
				) : (
					<ExampleSkeleton />
				)}
			</DemoPreviewShell>
		</div>
	);
}

function ResolvedDocExamples({
	examples,
	category,
	demoLayout,
}: Readonly<DocExamplesProps>) {
	const demos = use(
		loadVariantDemoComponents(
			examples.map((example) => example.demoSlug),
			category,
		),
	);
	const resolvedExamples = examples
		.map((example, index) => ({
			example,
			Demo: demos[index] ?? null,
		}))
		.filter(
			(entry): entry is { example: ExampleDefinition; Demo: ComponentType } =>
				entry.Demo !== null
		);

	if (resolvedExamples.length === 0) {
		return null;
	}

	return (
		<DocSection id="examples" title="Examples">
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: token("space.400"),
				}}
			>
				{toExampleRows(resolvedExamples).map((row) =>
					row.kind === "group" ? (
						<ExampleGroupHeading key={`group:${row.group}`} group={row.group} />
					) : (
						<ExampleItem
							category={category}
							key={row.example.demoSlug}
							example={row.example}
							Demo={row.Demo}
							demoLayout={demoLayout}
						/>
					),
				)}
			</div>
		</DocSection>
	);
}

export function DocExamples(props: Readonly<DocExamplesProps>) {
	return (
		<Suspense fallback={null}>
			<ResolvedDocExamples {...props} />
		</Suspense>
	);
}
