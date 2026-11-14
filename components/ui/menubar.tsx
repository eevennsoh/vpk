"use client";

import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";

import { Icon } from "@/components/ui/icon";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  dropdownStyles,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menubarRowBaseClassName = cn(dropdownStyles.itemBase, "gap-2");
const menubarSingleLineClassName = "whitespace-nowrap";
const menubarRowHorizontalPaddingClassName = "px-2";
const menubarWrappingRowClassName = "whitespace-normal break-words";

function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "bg-background h-8 gap-0.5 rounded-lg border p-[3px] flex items-center",
        className,
      )}
      {...props}
    />
  );
}

function MenubarMenu(props: React.ComponentProps<typeof DropdownMenu>) {
  return <DropdownMenu data-slot="menubar-menu" {...props} />;
}

function MenubarGroup(props: React.ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup data-slot="menubar-group" {...props} />;
}

function MenubarPortal(props: React.ComponentProps<typeof DropdownMenuPortal>) {
  return <DropdownMenuPortal data-slot="menubar-portal" {...props} />;
}

function MenubarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      className={cn(
        "hover:bg-muted aria-expanded:bg-muted rounded-sm px-1.5 py-[2px] text-sm font-medium flex items-center outline-hidden select-none",
        className,
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="menubar-content"
      align={align}
      sideOffset={sideOffset}
      className={className}
      {...props}
    />
  );
}

type MenubarItemClickHandler = NonNullable<MenuPrimitive.Item.Props["onClick"]>;

interface MenubarItemProps extends Omit<MenuPrimitive.Item.Props, "onSelect"> {
  inset?: boolean;
  allowTextWrap?: boolean;
  variant?: "default" | "destructive";
  elemBefore?: React.ReactNode;
  elemAfter?: React.ReactNode;
  description?: string;
  onSelect?: MenubarItemClickHandler;
}

function MenubarItem({
  className,
  inset,
  allowTextWrap = false,
  variant = "default",
  elemBefore,
  elemAfter,
  description,
  children,
  onClick,
  onSelect,
  ...props
}: Readonly<MenubarItemProps>) {
  const handleClick: MenubarItemClickHandler = (event) => {
    onClick?.(event);

    if (event.baseUIHandlerPrevented) {
      return;
    }

    onSelect?.(event);

    if (event.defaultPrevented) {
      event.preventBaseUIHandler();
    }
  };

  const hasStructuredSlots = Boolean(elemBefore || elemAfter || description);
  const shouldWrapText = allowTextWrap || Boolean(description);

  return (
    <MenuPrimitive.Item
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/menubar-item",
        menubarRowBaseClassName,
        shouldWrapText ? menubarWrappingRowClassName : menubarSingleLineClassName,
        menubarRowHorizontalPaddingClassName,
        "data-[variant=destructive]:text-text-danger data-[variant=destructive]:data-[highlighted]:bg-bg-danger-subtler-hovered data-[variant=destructive]:active:bg-bg-danger-subtler-pressed data-inset:pl-8 [&_[data-slot=icon]]:shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 [&_svg]:text-icon-subtle data-disabled:[&_svg]:text-icon-disabled data-[variant=destructive]:[&_svg]:text-icon-danger [&>svg:first-child]:box-content [&>svg:first-child]:size-4 [&>svg:first-child]:p-1 [&>[data-slot=icon]:first-child]:box-content [&>[data-slot=icon]:first-child]:size-4 [&>[data-slot=icon]:first-child]:p-1 [&_[data-slot=icon]]:text-icon-subtle [&>[data-slot=icon]:first-child_svg]:text-icon-subtle data-disabled:[&_[data-slot=icon]]:text-icon-disabled data-disabled:[&>[data-slot=icon]:first-child_svg]:text-icon-disabled data-[variant=destructive]:[&_[data-slot=icon]]:text-icon-danger data-[variant=destructive]:[&>[data-slot=icon]:first-child_svg]:text-icon-danger",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {hasStructuredSlots ? (
        <>
          {elemBefore ? (
            <span className="inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle [&_[data-slot=icon]]:text-icon-subtle [&_svg]:text-icon-subtle">
              {elemBefore}
            </span>
          ) : null}
          <span className="min-w-0 flex flex-1 flex-col">
            <span className={cn("min-w-0", shouldWrapText ? "whitespace-normal break-words" : "truncate")}>
              {children}
            </span>
            {description ? (
              <span className="text-text-subtle text-[11px] leading-4">
                {description}
              </span>
            ) : null}
          </span>
          {elemAfter ? (
            <span className={cn("ml-auto inline-flex h-5 shrink-0 items-center justify-center", variant === "destructive" ? "text-icon-danger" : "text-icon-subtle")}>
              {elemAfter}
            </span>
          ) : null}
        </>
      ) : (
        children
      )}
    </MenuPrimitive.Item>
  );
}

