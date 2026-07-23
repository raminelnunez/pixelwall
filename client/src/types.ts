export interface PixelCell {
  x: number;
  y: number;
  color: string;
  updatedBy?: string;
}

export interface BoardPayload {
  pixels: PixelCell[];
  gridSize: number;
  cooldownMs: number;
}

export interface PixelUpdatedPayload {
  x: number;
  y: number;
  color: string;
  updatedBy: string;
}

export interface PaintRejectedPayload {
  reason: "cooldown" | "bounds" | "color" | "server";
  retryAfterMs?: number;
}

export interface PaintLogEvent {
  x: number;
  y: number;
  color: string;
  updatedBy: string;
  timestamp: string;
}

export interface StatsPayload {
  paintedToday: number;
  since: string;
}

export const PALETTE = [
  "#ffffff",
  "#1a1a1a",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
] as const;
