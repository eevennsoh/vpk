"use client";

import { type ReactElement, useState } from "react";
import Link from "next/link";
import AddIcon from "@atlaskit/icon/core/add";
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import CopyIcon from "@atlaskit/icon/core/copy";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";
import PersonIcon from "@atlaskit/icon/core/person";
import SearchIcon from "@atlaskit/icon/core/search";
import SettingsIcon from "@atlaskit/icon/core/settings";
import ShareIcon from "@atlaskit/icon/core/share";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  dropdownStyles,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSubheading,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type DemoIconProps = Readonly<{
  render: ReactElement;
  label: string;
  className?: string;
}>;

function DemoIcon({
  render,
  label,
  className,
}: DemoIconProps) {
  return <Icon render={render} label={label} className={className} />;
}

function DemoActionsContent() {
  return (
    <DropdownMenuContent>
      <DropdownMenuGroup>
        <DropdownMenuItem
          elemBefore={
            <DemoIcon
              render={<EditIcon label="" />}
              label="Edit"
            />
          }
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          elemBefore={
            <DemoIcon
              render={<CopyIcon label="" />}
              label="Duplicate"
            />
          }
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          elemBefore={
            <DemoIcon
              render={<ShareIcon label="" />}
              label="Share"
            />
          }
        >
          Share
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem
          variant="destructive"
          elemBefore={
            <DemoIcon
              render={<DeleteIcon label="" />}
              label="Delete"
            />
          }
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

export default function DropdownMenuDemo() {
  return <DropdownMenuDemoItemSizing />;
}

export function DropdownMenuDemoDefault() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Actions
      </DropdownMenuTrigger>
      <DemoActionsContent />
    </DropdownMenu>
  );
}

