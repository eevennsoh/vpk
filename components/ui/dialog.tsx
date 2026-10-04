"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import StatusErrorIcon from "@atlaskit/icon/core/status-error"
import StatusWarningIcon from "@atlaskit/icon/core/status-warning"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import CrossIcon from "@atlaskit/icon/core/cross"

function Dialog(props: Readonly<DialogPrimitive.Root.Props>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

type DialogTriggerProps = Omit<DialogPrimitive.Trigger.Props, "render"> & {
  render?: React.ReactElement
}

function DialogTrigger({ render, ...props }: Readonly<DialogTriggerProps>) {
  const Trigger = DialogPrimitive.Trigger as React.ComponentType<DialogTriggerProps>
  return <Trigger data-slot="dialog-trigger" render={render} {...props} />
}

function DialogPortal(props: Readonly<DialogPrimitive.Portal.Props>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

type DialogCloseProps = Omit<DialogPrimitive.Close.Props, "render"> & {
  render?: React.ReactElement
}

function DialogClose({ render, ...props }: Readonly<DialogCloseProps>) {
  const Close = DialogPrimitive.Close as React.ComponentType<DialogCloseProps>
  return <Close data-slot="dialog-close" render={render} {...props} />
}

function DialogOverlay({
  className,
  ...props
}: Readonly<DialogPrimitive.Backdrop.Props>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
	      className={cn("bg-blanket fixed inset-0 isolate z-[200] transition-[opacity] duration-slow ease-out motion-reduce:transition-none data-ending-style:duration-medium data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0", className)}
      {...props}
    />
  )
}

const DIALOG_SIZE_CLASSES = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[600px]",
  lg: "sm:max-w-[800px]",
  xl: "sm:max-w-4xl",
} as const

interface DialogContentProps extends DialogPrimitive.Popup.Props {
  showCloseButton?: boolean
  size?: "sm" | "md" | "lg" | "xl"
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "sm",
  ...props
}: Readonly<DialogContentProps>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "bg-popover shadow-xl grid max-w-[calc(100%-2rem)] gap-6 rounded-xl p-6 text-sm fixed top-1/2 left-1/2 z-[200] w-full -translate-x-1/2 -translate-y-1/2 outline-none origin-center transition-[opacity,scale] duration-slow ease-in-out motion-reduce:transition-none data-ending-style:duration-medium data-ending-style:ease-in data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95",
          DIALOG_SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4"
                size="icon"
              />
            }
          >
            <CrossIcon label="" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close> : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("gap-2 flex flex-col", className)}
      {...props}
    />
  )
}

interface DialogFooterProps extends React.ComponentProps<"div"> {
  showCloseButton?: boolean
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: Readonly<DialogFooterProps>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
          "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton ? <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close> : null}
    </div>
  )
}

const DIALOG_TITLE_VARIANT_CONFIG = {
  default: null,
  warning: {
    icon: StatusWarningIcon,
    colorClass: "text-icon-warning",
  },
  destructive: {
    icon: StatusErrorIcon,
    colorClass: "text-icon-danger",
  },
} as const

interface DialogTitleProps extends DialogPrimitive.Title.Props {
  variant?: "default" | "warning" | "destructive"
}

function DialogTitle({
  className,
  variant = "default",
  children,
  ...props
}: Readonly<DialogTitleProps>) {
  const config = DIALOG_TITLE_VARIANT_CONFIG[variant]

  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-none font-medium",
        config && "flex items-center gap-2",
        className
      )}
      {...props}
    >
      {config ? <Icon
          render={<config.icon label="" />}
          label={variant}
          className={config.colorClass}
        /> : null}
      {children}
    </DialogPrimitive.Title>
  )
}

function DialogDescription({
  className,
  ...props
}: Readonly<DialogPrimitive.Description.Props>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

export type {
  DialogCloseProps,
  DialogContentProps,
  DialogFooterProps,
  DialogTitleProps,
  DialogTriggerProps,
}
