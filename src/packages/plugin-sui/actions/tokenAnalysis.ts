import {
  type Action,
  elizaLogger,
  generateText,
  ModelClass,
  parseJSONObjectFromText,
  State,
  composeContext,
  IAgentRuntime,
  Memory,
  generateObject,
  Content,
} from "@elizaos/core";
import { z } from "zod";
import { fetchTokenData } from "../utils/fetchTokensData.ts";
import { putBlob, putBlobAndSave } from "../utils/walrus.ts";
import { SupabaseDatabaseAdapter } from "../../adapter-supabase/src";
import { loadWhitelistTokens } from "../utils/loadWhitelistTokens.ts";
import { walletProvider } from "../providers/wallet.ts";

interface CoinTypeTypes extends Content {
  coinType: any;
}

// Compose the prompt to analyze the token data
const analysisPrompt = (marketData: any, portfolioData: any): string => `
Analyze the following token data and provide a trading recommendation under a long-term investment perspective. As a long-term investor, consider market trends, risk management, and overall portfolio health.

1. **Data Analysis:**
   - Evaluate both the market data and the portfolio data thoroughly.
   - Identify the best token to trade, considering both short-term market trends and long-term growth potential.
   - Diversification is important; be mindful of not overexposing the portfolio to one token unless a BUY decision is strongly supported by analysis.

2. **Decision Making:**
   - **HOLD Recommendation:**
     - If the portfolio already holds a sufficient balance of the recommended token or if buying/selling does not offer a clear advantage, recommend HOLD.
   - **BUY Recommendation:**
     - Always use SUI as the purchasing asset.
     - Check the available SUI balance in the portfolio.
     - **If a BUY is recommended, don't invest nearly the entire available SUI balance, reserving approximately 0.1 SUI for transaction fees.**
     - IMPORTANT: Don't invest nearly the entire available SUI balance, reserving approximately 0.1 SUI for transaction fees and do not invest more than 10%-20% of the available SUI balance.
     - The recommended amount should be calculated based on the available SUI balance and the long-term potential of the token.
     - Check portfolio data context to ensure the recommendation is feasible.
   - **SELL Recommendation:**
     - If market conditions suggest reducing exposure, recommend SELL and specify the amount of tokens to sell.
   - Always apply prudent portfolio and risk management principles to maintain a balanced long-term strategy.

3. **Output Format:**
   - Return your response as a JSON object with the following structure:
     \`\`\`json
     {
       "tokenName": "<string>",
       "coinType": "<string>",  // For BUY recommendations, fromCoinType must be "0x2::sui::SUI"
       "recommendation": "BUY" | "SELL" | "HOLD",
       "amount": <number>,  // For BUY: the SUI amount to be spent, always check BUY context to ensure the recommendation is feasible; for SELL: the token amount to sell; for HOLD: 0.
       "confidence": <number between 0 and 100>,
       "reasoning": "<string>",
       "risks": ["<string>", "..."],
       "opportunities": ["<string>", "..."],
       "nextAction": {
         "action": "BUY" | "SELL" | "HOLD",
         "fromCoinType": "<string>",
         "toCoinType": "<string>",
         "amount": <number>,
         "reasoning": "<string>"
       }
     }
     \`\`\`

4. **Context:**
   - **Portfolio data:** ${portfolioData}
   - **Tokens data:** ${marketData}

Based on your analysis of the market and the given portfolio data, provide a trading recommendation that aligns with a long-term investment strategy. If a BUY decision is made, the recommended amount should utilize nearly all available SUI (after reserving ~0.1 SUI for transaction fees).
`;

export default {
  name: "ANALYZE_TRADE",
  similes: ["ANALYZE", "ANALYZE_TOKEN", "TRADE", "ANALYZE_TRADE", "ASSESS"],
  description: "Analyze a token for trading opportunities",
  examples: [],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    elizaLogger.info("Validating ANALYZE_TRADE for agent:", message.agentId);
    return true;
  },
  handler: async (runtime, message, state, params, callback) => {
    try {
      elizaLogger.log("Starting ANALYZE_TRADE handler...");
      const walletInfo = await walletProvider.get(runtime, message, state);
      state.walletInfo = walletInfo;
      // Initialize or update state
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      } else {
        state = await runtime.updateRecentMessageState(state);
      }

      const whilelistTokens = await loadWhitelistTokens();
      if (!whilelistTokens) {
        throw new Error("Can't fetch coin type");
      }
      // TODO:: check if the coinType is valid
      const tokenData = await fetchTokenData(whilelistTokens.join(","));
      //console.log("Token Data", tokenData);

      const analysisContext = composeContext({
        state,
        template: analysisPrompt(JSON.stringify(tokenData), walletInfo),
      });

      // console.log(
      //   "Analysis Prompt",
      //   analysisPrompt(JSON.stringify(tokenData), walletInfo)
      // );
      // console.log("Analysis Context", analysisContext);

      // Generate analysis using the prompt
      const analysisResult = await generateText({
        runtime,
        context: analysisContext,
        modelClass: ModelClass.LARGE,
      });

      if (!analysisResult) {
        throw new Error("Failed to generate analysis.");
      }

      elizaLogger.debug("Raw analysis response:", analysisResult);
      putBlobAndSave(runtime, analysisResult, "response").then(() => {
        console.log("Blob saved");
      });
      // Parse the analysis response
      const tradeRecommendation = parseJSONObjectFromText(analysisResult);
      elizaLogger.info(
        `Parsed recommendation for token ${
          tradeRecommendation.coinType || "unknown"
        }:`,
        tradeRecommendation
      );

      if (callback) {
        await callback({
          text: JSON.stringify(tradeRecommendation),
          type: "analysis",
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("ANALYZE_TRADE handler error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  },
} as Action;
