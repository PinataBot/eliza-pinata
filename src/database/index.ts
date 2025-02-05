import PostgresDatabaseAdapter from "@elizaos/adapter-postgres";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { elizaLogger } from "@elizaos/core";
import Database from "better-sqlite3";
import path from "path";

export function initializeDatabase(dataDir: string) {
  if (process.env.POSTGRES_URL) {
    elizaLogger.info("Initializing PostgreSQL connection...");
    const db = new PostgresDatabaseAdapter({
        connectionString: process.env.POSTGRES_URL,
        parseInputs: true,
    });

    // Test the connection
    db.init()
        .then(() => {
            elizaLogger.success(
                "Successfully connected to PostgreSQL database"
            );
        })
        .catch((error) => {
            elizaLogger.error("Failed to connect to PostgreSQL:", error);
        });

    return db;
  } else {
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
}
