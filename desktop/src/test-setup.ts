import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; use-stick-to-bottom (behind AI Elements' Conversation) needs one
// to mount at all. A no-op is enough -- these tests don't assert on scroll/resize behavior.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
