/**
 * Smoke test: spin up in-memory Mongo, start the paint logic paths, verify seed + paint + stats.
 * Run: npx tsx scripts/smoke.ts
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { io as ioClient } from "socket.io-client";

async function wait(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("pixelwall");
  process.env.MONGODB_URI = uri;
  process.env.PORT = "3099";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.GRID_SIZE = "50";
  process.env.COOLDOWN_MS = "10000";

  // Dynamic import after env is set
  await import("../src/index.js");
  await wait(1500);

  const health = await fetch("http://127.0.0.1:3099/health");
  if (!health.ok) throw new Error("health failed");
  console.log("health ok", await health.json());

  const boardPromise = new Promise<void>((resolve, reject) => {
    const socket = ioClient("http://127.0.0.1:3099", {
      auth: { visitorId: "anon-smoke" },
      transports: ["websocket"],
    });
    const timer = setTimeout(() => reject(new Error("board timeout")), 8000);
    socket.on("board", (payload: { pixels: unknown[]; gridSize: number }) => {
      clearTimeout(timer);
      console.log(`board received: ${payload.pixels.length} pixels, size ${payload.gridSize}`);
      if (payload.pixels.length !== 2500) {
        reject(new Error(`expected 2500 pixels, got ${payload.pixels.length}`));
        return;
      }
      socket.emit("paint", { x: 1, y: 2, color: "#ff6b35" });
    });
    socket.on("pixelUpdated", async (p: { x: number; y: number; color: string }) => {
      console.log("pixelUpdated", p);
      const stats = await fetch("http://127.0.0.1:3099/stats").then((r) => r.json());
      console.log("stats", stats);
      const replay = await fetch("http://127.0.0.1:3099/replay").then((r) => r.json());
      console.log("replay events", replay.events.length);

      // cooldown reject
      socket.emit("paint", { x: 3, y: 4, color: "#3b82f6" });
      socket.on("paintRejected", (rej) => {
        console.log("paintRejected (expected cooldown)", rej);
        socket.close();
        resolve();
      });
    });
    socket.on("connect_error", reject);
  });

  await boardPromise;

  // Verify mongo docs
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const pixel = await db.collection("pixels").findOne({ _id: "1_2" as unknown as string });
  console.log("pixel doc", pixel);
  await client.close();
  await mongod.stop();
  console.log("SMOKE OK");
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE FAIL", err);
  process.exit(1);
});
