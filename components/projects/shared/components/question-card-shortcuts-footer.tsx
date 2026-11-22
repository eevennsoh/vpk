"use client";

import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import DataNumberIcon from "@atlaskit/icon/core/data-number";
import ReturnIcon from "@atlaskit/icon-lab/core/return";
import { token } from "@/lib/tokens";
import { Footer } from "@/components/ui-custom/footer";

const iconColor = token("color.icon.subtlest");

interface QuestionCardShortcutsFooterProps {
	escLabel?: string;
	showEscape?: boolean;
}

export function QuestionCardShortcutsFooter({ escLabel = "skip", showEscape = true }: Readonly<QuestionCardShortcutsFooterProps>): React.ReactElement {
	return (
		<Footer hideIcon>
			<span className="inline-flex items-center gap-1">
				<ArrowUpIcon label="" color={iconColor} size="small" />
				<ArrowDownIcon label="" color={iconColor} size="small" />
				to navigate
			</span>
			<span aria-hidden>•</span>
			<span className="inline-flex items-center gap-1">
				<DataNumberIcon label="" color={iconColor} size="small" />
				<span>/</span>
				<ReturnIcon label="" color={iconColor} size="small" />
				Enter to select
			</span>
			{showEscape ? <><span aria-hidden>•</span><span>Esc to {escLabel}</span></> : null}
		</Footer>
	);
}
