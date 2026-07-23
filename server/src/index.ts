import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { connectMongo, ensureIndexes, paintLogCollection, pixelsCollection } from "./db.js";
import { seedPixels } from "./seed.js";
import {
  HEX_COLOR_RE,
  type PaintPayload,
  type PaintRejectedPayload,
  type PixelUpdatedPayload,
} from "./types.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const GRID_SIZE = Number(process.env.GRID_SIZE ?? 50);
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 10_000);
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI. Copy .env.example to server/.env");
  process.exit(1);
}
const mongoUri: string = MONGODB_URI;

/** visitorId (or socket id) → last successful paint time */
const lastPaintByVisitor = new Map<string, number>();

function isInBounds(x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < GRID_SIZE &&
    y < GRID_SIZE
  );
}

async function main() {
  await connectMongo(mongoUri);
  await ensureIndexes();

  const seedResult = await seedPixels(GRID_SIZE);
  if (seedResult.seeded) {
    console.log(`Seeded ${seedResult.count} white pixels (${GRID_SIZE}×${GRID_SIZE})`);
  } else {
    console.log(`Pixels collection already has ${seedResult.count} docs — skip seed`);
  }

  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, gridSize: GRID_SIZE, cooldownMs: COOLDOWN_MS });
  });

  /** Full paint history for time-lapse replay */
  app.get("/replay", async (_req, res) => {
    try {
      const events = await paintLogCollection()
        .find({}, { projection: { _id: 0 } })
        .sort({ timestamp: 1 })
        .toArray();
      res.json({ events, gridSize: GRID_SIZE });
    } catch (err) {
      console.error("GET /replay failed:", err);
      res.status(500).json({ error: "Failed to load replay" });
    }
  });

  /** Pixels painted in the last 24 hours */
  app.get("/stats", async (_req, res) => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const paintedToday = await paintLogCollection().countDocuments({
        timestamp: { $gte: since },
      });
      res.json({ paintedToday, since: since.toISOString() });
    } catch (err) {
      console.error("GET /stats failed:", err);
      res.status(500).json({ error: "Failed to load stats" });
    }
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: CLIENT_ORIGIN },
    // Help cold-start / flaky free-tier hosts
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  io.on("connection", async (socket) => {
    const visitorId =
      typeof socket.handshake.auth?.visitorId === "string" &&
      socket.handshake.auth.visitorId.length > 0
        ? socket.handshake.auth.visitorId.slice(0, 64)
        : socket.id;

    try {
      const board = await pixelsCollection()
        .find({}, { projection: { _id: 0, x: 1, y: 1, color: 1, updatedBy: 1 } })
        .toArray();
      socket.emit("board", { pixels: board, gridSize: GRID_SIZE, cooldownMs: COOLDOWN_MS });
    } catch (err) {
      console.error("Failed to send board:", err);
      socket.emit("error", { message: "Failed to load board" });
    }

    socket.on("paint", async (payload: PaintPayload) => {
      const { x, y, color } = payload ?? {};

      if (!isInBounds(x, y)) {
        const rejection: PaintRejectedPayload = { reason: "bounds" };
        socket.emit("paintRejected", rejection);
        return;
      }

      if (typeof color !== "string" || !HEX_COLOR_RE.test(color)) {
        const rejection: PaintRejectedPayload = { reason: "color" };
        socket.emit("paintRejected", rejection);
        return;
      }

      const now = Date.now();
      const last = lastPaintByVisitor.get(visitorId) ?? 0;
      const elapsed = now - last;
      if (elapsed < COOLDOWN_MS) {
        const rejection: PaintRejectedPayload = {
          reason: "cooldown",
          retryAfterMs: COOLDOWN_MS - elapsed,
        };
        socket.emit("paintRejected", rejection);
        return;
      }

      const updatedAt = new Date(now);
      const pixelId = `${x}_${y}`;

      try {
        await pixelsCollection().updateOne(
          { _id: pixelId },
          {
            $set: {
              x,
              y,
              color: color.toLowerCase(),
              updatedBy: visitorId,
              updatedAt,
            },
          },
          { upsert: true }
        );

        await paintLogCollection().insertOne({
          x,
          y,
          color: color.toLowerCase(),
          updatedBy: visitorId,
          timestamp: updatedAt,
        });

        lastPaintByVisitor.set(visitorId, now);

        const update: PixelUpdatedPayload = {
          x,
          y,
          color: color.toLowerCase(),
          updatedBy: visitorId,
        };
        io.emit("pixelUpdated", update);
      } catch (err) {
        console.error("paint failed:", err);
        const rejection: PaintRejectedPayload = { reason: "server" };
        socket.emit("paintRejected", rejection);
      }
    });

    socket.on("disconnect", () => {
      // Keep cooldown entries briefly; Map stays small on free tier.
      // Optional prune: leave for process lifetime.
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Pixel Wall server listening on :${PORT}`);
    console.log(`  CORS origin: ${CLIENT_ORIGIN}`);
    console.log(`  Grid: ${GRID_SIZE}×${GRID_SIZE}, cooldown: ${COOLDOWN_MS}ms`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
