export type NavigationLayout = "vertical" | "horizontal";

const NAVIGATION_LAYOUT_KEY = "jstack.navigationLayout";

export function loadNavigationLayout(): NavigationLayout {
  return localStorage.getItem(NAVIGATION_LAYOUT_KEY) === "horizontal" ? "horizontal" : "vertical";
}

export function storeNavigationLayout(layout: NavigationLayout): void {
  localStorage.setItem(NAVIGATION_LAYOUT_KEY, layout);
}
