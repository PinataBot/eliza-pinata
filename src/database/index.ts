import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { elizaLogger } from "@elizaos/core";
import Database from "better-sqlite3";
import path from "path";

export function initializeDatabase(dataDir: string) {
  const filePath =
    process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite");
  elizaLogger.info(`Initializing SQLite database at ${filePath}...`);
  const db = new SqliteDatabaseAdapter(new Database(filePath));

  // Test the connection
  db.init()
    .then(() => {
      elizaLogger.success("Successfully connected to SQLite database");
    })
    .catch((error) => {
      elizaLogger.error("Failed to connect to SQLite:", error);
    });

  return db;
}
