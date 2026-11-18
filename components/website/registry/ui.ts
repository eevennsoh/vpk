import type { ComponentType } from "react";

import { UI_PRIMARY_DEMOS } from "./ui/primary";
import { UI_ACTION_VARIANT_DEMOS } from "./ui/variants-actions";
import { UI_AI_ELEMENTS_VARIANT_DEMOS } from "./ui/variants-ai-elements";
import { UI_ATLASSIAN_VARIANT_DEMOS } from "./ui/variants-atlassian";
import { UI_CHART_VARIANT_DEMOS } from "./ui/variants-charts";
import { UI_FORM_VARIANT_DEMOS } from "./ui/variants-forms";
import { UI_FOUNDATION_VARIANT_DEMOS } from "./ui/variants-foundation";
import { UI_MENU_VARIANT_DEMOS } from "./ui/variants-menus";
import { UI_NAVIGATION_VARIANT_DEMOS } from "./ui/variants-navigation";
import { UI_OVERLAY_VARIANT_DEMOS } from "./ui/variants-overlays";
import { UI_PROGRESS_VARIANT_DEMOS } from "./ui/variants-progress";

export const UI_DEMO: Record<string, ComponentType> = {
	...UI_PRIMARY_DEMOS,
};

export const UI_VARIANT_DEMOS: Record<string, ComponentType> = {
	...UI_FOUNDATION_VARIANT_DEMOS,
	...UI_OVERLAY_VARIANT_DEMOS,
	...UI_FORM_VARIANT_DEMOS,
	...UI_NAVIGATION_VARIANT_DEMOS,
	...UI_MENU_VARIANT_DEMOS,
	...UI_ACTION_VARIANT_DEMOS,
	...UI_CHART_VARIANT_DEMOS,
	...UI_ATLASSIAN_VARIANT_DEMOS,
	...UI_PROGRESS_VARIANT_DEMOS,
	...UI_AI_ELEMENTS_VARIANT_DEMOS,
};
