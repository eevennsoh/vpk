"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ExampleWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function ExampleWrapper({ children, className, ...props }: ExampleWrapperProps) {
  return (
    <div
      className={cn(
        "grid gap-6 p-6 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface ExampleProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  containerClassName?: string
  children: React.ReactNode
}

export function Example({
  title,
  children,
  className,
  containerClassName,
  ...props
}: ExampleProps) {
  return (
    <div
      className={cn(
        "bg-background flex min-h-[300px] flex-col rounded-lg border p-6",
        containerClassName
      )}
      {...props}
    >
      {title ? <h3 className="text-muted-foreground mb-4 text-sm font-medium">
          {title}
        </h3> : null}
      <div className={cn("flex flex-1 flex-col", className)}>{children}</div>
    </div>
  )
}
