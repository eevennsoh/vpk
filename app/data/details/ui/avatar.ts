import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AVATAR_DETAIL: ComponentDetail = {
    description:
      "An avatar component built on Base UI with image, fallback, unassigned person and agent states, badge, presence, and status indicators in 6 sizes (xs through 2xl) and 3 shapes (circle, square, hexagon).",
    adsUrl: "https://atlassian.design/components/avatar",
    adsLinks: [
      {
        label: "@atlaskit/avatar",
        url: "https://atlassian.design/components/avatar",
      },
      {
        label: "@atlaskit/avatar-group",
        url: "https://atlassian.design/components/avatar-group",
      },
    ],
    usage: `import { Avatar, AvatarImage, AvatarFallback, AvatarUnassigned } from "@/components/ui/avatar";

<Avatar>
  <AvatarImage src="/avatar-user/nova/color/asow-service-yellow.png" alt="User" />
  <AvatarFallback>CN</AvatarFallback>
</Avatar>

<AvatarUnassigned kind="agent" />`,
    props: [
      {
        name: "size",
        type: '"xs" | "sm" | "default" | "lg" | "xl" | "2xl"',
        default: '"default"',
        description: "Size of the avatar.",
      },
      {
        name: "shape",
        type: '"circle" | "square" | "hexagon"',
        default: '"circle"',
        description:
          "Shape of the avatar. Use circle for users, square for teams/projects, hexagon for agents.",
      },
      {
        name: "disabled",
        type: "boolean",
        default: "false",
        description:
          "Applies disabled styling (reduced opacity and grayscale).",
      },
		{
			name: "outline",
			type: "{ scale: number | readonly number[]; transition?: Pick<AnimationOptions, 'duration' | 'ease' | 'times' | 'repeat' | 'delay'>; ring?: boolean }",
			description: "For circular avatars, supply an ancestor's scale and transition to keep the border at 1px and the optional separation ring at 2px during motion.",
		},
    ],
    subComponents: [
      { name: "AvatarImage", description: "Profile image element." },
      {
        name: "AvatarFallback",
        description: "Fallback content when image fails.",
      },
      {
        name: "AvatarUnassigned",
        description: "Grey unassigned avatar state for people and agents.",
        props: [
          {
            name: "kind",
            type: '"person" | "agent"',
            default: '"person"',
            description:
              "Unassigned avatar kind. Person renders a circle with a person icon; agent renders a hexagon with an agent icon.",
          },
        ],
      },
      { name: "AvatarBadge", description: "Status badge overlay." },
      {
        name: "AvatarPresenceIndicator",
        description: "Presence indicator (online, busy, focus, offline).",
      },
      {
        name: "AvatarStatusIndicator",
        description: "Status indicator (approved, declined, locked, warning, needs-input, finished).",
      },
      { name: "AvatarGroup", description: "Overlapping group of avatars." },
      {
        name: "AvatarGroupCount",
        description: "Count indicator for remaining avatars.",
      },
    ],
    examples: [
      {
        title: "Default",
        description: "Avatar with image and fallback.",
        demoSlug: "avatar-demo-default",
      },
      {
        title: "Shapes",
        description: "Circle, square, and hexagon shapes.",
        demoSlug: "avatar-demo-shapes",
      },
      {
        title: "Agent tiers",
        description: "Hexagon avatars for 1P Atlassian art, 2P partner marks, and 3P borderless glyphs.",
        demoSlug: "avatar-demo-agent-tiers",
      },
      {
        title: "Agent group",
        description: "Overlapping 16, 24, 32, and 40px hexagon avatars with shape-aware separators.",
        demoSlug: "avatar-demo-agent-group",
      },
      {
        title: "Unassigned",
        description: "Grey person and agent placeholder states.",
        demoSlug: "avatar-demo-unassigned",
      },
      {
        title: "All sizes",
        description: "All 6 sizes from xs to 2xl.",
        demoSlug: "avatar-demo-all-sizes",
      },
      {
        title: "Sizes",
        description: "Small, default, and large avatars.",
        demoSlug: "avatar-demo-sizes",
      },
      {
        title: "Presence",
        description: "Online, busy, focus, and offline presence indicators.",
        demoSlug: "avatar-demo-presence",
      },
      {
        title: "Status",
        description: "Circle statuses plus agent-shaped avatars with Needs input and Finished overlays.",
        demoSlug: "avatar-demo-status",
      },
      {
        title: "Company badge",
        description: "Agent created by a company — hexagon avatar with a company logo dot.",
        demoSlug: "avatar-demo-company",
      },
      {
        title: "Project badge",
        description: "Agent created by a team — hexagon avatar with a project square.",
        demoSlug: "avatar-demo-project",
      },
      {
        title: "Disabled",
        description: "Disabled state across all shapes.",
        demoSlug: "avatar-demo-disabled",
      },
      {
        title: "Group",
        description: "Overlapping 16, 24, 32, and 40px human avatar groups.",
        demoSlug: "avatar-demo-group",
      },
      {
        title: "Badge with icon",
        description: "Avatar with icon-based status badge.",
        demoSlug: "avatar-demo-badge-with-icon",
      },
      {
        title: "Badge",
        description: "Avatar with status badge overlay.",
        demoSlug: "avatar-demo-badge",
      },
      {
        title: "Group with count",
        description: "Avatar group with numeric count indicator.",
        demoSlug: "avatar-demo-group-with-count",
      },
      {
        title: "Group with icon count",
        description: "Human and agent avatar groups with icon-based count indicators.",
        demoSlug: "avatar-demo-group-with-icon-count",
      },
      {
        title: "In empty",
        description: "Avatar inside an empty state component.",
        demoSlug: "avatar-demo-in-empty",
      },
    ],
  };
