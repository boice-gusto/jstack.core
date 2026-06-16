import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const components: Components = {
  p: ({ className, ...props }) => <p className={cn("mb-3 last:mb-0 leading-relaxed", className)} {...props} />,
  ul: ({ className, ...props }) => (
    <ul className={cn("mb-3 list-disc space-y-1 pl-5 last:mb-0", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("mb-3 list-decimal space-y-1 pl-5 last:mb-0", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("marker:text-muted-foreground", className)} {...props} />,
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  a: ({ className, href, children, ...props }) => (
    <a
      className={cn("font-medium text-primary underline-offset-4 hover:underline", className)}
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ className, ...props }) => (
    <h4 className={cn("mb-2 mt-4 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h4 className={cn("mb-2 mt-4 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h4 className={cn("mb-2 mt-4 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const inline = typeof children === "string" && !children.includes("\n");
    if (inline) {
      return (
        <code
          className={cn(
            "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
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
        className={cn("block overflow-x-auto rounded-lg bg-muted p-3 font-mono text-sm", className)}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, ...props }) => <pre className={cn("mb-3 overflow-x-auto", className)} {...props} />,
  table: ({ className, ...props }) => (
    <div className="mb-3 overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={cn("border-b border-border", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("px-3 py-2 font-medium text-foreground [tr:first-child_&]:pt-0", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => <td className={cn("border-t border-border px-3 py-2", className)} {...props} />,
  tr: ({ className, ...props }) => <tr className={cn("", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("mb-3 border-l-2 border-border pl-4 text-muted-foreground", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => <hr className={cn("my-4 border-border", className)} {...props} />,
};

type ReportMarkdownProps = {
  children: string;
  className?: string;
};

export function ReportMarkdown({ children, className }: ReportMarkdownProps) {
  return (
    <div className={cn("text-sm text-foreground/90", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
