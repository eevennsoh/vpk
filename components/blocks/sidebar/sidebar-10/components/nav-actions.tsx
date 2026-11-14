"use client"

// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BellIcon,
  ChartLineIcon,
  CopyIcon,
  CornerDownLeftIcon,
  FileTextIcon,
  GalleryVerticalEndIcon as GalleryVerticalEnd,
  LinkIcon,
  MoreHorizontalIcon,
  SettingsIcon,
  StarIcon,
  Trash2Icon,
  TrashIcon,
} from "@/components/ui/vpk-icons"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = [
  [
    {
      label: "Customize Page",
      icon: SettingsIcon,
    },
    {
      label: "Turn into wiki",
      icon: FileTextIcon,
    },
  ],
  [
    {
      label: "Copy Link",
      icon: LinkIcon,
    },
    {
      label: "Duplicate",
      icon: CopyIcon,
    },
    {
      label: "Move to",
      icon: ArrowRightIcon,
    },
    {
      label: "Move to Trash",
      icon: Trash2Icon,
    },
  ],
  [
    {
      label: "Undo",
      icon: CornerDownLeftIcon,
    },
    {
      label: "View analytics",
      icon: ChartLineIcon,
    },
    {
      label: "Version History",
      icon: GalleryVerticalEnd,
    },
    {
      label: "Show delete pages",
      icon: TrashIcon,
    },
    {
      label: "Notifications",
      icon: BellIcon,
    },
  ],
  [
    {
      label: "Import",
      icon: ArrowUpIcon,
    },
    {
      label: "Export",
      icon: ArrowDownIcon,
    },
  ],
]

export function NavActions() {
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    setIsOpen(true)
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden font-medium text-muted-foreground md:inline-block">
        Edit Oct 08
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7">
        <StarIcon />
      </Button>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 data-[state=open]:bg-accent"
            />
          }
        >
          <MoreHorizontalIcon />
        </PopoverTrigger>
        <PopoverContent
          className="w-56 overflow-hidden rounded-lg p-0"
          align="end"
        >
          <Sidebar collapsible="none" className="bg-transparent">
            <SidebarContent>
              {data.map((group, index) => (
                <SidebarGroup key={index} className="border-b last:border-none">
                  <SidebarGroupContent className="gap-0">
                    <SidebarMenu>
                      {group.map((item, index) => (
                        <SidebarMenuItem key={index}>
                          <SidebarMenuButton>
                            <item.icon /> <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </Sidebar>
        </PopoverContent>
      </Popover>
    </div>
  )
}
