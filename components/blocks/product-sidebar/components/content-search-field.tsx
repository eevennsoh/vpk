"use client";

import { token } from "@/lib/tokens";
import { Input } from "@/components/ui/input";
import SearchIcon from "@atlaskit/icon/core/search";

interface ContentSearchFieldProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function ContentSearchField({
	value,
	onChange,
	placeholder = "Search by title",
}: Readonly<ContentSearchFieldProps>) {
	return (
		<div
			style={{
				padding: `${token("space.100")} ${token("space.150")} ${token("space.100")} 0`,
			}}
		>
			<div className="relative">
				<span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-icon">
					<SearchIcon label="" size="small" color={token("color.icon.subtle")} />
				</span>
				<Input
					type="search"
					aria-label={placeholder}
					placeholder={placeholder}
					value={value}
					onChange={(e) => onChange((e.target as HTMLInputElement).value)}
					className="h-8 pl-7 text-sm placeholder:text-sm"
					style={{ font: token("font.body") }}
				/>
			</div>
		</div>
	);
}
