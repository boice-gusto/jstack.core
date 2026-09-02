import { fallbackHue, type AgentAvatar as AgentAvatarValue } from "../lib/avatars";
import { cn } from "../lib/utils";

/**
 * Renders whatever's stored for an agent (uploaded image, chosen emoji, or nothing) in a circle
 * of the given size. Callers that also want a status ring (the sidebar's collapsed rail) apply
 * their own `ring-*` classes via `className` -- this component only owns the circle's fill.
 */
export function AgentAvatar({
  agentId,
  name,
  avatar,
  sizeClassName = "size-6",
  className,
}: {
  agentId: string;
  name: string;
  avatar: AgentAvatarValue | undefined;
  sizeClassName?: string;
  className?: string;
}) {
  if (avatar?.kind === "image") {
    return (
      <img
        src={avatar.value}
        alt={name}
        className={cn(sizeClassName, "shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  if (avatar?.kind === "emoji") {
    return (
      <span
        className={cn(
          sizeClassName,
          // overflow-hidden matters here specifically: rounded-full clips the box's own
          // background/border, but NOT child content that renders larger than the box (which
          // color emoji glyphs routinely do at small sizes, per font metrics) -- without it, the
          // emoji's own bounding box pokes past the circle at the corners instead of the circle
          // actually looking circular.
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted leading-none",
          className,
        )}
        style={{ fontSize: "70%" }}
      >
        {avatar.value}
      </span>
    );
  }

  return (
    <span
      className={cn(
        sizeClassName,
        "flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: `oklch(0.6 0.12 ${fallbackHue(agentId)})` }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
