"use client";

import { Suspense, createElement, type ComponentType, use } from "react";
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
	return (
		<div
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
					<h3
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
					</h3>
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
				<Suspense fallback={<ExampleSkeleton />}>
					{createElement(Demo)}
				</Suspense>
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
				{resolvedExamples.map(({ example, Demo }) => (
					<ExampleItem
						category={category}
						key={example.demoSlug}
						example={example}
						Demo={Demo}
						demoLayout={demoLayout}
					/>
				))}
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
