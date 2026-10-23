import type { ThemeElement } from "@/core/types";

export interface ElementRenderProps {
  element: ThemeElement;
  props: Record<string, string>;
}

export function areElementRenderPropsEqual(
  previous: ElementRenderProps,
  next: ElementRenderProps,
): boolean {
  if (previous.element !== next.element) return false;
  if (previous.props === next.props) return true;

  const previousKeys = Object.keys(previous.props);
  const nextKeys = Object.keys(next.props);
  if (previousKeys.length !== nextKeys.length) return false;

  for (const key of previousKeys) {
    if (previous.props[key] !== next.props[key]) return false;
  }
  return true;
}