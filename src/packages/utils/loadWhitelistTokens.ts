import fs from "fs";
import path from "path";
import { elizaLogger } from "@elizaos/core";

/**
 * Loads whitelisted token addresses from a JSON file
 * The file should be located at ./whitelist_cointypes.json
 * relative to the current working directory
 *
 * @returns Array of token addresses as strings
 * @throws Error if file not found or invalid JSON
 */
export function loadWhitelistTokens(): string[] {
  try {
    const dataDir = path.join(process.cwd(), "src/packages/utils");
    const filePath = path.join(dataDir, "whitelist_cointypes.json");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const data = fs.readFileSync(filePath, "utf8");
    const addresses = JSON.parse(data);

    elizaLogger.debug("Loaded whitelist:", addresses);

    return addresses;
  } catch (error) {
    elizaLogger.error("Failed to load whitelist:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error("Whitelist Cointypes file not found or invalid");
  }
}
