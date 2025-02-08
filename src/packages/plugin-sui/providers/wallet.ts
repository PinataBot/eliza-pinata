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

import { MIST_PER_SUI, SUI_TYPE_ARG } from "@mysten/sui/utils";
import BigNumber from "bignumber.js";
import NodeCache from "node-cache";
import * as path from "path";
import { parseAccount, SuiNetwork } from "../utils.ts";
import axios from "axios";
import { loadWhitelistTokens } from "../utils/loadWhitelistTokens.ts";
import { fetchTokenData } from "../utils/fetchTokensData.ts";
// Provider configuration
const PROVIDER_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
};

interface WalletPortfolio {
  totalUsd: string;
  totalSui: string;
  tokens: Array<{
    usd: string;
    symbol: string;
    coinType: string;
    totalBalance: string;
  }>;
}

interface Prices {
  sui: { usd: string; symbol: string; coinType: string };
  tokens?: Array<{
    usd: string;
    symbol: string;
    coinType: string;
    totalBalance: string;
  }>;
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

  // This function retrieves all token balances, removes any token with a totalBalance of "0",
  // excludes the SUI token, and only returns tokens that are in the whitelist.
  private async getFilteredWalletTokens(): Promise<
    { coinType: string; totalBalance: string }[]
  > {
    // Retrieve all wallet token balances
    const allTokens = await this.suiClient.getAllBalances({
      owner: this.address,
    });

    // Load the whitelist tokens
    const whitelist = await this.loadingWhitelistTokens();

    // Filter tokens: remove tokens with zero balance, exclude SUI type,
    // and ensure the token is present in the whitelist.
    return allTokens
      .filter((token: any) => {
        if (token.totalBalance === "0") return false; // Skip if balance is zero.
        if (token.coinType === "0x2::sui::SUI") return false; // Skip SUI tokens.
        return whitelist.includes(token.coinType); // Only include if whitelisted.
      })
      .map((token: any) => ({
        coinType: token.coinType,
        totalBalance: token.totalBalance,
      }));
  }

  private async fetchPortfolioPricesWithRetry(isSui: boolean) {
    let lastError: Error;

    for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
      try {
        if (isSui) {
          const cetusSuiUsdcPoolAddr =
            "0x51e883ba7c0b566a26cbc8a94cd33eb0abd418a77cc1e60ad22fd9b1f29cd2ab";
          const url = `https://api.dexscreener.com/latest/dex/pairs/sui/${cetusSuiUsdcPoolAddr}`;
          elizaLogger.info(`Fetching SUI price from ${url}`);
          const response = await axios.get(url);
          return response.data;
        }
        // need to figureout how to fetch sui price with insidex
        const coinTypes = await this.loadingWhitelistTokens();
        const response = await fetchTokenData(coinTypes.join(","));
        console.log("Response:", response);
        return response;
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

      const prices = await this.fetchPrices().catch((error) => {
        console.error("Error fetching SUI price:", error);
        throw error;
      });

      const totalUsd = new BigNumber(suiAmount).times(prices.sui.usd);

      const portfolio = {
        totalUsd: totalUsd.toString(),
        totalSui: suiAmount.toString(),
        tokens: prices.tokens,
      };
      this.setCachedData(cacheKey, portfolio);
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

      if (cachedValue) {
        console.log("Cache hit for fetchPrices");
        return cachedValue;
      }
      console.log("Cache miss for fetchPrices");
      // Fetch SUI price using the dexscreener API
      const suiPriceData = await this.fetchPortfolioPricesWithRetry(true).catch(
        (error) => {
          console.error("Error fetching SUI price:", error);
          throw error;
        }
      );
      const suiUsdPrice = (1 / suiPriceData.pair.priceNative).toString();

      // Get non-SUI tokens from the wallet that are also in the whitelist.
      const filteredTokens = await this.getFilteredWalletTokens();
      let tokensPrices: Array<{
        coinType: string;
        usd: string;
        symbol: string;
        totalBalance: string;
      }> = [];

      if (filteredTokens.length > 0) {
        // Create a comma-separated query string from the filtered token coin types.
        const coinTypesQuery = filteredTokens
          .map((token) => token.coinType)
          .join(",");

        const response = await fetchTokenData(coinTypesQuery);
        //elizaLogger.info(`Fetching token prices from ${response}`);

        // Map the response to an array of pricing information.
        // Adjust the mapping based on the actual structure returned by the API.
        tokensPrices = response
          .map((tokenData: any) => {
            // Find the matching token from the filtered tokens array
            const filteredToken = filteredTokens.find(
              (token) => token.coinType === tokenData.coinMetadata.coinType
            );
            if (!filteredToken) return null; // Skip if no matching token is found

            // Get decimals from the token metadata
            const decimals = tokenData.coinMetadata.decimals;
            // Compute the factor (10^decimals)
            const factor = new BigNumber(10).pow(decimals);
            // Convert the raw balance into a true human-readable balance
            const trueBalance = new BigNumber(
              filteredToken.totalBalance
            ).dividedBy(factor);

            // Use coinPrice from tokenData. If missing, default to 0.
            const coinPrice = tokenData.coinPrice
              ? new BigNumber(tokenData.coinPrice)
              : new BigNumber(0);
            // Compute the total USD value for this token by multiplying the true balance by the coinPrice
            const totalUsdValue = trueBalance.multipliedBy(coinPrice);

            return {
              symbol: tokenData.coinMetadata.symbol,
              coinType: tokenData.coinMetadata.coinType,
              usd: totalUsdValue.toString(), // The USD value as a string
              totalBalance: trueBalance.toString(),
            };
          })
          .filter((token) => token !== null); // Filter out any null entries
      }
      //   console.log("---------->tokensPrices", tokensPrices);
      const prices: Prices = {
        sui: { usd: suiUsdPrice, symbol: "SUI", coinType: SUI_TYPE_ARG },
        tokens: tokensPrices,
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

    output += `Sui value: $${totalUsdFormatted} (${totalSuiFormatted} SUI)\n`;

    // Calculate total token value
    let totalTokenValue = new BigNumber(0);

    // If there are token details, append them to the output.
    if (portfolio.tokens && portfolio.tokens.length > 0) {
      output += "Tokens:\n";
      portfolio.tokens.forEach((token) => {
        const tokenUsdFormatted = new BigNumber(token.usd).toFixed(2);
        output += `- ${token.symbol}(${token.totalBalance}): $${tokenUsdFormatted}\n`;
        totalTokenValue = totalTokenValue.plus(new BigNumber(token.usd));
      });
    }

    // Calculate and append total portfolio value
    const totalPortfolioValue = new BigNumber(portfolio.totalUsd).plus(
      totalTokenValue
    );
    output += `\nTotal Portfolio Value: $${totalPortfolioValue.toFixed(2)}\n`;
    output += `Total SUI Value: $${totalUsdFormatted}\n`;
    output += `Total Token Value: $${totalTokenValue.toFixed(2)}\n`;

    console.log("Portfolio:", output);
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
