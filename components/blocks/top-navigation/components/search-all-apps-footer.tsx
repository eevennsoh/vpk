"use client";

import { token } from "@/lib/tokens";
import SearchIcon from "@atlaskit/icon/core/search";

interface SearchAllAppsFooterProps {
	onClick?: () => void;
}

export default function SearchAllAppsFooter({
	onClick,
}: Readonly<SearchAllAppsFooterProps>) {
	return (
		<div className="mt-2 border-t border-border px-2 py-2">
			<button
				type="button"
				className="flex w-full items-center gap-3 rounded-md border-none bg-transparent px-3 py-2 text-left transition-colors duration-normal ease-out hover:bg-bg-neutral-subtle-hovered"
				onClick={onClick}
			>
				<SearchIcon label="" color={token("color.icon.subtlest")} />
				<div className="flex-1">
					<div className="text-text" style={{ font: token("font.body") }}>
						Search all apps
					</div>
				</div>
			</button>
		</div>
	);
}
