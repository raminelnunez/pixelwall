import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MongoClient, Db, Collection } from "mongodb";
import type { Pixel, PaintLogEntry } from "./types.js";

// Always load server/.env regardless of process cwd (root `npm run dev` vs --prefix)
const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(serverRoot, ".env") });

let client: MongoClient | null = null;
let db: Db | null = null;
let memoryServer: { stop: () => Promise<boolean> } | null = null;

const PLACEHOLDER_HINTS = ["CLUSTER.mongodb.net", "USER:PASS@", "<username>", "<password>", "xxxx"];

export function isPlaceholderMongoUri(uri: string): boolean {
  return PLACEHOLDER_HINTS.some((hint) => uri.includes(hint));
}

/**
 * Resolve MONGODB_URI:
 * - `memory` → ephemeral in-memory Mongo (great for local play, data resets on restart)
 * - otherwise a real mongodb:// or mongodb+srv:// URI
 */
export async function resolveMongoUri(raw: string | undefined): Promise<string> {
  if (!raw || !raw.trim()) {
    throw new Error(
      [
        "Missing MONGODB_URI.",
        "  1. Copy .env.example → server/.env",
        "  2. Set MONGODB_URI=memory          (local, no Atlas needed)",
        "  or MONGODB_URI=mongodb+srv://...   (Atlas connection string)",
      ].join("\n")
    );
  }

  const uri = raw.trim();

  if (uri === "memory" || uri === "mongodb-memory") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    memoryServer = mongod;
    const memUri = mongod.getUri("pixelwall");
    console.log("Using in-memory MongoDB (MONGODB_URI=memory) — data resets when the server stops");
    return memUri;
  }

  if (isPlaceholderMongoUri(uri)) {
    throw new Error(
      [
        "MONGODB_URI still has placeholder values (e.g. USER / PASS / CLUSTER).",
        "That hostname is not a real Atlas cluster — DNS lookup fails with ENOTFOUND.",
        "",
        "Fix one of these:",
        "  • Local (easiest):  set MONGODB_URI=memory in server/.env",
        "  • Atlas:            Atlas → Connect → Drivers → copy the real mongodb+srv:// string",
        "                      Replace <password>, keep your cluster host (e.g. cluster0.abc12.mongodb.net)",
      ].join("\n")
    );
  }

  return uri;
}

function looksLikeAtlasNetworkAccessError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("SSL alert number 80") ||
    message.includes("tlsv1 alert internal error") ||
    message.includes("ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR")
  );
}

export async function connectMongo(uri: string): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri);
  try {
    await client.connect();
  } catch (err) {
    if (looksLikeAtlasNetworkAccessError(err)) {
      console.error(
        [
          "",
          "Mongo connection failed with a TLS handshake error (SSL alert 80).",
          "This almost always means Atlas is rejecting your host's IP, not a real TLS bug.",
          "",
          "Fix: Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)",
          "(Hosts like Render/Railway/Fly don't have a fixed IP on free tiers.)",
          "",
        ].join("\n")
      );
    }
    throw err;
  }
  db = client.db();
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectMongo() first.");
  }
  return db;
}

export function pixelsCollection(): Collection<Pixel> {
  return getDb().collection<Pixel>("pixels");
}

export function paintLogCollection(): Collection<PaintLogEntry> {
  return getDb().collection<PaintLogEntry>("paintLog");
}

export async function ensureIndexes(): Promise<void> {
  await paintLogCollection().createIndex({ timestamp: 1 });
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
