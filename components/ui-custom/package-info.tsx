"use client";

// oxlint-disable react-doctor/jsx-no-constructed-context-values -- Context values in this file intentionally combine live state and setters; extracting them would not reduce meaningful consumer churn.

import type { HTMLAttributes } from "react";

import AddIcon from "@atlaskit/icon/core/add";
import ArrowRightGlyph from "@atlaskit/icon/core/arrow-right";
import MinusGlyph from "@atlaskit/icon/core/minus";

import { Icon } from "@/components/ui/icon";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { ArrowRightIcon, PackageIcon } from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import { createContext, use } from "react";

type ChangeType = "major" | "minor" | "patch" | "added" | "removed";

interface PackageInfoContextType {
  name: string;
  currentVersion?: string;
  newVersion?: string;
  changeType?: ChangeType;
}

const PackageInfoContext = createContext<PackageInfoContextType>({
  name: "",
});

export type PackageInfoProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  currentVersion?: string;
  newVersion?: string;
  changeType?: ChangeType;
};

export const PackageInfo = ({
  name,
  currentVersion,
  newVersion,
  changeType,
  className,
  children,
  ...props
}: Readonly<PackageInfoProps>) => (
  <PackageInfoContext value={{ changeType, currentVersion, name, newVersion }}>
    <div
      className={cn("rounded-lg border bg-background p-4", className)}
      {...props}
    >
      {children ?? (
        <>
          <PackageInfoHeader>
            <PackageInfoName />
            {changeType ? <PackageInfoChangeType /> : null}
          </PackageInfoHeader>
          {(currentVersion || newVersion) ? <PackageInfoVersion /> : null}
        </>
      )}
    </div>
  </PackageInfoContext>
);

export type PackageInfoHeaderProps = HTMLAttributes<HTMLDivElement>;

export const PackageInfoHeader = ({
  className,
  children,
  ...props
}: Readonly<PackageInfoHeaderProps>) => (
  <div
    className={cn("flex items-center justify-between gap-2", className)}
    {...props}
  >
    {children}
  </div>
);

export type PackageInfoNameProps = HTMLAttributes<HTMLDivElement>;

export const PackageInfoName = ({
  className,
  children,
  ...props
}: Readonly<PackageInfoNameProps>) => {
  const { name } = use(PackageInfoContext);

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <PackageIcon className="size-4 text-muted-foreground" />
      <span className="font-medium font-mono text-sm">{children ?? name}</span>
    </div>
  );
};

const changeTypeVariants: Record<ChangeType, NonNullable<LozengeProps["variant"]>> = {
  added: "information",
  major: "danger",
  minor: "warning",
  patch: "success",
  removed: "neutral",
};

const changeTypeIcons: Record<ChangeType, React.ReactNode> = {
  added: <Icon render={<AddIcon label="" />} label="" />,
  major: <Icon render={<ArrowRightGlyph label="" />} label="" />,
  minor: <Icon render={<ArrowRightGlyph label="" />} label="" />,
  patch: <Icon render={<ArrowRightGlyph label="" />} label="" />,
  removed: <Icon render={<MinusGlyph label="" />} label="" />,
};

export type PackageInfoChangeTypeProps = Omit<LozengeProps, "variant" | "elemBefore" | "icon">;

export const PackageInfoChangeType = ({
  className,
  children,
  ...props
}: Readonly<PackageInfoChangeTypeProps>) => {
  const { changeType } = use(PackageInfoContext);

  if (!changeType) {
    return null;
  }

  return (
    <Lozenge
      className={cn("capitalize", className)}
      elemBefore={changeTypeIcons[changeType]}
      variant={changeTypeVariants[changeType]}
      {...props}
    >
      {children ?? changeType}
    </Lozenge>
  );
};

export type PackageInfoVersionProps = HTMLAttributes<HTMLDivElement>;

export const PackageInfoVersion = ({
  className,
  children,
  ...props
}: Readonly<PackageInfoVersionProps>) => {
  const { currentVersion, newVersion } = use(PackageInfoContext);

  if (!(currentVersion || newVersion)) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-2 flex items-center gap-2 font-mono text-muted-foreground text-sm",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          {currentVersion ? <span>{currentVersion}</span> : null}
          {currentVersion && newVersion ? <ArrowRightIcon className="size-3" /> : null}
          {newVersion ? <span className="font-medium text-foreground">{newVersion}</span> : null}
        </>
      )}
    </div>
  );
};

export type PackageInfoDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const PackageInfoDescription = ({
  className,
  children,
  ...props
}: Readonly<PackageInfoDescriptionProps>) => (
  <p className={cn("mt-2 text-muted-foreground text-sm", className)} {...props}>
    {children}
  </p>
);

export type PackageInfoContentProps = HTMLAttributes<HTMLDivElement>;

export const PackageInfoContent = ({
  className,
  children,
  ...props
}: Readonly<PackageInfoContentProps>) => (
  <div className={cn("mt-3 border-t pt-3", className)} {...props}>
    {children}
  </div>
);

export type PackageInfoDependenciesProps = HTMLAttributes<HTMLDivElement>;

export const PackageInfoDependencies = ({
  className,
  children,
  ...props
}: Readonly<PackageInfoDependenciesProps>) => (
  <div className={cn("space-y-2", className)} {...props}>
    <span className="font-medium text-muted-foreground text-xs">
      Dependencies
    </span>
    <div className="space-y-1">{children}</div>
  </div>
);

export type PackageInfoDependencyProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  version?: string;
};

export const PackageInfoDependency = ({
  name,
  version,
  className,
  children,
  ...props
}: Readonly<PackageInfoDependencyProps>) => (
  <div
    className={cn("flex items-center justify-between text-sm", className)}
    {...props}
  >
    {children ?? (
      <>
        <span className="font-mono text-muted-foreground">{name}</span>
        {version ? <span className="font-mono text-xs">{version}</span> : null}
      </>
    )}
  </div>
);
