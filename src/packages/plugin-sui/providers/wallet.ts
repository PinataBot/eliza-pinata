import {
  elizaLogger,
  embed,
  getEmbeddingZeroVector,
  IAgentRuntime,
  ICacheManager,
  Memory,
  Provider,
  State,
  UUID,
} from "@elizaos/core";
import { v4 as uuid } from "uuid";

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

import { MIST_PER_SUI } from "@mysten/sui/utils";
import BigNumber from "bignumber.js";
import NodeCache from "node-cache";
import * as path from "path";
import { parseAccount, SuiNetwork } from "../utils.ts";
import axios from "axios";
import { loadWhitelistTokens } from "../../utils/loadWhitelistTokens.ts";
// Provider configuration
const PROVIDER_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
};

interface WalletPortfolio {
  totalUsd: string;
  totalSui: string;
}

interface Prices {
  sui: { usd: string };
}

const cacheTimeSeconds = 30;

export class WalletProvider {
  private cache: NodeCache;
  private cacheKey: string = "sui/wallet";

  constructor(
    private suiClient: SuiClient,
    private address: string,
    private cacheManager: ICacheManager
  ) {
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

  private async fetchPricesWithRetry() {
    let lastError: Error;

    for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
      try {
        // need to figureout how to fetch sui price with insidex
        const coinTypes = await this.loadingWhitelistTokens();
        const url = `https://api.insidex.trade/external/coin-details?coins=${coinTypes.join(
          ","
        )}`;
        elizaLogger.info(`Fetching SUI price from ${url}`);
        const response = await axios.get(url);
        console.log("Response:", response.data);
        return response.data;
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

  async fetchPortfolioValue(): Promise<WalletPortfolio> {
    try {
      const cacheKey = `portfolio-${this.address}`;
      const cachedValue = await this.getCachedData<WalletPortfolio>(cacheKey);

      if (cachedValue) {
        console.log("Cache hit for fetchPortfolioValue", cachedValue);
        return cachedValue;
      }
      console.log("Cache miss for fetchPortfolioValue");

      const prices = await this.fetchPrices().catch((error) => {
        console.error("Error fetching SUI price:", error);
        throw error;
      });
      const suiAmountOnChain = await this.suiClient
        .getBalance({
          owner: this.address,
        })
        .catch((error) => {
          console.error("Error fetching SUI amount:", error);
          throw error;
        });

      const suiAmount =
        Number.parseInt(suiAmountOnChain.totalBalance) / Number(MIST_PER_SUI);
      const totalUsd = new BigNumber(suiAmount).times(prices.sui.usd);

      const portfolio = {
        totalUsd: totalUsd.toString(),
        totalSui: suiAmount.toString(),
      };
      this.setCachedData(cacheKey, portfolio);
      console.log("Fetched portfolio:", portfolio);
      return portfolio;
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      throw error;
    }
  }

  async loadingWhitelistTokens(): Promise<string[]> {
    const cacheKey = `whitelist-tokens-${this.address}`;
    const cachedValue = await this.getCachedData<string[]>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }
    const whitelistTokens = await loadWhitelistTokens();
    this.setCachedData(cacheKey, whitelistTokens);
    return whitelistTokens;
  }

  async fetchPrices(): Promise<Prices> {
    try {
      const cacheKey = "prices";
      const cachedValue = await this.getCachedData<Prices>(cacheKey);
      const whitelistTokens = await this.loadingWhitelistTokens();

      if (cachedValue) {
        console.log("Cache hit for fetchPrices");
        return cachedValue;
      }
      console.log("Cache miss for fetchPrices");
      // TODO:
      // 1. fetch wallet tokens
      // 2. fetch whitelist tokens
      // 3. check if wallet tokens are in whitelist
      // 4. if not, skip loading prices
      // 5. if yes, fetch prices for whitelist tokens
      // 6. return prices in the format of Prices interface
      const suiPriceData = await this.fetchPricesWithRetry().catch((error) => {
        console.error("Error fetching SUI price:", error);
        throw error;
      });
      const prices: Prices = {
        sui: { usd: (1 / suiPriceData.pair.priceNative).toString() },
      };
      this.setCachedData(cacheKey, prices);
      return prices;
    } catch (error) {
      console.error("Error fetching prices:", error);
      throw error;
    }
  }

  formatPortfolio(runtime, portfolio: WalletPortfolio): string {
    let output = `${runtime.character.name}\n`;
    output += `Wallet Address: ${this.address}\n`;

    const totalUsdFormatted = new BigNumber(portfolio.totalUsd).toFixed(2);
    const totalSuiFormatted = new BigNumber(portfolio.totalSui).toFixed(4);

    output += `Total Value: $${totalUsdFormatted} (${totalSuiFormatted} SUI)\n`;

    return output;
  }

  async getFormattedPortfolio(runtime): Promise<string> {
    try {
      const portfolio = await this.fetchPortfolioValue();
      return this.formatPortfolio(runtime, portfolio);
    } catch (error) {
      console.error("Error generating portfolio report:", error);
      return "Unable to fetch wallet information. Please try again later.";
    }
  }
}

const walletProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string | null> => {
    const suiAccount = parseAccount(runtime);

    try {
      const suiClient = new SuiClient({
        url: getFullnodeUrl(runtime.getSetting("SUI_NETWORK") as SuiNetwork),
      });
      const provider = new WalletProvider(
        suiClient,
        suiAccount.toSuiAddress(),
        runtime.cacheManager
      );

      // console.log(_message)
      // const mem: Memory = {
      //     id: uuid() as UUID,
      //     ..._message,
      //     content: {
      //         text: "test!!!!!"
      //     },
      // }
      // await runtime.knowledgeManager.addEmbeddingToMemory(
      //     mem
      // )
      // await runtime.knowledgeManager.createMemory(mem)

      return await provider.getFormattedPortfolio(runtime);
    } catch (error) {
      console.error("Error in wallet provider:", error);
      return null;
    }
  },
};

// Module exports
export { walletProvider };
