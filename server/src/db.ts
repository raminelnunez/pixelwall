import { MongoClient, Db, Collection } from "mongodb";
import type { Pixel, PaintLogEntry } from "./types.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(uri: string): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
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
}
