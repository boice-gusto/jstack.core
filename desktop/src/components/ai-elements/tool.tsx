"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  FileIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock, type CodeBlockLanguage } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
  /** File path pulled out of the tool's input (Read/Write/Edit's `file_path`, Grep/Glob's
   * `path`), if any -- shown as an inline "open" affordance so a path a tool touched can be
   * opened directly instead of only ever appearing as inert text inside a JSON blob. */
  filePath?: string;
  onOpenFile?: (path: string) => void;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

/** Best-effort extraction of a file path from a tool call's input, for the "open file" button in
 * ToolHeader. Only recognizes the key names jstack's own crew agents actually use (Read/Write/
 * Edit's `file_path`, Grep/Glob's `path`) and only when the value looks like a real filesystem
 * path (absolute or home-relative) -- a bare relative string like "src" from some other tool
 * shape isn't safe to hand to the OS opener without a working-directory to resolve it against. */
export function extractFilePath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const obj = input as Record<string, unknown>;
  const candidate = obj.file_path ?? obj.path ?? obj.notebook_path;
  if (typeof candidate !== "string") return undefined;
  return candidate.startsWith("/") || candidate.startsWith("~/") ? candidate : undefined;
}

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Awaiting Approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-4 text-yellow-600" />,
  "approval-responded": <CheckCircleIcon className="size-4 text-blue-600" />,
  "input-available": <ClockIcon className="size-4 animate-pulse" />,
  "input-streaming": <CircleIcon className="size-4" />,
  "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
  "output-denied": <XCircleIcon className="size-4 text-orange-600" />,
  "output-error": <XCircleIcon className="size-4 text-red-600" />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
  <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
    {statusIcons[status]}
    {statusLabels[status]}
  </Badge>
);

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  filePath,
  onOpenFile,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 p-3",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-sm">{title ?? derivedName}</span>
        {getStatusBadge(state)}
        {filePath && onOpenFile && (
          // Rendered as a <span>, not a real <button> -- CollapsibleTrigger (this component's
          // parent) is itself a native <button>, and nesting interactive elements inside a
          // <button> is invalid HTML that browsers silently un-nest, breaking click handling.
          <Button
            variant="ghost"
            size="sm"
            // Same blue-tinted "this is code/a file, not prose" identity as markdown code blocks
            // (see index.css's --code-bg/--code-border/--code-accent) -- bold + a distinct color
            // so a file reference reads as a real affordance, not muted inert text.
            className="min-w-0 gap-1 border border-[var(--code-border)] bg-[var(--code-bg)] font-mono text-xs font-semibold text-[var(--code-accent)] hover:bg-[var(--code-bg)]"
            title={`Open ${filePath}`}
            render={<span />}
            nativeButton={false}
            onClick={(e) => {
              e.stopPropagation();
              onOpenFile(filePath);
            }}
          >
            <FileIcon className="size-3 shrink-0" />
            <span className="truncate">{filePath.split("/").pop()}</span>
          </Button>
        )}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[closed]:fade-out-0 data-[closed]:slide-out-to-top-2 data-[open]:slide-in-from-top-2 space-y-4 p-4 text-popover-foreground outline-none data-[closed]:animate-out data-[open]:animate-in",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
  /** Language for syntax-highlighting a *string* output (object outputs are always
   * JSON-stringified and highlighted as json). Defaults to "text" -- most tool output here
   * (Bash stdout, grep matches, file contents) isn't JSON. */
  language?: CodeBlockLanguage;
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  language = "plaintext",
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language={language} />;
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
