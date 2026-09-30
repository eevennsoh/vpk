"use client";

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import type { HTMLAttributes, ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import {
  createContext,
  useCallback,
  use,
  useMemo,
  useState,
} from "react";

interface FileTreeContextType {
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

// Default noop for context default value
// oxlint-disable-next-line eslint(no-empty-function)
const noop = () => {};

const FileTreeContext = createContext<FileTreeContextType>({
  // oxlint-disable-next-line eslint-plugin-unicorn(no-new-builtin)
  expandedPaths: new Set(),
  togglePath: noop,
});

export type FileTreeProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  expanded?: Set<string>;
  defaultExpanded?: Set<string>;
  selectedPath?: string;
  onSelect?: (path: string) => void;
  onExpandedChange?: (expanded: Set<string>) => void;
};

export function FileTree({
  expanded: controlledExpanded,
  defaultExpanded = new Set(),
  selectedPath,
  onSelect,
  onExpandedChange,
  className,
  children,
  ...props
}: Readonly<FileTreeProps>) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expandedPaths = controlledExpanded ?? internalExpanded;

  const togglePath = useCallback(
    (path: string) => {
      const newExpanded = new Set(expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      setInternalExpanded(newExpanded);
      onExpandedChange?.(newExpanded);
    },
    [expandedPaths, onExpandedChange]
  );

  const contextValue = useMemo(
    () => ({ expandedPaths, onSelect, selectedPath, togglePath }),
    [expandedPaths, onSelect, selectedPath, togglePath]
  );

  return (
    <FileTreeContext value={contextValue}>
      <div
        className={cn(
          "rounded-lg font-mono text-sm",
          className
        )}
        role="tree"
        {...props}
      >
        <div>{children}</div>
      </div>
    </FileTreeContext>
  );
}

interface FileTreeFolderContextType {
  path: string;
  name: string;
  isExpanded: boolean;
}

const FileTreeFolderContext = createContext<FileTreeFolderContextType>({
  isExpanded: false,
  name: "",
  path: "",
});

export type FileTreeFolderProps = HTMLAttributes<HTMLDivElement> & {
  path: string;
  name: string;
};

export function FileTreeFolder({
  path,
  name,
  className,
  children,
  ...props
}: Readonly<FileTreeFolderProps>) {
  const { expandedPaths, togglePath, selectedPath, onSelect } =
    use(FileTreeContext);
  const isExpanded = expandedPaths.has(path);
  const isSelected = selectedPath === path;

  const handleOpenChange = useCallback(() => {
    togglePath(path);
  }, [togglePath, path]);

  const handleSelect = useCallback(() => {
    onSelect?.(path);
  }, [onSelect, path]);

  const folderContextValue = useMemo(
    () => ({ isExpanded, name, path }),
    [isExpanded, name, path]
  );

  return (
    <FileTreeFolderContext value={folderContextValue}>
      <Collapsible onOpenChange={handleOpenChange} open={isExpanded}>
        <div
          className={cn("relative", className)}
          role="treeitem"
          aria-selected={isSelected}
          tabIndex={0}
          {...props}
        >
          {/* Guide line: runs from below the header row to the bottom of children.
              left-3.5 = 14px = px-2(8) + half-chevron(6) = chevron center
              (Atlaskit small chevron is 12px wide).
              top-7 skips the header row height. */}
          {isExpanded ? <div className="absolute bottom-0 left-3.5 top-7 w-px bg-icon-subtlest/20" /> : null}
          <div
            className={cn(
              "relative flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors hover:bg-muted/50",
              isSelected && "bg-bg-selected hover:bg-bg-selected-hovered"
            )}
          >
            {/* Selected indicator: 2px blue bar pinned to the row's left edge. */}
            {isSelected ? <div className="absolute bottom-0 left-0 top-0 my-auto h-2 w-0.5 rounded-full bg-bg-selected-bold" /> : null}
            <CollapsibleTrigger
              render={
                <button
                  aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                  className="flex shrink-0 items-center border-none bg-transparent p-0"
                  type="button"
                />
              }
            >
              <ChevronRightIcon
                size="small"
                className={cn(
                  "size-3 shrink-0 leading-[0] text-icon-subtle transition-transform [&_span]:size-3! [&_svg]:size-3!",
                  isSelected && "text-icon-selected",
                  isExpanded && "rotate-90"
                )}
              />
            </CollapsibleTrigger>
            <button
              className="flex min-w-0 flex-1 items-center gap-1 border-none bg-transparent p-0 text-left"
              onClick={handleSelect}
              type="button"
            >
              <FileTreeIcon>
                {isExpanded ? (
                  <FolderOpenIcon
                    size="small"
                    className={cn("text-icon-subtle", isSelected && "text-icon-selected")}
                  />
                ) : (
                  <FolderIcon
                    size="small"
                    className={cn("text-icon-subtle", isSelected && "text-icon-selected")}
                  />
                )}
              </FileTreeIcon>
              <FileTreeName className={cn(isSelected && "text-text-selected")}>{name}</FileTreeName>
            </button>
          </div>
          <CollapsibleContent>
            {/* One level of indent = chevron(12) + gap(4) = 16px (pl-4),
                so a child's chevron aligns under the parent's folder icon. */}
            <div className="pl-4">{children}</div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </FileTreeFolderContext>
  );
}

interface FileTreeFileContextType {
  path: string;
  name: string;
}

const FileTreeFileContext = createContext<FileTreeFileContextType>({
  name: "",
  path: "",
});

export type FileTreeFileProps = HTMLAttributes<HTMLDivElement> & {
  path: string;
  name: string;
  icon?: ReactNode;
};

export function FileTreeFile({
  path,
  name,
  icon,
  className,
  children,
  ...props
}: Readonly<FileTreeFileProps>) {
  const { selectedPath, onSelect } = use(FileTreeContext);
  const isSelected = selectedPath === path;

  const handleClick = useCallback(() => {
    onSelect?.(path);
  }, [onSelect, path]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        onSelect?.(path);
      }
    },
    [onSelect, path]
  );

  const fileContextValue = useMemo(() => ({ name, path }), [name, path]);

  return (
    <FileTreeFileContext value={fileContextValue}>
      <div
        className={cn(
          "relative flex cursor-pointer items-center gap-1 rounded px-2 transition-colors",
          // Custom-content rows keep the legacy full-row highlight. The default
          // (icon + name) row highlights an inner block instead, so the selected
          // state is indented to the icon column (Figma 2556:28320).
          children != null && "py-1 hover:bg-muted/50",
          children != null && isSelected && "bg-bg-selected hover:bg-bg-selected-hovered",
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        aria-selected={isSelected}
        tabIndex={0}
        {...props}
      >
        {/* Custom-content branch: 2px blue bar pinned to the row's left edge. */}
        {children != null && isSelected ? <div className="absolute bottom-0 left-0 top-0 my-auto h-2 w-0.5 rounded-full bg-bg-selected-bold" /> : null}
        {children ?? (
          <>
            {/* Chevron-width spacer (Atlaskit small chevron = 12px) aligns file
                icons under folder icons. It sits OUTSIDE the highlight below so the
                selected state starts at the icon, indented from the tree edge. */}
            <span className="w-3 shrink-0" />
            <div
              className={cn(
                "relative -ml-1 flex min-w-0 flex-1 items-center gap-1 rounded py-1 pl-1 transition-colors hover:bg-muted/50",
                isSelected && "bg-bg-selected hover:bg-bg-selected-hovered"
              )}
            >
              {/* Selected indicator: 2px blue bar pinned to the highlight's left edge. */}
              {isSelected ? <div className="absolute bottom-0 left-0 top-0 my-auto h-2 w-0.5 rounded-full bg-bg-selected-bold" /> : null}
              <FileTreeIcon>
                {icon ?? (
                  <FileIcon
                    size="small"
                    className={cn("text-icon-subtle", isSelected && "text-icon-selected")}
                  />
                )}
              </FileTreeIcon>
              <FileTreeName className={cn(isSelected && "text-text-selected")}>{name}</FileTreeName>
            </div>
          </>
        )}
      </div>
    </FileTreeFileContext>
  );
}

export type FileTreeIconProps = HTMLAttributes<HTMLSpanElement>;

export function FileTreeIcon({
  className,
  children,
  ...props
}: Readonly<FileTreeIconProps>) {
  return (
    <span
      className={cn(
        // Front-slot icons are locked to 12×12 per the Figma spec; this clamps
        // ADS glyphs (which render at small=16px) and any custom icon child.
        // ADS sizes its icon span/svg via unlayered CSS, so `!` is required for
        // these utilities to win from Tailwind's utilities layer.
        "inline-flex size-3 shrink-0 items-center justify-center leading-none [&_img]:size-3! [&_span]:size-3! [&_svg]:size-3!",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export type FileTreeNameProps = HTMLAttributes<HTMLSpanElement>;

export function FileTreeName({
  className,
  children,
  ...props
}: Readonly<FileTreeNameProps>) {
  return (
    <span className={cn("truncate", className)} {...props}>
      {children}
    </span>
  );
}

export type FileTreeActionsProps = HTMLAttributes<HTMLDivElement>;

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export function FileTreeActions({
  className,
  children,
  ...props
}: Readonly<FileTreeActionsProps>) {
  return (
    <div
      className={cn("ml-auto flex items-center gap-1", className)}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
      role="group"
      {...props}
    >
      {children}
    </div>
  );
}
