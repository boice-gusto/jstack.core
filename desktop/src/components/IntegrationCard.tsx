import { CheckIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Integration } from "../lib/agent";

/**
 * The "wrapper" component every Integrations-tab entry renders through -- a status card (name,
 * one-line description, configured?/external-dependency-available? checks) with a slot for
 * whatever that specific integration wants to add below (Slack DM's "notify" field lives on the
 * Schedule tab's own form today, not here, since it's per-schedule rather than per-integration;
 * `children` is where a future integration's own settings/actions would go). Kept as its own
 * file, not inlined in SettingsDialog.tsx, so a second integration's card is "render another one
 * of these," not "copy-paste the JSX."
 */
export function IntegrationCard({
  integration,
  children,
}: {
  integration: Integration;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium">{integration.name}</h4>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            integration.configured
              ? "bg-green-600/15 text-green-700 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {integration.configured ? "Configured" : "Not configured"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{integration.description}</p>
      <div className="mt-2 flex items-start gap-2 text-xs">
        {integration.mcpAvailable ? (
          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-green-600 dark:text-green-500" />
        ) : (
          <XIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        )}
        <span>
          {integration.mcpAvailable
            ? "The Slack MCP is available to claude."
            : "The Slack MCP isn't available to claude -- add it with `claude mcp add`."}
        </span>
      </div>
      {integration.mcpDetail && (
        <pre className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-1.5 font-mono text-xs">
          {integration.mcpDetail}
        </pre>
      )}
      {children}
    </div>
  );
}