export function DropdownMenuDemoSubheading() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="default" />}>
        View settings
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuSubheading className="px-2 py-1.5">Layout</DropdownMenuSubheading>
        <DropdownMenuItem>List</DropdownMenuItem>
        <DropdownMenuItem>Board</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSubheading className="px-2 py-1.5">Display</DropdownMenuSubheading>
        <DropdownMenuItem>Show sidebar</DropdownMenuItem>
        <DropdownMenuItem>Show activity</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoAppearance() {
  const longList = Array.from(
    { length: 18 },
    (_, index) => `Item ${index + 1}`,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="default" className="w-fit" />}
        >
          Default appearance
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            {longList.slice(0, 6).map((item) => (
              <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="default" className="w-fit" />}
        >
          Tall appearance
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[70vh]">
          <DropdownMenuGroup>
            {longList.map((item) => (
              <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DropdownMenuDemoItemSizing() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="default" className="w-fit" />}
        >
          Menu items
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>Dashboard</DropdownMenuItem>
            <DropdownMenuItem>Projects</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="default" className="w-fit" />}>
          24px avatars
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {[{ name: "Venn", src: "/avatar-user/venn/venn.png" }, { name: "Olivia", src: "/avatar-user/olivia-yang/color/asow-service-yellow.png" }].map((person) => (
            <DropdownMenuItem key={person.name} elemBefore={<Avatar size="sm"><AvatarImage src={person.src} alt="" /><AvatarFallback>{person.name.slice(0, 1)}</AvatarFallback></Avatar>}>
              {person.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DropdownMenuDemoTall() {
  const items = Array.from(
    { length: 20 },
    (_, index) => `Command ${index + 1}`,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Open tall menu
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[70vh]">
        <DropdownMenuGroup>
          {items.map((item) => (
            <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoCustomTriggers() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" aria-label="More actions" />
          }
        >
          <DemoIcon
            render={<ShowMoreHorizontalIcon label="" />}
            label="More actions"
          />
        </DropdownMenuTrigger>
        <DemoActionsContent />
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed rounded-sm px-2 py-1 text-sm font-medium"
            />
          }
        >
          Custom trigger
        </DropdownMenuTrigger>
        <DemoActionsContent />
      </DropdownMenu>
    </div>
  );
}

export function DropdownMenuDemoUsingTrigger() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Open
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Export</DropdownMenuItem>
          <DropdownMenuItem>Share</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoNestedDropdownMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Project actions
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Open</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Inbox</DropdownMenuItem>
                <DropdownMenuItem>Backlog</DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Team folders</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem>Design</DropdownMenuItem>
                      <DropdownMenuItem>Engineering</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoStates() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Item states
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Default</DropdownMenuItem>
          <DropdownMenuItem className="bg-bg-neutral-subtle-hovered">
            Hovered
          </DropdownMenuItem>
          <DropdownMenuItem className="bg-bg-neutral-subtle-pressed">
            Pressed
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Destructive</DropdownMenuItem>
          <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoLoading() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Loading menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled
            elemBefore={<Spinner size="xs" className="text-text-subtle" />}
          >
            Loading items...
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoOpen() {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="default" className="w-fit" />}
        >
          Controlled menu
        </DropdownMenuTrigger>
        <DemoActionsContent />
      </DropdownMenu>
      <Button
        size="default"
        variant="outline"
        onClick={() => setOpen((previousOpen) => !previousOpen)}
      >
        Toggle
      </Button>
    </div>
  );
}

export function DropdownMenuDemoPositioning() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="default" className="w-fit" />}
        >
          Bottom start
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem>Positioned menu</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="default" className="w-fit" />}
        >
          Top end
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem>Positioned menu</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DropdownMenuDemoDefaultPlacement() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Default placement
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Dashboard</DropdownMenuItem>
          <DropdownMenuItem>Projects</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoPlacement() {
  const placements = [
    {
      side: "top" as const,
      label: "Top",
      icon: <ArrowUpIcon label="" />,
    },
    {
      side: "right" as const,
      label: "Right",
      icon: <ArrowRightIcon label="" />,
    },
    {
      side: "bottom" as const,
      label: "Bottom",
      icon: <ArrowDownIcon label="" />,
    },
    {
      side: "left" as const,
      label: "Left",
      icon: <ArrowLeftIcon label="" />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {placements.map((placement) => (
        <DropdownMenu key={placement.side}>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="default" className="w-fit" />}
          >
            {placement.label}
          </DropdownMenuTrigger>
          <DropdownMenuContent side={placement.side}>
            <DropdownMenuGroup>
              <DropdownMenuItem
                elemBefore={
                  <DemoIcon render={placement.icon} label={placement.label} />
                }
              >
                {placement.label} menu
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );
}

export function DropdownMenuDemoShouldFlip() {
  return (
    <div className="w-80 overflow-hidden rounded-lg border p-4">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="default" className="w-fit" />}
          >
            Try flip
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuGroup>
              <DropdownMenuItem>Auto-flips near viewport edge</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function DropdownMenuDemoZIndex() {
  return (
    <div className="relative h-40 w-80 overflow-hidden rounded-lg border bg-bg-neutral-subtle p-4">
      <div className="bg-surface-raised absolute inset-6 rounded-md border p-3 text-sm">
        Background layer
      </div>
      <div className="relative z-10 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="default" className="w-fit" />}
          >
            Menu over layer
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem>High z-index popup</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function DropdownMenuDemoContentWithoutPortal() {
  return (
    <div className="w-80 overflow-hidden rounded-lg border p-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="default" className="w-fit" />}
        >
          Inline content
        </DropdownMenuTrigger>
        <DropdownMenuContent portalled={false}>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              This menu stays in container flow
            </DropdownMenuItem>
            <DropdownMenuItem>Useful for clipped surfaces</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DropdownMenuDemoFullWidthDropdownMenu() {
  return (
    <div className="w-72">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="default"
              className="w-full justify-start"
            />
          }
        >
          Full width trigger
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-(--anchor-width)">
          <DropdownMenuGroup>
            <DropdownMenuItem>Option 1</DropdownMenuItem>
            <DropdownMenuItem>Option 2</DropdownMenuItem>
            <DropdownMenuItem>Option 3</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DropdownMenuDemoAccessibleLabels() {
  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Open settings menu"
            />
          }
        >
          <DemoIcon
            render={<SettingsIcon label="" />}
            label="Settings"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Settings menu</DropdownMenuLabel>
            <DropdownMenuItem>General</DropdownMenuItem>
            <DropdownMenuItem>Notifications</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Open search actions"
            />
          }
        >
          <DemoIcon
            render={<SearchIcon label="" />}
            label="Search"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Search actions</DropdownMenuLabel>
            <DropdownMenuItem>Find in page</DropdownMenuItem>
            <DropdownMenuItem>Recent searches</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DropdownMenuDemoItemDescription() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Item description
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem description="View and update your profile settings">
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem description="Manage your workspace integrations">
            Integrations
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoItemMultiline() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Multiline item
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuItem allowTextWrap>
            This is a long dropdown item label that wraps across multiple lines
            in order to mirror the ADS multiline example.
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoItemStates() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Dropdown item states
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Default</DropdownMenuItem>
          <DropdownMenuItem className="bg-bg-neutral-subtle-hovered">
            Hovered
          </DropdownMenuItem>
          <DropdownMenuItem className="bg-bg-neutral-subtle-pressed">
            Pressed
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoItemDisabled() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Disabled item
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Enabled</DropdownMenuItem>
          <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoItemWithElements() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        With elements
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem
            elemBefore={
              <DemoIcon
                render={<PersonIcon label="" />}
                label="Profile"
              />
            }
            elemAfter={<DropdownMenuShortcut>⌘P</DropdownMenuShortcut>}
          >
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            elemBefore={
              <DemoIcon
                render={<SettingsIcon label="" />}
                label="Settings"
              />
            }
            elemAfter={<DropdownMenuShortcut>⌘,</DropdownMenuShortcut>}
          >
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoItemElemBefore() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Elem before
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem
            elemBefore={
              <DemoIcon
                render={<AddIcon label="" />}
                label="Create"
              />
            }
          >
            Create item
          </DropdownMenuItem>
          <DropdownMenuItem
            elemBefore={
              <DemoIcon
                render={<CopyIcon label="" />}
                label="Duplicate"
              />
            }
          >
            Duplicate item
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoItemElemAfter() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Elem after
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem
            elemAfter={<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>}
          >
            Save
          </DropdownMenuItem>
          <DropdownMenuItem
            elemAfter={<DropdownMenuShortcut>⌘⇧P</DropdownMenuShortcut>}
          >
            Command palette
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoItemCustomComponent() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Custom component
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link href="/components/ui/button" />}
            elemBefore={
              <DemoIcon
                render={<LinkExternalIcon label="" />}
                label="Open docs"
              />
            }
          >
            Open Button docs
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoCheckboxDefaultSelected() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Checkbox default selected
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem defaultChecked>
            Show sidebar
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>
            Show activity panel
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoCheckboxSelected() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [showActivity, setShowActivity] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Checkbox selected
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={showSidebar}
            onCheckedChange={setShowSidebar}
          >
            Show sidebar
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={showActivity}
            onCheckedChange={setShowActivity}
          >
            Show activity panel
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoRadioDefaultSelected() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Radio default selected
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup defaultValue="list">
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="board">Board</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DropdownMenuDemoRadioSelected() {
  const [view, setView] = useState("list");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        Radio selected
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup value={view} onValueChange={setView}>
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="board">Board</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="calendar">
              Calendar
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DemoChoiceRow({ children }: Readonly<{ children: React.ReactNode }>) {
  return <label data-menu-row="" className={cn(dropdownStyles.itemBase, "gap-3 px-2 hover:bg-bg-neutral-subtle-hovered")}>{children}</label>;
}

export function DropdownMenuDemoWithCheckbox() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [showActivity, setShowActivity] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        View options
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-56 gap-0", dropdownStyles.surface, dropdownStyles.padding)}>
        <DropdownMenuSubheading className="px-2 py-1.5">
          Display
        </DropdownMenuSubheading>
        <DemoChoiceRow>
          <span className="inline-flex size-6 shrink-0 items-center justify-center">
            <Checkbox checked={showSidebar} onCheckedChange={setShowSidebar} />
          </span>
          Show sidebar
        </DemoChoiceRow>
        <DemoChoiceRow>
          <span className="inline-flex size-6 shrink-0 items-center justify-center">
            <Checkbox checked={showActivity} onCheckedChange={setShowActivity} />
          </span>
          Show activity panel
        </DemoChoiceRow>
        <DemoChoiceRow>
          <span className="inline-flex size-6 shrink-0 items-center justify-center">
            <Checkbox checked={showPreview} onCheckedChange={setShowPreview} />
          </span>
          Show preview
        </DemoChoiceRow>
      </PopoverContent>
    </Popover>
  );
}

export function DropdownMenuDemoWithRadioGroup() {
  const [view, setView] = useState("list");

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="default" className="w-fit" />}
      >
        View: {view}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-56 gap-0", dropdownStyles.surface, dropdownStyles.padding)}>
        <DropdownMenuSubheading className="px-2 py-1.5">
          Layout
        </DropdownMenuSubheading>
        <RadioGroup value={view} onValueChange={setView} className="gap-0">
          <DemoChoiceRow>
            <span className="inline-flex size-6 shrink-0 items-center justify-center">
              <RadioGroupItem value="list" />
            </span>
            List
          </DemoChoiceRow>
          <DemoChoiceRow>
            <span className="inline-flex size-6 shrink-0 items-center justify-center">
              <RadioGroupItem value="board" />
            </span>
            Board
          </DemoChoiceRow>
          <DemoChoiceRow>
            <span className="inline-flex size-6 shrink-0 items-center justify-center">
              <RadioGroupItem value="calendar" />
            </span>
            Calendar
          </DemoChoiceRow>
        </RadioGroup>
      </PopoverContent>
    </Popover>
  );
}
