import { useRef, useState } from "react";
import { apiBase } from "../config";
import type { PaintLogEvent, PixelCell } from "../types";

interface ReplayButtonProps {
  gridSize: number;
  livePixels: Map<string, string>;
  onClear: (size: number) => void;
  onPaintLocal: (x: number, y: number, color: string) => void;
  onRestore: (cells: PixelCell[]) => void;
  onReplayingChange: (active: boolean) => void;
}

const PIXELS_PER_FRAME = 20;

export function ReplayButton({
  gridSize,
  livePixels,
  onClear,
  onPaintLocal,
  onRestore,
  onReplayingChange,
}: ReplayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const snapshotRef = useRef<PixelCell[]>([]);

  async function startReplay() {
    if (busy) return;
    setBusy(true);
    onReplayingChange(true);
    setProgress("Loading history…");

    snapshotRef.current = Array.from(livePixels.entries()).map(([key, color]) => {
      const [x, y] = key.split("_").map(Number);
      return { x, y, color };
    });

    try {
      const res = await fetch(`${apiBase()}/replay`);
      if (!res.ok) throw new Error("replay failed");
      const data = (await res.json()) as { events: PaintLogEvent[]; gridSize: number };
      const events = data.events ?? [];

      onClear(data.gridSize ?? gridSize);

      if (events.length === 0) {
        setProgress("No history yet — be the first to paint");
        window.setTimeout(() => {
          onRestore(snapshotRef.current);
          setBusy(false);
          setProgress(null);
          onReplayingChange(false);
        }, 1200);
        return;
      }

      let i = 0;
      const step = () => {
        const end = Math.min(i + PIXELS_PER_FRAME, events.length);
        for (; i < end; i++) {
          const e = events[i];
          onPaintLocal(e.x, e.y, e.color);
        }
        setProgress(`Replaying ${i} / ${events.length}`);

        if (i < events.length) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setProgress("Replay complete");
          window.setTimeout(() => {
            // Snap back to live board state captured at start, then let socket catch up
            onRestore(snapshotRef.current);
            setBusy(false);
            setProgress(null);
            onReplayingChange(false);
          }, 800);
        }
      };

      rafRef.current = requestAnimationFrame(step);
    } catch {
      setProgress("Couldn’t load replay");
      onRestore(snapshotRef.current);
      setBusy(false);
      onReplayingChange(false);
      window.setTimeout(() => setProgress(null), 2000);
    }
  }

  return (
    <div className="replay-wrap">
      <button
        type="button"
        className="btn"
        onClick={() => void startReplay()}
        disabled={busy}
      >
        {busy ? "Replaying…" : "Replay"}
      </button>
      {progress && <span className="replay-progress">{progress}</span>}
    </div>
  );
}
