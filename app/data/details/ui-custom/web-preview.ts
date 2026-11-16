import type { ComponentDetail } from "@/app/data/component-detail-types";

export const WEB_PREVIEW_DETAIL: ComponentDetail = {
	description:
		"A composable browser-like preview container with navigation controls, editable URL bar, auto-switching Chromium mirroring for external URLs, iframe fallback for relative routes, and an optional collapsible console output panel.",
	usage: `import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewConsole,
} from "@/components/ui-custom/web-preview";

<WebPreview defaultUrl="https://example.com">
  <WebPreviewNavigation>
    <WebPreviewNavigationButton action="back" tooltip="Back">
      <ArrowLeft className="size-4" />
    </WebPreviewNavigationButton>
    <WebPreviewNavigationButton action="forward" tooltip="Forward">
      <ArrowRight className="size-4" />
    </WebPreviewNavigationButton>
    <WebPreviewNavigationButton action="reload" tooltip="Reload">
      <RotateCw className="size-4" />
    </WebPreviewNavigationButton>
    <WebPreviewUrl />
  </WebPreviewNavigation>
  <WebPreviewBody />
  <WebPreviewConsole logs={logs} />
</WebPreview>`,
	props: [
		{
			name: "defaultUrl",
			type: "string",
			default: '""',
			description: "Initial URL loaded in the preview. Absolute web URLs use Chromium mirroring by default; relative URLs stay in the iframe renderer.",
		},
		{
			name: "engine",
			type: '"auto" | "iframe" | "chromium"',
			default: '"auto"',
			description: "Choose how the preview body renders. `auto` uses Chromium for external URLs and the iframe body for relative/local routes.",
		},
		{
			name: "onUrlChange",
			type: "(url: string) => void",
			description: "Callback fired when the preview URL changes, including Chromium-side redirects after navigation.",
		},
		{
			name: "logs",
			type: '{ level: "log" | "warn" | "error"; message: string; timestamp: Date }[]',
			description: "Console log entries displayed in the WebPreviewConsole panel.",
		},
		{
			name: "loading",
			type: "ReactNode",
			description: "Optional loading overlay rendered inside WebPreviewBody.",
		},
		{
			name: "tooltip",
			type: "string",
			description: "Hover tooltip text for WebPreviewNavigationButton.",
		},
		{
			name: "action",
			type: '"back" | "forward" | "reload"',
			description: "Optional built-in navigation action for WebPreviewNavigationButton when Chromium preview is active.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to any sub-component.",
		},
	],
	subComponents: [
		{ name: "WebPreview", description: "Root container and context provider managing URL and console open state." },
		{ name: "WebPreviewNavigation", description: "Flex navigation bar with border separator for buttons and URL input." },
		{ name: "WebPreviewNavigationButton", description: "Ghost button with tooltip for navigation actions (back, forward, reload, fullscreen)." },
		{ name: "WebPreviewUrl", description: "Editable URL input synced with context. Pressing Enter navigates to the entered URL." },
		{ name: "WebPreviewBody", description: "Preview body that renders relative/local routes in a sandboxed iframe and external URLs through Chromium mirroring. Keyboard (Chromium): keys are forwarded to the page, but Tab leaves the preview; press Enter on a preview reached by keyboard, or use the Capture keys toggle, to forward every key including Tab, and press Escape to release (Escape is not sent to the page while captured)." },
		{ name: "WebPreviewConsole", description: "Collapsible console panel with color-coded log levels (log, warn, error) and timestamps." },
	],
	examples: [
		{ title: "With console", description: "Preview with collapsible console showing log, warn, and error entries.", demoSlug: "web-preview-demo-with-console" },
		{ title: "With extra actions", description: "Navigation bar with select, open in new tab, and maximize buttons.", demoSlug: "web-preview-demo-fullscreen" },
		{ title: "URL change callback", description: "Tracks URL changes via onUrlChange callback.", demoSlug: "web-preview-demo-url-change" },
		{ title: "External URL", description: "External website preview using Chromium mirroring instead of server-side proxying.", demoSlug: "web-preview-demo-external" },
	],
};
