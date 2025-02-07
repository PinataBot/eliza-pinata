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
} from "@elizaos/core";

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

      // Initialize or update state
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      } else {
        state = await runtime.updateRecentMessageState(state);
      }

      // Map incoming params into token metrics format
      const tokenMetrics = {
        walletBalance: params.walletBalance,
        coinType: params.coinType,
        currentPrice: params.price,
        tradingVolume: params.volume,
        marketCapitalization: params.marketCap,
        poolLiquidity: params.liquidity,
        investorDistribution: params.holderDistribution,
        securityScore: params.trustScore,
        dexMetrics: params.dexscreener,
        currentPosition: params.position,
      };

      // Compose the prompt to analyze the token data
      const analysisPrompt = `Analyze the following token data and provide a trading recommendation.
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

Token Data:
${JSON.stringify(tokenMetrics, null, 2)}`;

      const analysisContext = composeContext({
        state,
        template: analysisPrompt,
      });

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

      // Parse the analysis response
      const tradeRecommendation = parseJSONObjectFromText(analysisResult);
      elizaLogger.info(
        `Parsed recommendation for token ${params.tokenAddress || "unknown"}:`,
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
