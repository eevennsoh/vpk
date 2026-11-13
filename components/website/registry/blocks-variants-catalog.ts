import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const BLOCK_VARIANT_CATALOG_DEMO_ENTRIES: Record<string, ComponentType> = {
	"rovo-button-demo-chat": dynamic(
		() => import("../demos/blocks/rovo-button-demo").then((mod) => ({ default: mod.RovoButtonDemoChat })),
		{ ssr: false },
	),
	"rovo-button-demo-toolbar": dynamic(
		() => import("../demos/blocks/rovo-button-demo").then((mod) => ({ default: mod.RovoButtonDemoToolbar })),
		{ ssr: false },
	),
	"rovo-button-demo-proactive": dynamic(
		() => import("../demos/blocks/rovo-button-demo").then((mod) => ({ default: mod.RovoButtonDemoProactive })),
		{ ssr: false },
	),
	"rovo-button-demo-insights": dynamic(
		() => import("../demos/blocks/rovo-button-demo").then((mod) => ({ default: mod.RovoButtonDemoInsights })),
		{ ssr: false },
	),
	"rovo-button-demo-onboarding": dynamic(
		() => import("../demos/blocks/rovo-button-demo").then((mod) => ({ default: mod.RovoButtonDemoOnboarding })),
		{ ssr: false },
	),
	"artifact-demo-code-preview": dynamic(
		() =>
			import("../demos/blocks/artifact-demo").then((mod) => ({
				default: mod.ArtifactDemoCodePreview,
			})),
		{ ssr: false },
	),
	"artifact-demo-image-preview": dynamic(
		() =>
			import("../demos/blocks/artifact-demo").then((mod) => ({
				default: mod.ArtifactDemoImagePreview,
			})),
		{ ssr: false },
	),
	"artifact-demo-streaming": dynamic(
		() =>
			import("../demos/blocks/artifact-demo").then((mod) => ({
				default: mod.ArtifactDemoStreaming,
			})),
		{ ssr: false },
	),
	"artifact-demo-chip": dynamic(
		() =>
			import("../demos/blocks/artifact-demo").then((mod) => ({
				default: mod.ArtifactDemoChip,
			})),
		{ ssr: false },
	),
	"artifact-demo-compound": dynamic(
		() =>
			import("../demos/blocks/artifact-demo").then((mod) => ({
				default: mod.ArtifactDemoCompound,
			})),
		{ ssr: false },
	),

	// Spotlight
	"spotlight-basic": dynamic(
		() =>
			import("../demos/blocks/spotlight-demo").then((mod) => ({
				default: mod.SpotlightBasicExample,
			})),
		{ ssr: false },
	),
	"spotlight-media": dynamic(
		() =>
			import("../demos/blocks/spotlight-demo").then((mod) => ({
				default: mod.SpotlightMediaExample,
			})),
		{ ssr: false },
	),
	"spotlight-tour": dynamic(
		() =>
			import("../demos/blocks/spotlight-demo").then((mod) => ({
				default: mod.SpotlightTourExample,
			})),
		{ ssr: false },
	),
	"spotlight-target": dynamic(
		() =>
			import("../demos/blocks/spotlight-demo").then((mod) => ({
				default: mod.SpotlightTargetExample,
			})),
		{ ssr: false },
	),
	"spotlight-placements": dynamic(
		() =>
			import("../demos/blocks/spotlight-demo").then((mod) => ({
				default: mod.SpotlightPlacementsExample,
			})),
		{ ssr: false },
	),

	// Editor palette
	"editor-palette-nested": dynamic(
		() =>
			import("../demos/blocks/editor-palette-demo").then((mod) => ({
				default: mod.EditorPaletteNested,
			})),
		{ ssr: false },
	),
	"editor-palette-flat": dynamic(
		() =>
			import("../demos/blocks/editor-palette-demo").then((mod) => ({
				default: mod.EditorPaletteFlat,
			})),
		{ ssr: false },
	),
	"editor-palette-search": dynamic(
		() =>
			import("../demos/blocks/editor-palette-demo").then((mod) => ({
				default: mod.EditorPaletteSearch,
			})),
		{ ssr: false },
	),

	// Agent
	"agent-demo-full": dynamic(
		() =>
			import("../demos/blocks/agent-demo").then((mod) => ({
				default: mod.AgentDemoFull,
			})),
		{ ssr: false },
	),
	"agent-demo-empty": dynamic(
		() =>
			import("../demos/blocks/agent-demo").then((mod) => ({
				default: mod.AgentDemoEmpty,
			})),
		{ ssr: false },
	),

	// Skill Config
	"skill-config-demo-full": dynamic(
		() =>
			import("../demos/blocks/skill-config-demo").then((mod) => ({
				default: mod.SkillConfigDemoFull,
			})),
		{ ssr: false },
	),
	"skill-config-demo-empty": dynamic(
		() =>
			import("../demos/blocks/skill-config-demo").then((mod) => ({
				default: mod.SkillConfigDemoEmpty,
			})),
		{ ssr: false },
	),

	// Trigger Config
	"trigger-config-demo-full": dynamic(
		() =>
			import("../demos/blocks/trigger-config-demo").then((mod) => ({
				default: mod.TriggerConfigDemoFull,
			})),
		{ ssr: false },
	),
	"trigger-config-demo-empty": dynamic(
		() =>
			import("../demos/blocks/trigger-config-demo").then((mod) => ({
				default: mod.TriggerConfigDemoEmpty,
			})),
		{ ssr: false },
	),
};
