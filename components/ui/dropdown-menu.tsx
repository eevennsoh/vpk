"use client";

import * as React from "react";
import type {
  ComponentProps,
  ComponentType,
  ReactElement,
  ReactNode,
} from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { Icon } from "@/components/ui/icon";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * Shared visual style tokens used by both DropdownMenu and Select components.
 * Select imports these directly so popup, item, group, label, and separator
 * styling stays in sync without duplication.
 */
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const dropdownStyles = {
  popup:
    "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=bottom]:slide-out-to-top-2 data-[side=left]:slide-out-to-right-2 data-[side=right]:slide-out-to-left-2 data-[side=top]:slide-out-to-bottom-2 data-[side=inline-start]:slide-out-to-right-2 data-[side=inline-end]:slide-out-to-left-2 motion-reduce:animate-none bg-popover text-popover-foreground max-h-[min(328px,var(--available-height,328px))] min-w-56 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl p-1 shadow-xl outline-none data-open:duration-normal data-open:ease-out-practical data-closed:duration-fast data-closed:ease-in data-closed:overflow-hidden",
  group: "",
  selectableItem:
    "data-[highlighted]:bg-bg-neutral-subtle-hovered data-[highlighted]:text-text data-disabled:pointer-events-none data-disabled:text-text-disabled relative flex min-h-8 w-full cursor-pointer items-center rounded-lg py-1.5 pr-2 pl-8 text-sm leading-5 outline-none select-none active:bg-bg-neutral-subtle-pressed [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  label: "text-text-subtlest px-2 pt-3 pb-1 text-xs leading-4 font-semibold",
  separator: "bg-border mx-1 my-1 h-px",
  // Deliberately empty. A checked row is styled exactly like an unchecked one —
  // no filled surface, no recoloured label, same hover and pressed treatment —
  // because the check glyph alone is the selected affordance, and it sits on
  // the subtle icon token. Kept as a named slot so every selectable-item
  // callsite still has one obvious place to hang checked-state styling if that
  // decision is ever revisited.
  checkedState: "",
  indicator:
    "pointer-events-none absolute left-2 inline-flex size-6 items-center justify-center text-icon-subtle [&_[data-slot=icon]]:text-icon-subtle [&_svg]:text-icon-subtle!",
  // Trailing variant. `selectableItem` reserves the indicator gutter on the
  // leading edge (`pl-8`); this pair drops that gutter so labels start flush.
  // The tick is in-flow `ml-auto` at the same 12px / 8px inset as
  // `DropdownMenuSubTrigger`'s chevron, so Select and DropdownMenu share one
  // trailing column. Both classes must be applied together.
  selectableItemIndicatorEnd: "pl-2",
  indicatorEnd:
    "pointer-events-none ml-auto inline-flex shrink-0 items-center justify-center text-icon-subtle [&_[data-slot=icon]]:text-icon-subtle [&_svg]:text-icon-subtle!",
} as const;

/**
 * Which edge the checked affordance sits on. `"start"` (default) keeps the
 * historical leading check with its indented labels; `"end"` left-aligns the
 * labels and puts the tick in the same in-flow trailing slot as a submenu
 * chevron so a mixed list lines up.
 */
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export type DropdownMenuIndicatorPlacement = "start" | "end";

const dropdownMenuOverlayShadow = "shadow-2xl";
// The leading-icon slot defaults to the subtle icon token, but the @atlaskit
// icon glyph paints its SVG from `currentColor`, so this wrapper's `color` wins
// over the item's variant rules unless we yield on the destructive state. Scope
// the subtle default to non-destructive items so the item-level
// `[&_svg]:text-icon-danger` rule takes effect. (Using group-data so the slot
// reads the owning item's variant.) Selected items need no exception: their
// leading icon stays subtle like every other row's.
const dropdownMenuFrontSlotClassName =
  "inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle group-data-[variant=destructive]/dropdown-menu-item:text-icon-danger [&_[data-slot=icon]]:text-icon-subtle group-data-[variant=destructive]/dropdown-menu-item:[&_[data-slot=icon]]:text-icon-danger [&_svg]:text-icon-subtle group-data-[variant=destructive]/dropdown-menu-item:[&_svg]:text-icon-danger";

// Single-row items lock to a fixed 32px height (no vertical padding), matching
// the Menubar standard; rows only gain `min-h-8` + `py-1.5` growth when their
// text is allowed to wrap (explicit `allowTextWrap` or a `description`).
const dropdownMenuRowHeightClassName = "h-8 py-0";
const dropdownMenuWrappingRowClassName = "min-h-8 py-1.5";
// Base UI's indicator wrapper otherwise inherits the row's 20px line box,
// which baseline-aligns the 12px glyph one pixel high. Make the wrapper its
// own centered flex box so every checkbox/radio indicator is optically centered.
const dropdownMenuSelectionIndicatorClassName =
  "flex items-center justify-center leading-none";

