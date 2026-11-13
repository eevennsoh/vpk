import type { ComponentDetail } from "@/app/data/component-detail-types";

export const FIELD_DETAIL: ComponentDetail = {
    description:
      "A comprehensive form field layout system with support for labels, descriptions, errors, and responsive orientations. Composes Input (text field) and Textarea primitives with field layout components.",
    adsUrl: "https://atlassian.design/components/textfield",
    adsLinks: [
      {
        label: "@atlaskit/textfield",
        url: "https://atlassian.design/components/textfield",
      },
      {
        label: "@atlaskit/textarea",
        url: "https://atlassian.design/components/textarea",
      },
    ],
    usage: `import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

<Field>
  <FieldLabel>Username</FieldLabel>
  <Input variant="subtle" placeholder="Enter username" />
  <FieldDescription>Your display name.</FieldDescription>
</Field>

<Field>
  <FieldLabel>Message</FieldLabel>
  <Textarea placeholder="Type your message..." />
</Field>`,
    props: [
      {
        name: "orientation",
        type: '"vertical" | "horizontal" | "responsive"',
        default: '"vertical"',
        description: "Layout direction.",
      },
      {
        name: "data-invalid",
        type: "boolean",
        description: "Marks the field as invalid.",
      },
    ],
    subComponents: [
      { name: "FieldLabel", description: "Label for the field." },
      { name: "FieldDescription", description: "Helper text below the input." },
      {
        name: "FieldError",
        description: "Error message display with role=alert.",
      },
      { name: "FieldGroup", description: "Container for multiple fields." },
      { name: "FieldSet", description: "Fieldset wrapper for grouped fields." },
      { name: "FieldLegend", description: "Legend for a fieldset." },
    ],
    examples: [
      {
        title: "Default",
        description: "Field with label, input, and description.",
        demoSlug: "field-demo-default",
      },
      {
        title: "Error",
        description: "Field with validation error.",
        demoSlug: "field-demo-error",
      },
      {
        title: "Horizontal",
        description: "Horizontal field layout.",
        demoSlug: "field-demo-horizontal",
      },
      {
        title: "Fieldset",
        description: "Grouped fields with fieldset and legend.",
        demoSlug: "field-demo-fieldset",
      },
      {
        title: "Text field",
        description: "Basic text input field.",
        demoSlug: "field-demo-text-field",
      },
      {
        title: "Text field disabled",
        description: "Disabled text input field.",
        demoSlug: "field-demo-text-field-disabled",
      },
      {
        title: "Text field invalid",
        description: "Text input with error state.",
        demoSlug: "field-demo-text-field-invalid",
      },
      {
        title: "Text field variants",
        description: "Default and subtle input variants.",
        demoSlug: "field-demo-text-field-variants",
      },
      {
        title: "Textarea",
        description: "Basic textarea field.",
        demoSlug: "field-demo-textarea",
      },
      {
        title: "Textarea disabled",
        description: "Disabled textarea field.",
        demoSlug: "field-demo-textarea-disabled",
      },
      {
        title: "Textarea invalid",
        description: "Textarea with error state.",
        demoSlug: "field-demo-textarea-invalid",
      },
      {
        title: "Form",
        description: "Form with text inputs and submit button.",
        demoSlug: "field-demo-form",
      },
      {
        title: "Input types",
        description: "Various HTML input types.",
        demoSlug: "field-demo-input-types",
      },
      {
        title: "Checkbox fields",
        description: "Field layout with checkbox inputs.",
        demoSlug: "field-demo-checkbox-fields",
      },
      {
        title: "Horizontal fields",
        description: "Multiple horizontal field layouts.",
        demoSlug: "field-demo-horizontal-fields",
      },
      {
        title: "Input fields",
        description: "Field layout with various input types.",
        demoSlug: "field-demo-input-fields",
      },
      {
        title: "Native select fields",
        description: "Field layout with native select inputs.",
        demoSlug: "field-demo-native-select-fields",
      },
      {
        title: "OTP input fields",
        description: "Field layout with OTP input.",
        demoSlug: "field-demo-otp-input-fields",
      },
      {
        title: "Radio fields",
        description: "Field layout with radio group inputs.",
        demoSlug: "field-demo-radio-fields",
      },
      {
        title: "Select fields",
        description: "Field layout with select inputs.",
        demoSlug: "field-demo-select-fields",
      },
      {
        title: "Slider fields",
        description: "Field layout with slider inputs.",
        demoSlug: "field-demo-slider-fields",
      },
      {
        title: "Switch fields",
        description: "Field layout with switch inputs.",
        demoSlug: "field-demo-switch-fields",
      },
      {
        title: "Textarea fields",
        description: "Field layout with textarea inputs.",
        demoSlug: "field-demo-textarea-fields",
      },
    ],
  };
