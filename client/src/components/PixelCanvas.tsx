import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface PixelCanvasProps {
  pixels: Map<string, string>;
  gridSize: number;
  selectedColor: string;
  disabled?: boolean;
  onPaint: (x: number, y: number) => void;
}

const CELL = 10;

export function PixelCanvas({
  pixels,
  gridSize,
  selectedColor,
  disabled,
  onPaint,
}: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = gridSize * CELL;
    canvas.width = size;
    canvas.height = size;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        ctx.fillStyle = pixels.get(`${x}_${y}`) ?? "#ffffff";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    // Subtle grid for empty-ish boards
    ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(size, i * CELL + 0.5);
      ctx.stroke();
    }
  }, [pixels, gridSize]);

  function handlePointer(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL);
    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return;
    onPaint(x, y);
  }

  return (
    <div className="canvas-shell">
      <canvas
        ref={canvasRef}
        className={`pixel-canvas${disabled ? " is-disabled" : ""}`}
        style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
        onPointerDown={handlePointer}
        aria-label={`Pixel wall ${gridSize} by ${gridSize}`}
      />
      <div
        className="cursor-swatch"
        style={{ background: selectedColor }}
        aria-hidden
      />
    </div>
  );
}
