import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PACKAGE_INFO_DETAIL: ComponentDetail = {
	description:
		"A compound component for displaying package dependency information with version transitions (current → new), color-coded change type badges (major, minor, patch, added, removed), optional descriptions, and a dependencies list.",
	usage: `import {
  PackageInfo,
  PackageInfoHeader,
  PackageInfoName,
  PackageInfoChangeType,
  PackageInfoVersion,
  PackageInfoDescription,
  PackageInfoContent,
  PackageInfoDependencies,
  PackageInfoDependency,
} from "@/components/ui-custom/package-info";

<PackageInfo name="react" currentVersion="18.2.0" newVersion="19.0.0" changeType="major">
  <PackageInfoHeader>
    <PackageInfoName />
    <PackageInfoChangeType />
  </PackageInfoHeader>
  <PackageInfoVersion />
  <PackageInfoDescription>
    A JavaScript library for building user interfaces.
  </PackageInfoDescription>
</PackageInfo>`,
	props: [
		{
			name: "name",
			type: "string",
			required: true,
			description: "Package name displayed via PackageInfoName.",
		},
		{
			name: "currentVersion",
			type: "string",
			description: "Currently installed version shown in the version transition.",
		},
		{
			name: "newVersion",
			type: "string",
			description: "Target version shown after the arrow in the version transition.",
		},
		{
			name: "changeType",
			type: '"major" | "minor" | "patch" | "added" | "removed"',
			description: "Change category that controls badge color and icon.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root container.",
		},
	],
	subComponents: [
		{ name: "PackageInfo", description: "Root container with context provider for name, versions, and change type." },
		{ name: "PackageInfoHeader", description: "Flex row for package name and change type badge." },
		{ name: "PackageInfoName", description: "Package name with package icon. Defaults to name from context." },
		{ name: "PackageInfoChangeType", description: "Lozenge showing the change category (major, minor, patch, added, removed) with a tone and icon." },
		{ name: "PackageInfoVersion", description: "Version transition display (e.g., 18.2.0 → 19.0.0)." },
		{ name: "PackageInfoDescription", description: "Paragraph element for package description text." },
		{ name: "PackageInfoContent", description: "Content area with top border separator." },
		{ name: "PackageInfoDependencies", description: "Container with 'Dependencies' label and stacked dependency rows." },
		{ name: "PackageInfoDependency", description: "Individual dependency row with name and optional version." },
	],
	examples: [
		{ title: "Full", description: "Package card with version transition, change badge, description, and dependencies list.", demoSlug: "package-info-demo-full" },
		{ title: "Change types", description: "All five change type variants: major, minor, patch, added, and removed.", demoSlug: "package-info-demo-change-types" },
		{ title: "With dependencies", description: "Package with a dependencies section listing related packages.", demoSlug: "package-info-demo-with-dependencies" },
		{ title: "Minimal", description: "Header-only package card with name and version arrow.", demoSlug: "package-info-demo-minimal" },
	],
};
