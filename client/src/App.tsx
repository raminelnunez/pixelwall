import { useState } from "react";
import { ColorPalette } from "./components/ColorPalette";
import { CooldownTimer } from "./components/CooldownTimer";
import { PixelCanvas } from "./components/PixelCanvas";
import { ReplayButton } from "./components/ReplayButton";
import { StatsCounter } from "./components/StatsCounter";
import { usePixelSocket } from "./hooks/usePixelSocket";
import { PALETTE } from "./types";

export default function App() {
  const [color, setColor] = useState<string>(PALETTE[2]);
  const [replaying, setReplaying] = useState(false);
  const {
    status,
    pixels,
    gridSize,
    cooldownUntil,
    rejectMessage,
    wakingUp,
    paint,
    applyBoard,
    setPixelLocal,
    clearBoard,
  } = usePixelSocket();

  const statusLabel =
    status === "connected"
      ? "Live"
      : status === "connecting"
        ? "Connecting…"
        : status === "disconnected"
          ? "Reconnecting…"
          : "Connection issue";

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />

      <header className="hero">
        <p className="brand">Pixel Wall</p>
        <h1 className="headline">Paint one pixel. Watch the wall change live.</h1>
        <p className="lede">
          A shared {gridSize}×{gridSize} canvas. Click a cell, leave your mark, see everyone
          else’s update in real time.
        </p>
      </header>

      {(wakingUp || status !== "connected") && (
        <div className="wake-banner" role="status">
          {wakingUp
            ? "Waking up the server… free-tier hosts nap between visitors."
            : statusLabel}
        </div>
      )}

      <section className="stage" aria-label="Collaborative canvas">
        <div className="toolbar">
          <ColorPalette selected={color} onSelect={setColor} />
          <CooldownTimer cooldownUntil={cooldownUntil} message={rejectMessage} />
          <div className="toolbar-meta">
            <StatsCounter />
            <ReplayButton
              gridSize={gridSize}
              livePixels={pixels}
              onClear={clearBoard}
              onPaintLocal={setPixelLocal}
              onRestore={applyBoard}
              onReplayingChange={setReplaying}
            />
            <span className={`status-dot status-${status}`} title={statusLabel}>
              {statusLabel}
            </span>
          </div>
        </div>

        <PixelCanvas
          pixels={pixels}
          gridSize={gridSize}
          selectedColor={color}
          disabled={replaying || status !== "connected"}
          onPaint={(x, y) => paint(x, y, color)}
        />
      </section>

      <footer className="foot">
        <p>
          Stack: React · Socket.IO · Express · MongoDB — one doc per pixel, append-only paint
          log for replay &amp; daily stats.
        </p>
      </footer>
    </div>
  );
}
