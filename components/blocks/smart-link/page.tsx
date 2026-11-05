"use client";

import { SmartLink } from "@/components/blocks/smart-link/components/smart-link";
import { SMART_LINK_DEMO_ITEMS } from "@/components/blocks/smart-link/data/demo-smart-links";

export interface SmartLinkPageProps {
	items?: typeof SMART_LINK_DEMO_ITEMS;
}

function toTitleCase(value: string): string {
	return value.replace(/\b\w/gu, (character) => character.toUpperCase());
}

export default function SmartLinkPage({
	items = SMART_LINK_DEMO_ITEMS,
}: Readonly<SmartLinkPageProps>): React.ReactElement {
	return (
		<div className="min-h-[560px] w-full bg-surface px-8 py-16 text-text">
			<div className="mx-auto max-w-5xl space-y-12">
				<div className="space-y-4 text-sm leading-6">
					<p className="max-w-sm">
						<SmartLink item={{ ...items[0], title: "Cards have inertia when dragging them around in Bento · Design Spells" }} size="large" wrap />
					</p>
					<p>
						<SmartLink item={items[0]} /> keeps planning work connected to source context while updates flow through related references.
					</p>
					<p>
						Research references include <SmartLink item={items[1]} /> and internal notes such as <SmartLink item={items[2]} />.
					</p>
					<p>
						Review with <SmartLink item={items[3]} /> before sharing the motion goal: <SmartLink item={items[4]} />.
					</p>
					<p>
						Watch <SmartLink item={items[5]} /> and compare it with supporting files like <SmartLink item={items[6]} /> or <SmartLink item={items[7]} />.
					</p>
				</div>
				<div className="space-y-3">
					<h2 className="text-xs font-medium leading-4 text-text-subtlest">Card appearance</h2>
					<div className="max-h-[640px] overflow-y-auto rounded-lg border border-border p-4">
						<div className="flex flex-wrap items-start gap-6">
							{items.map((item) => (
								<div className="flex w-full max-w-[32rem] flex-col gap-2" key={item.id}>
									<span className="text-xs font-medium leading-4 text-text-subtlest">
										{toTitleCase(item.provider.name)}
									</span>
									<SmartLink appearance="card" item={item} />
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export { SmartLink, SmartLinkCard } from "@/components/blocks/smart-link/components/smart-link";
export type {
	SmartLinkAction,
	SmartLinkAppearance,
	SmartLinkAvatar,
	SmartLinkItem,
	SmartLinkMetadata,
	SmartLinkPreviewImage,
	SmartLinkProps,
	SmartLinkProvider,
	SmartLinkSize,
	SmartLinkVariant,
	SmartLinkVisual,
} from "@/components/blocks/smart-link/components/smart-link";
