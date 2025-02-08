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
import { fetchTokenData } from "../../utils/fetchTokensData.ts";

interface CoinTypeTypes extends Content {
  coinType: any;
}

// Compose the prompt to analyze the token data
const coinTypePrompt = `Analyze the last message and extract coin type from the text.
{{recentMessages}}

Given the recent messages, extract the following information about the requested analysis:
- Coin type

Example input:
Analyze the token 0x2::sui::SUI

Example output:
{
  "coinType": "0x2::sui::SUI"
}
`;

async function putBlob(data: string) {
  try {
    const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
    const response = await fetch(`${PUBLISHER_URL}/v1/blobs`, {
      method: "PUT",
      body: data,
      headers: {
        "Content-Type": "text/plain", // Adjust the content type if needed
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.text(); // or response.json() if the response is JSON
    console.log("Response:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

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
        modelClass: ModelClass.SMALL,
      });

      const coinTypeContent = content.object as CoinTypeTypes;
      console.log("Coin Type", coinTypeContent.coinType);
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
