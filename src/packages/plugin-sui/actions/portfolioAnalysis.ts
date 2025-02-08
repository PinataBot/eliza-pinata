import {
  type Action,
  elizaLogger,
  generateText,
  generateObject,
  ModelClass,
  parseJSONObjectFromText,
  State,
  composeContext,
  IAgentRuntime,
  Memory,
  HandlerCallback,
  Content,
  ServiceType,
} from "@elizaos/core";
import { z } from "zod";
import { SuiService } from "../services/sui";

interface PorfolioTypes extends Content {
  coinType: any;
}

function isPorfolioTypes(content: Content): content is PorfolioTypes {
  console.log("Content for transfer", content);
  return typeof content.coinType === "string";
}

// Compose the prompt to analyze the token data
const portfolioAnalysisPrompt = `Analyze the following token portfolio and provide a trading recommendation. Use null for any values that cannot be determined.

Return the response as a JSON object with the following structure:
Example response:
\`\`\`json
{
  "tokenName": string,
  "coinType": string,
  "recommendation": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reasoning": string,
  "risks": string[],
  "opportunities": string[]
}
\`\`\`

{{recentMessages}}
`;

// Compose the prompt to analyze the token data
const tokenInfoPrompt = (
  coinTypeData: any
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

Token Data:
${JSON.stringify(coinTypeData, null, 2)}`;

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

      // Initialize or update state
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      } else {
        state = await runtime.updateRecentMessageState(state);
      }

      const portfolioSchema = z.object({
        coinType: z.string(),
      });
      // Compose transfer context
      const tokenInfoContext = composeContext({
        state,
        template: portfolioAnalysisPrompt,
      });
      // Execute prompt to extract cointype
      const content = await generateObject({
        runtime,
        context: tokenInfoContext,
        schema: portfolioSchema,
        modelClass: ModelClass.SMALL,
      });

      const portfolioContent = content.object as PorfolioTypes;
      console.log("Portfolio Cointype", portfolioContent.coinType);

      async function fetchTokenInfo(coinType: string) {
        try {
          const response = await fetch(
            `https://api.insidex.trade/external/coin-details?coins=${coinType}`
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `HTTP error! status: ${response.status}, message: ${errorText}`
            );
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error(`Attempt failed:`, error);
          return null;
        }
      }

      const tokenInfo = await fetchTokenInfo(portfolioContent.coinType);

      const analysisContext = composeContext({
        state,
        template: tokenInfoPrompt(tokenInfo),
      });

      // Generate analysis using the prompt
      const analysisResultRaw = await generateText({
        runtime,
        context: analysisContext,
        modelClass: ModelClass.LARGE,
      });

      if (!analysisResultRaw) {
        throw new Error("Failed to generate analysis.");
      }

      elizaLogger.debug("Raw analysis response:", analysisResultRaw);
      // TODO:: Parse the analysis response

      if (callback) {
        await callback({
          text: JSON.stringify(analysisResultRaw),
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
