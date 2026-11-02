import PriorityCriticalIcon from "@atlaskit/icon/core/priority-critical";
import PriorityMajorIcon from "@atlaskit/icon/core/priority-major";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import PriorityMinorIcon from "@atlaskit/icon/core/priority-minor";
import { token } from "@/lib/tokens";

export const PRIORITY_ICONS = {
	critical: PriorityCriticalIcon,
	major: PriorityMajorIcon,
	medium: PriorityMediumIcon,
	minor: PriorityMinorIcon,
};

export const PRIORITY_COLORS = {
	critical: token("color.icon.danger"),
	major: token("color.icon.danger"),
	medium: token("color.icon.information"),
	minor: token("color.icon.success"),
};
