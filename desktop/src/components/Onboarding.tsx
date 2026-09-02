import { useState } from "react";
import { createAgent, type AgentSummary } from "../lib/agent";
import { AVATAR_EMOJIS, pickRandomUnusedEmoji, setAgentAvatar } from "../lib/avatars";
import { AgentAvatar } from "./AgentAvatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export const MODELS = ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"];
export const AVAILABLE_TOOLS = ["Read", "Grep", "Glob", "Write", "Edit", "Bash"];
const DEFAULT_TOOLS = ["Read", "Grep", "Glob"];

/**
 * The agent-creation form, shared by the full-page Onboarding wizard (below) and
 * CreateAgentDialog (the "+ New agent" item on the sidebar's agent picker) -- same real
 * `createAgent` write (agent/create over RPC, cli/src/lib/crew/agent-config.ts) either way, just
 * a different wrapper around it depending on whether any agent exists yet.
 */
export function CreateAgentForm({
  onCreated,
  submitLabel = "Create agent",
}: {
  onCreated: (agent: AgentSummary) => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [model, setModel] = useState(MODELS[0]!);
  const [tools, setTools] = useState<string[]>(DEFAULT_TOOLS);
  const [mcpInherit, setMcpInherit] = useState(false);
  // Required in the sense that it's never blank -- pre-filled with a random emoji no other agent
  // is currently using (see pickRandomUnusedEmoji) the moment this form mounts, so an agent
  // created without touching this field still gets a real, persisted avatar rather than falling
  // back to the plain letter-and-circle (that fallback stays reserved for pre-existing agents
  // from before this feature existed).
  const [emoji, setEmoji] = useState(() => pickRandomUnusedEmoji());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTool(tool: string): void {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    );
  }

  function slugify(n: string): string {
    return (
      n
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24) || "agent"
    );
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = slugify(name);
      const { agent } = await createAgent({
        id,
        name: name.trim(),
        persona: persona.trim() || undefined,
        model,
        tools,
        mcp: mcpInherit ? "inherit" : "none",
      });
      setAgentAvatar(id, { kind: "emoji", value: emoji });
      onCreated({ id, ...agent });
    } catch (err) {
      console.error("[jstack] createAgent failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="agent-name">Name</Label>
        <Input
          id="agent-name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="e.g. Ralph"
          disabled={busy}
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Avatar</Label>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            title="Pick a different random emoji"
            onClick={() => setEmoji(pickRandomUnusedEmoji())}
            disabled={busy}
          >
            🎲 Randomize
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <AgentAvatar
            agentId={name || "new-agent"}
            name={name || "?"}
            avatar={{ kind: "emoji", value: emoji }}
            sizeClassName="size-10"
          />
          <div className="grid grid-cols-8 gap-1 rounded-md border p-2">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                title={e}
                onClick={() => setEmoji(e)}
                disabled={busy}
                className={`flex size-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-accent ${
                  emoji === e ? "ring-2 ring-primary" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent-persona">Persona / soul</Label>
        <Textarea
          id="agent-persona"
          value={persona}
          onChange={(e) => setPersona(e.currentTarget.value)}
          placeholder="Extra guidance appended to this agent's system prompt -- tone, priorities, how it should answer."
          disabled={busy}
          rows={4}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent-model">Model</Label>
        <Select value={model} onValueChange={(v) => v && setModel(v)}>
          <SelectTrigger id="agent-model" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Access (tools)</Label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_TOOLS.map((tool) => (
            <label key={tool} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={tools.includes(tool)}
                onCheckedChange={() => toggleTool(tool)}
                disabled={busy}
              />
              {tool}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={mcpInherit}
          onCheckedChange={(c) => setMcpInherit(c === true)}
          disabled={busy}
        />
        <span>
          Give this agent the same MCP servers configured for the <code>claude</code> CLI (e.g.
          Glean). Off by default -- only turn this on for an agent you trust with that access.
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
        {busy ? "Creating..." : submitLabel}
      </Button>
    </form>
  );
}

/**
 * Shown instead of the whole chat layout when `agent/list` comes back empty -- there is nothing
 * to select an agent for, chat with, or create a session against, so a normal empty-sidebar
 * chat view would just be confusing.
 */
export function Onboarding({ onCreated }: { onCreated: (agent: AgentSummary) => void }) {
  return (
    <div className="flex h-screen items-center justify-center overflow-y-auto bg-background p-8 text-foreground">
      <div className="w-full max-w-lg space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Create your first agent</h1>
          <p className="text-sm text-muted-foreground">
            No agents are configured yet -- set one up to start chatting.
          </p>
        </div>
        <CreateAgentForm onCreated={onCreated} />
      </div>
    </div>
  );
}
