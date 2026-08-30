import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceStore } from "./workspace-store.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  useWorkspaceStore.setState({ status: { kind: "idle" } });
});

describe("workspace-store status transitions", () => {
  it("goes idle -> loading -> ready on a successful load", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ bsa: { prd: "", plan: "", spec: "" }, team: { sprint: "" }, ic: { focus: "" } }), { status: 200 }),
    ) as unknown as typeof fetch;

    const loadPromise = useWorkspaceStore.getState().load();
    expect(useWorkspaceStore.getState().status.kind).toBe("loading");
    await loadPromise;
    expect(useWorkspaceStore.getState().status).toEqual({ kind: "ready" });
  });

  it("goes to load-error (not loading, not ready) when the load fails -- never both at once", async () => {
    global.fetch = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;

    await useWorkspaceStore.getState().load();

    const status = useWorkspaceStore.getState().status;
    expect(status.kind).toBe("load-error");
    // The bug this replaces: `loaded` stayed false AND `error` was set, so the UI rendered
    // "Loading…" and the error message at the same time. A single discriminated status
    // makes that combination impossible to construct -- there is exactly one `kind`.
    expect(status.kind).not.toBe("loading");
    expect(status.kind).not.toBe("ready");
    if (status.kind === "load-error") {
      expect(status.message).toContain("Load failed");
    }
  });

  it("goes to save-error when the save fails, and the failure doesn't look like a fresh load", async () => {
    useWorkspaceStore.setState({ status: { kind: "ready" } });
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;

    await useWorkspaceStore.getState().save();

    const status = useWorkspaceStore.getState().status;
    expect(status.kind).toBe("save-error");
    expect(status.kind).not.toBe("loading");
  });

  it("returns to ready after a successful save", async () => {
    useWorkspaceStore.setState({ status: { kind: "ready" } });
    global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;

    await useWorkspaceStore.getState().save();

    expect(useWorkspaceStore.getState().status).toEqual({ kind: "ready" });
  });
});
