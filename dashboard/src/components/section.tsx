type SectionProps = {
  title: string;
  children: React.ReactNode;
  /** Adds a standard preview-shell note for placeholder routes. */
  variant?: "default" | "stub";
};

export function Section({ title, children, variant = "default" }: SectionProps) {
  return (
    <div className="space-y-3">
      <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {children}
        {variant === "stub" ? (
          <p className="mb-0 mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
            This route is a browser preview only. Integrations and skills run from your agent host (Cursor / Claude Code)
            with <code className="rounded border border-border bg-muted px-1 font-mono text-[0.7rem]">jstack.config.json</code>
            . Use <a className="font-medium text-primary underline-offset-2 hover:underline" href="/agent">Agent</a> or{" "}
            <a className="font-medium text-primary underline-offset-2 hover:underline" href="/wizard">Wizard</a> for
            live model calls here.
          </p>
        ) : null}
      </div>
    </div>
  );
}
