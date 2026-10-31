import { PlusIcon, UserIcon } from "lucide-react";
import type { AgentSummary } from "../lib/agent";
import type { AgentAvatar as AgentAvatarValue } from "../lib/avatars";
import { AgentAvatar } from "./AgentAvatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/**
 * "New chat" + "jump to an agent" -- identical behavior whether they sit in the vertical
 * sidebar's toolbar or the horizontal layout's tab strip, so both render this instead of two
 * copies that could drift. "New agent" itself lives in the header's "..." menu, not here --
 * creating an agent is an app-level action, not a per-chat one.
 */
export function NewSessionControls({
  agents,
  agentId,
  onSelectAgent,
  avatars,
  busy,
  onNewChat,
}: {
  agents: AgentSummary[];
  agentId: string;
  /** Picking an agent here jumps to it -- its most recent open session if it has one, or a
   * freshly created one if it doesn't (see App.tsx's handleSelectAgentFromPicker). */
  onSelectAgent: (id: string) => void;
  avatars: Record<string, AgentAvatarValue | undefined>;
  busy: boolean;
  onNewChat: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="icon"
        size="icon"
        title="New chat"
        onClick={onNewChat}
        disabled={busy}
      >
        <PlusIcon className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="icon"
              size="icon"
              title={`Switch agent (currently ${agents.find((a) => a.id === agentId)?.name ?? agentId})`}
            >
              <UserIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent>
          {agents.map((a) => (
            <DropdownMenuItem
              key={a.id}
              onClick={() => onSelectAgent(a.id)}
              className={a.enabled ? undefined : "text-muted-foreground"}
            >
              <AgentAvatar
                agentId={a.id}
                name={a.name}
                avatar={avatars[a.id]}
                sizeClassName="size-4"
                className={a.enabled ? undefined : "opacity-50"}
              />
              {a.name}
              {!a.enabled && (
                <span className="ml-auto text-xs text-muted-foreground">disabled</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
