import type { ComponentDetail } from "@/app/data/component-detail-types";

export const ENVIRONMENT_VARIABLE_DETAIL: ComponentDetail = {
	description:
		"A compound component for displaying environment variables with automatic value masking, visibility toggle, copy-to-clipboard in multiple formats, and required status badges.",
	usage: `import {
  EnvironmentVariable,
  EnvironmentVariableHeader,
  EnvironmentVariableTitle,
  EnvironmentVariableToggle,
  EnvironmentVariableContent,
  EnvironmentVariableItem,
  EnvironmentVariableName,
  EnvironmentVariableValue,
  EnvironmentVariableCopyButton,
  EnvironmentVariableRequired,
  EnvironmentVariableGroup,
} from "@/components/ui-custom/environment-variable";

<EnvironmentVariable>
  <EnvironmentVariableHeader>
    <EnvironmentVariableTitle />
    <EnvironmentVariableToggle />
  </EnvironmentVariableHeader>
  <EnvironmentVariableContent>
    <EnvironmentVariableItem name="API_KEY" value="sk-123abc">
      <EnvironmentVariableGroup>
        <EnvironmentVariableName />
        <EnvironmentVariableRequired />
      </EnvironmentVariableGroup>
      <EnvironmentVariableGroup>
        <EnvironmentVariableValue />
        <EnvironmentVariableCopyButton />
      </EnvironmentVariableGroup>
    </EnvironmentVariableItem>
  </EnvironmentVariableContent>
</EnvironmentVariable>`,
	props: [
		{
			name: "showValues",
			type: "boolean",
			description: "Controlled visibility state for all variable values.",
		},
		{
			name: "defaultShowValues",
			type: "boolean",
			default: "false",
			description: "Initial visibility state when used uncontrolled.",
		},
		{
			name: "onShowValuesChange",
			type: "(show: boolean) => void",
			description: "Callback fired when visibility state changes.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root container.",
		},
	],
	subComponents: [
		{ name: "EnvironmentVariable", description: "Root container with visibility context provider." },
		{ name: "EnvironmentVariableHeader", description: "Header row with title and toggle controls." },
		{ name: "EnvironmentVariableTitle", description: "Title text, defaults to 'Environment Variables'." },
		{ name: "EnvironmentVariableToggle", description: "Switch to toggle value visibility with eye icon." },
		{ name: "EnvironmentVariableContent", description: "Content container with dividers between variables." },
		{ name: "EnvironmentVariableItem", description: "Individual variable row providing name/value context to children." },
		{ name: "EnvironmentVariableGroup", description: "Flex group for laying out name/value/action elements." },
		{ name: "EnvironmentVariableName", description: "Monospace variable name display." },
		{ name: "EnvironmentVariableValue", description: "Value display with automatic dot masking when hidden." },
		{ name: "EnvironmentVariableCopyButton", description: "Copy button with format options: value, name, or export." },
		{ name: "EnvironmentVariableRequired", description: "Badge indicating a variable is required." },
	],
	examples: [
		{ title: "With copy buttons", description: "Variables with individual copy buttons supporting value and export formats.", demoSlug: "environment-variable-demo-with-copy" },
		{ title: "With required badges", description: "Variables marked as required alongside optional ones.", demoSlug: "environment-variable-demo-with-required" },
		{ title: "Values revealed", description: "Custom title with values visible by default.", demoSlug: "environment-variable-demo-revealed" },
		{ title: "Minimal", description: "Default rendering without copy buttons or badges.", demoSlug: "environment-variable-demo-minimal" },
	],
};
