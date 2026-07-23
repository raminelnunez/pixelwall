import "dotenv/config";
import { connectMongo, closeMongo, pixelsCollection } from "./db.js";
import type { Pixel } from "./types.js";

const DEFAULT_COLOR = "#ffffff";

export async function seedPixels(gridSize: number): Promise<{ seeded: boolean; count: number }> {
  const col = pixelsCollection();
  const existing = await col.estimatedDocumentCount();

  if (existing > 0) {
    return { seeded: false, count: existing };
  }

  const now = new Date();
  const docs: Pixel[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      docs.push({
        _id: `${x}_${y}`,
        x,
        y,
        color: DEFAULT_COLOR,
        updatedBy: "system",
        updatedAt: now,
      });
    }
  }

  const batchSize = 500;
  for (let i = 0; i < docs.length; i += batchSize) {
    await col.insertMany(docs.slice(i, i + batchSize), { ordered: false });
  }

  return { seeded: true, count: docs.length };
}

async function runCli() {
  const uri = process.env.MONGODB_URI;
  const gridSize = Number(process.env.GRID_SIZE ?? 50);
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  try {
    await connectMongo(uri);
    const result = await seedPixels(gridSize);
    if (result.seeded) {
      console.log(`Seeded ${result.count} pixels`);
    } else {
      console.log(`Already seeded (${result.count} docs)`);
    }
  } finally {
    await closeMongo();
  }
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("seed.ts") || entry.endsWith("seed.js")) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