interface MenubarCheckboxItemProps
  extends MenuPrimitive.CheckboxItem.Props {
  inset?: boolean;
  allowTextWrap?: boolean;
}

function MenubarCheckboxItem({
  className,
  children,
  checked,
  inset,
  allowTextWrap = false,
  ...props
}: Readonly<MenubarCheckboxItemProps>) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      data-inset={inset}
      className={cn(
        menubarRowBaseClassName,
        allowTextWrap ? menubarWrappingRowClassName : menubarSingleLineClassName,
        "pr-2 pl-10 data-checked:text-text data-checked:data-[highlighted]:text-text data-inset:pl-10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute left-2 inline-flex size-6 items-center justify-center text-icon-subtle [&_svg]:text-icon-subtle!"
        data-slot="menubar-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <Icon
            render={<CheckMarkIcon label="" size="small" />}
            label="Selected"
            className="text-icon-subtle"
          />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function MenubarRadioGroup(
  props: React.ComponentProps<typeof DropdownMenuRadioGroup>,
) {
  return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...props} />;
}

interface MenubarRadioItemProps extends MenuPrimitive.RadioItem.Props {
  inset?: boolean;
  allowTextWrap?: boolean;
}

function MenubarRadioItem({
  className,
  children,
  inset,
  allowTextWrap = false,
  ...props
}: Readonly<MenubarRadioItemProps>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menubar-radio-item"
      data-inset={inset}
      className={cn(
        menubarRowBaseClassName,
        allowTextWrap ? menubarWrappingRowClassName : menubarSingleLineClassName,
        "pr-2 pl-10 data-checked:text-text data-checked:data-[highlighted]:text-text data-inset:pl-10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute left-2 inline-flex size-6 items-center justify-center text-icon-subtle [&_svg]:text-icon-subtle!"
        data-slot="menubar-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <Icon
            render={<CheckMarkIcon label="" size="small" />}
            label="Selected"
            className="text-icon-subtle"
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuLabel> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuLabel
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "data-inset:pl-8",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      data-slot="menubar-separator"
      className={className}
      {...props}
    />
  );
}

function MenubarShortcut({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "group-data-[highlighted]/menubar-item:[&_kbd]:text-text-subtle ml-auto inline-flex shrink-0 items-center justify-end pl-6",
        className,
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <MenubarShortcutKeys shortcut={children} />
      ) : (
        children
      )}
    </span>
  );
}

function MenubarShortcutKeys({ shortcut }: Readonly<{ shortcut: string }>) {
  const trimmedShortcut = shortcut.trim();

  if (!trimmedShortcut.includes("+") && [...trimmedShortcut].length > 1) {
    return (
      <KbdGroup>
        {[...trimmedShortcut].map((key, index) => (
          <Kbd key={`${key}-${index}`}>{key}</Kbd>
        ))}
      </KbdGroup>
    );
  }

  return <Kbd>{trimmedShortcut}</Kbd>;
}

function MenubarSub(props: React.ComponentProps<typeof DropdownMenuSub>) {
  return <DropdownMenuSub data-slot="menubar-sub" {...props} />;
}

function MenubarSubTrigger({
  className,
  allowTextWrap = false,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger> & {
  inset?: boolean;
  allowTextWrap?: boolean;
}) {
  return (
    <DropdownMenuSubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        allowTextWrap ? menubarWrappingRowClassName : menubarSingleLineClassName,
        menubarRowHorizontalPaddingClassName,
        "rounded-lg focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 [&_svg]:text-icon-subtle data-disabled:[&_svg]:text-icon-disabled [&>svg:first-child]:box-content [&>svg:first-child]:size-4 [&>svg:first-child]:p-1 [&_[data-slot=icon]]:shrink-0 [&_[data-slot=icon]]:text-icon-subtle [&>[data-slot=icon]:first-child]:box-content [&>[data-slot=icon]:first-child]:size-4 [&>[data-slot=icon]:first-child]:p-1 [&>[data-slot=icon]:first-child_svg]:text-icon-subtle data-disabled:[&_[data-slot=icon]]:text-icon-disabled data-disabled:[&>[data-slot=icon]:first-child_svg]:text-icon-disabled",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubContent>) {
	return (
		<DropdownMenuSubContent
			data-slot="menubar-sub-content"
			className={className}
			{...props}
		/>
	);
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
