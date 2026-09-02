import { CreateAgentForm } from "./Onboarding";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { AgentSummary } from "../lib/agent";

/**
 * The "+ New agent" item in the sidebar's agent picker (App.tsx) opens this -- same
 * CreateAgentForm the first-run Onboarding screen uses, just in a modal instead of taking over
 * the whole window, since by this point at least one agent already exists.
 */
export function CreateAgentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (agent: AgentSummary) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New agent</DialogTitle>
        </DialogHeader>
        <CreateAgentForm
          onCreated={(agent) => {
            onCreated(agent);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
