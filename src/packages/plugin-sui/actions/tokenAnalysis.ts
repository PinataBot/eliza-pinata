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
import { putBlob } from "../utils/walrus.ts";

interface CoinTypeTypes extends Content {
  coinType: any;
}

// Compose the prompt to analyze the token data
const coinTypePrompt = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "coinType": "0x76cb819b01abed502bee8a702b4c2d547532c12f25001c9dea795a5e631c26f1::fud::FUD"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested coin type analysis:
- Coin type


Respond with a JSON markdown block containing only the extracted value.
`;

// Compose the prompt to analyze the token data
const analysisPrompt = (
  marketData: any
) => `Analyze the following token data and provide a trading recommendation.
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

Token data: ${marketData} 
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

      // Initialize or update state
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      } else {
        state = await runtime.updateRecentMessageState(state);
      }

      const coinTypeSchema = z.object({
        coinType: z.string(),
      });

      // Compose transfer context
      const tokenInfoContext = composeContext({
        state,
        template: coinTypePrompt,
      });

      // Execute prompt to extract cointype
      const content = await generateObject({
        runtime,
        context: tokenInfoContext,
        schema: coinTypeSchema,
        modelClass: ModelClass.LARGE,
      });

      const coinTypeContent = content.object as CoinTypeTypes;
      console.log("Coin Type", coinTypeContent.coinType);
      if (!coinTypeContent.coinType) {
        throw new Error("Can't fetch coin type");
      }
      // TODO:: check if the coinType is valid
      const tokenData = await fetchTokenData(coinTypeContent.coinType);
      console.log("Token Data", tokenData);

      const analysisContext = composeContext({
        state,
        template: analysisPrompt(JSON.stringify(tokenData)),
      });

      console.log("Analysis Prompt", analysisPrompt(JSON.stringify(tokenData)));
      console.log("Analysis Context", analysisContext);

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
      await putBlob(analysisResult);
      // Parse the analysis response
      const tradeRecommendation = parseJSONObjectFromText(analysisResult);
      elizaLogger.info(
        `Parsed recommendation for token ${
          coinTypeContent.coinType || "unknown"
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
