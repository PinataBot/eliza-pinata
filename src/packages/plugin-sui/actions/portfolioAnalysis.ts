import {
  type Action,
  elizaLogger,
  generateText,
  generateObject,
  ModelClass,
  State,
  composeContext,
  IAgentRuntime,
  Memory,
  HandlerCallback,
  Content,
  ServiceType,
} from "@elizaos/core";
import { z } from "zod";
import { SuiService } from "../services/sui.ts";
import { fetchTokenData } from "../utils/fetchTokensData.ts";
import { walletProvider } from "../providers/wallet.ts";

interface PorfolioTypes extends Content {
  coinType: any;
}

// Compose the prompt to analyze the token data
const portfolioAnalysisPrompt = (
  walletInfo: any
) => `Analyze portfolio and provide a trading recommendation. Make sure to analyze all the tokens in the portfolio. Make decision based on the tokens data and the market conditions. Decide which tokens to buy, sell or hold. DECIDE ONLY ONE TOKEN YOU SHOULD RECOMMEND.
Analyze the following portfolio data and provide recommendation. What the best strategy right now for the portfolio. 
If you need to sell any token, make sure to explain, and what different tokens you will buy instead. Don't forget you can't sell all SUI coins, because of the transaction fee and you always need to keep Sui around ~0.1 SUI for the transaction fee.
Choose the best token to trade. ONLY ONE TOKEN YOU SHOULD RECOMMEND.
Return the response as a JSON object with the following structure:
{
  "tokenName": string,
  "coinType": string,
  "recommendation": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reasoning": string,
  "risks": string[],
  "opportunities": string[]
}

Current portfolio: ${walletInfo} 
`;

export default {
  name: "PORTFOLIO_ANALYSIS",
  similes: [
    "PORTFOLIO",
    "PORTFOLIO_ANALYSIS",
    "PORTFOLIO_ANALYZE",
    "PORTFOLIO_ASSESS",
  ],
  description: "Analyze your portfolio",
  examples: [],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    elizaLogger.info(
      "Validating PORTFOLIO_ANALYSIS for agent:",
      message.agentId
    );
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    params: any,
    callback?: HandlerCallback
  ) => {
    try {
      elizaLogger.log("Starting PORTFOLIO_ANALYSIS handler...");
      const walletInfo = await walletProvider.get(runtime, message, state);
      state.walletInfo = walletInfo;

      console.log("Wallet Info", walletInfo);
      // Initialize or update state
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      } else {
        state = await runtime.updateRecentMessageState(state);
      }

      // Compose transfer context
      const tokenInfoContext = composeContext({
        state,
        template: portfolioAnalysisPrompt(walletInfo),
      });
      // Execute prompt to extract cointype
      const content = await generateText({
        runtime,
        context: tokenInfoContext,
        modelClass: ModelClass.LARGE,
      });

      console.log("Portfolio Content", content);

      if (!content) {
        throw new Error("Failed to generate analysis.");
      }

      elizaLogger.debug("Raw analysis response:", content);

      if (callback) {
        await callback({
          text: content,
          type: "analysis",
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("PORTFOLIO_ANALYSIS handler error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  },
} as Action;