type DropdownMenuProps = MenuPrimitive.Root.Props;

function DropdownMenu(props: Readonly<DropdownMenuProps>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

type DropdownMenuPortalProps = MenuPrimitive.Portal.Props;

function DropdownMenuPortal(props: Readonly<DropdownMenuPortalProps>) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

interface DropdownMenuTriggerProps extends Omit<
  MenuPrimitive.Trigger.Props,
  "render"
> {
  render?: ReactElement;
}

function DropdownMenuTrigger({
  render,
  ...props
}: Readonly<DropdownMenuTriggerProps>) {
  const Trigger =
    MenuPrimitive.Trigger as ComponentType<DropdownMenuTriggerProps>;
  return (
    <Trigger data-slot="dropdown-menu-trigger" render={render} {...props} />
  );
}

interface DropdownMenuContentProps
  extends
    MenuPrimitive.Popup.Props,
    Pick<
      MenuPrimitive.Positioner.Props,
			"align" | "alignOffset" | "anchor" | "collisionAvoidance" | "side" | "sideOffset"
    > {
  portalled?: boolean;
  portalContainer?: MenuPrimitive.Portal.Props["container"];
  /**
   * Class merged onto the Positioner. Use to override the default `z-[200]`
   * (the shared overlay tier, which sits above persistent chrome like the
   * top nav, product sidebar, and sidebar chat panel) when the trigger lives
   * inside an overlay with an even higher stacking z-index (e.g. floating
   * chat at z-[510]).
   */
  positionerClassName?: string;
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
	anchor,
	collisionAvoidance,
  side = "bottom",
  sideOffset = 4,
  portalled = true,
  portalContainer,
  className,
  positionerClassName,
  ...props
}: Readonly<DropdownMenuContentProps>) {
  const inlinePortalContainerRef = React.useRef<HTMLSpanElement | null>(null);
  const content = (
    <MenuPrimitive.Positioner
      className={cn("z-[200] outline-none", positionerClassName)}
      align={align}
      alignOffset={alignOffset}
			anchor={anchor}
			collisionAvoidance={collisionAvoidance}
      side={side}
      sideOffset={sideOffset}
		>
			<MenuPrimitive.Popup
				data-slot="dropdown-menu-content"
				className={cn(
					dropdownStyles.popup,
					dropdownMenuOverlayShadow,
					className,
				)}
				{...props}
			/>
		</MenuPrimitive.Positioner>
	);

  const resolvedPortalContainer = portalled
    ? portalContainer
    : (portalContainer ?? inlinePortalContainerRef);

  return (
    <>
      {!portalled ? (
        <span
          aria-hidden
          data-slot="dropdown-menu-inline-portal-container"
          className="contents"
          ref={inlinePortalContainerRef}
        />
      ) : null}
      <MenuPrimitive.Portal container={resolvedPortalContainer}>
        {content}
      </MenuPrimitive.Portal>
    </>
  );
}

type DropdownMenuGroupProps = MenuPrimitive.Group.Props;

function DropdownMenuGroup({
  className,
  ...props
}: Readonly<DropdownMenuGroupProps>) {
  return (
    <MenuPrimitive.Group
      data-slot="dropdown-menu-group"
      className={cn(dropdownStyles.group, className)}
      {...props}
    />
  );
}

interface DropdownMenuLabelProps extends MenuPrimitive.GroupLabel.Props {
  inset?: boolean;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Readonly<DropdownMenuLabelProps>) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(dropdownStyles.label, "data-inset:pl-8", className)}
      {...props}
    />
  );
}

type DropdownMenuItemClickHandler = NonNullable<MenuPrimitive.Item.Props["onClick"]>;

