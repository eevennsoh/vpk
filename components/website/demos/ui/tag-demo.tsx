"use client";

import { useState } from "react";
import LockIcon from "@atlaskit/icon/core/lock-locked";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import TagIcon from "@atlaskit/icon/core/tag";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { RovoColorIcon } from "@/components/ui/logo";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import { Tag, TagGroup } from "@/components/ui/tag";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";

export default function TagDemo() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag>Default</Tag>
			<Tag color="blue">Blue</Tag>
			<Tag variant="rounded" color="discovery">
				Rounded
			</Tag>
			<Tag
				elemBefore={
					<IconTile
						aria-hidden
						icon={<Icon render={<TagIcon label="" size="small" />} aria-hidden />}
						label=""
						size="xxsmall"
						variant="transparent"
					/>
				}
			>
				Label
			</Tag>
			<Tag
				type="user"
				elemBefore={
					<Avatar size="xs">
						<AvatarImage src="/avatar-user/ali/color/asow-teamwork-blue.png" alt="Alex" />
						<AvatarFallback>AL</AvatarFallback>
					</Avatar>
				}
			>
				Alex
			</Tag>
		</div>
	);
}

export function TagDemoDefault() {
	return <Tag>Default tag</Tag>;
}

export function TagDemoRemovable() {
	const [visible, setVisible] = useState(true);
	return (
		<div className="flex min-h-[352px] w-full items-center justify-center">
			{visible ? (
				<Tag className="self-center" onRemove={() => setVisible(false)}>Removable</Tag>
			) : (
				<p className="text-sm text-text-subtle">Tag removed</p>
			)}
		</div>
	);
}

export function TagDemoFrontSlot() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag
				color="blue"
				elemBefore={
					<AtlassianLogoMark frame="chip" name="jira" label="Jira" />
				}
			>
				Jira
			</Tag>
			<Tag
				color="purple"
				elemBefore={
					<AtlassianLogoMark frame="chip" name="atlassian" label="Atlassian" />
				}
			>
				Atlassian
			</Tag>
			<Tag
				color="green"
				elemBefore={
					<IconTile
						aria-hidden
						icon={<RovoColorIcon aria-hidden />}
						label="Rovo"
						size="xxsmall"
						variant="transparent"
					/>
				}
			>
				Rovo
			</Tag>
			<Tag color="orange" elemBefore={<BrandLogoMark frame="chip" src="/2p/appfire.png" label="Appfire" />}>
				Appfire
			</Tag>
			<Tag color="teal" elemBefore={<BrandLogoMark frame="chip" src="/2p/adaptavist.png" label="Adaptavist" />}>
				Adaptavist
			</Tag>
			<Tag color="purple" elemBefore={<BrandLogoMark frame="chip" name="figma" label="Figma" />}>
				Figma
			</Tag>
			<Tag color="green" elemBefore={<BrandLogoMark frame="chip" name="google-drive" label="Google Drive" />}>
				Drive
			</Tag>
			<Tag
				color="red"
				elemBefore={
					<IconTile
						aria-hidden
						icon={<Icon aria-hidden render={<LockIcon label="" size="small" />} />}
						label=""
						size="xxsmall"
						variant="transparent"
					/>
				}
			>
				Restricted
			</Tag>
		</div>
	);
}

export function TagDemoEditorTag() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag
				variant="editor"
				color="blue"
				elemBefore={
					<AtlassianLogoMark frame="chip" name="jira" label="Jira" />
				}
			>
				Jira
			</Tag>
			<Tag
				variant="editor"
				color="purple"
				elemBefore={
					<AtlassianLogoMark frame="chip" name="atlassian" label="Atlassian" />
				}
			>
				Atlassian
			</Tag>
			<Tag
				variant="editor"
				color="green"
				elemBefore={
					<IconTile
						aria-hidden
						icon={<RovoColorIcon aria-hidden />}
						label="Rovo"
						size="xxsmall"
						variant="transparent"
					/>
				}
			>
				Rovo
			</Tag>
			<Tag variant="editor" color="orange" elemBefore={<BrandLogoMark frame="chip" src="/2p/appfire.png" label="Appfire" />}>
				Appfire
			</Tag>
			<Tag variant="editor" color="teal" elemBefore={<BrandLogoMark frame="chip" src="/2p/adaptavist.png" label="Adaptavist" />}>
				Adaptavist
			</Tag>
			<Tag variant="editor" color="purple" elemBefore={<BrandLogoMark frame="chip" name="figma" label="Figma" />}>
				Figma
			</Tag>
			<Tag variant="editor" color="green" elemBefore={<BrandLogoMark frame="chip" name="google-drive" label="Google Drive" />}>
				Drive
			</Tag>
			<Tag
				variant="editor"
				color="red"
				elemBefore={
					<IconTile
						aria-hidden
						icon={<Icon aria-hidden render={<LockIcon label="" size="small" />} />}
						label=""
						size="xxsmall"
						variant="transparent"
					/>
				}
			>
				Restricted
			</Tag>
		</div>
	);
}

