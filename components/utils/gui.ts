import {
	GUIColorInput,
	GUIColorList,
	GUIControl,
	GUIImageInput,
	GUIPanel,
	GUIPercentControl,
	GUIRgbaColorInput,
	GUISection,
	GUISegmentedControl,
	GUISelect,
	GUISwatchGroup,
	GUITextInput,
	GUIToggle,
} from "@/components/utils/gui-components";
import { GUIEasing, GUISpring } from "@/components/utils/gui-motion";
import { GUITimeline } from "@/components/utils/gui-timeline";

export {
	type GUITimelineConfig,
	type GUITimelineOptions,
	type GUITimelineProps,
	type GUITimelineValues,
	useGUITimeline,
} from "@/components/utils/gui-timeline";

export {
	type GUIEasingProps,
	type GUIEasingValue,
	type GUISpringProps,
	type GUISpringValue,
} from "@/components/utils/gui-motion";

export {
	type GUIColorInputProps,
	type GUIColorListProps,
	type GUIControlProps,
	type GUIImageInputProps,
	type GUIPanelProps,
	type GUIPercentControlProps,
	type GUIRgbaColorInputProps,
	type GUISectionProps,
	type GUISegmentedControlProps,
	type GUISegmentedOption,
	type GUISelectOption,
	type GUISelectProps,
	type GUISwatchGroupProps,
	type GUISwatchOption,
	type GUITextInputProps,
	type GUIToggleProps,
	useGUIValueKeys,
} from "@/components/utils/gui-components";

export const GUI = {
	ColorInput: GUIColorInput,
	ColorList: GUIColorList,
	Control: GUIControl,
	Easing: GUIEasing,
	ImageInput: GUIImageInput,
	Panel: GUIPanel,
	PercentControl: GUIPercentControl,
	RgbaColorInput: GUIRgbaColorInput,
	Section: GUISection,
	SegmentedControl: GUISegmentedControl,
	Select: GUISelect,
	Spring: GUISpring,
	SwatchGroup: GUISwatchGroup,
	TextInput: GUITextInput,
	Timeline: GUITimeline,
	Toggle: GUIToggle,
} as const;
