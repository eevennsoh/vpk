// oxlint-disable react-doctor/prefer-module-scope-static-value -- These values are intentionally colocated with the component/demo contract for readability and token context.

import { token } from "@/lib/tokens";
import type { ComponentDetail } from "@/app/data/component-detail-types";
import type { ComponentCategory } from "@/app/data/component-manifest";
import { DocHero } from "./components/doc-hero";
import { DocPreview } from "./components/doc-preview";
import { DocInstallation } from "./components/doc-installation";
import { DocUsage } from "./components/doc-usage";
import { DocPropsTable } from "./components/doc-props-table";
import { DocExamples } from "./components/doc-examples";
import { resolveBleedWrapperDividers, shouldBleedExamples } from "./components/preview-layout";
import { getDocImportReferences, getDocReferenceLinks } from "./components/source-links.server";

interface ComponentDocProps {
	component: {
		name: string;
		slug: string;
		importPath: string;
		category: ComponentCategory;
		detail?: ComponentDetail;
	};
}

export function ComponentDoc({ component }: Readonly<ComponentDocProps>) {
	const { name, slug, importPath, category, detail } = component;
	const contentContainerStyle = {
		maxWidth: 860,
		marginInline: "auto",
		paddingInline: token("space.300"),
	};
	const previewContainerStyle = {
		paddingInline: 24,
	};
	const articleStyle = {
		paddingBottom: token("space.600"),
	};
	// Examples normally sit in the 860px reading container with the rest of the
	// prose. Opting into "bleed" moves them into the same wide band the preview
	// uses, so a wide demo renders at an identical width in both sections.
	const bleedExamples = shouldBleedExamples(detail?.demoLayout);
	const examplesSection = detail?.examples && detail.examples.length > 0 ? (
		<DocExamples
			examples={detail.examples}
			category={category}
			demoLayout={detail.demoLayout}
		/>
	) : null;
	const installationAndUsage = (
		<>
			{/* 3. Installation — always shown */}
			<DocInstallation
				importPath={importPath}
				name={name}
				importStatement={detail?.importStatement}
			/>

			{/* 4. Usage — only if data exists */}
			{detail?.usage ? <DocUsage usage={detail.usage} /> : null}
		</>
	);
	const propsSection = detail?.props ? (
		/* 6. API Reference — only if props data exists */
		<DocPropsTable
			componentName={detail.apiName ?? name.replace(/\s+/g, "")}
			props={detail.props}
			subComponents={detail.subComponents}
		/>
	) : null;
	const detailSections = (
		<>
			{installationAndUsage}

			{/* 5. Examples — only if data exists */}
			{examplesSection}

			{propsSection}
		</>
	);
	// `DocSection` hides its own divider with `last:border-b-0`, which resolves
	// against its DOM parent. The bleed branch below splits the sections across
	// three width wrappers, which changes who is `:last-child`, so any wrapper
	// still followed by a section has to re-assert the divider.
	const bleedDividers = resolveBleedWrapperDividers(examplesSection !== null, propsSection !== null);

	return (
		<article style={articleStyle}>
			<div style={contentContainerStyle}>
				{/* 1. Hero — always shown */}
				<DocHero
					name={name}
					description={detail?.description}
					category={category}
					importReferences={getDocImportReferences(importPath)}
					referenceLinks={getDocReferenceLinks(detail?.adsLinks)}
				/>
			</div>

		<div style={previewContainerStyle}>
			{/* 2. Preview — always shown (if demo exists) */}
			<DocPreview slug={slug} category={category} demoLayout={detail?.demoLayout} />
		</div>

			{bleedExamples ? (
				<>
					<div
						style={contentContainerStyle}
						className={bleedDividers.installationAndUsage}
					>
						{installationAndUsage}
					</div>
					<div style={previewContainerStyle} className={bleedDividers.examples}>
						{examplesSection}
					</div>
					<div style={contentContainerStyle} className={bleedDividers.props}>
						{propsSection}
					</div>
				</>
			) : (
				<div style={contentContainerStyle}>
					{detailSections}
				</div>
			)}
		</article>
	);
}
