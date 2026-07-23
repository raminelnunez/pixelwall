import { useEffect, useRef, useState } from "react";
import { apiBase } from "../config";
import type { PaintLogEvent } from "../types";

interface ReplayButtonProps {
  gridSize: number;
  onApplyBoardMap: (map: Map<string, string>) => void;
  blankBoardMap: (size: number) => Map<string, string>;
  onReplayingChange: (active: boolean) => void;
}

const TICK_MS = 60;
/** Aim for ~4s of animation; short histories go 1 px / tick so you can actually see them. */
const TARGET_DURATION_MS = 4000;

export function ReplayButton({
  gridSize,
  onApplyBoardMap,
  blankBoardMap,
  onReplayingChange,
}: ReplayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function startReplay() {
    if (busy) return;
    cancelledRef.current = false;
    setBusy(true);
    onReplayingChange(true);
    setProgress("Loading history…");

    try {
      const res = await fetch(`${apiBase()}/replay`);
      if (!res.ok) throw new Error("replay failed");
      const data = (await res.json()) as { events: PaintLogEvent[]; gridSize: number };
      const events = data.events ?? [];
      const size = data.gridSize ?? gridSize;

      if (cancelledRef.current) return;

      if (events.length === 0) {
        onApplyBoardMap(blankBoardMap(size));
        setProgress("No history yet — be the first to paint");
        timerRef.current = window.setTimeout(() => {
          onReplayingChange(false);
          setBusy(false);
          setProgress(null);
        }, 1500);
        return;
      }

      const board = blankBoardMap(size);
      onApplyBoardMap(board);

      const pixelsPerTick = Math.max(
        1,
        Math.ceil(events.length / (TARGET_DURATION_MS / TICK_MS))
      );
      // Short logs: one pixel at a time so the time-lapse is visible
      const batchSize = events.length < 50 ? 1 : pixelsPerTick;
      const delayMs = events.length < 50 ? 120 : TICK_MS;

      let i = 0;

      const step = () => {
        if (cancelledRef.current) return;

        const end = Math.min(i + batchSize, events.length);
        for (; i < end; i++) {
          const e = events[i];
          board.set(`${e.x}_${e.y}`, e.color);
        }

        // One React state update per tick
        onApplyBoardMap(new Map(board));
        setProgress(`Replaying ${i} / ${events.length}`);

        if (i < events.length) {
          timerRef.current = window.setTimeout(step, delayMs);
        } else {
          setProgress("Replay complete");
          timerRef.current = window.setTimeout(() => {
            onReplayingChange(false);
            setBusy(false);
            setProgress(null);
          }, 1500);
        }
      };

      // Let the blank board paint for a beat before the first pixels land
      timerRef.current = window.setTimeout(step, 280);
    } catch {
      setProgress("Couldn’t load replay");
      onReplayingChange(false);
      setBusy(false);
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
