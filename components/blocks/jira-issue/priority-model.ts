import PriorityCriticalIcon from "@atlaskit/icon/core/priority-critical";
import PriorityMajorIcon from "@atlaskit/icon/core/priority-major";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import PriorityMinorIcon from "@atlaskit/icon/core/priority-minor";
import PriorityTrivialIcon from "@atlaskit/icon/core/priority-trivial";
import { token } from "@/lib/tokens";

export const PRIORITY_ICONS = {
	critical: PriorityCriticalIcon,
	major: PriorityMajorIcon,
	medium: PriorityMediumIcon,
	minor: PriorityMinorIcon,
	trivial: PriorityTrivialIcon,
};

export const PRIORITY_COLORS = {
	critical: token("color.icon.danger"),
	major: token("color.icon.danger"),
	medium: token("color.icon.information"),
	minor: token("color.icon.success"),
	trivial: token("color.icon.success"),
};