export function TagDemoBadge() {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<Tag trailingMetric={8}>Epics</Tag>
				<Tag color="blue" trailingMetric={12}>
					In progress
				</Tag>
				<Tag color="green" trailingMetric={3}>
					Done
				</Tag>
				<Tag
					elemBefore={
						<IconTile
							aria-hidden
							icon={<Icon render={<TagIcon label="" size="small" />} aria-hidden />}
							label=""
							size="xxsmall"
							variant="transparent"
						/>
					}
					trailingMetric={128}
				>
					Backlog
				</Tag>
				<Tag color="red" trailingMetric={5} onRemove={() => {}}>
					Blocked
				</Tag>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Tag
					elemBefore={
						<Icon aria-hidden render={<PullRequestIcon label="" size="small" />} />
					}
					maxWidth="none"
					trailingMetric={[
						{ value: "1 Open", color: "lime" },
						{ value: "1 Needs input", color: "yellow" },
						{ value: "1 Draft", color: "gray" },
						{ value: "1 Merged", color: "purple" },
					]}
				>
					Pull requests
				</Tag>
			</div>
		</div>
	);
}

export function TagDemoRemovableOverlay() {
	const [tags, setTags] = useState(["Design", "Engineering", "Product marketing strategy"]);
	if (tags.length === 0) return <p className="text-sm text-text-subtle">All tags removed</p>;
	return (
		<div className="flex flex-wrap items-center gap-2">
			{tags.map((label) => (
				<Tag key={label} removeVariant="overlay" maxWidth={140} onRemove={() => setTags((prev) => prev.filter((t) => t !== label))}>
					{label}
				</Tag>
			))}
		</div>
	);
}

export function TagDemoVariants() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag color="standard">Standard</Tag>
			<Tag color="blue">Blue</Tag>
			<Tag color="green">Green</Tag>
			<Tag color="red">Red</Tag>
			<Tag color="yellow">Yellow</Tag>
			<Tag color="discovery">Discovery</Tag>
			<Tag color="purple">Purple</Tag>
			<Tag color="teal">Teal</Tag>
			<Tag color="orange">Orange</Tag>
			<Tag color="magenta">Magenta</Tag>
			<Tag color="lime">Lime</Tag>
		</div>
	);
}

export function TagDemoRemovableVariants() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag onRemove={() => {}}>Default</Tag>
			<Tag color="green" onRemove={() => {}}>
				Green
			</Tag>
			<Tag color="red" onRemove={() => {}}>
				Red
			</Tag>
			<Tag color="blue" onRemove={() => {}}>
				Blue
			</Tag>
			<Tag color="discovery" onRemove={() => {}}>
				Discovery
			</Tag>
		</div>
	);
}

export function TagDemoDisabled() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag disabled>Disabled</Tag>
			<Tag disabled color="blue">
				Disabled blue
			</Tag>
			<Tag disabled onRemove={() => {}}>
				Disabled removable
			</Tag>
		</div>
	);
}

export function TagDemoColors() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag color="standard">Standard</Tag>
			<Tag color="gray">Gray</Tag>
			<Tag color="green">Green</Tag>
			<Tag color="lime">Lime</Tag>
			<Tag color="blue">Blue</Tag>
			<Tag color="red">Red</Tag>
			<Tag color="discovery">Discovery</Tag>
			<Tag color="purple">Purple</Tag>
			<Tag color="magenta">Magenta</Tag>
			<Tag color="teal">Teal</Tag>
			<Tag color="orange">Orange</Tag>
			<Tag color="yellow">Yellow</Tag>
		</div>
	);
}

