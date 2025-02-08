import {
  elizaLogger,
  IAgentRuntime,
  ICacheManager,
  Memory,
  Provider,
  State,
} from "@elizaos/core";

import NodeCache from "node-cache";
import * as path from "path";
import axios from "axios";
import { CoinsInfo } from "../types";
import { loadWhitelistTokens } from "../../utils/loadWhitelistTokens.ts";
// Provider configuration
const PROVIDER_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
};
const cacheTimeSeconds = 60 * 5;

export class CoinsProvider {
  private cache: NodeCache;
  private cacheKey: string = "sui/coins";

  constructor(private cacheManager: ICacheManager) {
    this.cache = new NodeCache({ stdTTL: cacheTimeSeconds }); // Cache TTL set to 5 minutes
  }

  private async readFromCache<T>(key: string): Promise<T | null> {
    const cached = await this.cacheManager.get<T>(
      path.join(this.cacheKey, key)
    );
    return cached;
  }

  private async writeToCache<T>(key: string, data: T): Promise<void> {
    await this.cacheManager.set(path.join(this.cacheKey, key), data, {
      expires: Date.now() + cacheTimeSeconds * 1000,
    });
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    // Check in-memory cache first
    const cachedData = this.cache.get<T>(key);
    if (cachedData) {
      return cachedData;
    }

    // Check file-based cache
    const fileCachedData = await this.readFromCache<T>(key);
    if (fileCachedData) {
      // Populate in-memory cache
      this.cache.set(key, fileCachedData);
      return fileCachedData;
    }

    return null;
  }

  private async setCachedData<T>(cacheKey: string, data: T): Promise<void> {
    // Set in-memory cache
    this.cache.set(cacheKey, data);

    // Write to file-based cache
    await this.writeToCache(cacheKey, data);
  }

  private async fetchTokensInfoRetry(): Promise<CoinsInfo> {
    let lastError: Error;
    const coinTypes = loadWhitelistTokens();
    for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
      try {
        const url = `https://api.insidex.trade/external/coin-details?coins=${coinTypes.join(
          ","
        )}`;
        // uncomment for see full url in console
        elizaLogger.info(`Fetching coins info ${url}`);
        const response = await axios.get(url);

        const coinsInfo = response.data;
        coinsInfo.forEach((coin) => {
          if (coin?.coinMetadata?.iconUrl) {
            coin.coinMetadata.iconUrl = "";
          }
        });

        return coinsInfo;
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
        lastError = error;
        if (i < PROVIDER_CONFIG.MAX_RETRIES - 1) {
          const delay = PROVIDER_CONFIG.RETRY_DELAY * Math.pow(2, i);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    console.error("All attempts failed. Throwing the last error:", lastError);
    throw lastError;
  }

  async fetchTokensInfo(): Promise<CoinsInfo> {
    try {
      // const cacheKey = `tokens-${Date.now()}`;

      const date = new Date();
      const roundedMinutes = Math.floor(date.getMinutes() / 5) * 5;
      const cacheKey = `tokens-${date.getFullYear()}-${
        date.getMonth() + 1
      }-${date.getDate()}-${date.getHours()}-${roundedMinutes}`;

      const cachedValue = await this.getCachedData<CoinsInfo>(cacheKey);

      if (cachedValue) {
        console.log("Cache hit for fetchTokensInfo");
        return cachedValue;
      }
      console.log("Cache miss for fetchTokensInfo");

      const coinsInfo = await this.fetchTokensInfoRetry().catch((error) => {
        console.error("Error fetching tokens info:", error);
        throw error;
      });

      this.setCachedData(cacheKey, coinsInfo);
      console.log("Fetched coins info length:", coinsInfo.length);
      return coinsInfo;
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      throw error;
    }
  }

  formatCoinsInfo(runtime, coinsInfo: CoinsInfo): string {
    let output = `${runtime.character.name}\n`;
    output += `Coins Information:\n`;
    output += `Total Coins: ${coinsInfo.length}\n`;

    for (const coin of coinsInfo) {
      output += `Coin name: ${coin.coinMetadata.name}\n`;
      output += `Coin type: ${coin.coinMetadata.coinType}\n`;
      output += `Coin symbol: ${coin.coinMetadata.symbol}\n`;

      output += `Market Cap: ${coin.marketCap}\n`;
      output += "-----------------------------------\n";
    }

    // !!! comment for testing
    //console.log(output);
    return output;
  }

  async getCoinsInfo(runtime): Promise<string> {
    try {
      const coinsInfo = await this.fetchTokensInfo();
      return this.formatCoinsInfo(runtime, coinsInfo);
    } catch (error) {
      console.error("Error generating portfolio report:", error);
      return "Unable to fetch wallet information. Please try again later.";
    }
  }
}

const coinsProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string | null> => {
    try {
      const provider = new CoinsProvider(runtime.cacheManager);
      return await provider.getCoinsInfo(runtime);
    } catch (error) {
      console.error("Error in tokens provider:", error);
      return null;
    }
  },
};

// Module exports
export { coinsProvider };