interface DropdownMenuItemProps extends Omit<MenuPrimitive.Item.Props, "onSelect"> {
  inset?: boolean;
  variant?: "default" | "destructive";
  /**
   * Allows the label/description to wrap onto multiple lines, growing the row
   * past its fixed 32px single-row height. Implied whenever a `description` is
   * provided; defaults to a single truncated line otherwise.
   */
  allowTextWrap?: boolean;
  /**
   * Marks the item as the active choice in a single-select menu. Shows a
   * trailing check mark unless the caller supplies their own `elemAfter`, and
   * exposes `data-selected` for consumers that need to target the row. The row
   * is otherwise styled identically to an unselected one — the check glyph is
   * the whole affordance.
   */
  selected?: boolean;
  elemBefore?: ReactNode;
  elemAfter?: ReactNode;
  description?: string;
  onSelect?: DropdownMenuItemClickHandler;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  selected = false,
  allowTextWrap = false,
  elemBefore,
  elemAfter,
  description,
  children,
  onClick,
  onSelect,
  ...props
}: Readonly<DropdownMenuItemProps>) {
  const handleClick: DropdownMenuItemClickHandler = (event) => {
    onClick?.(event);

    if (event.baseUIHandlerPrevented) {
      return;
    }

    onSelect?.(event);

    if (event.defaultPrevented) {
      event.preventBaseUIHandler();
    }
  };

  // Default the trailing slot to a check mark when selected so every callsite
  // gets a consistent selected affordance without repeating it.
  const resolvedElemAfter =
    elemAfter ?? (selected ? <CheckMarkIcon label="" size="small" /> : undefined);
  // `indicatorEnd` includes `pointer-events-none` for the default tick. Caller
  // `elemAfter` can be a Switch or other control, so it keeps a live slot.
  const isDefaultSelectionGlyph = Boolean(selected) && elemAfter === undefined;
  const isSelected = selected && variant === "default";
  const shouldWrapText = allowTextWrap || Boolean(description);

  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      data-selected={isSelected || undefined}
      className={cn(
        // Single row stays fixed at 32px; growth is opt-in via `shouldWrapText`
        // (an explicit `allowTextWrap` or a `description`), matching Menubar.
        "group/dropdown-menu-item data-[highlighted]:bg-bg-neutral-subtle-hovered data-[highlighted]:text-text data-[variant=destructive]:text-text-danger data-[variant=destructive]:data-[highlighted]:bg-bg-danger-subtler-hovered data-disabled:pointer-events-none data-disabled:text-text-disabled relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-sm leading-5 outline-none select-none active:bg-bg-neutral-subtle-pressed data-[variant=destructive]:active:bg-bg-danger-subtler-pressed data-inset:pl-8 [&_svg]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-icon-subtle data-[variant=destructive]:[&_svg]:text-icon-danger",
        shouldWrapText ? dropdownMenuWrappingRowClassName : dropdownMenuRowHeightClassName,
        // No selected-state styling on purpose. `data-selected` stays on the
        // element as a hook for consumers, but the trailing check mark is the
        // only thing that marks the active row — surface and label match every
        // other row so the list stays quiet.
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {elemBefore ? (
        <span className={dropdownMenuFrontSlotClassName}>
          {elemBefore}
        </span>
      ) : null}
      <span className="min-w-0 flex flex-1 flex-col">
        <span className={cn("min-w-0", shouldWrapText ? "whitespace-normal break-words" : "truncate")}>
          {children}
        </span>
        {description ? (
          <span
            data-slot="dropdown-menu-item-description"
            className="text-text-subtle text-[11px] leading-4"
          >
            {description}
          </span>
        ) : null}
      </span>
      {resolvedElemAfter ? (
        <span
          className={cn(
            isDefaultSelectionGlyph
              ? dropdownStyles.indicatorEnd
              : "ml-auto inline-flex h-5 shrink-0 items-center justify-center [&_svg]:size-3 text-icon-subtle",
            variant === "destructive" ? "text-icon-danger" : null,
          )}
        >
          {resolvedElemAfter}
        </span>
      ) : null}
    </MenuPrimitive.Item>
  );
}

type DropdownMenuSubProps = MenuPrimitive.SubmenuRoot.Props;

function DropdownMenuSub(props: Readonly<DropdownMenuSubProps>) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

interface DropdownMenuSubTriggerProps
  extends MenuPrimitive.SubmenuTrigger.Props {
  inset?: boolean;
  allowTextWrap?: boolean;
  /** Whether to render the shared trailing right chevron. */
  showChevron?: boolean;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  allowTextWrap = false,
  showChevron = true,
  children,
  ...props
}: Readonly<DropdownMenuSubTriggerProps>) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "group/dropdown-menu-item data-[highlighted]:bg-bg-neutral-subtle-hovered data-[highlighted]:text-text data-popup-open:bg-bg-neutral-subtle-hovered data-popup-open:text-text data-disabled:pointer-events-none data-disabled:text-text-disabled flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm leading-5 outline-none select-none active:bg-bg-neutral-subtle-pressed data-inset:pl-8 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        allowTextWrap ? dropdownMenuWrappingRowClassName : dropdownMenuRowHeightClassName,
        className,
      )}
      {...props}
    >
      {children}
      {showChevron ? (
        <Icon
          render={<ChevronRightIcon label="" size="small" />}
          label="Open submenu"
          className="text-icon-subtle ml-auto"
        />
      ) : null}
    </MenuPrimitive.SubmenuTrigger>
  );
}

type DropdownMenuSubContentProps = ComponentProps<typeof DropdownMenuContent>;

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -4,
  side = "right",
  sideOffset = 2,
  className,
  ...props
}: Readonly<DropdownMenuSubContentProps>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn("w-auto min-w-48", className)}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

