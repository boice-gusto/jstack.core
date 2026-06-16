declare module "react-sparklines" {
  import type { CSSProperties, ReactNode } from "react";

  export type SparklinesProps = {
    data: number[];
    width?: number;
    height?: number;
    margin?: number;
    min?: number;
    max?: number;
    children?: ReactNode;
  };

  export type SparklinesLineProps = {
    color?: string;
    style?: CSSProperties;
  };

  export function Sparklines(props: SparklinesProps): JSX.Element;
  export function SparklinesLine(props: SparklinesLineProps): JSX.Element;
}
