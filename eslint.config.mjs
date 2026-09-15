import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { plugin as shadcn } from "@shadcn/lint";

const buttonRestyleContract = {
	pattern: "^Button$",
	allow: ["layout"],
	deny: ["h-*", "min-h-*", "max-h-*", "size-*"],
	message: {
		layout: "Button owns its height. Use its size prop in {{file}}; keep placement and width at the caller.",
		shape: "Use Button's shape or variant props in {{file}} instead of overriding its radius or border.",
	},
};
const badgeRestyleContract = {
	pattern: "^Badge$",
	allow: ["layout"],
	deny: ["h-*", "min-h-*", "max-h-*", "size-*"],
};
const designSystemRestyleOptions = {
	// Other primitives remain flexible until their contracts are reviewed.
	allow: ["*"],
	contracts: [buttonRestyleContract, badgeRestyleContract],
};

const vpkIconRestrictedImportNames = [
	"Activity",
	"AlertCircle",
	"ArrowLeft",
	"ArrowRight",
	"Blocks",
	"Code",
	"Calendar",
	"Check",
	"ChevronDown",
	"ChevronRight",
	"ChevronsUpDown",
	"ExternalLink",
	"FileText",
	"Footprints",
	"Forward",
	"GalleryVerticalEnd",
	"Keyboard",
	"LineChart",
	"Link",
	"Maximize2",
	"Menu",
	"MessageCircleQuestion",
	"Mic",
	"MicOff",
	"MoreHorizontal",
	"MousePointerClick",
	"Pause",
	"Play",
	"RotateCw",
	"Search",
	"Settings",
	"Square",
	"Settings2",
	"Trash2",
	"TreePine",
	"TrendingDown",
	"TrendingUp",
	"VolumeX",
	"Waves",
];

const appComponentRestrictedImportPaths = [
	{
		name: "lucide-react",
		message:
			'Use "@/components/ui/vpk-icons" or direct "@atlaskit/icon" imports instead of "lucide-react".',
	},
	{
		name: "@/components/ui/vpk-icons",
		importNames: vpkIconRestrictedImportNames,
		message:
			'Use the stable "*Icon" exports from "@/components/ui/vpk-icons" instead of the Lucide-compat aliases.',
	},
];

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		files: ["app/**/*.{js,jsx,ts,tsx}", "components/**/*.{js,jsx,ts,tsx}"],
		plugins: { shadcn },
	},
	{
		// Expand this pilot only after reviewing each consumer's customization.
		files: [
			"components/projects/jira-team-eu26/**/*.{ts,tsx}",
			"components/blocks/agent-session-column/**/*.{ts,tsx}",
		],
		settings: {
			shadcn: {
				note: "See DESIGN.md and .agents/rules/component-architecture.md for component ownership and lint maintenance.",
			},
		},
		rules: {
			"shadcn/no-restyle": ["warn", designSystemRestyleOptions],
		},
	},
	{
		files: ["components/blocks/agent-session-column/index.tsx"],
		rules: {
			"shadcn/no-restyle": ["warn", {
				...designSystemRestyleOptions,
				contracts: [
					{
						...buttonRestyleContract,
						// This owner controls hover/focus visibility and the outlined
						// collapsed drag-preview chip. These are lifecycle states,
						// not general Button treatments; preserve their existing proof.
						allow: [
							...buttonRestyleContract.allow,
							"opacity-0", "opacity-100", "transition-opacity",
							"transition-none", "duration-normal", "ease-out-practical",
							"border", "border-border", "bg-surface-overlay", "text-icon-subtle",
						],
					},
					badgeRestyleContract,
				],
			}],
		},
	},
	{
		files: ["components/blocks/agent-session-column/agent-session-column-header.tsx"],
		rules: {
			"shadcn/no-restyle": ["warn", {
				...designSystemRestyleOptions,
				contracts: [
					{
						...buttonRestyleContract,
						// The collapsed Expand control's gutter hit area stays
						// transparent; its 24px child owns hover and focus paint.
						allow: [
							...buttonRestyleContract.allow,
							"bg-transparent", "focus-visible:border-transparent", "focus-visible:ring-0",
						],
					},
					badgeRestyleContract,
				],
			}],
		},
	},
	{
		files: ["components/ui/**/*.{js,jsx,ts,tsx}"],
		rules: { "shadcn/no-restyle": "off" },
	},
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next:
		".next/**",
		"out/**",
		"build/**",
		".expect/**",
		".tmp/**",
		".venv/**",
		"tmp/**",
		"next-env.d.ts",
		"components/blocks/login/**",
	]),
	{
		files: ["**/*.js", "**/*.cjs"],
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
	{
		files: ["app/**/*.ts", "app/**/*.tsx", "components/**/*.ts", "components/**/*.tsx"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: appComponentRestrictedImportPaths,
				},
			],
		},
	},
	{
		files: ["components/projects/rovo/**/*.{js,jsx,ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: appComponentRestrictedImportPaths,
					patterns: [
						{
							group: ["@/components/projects/studio/**"],
							message:
								"Rovo project code must not import Studio internals. Move shared behavior to rovo-core or pass it through a route adapter.",
						},
					],
				},
			],
		},
	},
	{
		files: ["components/projects/studio/**/*.{js,jsx,ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: appComponentRestrictedImportPaths,
					patterns: [
						{
							group: ["@/components/projects/rovo/**"],
							message:
								"Studio project code must not import Rovo route internals. Move shared behavior to rovo-core or pass it through a route adapter.",
						},
					],
				},
			],
		},
	},
	{
		files: [
			"app/contexts/**/*.{js,jsx,ts,tsx}",
			"components/projects/shared/**/*.{js,jsx,ts,tsx}",
			"components/projects/sidebar-chat/**/*.{js,jsx,ts,tsx}",
		],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: appComponentRestrictedImportPaths,
					patterns: [
						{
							group: ["@/components/projects/rovo/**", "@/components/projects/studio/**"],
							message:
								"Shared app context and shared project code must not depend on route internals. Use rovo-core or a route-owned adapter.",
						},
					],
				},
			],
		},
	},
	{
		files: ["components/ui/**/*.{js,jsx,ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: appComponentRestrictedImportPaths,
					patterns: [
						{
							group: ["@/app/**", "@/components/projects/**"],
							message:
								"Shared UI primitives must stay generic and must not import app routes or project-specific surfaces.",
						},
					],
				},
			],
		},
	},
	{
		settings: {
			react: {
				version: "19.2.5",
			},
		},
		rules: {
			// Next 16 enables React compiler-style rules that the current repo is not
			// consistently written to satisfy yet; keep lint focused on the existing
			// enforced standards until that cleanup happens intentionally.
			"react-hooks/immutability": "off",
			"react-hooks/preserve-manual-memoization": "off",
			"react-hooks/purity": "off",
			"react-hooks/refs": "off",
			"react-hooks/set-state-in-effect": "off",
			"react-hooks/static-components": "off",
		},
	},
	{
		files: ["components/blocks/dashboard/components/data-table.tsx"],
		rules: {
			"react-hooks/incompatible-library": "off",
		},
	},
]);

export default eslintConfig;
