import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function JiraListHierarchyButton({ expanded, label, onClick, disabled }: Readonly<{
	disabled?: boolean;
	expanded: boolean;
	label: string;
	onClick: () => void;
}>) {
	return (
		<Button
			aria-expanded={expanded}
			aria-label={label}
			className="ms-2 size-5 shrink-0 rounded-sm px-0 hover:bg-transparent focus-visible:bg-bg-neutral-subtle-hovered"
			disabled={disabled}
			onClick={onClick}
			selectedAppearance="icon-only"
			size="icon-compact"
			variant="ghost"
		>
			<Icon className="text-icon-subtle" render={expanded ? <ChevronDownIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />} />
		</Button>
	);
}
