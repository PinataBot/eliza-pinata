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
import { MessageActionType } from "../types/MessageActionType.ts";

interface CoinTypeTypes extends Content {
  coinType: string;
}

// Compose the prompt to analyze the token data
const coinTypePrompt = `Get multiple tokens. Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
  
  Example response:
  \`\`\`json
  {
      "coinType": "0x76cb819b01abed502bee8a702b4c2d547532c12f25001c9dea795a5e631c26f1::fud::FUD,0x23e99e646a4071609a2957d0b7c7bac73eaefc2f94640e9d8d54e4ab77f8cd6e::dapy::DAPY,0xd976fda9a9786cda1a36dee360013d775a5e5f206f8e20f84fad3385e99eeb2d::aaa::AAA"
  }
  \`\`\`
  
  {{recentMessages}}
  
  Given the recent messages, extract the following information about the requested coin type analysis:
  - Coins type
  
  
  Respond with a JSON markdown block containing only the extracted value.
  `;

// Compose the prompt to analyze the token data
const analysisPrompt = (
  marketData: any
) => `Analyze the following tokens data and provide a trading recommendation. Choose the best token to trade. ONLY ONE TOKEN YOU SHOULD RECOMMEND.
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
  name: "ANALYZE_MULTIPLE_TOKENS",
  similes: ["ANALYZE_MULTIPLE_TOKENS", "ANALYZE_MULTIPLE"],
  description: "Analyze multiple tokens for trading opportunities",
  examples: [],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    elizaLogger.info(
      "Validating ANALYZE_MULTIPLE_TOKENS for agent:",
      message.agentId
    );
    return true;
  },
  handler: async (runtime, message, state, params, callback) => {
    try {
      elizaLogger.log("Starting ANALYZE_MULTIPLE_TOKENS handler...");

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

      //console.log("Analysis Prompt", analysisPrompt(JSON.stringify(tokenData)));
      //console.log("Analysis Context", analysisContext);

      // Generate analysis using the prompt
      const analysisResult = await generateText({
        runtime,
        context: analysisContext,
        modelClass: ModelClass.LARGE,
      });

      if (!analysisResult) {
        throw new Error("Failed to generate analysis.");
      }

      elizaLogger.debug("raw analysis response:", analysisResult);
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
          type: "multiple_tokens",
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error(`${MessageActionType.TRENDING_TOKENS} handler error:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  },
} as Action;
