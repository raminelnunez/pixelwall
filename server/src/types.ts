export interface Pixel {
  _id: string;
  x: number;
  y: number;
  color: string;
  updatedBy: string;
  updatedAt: Date;
}

export interface PaintLogEntry {
  x: number;
  y: number;
  color: string;
  updatedBy: string;
  timestamp: Date;
}

export interface PaintPayload {
  x: number;
  y: number;
  color: string;
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

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
