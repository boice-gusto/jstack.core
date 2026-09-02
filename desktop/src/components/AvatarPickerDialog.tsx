import { useRef, useState } from "react";
import { AVATAR_EMOJIS, clearAgentAvatar, setAgentAvatar, type AgentAvatar } from "../lib/avatars";
import { AgentAvatar as AgentAvatarView } from "./AgentAvatar";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

/** 2 MB is generous for a small circular avatar and small enough that a data URL sitting in
 * localStorage (which has a real per-origin size cap, unlike a file on disk) can't quietly break
 * every other localStorage-backed feature (theme, sidebar width, session names) sharing the same
 * quota. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function AvatarPickerDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  currentAvatar,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  currentAvatar: AgentAvatar | undefined;
  onChange: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function pickEmoji(emoji: string): void {
    setAgentAvatar(agentId, { kind: "emoji", value: emoji });
    onChange();
    onOpenChange(false);
  }

  function handleFile(file: File): void {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image is too large (max 2 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAgentAvatar(agentId, { kind: "image", value: reader.result as string });
      onChange();
      onOpenChange(false);
    };
    reader.onerror = () => setError("Could not read that image.");
    reader.readAsDataURL(file);
  }

  function handleRemove(): void {
    clearAgentAvatar(agentId);
    onChange();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Avatar for {agentName}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <AgentAvatarView
            agentId={agentId}
            name={agentName}
            avatar={currentAvatar}
            sizeClassName="size-12"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Upload image
            </Button>
            {currentAvatar && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
                Remove
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) handleFile(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-8 gap-1">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              title={emoji}
              onClick={() => pickEmoji(emoji)}
              className={`flex size-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-accent ${
                currentAvatar?.kind === "emoji" && currentAvatar.value === emoji
                  ? "ring-2 ring-primary"
                  : ""
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