export function TagDemoRounded() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag variant="rounded">Rounded</Tag>
			<Tag variant="rounded" color="green">
				Rounded green
			</Tag>
			<Tag variant="rounded" onRemove={() => {}}>
				Rounded removable
			</Tag>
		</div>
	);
}

export function TagDemoTagGroup() {
	return (
		<TagGroup>
			<Tag>React</Tag>
			<Tag>TypeScript</Tag>
			<Tag>Next.js</Tag>
		</TagGroup>
	);
}

export function TagDemoTagGroupRemovable() {
	return (
		<TagGroup>
			<Tag onRemove={() => {}}>Frontend</Tag>
			<Tag onRemove={() => {}}>Backend</Tag>
			<Tag onRemove={() => {}}>DevOps</Tag>
		</TagGroup>
	);
}

export function TagDemoTagGroupVariants() {
	return (
		<TagGroup>
			<Tag>Default</Tag>
			<Tag variant="success">Success</Tag>
			<Tag variant="removed">Removed</Tag>
			<Tag variant="inprogress">In Progress</Tag>
		</TagGroup>
	);
}

export function TagDemoAvatarTags() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag
				type="user"
				onRemove={() => {}}
				elemBefore={
					<Avatar size="xs">
						<AvatarImage src="/avatar-user/olivia-yang/color/asow-service-yellow.png" alt="Mia Chen" />
						<AvatarFallback>MC</AvatarFallback>
					</Avatar>
				}
			>
				Mia Chen
			</Tag>
			<Tag
				type="other"
				onRemove={() => {}}
				elemBefore={
					<Avatar size="xs" shape="square">
						<AvatarImage src="/avatar-project/group.svg" alt="Atlas team" />
						<AvatarFallback>AT</AvatarFallback>
					</Avatar>
				}
			>
				Atlas team
			</Tag>
			<Tag
				type="agent"
				onRemove={() => {}}
				elemBefore={
					<Avatar size="xs" shape="hexagon">
						<AvatarImage src="/avatar-agent-new/lime/auto-dev.svg" alt="Plan agent" />
						<AvatarFallback>AI</AvatarFallback>
					</Avatar>
				}
			>
				Plan agent
			</Tag>
		</div>
	);
}

export function TagDemoMentionTags() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Tag
				type="user"
				variant="editor"
				elemBefore={
					<Avatar size="xs">
						<AvatarImage src="/avatar-user/venn/venn.png" alt="Ee Venn Soh" />
						<AvatarFallback>EV</AvatarFallback>
					</Avatar>
				}
			>
				Ee Venn Soh
			</Tag>
			<Tag
				type="other"
				variant="editor"
				elemBefore={
					<Avatar size="xs" shape="square">
						<AvatarImage src="/avatar-project/apple.svg" alt="Apple Ecosystem" />
						<AvatarFallback>AE</AvatarFallback>
					</Avatar>
				}
			>
				Apple Ecosystem
			</Tag>
			<Tag
				type="agent"
				variant="editor"
				elemBefore={
					<Avatar size="xs" shape="hexagon">
						<AvatarImage src="/avatar-agent-new/lime/auto-dev.svg" alt="Code Planner" />
						<AvatarFallback>CP</AvatarFallback>
					</Avatar>
				}
			>
				Code Planner
			</Tag>
			<Tag
				type="agent"
				variant="editor"
				elemBefore={
					<span aria-hidden>
						<AgentAvatarVisual
							avatarClassName="after:border-0"
							label="Rovo"
							sizePx={16}
							vpkLogo="rovo"
						/>
					</span>
				}
			>
				Rovo
			</Tag>
			<Tag
				type="agent"
				variant="editor"
				elemBefore={
					<span aria-hidden>
						<AgentAvatarVisual
							avatarClassName="after:border-0"
							brandName="claude"
							fallbackText="Claude"
							label="Claude"
							sizePx={16}
						/>
					</span>
				}
			>
				Claude
			</Tag>
		</div>
	);
}
