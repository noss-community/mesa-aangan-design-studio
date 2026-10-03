// One-shot schema migration runner. Uses `pg` (not the Neon serverless driver) because it can
// execute a whole multi-statement .sql file over a normal TCP connection, which is what Neon
// exposes in addition to its HTTP endpoint.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local or your shell environment.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "schema.sql");
const schema = readFileSync(schemaPath, "utf8");

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  console.log("Connected to Neon. Applying db/schema.sql ...");
  await client.query(schema);
  console.log("Schema applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
