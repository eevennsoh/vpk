import LayoutOneColumnIcon from "@atlaskit/icon/core/layout-one-column";
import LayoutTwoColumnsIcon from "@atlaskit/icon/core/layout-two-columns";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import type { DiffLayout } from "@/components/blocks/code-review/data/types";

export interface EditorDiffLayoutControlsProps {
	className?: string;
	layout: DiffLayout;
	onLayoutChange: (layout: DiffLayout) => void;
}

export function EditorDiffLayoutControls({
	className,
	layout,
	onLayoutChange,
}: Readonly<EditorDiffLayoutControlsProps>) {
	return (
		<ButtonGroup
			aria-label="Editor diff layout"
			className={cn("my-auto", className)}
			variant="connected"
		>
			<Button
				aria-label="Unified diff layout"
				aria-pressed={layout === "unified"}
				onClick={() => onLayoutChange("unified")}
				size="icon-compact"
				variant="outline"
			>
				<Icon aria-hidden render={<LayoutOneColumnIcon label="" size="small" />} />
			</Button>
			<Button
				aria-label="Split diff layout"
				aria-pressed={layout === "split"}
				onClick={() => onLayoutChange("split")}
				size="icon-compact"
				variant="outline"
			>
				<Icon aria-hidden render={<LayoutTwoColumnsIcon label="" size="small" />} />
			</Button>
		</ButtonGroup>
	);
}
