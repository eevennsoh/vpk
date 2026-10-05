import { createRequire } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { plugin as shadcn } from "@shadcn/lint";

const installedReactVersion = createRequire(import.meta.url)("react/package.json").version;

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
// gotchas-ui.md: overlay elevation already defines the surface, so an outer border or
// ring draws a double outline. Separators on the surface's children stay allowed.
const overlaySurfaceContract = {
	pattern: "^(Popover|DropdownMenu|DropdownMenuSub|HoverCard|ContextMenu|ContextMenuSub|Menubar|MenubarSub|Select|Combobox|NavigationMenu|Tooltip)Content$",
	allow: ["*"],
	// Width classes only: border-0 / ring-0 removals stay legal.
	deny: [
		"border", "border-x", "border-y", "border-s", "border-e", "border-t", "border-r", "border-b", "border-l",
		"border-2", "border-4", "border-8", "border-[*", "ring", "ring-1", "ring-2", "ring-4", "ring-8", "ring-[*",
	],
	message: {
		shape: "{{file}} surfaces are defined by overlay elevation; drop the outer border/ring (gotchas-ui.md) and keep separators on children.",
	},
};
const designSystemRestyleOptions = {
	// Other primitives remain flexible until their contracts are reviewed.
	allow: ["*"],
	contracts: [buttonRestyleContract, badgeRestyleContract, overlaySurfaceContract],
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

// Flat config replaces a rule's options wholesale when a later block matches the
// same file, so every scoped block composes the shared patterns through this helper.
const sharedRestrictedImportPatterns = [
	{
		// Specifiers with an explicit extension stay legal: node:test loads those modules
		// directly with type stripping, which cannot resolve the @/ alias.
		regex: "^(\\.\\./){2,}(?!.*\\.[cm]?[jt]sx?$)",
		message: "Use the @/ alias instead of a deep relative import (AGENTS.md → Non-negotiable Defaults).",
	},
];

function restrictedImports(...scopePatterns) {
	return [
		"error",
		{
			paths: appComponentRestrictedImportPaths,
			patterns: [...sharedRestrictedImportPatterns, ...scopePatterns],
		},
	];
}

const blockLayerImportPattern = {
	// shared and rovo-core are the cross-project layers that blocks may build on.
	group: ["@/components/projects/*", "!@/components/projects/shared", "!@/components/projects/rovo-core"],
	message:
		"Blocks sit below projects. Move the shared behavior into the block (or components/projects/shared) and let the project pass it in.",
};
const frozenVariantImportPattern = {
	group: ["@/components/blocks/jira-work-item/experimental-v*/**"],
	message:
		"Numbered experimental variants are project-owned snapshots. Import the block's stable surface or move the shared piece out of the variant.",
};

// One array per scope because no-restricted-syntax options are also replaced wholesale.
const react19Syntax = [
	{
		selector: "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name='forwardRef'], MemberExpression[object.name='React'][property.name='forwardRef']",
		message: "React 19 passes ref as a regular prop; don't use forwardRef.",
	},
	{
		selector: "JSXOpeningElement > JSXMemberExpression[object.name=/Context$/][property.name='Provider']",
		message: "React 19: render <Context value={…}> instead of <Context.Provider>.",
	},
];
// Children only: react/jsx-no-leaked-render also flags prop values, where `a && b` → null
// would drop attributes like aria-*/data-* that render `false`.
const conditionalRenderSyntax = [
	{
		selector: ":matches(JSXElement, JSXFragment) > JSXExpressionContainer > LogicalExpression[operator='&&']",
		message: "Render conditionally with a ternary (cond ? <X /> : null); `&&` renders 0 or \"\" when the condition is falsy.",
	},
];
const motionTokenSyntax = [
	{
		selector: "Property[key.name=/^(ease|easing)$/] > ArrayExpression, VariableDeclarator[id.name=/(EASE|[Ee]ase|CURVE|[Cc]urve|BEZIER|[Bb]ezier)$/] > ArrayExpression[elements.length=4]",
		message: "Use a curve from @/lib/motion (motionEase.*) instead of an inline cubic-bezier array.",
	},
	{
		selector: "Literal[value=/cubic-bezier\\(/], TemplateElement[value.raw=/cubic-bezier\\(/]",
		message: "Use var(--ease-*) or an ease-* utility instead of a hand-written cubic-bezier().",
	},
	{
		selector: "Literal[value=/\\bduration-(\\[[0-9]|[1-9])/], TemplateElement[value.raw=/\\bduration-(\\[[0-9]|[1-9])/]",
		message: "Use a duration token utility (duration-fast, duration-normal, duration-medium, …) instead of a numeric duration.",
	},
];
const hydrationSafeSyntax = [
	{
		selector: "NewExpression[callee.object.name='Intl'][arguments.length=0], CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/][arguments.length=0]",
		message: 'Pass an explicit locale (e.g. "en-US") so server and client format identically.',
	},
];
const capabilitySyntax = [
	{
		selector: "JSXAttribute[name.name=/^on[A-Z]/] > JSXExpressionContainer > ArrowFunctionExpression[body.type='BlockStatement'][body.body.length=0]",
		message: "Don't wire a control to a no-op handler. Omit the prop so the control renders display-only or disabled until a real capability exists (component-architecture.md).",
	},
	{
		selector: "JSXOpeningElement[name.name='Toaster']:not(:has(JSXAttribute[name.name='id']))",
		message: "Give each <Toaster /> a unique id and pass the matching toasterId to toast.* (gotchas-ui.md).",
	},
];
const appRestrictedSyntax = [...react19Syntax, ...conditionalRenderSyntax, ...motionTokenSyntax, ...hydrationSafeSyntax, ...capabilitySyntax];
const apiRouteRestrictedSyntax = [
	...appRestrictedSyntax,
	{
		selector: "CallExpression[callee.object.name=/^(request|req)$/][callee.property.name='json']",
		message: "Use readJsonBody() from @/app/api/_utils/read-json-body so malformed JSON returns the route's public error shape (api-surfaces.md).",
	},
];

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		files: ["app/**/*.{js,jsx,ts,tsx}", "components/**/*.{js,jsx,ts,tsx}"],
		plugins: { shadcn },
		rules: {
			// Repo-wide contracts only for established policy; the pilot blocks below add the rest.
			"shadcn/no-restyle": ["error", { allow: ["*"], contracts: [overlaySurfaceContract] }],
		},
	},
	{
		// Expand this pilot only after reviewing each consumer's customization.
		files: [
			"components/projects/jira-team-eu26/**/*.{ts,tsx}",
			"components/projects/jira-team-eu26-end/**/*.{ts,tsx}",
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
		// Vendored Rovo Stage Kit, served as is and replaced whole (its GUIDE.md).
		"public/1p/rovo-stage-kit/**",
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
			"no-restricted-imports": restrictedImports(),
		},
	},
	{
		files: ["components/projects/rovo/**/*.{js,jsx,ts,tsx}"],
		rules: {
			"no-restricted-imports": restrictedImports({
				group: ["@/components/projects/studio/**"],
				message:
					"Rovo project code must not import Studio internals. Move shared behavior to rovo-core or pass it through a route adapter.",
			}),
		},
	},
	{
		files: ["components/projects/studio/**/*.{js,jsx,ts,tsx}"],
		rules: {
			"no-restricted-imports": restrictedImports({
				group: ["@/components/projects/rovo/**"],
				message:
					"Studio project code must not import Rovo route internals. Move shared behavior to rovo-core or pass it through a route adapter.",
			}),
		},
	},
	{
		files: [
			"app/contexts/**/*.{js,jsx,ts,tsx}",
			"components/projects/shared/**/*.{js,jsx,ts,tsx}",
			"components/projects/sidebar-chat/**/*.{js,jsx,ts,tsx}",
		],
		rules: {
			"no-restricted-imports": restrictedImports({
				group: ["@/components/projects/rovo/**", "@/components/projects/studio/**"],
				message:
					"Shared app context and shared project code must not depend on route internals. Use rovo-core or a route-owned adapter.",
			}),
		},
	},
	{
		files: ["components/ui/**/*.{js,jsx,ts,tsx}"],
		rules: {
			"no-restricted-imports": restrictedImports({
				group: ["@/app/**", "@/components/projects/**"],
				message:
					"Shared UI primitives must stay generic and must not import app routes or project-specific surfaces.",
			}),
		},
	},
	{
		files: ["components/ui-custom/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": restrictedImports({
				group: ["@/components/blocks/**", "@/components/projects/**"],
				message:
					"ui-custom sits below blocks and projects. Accept the product-specific piece as a prop or move it down into ui-custom.",
			}),
		},
	},
	{
		files: ["components/blocks/**/*.{ts,tsx}"],
		ignores: ["components/blocks/jira-work-item/**"],
		rules: {
			"no-restricted-imports": restrictedImports(blockLayerImportPattern, frozenVariantImportPattern),
		},
	},
	{
		files: ["components/blocks/jira-work-item/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": restrictedImports(blockLayerImportPattern),
		},
	},
	{
		// node:test suites load sources without the @/ resolver, so relative paths stay legal there.
		files: ["**/*.test.{ts,tsx}"],
		rules: {
			"no-restricted-imports": ["error", { paths: appComponentRestrictedImportPaths }],
		},
	},
	{
		files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-syntax": ["error", ...appRestrictedSyntax],
		},
	},
	{
		files: ["app/api/**/*.ts"],
		rules: {
			"no-restricted-syntax": ["error", ...apiRouteRestrictedSyntax],
		},
	},
	{
		// Regex over source text passes when behavior breaks and fails on harmless refactors.
		// Existing assertions are baselined; new proof renders or calls the code.
		files: ["app/**/*.test.{js,mjs,cjs,ts}", "components/**/*.test.{js,mjs,cjs,ts}", "hooks/**/*.test.{js,mjs,cjs,ts}", "lib/**/*.test.{js,mjs,cjs,ts}"],
		rules: {
			"no-restricted-syntax": ["error", {
				selector: "CallExpression[callee.object.name='assert'][callee.property.name=/^(match|doesNotMatch)$/]:matches([arguments.0.name=/SOURCE$/], [arguments.0.callee.name=/^(readFileSync|readProjectFile)$/])",
				message: "Prove behavior instead of matching source text: render and interact with renderComponent() (scripts/lib/render-component.js) or test the pure helper; enforce structure with lint.",
			}],
		},
	},
	{
		// Each worktree has its own port and Portless host; a literal origin silently tests another checkout.
		files: ["tests/**/*.ts"],
		ignores: ["tests/helpers/origin.ts", "tests/helpers/origin.test.ts"],
		rules: {
			"no-restricted-syntax": ["error", {
				selector: "Literal[value=/(127\\.0\\.0\\.1|localhost):[0-9]+|[a-z0-9-]+\\.localhost/], TemplateElement[value.raw=/(127\\.0\\.0\\.1|localhost):[0-9]+|[a-z0-9-]+\\.localhost/]",
				message: "Use appUrl() / resolveAppOrigin() from tests/helpers/origin.ts; a hardcoded port or *.localhost host tests another checkout's server.",
			}],
		},
	},
	{
		// gotchas-ui.md: hidden must be unreachable, and anything clickable must be focusable
		// and operable by keyboard. anchor-is-valid, no-autofocus, and no-noninteractive-tabindex
		// stay off: prototypes use placeholder links, composers autofocus, scroll regions take tabIndex.
		files: ["app/**/*.{jsx,tsx}", "components/**/*.{jsx,tsx}"],
		rules: {
			"jsx-a11y/alt-text": "error",
			"jsx-a11y/aria-activedescendant-has-tabindex": "error",
			"jsx-a11y/aria-props": "error",
			"jsx-a11y/aria-proptypes": "error",
			"jsx-a11y/aria-role": "error",
			"jsx-a11y/click-events-have-key-events": "error",
			"jsx-a11y/interactive-supports-focus": "error",
			"jsx-a11y/no-aria-hidden-on-focusable": "error",
			"jsx-a11y/no-interactive-element-to-noninteractive-role": "error",
			"jsx-a11y/no-noninteractive-element-interactions": "error",
			"jsx-a11y/no-noninteractive-element-to-interactive-role": "error",
			"jsx-a11y/no-static-element-interactions": "error",
			"jsx-a11y/role-has-required-aria-props": "error",
			"jsx-a11y/role-supports-aria-props": "error",
		},
	},
	{
		settings: {
			react: {
				// eslint-plugin-react's "detect" calls an API ESLint 10 removed.
				version: installedReactVersion,
			},
		},
	},
	{
		// Same file globs eslint-config-next registers its react-hooks and @next plugins for.
		files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
		rules: {
			// Existing violations live in eslint-suppressions.json and may only shrink.
			"react-hooks/immutability": "error",
			"react-hooks/purity": "error",
			"react-hooks/refs": "error",
			"react-hooks/set-state-in-effect": "error",
			"react-hooks/static-components": "error",
			// Only meaningful once the React Compiler is enabled in next.config.ts.
			"react-hooks/preserve-manual-memoization": "off",
			"@typescript-eslint/no-unused-vars": ["error", {
				argsIgnorePattern: "^_",
				caughtErrorsIgnorePattern: "^_",
				destructuredArrayIgnorePattern: "^_",
				ignoreRestSiblings: true,
				varsIgnorePattern: "^_",
			}],
			"@next/next/no-location-assign-relative-destination": "error",
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
