import {
  resolveMongoUri,
  connectMongo,
  closeMongo,
} from "../src/db.js";
import { seedPixels } from "../src/seed.js";

async function main() {
  try {
    await resolveMongoUri("mongodb+srv://USER:PASS@CLUSTER.mongodb.net/pixelwall");
    console.error("FAIL: should reject placeholder");
    process.exit(1);
  } catch {
    console.log("placeholder rejected OK");
  }

  const uri = await resolveMongoUri("memory");
  await connectMongo(uri);
  const r = await seedPixels(10);
  console.log("seed", r);
  await closeMongo();
  console.log("memory path OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
