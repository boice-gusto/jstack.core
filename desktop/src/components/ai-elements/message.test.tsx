import { render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { MessageResponse } from "./message";

/**
 * MessageResponse (Streamdown + the cjk/code/math/mermaid plugin set): these tests exist to catch a
 * dependency bump silently breaking the plugin wiring, not to exercise Streamdown's own rendering
 * logic. Mermaid in particular is wired via streamdownPlugins and @streamdown/mermaid.
 */
describe("MessageResponse", () => {
  test("renders plain markdown", async () => {
    const markdown = "# Heading\n\nSome text.";
    const { container } = render(<MessageResponse>{markdown}</MessageResponse>);
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toBe("Heading");
    });
  });

  test("renders a ```mermaid fenced code block as an actual diagram (svg), not raw code text", async () => {
    const markdown = "Here's a diagram:\n\n```mermaid\ngraph TD;\nA-->B;\n```\n";
    const { container } = render(<MessageResponse>{markdown}</MessageResponse>);
    await waitFor(
      () => {
        expect(container.querySelector("svg")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
