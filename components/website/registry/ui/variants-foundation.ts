import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_FOUNDATION_VARIANT_DEMOS: Record<string, ComponentType> = {
	"heading-demo-scale": dynamic(
		() =>
			import("../../demos/ui/heading-demo").then((mod) => ({
				default: mod.HeadingDemoScale,
			})),
		{ ssr: false },
	),
	"heading-demo-semantics": dynamic(
		() =>
			import("../../demos/ui/heading-demo").then((mod) => ({
				default: mod.HeadingDemoSemantics,
			})),
		{ ssr: false },
	),
	"date-label-demo-default": dynamic(
		() => import("../../demos/ui/date-label-demo").then((mod) => ({ default: mod.DateLabelDemoDefault })),
		{ ssr: false },
	),
	"date-label-demo-appearance": dynamic(
		() => import("../../demos/ui/date-label-demo").then((mod) => ({ default: mod.DateLabelDemoAppearance })),
		{ ssr: false },
	),
	"date-label-demo-icon": dynamic(
		() => import("../../demos/ui/date-label-demo").then((mod) => ({ default: mod.DateLabelDemoIcon })),
		{ ssr: false },
	),
	"date-label-demo-spacious": dynamic(
		() => import("../../demos/ui/date-label-demo").then((mod) => ({ default: mod.DateLabelDemoSpacious })),
		{ ssr: false },
	),
	"date-label-demo-max-width": dynamic(
		() => import("../../demos/ui/date-label-demo").then((mod) => ({ default: mod.DateLabelDemoMaxWidth })),
		{ ssr: false },
	),
	"date-label-demo-date-styles": dynamic(
		() => import("../../demos/ui/date-label-demo").then((mod) => ({ default: mod.DateLabelDemoDateStyles })),
		{ ssr: false },
	),
	"date-label-demo-dropdown-trigger": dynamic(
		() => import("../../demos/ui/date-label-demo").then((mod) => ({ default: mod.DateLabelDemoDropdownTrigger })),
		{ ssr: false },
	),
	// Attachment
	"attachment-demo-default": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoDefault,
			})),
		{ ssr: false },
	),
	"attachment-demo-files": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoFiles,
			})),
		{ ssr: false },
	),
	"attachment-demo-content-only": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoContentOnly,
			})),
		{ ssr: false },
	),
	"attachment-demo-states": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoStates,
			})),
		{ ssr: false },
	),
	"attachment-demo-images": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoImages,
			})),
		{ ssr: false },
	),
	"attachment-demo-image-states": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoImageStates,
			})),
		{ ssr: false },
	),
	"attachment-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoSizes,
			})),
		{ ssr: false },
	),
	"attachment-demo-group": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoGroup,
			})),
		{ ssr: false },
	),
	"attachment-demo-trigger": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoTrigger,
			})),
		{ ssr: false },
	),
	"attachment-demo-orientation": dynamic(
		() =>
			import("../../demos/ui/attachment-demo").then((mod) => ({
				default: mod.AttachmentDemoOrientation,
			})),
		{ ssr: false },
	),
	"bubble-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoSizes,
			})),
		{ ssr: false },
	),
	"bubble-demo-variants": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoVariants,
			})),
		{ ssr: false },
	),
	"bubble-demo-alignment": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoAlignment,
			})),
		{ ssr: false },
	),
	"bubble-demo-grouped": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoGrouped,
			})),
		{ ssr: false },
	),
	"bubble-demo-collapsible": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoCollapsible,
			})),
		{ ssr: false },
	),
	"bubble-demo-button-links": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoButtonLinks,
			})),
		{ ssr: false },
	),
	"bubble-demo-reaction-placement": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoReactionPlacement,
			})),
		{ ssr: false },
	),
	"bubble-demo-reactions-buttons": dynamic(
		() =>
			import("../../demos/ui/bubble-demo").then((mod) => ({
				default: mod.BubbleDemoReactionsButtons,
			})),
		{ ssr: false },
	),
	"marker-demo-markers": dynamic(
		() =>
			import("../../demos/ui/marker-demo").then((mod) => ({
				default: mod.MarkerDemoMarkers,
			})),
		{ ssr: false },
	),
	"marker-demo-border": dynamic(
		() =>
			import("../../demos/ui/marker-demo").then((mod) => ({
				default: mod.MarkerDemoBorder,
			})),
		{ ssr: false },
	),
	"marker-demo-separator": dynamic(
		() =>
			import("../../demos/ui/marker-demo").then((mod) => ({
				default: mod.MarkerDemoSeparator,
			})),
		{ ssr: false },
	),
	"marker-demo-accordion": dynamic(
		() =>
			import("../../demos/ui/marker-demo").then((mod) => ({
				default: mod.MarkerDemoAccordion,
			})),
		{ ssr: false },
	),
	"marker-demo-drawer": dynamic(
		() =>
			import("../../demos/ui/marker-demo").then((mod) => ({
				default: mod.MarkerDemoDrawer,
			})),
		{ ssr: false },
	),
	"message-demo-message": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoMessage,
			})),
		{ ssr: false },
	),
	"message-demo-avatar": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoAvatar,
			})),
		{ ssr: false },
	),
	"message-demo-group": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoGroup,
			})),
		{ ssr: false },
	),
	"message-demo-group-chat": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoGroupChat,
			})),
		{ ssr: false },
	),
	"message-demo-header-and-footer": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoHeaderAndFooter,
			})),
		{ ssr: false },
	),
	"message-demo-actions": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoActions,
			})),
		{ ssr: false },
	),
	"message-demo-attachment": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoAttachment,
			})),
		{ ssr: false },
	),
	"message-demo-attachment-group": dynamic(
		() =>
			import("../../demos/ui/message-demo").then((mod) => ({
				default: mod.MessageDemoAttachmentGroup,
			})),
		{ ssr: false },
	),
	"message-scroller-demo-chat": dynamic(
		() =>
			import("../../demos/ui/message-scroller-demo").then((mod) => ({
				default: mod.MessageScrollerDemoChat,
			})),
		{ ssr: false },
	),
	"questionnaire-demo-default": dynamic(
		() =>
			import("../../demos/ui/questionnaire-demo").then((mod) => ({
				default: mod.QuestionnaireDemoDefault,
			})),
		{ ssr: false },
	),
	"questionnaire-demo-shortcuts": dynamic(
		() =>
			import("../../demos/ui/questionnaire-demo").then((mod) => ({
				default: mod.QuestionnaireDemoShortcuts,
			})),
		{ ssr: false },
	),
	"questionnaire-demo-multiple": dynamic(
		() =>
			import("../../demos/ui/questionnaire-demo").then((mod) => ({
				default: mod.QuestionnaireDemoMultiple,
			})),
		{ ssr: false },
	),

	// Button
	"button-demo-default": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoDefault,
			})),
		{ ssr: false },
	),
	"button-demo-secondary": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoSecondary,
			})),
		{ ssr: false },
	),
	"button-demo-outline": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoOutline,
			})),
		{ ssr: false },
	),
	"button-demo-ghost": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoGhost,
			})),
		{ ssr: false },
	),
	"button-demo-destructive": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoDestructive,
			})),
		{ ssr: false },
	),
	"button-demo-link": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoLink,
			})),
		{ ssr: false },
	),
	"button-demo-variants": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoVariants,
			})),
		{ ssr: false },
	),
	"button-demo-sizes": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoSizes,
			})),
		{ ssr: false },
	),
	"button-demo-with-icon": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoWithIcon,
			})),
		{ ssr: false },
	),
	"button-demo-loading": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoLoading,
			})),
		{ ssr: false },
	),
	"button-demo-disabled": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoDisabled,
			})),
		{ ssr: false },
	),
	"button-demo-full-width": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoFullWidth,
			})),
		{ ssr: false },
	),
	"button-demo-icon-left": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoIconLeft,
			})),
		{ ssr: false },
	),
	"button-demo-icon-only": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoIconOnly,
			})),
		{ ssr: false },
	),
	"button-demo-icon-right": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoIconRight,
			})),
		{ ssr: false },
	),
	"button-demo-invalid-states": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoInvalidStates,
			})),
		{ ssr: false },
	),
	"button-demo-selected": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoSelected,
			})),
		{ ssr: false },
	),
	"button-demo-usage": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoUsage,
			})),
		{ ssr: false },
	),
	"button-demo-variants-and-sizes": dynamic(
		() =>
			import("../../demos/ui/button-demo").then((mod) => ({
				default: mod.ButtonDemoVariantsAndSizes,
			})),
		{ ssr: false },
	),
	// Badge
	"badge-demo-neutral": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoNeutral,
			})),
		{ ssr: false },
	),
	"badge-demo-danger": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoDanger,
			})),
		{ ssr: false },
	),
	"badge-demo-success": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoSuccess,
			})),
		{ ssr: false },
	),
	"badge-demo-warning": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoWarning,
			})),
		{ ssr: false },
	),
	"badge-demo-information": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoInformation,
			})),
		{ ssr: false },
	),
	"badge-demo-inverse": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoInverse,
			})),
		{ ssr: false },
	),
	"badge-demo-information-bold": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoInformationBold,
			})),
		{ ssr: false },
	),
	"badge-demo-success-bold": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoSuccessBold,
			})),
		{ ssr: false },
	),
	"badge-demo-danger-bold": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoDangerBold,
			})),
		{ ssr: false },
	),
	"badge-demo-warning-bold": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoWarningBold,
			})),
		{ ssr: false },
	),
	"badge-demo-discovery-bold": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoDiscoveryBold,
			})),
		{ ssr: false },
	),
	"badge-demo-discovery": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoDiscovery,
			})),
		{ ssr: false },
	),
	"badge-demo-variants": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoVariants,
			})),
		{ ssr: false },
	),
	"badge-demo-with-icon": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoWithIcon,
			})),
		{ ssr: false },
	),
	"badge-demo-max-value": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoMaxValue,
			})),
		{ ssr: false },
	),
	"badge-demo-with-spinner": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoWithSpinner,
			})),
		{ ssr: false },
	),
	"badge-demo-letters-symbols": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoLettersAndSymbols,
			})),
		{ ssr: false },
	),
	"badge-demo-disabled": dynamic(
		() =>
			import("../../demos/ui/badge-demo").then((mod) => ({
				default: mod.BadgeDemoDisabled,
			})),
		{ ssr: false },
	),
};