/** Selected-state tick. Same 12px small glyph as the submenu chevron. */
function DropdownMenuSelectionGlyph() {
  return (
    <Icon
      render={<CheckMarkIcon label="" size="small" />}
      label="Selected"
      className="text-icon-subtle"
    />
  );
}

interface DropdownMenuCheckboxItemProps
  extends MenuPrimitive.CheckboxItem.Props {
  inset?: boolean;
  indicatorPlacement?: DropdownMenuIndicatorPlacement;
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  indicatorPlacement = "start",
  ...props
}: Readonly<DropdownMenuCheckboxItemProps>) {
  const isIndicatorAtEnd = indicatorPlacement === "end";
  // Start stays absolutely positioned in the leading gutter. End is in-flow
  // `ml-auto` so it shares a column with SubTrigger. DOM order still matches
  // visual order so assistive tech reads "Label, Selected".
  const indicator = (
    <span
      className={isIndicatorAtEnd ? dropdownStyles.indicatorEnd : dropdownStyles.indicator}
      data-slot="dropdown-menu-checkbox-item-indicator"
    >
      <MenuPrimitive.CheckboxItemIndicator
        className={dropdownMenuSelectionIndicatorClassName}
      >
        <DropdownMenuSelectionGlyph />
      </MenuPrimitive.CheckboxItemIndicator>
    </span>
  );

  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        dropdownStyles.selectableItem,
        dropdownStyles.checkedState,
        isIndicatorAtEnd ? dropdownStyles.selectableItemIndicatorEnd : null,
        "data-inset:pl-8",
        className,
      )}
      checked={checked}
      {...props}
    >
      {isIndicatorAtEnd ? null : indicator}
      {children}
      {isIndicatorAtEnd ? indicator : null}
    </MenuPrimitive.CheckboxItem>
  );
}

type DropdownMenuRadioGroupProps = MenuPrimitive.RadioGroup.Props;

function DropdownMenuRadioGroup(props: Readonly<DropdownMenuRadioGroupProps>) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

interface DropdownMenuRadioItemProps extends MenuPrimitive.RadioItem.Props {
  inset?: boolean;
  indicatorPlacement?: DropdownMenuIndicatorPlacement;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  indicatorPlacement = "start",
  ...props
}: Readonly<DropdownMenuRadioItemProps>) {
  const isIndicatorAtEnd = indicatorPlacement === "end";
  const indicator = (
    <span
      className={isIndicatorAtEnd ? dropdownStyles.indicatorEnd : dropdownStyles.indicator}
      data-slot="dropdown-menu-radio-item-indicator"
    >
      <MenuPrimitive.RadioItemIndicator
        className={dropdownMenuSelectionIndicatorClassName}
      >
        <DropdownMenuSelectionGlyph />
      </MenuPrimitive.RadioItemIndicator>
    </span>
  );

  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        dropdownStyles.selectableItem,
        dropdownStyles.checkedState,
        isIndicatorAtEnd ? dropdownStyles.selectableItemIndicatorEnd : null,
        "data-inset:pl-8",
        className,
      )}
      {...props}
    >
      {isIndicatorAtEnd ? null : indicator}
      {children}
      {isIndicatorAtEnd ? indicator : null}
    </MenuPrimitive.RadioItem>
  );
}

type DropdownMenuSeparatorProps = MenuPrimitive.Separator.Props;

function DropdownMenuSeparator({
  className,
  ...props
}: Readonly<DropdownMenuSeparatorProps>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(dropdownStyles.separator, className)}
      {...props}
    />
  );
}

type DropdownMenuShortcutProps = ComponentProps<"span">;

function DropdownMenuShortcut({
  className,
  children,
  ...props
}: Readonly<DropdownMenuShortcutProps>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "group-data-[highlighted]/dropdown-menu-item:[&_kbd]:text-text-subtle ml-auto inline-flex shrink-0 items-center justify-end",
        className,
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <DropdownMenuShortcutKeys shortcut={children} />
      ) : (
        children
      )}
    </span>
  );
}

function DropdownMenuShortcutKeys({ shortcut }: Readonly<{ shortcut: string }>) {
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

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  type DropdownMenuProps,
  type DropdownMenuPortalProps,
  type DropdownMenuTriggerProps,
  type DropdownMenuContentProps,
  type DropdownMenuGroupProps,
  type DropdownMenuLabelProps,
  type DropdownMenuItemProps,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuRadioGroupProps,
  type DropdownMenuRadioItemProps,
  type DropdownMenuSeparatorProps,
  type DropdownMenuShortcutProps,
  type DropdownMenuSubProps,
  type DropdownMenuSubTriggerProps,
  type DropdownMenuSubContentProps,
};
