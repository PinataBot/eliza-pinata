import PostgresDatabaseAdapter from "@elizaos/adapter-postgres";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { elizaLogger } from "@elizaos/core";
import Database from "better-sqlite3";
import path from "path";
import { SupabaseDatabaseAdapter } from "../packages/adapter-supabase/src/index.ts";

export function initializeDatabase(dataDir: string) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    elizaLogger.info("Initializing Supabase connection...");
    const db = new SupabaseDatabaseAdapter(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test the connection
    db.init()
      .then(() => {
        elizaLogger.success("Successfully connected to Supabase database");
      })
      .catch((error) => {
        elizaLogger.error("Failed to connect to Supabase:", error);
      });

    return db;
  } else if (process.env.POSTGRES_URL) {
    elizaLogger.info("Initializing PostgreSQL connection...");
    const db = new PostgresDatabaseAdapter({
      connectionString: process.env.POSTGRES_URL,
      parseInputs: true,
    });

    // Test the connection
    db.init()
      .then(() => {
        elizaLogger.success("Successfully connected to PostgreSQL database");
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
