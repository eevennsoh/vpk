"use client";

import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { ConfluenceIcon } from "@/components/ui/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SourceCard as SourceCardData } from "../data/ai-summary-data";
import PagesIcon from "@atlaskit/icon/core/pages";

interface SourceCardProps {
	source: SourceCardData;
}

export default function SourceCard({ source }: Readonly<SourceCardProps>) {
	return (
		<div
			className="bg-surface p-4"
			style={{
				minWidth: "316px",
				width: "316px",
				flexShrink: 0,
				border: `1px solid ${token("color.border")}`,
				borderRadius: token("radius.xlarge"),
			}}
		>
			<div className="flex flex-col gap-2 grow">
				<div className="flex items-center gap-2">
					<PagesIcon label="Page" color={token("color.icon.information")} />
					<div style={{ color: token("color.link") }}>
						<Heading size="xsmall">{source.title}</Heading>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Avatar size="sm">
						<AvatarImage src={source.authorAvatar} alt={source.author} />
						<AvatarFallback>{source.author?.[0] ?? "U"}</AvatarFallback>
					</Avatar>
					<span className="text-xs text-text-subtle">
						Created by {source.author}
						{source.updatedDate ? ` • ${source.updatedDate}` : null}
					</span>
				</div>

				<div style={{ flexGrow: 1 }}>
					<span className="text-xs">{source.excerpt}</span>
				</div>

				<div style={{ marginTop: token("space.100"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<div className="flex items-center gap-1">
						<ConfluenceIcon size="xsmall" label="Confluence" />
						<span className="text-xs text-text-subtle">{source.type}</span>
					</div>
					<Button size="default" variant="secondary">
						Open preview
					</Button>
				</div>
			</div>
		</div>
	);
}
