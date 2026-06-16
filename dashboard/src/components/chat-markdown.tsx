"use client";

import type { ReactElement } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const components: Components = {
  p: ({ className, ...props }) => (
    <p className={cn("mb-2 last:mb-0 text-sm leading-relaxed", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("mb-2 list-disc space-y-0.5 pl-4 text-sm last:mb-0", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("mb-2 list-decimal space-y-0.5 pl-4 text-sm last:mb-0", className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("marker:text-muted-foreground", className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  a: ({ className, href, children, ...props }) => (
    <a
      className={cn("font-medium text-primary underline-offset-2 hover:underline", className)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const inline = typeof children === "string" && !children.includes("\n");
    if (inline) {
      return (
        <code
          className={cn(
            "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "my-2 block overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, ...props }) => (
    <pre className={cn("my-2 overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs", className)} {...props} />
  ),
};

export function ChatMarkdown({ content }: { content: string }): ReactElement {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
