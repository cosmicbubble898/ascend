export type ZoomAction = "in" | "out" | "reset";

export interface WindowBridge {
  zoom(action: ZoomAction): Promise<number>;
}

export const validZoomAction = (value: unknown): value is ZoomAction =>
  value === "in" || value === "out" || value === "reset";
