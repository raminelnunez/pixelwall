import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { socketUrl } from "../config";
import { getVisitorId } from "../visitorId";
import type {
  BoardPayload,
  PaintRejectedPayload,
  PixelUpdatedPayload,
} from "../types";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

function emptyWhiteBoard(size: number): Map<string, string> {
  const map = new Map<string, string>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      map.set(`${x}_${y}`, "#ffffff");
    }
  }
  return map;
}

export function usePixelSocket() {
  const socketRef = useRef<Socket | null>(null);
  const cooldownMsRef = useRef(10_000);
  const replayingRef = useRef(false);
  /** Always-current live board (updated even during replay). */
  const livePixelsRef = useRef<Map<string, string>>(new Map());

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [pixels, setPixels] = useState<Map<string, string>>(new Map());
  const [gridSize, setGridSize] = useState(50);
  const [cooldownMs, setCooldownMs] = useState(10_000);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [wakingUp, setWakingUp] = useState(false);
  const [replaying, setReplayingState] = useState(false);

  useEffect(() => {
    const visitorId = getVisitorId();
    const connectStarted = Date.now();

    const wakeTimer = window.setTimeout(() => {
      setWakingUp(true);
    }, 2500);

    const socket = io(socketUrl(), {
      auth: { visitorId },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 45_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      window.clearTimeout(wakeTimer);
      setWakingUp(false);
      setStatus("connected");
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setStatus("error");
      if (Date.now() - connectStarted > 2500) {
        setWakingUp(true);
      }
    });

    socket.on("board", (payload: BoardPayload) => {
      const map = new Map<string, string>();
      for (const p of payload.pixels) {
        map.set(`${p.x}_${p.y}`, p.color);
      }
      livePixelsRef.current = map;
      setGridSize(payload.gridSize);
      setCooldownMs(payload.cooldownMs);
      cooldownMsRef.current = payload.cooldownMs;
      setStatus("connected");
      setWakingUp(false);
      window.clearTimeout(wakeTimer);
      // Don't clobber an in-progress time-lapse
      if (!replayingRef.current) {
        setPixels(new Map(map));
      }
    });

    socket.on("pixelUpdated", (payload: PixelUpdatedPayload) => {
      livePixelsRef.current = new Map(livePixelsRef.current).set(
        `${payload.x}_${payload.y}`,
        payload.color
      );
      if (replayingRef.current) return;
      setPixels((prev) => {
        const next = new Map(prev);
        next.set(`${payload.x}_${payload.y}`, payload.color);
        return next;
      });
    });

    socket.on("paintRejected", (payload: PaintRejectedPayload) => {
      if (payload.reason === "cooldown") {
        const wait = payload.retryAfterMs ?? cooldownMsRef.current;
        setCooldownUntil(Date.now() + wait);
        setRejectMessage(`Cooldown — wait ${(wait / 1000).toFixed(1)}s`);
      } else if (payload.reason === "bounds") {
        setCooldownUntil(null);
        setRejectMessage("Out of bounds");
      } else if (payload.reason === "color") {
        setCooldownUntil(null);
        setRejectMessage("Invalid color");
      } else {
        setCooldownUntil(null);
        setRejectMessage("Paint failed — try again");
      }
    });

    return () => {
      window.clearTimeout(wakeTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function paint(x: number, y: number, color: string) {
    if (replayingRef.current) return;
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const wait = cooldownUntil - Date.now();
      setRejectMessage(`Cooldown — wait ${(wait / 1000).toFixed(1)}s`);
      return;
    }
    setRejectMessage(null);
    setCooldownUntil(Date.now() + cooldownMsRef.current);
    socketRef.current?.emit("paint", { x, y, color });
  }

  function applyBoardMap(map: Map<string, string>) {
    setPixels(new Map(map));
  }

  function setReplaying(active: boolean) {
    replayingRef.current = active;
    setReplayingState(active);
    if (!active) {
      // Jump back to the true live board (includes paints that happened during replay)
      setPixels(new Map(livePixelsRef.current));
    }
  }

  function blankBoardMap(size: number): Map<string, string> {
    return emptyWhiteBoard(size);
  }

  return {
    status,
    pixels,
    gridSize,
    cooldownMs,
    cooldownUntil,
    rejectMessage,
    setRejectMessage,
    wakingUp,
    replaying,
    setReplaying,
    paint,
    applyBoardMap,
    blankBoardMap,
  };
}
