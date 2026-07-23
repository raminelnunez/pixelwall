/**
 * Dev check for Mongo URI resolution.
 *
 * - Asserts placeholder Atlas strings are rejected (intentional fixture — not production config)
 * - Then resolves process.env.MONGODB_URI the same way the server does
 *
 * Run: npx tsx scripts/check-mongo-uri.ts
 */
import {
  resolveMongoUri,
  connectMongo,
  closeMongo,
  isPlaceholderMongoUri,
} from "../src/db.js";
import { seedPixels } from "../src/seed.js";

/** Deliberate bad URI — must match the .env.example placeholders so we catch copy-paste mistakes. */
const PLACEHOLDER_FIXTURE =
  "mongodb+srv://USER:PASS@CLUSTER.mongodb.net/pixelwall";

async function main() {
  if (!isPlaceholderMongoUri(PLACEHOLDER_FIXTURE)) {
    console.error("FAIL: fixture is no longer detected as a placeholder");
    process.exit(1);
  }

  try {
    await resolveMongoUri(PLACEHOLDER_FIXTURE);
    console.error("FAIL: resolveMongoUri should reject placeholder fixtures");
    process.exit(1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("placeholder")) {
      console.error("FAIL: expected placeholder error, got:", message);
      process.exit(1);
    }
    console.log("placeholder rejection OK");
  }

  // Same path as server/src/index.ts — reads MONGODB_URI from env / server/.env
  const uri = await resolveMongoUri(process.env.MONGODB_URI);
  await connectMongo(uri);
  const result = await seedPixels(10);
  console.log("env URI seed OK", result);
  await closeMongo();
  console.log("check-mongo-uri passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
