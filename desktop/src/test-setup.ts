import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; use-stick-to-bottom (behind AI Elements' Conversation) needs one
// to mount at all. A no-op is enough -- these tests don't assert on scroll/resize behavior.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom doesn't implement scrollIntoView either; cmdk (the command palette) calls it when
// auto-selecting the first filtered item. A no-op is enough -- same reasoning as above.
Element.prototype.scrollIntoView = () => {};

// jsdom has no PointerEvent constructor; Base UI's Switch dispatches a synthetic one on click
// (dispatchClickWithModifiers) to simulate a real pointer click, which throws
// "PointerEvent is not a constructor" without this. MouseEvent is a close enough shape for
// jsdom's purposes -- nothing here asserts on pointer-specific fields (pressure, pointerType).
if (typeof globalThis.PointerEvent === "undefined") {
  globalThis.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}

