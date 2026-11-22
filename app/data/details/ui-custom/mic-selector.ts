import type { ComponentDetail } from "@/app/data/component-detail-types";

export const MIC_SELECTOR_DETAIL: ComponentDetail = {
	description:
		"A composable microphone selector dropdown built on Dropdown Menu and Command primitives. Provides permission-aware device enumeration, real-time device detection, searchable device list, and intelligent hardware ID label parsing.",
	usage: `import {
  MicSelector,
  MicSelectorTrigger,
  MicSelectorValue,
  MicSelectorContent,
  MicSelectorInput,
  MicSelectorList,
  MicSelectorEmpty,
  MicSelectorItem,
  MicSelectorLabel,
  useAudioDevices,
} from "@/components/ui-custom/mic-selector";

<MicSelector>
  <MicSelectorTrigger className="w-[280px]">
    <MicSelectorValue />
  </MicSelectorTrigger>
  <MicSelectorContent>
    <MicSelectorInput />
    <MicSelectorList>
      {(devices) =>
        devices.length > 0 ? (
          devices.map((device) => (
            <MicSelectorItem key={device.deviceId} value={device.deviceId}>
              <MicSelectorLabel device={device} />
            </MicSelectorItem>
          ))
        ) : (
          <MicSelectorEmpty />
        )
      }
    </MicSelectorList>
  </MicSelectorContent>
</MicSelector>`,
	props: [
		{
			name: "value",
			type: "string",
			description: "Controlled selected device ID.",
		},
		{
			name: "defaultValue",
			type: "string",
			description: "Default selected device ID for uncontrolled usage.",
		},
		{
			name: "onValueChange",
			type: "(value: string | undefined) => void",
			description: "Callback fired when the selected device changes.",
		},
		{
			name: "open",
			type: "boolean",
			description: "Controlled open state of the popover.",
		},
		{
			name: "onOpenChange",
			type: "(open: boolean) => void",
			description: "Callback fired when the popover open state changes.",
		},
	],
	subComponents: [
		{ name: "MicSelector", description: "Root provider wrapping a Dropdown Menu. Manages device enumeration, permission requests, and selection state." },
		{ name: "MicSelectorTrigger", description: "Outline button trigger with the dropdown menu's chevron down." },
		{ name: "MicSelectorValue", description: "Displays the selected device label or a placeholder." },
		{ name: "MicSelectorContent", description: "Dropdown menu content, as wide as the trigger, wrapping a Command for searchable selection." },
		{ name: "MicSelectorInput", description: "The shared menu search field, flush with the menu's top edge; filters by device label." },
		{ name: "MicSelectorList", description: "Scrollable device list with render-prop children receiving MediaDeviceInfo[]; fades its top edge once it scrolls." },
		{ name: "MicSelectorEmpty", description: "Empty state shown when no devices match the search." },
		{ name: "MicSelectorItem", description: "Selectable device row; marks the selected device with aria-checked and closes the menu on select." },
		{ name: "MicSelectorLabel", description: "Device label with intelligent hardware ID parsing (extracts XXXX:XXXX format)." },
	],
	examples: [
		{ title: "Controlled", description: "Controlled selector showing the selected device ID below.", demoSlug: "mic-selector-demo-controlled" },
		{ title: "With checkmark", description: "Selector with a check icon next to the active device.", demoSlug: "mic-selector-demo-with-checkmark" },
		{ title: "Compact", description: "Small-sized trigger without search input.", demoSlug: "mic-selector-demo-compact" },
	],
};
